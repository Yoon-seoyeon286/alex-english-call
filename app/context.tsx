import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { Button } from '@/components/Button';
import { MemoryCard } from '@/features/memory/MemoryCard';
import { ingestUserNote } from '@/services/analysis/postCall';
import { scoreMemories, type ScoredMemory } from '@/services/memory/retrieval';
import { deleteMemory, listActiveMemories } from '@/services/database/repositories/memories';
import { AI_NAME } from '@/services/openai/config';
import { friendlyMessage } from '@/utils/errors';

const PLACEHOLDER = `Anything you want ${AI_NAME} to know. For example:

I have an important presentation this Friday.
I started going to the gym last week.
Meeting Jiwoo for dinner on Saturday.
I've been learning React lately.`;

export default function AddContextScreen() {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [memories, setMemories] = useState<ScoredMemory[]>([]);

  const load = useCallback(async () => {
    const all = await listActiveMemories();
    setMemories(scoreMemories(all));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSave = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      const count = await ingestUserNote(trimmed);
      setText('');
      setSaved(count);
      await load();
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }, [text, saving, load]);

  const onDelete = useCallback(
    async (id: string) => {
      await deleteMemory(id);
      await load();
    },
    [load],
  );

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
          <Text className="text-2xl font-bold text-white">Add Context</Text>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text className="text-sm text-accent-soft">Done</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-5">
            <Text className="mb-4 text-sm leading-5 text-muted">
              Write freely. {AI_NAME} turns this into things he remembers and brings up naturally on
              your next call.
            </Text>

            <TextInput
              className="min-h-[160px] rounded-2xl bg-ink-800 p-4 text-[15px] leading-6 text-white"
              placeholder={PLACEHOLDER}
              placeholderTextColor="#5A6076"
              multiline
              textAlignVertical="top"
              value={text}
              onChangeText={setText}
              editable={!saving}
            />

            <View className="mt-4">
              <Button
                label={saving ? 'Saving…' : 'Save'}
                loading={saving}
                disabled={text.trim().length === 0}
                onPress={onSave}
              />
            </View>

            {error ? (
              <View className="mt-3 rounded-2xl border border-danger/40 bg-danger/10 p-3.5">
                <Text className="text-sm leading-5 text-white">{error}</Text>
              </View>
            ) : null}

            {saved !== null ? (
              <View className="mt-3 rounded-2xl border border-ok/40 bg-ok/10 p-3.5">
                <Text className="text-sm text-white">
                  {saved > 0
                    ? `Saved. ${AI_NAME} will remember ${saved} thing${saved === 1 ? '' : 's'}.`
                    : `Nothing new to add — ${AI_NAME} already knew that.`}
                </Text>
              </View>
            ) : null}

            {/* Everything Alex currently knows -------------------------- */}
            <View className="mt-9">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                {AI_NAME} currently remembers ({memories.length})
              </Text>

              {memories.length === 0 ? (
                <Text className="text-sm text-muted">Nothing yet.</Text>
              ) : (
                <View className="gap-2">
                  {memories.map((m) => (
                    <View key={m.memory.id}>
                      <MemoryCard item={m} />
                      <Pressable
                        onPress={() => void onDelete(m.memory.id)}
                        hitSlop={6}
                        className="mt-1 self-end"
                      >
                        <Text className="text-[11px] text-muted">Forget this</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {saving ? (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <ActivityIndicator color="#5B8CFF" />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
