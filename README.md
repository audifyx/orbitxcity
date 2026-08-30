# OrbitX

OrbitX is an AI-native crypto intelligence and trading platform.

This repository contains the OrbitX mobile app (Expo SDK 54) connected to the existing OrbitX Supabase project (`ffjipnkhcebjvttliptb`).

## Product

OrbitX is an Expo Go app. Sign up and sign in happen **inside the app** with email or phone. Privy creates an in-app Solana wallet for that account. The session logs into the app only. Privy is not used to connect Phantom or Jupiter. Nothing opens a browser or website to log in.

The home screen is the product: a ChatGPT-style intelligence chat. The Brain plans tool calls against existing OrbitX Edge Functions (OG Scan, Jupiter quotes, wallet intel, alerts, and more). Trades are quote → preview → wallet signature only. The model is never the authorization layer.

## Development

```bash
npm install
npm start
```

Open the project in **Expo Go**. Email/phone OTP, wallet creation, and sign-in stay on that screen.

Copy `.env.example` to `.env` if you want to override public values. Never put a service-role key or `PRIVY_APP_SECRET` in the client.

In the Privy dashboard, this is one-time mobile setup (not a login redirect):

- Configuration → App settings → **Clients**: add an Expo app client
- Allowed app identifiers: `host.exp.Exponent` (Expo Go) and `ai.orbitx.app`
- Allowed URL schemes: `exp` and `orbitx`
- Put the public client ID in `EXPO_PUBLIC_PRIVY_CLIENT_ID`
- Email and SMS login on
- Solana embedded wallets → Create on login → all users

Never put `PRIVY_APP_SECRET` in `EXPO_PUBLIC_*` or the Expo client.

LLM keys (`NVIDIA_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) and the Supabase service role belong on the **existing Soltools Edge Functions**, not in the Expo client.

## Backend

The app reuses existing OrbitX tables, RLS, `wallet-auth`, Jupiter, OG Scan, and related functions.

New pieces:

- `orbitx_ai_*` tables (memory, tool executions, transaction intents, permissions, agent tasks)
- Edge Function `orbitx-ai-orchestrate` (JWT required) — planner + tool calls + LLM synthesis
