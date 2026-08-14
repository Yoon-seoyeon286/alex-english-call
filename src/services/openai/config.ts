/**
 * Single source of truth for anything model-related on the client.
 * Everything is overridable through EXPO_PUBLIC_* env vars at build time, so a
 * model rename never means touching more than one place.
 *
 * IMPORTANT: every EXPO_PUBLIC_* read below must stay a literal
 * `process.env.EXPO_PUBLIC_X` member expression. Expo inlines those at build
 * time by static text replacement — aliasing `process.env` to a variable
 * silently produces `undefined` on device.
 */

function clean(value: string | undefined): string {
  // Not fatal at import time — Home and Call surface an unconfigured backend
  // as a friendly message instead of crashing the app on launch.
  if (!value || value.includes('REPLACE-ME')) return '';
  return value.trim().replace(/\/+$/, '');
}

export const AI_NAME = process.env.EXPO_PUBLIC_AI_NAME || 'Alex';

export const API_BASE_URL = clean(process.env.EXPO_PUBLIC_API_BASE_URL);

export const APP_TOKEN = clean(process.env.EXPO_PUBLIC_APP_TOKEN);

export const REALTIME_MODEL = process.env.EXPO_PUBLIC_REALTIME_MODEL || 'gpt-realtime-2.1';

export const REALTIME_VOICE = process.env.EXPO_PUBLIC_REALTIME_VOICE || 'cedar';

/** Where the phone POSTs its SDP offer once it holds an ephemeral secret. */
export const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

export const MAX_MEMORIES_IN_PROMPT = 12;

/** Realtime sessions are capped at 60 minutes server-side. */
export const MAX_CALL_SECONDS = 55 * 60;

export function isBackendConfigured(): boolean {
  return API_BASE_URL.length > 0 && APP_TOKEN.length > 0;
}
