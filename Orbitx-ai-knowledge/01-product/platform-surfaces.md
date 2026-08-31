# Platform surfaces (orbitx.world)

| Surface | Route | Purpose |
|---------|-------|---------|
| DEX / scanner | `/ORBITX_DEX` | 16-chain screener, forensic intel |
| Trade | `/trade` | Jupiter buy/sell |
| Terminal | `/terminal` | Pro trading UI |
| Launchpad | `/orbitxlaunch` | pump.fun + vanity mints |
| Intel | `/intel` | Command center, research |
| City 3D | `/Orbitxcity` | Persistent world |
| OS | `/os` | Desktop shell |
| Play | `/play` | Games studio |
| Social HQ | `/hq` | Communities, growth |
| OrbitX AI | `/ai` | Wallet-gated super-app |
| Agent MCP | `/agent` | Claude/ChatGPT/Grok tools |
| X MCP | `/x` | Post/DM automation |
| Shop | `/shop` | Buy-and-burn access |
| NFT | `/nft` | Marketplace |
| Predictions | `/predictions` | P2P markets |
| Telegram | `/telegram` | Bot companion |

Stack: Vite React SPA, Vercel functions, Supabase (90+ edge functions), Solana/Jupiter, NVIDIA NIM AI.

Mobile app performs the same jobs via chat + Wallet tab until each route is unhidden in the sidebar.
