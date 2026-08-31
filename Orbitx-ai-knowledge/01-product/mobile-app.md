# Mobile app scope (orbitxcity / Expo Go)

## Auth & wallet

- Sign in: **email or phone OTP** via Privy (`@privy-io/expo`)
- Wallet: **embedded Solana** created by Privy — not Phantom/Jupiter wallet-connect for login
- Session: SIWS to Soltools `wallet-auth` + Supabase session
- Export key: Privy hosted `/export/` page in browser — OrbitX never sees the key

## Trading (live)

- **Buy:** `buy <mint>` or tap Buy — Jupiter Ultra, default ~$0.25 SOL
- **Sell:** `sell 50% <mint>`, `sell all <mint>`, or Wallet/Token card Sell
- **Limit:** `sell 25% when mcap hits 500k <mint>` — pending until target, desk at `/orders`
- Privy wallet must match Jupiter taker address

## Chat agent

- Natural language + `@tool` mentions
- Token intel via orchestrator → Soltools edge functions
- Conversational voice — not giant tool boxes
- Iron laws from og-scan / Grim methodology

## Wallet tab

- Portfolio (holdings, SOL, PnL)
- Trade desk (buy/sell)
- Recent trades
- Export secret key (Privy)
- Limit order desk link

## Hidden routes (chat-accessible)

trending, tools, agents, activity, alerts, launch, nft, paper, research, strategy, social, profile, dex, orders

Sidebar shows: **Home, Wallet, Settings** only.
