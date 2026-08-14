import type { ConversationMemory } from '@/types';
import { daysFromToday, daysSince } from '@/utils/date';
import { MAX_MEMORIES_IN_PROMPT } from '@/services/openai/config';
import { listActiveMemories } from '@/services/database/repositories/memories';

export interface ScoredMemory {
  memory: ConversationMemory;
  score: number;
  /** Why it was picked — used to tell the model how to bring it up. */
  cue: 'due_followup' | 'happening_soon' | 'happened_recently' | 'ongoing' | 'background';
}

const IMPORTANCE_WEIGHT: Record<ConversationMemory['importance'], number> = {
  high: 30,
  medium: 16,
  low: 6,
};

/**
 * Ranks memories for the next call. We never send raw transcripts — only a
 * handful of ranked facts, ordered by the priorities in the product spec:
 *
 *   1. tied to today / very recent dates
 *   2. an explicit follow-up has come due
 *   3. high importance
 *   4. created in a recent call
 *   5. recurring interests (referenceCount)
 *   6. things the owner typed in themselves
 */
export function scoreMemories(memories: ConversationMemory[]): ScoredMemory[] {
  const scored: ScoredMemory[] = [];

  for (const memory of memories) {
    if (!memory.isActive) continue;

    let score = IMPORTANCE_WEIGHT[memory.importance];
    let cue: ScoredMemory['cue'] = 'background';

    // 1. Date relevance -------------------------------------------------
    const relDays = daysFromToday(memory.relevantDate);
    if (relDays !== null) {
      if (relDays === 0) {
        score += 60;
        cue = 'happening_soon';
      } else if (relDays > 0 && relDays <= 3) {
        score += 46 - relDays * 4;
        cue = 'happening_soon';
      } else if (relDays > 3 && relDays <= 14) {
        score += 18;
        cue = 'happening_soon';
      } else if (relDays < 0 && relDays >= -3) {
        score += 50 + relDays * 3;
        cue = 'happened_recently';
      } else if (relDays < -3 && relDays >= -10) {
        score += 14;
        cue = 'happened_recently';
      } else if (relDays < -30) {
        // Long past and never followed up — let it sink.
        score -= 20;
      }
    }

    // 2. Follow-up is due ----------------------------------------------
    const followDays = daysFromToday(memory.followUpAfter);
    if (followDays !== null && followDays <= 0) {
      const neverAsked = memory.lastReferencedAt === null;
      const askedLongAgo =
        memory.lastReferencedAt !== null && daysSince(memory.lastReferencedAt) >= 2;
      if (neverAsked || askedLongAgo) {
        score += 55;
        cue = 'due_followup';
      }
    }

    // 3. Freshness of the memory itself --------------------------------
    const age = daysSince(memory.createdAt);
    if (age <= 1) score += 20;
    else if (age <= 3) score += 12;
    else if (age <= 7) score += 6;
    else if (age > 45) score -= 12;

    // 4. Recurring topics ----------------------------------------------
    score += Math.min(18, memory.referenceCount * 4);
    if (memory.referenceCount >= 2 && cue === 'background') cue = 'ongoing';

    // 5. Things the owner typed in deserve a nudge ----------------------
    if (memory.source === 'user_defined') score += 14;

    // 6. Don't ask the same thing two calls in a row --------------------
    if (memory.lastReferencedAt !== null) {
      const sinceRef = daysSince(memory.lastReferencedAt);
      if (sinceRef === 0) score -= 30;
      else if (sinceRef === 1) score -= 10;
    }

    if (memory.type === 'current_project' || memory.type === 'interest') {
      if (cue === 'background') cue = 'ongoing';
    }

    scored.push({ memory, score, cue });
  }

  return scored.sort((a, b) => b.score - a.score);
}

export interface RetrievedContext {
  selected: ScoredMemory[];
  totalActive: number;
}

/** Loads active memories and returns the top slice for the next call. */
export async function retrieveForCall(
  limit = MAX_MEMORIES_IN_PROMPT,
): Promise<RetrievedContext> {
  const all = await listActiveMemories();
  const scored = scoreMemories(all);

  // Keep a little variety: never let one category eat the whole prompt.
  const selected: ScoredMemory[] = [];
  const perType = new Map<string, number>();

  for (const item of scored) {
    const used = perType.get(item.memory.type) ?? 0;
    const cap = item.cue === 'due_followup' || item.cue === 'happening_soon' ? 5 : 3;
    if (used >= cap) continue;
    perType.set(item.memory.type, used + 1);
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return { selected, totalActive: all.length };
}

/** The handful of memories Home shows as "what Alex remembers today". */
export async function retrieveForHome(limit = 4): Promise<ScoredMemory[]> {
  const all = await listActiveMemories();
  return scoreMemories(all).slice(0, limit);
}
