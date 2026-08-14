import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

import { initDatabase } from '@/services/database/db';
import { runMemoryAging } from '@/services/memory/aging';
import { flushPendingNotes } from '@/services/analysis/postCall';
import { getLearningProfile } from '@/services/database/repositories/learningProfile';
import { createLogger } from '@/utils/logger';

const log = createLogger('boot');

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initDatabase();
        await getLearningProfile();
        if (cancelled) return;
        setReady(true);

        // Housekeeping runs after the UI is usable — it must never block launch.
        runMemoryAging().catch((err) => log.warn('aging failed', err));
        flushPendingNotes().catch(() => undefined);
      } catch (err) {
        log.error('startup failed', err);
        if (!cancelled) setFatal((err as Error)?.message ?? 'Unknown startup error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (fatal) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-8">
        <StatusBar style="light" />
        <Text className="mb-2 text-lg font-semibold text-white">Couldn&apos;t start</Text>
        <Text className="text-center text-sm text-muted">{fatal}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <StatusBar style="light" />
        <ActivityIndicator color="#5B8CFF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#08090C' },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="call" options={{ gestureEnabled: false }} />
          <Stack.Screen name="context" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="english" />
          <Stack.Screen name="review/[sessionId]" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
