# OrbitX

OrbitX is an AI-native crypto intelligence and trading platform.

This repository contains the OrbitX mobile app (Expo SDK 54) connected to the existing OrbitX Supabase project (`ffjipnkhcebjvttliptb`).

## Product

Sign in with email or phone through Supabase. Users connect Jupiter Wallet or another compatible external Solana wallet for portfolio access and transaction signing. OrbitX never receives private keys.

The home screen is the product: a ChatGPT-style intelligence chat. The Brain plans tool calls against existing OrbitX Edge Functions (OG Scan, Jupiter quotes, wallet intel, alerts, and more). Trades are quote → preview → wallet signature only. The model is never the authorization layer.

## Development

```bash
npm install
npx expo start
```

Use Expo Go for the Supabase-only app shell, or build a custom development client for native Mobile Wallet Adapter wallet connectivity:

```bash
npx eas build --profile development --platform android
npx expo start --dev-client
```

Use the web build for Wallet Standard-compatible Jupiter Wallet connections, or:

- iOS: `npx expo start --ios`
- Android: `npx expo start --android`
- Web: `npx expo start --web` (Supabase OTP with a Wallet Standard-compatible wallet)

Copy `.env.example` to `.env` if you want to override the public Supabase URL/anon key. Never put a service-role key in the client.

## Vercel (web)

The GitHub project is connected to Vercel at `https://orbitxcity.vercel.app`.

Set these **public** variables on the Vercel project (Production + Preview):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SOLANA_RPC_URL` (optional)
- `EXPO_PUBLIC_APP_URL` (`https://orbitxcity.vercel.app`)


Add these **HTTPS** origins under Configuration → App settings → Domains:

- `https://orbitxcity.vercel.app`
- `https://ogscan.fun`
- `https://www.ogscan.fun`



LLM keys (`NVIDIA_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) and the Supabase service role belong on the **existing Soltools Edge Functions**, not in the Vercel client bundle.

```bash
npm run build:web
```

Vercel runs `expo export -p web` and serves `dist` as a single-page app.

## Backend

The app reuses existing OrbitX tables, RLS, Supabase Auth, Jupiter, OG Scan, and related functions. External wallets remain the transaction authorization boundary.

New pieces:

- `orbitx_ai_*` tables (memory, tool executions, transaction intents, permissions, agent tasks)
- Edge Function `orbitx-ai-orchestrate` (JWT required) — planner + tool calls + LLM synthesis
