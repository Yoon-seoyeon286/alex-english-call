import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-accent active:bg-accent-dim',
  secondary: 'bg-ink-700 active:bg-ink-600',
  danger: 'bg-danger active:opacity-80',
  ghost: 'bg-transparent border border-ink-600 active:bg-ink-800',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  danger: 'text-white',
  ghost: 'text-white',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  size = 'md',
  className = '',
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      className={`flex-row items-center justify-center rounded-2xl ${
        size === 'lg' ? 'h-16' : 'h-13 py-3.5'
      } px-5 ${CONTAINER[variant]} ${isDisabled ? 'opacity-40' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View className="flex-row items-center">
          {icon ? <View className="mr-2">{icon}</View> : null}
          <Text
            className={`${LABEL[variant]} font-semibold ${size === 'lg' ? 'text-lg' : 'text-base'}`}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
