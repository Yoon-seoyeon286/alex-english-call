import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  FAST_MODEL,
  REALTIME_MODEL,
  REALTIME_VOICE,
  TEXT_MODEL,
  requireAppToken,
  requireMethod,
  sendError,
} from './_lib/http.js';

/**
 * One request that tells you whether this deployment is actually usable:
 * is the key present, does it work, and do the configured models exist.
 * Hit it right after deploying.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireMethod(req, 'GET');
    requireAppToken(req);

    const apiKey = process.env.OPENAI_API_KEY;
    const config = {
      realtimeModel: REALTIME_MODEL,
      realtimeVoice: REALTIME_VOICE,
      textModel: TEXT_MODEL,
      fastModel: FAST_MODEL,
    };

    if (!apiKey) {
      res.status(200).json({
        ok: false,
        reason: 'OPENAI_API_KEY is not set in this deployment.',
        config,
      });
      return;
    }

    // `?list=1` dumps every model id this key can see, so an unavailable
    // default can be replaced with a real one instead of a guess.
    if (req.query.list) {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const body = (await r.json()) as { data?: Array<{ id: string }> };
      res.status(200).json({
        ok: r.ok,
        config,
        models: (body.data ?? []).map((m) => m.id).sort(),
      });
      return;
    }

    // `?models=a,b` lets you probe candidate model ids against this key
    // without redeploying — handy when a default turns out to be unavailable.
    const probe = typeof req.query.models === 'string' ? req.query.models.split(',') : [];
    const wanted = Array.from(
      new Set([REALTIME_MODEL, TEXT_MODEL, FAST_MODEL, ...probe].map((m) => m.trim()).filter(Boolean)),
    );
    const checks = await Promise.all(
      wanted.map(async (model) => {
        const r = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return { model, available: r.ok, status: r.status };
      }),
    );

    const missing = checks.filter((c) => !c.available);

    res.status(200).json({
      ok: missing.length === 0,
      keyPresent: true,
      config,
      models: checks,
      ...(missing.length > 0
        ? {
            reason: `These models are not available to your key: ${missing
              .map((m) => m.model)
              .join(', ')}. Override them with OPENAI_TEXT_MODEL / OPENAI_REALTIME_MODEL.`,
          }
        : {}),
    });
  } catch (err) {
    sendError(res, err);
  }
}
