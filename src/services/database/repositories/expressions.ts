import { getDatabase } from '../db';
import { createId } from '@/utils/id';
import type { Expression } from '@/types';

export async function saveExpression(input: {
  sessionId?: string | null;
  expression: string;
  meaning?: string;
  example?: string;
}): Promise<void> {
  const db = getDatabase();
  const expression = input.expression.trim();
  if (!expression) return;

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM expressions WHERE expression = ? COLLATE NOCASE`,
    expression,
  );
  if (existing) return;

  await db.runAsync(
    `INSERT INTO expressions (id, sessionId, expression, meaning, example, createdAt, reviewCount, masteryLevel)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
    createId('exp'),
    input.sessionId ?? null,
    expression,
    input.meaning ?? '',
    input.example ?? '',
    Date.now(),
  );
}

export async function listExpressions(limit = 100): Promise<Expression[]> {
  const db = getDatabase();
  return db.getAllAsync<Expression>(
    `SELECT * FROM expressions ORDER BY createdAt DESC LIMIT ?`,
    limit,
  );
}

export async function isExpressionSaved(expression: string): Promise<boolean> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM expressions WHERE expression = ? COLLATE NOCASE`,
    expression.trim(),
  );
  return Boolean(row);
}

export async function reviewExpression(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE expressions
     SET reviewCount = reviewCount + 1,
         masteryLevel = MIN(5, masteryLevel + 1)
     WHERE id = ?`,
    id,
  );
}

export async function deleteExpression(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM expressions WHERE id = ?`, id);
}
