# Alex — backend

Four tiny serverless functions. They exist for exactly two reasons:

1. Your `OPENAI_API_KEY` never ships inside the Android app.
2. Post-call text analysis happens somewhere the phone can't leak the key.

**Live audio never passes through here.** The phone mints a short-lived client
secret from `/api/realtime/session`, then opens a WebRTC peer connection
straight to OpenAI.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Verifies the key works and the configured models exist |
| `POST` | `/api/realtime/session` | Mints an ephemeral Realtime client secret |
| `POST` | `/api/analyze` | Teacher Agent — scores + corrections as strict JSON |
| `POST` | `/api/memory/extract` | Turns a transcript or a typed note into structured memories |
| `POST` | `/api/hint` | 2-3 things the learner could say next |

Every endpoint requires the header `x-app-token: <APP_TOKEN>`.

## Deploy

```bash
cd server
npm install
npx vercel login
npx vercel --prod
```

Then in the Vercel dashboard → Project → Settings → Environment Variables, add:

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | your OpenAI secret key |
| `APP_TOKEN` | any long random string |

Redeploy after adding them (`npx vercel --prod`), then check:

```bash
curl -H "x-app-token: YOUR_APP_TOKEN" https://your-app.vercel.app/api/health
```

You want `{"ok": true, ...}`. If a model is reported unavailable, override it
with `OPENAI_TEXT_MODEL` or `OPENAI_REALTIME_MODEL` instead of editing code.

## Local development

```bash
cp .env.example .env.local   # put your real key in .env.local (gitignored)
npx vercel dev
```

The phone can reach `http://<your-mac-lan-ip>:3000` on the same Wi-Fi.
