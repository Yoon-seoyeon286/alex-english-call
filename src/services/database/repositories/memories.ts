import { getDatabase } from '../db';
import { createId } from '@/utils/id';
import type { ConversationMemory, ExtractedMemory, Importance, MemorySource } from '@/types';

interface MemoryRow {
  id: string;
  content: string;
  type: string;
  importance: string;
  source: string;
  createdAt: number;
  relevantDate: string | null;
  followUpAfter: string | null;
  lastReferencedAt: number | null;
  referenceCount: number;
  isActive: number;
  sessionId: string | null;
}

function mapMemory(row: MemoryRow): ConversationMemory {
  return {
    id: row.id,
    content: row.content,
    type: row.type as ConversationMemory['type'],
    importance: row.importance as Importance,
    source: row.source as MemorySource,
    createdAt: row.createdAt,
    relevantDate: row.relevantDate,
    followUpAfter: row.followUpAfter,
    lastReferencedAt: row.lastReferencedAt,
    referenceCount: row.referenceCount,
    isActive: row.isActive === 1,
    sessionId: row.sessionId,
  };
}

const emptyToNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
};

export async function listActiveMemories(): Promise<ConversationMemory[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<MemoryRow>(
    `SELECT * FROM conversationMemories WHERE isActive = 1 ORDER BY createdAt DESC`,
  );
  return rows.map(mapMemory);
}

export async function listAllMemories(): Promise<ConversationMemory[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<MemoryRow>(
    `SELECT * FROM conversationMemories ORDER BY createdAt DESC`,
  );
  return rows.map(mapMemory);
}

/**
 * Inserts extracted memories, merging with anything that already says roughly
 * the same thing. A repeated fact gets promoted rather than duplicated — that's
 * what makes "User is actively developing a personal app" stick around while
 * one-off small talk fades.
 */
export async function upsertExtractedMemories(
  memories: ExtractedMemory[],
  source: MemorySource,
  sessionId: string | null,
): Promise<{ inserted: number; merged: number }> {
  const db = getDatabase();
  const existing = await listAllMemories();

  let inserted = 0;
  let merged = 0;
  const now = Date.now();

  for (const memory of memories) {
    const content = memory.content.trim();
    if (!content) continue;

    const duplicate = existing.find((e) => isSimilar(e.content, content));

    if (duplicate) {
      const importance = promote(duplicate.importance);
      await db.runAsync(
        `UPDATE conversationMemories
         SET content = ?,
             importance = ?,
             referenceCount = referenceCount + 1,
             isActive = 1,
             relevantDate = COALESCE(?, relevantDate),
             followUpAfter = COALESCE(?, followUpAfter)
         WHERE id = ?`,
        content,
        importance,
        emptyToNull(memory.relevantDate),
        emptyToNull(memory.followUpAfter),
        duplicate.id,
      );
      duplicate.content = content;
      duplicate.importance = importance;
      merged += 1;
      continue;
    }

    const id = createId('mem');
    await db.runAsync(
      `INSERT INTO conversationMemories
        (id, content, type, importance, source, createdAt, relevantDate, followUpAfter,
         lastReferencedAt, referenceCount, isActive, sessionId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 1, ?)`,
      id,
      content,
      memory.type,
      memory.importance,
      source,
      now,
      emptyToNull(memory.relevantDate),
      emptyToNull(memory.followUpAfter),
      sessionId,
    );
    existing.push({
      id,
      content,
      type: memory.type,
      importance: memory.importance,
      source,
      createdAt: now,
      relevantDate: emptyToNull(memory.relevantDate),
      followUpAfter: emptyToNull(memory.followUpAfter),
      lastReferencedAt: null,
      referenceCount: 0,
      isActive: true,
      sessionId,
    });
    inserted += 1;
  }

  return { inserted, merged };
}

/** Called after a call starts, for the memories we actually put in the prompt. */
export async function markMemoriesReferenced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE conversationMemories
     SET lastReferencedAt = ?, referenceCount = referenceCount + 1
     WHERE id IN (${placeholders})`,
    Date.now(),
    ...ids,
  );
}

export async function setMemoryActive(id: string, isActive: boolean): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE conversationMemories SET isActive = ? WHERE id = ?`,
    isActive ? 1 : 0,
    id,
  );
}

export async function setMemoryImportance(id: string, importance: Importance): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`UPDATE conversationMemories SET importance = ? WHERE id = ?`, importance, id);
}

export async function deleteMemory(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM conversationMemories WHERE id = ?`, id);
}

export async function countActiveMemories(): Promise<number> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM conversationMemories WHERE isActive = 1`,
  );
  return row?.count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Notes the extraction step couldn't process yet (offline, API down). */
/* ------------------------------------------------------------------ */

export async function queuePendingNote(text: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO pendingNotes (id, text, createdAt) VALUES (?, ?, ?)`,
    createId('note'),
    text,
    Date.now(),
  );
}

export async function listPendingNotes(): Promise<Array<{ id: string; text: string }>> {
  const db = getDatabase();
  return db.getAllAsync<{ id: string; text: string }>(
    `SELECT id, text FROM pendingNotes ORDER BY createdAt ASC`,
  );
}

export async function deletePendingNote(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM pendingNotes WHERE id = ?`, id);
}

/* ------------------------------------------------------------------ */

function promote(importance: Importance): Importance {
  if (importance === 'low') return 'medium';
  if (importance === 'medium') return 'high';
  return 'high';
}

const STOP_WORDS = new Set([
  'user',
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'to',
  'of',
  'in',
  'on',
  'at',
  'and',
  'or',
  'has',
  'have',
  'had',
  'this',
  'that',
  'it',
  'for',
  'with',
  'their',
  'them',
  'they',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

/** Jaccard overlap on content words — cheap, offline, and good enough. */
function isSimilar(a: string, b: string): boolean {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return false;

  let shared = 0;
  setA.forEach((w) => {
    if (setB.has(w)) shared += 1;
  });

  const union = setA.size + setB.size - shared;
  return union > 0 && shared / union >= 0.6;
}
