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

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  lower_intermediate: 'Lower intermediate',
  intermediate: 'Intermediate',
  upper_intermediate: 'Upper intermediate',
  advanced: 'Advanced',
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
            <Text className="text-2xl font-bold text-white">My English</Text>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text className="text-sm text-accent-soft">Done</Text>
            </Pressable>
          </View>

          {profile ? (
            <Text className="mt-1 text-sm text-muted">
              Current level: {LEVEL_LABEL[profile.currentLevel] ?? profile.currentLevel}
            </Text>
          ) : null}

          {!hasData ? (
            <View className="mt-8">
              <Empty text="No calls yet. Your speaking stats show up here after your first conversation." />
            </View>
          ) : null}

          {/* Speaking stats ------------------------------------------ */}
          {stats && hasData ? (
            <View className="mt-7">
              <SectionLabel>Speaking</SectionLabel>
              <View className="gap-2.5">
                <View className="flex-row gap-2.5">
                  <StatTile label="Total speaking time" value={formatMinutes(stats.totalSeconds)} />
                  <StatTile label="This week" value={formatMinutes(stats.weekSeconds)} />
                </View>
                <View className="flex-row gap-2.5">
                  <StatTile label="Total calls" value={`${stats.totalSessions}`} />
                  <StatTile label="Words spoken" value={`${stats.totalWords}`} />
                </View>
                <View className="flex-row gap-2.5">
                  <StatTile
                    label="Average call length"
                    value={formatDuration(stats.averageSeconds)}
                  />
                  <StatTile
                    label="Saved expressions"
                    value={`${expressions.length}`}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {/* Trends --------------------------------------------------- */}
          {trend.length > 0 ? (
            <View className="mt-8">
              <SectionLabel>Trends</SectionLabel>
              <Card>
                <TrendRow label="Grammar" values={trend.map((t) => t.grammar)} color="#5B8CFF" />
                <TrendRow label="Fluency" values={trend.map((t) => t.fluency)} color="#3FD08A" />
                <TrendRow
                  label="Vocabulary"
                  values={trend.map((t) => t.vocabulary)}
                  color="#E8B23A"
                />
                <TrendRow
                  label="Naturalness"
                  values={trend.map((t) => t.naturalness)}
                  color="#B98CFF"
                />
              </Card>
            </View>
          ) : null}

          {/* Repeat mistakes ------------------------------------------ */}
          {mistakes.length > 0 ? (
            <View className="mt-8">
              <SectionLabel>What trips you up</SectionLabel>
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
              <SectionLabel>Expressions to keep</SectionLabel>
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
