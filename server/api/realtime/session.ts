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

    const tuned = {
      type: 'realtime',
      model,
      instructions,
      output_modalities: ['audio'],
      audio: {
        // No explicit `format` here on purpose: over WebRTC the codec is
        // negotiated in the SDP, and pinning PCM only applies to WebSocket
        // transports.
        input: {
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
          voice,
          speed: 1.0,
        },
      },
    };

    /**
     * If OpenAI ever renames or drops one of the tuning fields above, a 400
     * would otherwise mean "no calls at all". Falling back to the minimal
     * documented shape keeps the app usable — you just lose semantic VAD and
     * live transcription until the config is updated.
     */
    const minimal = {
      type: 'realtime',
      model,
      instructions,
      audio: { output: { voice } },
    };

    let secret;
    try {
      secret = await createRealtimeClientSecret(tuned);
    } catch (err) {
      if (err instanceof HttpError && err.status !== 429) {
        console.warn(`tuned session config rejected, retrying minimal: ${err.message}`);
        secret = await createRealtimeClientSecret(minimal);
      } else {
        throw err;
      }
    }

    res.status(200).json({
      value: secret.value,
      expiresAt: secret.expiresAt,
      model,
      voice,
    });
  } catch (err) {
    sendError(res, err);
  }
}
