# Alex — your AI English friend

An Android app that calls you like a friend does: you talk, Alex talks back in
real time, and tomorrow he remembers what you said today.

No login, no accounts, no cloud database. Everything about your life stays in
SQLite on your phone.

```
Phone ──(1) POST /api/realtime/session──▶ Vercel ──▶ OpenAI (mints ephemeral secret)
Phone ──(2) WebRTC audio ───────────────────────────▶ OpenAI Realtime   (direct, never proxied)
Phone ──(3) transcript ─▶ SQLite ─▶ /api/analyze + /api/memory/extract ─▶ OpenAI
```

---

## What you need to do (three things)

Everything else is already built. These three steps need your accounts.

### 1. Deploy the backend

```bash
cd server
npm install
npx vercel login
npx vercel --prod
```

Vercel prints a URL like `https://alex-server-xxxx.vercel.app`. Keep it.

Then **Vercel dashboard → your project → Settings → Environment Variables**:

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | your real OpenAI secret key |
| `APP_TOKEN` | any long random string you invent |

Generate a token if you want one:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Redeploy so the variables take effect, then verify:

```bash
npx vercel --prod
curl -H "x-app-token: YOUR_APP_TOKEN" https://YOUR-URL.vercel.app/api/health
```

You want `{"ok":true,...}`.

### 2. Put those two values into `eas.json`

Replace **both** placeholders in every profile:

```jsonc
"env": {
  "EXPO_PUBLIC_API_BASE_URL": "https://YOUR-URL.vercel.app",
  "EXPO_PUBLIC_APP_TOKEN": "YOUR_APP_TOKEN"
}
```

`EXPO_PUBLIC_*` values are visible inside the APK — that is fine here. The app
token only guards your endpoint from strangers; your OpenAI key never leaves
Vercel.

### 3. Build the APK

```bash
npx eas-cli login
npx eas-cli init          # creates the project, writes EAS_PROJECT_ID
npm run build:apk         # eas build -p android --profile preview
```

EAS gives you a download link. Open it on the phone, install, allow the
microphone, tap **Call Alex**.

---

## Daily use

| Screen | What it's for |
| --- | --- |
| Home | Start a call, see what Alex remembers today, jump into past calls |
| Call | The actual conversation — Mute / Transcript / Hint / End Call |
| Add Context | Type anything you want Alex to know ("presentation on Friday"). Korean is fine — it's stored as English memory |
| Review | Scores + the handful of mistakes actually worth fixing |
| My English | Speaking time, trends, the errors you keep repeating |

**Barge-in works**: just start talking while Alex is speaking and he stops.

**Hint** doesn't drop the call — it's a separate request.

If analysis ever fails, the transcript is already saved; Review shows a retry
button.

---

## Changing the model or voice

`src/services/openai/config.ts` is the single source of truth, and everything
in it can be overridden without touching code:

| Variable | Default |
| --- | --- |
| `EXPO_PUBLIC_REALTIME_MODEL` | `gpt-realtime-2.1` |
| `EXPO_PUBLIC_REALTIME_VOICE` | `cedar` |
| `EXPO_PUBLIC_AI_NAME` | `Alex` |
| `OPENAI_TEXT_MODEL` (server) | `gpt-5.6` |

---

## Local development

```bash
npm install
cp .env.example .env.local      # point at your Vercel URL
npx expo run:android            # needs Android Studio + a device
```

Or build the dev client once (`npm run build:dev`), install it, then
`npm start` and reload over Wi-Fi.

Checks:

```bash
npm run typecheck
npm run doctor
npm run prebuild        # validates the native config without building
```

---

## Layout

```
app/                    screens (expo-router)
src/components/         Button, Card, ScoreBar, Screen
src/features/           call/ memory/ review/ profile/ UI pieces
src/services/realtime/  WebRTC client, barge-in, audio routing
src/services/memory/    retrieval scoring, aging, prompt assembly
src/services/database/  SQLite schema + repositories
src/services/analysis/  post-call pipeline
src/stores/callStore.ts call state machine
server/api/             Vercel functions
```

Two deliberate separations:

- **Conversation memory** (your life) and **learning profile** (your English)
  live in different tables and are never merged into one prompt section.
- **Transcript is saved before analysis runs**, so a failed analysis can never
  cost you the conversation.
