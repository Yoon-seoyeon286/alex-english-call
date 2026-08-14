import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

interface HintSheetProps {
  visible: boolean;
  loading: boolean;
  hints: string[];
  error: string | null;
  onClose: () => void;
}

/**
 * A modal on top of the call — the WebRTC connection is untouched, so Alex
 * keeps listening while this is open.
 */
export function HintSheet({ visible, loading, hints, error, onClose }: HintSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-ink-800 px-5 pb-10 pt-5"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-ink-600" />
          <Text className="mb-4 text-lg font-semibold text-white">You could say…</Text>

          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#5B8CFF" />
            </View>
          ) : error ? (
            <Text className="py-4 text-sm leading-5 text-muted">{error}</Text>
          ) : hints.length === 0 ? (
            <Text className="py-4 text-sm text-muted">No suggestions right now.</Text>
          ) : (
            <View className="gap-2.5">
              {hints.map((hint) => (
                <View key={hint} className="rounded-2xl bg-ink-700 px-4 py-3.5">
                  <Text className="text-[15px] leading-5 text-white">{hint}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={onClose}
            className="mt-5 h-12 items-center justify-center rounded-2xl bg-ink-700 active:bg-ink-600"
          >
            <Text className="font-medium text-white">Back to the call</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
