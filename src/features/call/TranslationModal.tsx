import { Modal, Pressable, Text, View } from 'react-native';

interface TranslationModalProps {
  visible: boolean;
  originalText: string;
  translatedText: string;
  translating: boolean;
  error: string | null;
  onClose: () => void;
}

export function TranslationModal({
  visible,
  originalText,
  translatedText,
  translating,
  error,
  onClose,
}: TranslationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/70 px-6"
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-sm rounded-3xl bg-ink-800 p-6"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="mb-4 text-center text-lg font-semibold text-white">
            번역
          </Text>

          <View className="mb-5 rounded-2xl bg-ink-900/80 px-4 py-4">
            <Text className="mb-2 text-sm text-muted">Alex</Text>
            <Text className="text-[17px] font-medium leading-6 text-white">
              {originalText || '...'}
            </Text>
          </View>

          <View className="rounded-2xl bg-ink-700 px-4 py-4">
            {translating ? (
              <Text className="text-[17px] leading-6 text-accent-soft">번역 중…</Text>
            ) : error ? (
              <Text className="text-[17px] leading-6 text-danger">{error}</Text>
            ) : (
              <Text className="text-[17px] leading-6 text-white">
                {translatedText || '해석을 준비 중이에요.'}
              </Text>
            )}
          </View>

          <Pressable
            onPress={onClose}
            className="mt-6 rounded-full bg-white py-3"
          >
            <Text className="text-center text-base font-semibold text-ink-900">닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
