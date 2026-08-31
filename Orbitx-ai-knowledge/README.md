# OrbitX AI Knowledge

Canonical training corpus for the OrbitX mobile agent (`orbitxcity`), distilled from **audifyx/og-scan** — the same source that powers @theorbitxmcpbot, Grim bots, and orbitx.world.

## Who built it

- **OrbitX** is built by **@audifyx** (Audifyx team).
- Public site: https://www.orbitx.world
- GitHub source: https://github.com/audifyx/og-scan (repo name is legacy; product is **OrbitX**).
- X: @orbitx_wrld · Telegram GC: https://t.me/orbitxwrld · Official bot: @theorbitxmcpbot

## Who it's for

Solana traders and builders who want one wallet-connected desk instead of juggling scanners, DEX terminals, launchpads, Telegram bots, and AI tools separately:

- Meme-coin / degen traders needing forensic intel before aping
- Launchers using pump.fun and vanity mints
- KOL / smart-money copy-trackers
- AI-agent users (MCP, Claude, ChatGPT, Grok)
- Mobile-first users in **Expo Go** with Privy email/phone wallets

## Why it exists

OrbitX is an **on-chain operating system** — non-custodial, wallet-first, chain-as-ground-truth. The mobile app is the fastest front door: talk, scan, buy/sell, launch, mint, and set limit orders without hunting menus.

## How the agent uses this folder

| File | Use |
|------|-----|
| `00-core/*` | Identity, iron laws, token utility — always inject |
| `01-product/*` | Surfaces, features, mobile app scope |
| `02-telegram/*` | Same facts as @theorbitxmcpbot (parity) |
| `03-personas/*` | Voice: OrbitX mobile vs Grim |
| `sources/SOURCE_MANIFEST.json` | Traceability to og-scan paths |

Runtime assembly: `src/brain/knowledgeBundle.ts` (TypeScript bundle for Expo).

## Sync from og-scan

Primary sources:

- `web/api/orbitx/orbitx-telegram-knowledge.js`
- `web/api/orbitx/orbitx-faq-training.js`
- `docs/ORBITX_PLATFORM.md`
- `supabase/functions/_shared/grim_base.ts` (Grim persona)
- `src/brain/knowledge.ts` (mobile agent)

Do **not** invent live prices, MC, holder counts, or shop USD in static knowledge.
