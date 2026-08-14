import { Text, View } from 'react-native';

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-ink-800 p-4">
      <Text className="text-2xl font-bold text-white">{value}</Text>
      <Text className="mt-1 text-[11px] leading-4 text-muted">{label}</Text>
    </View>
  );
}

interface TrendProps {
  label: string;
  values: number[];
  color: string;
}

/**
 * Tiny inline sparkline built from plain Views — no chart library, no SVG
 * layout cost, and it reads fine at this size.
 */
export function TrendRow({ label, values, color }: TrendProps) {
  if (values.length === 0) return null;

  const latest = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const delta = values.length > 1 ? Math.round(latest - first) : 0;

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm text-muted">{label}</Text>
        <View className="flex-row items-baseline">
          <Text className="text-sm font-semibold text-white">{Math.round(latest)}</Text>
          {values.length > 1 ? (
            <Text
              className="ml-2 text-[11px]"
              style={{ color: delta > 0 ? '#3FD08A' : delta < 0 ? '#FF5A5F' : '#8A90A3' }}
            >
              {delta > 0 ? `+${delta}` : delta === 0 ? '—' : delta}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="h-10 flex-row items-end gap-1">
        {values.map((v, i) => (
          <View
            key={`${label}-${i}`}
            className="flex-1 rounded-sm"
            style={{
              height: `${Math.max(6, Math.min(100, v))}%`,
              backgroundColor: color,
              opacity: 0.35 + (0.65 * (i + 1)) / values.length,
            }}
          />
        ))}
      </View>
    </View>
  );
}
