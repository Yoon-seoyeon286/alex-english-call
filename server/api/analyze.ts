import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  HttpError,
  TEXT_MODEL,
  readJsonBody,
  requireAppToken,
  requireMethod,
  sendError,
} from './_lib/http.js';
import { structuredResponse } from './_lib/openai.js';
import { TEACHER_REPORT_SCHEMA } from './_lib/schemas.js';

interface Turn {
  speaker: 'USER' | 'AI';
  text: string;
}

interface Body {
  transcript?: Turn[];
  durationSeconds?: number;
  previousLevel?: string;
}

const TEACHER_INSTRUCTIONS = `You are a warm, sharp English coach reviewing a casual phone conversation between a learner (USER) and their English-speaking friend Alex (AI).

Judge ONLY what the USER said. Alex's lines are context.

Scoring (0-100), calibrated for spoken conversational English, not written essays:
- grammar: accuracy of tense, articles, agreement, prepositions
- fluency: length of runs, hesitation, self-repair, ability to keep the turn going
- vocabulary: range and precision of word choice
- naturalness: how close it sounds to how a native speaker would actually say it
- communication: whether the message got across regardless of errors
- overall: a holistic weighted read, not a plain average

Rules:
- The transcript comes from speech recognition. Ignore obvious mis-transcriptions, filler words, and punctuation artifacts. Never "correct" something that is just a transcription glitch.
- Pick at most 6 corrections, and only ones with genuine learning value — recurring patterns beat one-off slips.
- "corrected" is the minimum grammatical fix. "natural" is what a native speaker would really say, which may restructure the sentence.
- "reason" is one short, friendly sentence. No grammar jargon dumps.
- strengths must quote or paraphrase things the learner actually said.
- recommendedExpressions must fit the topics that came up in this specific call.
- If the learner barely spoke, give low-confidence scores near 50 rather than inventing detail, keep corrections few, and say so in the summary.

LANGUAGE — this matters:
The learner is Korean. Everything you write ABOUT their English must be in natural, friendly Korean (존댓말, 해요체). Everything that IS English — the material they are meant to learn — stays in English.

Korean: summary, strengths, weaknesses, corrections[].reason, recommendedExpressions[].meaning
English: corrections[].original, corrections[].corrected, corrections[].natural, recommendedExpressions[].expression, recommendedExpressions[].example

Write Korean the way a friendly tutor talks, not like a textbook. When you must name a grammar concept, use the everyday Korean term and put the English sentence in quotes rather than translating it. Never translate the learner's own words into Korean — quote them in English.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireMethod(req, 'POST');
    requireAppToken(req);

    const body = readJsonBody<Body>(req);
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    const userTurns = transcript.filter((t) => t.speaker === 'USER' && t.text?.trim());
    if (userTurns.length === 0) {
      throw new HttpError(400, 'empty_transcript', 'No user speech to analyse.');
    }

    const rendered = transcript
      .filter((t) => typeof t?.text === 'string' && t.text.trim().length > 0)
      .map((t) => `${t.speaker === 'USER' ? 'USER' : 'ALEX'}: ${t.text.trim()}`)
      .join('\n');

    const meta = [
      body.durationSeconds ? `Call length: ${Math.round(body.durationSeconds)} seconds.` : '',
      body.previousLevel ? `Previously estimated level: ${body.previousLevel}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const report = await structuredResponse({
      model: TEXT_MODEL,
      instructions: TEACHER_INSTRUCTIONS,
      input: `${meta}\n\nTRANSCRIPT\n${rendered}`.trim(),
      schemaName: 'teacher_report',
      schema: TEACHER_REPORT_SCHEMA as unknown as Record<string, unknown>,
      maxOutputTokens: 6000,
    });

    res.status(200).json(report);
  } catch (err) {
    sendError(res, err);
  }
}
