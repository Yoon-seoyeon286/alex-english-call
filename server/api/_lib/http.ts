import type { VercelRequest, VercelResponse } from '@vercel/node';

export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2.1';
export const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE ?? 'cedar';
export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? 'gpt-5.5';
// Hints are on the critical path of a live call, so they run on a smaller,
// faster model than the post-call teacher analysis.
export const FAST_MODEL = process.env.OPENAI_FAST_MODEL ?? 'gpt-5.4-mini';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * A single shared token. This is deliberately not a login system — it exists so
 * that a stranger who discovers the URL cannot burn the owner's OpenAI credits.
 */
export function requireAppToken(req: VercelRequest): void {
  const expected = process.env.APP_TOKEN;
  if (!expected) {
    throw new HttpError(500, 'server_misconfigured', 'APP_TOKEN is not set on the server.');
  }
  const provided = req.headers['x-app-token'];
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (!value || !timingSafeEqual(value, expected)) {
    throw new HttpError(401, 'unauthorized', 'Invalid or missing x-app-token header.');
  }
}

export function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new HttpError(500, 'server_misconfigured', 'OPENAI_API_KEY is not set on the server.');
  }
  return key;
}

export function requireMethod(req: VercelRequest, method: 'GET' | 'POST'): void {
  if (req.method !== method) {
    throw new HttpError(405, 'method_not_allowed', `Use ${method}.`);
  }
}

export function sendError(res: VercelResponse, err: unknown): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  // eslint-disable-next-line no-console
  console.error('[alex-server] unhandled', err);
  res.status(500).json({ error: { code: 'internal_error', message } });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Vercel gives us either a parsed object or a raw string depending on headers. */
export function readJsonBody<T>(req: VercelRequest): T {
  const body = req.body;
  if (body == null) return {} as T;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new HttpError(400, 'bad_request', 'Request body is not valid JSON.');
    }
  }
  return body as T;
}
