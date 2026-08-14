import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { CallControls } from '@/features/call/CallControls';
import { CaptionView } from '@/features/call/CaptionView';
import { HintSheet } from '@/features/call/HintSheet';
import { TranscriptPanel } from '@/features/call/TranscriptPanel';
import { DebugLogSheet } from '@/features/call/DebugLogSheet';
import { VoiceOrb } from '@/features/call/VoiceOrb';
import { Button } from '@/components/Button';
import { useCallStore } from '@/stores/callStore';
import { runPostCallPipeline } from '@/services/analysis/postCall';
import { AI_NAME } from '@/services/openai/config';
import { formatDuration } from '@/utils/date';
import { createLogger } from '@/utils/logger';

const log = createLogger('call-screen');

export default function CallScreen() {
  const status = useCallStore((s) => s.status);
  const turns = useCallStore((s) => s.turns);
  const elapsed = useCallStore((s) => s.elapsedSeconds);
  const muted = useCallStore((s) => s.muted);
  const level = useCallStore((s) => s.level);
  const errorMessage = useCallStore((s) => s.errorMessage);
  const errorCode = useCallStore((s) => s.errorCode);
  const hints = useCallStore((s) => s.hints);
  const hintLoading = useCallStore((s) => s.hintLoading);
  const hintError = useCallStore((s) => s.hintError);

  const startCall = useCallStore((s) => s.startCall);
  const endCall = useCallStore((s) => s.endCall);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const requestHint = useCallStore((s) => s.requestHint);
  const clearHints = useCallStore((s) => s.clearHints);
  const reset = useCallStore((s) => s.reset);

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  const started = useRef(false);

  // Start as soon as the screen mounts — tapping "Call Alex" should feel like
  // dialling, not like opening a form.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startCall();
  }, [startCall]);

  const finish = useCallback(async () => {
    if (ending) return;
    setEnding(true);

    const sessionId = await endCall();

    if (!sessionId) {
      reset();
      router.replace('/');
      return;
    }

    // Transcript is already on disk; the review screen shows a spinner while
    // this finishes in the background.
    runPostCallPipeline(sessionId).catch((err) => log.warn('post-call pipeline failed', err));

    reset();
    router.replace(`/review/${sessionId}`);
  }, [endCall, ending, reset]);

  // Hardware back should not silently drop a live call.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (status === 'ENDED' || status === 'ERROR' || status === 'IDLE') return false;
      Alert.alert('End the call?', `You're still on a call with ${AI_NAME}.`, [
        { text: 'Stay', style: 'cancel' },
        { text: 'End call', style: 'destructive', onPress: () => void finish() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [status, finish]);

  const onHint = useCallback(() => {
    setHintOpen(true);
    clearHints();
    void requestHint();
  }, [clearHints, requestHint]);

  const controlsDisabled =
    status === 'CONNECTING' || status === 'ERROR' || status === 'ENDED' || status === 'IDLE';

  const failed = status === 'ERROR';

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      <View className="flex-1 px-5">
        {/* Header ------------------------------------------------------ */}
        <View className="items-center pt-3">
          <Text className="text-2xl font-semibold text-white">{AI_NAME}</Text>
          <Text className="mt-1 text-sm text-muted">
            {status === 'CONNECTING' ? 'Calling…' : formatDuration(elapsed)}
          </Text>
        </View>

        {/* Body -------------------------------------------------------- */}
        {transcriptOpen ? (
          <View className="mt-6 flex-1">
            <TranscriptPanel turns={turns} />
          </View>
        ) : (
          <View className="flex-1 justify-center">
            <View className="flex-1 items-center justify-center">
              <VoiceOrb status={status} level={level} />
            </View>
            <CaptionView turns={turns} status={status} aiName={AI_NAME} />
          </View>
        )}

        {/* Errors ------------------------------------------------------ */}
        {errorMessage ? (
          <View className="mb-4 rounded-2xl border border-danger/40 bg-danger/10 p-4">
            <Text className="text-sm leading-5 text-white">{errorMessage}</Text>
            {errorCode ? (
              <Pressable onPress={() => setDebugOpen(true)} hitSlop={6}>
                <Text className="mt-2 text-xs text-accent-soft">View debug log</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Footer ------------------------------------------------------ */}
        <View className="pb-2">
          {failed ? (
            <View className="gap-3">
              <Button
                label="Try again"
                onPress={() => {
                  started.current = true;
                  void startCall();
                }}
              />
              <Button
                label="Back"
                variant="ghost"
                onPress={() => {
                  reset();
                  router.replace('/');
                }}
              />
            </View>
          ) : (
            <CallControls
              muted={muted}
              disabled={controlsDisabled}
              transcriptOpen={transcriptOpen}
              onToggleMute={toggleMute}
              onToggleTranscript={() => setTranscriptOpen((v) => !v)}
              onHint={onHint}
              onEndCall={() => void finish()}
            />
          )}
        </View>
      </View>

      <HintSheet
        visible={hintOpen}
        loading={hintLoading}
        hints={hints}
        error={hintError}
        onClose={() => setHintOpen(false)}
      />
      <DebugLogSheet visible={debugOpen} onClose={() => setDebugOpen(false)} />
    </SafeAreaView>
  );
}
