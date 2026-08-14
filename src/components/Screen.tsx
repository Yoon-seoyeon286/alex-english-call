import { type ReactNode } from 'react';
import { View, ScrollView, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  children: ReactNode;
  scroll?: boolean;
  /** Screens that own the whole surface (the call screen) skip safe padding. */
  edges?: boolean;
  contentClassName?: string;
}

export function Screen({
  children,
  scroll = false,
  edges = true,
  contentClassName = '',
  ...rest
}: ScreenProps) {
  const Body = (
    <View className={`flex-1 px-5 ${contentClassName}`} {...rest}>
      {children}
    </View>
  );

  const inner = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {Body}
    </ScrollView>
  ) : (
    Body
  );

  if (!edges) {
    return <View className="flex-1 bg-ink-950">{inner}</View>;
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      {inner}
    </SafeAreaView>
  );
}
