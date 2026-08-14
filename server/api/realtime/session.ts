import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  HttpError,
  REALTIME_MODEL,
  REALTIME_VOICE,
  readJsonBody,
  requireAppToken,
  requireMethod,
  sendError,
} from '../_lib/http.js';
import { createRealtimeClientSecret } from '../_lib/openai.js';

interface Body {
  /** Full system prompt assembled on-device from conversation memory. */
  instructions?: string;
  /** Optional per-call overrides, mainly for experimenting from the phone. */
  voice?: string;
  model?: string;
}

const MAX_INSTRUCTIONS = 20000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireMethod(req, 'POST');
    requireAppToken(req);

    const body = readJsonBody<Body>(req);
    const instructions = (body.instructions ?? '').trim();

    if (!instructions) {
      throw new HttpError(400, 'bad_request', 'instructions is required.');
    }
    if (instructions.length > MAX_INSTRUCTIONS) {
      throw new HttpError(400, 'bad_request', 'instructions is too long.');
    }

    const model = body.model ?? REALTIME_MODEL;
    const voice = body.voice ?? REALTIME_VOICE;

    const { value, expiresAt } = await createRealtimeClientSecret({
      type: 'realtime',
      model,
      instructions,
      output_modalities: ['audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          // Semantic VAD reads intonation, so it waits for the learner to
          // actually finish instead of cutting in on a mid-sentence pause.
          turn_detection: {
            type: 'semantic_vad',
            eagerness: 'medium',
            create_response: true,
            interrupt_response: true,
          },
          noise_reduction: { type: 'near_field' },
          transcription: {
            model: 'gpt-4o-mini-transcribe',
            language: 'en',
          },
        },
        output: {
          format: { type: 'audio/pcm' },
          voice,
          speed: 1.0,
        },
      },
    });

    res.status(200).json({ value, expiresAt, model, voice });
  } catch (err) {
    sendError(res, err);
  }
}
