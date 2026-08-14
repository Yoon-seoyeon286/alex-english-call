/** Server events we actually care about, plus the client events we send. */

export interface RealtimeServerEvent {
  type: string;
  event_id?: string;
  [key: string]: unknown;
}

export interface TranscriptDelta {
  itemId: string;
  delta: string;
}

export interface TranscriptDone {
  itemId: string;
  text: string;
}

/** Sent to stop generation the moment the user starts talking over Alex. */
export const CANCEL_RESPONSE = { type: 'response.cancel' } as const;

/**
 * WebRTC-specific: drops audio that has already been pushed to the client's
 * playback buffer. Without this, Alex keeps talking for a beat after barge-in.
 */
export const CLEAR_OUTPUT_AUDIO = { type: 'output_audio_buffer.clear' } as const;

export function isSpeechStarted(type: string): boolean {
  return type === 'input_audio_buffer.speech_started';
}

export function isSpeechStopped(type: string): boolean {
  return type === 'input_audio_buffer.speech_stopped';
}
