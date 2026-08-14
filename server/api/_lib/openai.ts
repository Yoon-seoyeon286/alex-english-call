import { HttpError, requireApiKey } from './http.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

interface StructuredCallOptions {
  model: string;
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
}

/**
 * Calls the Responses API with a strict json_schema format and returns the
 * parsed object. Throws HttpError with a useful code on failure.
 */
export async function structuredResponse<T>(opts: StructuredCallOptions): Promise<T> {
  const apiKey = requireApiKey();

  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      instructions: opts.instructions,
      input: opts.input,
      max_output_tokens: opts.maxOutputTokens ?? 4000,
      text: {
        format: {
          type: 'json_schema',
          name: opts.schemaName,
          strict: true,
          schema: opts.schema,
        },
      },
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new HttpError(
      res.status === 429 ? 429 : 502,
      'openai_error',
      `OpenAI responses call failed (${res.status}): ${truncate(raw, 500)}`,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new HttpError(502, 'openai_bad_json', 'OpenAI returned a non-JSON envelope.');
  }

  const text = extractOutputText(payload);
  if (!text) {
    throw new HttpError(502, 'openai_empty', 'OpenAI returned no output text.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(
      502,
      'openai_bad_json',
      `Model output was not valid JSON: ${truncate(text, 500)}`,
    );
  }
}

/** Mints a short-lived client secret the phone uses to talk to Realtime directly. */
export async function createRealtimeClientSecret(
  sessionConfig: Record<string, unknown>,
): Promise<{ value: string; expiresAt: number }> {
  const apiKey = requireApiKey();

  const res = await fetch(`${OPENAI_BASE}/realtime/client_secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session: sessionConfig }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new HttpError(
      res.status === 429 ? 429 : 502,
      'ephemeral_token_failed',
      `Could not mint a Realtime client secret (${res.status}): ${truncate(raw, 500)}`,
    );
  }

  const data = JSON.parse(raw) as { value?: string; expires_at?: number };
  if (!data.value) {
    throw new HttpError(502, 'ephemeral_token_failed', 'Realtime response had no client secret.');
  }

  return {
    value: data.value,
    expiresAt: data.expires_at ?? Math.floor(Date.now() / 1000) + 60,
  };
}

/** Walks the Responses API envelope and concatenates any output_text parts. */
function extractOutputText(payload: unknown): string | null {
  const root = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof root.output_text === 'string' && root.output_text.length > 0) {
    return root.output_text;
  }
  if (Array.isArray(root.output_text)) {
    const joined = root.output_text.filter((t): t is string => typeof t === 'string').join('');
    if (joined) return joined;
  }

  if (!Array.isArray(root.output)) return null;

  const chunks: string[] = [];
  for (const item of root.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (typeof part?.text === 'string' && part.type !== 'reasoning') {
        chunks.push(part.text);
      }
    }
  }
  return chunks.length > 0 ? chunks.join('') : null;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
