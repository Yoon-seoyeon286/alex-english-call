import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { Button } from '@/components/Button';
import { Card, Empty, SectionLabel } from '@/components/Card';
import { MemoryCard } from '@/features/memory/MemoryCard';
import { retrieveForHome, type ScoredMemory } from '@/services/memory/retrieval';
import { deleteSession, listRecentSessions } from '@/services/database/repositories/sessions';
import { AI_NAME, isBackendConfigured } from '@/services/openai/config';
import { formatDuration, formatFriendlyDate, formatRelativeDay } from '@/utils/date';
import type { Session } from '@/types';

export default function HomeScreen() {
  const [memories, setMemories] = useState<ScoredMemory[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [mem, recent] = await Promise.all([retrieveForHome(4), listRecentSessions(5)]);
    setMemories(mem);
    setSessions(recent);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert(
        '이 리포트를 삭제할까요?',
        '대화 내용과 점수, 교정 기록이 지워집니다. 저장한 표현과 Alex의 기억은 그대로 남아요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              void deleteSession(id).then(load);
            },
          },
        ],
      );
    },
    [load],
  );

  const configured = isBackendConfigured();

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5B8CFF" />
        }
      >
        <View className="px-5 pt-4">
          {/* Header ------------------------------------------------- */}
          <Text className="text-sm text-muted">{formatFriendlyDate()}</Text>
          <Text className="mt-1 text-4xl font-bold text-white">{AI_NAME}</Text>

          {!configured ? (
            <View className="mt-5 rounded-2xl border border-danger/40 bg-danger/10 p-4">
              <Text className="mb-1 text-sm font-semibold text-white">Backend not configured</Text>
              <Text className="text-xs leading-5 text-muted">
                This build has no API URL or app token. Set EXPO_PUBLIC_API_BASE_URL and
                EXPO_PUBLIC_APP_TOKEN in eas.json and rebuild.
              </Text>
            </View>
          ) : null}

          {/* What Alex remembers ------------------------------------ */}
          <View className="mt-8">
            <SectionLabel>What {AI_NAME} remembers</SectionLabel>
            {memories.length === 0 ? (
              <Empty
                text={`Nothing yet. Have a call, or tap Add Context to tell ${AI_NAME} what's going on this week.`}
              />
            ) : (
              <View className="gap-2">
                {memories.map((m) => (
                  <MemoryCard key={m.memory.id} item={m} />
                ))}
              </View>
            )}
          </View>

          {/* Recent calls -------------------------------------------- */}
          <View className="mt-8">
            <SectionLabel>Recent calls</SectionLabel>
            {sessions.length === 0 ? (
              <Empty text="No calls yet." />
            ) : (
              <View className="gap-2">
                {sessions.map((s) => (
                  <Card
                    key={s.id}
                    onPress={() => router.push(`/review/${s.id}`)}
                    onLongPress={() => confirmDelete(s.id)}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-base font-medium text-white">
                          {formatRelativeDay(s.startedAt)}
                        </Text>
                        <Text className="mt-0.5 text-xs text-muted">
                          {formatDuration(s.duration)}
                          {s.analysisStatus === 'failed' ? ' · 분석 실패' : ''}
                          {s.analysisStatus === 'pending' ? ' · 분석 중…' : ''}
                        </Text>
                      </View>
                      {s.overallScore != null ? (
                        <View className="h-11 w-11 items-center justify-center rounded-full bg-ink-700">
                          <Text className="text-sm font-bold text-white">{s.overallScore}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                ))}
                <Text className="mt-1 text-center text-[11px] text-muted">
                  길게 누르면 삭제할 수 있어요
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Actions ---------------------------------------------------- */}
      <View className="border-t border-ink-800 px-5 pb-2 pt-4">
        <Button
          label={`Call ${AI_NAME}`}
          size="lg"
          onPress={() => router.push('/call')}
          disabled={!configured}
        />
        <View className="mt-3 flex-row gap-3">
          <Pressable
            onPress={() => router.push('/context')}
            className="h-12 flex-1 items-center justify-center rounded-2xl bg-ink-800 active:bg-ink-700"
          >
            <Text className="font-medium text-white">Add Context</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/english')}
            className="h-12 flex-1 items-center justify-center rounded-2xl bg-ink-800 active:bg-ink-700"
          >
            <Text className="font-medium text-white">My English</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
