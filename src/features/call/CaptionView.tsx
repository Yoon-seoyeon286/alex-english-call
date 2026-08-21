import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { CallStatus, LiveTurn } from '@/types';

interface CaptionProps {
  turns: LiveTurn[];
  status: CallStatus;
  aiName: string;
}

/**
 * Live subtitles for Alex's side of the call.
 *
 * The point is comprehension, not a transcript: when you miss a word you look
 * down and read it. So the caption keeps showing the last thing Alex said even
 * after he stops talking, and only clears when he starts a new turn.
 */
export function CaptionView({ turns, status, aiName }: CaptionProps) {
  const scroller = useRef<ScrollView>(null);
  const [userSpoke, setUserSpoke] = useState(false);

  let lastAi: LiveTurn | undefined;
  let lastAiIndex = -1;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const t = turns[i];
    if (t && t.speaker === 'AI') {
      lastAi = t;
      lastAiIndex = i;
      break;
    }
  }

  // Once you've replied, Alex's previous line has served its purpose — dim it
  // so the screen doesn't look stuck on an old sentence.
  useEffect(() => {
    if (lastAiIndex < 0) {
      setUserSpoke(false);
      return;
    }
    const somebodyRepliedAfter = turns
      .slice(lastAiIndex + 1)
      .some((t) => t.speaker === 'USER' && t.text.trim().length > 0);
    setUserSpoke(somebodyRepliedAfter);
  }, [turns, lastAiIndex]);

  useEffect(() => {
    if (lastAi?.text) scroller.current?.scrollToEnd({ animated: true });
  }, [lastAi?.text]);

  const speaking = status === 'SPEAKING';
  const text = lastAi?.text?.trim() ?? '';

  if (!text) {
    return (
      <View className="h-28 justify-center px-1">
        <Text className="text-center text-sm text-muted">
          {status === 'CONNECTING'
            ? ''
            : `${aiName} will show up here as he speaks — read along if you miss a word.`}
        </Text>
      </View>
    );
  }

  return (
    <View className="h-28 justify-center">
      <View
        className="rounded-2xl bg-ink-900/90 px-4 py-3"
        style={{ opacity: userSpoke && !speaking ? 0.55 : 1 }}
      >
        <ScrollView
          ref={scroller}
          showsVerticalScrollIndicator={false}
          className="max-h-24"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        >
          <Text className="text-center text-[19px] font-medium leading-7 text-white">
            {text}
            {speaking && lastAi?.partial ? <Text className="text-accent-soft"> ▌</Text> : null}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}
