import { getDatabase } from '../db';
import { createId } from '@/utils/id';
import { startOfWeek } from '@/utils/date';
import type { Session, Utterance, Speaker } from '@/types';

interface SessionRow {
  id: string;
  startedAt: number;
  endedAt: number | null;
  duration: number;
  overallScore: number | null;
  analysisStatus: string;
  analysisError: string | null;
  summary: string | null;
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    duration: row.duration,
    overallScore: row.overallScore,
    analysisStatus: (row.analysisStatus as Session['analysisStatus']) ?? 'pending',
    analysisError: row.analysisError,
    summary: row.summary,
  };
}

export async function createSession(startedAt = Date.now()): Promise<string> {
  const db = getDatabase();
  const id = createId('sess');
  await db.runAsync(
    `INSERT INTO sessions (id, startedAt, endedAt, duration, analysisStatus)
     VALUES (?, ?, NULL, 0, 'pending')`,
    id,
    startedAt,
  );
  return id;
}

export async function finishSession(
  sessionId: string,
  endedAt: number,
  durationSeconds: number,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE sessions SET endedAt = ?, duration = ? WHERE id = ?`,
    endedAt,
    Math.max(0, Math.round(durationSeconds)),
    sessionId,
  );
}

export async function markAnalysis(
  sessionId: string,
  status: Session['analysisStatus'],
  opts: { overallScore?: number | null; summary?: string | null; error?: string | null } = {},
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE sessions
     SET analysisStatus = ?, overallScore = ?, summary = ?, analysisError = ?
     WHERE id = ?`,
    status,
    opts.overallScore ?? null,
    opts.summary ?? null,
    opts.error ?? null,
    sessionId,
  );
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<SessionRow>(`SELECT * FROM sessions WHERE id = ?`, sessionId);
  return row ? mapSession(row) : null;
}

export async function listRecentSessions(limit = 8): Promise<Session[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE endedAt IS NOT NULL ORDER BY startedAt DESC LIMIT ?`,
    limit,
  );
  return rows.map(mapSession);
}

/** Deletes calls that produced no speech at all, so Home stays clean. */
export async function deleteEmptySession(sessionId: string): Promise<boolean> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM utterances WHERE sessionId = ?`,
    sessionId,
  );
  if ((row?.count ?? 0) > 0) return false;

  await db.runAsync(`DELETE FROM sessions WHERE id = ?`, sessionId);
  return true;
}

export async function addUtterance(
  sessionId: string,
  speaker: Speaker,
  text: string,
  timestamp = Date.now(),
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO utterances (id, sessionId, speaker, text, timestamp) VALUES (?, ?, ?, ?, ?)`,
    createId('utt'),
    sessionId,
    speaker,
    text,
    timestamp,
  );
}

/**
 * Persists a whole call's transcript in one transaction. This runs BEFORE any
 * network analysis so a failed analysis can never cost us the transcript.
 */
export async function saveTranscript(
  sessionId: string,
  turns: Array<{ speaker: Speaker; text: string; timestamp: number }>,
): Promise<void> {
  const db = getDatabase();
  const clean = turns.filter((t) => t.text.trim().length > 0);
  if (clean.length === 0) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM utterances WHERE sessionId = ?`, sessionId);
    for (const turn of clean) {
      await db.runAsync(
        `INSERT INTO utterances (id, sessionId, speaker, text, timestamp) VALUES (?, ?, ?, ?, ?)`,
        createId('utt'),
        sessionId,
        turn.speaker,
        turn.text.trim(),
        turn.timestamp,
      );
    }
  });
}

export async function getTranscript(sessionId: string): Promise<Utterance[]> {
  const db = getDatabase();
  return db.getAllAsync<Utterance>(
    `SELECT * FROM utterances WHERE sessionId = ? ORDER BY timestamp ASC`,
    sessionId,
  );
}

export interface SpeakingStats {
  totalSessions: number;
  totalSeconds: number;
  weekSeconds: number;
  totalWords: number;
  averageSeconds: number;
}

export async function getSpeakingStats(): Promise<SpeakingStats> {
  const db = getDatabase();

  const totals = await db.getFirstAsync<{ count: number; seconds: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(duration), 0) AS seconds
     FROM sessions WHERE endedAt IS NOT NULL`,
  );
  const week = await db.getFirstAsync<{ seconds: number }>(
    `SELECT COALESCE(SUM(duration), 0) AS seconds
     FROM sessions WHERE endedAt IS NOT NULL AND startedAt >= ?`,
    startOfWeek(),
  );
  const words = await db.getFirstAsync<{ text: string | null }>(
    `SELECT GROUP_CONCAT(text, ' ') AS text FROM utterances WHERE speaker = 'USER'`,
  );

  const totalSessions = totals?.count ?? 0;
  const totalSeconds = totals?.seconds ?? 0;
  const totalWords = words?.text ? words.text.trim().split(/\s+/).filter(Boolean).length : 0;

  return {
    totalSessions,
    totalSeconds,
    weekSeconds: week?.seconds ?? 0,
    totalWords,
    averageSeconds: totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0,
  };
}
