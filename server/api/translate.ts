import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  FAST_MODEL,
  readJsonBody,
  requireAppToken,
  requireMethod,
  sendError,
} from './_lib/http.js';
import { structuredResponse } from './_lib/openai.js';
import { TRANSLATE_SCHEMA } from './_lib/schemas.js';

interface Body {
  text?: string;
}

const TRANSLATE_INSTRUCTIONS = `You are translating a casual English sentence spoken by Alex, the learner's English-speaking friend.

Rules:
- Translate into natural, friendly Korean 해요체.
- Keep it one sentence unless the original is clearly multiple.
- Preserve warmth and casualness — don't make it sound like a textbook.
- Do NOT add explanations, romanization, or pronunciation tips.
- Return only the translation.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireMethod(req, 'POST');
    requireAppToken(req);

    const body = readJsonBody<Body>(req);
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      res.status(400).json({ error: { code: 'bad_request', message: 'text is required' } });
      return;
    }

    const result = await structuredResponse<{ translation: string }>({
      model: FAST_MODEL,
      instructions: TRANSLATE_INSTRUCTIONS,
      input: text,
      schemaName: 'translation',
      schema: TRANSLATE_SCHEMA as unknown as Record<string, unknown>,
      maxOutputTokens: 400,
    });

    res.status(200).json({ translation: result.translation ?? '' });
  } catch (err) {
    sendError(res, err);
  }
}
