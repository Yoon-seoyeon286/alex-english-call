import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { saveExpression } from '@/services/database/repositories/expressions';
import type { Correction } from '@/types';

const CATEGORY_LABEL: Record<string, string> = {
  grammar: 'Grammar',
  tense: 'Tense',
  article: 'Articles',
  preposition: 'Prepositions',
  word_choice: 'Word choice',
  word_order: 'Word order',
  plural: 'Plurals',
  subject_verb_agreement: 'Agreement',
  naturalness: 'Naturalness',
  other: 'Other',
};

export function CorrectionCard({ correction }: { correction: Correction }) {
  const [saved, setSaved] = useState(false);

  return (
    <View className="rounded-2xl bg-ink-800 p-4">
      <Text className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        {CATEGORY_LABEL[correction.category] ?? correction.category}
      </Text>

      <Field label="What you said" value={correction.original} tone="danger" strike />
      <Field label="Corrected" value={correction.corrected} tone="neutral" />
      <Field label="More natural" value={correction.natural} tone="ok" />

      <Text className="mt-3 text-[13px] leading-5 text-muted">{correction.reason}</Text>

      <Pressable
        className="mt-3 self-start rounded-full bg-ink-700 px-3.5 py-2 active:bg-ink-600"
        onPress={() => {
          if (saved) return;
          setSaved(true);
          void saveExpression({
            sessionId: correction.sessionId,
            expression: correction.natural,
            meaning: correction.reason,
            example: correction.natural,
          });
        }}
      >
        <Text className="text-xs text-white">{saved ? 'Saved' : 'Save this phrase'}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  tone,
  strike,
}: {
  label: string;
  value: string;
  tone: 'danger' | 'neutral' | 'ok';
  strike?: boolean;
}) {
  const color = tone === 'danger' ? '#FF8A8D' : tone === 'ok' ? '#3FD08A' : '#FFFFFF';
  return (
    <View className="mb-2.5">
      <Text className="mb-1 text-[11px] text-muted">{label}</Text>
      <Text
        className="text-[15px] leading-5"
        style={{
          color,
          textDecorationLine: strike ? 'line-through' : 'none',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
