import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { Card, Empty, SectionLabel } from '@/components/Card';
import { StatTile, TrendRow } from '@/features/profile/StatTile';
import { getSpeakingStats, type SpeakingStats } from '@/services/database/repositories/sessions';
import {
  getMistakeCounts,
  getScoreTrend,
  type MistakeCount,
  type TrendPoint,
} from '@/services/database/repositories/analysis';
import { listExpressions } from '@/services/database/repositories/expressions';
import { getLearningProfile } from '@/services/database/repositories/learningProfile';
import { formatDuration, formatMinutes } from '@/utils/date';
import type { Expression, LearningProfile } from '@/types';

const CATEGORY_LABEL: Record<string, string> = {
  grammar: '문법',
  tense: '시제',
  article: '관사',
  preposition: '전치사',
  word_choice: '단어 선택',
  word_order: '어순',
  plural: '복수형',
  subject_verb_agreement: '수 일치',
  naturalness: '자연스러움',
  other: '기타',
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: '입문',
  lower_intermediate: '초중급',
  intermediate: '중급',
  upper_intermediate: '중상급',
  advanced: '상급',
};

export default function MyEnglishScreen() {
  const [stats, setStats] = useState<SpeakingStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [mistakes, setMistakes] = useState<MistakeCount[]>([]);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [profile, setProfile] = useState<LearningProfile | null>(null);

  const load = useCallback(async () => {
    const [s, t, m, e, p] = await Promise.all([
      getSpeakingStats(),
      getScoreTrend(12),
      getMistakeCounts(),
      listExpressions(20),
      getLearningProfile(),
    ]);
    setStats(s);
    setTrend(t);
    setMistakes(m);
    setExpressions(e);
    setProfile(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const hasData = (stats?.totalSessions ?? 0) > 0;

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 pt-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">내 영어</Text>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text className="text-sm text-accent-soft">완료</Text>
            </Pressable>
          </View>

          {profile ? (
            <Text className="mt-1 text-sm text-muted">
              현재 레벨: {LEVEL_LABEL[profile.currentLevel] ?? profile.currentLevel}
            </Text>
          ) : null}

          {!hasData ? (
            <View className="mt-8">
              <Empty text="아직 통화 기록이 없어요. 첫 통화가 끝나면 여기에 기록이 쌓입니다." />
            </View>
          ) : null}

          {/* Speaking stats ------------------------------------------ */}
          {stats && hasData ? (
            <View className="mt-7">
              <SectionLabel>말하기 기록</SectionLabel>
              <View className="gap-2.5">
                <View className="flex-row gap-2.5">
                  <StatTile label="총 통화 시간" value={formatMinutes(stats.totalSeconds)} />
                  <StatTile label="이번 주" value={formatMinutes(stats.weekSeconds)} />
                </View>
                <View className="flex-row gap-2.5">
                  <StatTile label="총 통화 수" value={`${stats.totalSessions}`} />
                  <StatTile label="내가 말한 단어 수" value={`${stats.totalWords}`} />
                </View>
                <View className="flex-row gap-2.5">
                  <StatTile
                    label="평균 통화 시간"
                    value={formatDuration(stats.averageSeconds)}
                  />
                  <StatTile
                    label="저장한 표현"
                    value={`${expressions.length}`}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {/* Trends --------------------------------------------------- */}
          {trend.length > 0 ? (
            <View className="mt-8">
              <SectionLabel>점수 추이</SectionLabel>
              <Card>
                <TrendRow label="문법" values={trend.map((t) => t.grammar)} color="#5B8CFF" />
                <TrendRow label="유창성" values={trend.map((t) => t.fluency)} color="#3FD08A" />
                <TrendRow
                  label="어휘"
                  values={trend.map((t) => t.vocabulary)}
                  color="#E8B23A"
                />
                <TrendRow
                  label="자연스러움"
                  values={trend.map((t) => t.naturalness)}
                  color="#B98CFF"
                />
              </Card>
            </View>
          ) : null}

          {/* Repeat mistakes ------------------------------------------ */}
          {mistakes.length > 0 ? (
            <View className="mt-8">
              <SectionLabel>자주 틀리는 부분</SectionLabel>
              <Card>
                {mistakes.map((m, i) => (
                  <View
                    key={m.category}
                    className="flex-row items-center justify-between py-2.5"
                    style={
                      i < mistakes.length - 1
                        ? { borderBottomWidth: 1, borderBottomColor: '#212533' }
                        : undefined
                    }
                  >
                    <Text className="text-[15px] text-white">
                      {CATEGORY_LABEL[m.category] ?? m.category}
                    </Text>
                    <Text className="text-sm font-semibold text-muted">{m.count}</Text>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {/* Expressions ---------------------------------------------- */}
          {expressions.length > 0 ? (
            <View className="mt-8">
              <SectionLabel>저장한 표현</SectionLabel>
              <View className="gap-2">
                {expressions.map((e) => (
                  <Card key={e.id}>
                    <Text className="text-[15px] font-medium text-white">{e.expression}</Text>
                    {e.meaning ? (
                      <Text className="mt-1 text-[13px] leading-5 text-muted">{e.meaning}</Text>
                    ) : null}
                    {e.example && e.example !== e.expression ? (
                      <Text className="mt-1.5 text-[13px] italic leading-5 text-accent-soft">
                        “{e.example}”
                      </Text>
                    ) : null}
                  </Card>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
