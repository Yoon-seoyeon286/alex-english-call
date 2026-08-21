import { API_BASE_URL, APP_TOKEN, isBackendConfigured } from './config';
import { AppError, toAppError } from '@/utils/errors';
import { createLogger } from '@/utils/logger';
import type { EnglishLevel, ExtractedMemory, Speaker, TeacherReport } from '@/types';

const log = createLogger('api');

export interface WireTurn {
  speaker: Speaker;
  text: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isBackendConfigured()) {
    throw new AppError(
      'token_failed',
      'Backend URL or app token is not configured in this build (EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_APP_TOKEN).',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45000);

  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-token': APP_TOKEN,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      let code = 'http_error';
      let message = text;
      try {
        const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
        code = parsed.error?.code ?? code;
        message = parsed.error?.message ?? message;
      } catch {
        /* keep raw text */
      }
      log.warn(`${path} -> ${res.status} ${code}: ${message}`);
      throw new AppError(
        code === 'ephemeral_token_failed' || res.status === 401 ? 'token_failed' : 'unknown',
        `${code}: ${message}`,
      );
    }

    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new AppError('offline', `Request to ${path} timed out.`);
    }
    throw toAppError(err);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export interface EphemeralSession {
  value: string;
  expiresAt: number;
  model: string;
  voice: string;
}

export async function fetchEphemeralSession(
  instructions: string,
  signal?: AbortSignal,
): Promise<EphemeralSession> {
  try {
    return await request<EphemeralSession>('/api/realtime/session', {
      body: { instructions },
      timeoutMs: 20000,
      signal,
    });
  } catch (err) {
    const appErr = err instanceof AppError ? err : toAppError(err);
    throw new AppError(
      appErr.code === 'offline' ? 'offline' : 'token_failed',
      appErr.message,
      appErr,
    );
  }
}

export async function analyzeTranscript(input: {
  transcript: WireTurn[];
  durationSeconds: number;
  previousLevel?: EnglishLevel;
}): Promise<TeacherReport> {
  try {
    return await request<TeacherReport>('/api/analyze', { body: input, timeoutMs: 90000 });
  } catch (err) {
    throw new AppError('analysis_failed', (err as Error).message, err);
  }
}

export async function extractMemories(input: {
  source: 'conversation' | 'user_defined';
  transcript?: WireTurn[];
  text?: string;
  today: string;
  existing: string[];
}): Promise<ExtractedMemory[]> {
  try {
    const res = await request<{ memories: ExtractedMemory[] }>('/api/memory/extract', {
      body: input,
      timeoutMs: 60000,
    });
    return res.memories ?? [];
  } catch (err) {
    throw new AppError('extraction_failed', (err as Error).message, err);
  }
}

export async function fetchHints(input: {
  recentTurns: WireTurn[];
  level?: EnglishLevel;
}): Promise<string[]> {
  try {
    const res = await request<{ hints: string[] }>('/api/hint', {
      body: input,
      timeoutMs: 20000,
    });
    return res.hints ?? [];
  } catch (err) {
    throw new AppError('hint_failed', (err as Error).message, err);
  }
}

export async function fetchTranslation(text: string): Promise<string> {
  try {
    const res = await request<{ translation: string }>('/api/translate', {
      body: { text },
      timeoutMs: 15000,
    });
    return res.translation ?? '';
  } catch (err) {
    throw new AppError('translation_failed', (err as Error).message, err);
  }
}

export interface HealthReport {
  ok: boolean;
  reason?: string;
  config?: Record<string, string>;
  models?: Array<{ model: string; available: boolean; status: number }>;
}

export async function fetchHealth(): Promise<HealthReport> {
  return request<HealthReport>('/api/health', { method: 'GET', timeoutMs: 15000 });
}
