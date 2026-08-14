import { daysFromToday, daysSince } from '@/utils/date';
import { createLogger } from '@/utils/logger';
import {
  listActiveMemories,
  setMemoryActive,
  setMemoryImportance,
} from '@/services/database/repositories/memories';
import type { ConversationMemory, Importance } from '@/types';

const log = createLogger('memory-aging');

/** Types that describe a single moment and stop mattering once it's passed. */
const ONE_OFF_TYPES = new Set<ConversationMemory['type']>([
  'upcoming_event',
  'recent_event',
  'follow_up',
]);

/** Types that describe who the user is — these should persist. */
const DURABLE_TYPES = new Set<ConversationMemory['type']>([
  'person',
  'interest',
  'preference',
  'goal',
  'current_project',
]);

function demote(importance: Importance): Importance {
  if (importance === 'high') return 'medium';
  if (importance === 'medium') return 'low';
  return 'low';
}

export interface AgingResult {
  demoted: number;
  deactivated: number;
  promoted: number;
}

/**
 * Runs once per app launch. Keeps the memory set from turning into an
 * ever-growing pile where a meeting from three months ago still outranks
 * what happened yesterday.
 */
export async function runMemoryAging(): Promise<AgingResult> {
  const memories = await listActiveMemories();
  const result: AgingResult = { demoted: 0, deactivated: 0, promoted: 0 };

  for (const memory of memories) {
    const age = daysSince(memory.createdAt);
    const relDays = daysFromToday(memory.relevantDate);
    const followDays = daysFromToday(memory.followUpAfter);

    // A one-off event whose date is well past, and which we already asked
    // about (or never will), stops being active.
    const eventLongPast = relDays !== null && relDays < -14;
    const followUpLongPast = followDays !== null && followDays < -14;
    const asked = memory.referenceCount > 0;

    if (ONE_OFF_TYPES.has(memory.type) && (eventLongPast || followUpLongPast) && asked) {
      await setMemoryActive(memory.id, false);
      result.deactivated += 1;
      continue;
    }

    // Never referenced, no date, and stale: quietly retire it.
    if (
      age > 60 &&
      memory.referenceCount === 0 &&
      relDays === null &&
      !DURABLE_TYPES.has(memory.type)
    ) {
      await setMemoryActive(memory.id, false);
      result.deactivated += 1;
      continue;
    }

    // Something that came up again and again is part of who they are now.
    if (memory.referenceCount >= 3 && memory.importance !== 'high' && DURABLE_TYPES.has(memory.type)) {
      await setMemoryImportance(memory.id, 'high');
      result.promoted += 1;
      continue;
    }

    // A high-importance one-off loses its urgency once the date has passed.
    if (
      ONE_OFF_TYPES.has(memory.type) &&
      memory.importance !== 'low' &&
      relDays !== null &&
      relDays < -7
    ) {
      await setMemoryImportance(memory.id, demote(memory.importance));
      result.demoted += 1;
      continue;
    }

    // Slow decay for anything old that nobody ever brings up.
    if (age > 30 && memory.referenceCount === 0 && memory.importance === 'high') {
      await setMemoryImportance(memory.id, 'medium');
      result.demoted += 1;
    }
  }

  if (result.demoted || result.deactivated || result.promoted) {
    log.info(
      `aging: ${result.promoted} promoted, ${result.demoted} demoted, ${result.deactivated} retired`,
    );
  }
  return result;
}
