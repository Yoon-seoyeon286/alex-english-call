import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  FAST_MODEL,
  readJsonBody,
  requireAppToken,
  requireMethod,
  sendError,
} from './_lib/http.js';
import { structuredResponse } from './_lib/openai.js';
import { HINT_SCHEMA } from './_lib/schemas.js';

interface Turn {
  speaker: 'USER' | 'AI';
  text: string;
}

interface Body {
  recentTurns?: Turn[];
  level?: string;
}

const HINT_INSTRUCTIONS = `The learner is on a live English phone call and just got stuck. Give them 2-3 short, natural things they could say RIGHT NOW, in first person.

Rules:
- Answer the question that was actually just asked. Do not give generic filler unless the context is genuinely empty.
- Keep each option under about 12 words — this is speech, not writing.
- Offer variety: for example one direct answer, one hedge, one that turns the question back.
- Use everyday spoken English ("I'm still figuring it out", "Honestly, no idea"), not textbook phrasing.
- Match the learner's level: simpler wording for lower levels.
- No quotation marks, no numbering, no explanations — just the sentences.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireMethod(req, 'POST');
    requireAppToken(req);

    const body = readJsonBody<Body>(req);
    const turns = (Array.isArray(body.recentTurns) ? body.recentTurns : []).slice(-8);

    const rendered = turns
      .filter((t) => typeof t?.text === 'string' && t.text.trim().length > 0)
      .map((t) => `${t.speaker === 'USER' ? 'LEARNER' : 'ALEX'}: ${t.text.trim()}`)
      .join('\n');

    const result = await structuredResponse<{ hints: string[] }>({
      model: FAST_MODEL,
      instructions: HINT_INSTRUCTIONS,
      input: rendered
        ? `Learner level: ${body.level ?? 'intermediate'}\n\nRECENT CONVERSATION\n${rendered}`
        : `Learner level: ${body.level ?? 'intermediate'}\n\nThe call just started and nothing has been said yet. Suggest natural openers.`,
      schemaName: 'speaking_hints',
      schema: HINT_SCHEMA as unknown as Record<string, unknown>,
      maxOutputTokens: 800,
    });

    res.status(200).json({ hints: (result.hints ?? []).slice(0, 3) });
  } catch (err) {
    sendError(res, err);
  }
}
