import { getDatabase } from '../db';
import { createId } from '@/utils/id';
import type { Correction, CorrectionCategory, SessionScores, TeacherReport } from '@/types';

export async function saveCorrections(
  sessionId: string,
  corrections: TeacherReport['corrections'],
): Promise<void> {
  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM corrections WHERE sessionId = ?`, sessionId);
    for (const c of corrections) {
      await db.runAsync(
        `INSERT INTO corrections (id, sessionId, original, corrected, natural, reason, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        createId('cor'),
        sessionId,
        c.original,
        c.corrected,
        c.natural,
        c.reason,
        c.category,
      );
    }
  });
}

export async function getCorrections(sessionId: string): Promise<Correction[]> {
  const db = getDatabase();
  return db.getAllAsync<Correction>(`SELECT * FROM corrections WHERE sessionId = ?`, sessionId);
}

export interface MistakeCount {
  category: CorrectionCategory;
  count: number;
}

export async function getMistakeCounts(): Promise<MistakeCount[]> {
  const db = getDatabase();
  return db.getAllAsync<MistakeCount>(
    `SELECT category, COUNT(*) AS count
     FROM corrections
     GROUP BY category
     ORDER BY count DESC`,
  );
}

export async function saveScores(
  sessionId: string,
  scores: Omit<SessionScores, 'id' | 'sessionId'>,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO sessionScores (id, sessionId, grammar, fluency, vocabulary, naturalness, communication)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sessionId) DO UPDATE SET
       grammar = excluded.grammar,
       fluency = excluded.fluency,
       vocabulary = excluded.vocabulary,
       naturalness = excluded.naturalness,
       communication = excluded.communication`,
    createId('scr'),
    sessionId,
    scores.grammar,
    scores.fluency,
    scores.vocabulary,
    scores.naturalness,
    scores.communication,
  );
}

export async function getScores(sessionId: string): Promise<SessionScores | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<SessionScores>(
    `SELECT * FROM sessionScores WHERE sessionId = ?`,
    sessionId,
  );
  return row ?? null;
}

export interface TrendPoint {
  startedAt: number;
  grammar: number;
  fluency: number;
  vocabulary: number;
  naturalness: number;
}

export async function getScoreTrend(limit = 12): Promise<TrendPoint[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<TrendPoint>(
    `SELECT s.startedAt, sc.grammar, sc.fluency, sc.vocabulary, sc.naturalness
     FROM sessionScores sc
     JOIN sessions s ON s.id = sc.sessionId
     ORDER BY s.startedAt DESC
     LIMIT ?`,
    limit,
  );
  return rows.reverse();
}
