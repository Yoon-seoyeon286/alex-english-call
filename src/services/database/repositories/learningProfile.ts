import { getDatabase } from '../db';
import type { EnglishLevel, LearningProfile } from '@/types';

const PROFILE_ID = 'primary';

interface ProfileRow {
  id: string;
  currentLevel: string;
  commonMistakes: string;
  weakAreas: string;
  recentExpressions: string;
  overallProgress: number | null;
  updatedAt: number;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapProfile(row: ProfileRow): LearningProfile {
  return {
    id: row.id,
    currentLevel: (row.currentLevel as EnglishLevel) ?? 'intermediate',
    commonMistakes: parseJson<Record<string, number>>(row.commonMistakes, {}),
    weakAreas: parseJson<string[]>(row.weakAreas, []),
    recentExpressions: parseJson<string[]>(row.recentExpressions, []),
    overallProgress: row.overallProgress,
    updatedAt: row.updatedAt,
  };
}

export async function getLearningProfile(): Promise<LearningProfile> {
  const db = getDatabase();
  const row = await db.getFirstAsync<ProfileRow>(
    `SELECT * FROM learningProfile WHERE id = ?`,
    PROFILE_ID,
  );

  if (row) return mapProfile(row);

  const now = Date.now();
  await db.runAsync(
    `INSERT INTO learningProfile (id, currentLevel, commonMistakes, weakAreas, recentExpressions, overallProgress, updatedAt)
     VALUES (?, 'intermediate', '{}', '[]', '[]', NULL, ?)`,
    PROFILE_ID,
    now,
  );

  return {
    id: PROFILE_ID,
    currentLevel: 'intermediate',
    commonMistakes: {},
    weakAreas: [],
    recentExpressions: [],
    overallProgress: null,
    updatedAt: now,
  };
}

/**
 * Recomputes the learning profile from the correction/score history.
 *
 * This is deliberately kept apart from conversation memory: it describes how
 * the user speaks English, never what is going on in their life.
 */
export async function refreshLearningProfile(levelEstimate?: EnglishLevel): Promise<void> {
  const db = getDatabase();
  await getLearningProfile();

  const mistakes = await db.getAllAsync<{ category: string; count: number }>(
    `SELECT category, COUNT(*) AS count FROM corrections GROUP BY category ORDER BY count DESC`,
  );
  const commonMistakes: Record<string, number> = {};
  for (const m of mistakes) commonMistakes[m.category] = m.count;

  const weakAreas = mistakes.slice(0, 3).map((m) => m.category);

  const expressions = await db.getAllAsync<{ expression: string }>(
    `SELECT expression FROM expressions ORDER BY createdAt DESC LIMIT 12`,
  );

  const progress = await db.getFirstAsync<{ avg: number | null }>(
    `SELECT AVG(overallScore) AS avg FROM (
       SELECT overallScore FROM sessions
       WHERE overallScore IS NOT NULL
       ORDER BY startedAt DESC LIMIT 5
     )`,
  );

  const sets: string[] = [
    'commonMistakes = ?',
    'weakAreas = ?',
    'recentExpressions = ?',
    'overallProgress = ?',
    'updatedAt = ?',
  ];
  const args: Array<string | number | null> = [
    JSON.stringify(commonMistakes),
    JSON.stringify(weakAreas),
    JSON.stringify(expressions.map((e) => e.expression)),
    progress?.avg != null ? Math.round(progress.avg) : null,
    Date.now(),
  ];

  if (levelEstimate) {
    sets.unshift('currentLevel = ?');
    args.unshift(levelEstimate);
  }

  args.push(PROFILE_ID);
  await db.runAsync(`UPDATE learningProfile SET ${sets.join(', ')} WHERE id = ?`, ...args);
}
