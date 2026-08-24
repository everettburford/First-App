# Dental AI Phone Agent (MVP)

An AI phone receptionist for dental offices. It answers calls after hours or
when staff miss the phone, has a live voice conversation with the caller,
answers questions from the office's own config (hours, services, FAQ), and
takes a message or callback request when it can't help directly. Every call
is logged, and captured messages become "leads" you can pull into a
dashboard later.

## How a call flows

```
Caller dials office number
        │
        ▼
Twilio Voice webhook → POST /voice/incoming
        │  (responds with TwiML: <Connect><Stream> to this server)
        ▼
Twilio Media Stream (WebSocket) → /media-stream
        │  caller audio (8kHz mu-law) streamed in real time
        ▼
Deepgram live transcription (STT)
        │  finalized caller utterance
        ▼
Agent brain (Claude) — business config → system prompt → structured reply
        │  { message, outcome, end_call, lead? }
        ▼
ElevenLabs TTS (mu-law 8kHz output)
        │  audio streamed back over the same WebSocket
        ▼
Caller hears the reply — loop repeats until end_call is true
        │
        ▼
CallLog (+ Lead, if captured) saved to Postgres
```

The conversation loop is intentionally simple for this MVP: one caller
utterance in, one agent reply out, no interruption/barge-in handling yet.

## Stack

- **Backend**: Node.js + Express, TypeScript
- **Telephony**: Twilio Programmable Voice + Media Streams
- **Speech-to-text**: Deepgram streaming API
- **LLM**: Claude API (Anthropic SDK), forced structured output via tool use
- **Text-to-speech**: ElevenLabs (mu-law 8kHz output, telephony-ready)
- **Database**: Postgres + Prisma

## Project layout

```
src/
  server.ts               entry point: HTTP server + WS upgrade wiring
  app.ts                  Express app, routes
  config/env.ts           env var loading/validation
  db/
    prisma.ts             Prisma client
    business.ts           business config lookup
  routes/
    voice.ts              Twilio webhooks (incoming call, status callback)
    api.ts                REST API: call logs, leads, business config
  media/
    mediaStreamServer.ts  WebSocket server for Twilio Media Streams
  call/
    CallSession.ts        per-call orchestration (the conversation loop)
  services/
    deepgram.ts           Deepgram live STT wrapper
    claudeAgent.ts         agent brain: system prompt + Claude call
    elevenlabs.ts          ElevenLabs TTS wrapper
    twilioClient.ts        Twilio REST client (hang up calls)
  types/index.ts           shared types
prisma/
  schema.prisma            DB schema
  seed.ts                  seeds one sample dental office
```

## Prerequisites

- Node.js 18.17+
- A Postgres database (local install, Docker, or a hosted instance like Neon/Supabase/Railway)
- Accounts + API keys for: [Twilio](https://www.twilio.com/try-twilio), [Deepgram](https://console.deepgram.com/signup), [ElevenLabs](https://elevenlabs.io/), [Anthropic](https://console.anthropic.com/)
- [ngrok](https://ngrok.com/) (or similar) for exposing your local server to Twilio during testing
- A Twilio phone number with **Voice** capability

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Then fill in `.env`:

- `DATABASE_URL` — your Postgres connection string.
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — from the [Twilio Console](https://console.twilio.com) dashboard.
- `TWILIO_PHONE_NUMBER` — the Twilio number callers will dial, in E.164 format (e.g. `+15551234567`). This must match the `phoneNumber` on a `Business` row (see seeding below) — that's how the agent knows which office's hours/services/FAQ to use.
- `DEEPGRAM_API_KEY` — from the [Deepgram Console](https://console.deepgram.com) → API Keys.
- `ANTHROPIC_API_KEY` — from the [Anthropic Console](https://console.anthropic.com) → API Keys. Set `CLAUDE_MODEL` to whichever current Claude model your account has access to.
- `ELEVENLABS_API_KEY` — from ElevenLabs → Profile → API Keys.
- `ELEVENLABS_VOICE_ID` — pick a voice from the [Voice Library](https://elevenlabs.io/app/voice-library) (or clone your own) and copy its Voice ID.

## 3. Set up the database

```bash
npm run prisma:migrate   # creates tables from prisma/schema.prisma
npm run seed              # inserts one sample "Bright Smile Dental" business
                           # using TWILIO_PHONE_NUMBER from .env
```

You can add more businesses via Prisma Studio (`npm run prisma:studio`) or
via `POST /api/businesses` (see below).

## 4. Run the server locally

```bash
npm run dev
```

This starts the Express server (and the WebSocket media stream endpoint on
the same port) at `http://localhost:3000` by default.

## 5. Expose your local server with ngrok

Twilio needs to reach your server over the public internet:

```bash
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL ngrok gives you.

## 6. Configure the Twilio phone number webhook

1. In the [Twilio Console](https://console.twilio.com), go to **Phone Numbers → Manage → Active Numbers** and click your number.
2. Under **Voice Configuration**, set:
   - **A call comes in**: `Webhook`, method `HTTP POST`, URL:
     `https://xxxx.ngrok-free.app/voice/incoming`
   - **Call status changes** (optional but recommended): `https://xxxx.ngrok-free.app/voice/status`
3. Save.

> The webhook responds with TwiML that opens a `<Connect><Stream>` back to
> `wss://xxxx.ngrok-free.app/media-stream` on the same host, so no separate
> stream URL configuration is needed — it's derived from the incoming
> request's `Host` header.

## 7. Make a test call

Call your Twilio number from any phone. You should hear the agent's
greeting, be able to ask a question (e.g. "What are your hours?" or "I'd
like to leave a message about a broken filling"), get a spoken answer back,
and have the call wrap up with a polite goodbye. Check the database
afterward:

```bash
npm run prisma:studio
```

You should see a `CallLog` row with the full transcript and an `outcome`,
and — if you asked to leave a message or book something — a matching `Lead`
row.

## REST API (for a future dashboard)

- `GET /api/call-logs?businessId=&limit=` — list recent call logs (includes linked lead, if any)
- `GET /api/call-logs?unmatched=true&limit=` — list calls to a number with no configured business (`businessId` is null, `outcome` is `NO_BUSINESS_CONFIGURED`) — useful for spotting a Twilio number that isn't wired up to a `Business` row yet
- `GET /api/call-logs/:id` — single call log with full transcript
- `GET /api/leads?businessId=&limit=` — list captured leads
- `GET /api/businesses?limit=` — list configured businesses, alphabetically by name
- `POST /api/businesses` — create/update a business by `phoneNumber` (body: `name`, `phoneNumber`, `timezone`, `hours`, `services`, `faq`, `instructions`)

## Known MVP limitations

- No interruption/barge-in handling — the caller can't talk over the agent mid-reply.
- Single active turn at a time per call; concurrent calls are handled fine (one `CallSession` per WebSocket connection), but a caller must finish speaking before the agent responds.
- Business lookup is by dialed Twilio number only — no multi-language, no caller-ID based personalization.
- Call-ending timing is estimated from reply text length rather than actual audio playback completion (Twilio Media Streams don't natively report client-side playback position for outbound audio).
- No authentication on the REST API — add auth before deploying anywhere public.

## Production notes (not done in this MVP)

- Put the REST API behind auth.
- Move off `ngrok` to a real deployed HTTPS endpoint (e.g. Fly.io, Render, Railway) with TLS.
- Add retries/backoff around the Deepgram/Claude/ElevenLabs calls and a fallback TwiML `<Say>` path if the WebSocket pipeline fails.
- Consider a queue/worker if you need to scale beyond a handful of concurrent calls per process.
