import { Text, View } from 'react-native';

function colorFor(score: number): string {
  if (score >= 80) return '#3FD08A';
  if (score >= 60) return '#5B8CFF';
  if (score >= 40) return '#E8B23A';
  return '#FF5A5F';
}

export function ScoreBar({ label, score }: { label: string; score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <View className="mb-3">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-sm text-muted">{label}</Text>
        <Text className="text-sm font-semibold text-white">{clamped}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-ink-700">
        <View
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: colorFor(clamped) }}
        />
      </View>
    </View>
  );
}

export function BigScore({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <View className="items-center py-2">
      <Text className="text-6xl font-bold" style={{ color: colorFor(clamped) }}>
        {clamped}
      </Text>
      <Text className="mt-1 text-xs tracking-widest text-muted">종합 점수</Text>
    </View>
  );
}
