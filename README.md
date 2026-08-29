# OrbitX

OrbitX is an AI-native crypto intelligence and trading platform.

This repository contains the OrbitX mobile app (Expo SDK 54) connected to the existing OrbitX Supabase project (`ffjipnkhcebjvttliptb`).

## Product

Wallet-first Sign-In with Solana (Phantom). No email/password primary flow.

The home screen is the product: a ChatGPT-style intelligence chat. The Brain plans tool calls against existing OrbitX Edge Functions (OG Scan, Jupiter quotes, wallet intel, alerts, and more). Trades are quote → preview → wallet signature only. The model is never the authorization layer.

## Development

```bash
npm install
npx expo start
```

Use Expo Go on a phone, or:

- iOS: `npx expo start --ios`
- Android: `npx expo start --android`
- Web: `npx expo start --web` (Phantom browser extension for connect)

Copy `.env.example` to `.env` if you want to override the public Supabase URL/anon key. Never put a service-role key in the client.

## Vercel (web)

The GitHub project is connected to Vercel at `https://orbitxcity.vercel.app`.

Set these **public** variables on the Vercel project (Production + Preview):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SOLANA_RPC_URL` (optional)
- `EXPO_PUBLIC_APP_URL` (`https://orbitxcity.vercel.app`)
- `EXPO_PUBLIC_PRIVY_APP_ID` or `PRIVY_APP_ID` (public Privy App ID)
- `EXPO_PUBLIC_PRIVY_CLIENT_ID` or `PRIVY_CLIENT_ID` (optional)

Never put `PRIVY_APP_SECRET` in `EXPO_PUBLIC_*` or the Expo client.

LLM keys (`NVIDIA_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) and the Supabase service role belong on the **existing Soltools Edge Functions**, not in the Vercel client bundle.

```bash
npm run build:web
```

Vercel runs `expo export -p web` and serves `dist` as a single-page app.

## Backend

The app reuses existing OrbitX tables, RLS, `wallet-auth`, Jupiter, OG Scan, and related functions.

New pieces:

- `orbitx_ai_*` tables (memory, tool executions, transaction intents, permissions, agent tasks)
- Edge Function `orbitx-ai-orchestrate` (JWT required) — planner + tool calls + LLM synthesis
