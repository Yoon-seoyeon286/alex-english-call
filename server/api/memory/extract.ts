import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  HttpError,
  TEXT_MODEL,
  readJsonBody,
  requireAppToken,
  requireMethod,
  sendError,
} from '../_lib/http.js';
import { structuredResponse } from '../_lib/openai.js';
import { MEMORY_EXTRACTION_SCHEMA } from '../_lib/schemas.js';

interface Turn {
  speaker: 'USER' | 'AI';
  text: string;
}

interface Body {
  source?: 'conversation' | 'user_defined';
  /** Used when source === 'conversation'. */
  transcript?: Turn[];
  /** Used when source === 'user_defined' — free text the owner typed. */
  text?: string;
  /** Today's local date as YYYY-MM-DD so relative dates resolve correctly. */
  today?: string;
  /** Existing memory contents, so the model avoids emitting near-duplicates. */
  existing?: string[];
}

const BASE_INSTRUCTIONS = `You extract long-term memories about one person (referred to as "User") so that an AI friend can bring things up naturally in future phone calls.

Write each memory as ONE self-contained third-person sentence, e.g.
"User has an important presentation this Friday."
"User started going to the gym this week."
"User's colleague Minji is leaving the team next month."

What to keep:
- upcoming_event: something scheduled ahead
- recent_event: something that just happened
- person: someone who matters to them
- current_project: ongoing work or study
- interest: hobbies, tastes, things they enjoy talking about
- concern: worries, stress, open problems
- goal: what they are trying to achieve
- preference: likes and dislikes
- experience: notable past events worth remembering
- follow_up: something explicitly worth asking about next time

What to drop:
- small talk, weather, greetings, filler
- anything Alex said about himself
- English-learning performance (grammar mistakes, vocabulary level) — that belongs to a completely separate learning profile and must NEVER appear here
- facts already covered by the existing memories listed below
- speculation the user did not actually state

Dates:
- Resolve every relative expression ("tomorrow", "this Friday", "next month") against TODAY into a concrete YYYY-MM-DD in relevantDate.
- Use "" when the memory is not tied to a date.
- followUpAfter is the first date it becomes natural to ask "how did that go?" — usually the day of or the day after relevantDate. Use "" when there is nothing to follow up on.

Importance:
- high: time-bound events, significant worries or goals, major life changes
- medium: ongoing projects, recurring interests, notable people
- low: passing details

Return at most 12 memories. Fewer, sharper memories are better than many vague ones.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireMethod(req, 'POST');
    requireAppToken(req);

    const body = readJsonBody<Body>(req);
    const source = body.source === 'user_defined' ? 'user_defined' : 'conversation';
    const today = normaliseDate(body.today) ?? new Date().toISOString().slice(0, 10);

    let material = '';
    if (source === 'user_defined') {
      const text = (body.text ?? '').trim();
      if (!text) throw new HttpError(400, 'bad_request', 'text is required.');
      material = `The user typed this note directly so that Alex remembers it. It may be written in any language; always output English memories.\n\nNOTE\n${text}`;
    } else {
      const transcript = Array.isArray(body.transcript) ? body.transcript : [];
      const rendered = transcript
        .filter((t) => typeof t?.text === 'string' && t.text.trim().length > 0)
        .map((t) => `${t.speaker === 'USER' ? 'USER' : 'ALEX'}: ${t.text.trim()}`)
        .join('\n');
      if (!rendered) throw new HttpError(400, 'empty_transcript', 'Nothing to extract.');
      material = `TRANSCRIPT OF THE CALL\n${rendered}`;
    }

    const existing = (body.existing ?? []).slice(0, 60);
    const existingBlock = existing.length
      ? `\n\nEXISTING MEMORIES (do not repeat these)\n${existing.map((e) => `- ${e}`).join('\n')}`
      : '';

    const result = await structuredResponse<{ memories: unknown[] }>({
      model: TEXT_MODEL,
      instructions: BASE_INSTRUCTIONS,
      input: `TODAY: ${today}\n\n${material}${existingBlock}`,
      schemaName: 'memory_extraction',
      schema: MEMORY_EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      maxOutputTokens: 3000,
    });

    res.status(200).json({ memories: result.memories ?? [] });
  } catch (err) {
    sendError(res, err);
  }
}

function normaliseDate(value: string | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
