import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
}

export function Card({ children, onPress, className = '' }: CardProps) {
  const base = `rounded-2xl bg-ink-800 p-4 ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${base} active:bg-ink-700`}>
        {children}
      </Pressable>
    );
  }
  return <View className={base}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
      {children}
    </Text>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View className="rounded-2xl border border-dashed border-ink-700 p-5">
      <Text className="text-center text-sm leading-5 text-muted">{text}</Text>
    </View>
  );
}
