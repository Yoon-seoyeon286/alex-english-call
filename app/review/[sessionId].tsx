import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { BigScore, ScoreBar } from '@/components/ScoreBar';
import { Card, SectionLabel } from '@/components/Card';
import { CorrectionCard } from '@/features/review/CorrectionCard';
import { getSession, getTranscript } from '@/services/database/repositories/sessions';
import { getCorrections, getScores } from '@/services/database/repositories/analysis';
import { retryAnalysis } from '@/services/analysis/postCall';
import { AI_NAME } from '@/services/openai/config';
import { formatDuration } from '@/utils/date';
import { friendlyMessage } from '@/utils/errors';
import type { Correction, Session, SessionScores, Utterance } from '@/types';

export default function ReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<Session | null>(null);
  const [scores, setScores] = useState<SessionScores | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [transcript, setTranscript] = useState<Utterance[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [s, sc, c, t] = await Promise.all([
      getSession(sessionId),
      getScores(sessionId),
      getCorrections(sessionId),
      getTranscript(sessionId),
    ]);
    setSession(s);
    setScores(sc);
    setCorrections(c);
    setTranscript(t);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // The pipeline runs in the background right after End Call, so poll
      // until it settles instead of leaving the user on a dead screen.
      const timer = setInterval(() => void load(), 2500);
      return () => clearInterval(timer);
    }, [load]),
  );

  const onRetry = useCallback(async () => {
    if (!sessionId) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await retryAnalysis(sessionId);
      await load();
    } catch (err) {
      setRetryError(friendlyMessage(err));
    } finally {
      setRetrying(false);
    }
  }, [sessionId, load]);

  const goHome = useCallback(() => router.replace('/'), []);

  if (!session) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink-950">
        <ActivityIndicator color="#5B8CFF" />
      </SafeAreaView>
    );
  }

  const pending = session.analysisStatus === 'pending';
  const failed = session.analysisStatus === 'failed';

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-5 pt-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-white">Call review</Text>
              <Text className="mt-0.5 text-sm text-muted">
                {formatDuration(session.duration)} with {AI_NAME}
              </Text>
            </View>
            <Pressable onPress={goHome} hitSlop={10}>
              <Text className="text-sm text-accent-soft">Done</Text>
            </Pressable>
          </View>

          {/* Analysis state ----------------------------------------- */}
          {pending ? (
            <Card className="mt-6">
              <View className="flex-row items-center">
                <ActivityIndicator color="#5B8CFF" />
                <Text className="ml-3 flex-1 text-sm leading-5 text-muted">
                  Your transcript is saved. {AI_NAME} is going over the call…
                </Text>
              </View>
            </Card>
          ) : null}

          {failed ? (
            <View className="mt-6 rounded-2xl border border-danger/40 bg-danger/10 p-4">
              <Text className="mb-1 text-sm font-semibold text-white">Review unavailable</Text>
              <Text className="text-xs leading-5 text-muted">
                Your transcript is safe — only the analysis failed.
                {session.analysisError ? `\n\n${session.analysisError}` : ''}
              </Text>
              <View className="mt-3">
                <Button
                  label={retrying ? 'Retrying…' : 'Try again'}
                  loading={retrying}
                  variant="secondary"
                  onPress={onRetry}
                />
              </View>
              {retryError ? (
                <Text className="mt-2 text-xs text-white">{retryError}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Scores -------------------------------------------------- */}
          {scores ? (
            <View className="mt-6">
              <Card>
                <BigScore score={session.overallScore ?? 0} />
                <View className="mt-4">
                  <ScoreBar label="Grammar" score={scores.grammar} />
                  <ScoreBar label="Fluency" score={scores.fluency} />
                  <ScoreBar label="Vocabulary" score={scores.vocabulary} />
                  <ScoreBar label="Naturalness" score={scores.naturalness} />
                  <ScoreBar label="Communication" score={scores.communication} />
                </View>
              </Card>
            </View>
          ) : null}

          {session.summary ? (
            <View className="mt-4">
              <Card>
                <Text className="text-[15px] leading-6 text-white">{session.summary}</Text>
              </Card>
            </View>
          ) : null}

          {/* Corrections --------------------------------------------- */}
          {corrections.length > 0 ? (
            <View className="mt-8">
              <SectionLabel>Worth fixing</SectionLabel>
              <View className="gap-3">
                {corrections.map((c) => (
                  <CorrectionCard key={c.id} correction={c} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Transcript ---------------------------------------------- */}
          <View className="mt-8">
            <Pressable onPress={() => setShowTranscript((v) => !v)} hitSlop={6}>
              <Text className="text-sm text-accent-soft">
                {showTranscript ? 'Hide transcript' : `Show transcript (${transcript.length})`}
              </Text>
            </Pressable>

            {showTranscript ? (
              <View className="mt-3 rounded-2xl bg-ink-900 p-4">
                {transcript.map((u) => (
                  <View key={u.id} className="mb-3">
                    <Text
                      className={`mb-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                        u.speaker === 'AI' ? 'text-accent-soft' : 'text-muted'
                      }`}
                    >
                      {u.speaker === 'AI' ? AI_NAME : 'You'}
                    </Text>
                    <Text className="text-[15px] leading-5 text-white">{u.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View className="mt-8">
            <Button label="Back home" variant="secondary" onPress={goHome} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
