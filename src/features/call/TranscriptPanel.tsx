import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AI_NAME } from '@/services/openai/config';
import type { LiveTurn } from '@/types';

export function TranscriptPanel({ turns }: { turns: LiveTurn[] }) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [turns]);

  return (
    <View className="flex-1 rounded-2xl bg-ink-900 p-3">
      {turns.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted">The transcript will appear here.</Text>
        </View>
      ) : (
        <ScrollView ref={ref} showsVerticalScrollIndicator={false}>
          {turns.map((turn) => (
            <View key={turn.id} className="mb-3">
              <Text
                className={`mb-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  turn.speaker === 'AI' ? 'text-accent-soft' : 'text-muted'
                }`}
              >
                {turn.speaker === 'AI' ? AI_NAME : 'You'}
              </Text>
              <Text className="text-[15px] leading-5 text-white">{turn.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
