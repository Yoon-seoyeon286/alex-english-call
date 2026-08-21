export type AppErrorCode =
  | 'mic_permission_denied'
  | 'offline'
  | 'token_failed'
  | 'token_expired'
  | 'realtime_connect_failed'
  | 'realtime_dropped'
  | 'audio_playback_failed'
  | 'analysis_failed'
  | 'extraction_failed'
  | 'hint_failed'
  | 'translation_failed'
  | 'database_failed'
  | 'unknown';

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const FRIENDLY: Record<AppErrorCode, string> = {
  mic_permission_denied:
    'Alex needs microphone access to hear you. Enable it in Settings → Apps → Alex → Permissions.',
  offline: 'No internet connection. Check your Wi-Fi or mobile data and try again.',
  token_failed:
    "Couldn't reach the Alex server to start the call. Check that the backend is deployed and the app token matches.",
  token_expired: 'The call session expired. Tap Start Call again.',
  realtime_connect_failed:
    "Couldn't connect to Alex. This is usually a network issue — try again in a moment.",
  realtime_dropped: 'The call dropped. Your transcript up to this point was saved.',
  audio_playback_failed: "Audio couldn't play. Try turning the volume up or restarting the call.",
  analysis_failed:
    "Your transcript is saved, but the review couldn't be generated. You can retry it any time.",
  extraction_failed: "Saved, but Alex couldn't structure it yet. It will be retried next time.",
  hint_failed: "Couldn't fetch a hint right now — the call is still connected.",
  translation_failed: "Couldn't translate right now — the call is still connected.",
  database_failed: 'Local storage failed. Restarting the app usually fixes it.',
  unknown: 'Something went wrong.',
};

export function toAppError(err: unknown, fallback: AppErrorCode = 'unknown'): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : String(err);

  if (/network request failed|fetch failed|Unable to resolve host/i.test(message)) {
    return new AppError('offline', message, err);
  }
  return new AppError(fallback, message, err);
}

export function friendlyMessage(err: unknown): string {
  const appErr = err instanceof AppError ? err : toAppError(err);
  return FRIENDLY[appErr.code] ?? FRIENDLY.unknown;
}
