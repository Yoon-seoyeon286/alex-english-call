import { Text, View } from 'react-native';
import type { ScoredMemory } from '@/services/memory/retrieval';
import { daysFromToday } from '@/utils/date';

const TYPE_LABEL: Record<string, string> = {
  upcoming_event: 'Coming up',
  recent_event: 'Recently',
  person: 'Person',
  current_project: 'Working on',
  interest: 'Interest',
  concern: 'On their mind',
  goal: 'Goal',
  preference: 'Preference',
  experience: 'Experience',
  follow_up: 'Follow up',
};

function whenLabel(item: ScoredMemory): string | null {
  const days = daysFromToday(item.memory.relevantDate);
  if (days === null) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < -1 && days >= -7) return `${Math.abs(days)} days ago`;
  return null;
}

export function MemoryCard({ item }: { item: ScoredMemory }) {
  const when = whenLabel(item);
  const isDue = item.cue === 'due_followup';

  return (
    <View
      className={`rounded-2xl p-4 ${isDue ? 'border border-accent/40 bg-accent/10' : 'bg-ink-800'}`}
    >
      <View className="mb-1.5 flex-row items-center">
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-accent-soft">
          {TYPE_LABEL[item.memory.type] ?? item.memory.type}
        </Text>
        {when ? <Text className="ml-2 text-[10px] text-muted">· {when}</Text> : null}
        {item.memory.source === 'user_defined' ? (
          <Text className="ml-2 text-[10px] text-muted">· you added this</Text>
        ) : null}
      </View>
      <Text className="text-[15px] leading-5 text-white">{item.memory.content}</Text>
    </View>
  );
}
