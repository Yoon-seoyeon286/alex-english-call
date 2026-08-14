import * as SQLite from 'expo-sqlite';
import { createLogger } from '@/utils/logger';
import { AppError } from '@/utils/errors';

const log = createLogger('db');

export const DATABASE_NAME = 'alex.db';

let database: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Ordered migrations. Each entry runs exactly once; `user_version` tracks how
 * far we got. Never edit a shipped migration — append a new one instead.
 */
const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER,
        duration INTEGER NOT NULL DEFAULT 0,
        overallScore INTEGER,
        analysisStatus TEXT NOT NULL DEFAULT 'pending',
        analysisError TEXT,
        summary TEXT
      );

      CREATE TABLE IF NOT EXISTS utterances (
        id TEXT PRIMARY KEY NOT NULL,
        sessionId TEXT NOT NULL,
        speaker TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_utterances_session
        ON utterances (sessionId, timestamp);

      CREATE TABLE IF NOT EXISTS corrections (
        id TEXT PRIMARY KEY NOT NULL,
        sessionId TEXT NOT NULL,
        original TEXT NOT NULL,
        corrected TEXT NOT NULL,
        natural TEXT NOT NULL,
        reason TEXT NOT NULL,
        category TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_corrections_session ON corrections (sessionId);
      CREATE INDEX IF NOT EXISTS idx_corrections_category ON corrections (category);

      CREATE TABLE IF NOT EXISTS expressions (
        id TEXT PRIMARY KEY NOT NULL,
        sessionId TEXT,
        expression TEXT NOT NULL,
        meaning TEXT NOT NULL DEFAULT '',
        example TEXT NOT NULL DEFAULT '',
        createdAt INTEGER NOT NULL,
        reviewCount INTEGER NOT NULL DEFAULT 0,
        masteryLevel INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_expressions_created ON expressions (createdAt DESC);

      CREATE TABLE IF NOT EXISTS sessionScores (
        id TEXT PRIMARY KEY NOT NULL,
        sessionId TEXT NOT NULL UNIQUE,
        grammar INTEGER NOT NULL,
        fluency INTEGER NOT NULL,
        vocabulary INTEGER NOT NULL,
        naturalness INTEGER NOT NULL,
        communication INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS conversationMemories (
        id TEXT PRIMARY KEY NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        importance TEXT NOT NULL,
        source TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        relevantDate TEXT,
        followUpAfter TEXT,
        lastReferencedAt INTEGER,
        referenceCount INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        sessionId TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memories_active
        ON conversationMemories (isActive, importance);
      CREATE INDEX IF NOT EXISTS idx_memories_followup
        ON conversationMemories (followUpAfter);

      CREATE TABLE IF NOT EXISTS learningProfile (
        id TEXT PRIMARY KEY NOT NULL,
        currentLevel TEXT NOT NULL DEFAULT 'intermediate',
        commonMistakes TEXT NOT NULL DEFAULT '{}',
        weakAreas TEXT NOT NULL DEFAULT '[]',
        recentExpressions TEXT NOT NULL DEFAULT '[]',
        overallProgress INTEGER,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pendingNotes (
        id TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `,
  },
  {
    // The teacher already produced strengths/weaknesses; we just weren't
    // keeping them. Stored as JSON arrays of Korean sentences.
    version: 2,
    sql: `
      ALTER TABLE sessions ADD COLUMN strengths TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE sessions ADD COLUMN weaknesses TEXT NOT NULL DEFAULT '[]';
    `,
  },
];

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  const target = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

  if (current >= target) {
    log.debug(`schema up to date (v${current})`);
    return;
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    log.info(`applying migration v${migration.version}`);
    await db.execAsync(migration.sql);
    await db.execAsync(`PRAGMA user_version = ${migration.version};`);
  }
  log.info(`schema migrated ${current} -> ${target}`);
}

/** Opens (once) and migrates the database. Safe to call from anywhere. */
export function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await runMigrations(db);
      database = db;
      return db;
    } catch (err) {
      initPromise = null;
      log.error('failed to open database', err);
      throw new AppError('database_failed', 'Could not open the local database.', err);
    }
  })();

  return initPromise;
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!database) {
    throw new AppError('database_failed', 'Database used before initDatabase() finished.');
  }
  return database;
}

/** For tests / hard resets. */
export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.closeAsync();
    database = null;
    initPromise = null;
  }
}
