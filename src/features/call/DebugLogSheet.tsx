import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { clearLogs, getLogEntries, subscribeToLogs, type LogEntry } from '@/utils/logger';

const COLOR: Record<LogEntry['level'], string> = {
  debug: '#8A90A3',
  info: '#B9C0D4',
  warn: '#E8B23A',
  error: '#FF5A5F',
};

/**
 * On-device log viewer. When something goes wrong on a phone that isn't
 * plugged into a laptop, this is the difference between "it didn't work" and
 * an actual diagnosis.
 */
export function DebugLogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>(getLogEntries());

  useEffect(() => {
    if (!visible) return undefined;
    setEntries(getLogEntries());
    return subscribeToLogs(setEntries);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-950 pt-14">
        <View className="flex-row items-center justify-between px-5 pb-3">
          <Text className="text-lg font-semibold text-white">Debug log</Text>
          <View className="flex-row gap-3">
            <Pressable onPress={clearLogs} hitSlop={8}>
              <Text className="text-sm text-muted">Clear</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-sm text-accent-soft">Close</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
          {entries.length === 0 ? (
            <Text className="text-sm text-muted">Nothing logged yet.</Text>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} className="mb-1.5">
                <Text style={{ color: COLOR[entry.level], fontSize: 11, fontFamily: 'monospace' }}>
                  {new Date(entry.at).toLocaleTimeString()} [{entry.scope}] {entry.message}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
