import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AI_NAME } from '@/services/openai/config';
import type { CallStatus } from '@/types';

interface VoiceOrbProps {
  status: CallStatus;
  /** 0-1 live audio level from RTP stats. */
  level: number;
}

const STATUS_TEXT: Record<CallStatus, string> = {
  IDLE: '',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  RECONNECTING: 'RECONNECTING',
  ENDED: 'CALL ENDED',
  ERROR: 'DISCONNECTED',
};

const STATUS_COLOR: Record<CallStatus, string> = {
  IDLE: '#8A90A3',
  CONNECTING: '#8A90A3',
  LISTENING: '#3FD08A',
  THINKING: '#E8B23A',
  SPEAKING: '#5B8CFF',
  RECONNECTING: '#E8B23A',
  ENDED: '#8A90A3',
  ERROR: '#FF5A5F',
};

/**
 * Deliberately cheap: one shared value driven by real audio level, plus a slow
 * idle pulse. No per-frame JS work, so it can't compete with audio for CPU.
 */
export function VoiceOrb({ status, level }: VoiceOrbProps) {
  const scale = useSharedValue(1);
  const idle = useSharedValue(0);

  useEffect(() => {
    const target = status === 'SPEAKING' || status === 'LISTENING' ? 1 + level * 0.22 : 1;
    scale.value = withTiming(target, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [level, status, scale]);

  useEffect(() => {
    if (status === 'CONNECTING' || status === 'THINKING' || status === 'RECONNECTING') {
      idle.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    } else {
      cancelAnimation(idle);
      idle.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(idle);
  }, [status, idle]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.85 + idle.value * 0.15,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + level * 0.5 + idle.value * 0.08 }],
    opacity: 0.12 + level * 0.25,
  }));

  const color = STATUS_COLOR[status];

  return (
    <View className="items-center">
      <View className="h-56 w-56 items-center justify-center">
        <Animated.View
          style={[
            {
              position: 'absolute',
              height: 224,
              width: 224,
              borderRadius: 112,
              backgroundColor: color,
            },
            ringStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              height: 148,
              width: 148,
              borderRadius: 74,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#161922',
              borderWidth: 2,
              borderColor: color,
            },
            orbStyle,
          ]}
        >
          <Text className="text-5xl font-bold text-white">{AI_NAME.charAt(0)}</Text>
        </Animated.View>
      </View>

      <Text
        className="mt-6 text-xs font-semibold tracking-[3px]"
        style={{ color }}
      >
        {STATUS_TEXT[status]}
      </Text>
    </View>
  );
}
