import { PermissionsAndroid, Platform } from 'react-native';
import { createLogger } from '@/utils/logger';

const log = createLogger('permissions');

export type MicPermission = 'granted' | 'denied' | 'blocked';

export async function checkMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  } catch (err) {
    log.warn('permission check failed', err);
    return false;
  }
}

export async function requestMicrophonePermission(): Promise<MicPermission> {
  if (Platform.OS !== 'android') return 'granted';

  try {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Microphone access',
      message: 'Alex needs your microphone so you can talk with him in English.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });

    if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  } catch (err) {
    log.warn('permission request failed', err);
    return 'denied';
  }
}
