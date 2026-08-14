import { Platform } from 'react-native';
import { createLogger } from '@/utils/logger';

const log = createLogger('audio-route');

type InCallManagerModule = {
  start: (opts: { media?: string; auto?: boolean; ringback?: string }) => void;
  stop: (opts?: { busytone?: string }) => void;
  setForceSpeakerphoneOn: (flag: boolean) => void;
  setKeepScreenOn: (flag: boolean) => void;
};

let manager: InCallManagerModule | null | undefined;

/**
 * react-native-incall-manager is a legacy-arch module. On the New Architecture
 * it still works through the interop layer, but if that ever breaks we would
 * rather lose speakerphone routing than crash the call, so it is loaded
 * defensively and every call is guarded.
 */
function getManager(): InCallManagerModule | null {
  if (manager !== undefined) return manager;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-incall-manager');
    manager = (mod?.default ?? mod) as InCallManagerModule;
  } catch (err) {
    log.warn('InCallManager unavailable, falling back to default routing', err);
    manager = null;
  }
  return manager;
}

/**
 * Puts Android into voice-communication mode (which enables the platform AEC
 * and noise suppression) and routes playback to the loudspeaker, since the
 * phone is normally sitting on a desk during practice.
 */
export function startCallAudio(): void {
  if (Platform.OS === 'web') return;
  const m = getManager();
  if (!m) return;
  try {
    m.start({ media: 'audio', auto: false });
    m.setForceSpeakerphoneOn(true);
    m.setKeepScreenOn(true);
    log.info('audio session started (speakerphone)');
  } catch (err) {
    log.warn('failed to start audio session', err);
  }
}

export function stopCallAudio(): void {
  if (Platform.OS === 'web') return;
  const m = getManager();
  if (!m) return;
  try {
    m.setForceSpeakerphoneOn(false);
    m.setKeepScreenOn(false);
    m.stop();
    log.info('audio session stopped');
  } catch (err) {
    log.warn('failed to stop audio session', err);
  }
}

export function setSpeakerphone(enabled: boolean): void {
  const m = getManager();
  if (!m) return;
  try {
    m.setForceSpeakerphoneOn(enabled);
  } catch (err) {
    log.warn('failed to toggle speakerphone', err);
  }
}
