import { analyzeTranscript, extractMemories, type WireTurn } from '@/services/openai/client';
import { getTranscript, getSession, markAnalysis } from '@/services/database/repositories/sessions';
import { saveCorrections, saveScores } from '@/services/database/repositories/analysis';
import { saveExpression } from '@/services/database/repositories/expressions';
import {
  deletePendingNote,
  listActiveMemories,
  listPendingNotes,
  queuePendingNote,
  upsertExtractedMemories,
} from '@/services/database/repositories/memories';
import {
  getLearningProfile,
  refreshLearningProfile,
} from '@/services/database/repositories/learningProfile';
import { todayISO } from '@/utils/date';
import { createLogger } from '@/utils/logger';
import { AppError } from '@/utils/errors';
import type { TeacherReport } from '@/types';

const log = createLogger('post-call');

export interface PostCallOutcome {
  memoriesSaved: number;
  report: TeacherReport | null;
  analysisError: string | null;
}

/**
 * Everything that happens after End Call.
 *
 * Order matters: the transcript is already in SQLite before this runs, and
 * memory extraction happens BEFORE scoring — remembering the user's life is
 * the point of the app, the grammar report is a bonus. Either half can fail
 * without taking the other down.
 */
export async function runPostCallPipeline(sessionId: string): Promise<PostCallOutcome> {
  const utterances = await getTranscript(sessionId);
  const transcript: WireTurn[] = utterances.map((u) => ({ speaker: u.speaker, text: u.text }));
  const userTurns = transcript.filter((t) => t.speaker === 'USER');

  const outcome: PostCallOutcome = { memoriesSaved: 0, report: null, analysisError: null };

  if (userTurns.length === 0) {
    await markAnalysis(sessionId, 'failed', { error: 'No speech was captured in this call.' });
    outcome.analysisError = 'No speech was captured in this call.';
    return outcome;
  }

  // 1. Conversation memory ------------------------------------------------
  try {
    const existing = await listActiveMemories();
    const extracted = await extractMemories({
      source: 'conversation',
      transcript,
      today: todayISO(),
      existing: existing.map((m) => m.content).slice(0, 60),
    });
    const { inserted, merged } = await upsertExtractedMemories(extracted, 'conversation', sessionId);
    outcome.memoriesSaved = inserted + merged;
    log.info(`memory: +${inserted} new, ${merged} merged`);
  } catch (err) {
    log.warn('memory extraction failed', err);
  }

  // 2. Teacher agent ------------------------------------------------------
  const session = await getSession(sessionId);
  const profile = await getLearningProfile();

  try {
    const report = await analyzeTranscript({
      transcript,
      durationSeconds: session?.duration ?? 0,
      previousLevel: profile.currentLevel,
    });

    await saveScores(sessionId, {
      grammar: report.grammarScore,
      fluency: report.fluencyScore,
      vocabulary: report.vocabularyScore,
      naturalness: report.naturalnessScore,
      communication: report.communicationScore,
    });
    await saveCorrections(sessionId, report.corrections ?? []);

    for (const expr of report.recommendedExpressions ?? []) {
      await saveExpression({
        sessionId,
        expression: expr.expression,
        meaning: expr.meaning,
        example: expr.example,
      });
    }

    await markAnalysis(sessionId, 'done', {
      overallScore: report.overallScore,
      summary: report.summary,
      strengths: report.strengths ?? [],
      weaknesses: report.weaknesses ?? [],
    });
    await refreshLearningProfile(report.levelEstimate);

    outcome.report = report;
    log.info(`analysis done, overall ${report.overallScore}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markAnalysis(sessionId, 'failed', { error: message });
    outcome.analysisError = message;
    log.warn('analysis failed (transcript is safe)', err);
  }

  return outcome;
}

/** Retry entry point for the Review screen's "Try again" button. */
export async function retryAnalysis(sessionId: string): Promise<TeacherReport> {
  const utterances = await getTranscript(sessionId);
  const transcript: WireTurn[] = utterances.map((u) => ({ speaker: u.speaker, text: u.text }));
  if (transcript.filter((t) => t.speaker === 'USER').length === 0) {
    throw new AppError('analysis_failed', 'There is no user speech in this call to analyse.');
  }

  const session = await getSession(sessionId);
  const profile = await getLearningProfile();

  const report = await analyzeTranscript({
    transcript,
    durationSeconds: session?.duration ?? 0,
    previousLevel: profile.currentLevel,
  });

  await saveScores(sessionId, {
    grammar: report.grammarScore,
    fluency: report.fluencyScore,
    vocabulary: report.vocabularyScore,
    naturalness: report.naturalnessScore,
    communication: report.communicationScore,
  });
  await saveCorrections(sessionId, report.corrections ?? []);
  for (const expr of report.recommendedExpressions ?? []) {
    await saveExpression({
      sessionId,
      expression: expr.expression,
      meaning: expr.meaning,
      example: expr.example,
    });
  }
  await markAnalysis(sessionId, 'done', {
    overallScore: report.overallScore,
    summary: report.summary,
    strengths: report.strengths ?? [],
    weaknesses: report.weaknesses ?? [],
  });
  await refreshLearningProfile(report.levelEstimate);

  return report;
}

/**
 * Turns a free-text note the owner typed into structured memories.
 * If the network is down we keep the raw text and retry on next launch, so a
 * note is never silently lost.
 */
export async function ingestUserNote(text: string): Promise<number> {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  try {
    const existing = await listActiveMemories();
    const extracted = await extractMemories({
      source: 'user_defined',
      text: trimmed,
      today: todayISO(),
      existing: existing.map((m) => m.content).slice(0, 60),
    });
    const { inserted, merged } = await upsertExtractedMemories(extracted, 'user_defined', null);
    return inserted + merged;
  } catch (err) {
    log.warn('note extraction failed, queueing for retry', err);
    await queuePendingNote(trimmed);
    throw err;
  }
}

/** Drains notes that failed to process earlier. Called on app launch. */
export async function flushPendingNotes(): Promise<number> {
  const pending = await listPendingNotes();
  if (pending.length === 0) return 0;

  let processed = 0;
  for (const note of pending) {
    try {
      const existing = await listActiveMemories();
      const extracted = await extractMemories({
        source: 'user_defined',
        text: note.text,
        today: todayISO(),
        existing: existing.map((m) => m.content).slice(0, 60),
      });
      await upsertExtractedMemories(extracted, 'user_defined', null);
      await deletePendingNote(note.id);
      processed += 1;
    } catch {
      // Still offline — leave it queued.
      break;
    }
  }
  if (processed > 0) log.info(`flushed ${processed} pending note(s)`);
  return processed;
}
