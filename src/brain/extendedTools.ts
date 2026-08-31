import type { ToolCategory, ToolDefinition } from "./types";

function alias(
  id: string,
  name: string,
  description: string,
  backend: string,
  category: ToolCategory,
  side: "read" | "write" = "read",
): ToolDefinition {
  return {
    id,
    name,
    description,
    category,
    side,
    permission: side === "write" ? "confirm" : "none",
    confirmationRequired: side === "write",
    backend,
    timeoutMs: 30_000,
    errorBehavior: side === "write" ? "throw" : "return",
    inputHint: "{ query?: string, mint?: string }",
    outputHint: `${name} result`,
  };
}

/** Skill-facing tool aliases — all resolve to existing edge backends. */
export const EXTENDED_TOOLS: readonly ToolDefinition[] = [
  // Trading speed & execution
  alias("fast-quote", "Fast Quote", "Low-latency Jupiter quote for instant trade sizing.", "jupiter-quote", "trade"),
  alias("instant-price", "Instant Price", "Real-time Jupiter price for a mint.", "jupiter-price", "trade"),
  alias("usd-price", "USD Price", "USD-denominated token price via Jupiter.", "jupiter-price", "trade"),
  alias("market-quote", "Market Quote", "Market-order quote preview.", "jupiter-quote", "trade"),
  alias("limit-quote", "Limit Quote", "Limit-order price reference.", "jupiter-price", "trade"),
  alias("slippage-check", "Slippage Check", "Quote with slippage impact preview.", "jupiter-quote", "trade"),
  alias("route-preview", "Route Preview", "Jupiter route hops and fees.", "jupiter-quote", "trade"),
  alias("token-search", "Token Search", "Search Jupiter token list.", "jupiter-tokens", "trade"),
  alias("pair-price", "Pair Price", "Cross-mint price lookup.", "jupiter-price", "trade"),
  alias("sol-price", "SOL Price", "SOL/USD reference price.", "jupiter-price", "trade"),

  // Token intelligence
  alias("quick-scan", "Quick Scan", "Fast token metadata pass.", "token-data", "intelligence"),
  alias("deep-scan", "Deep Scan", "Full OG token intelligence.", "og-scan-token", "intelligence"),
  alias("rug-check", "Rug Check", "Rug and honeypot heuristics.", "token-safety", "intelligence"),
  alias("safety-scan", "Safety Scan", "Mint/freeze authority safety.", "token-safety", "intelligence"),
  alias("holder-scan", "Holder Scan", "Top holders and concentration.", "og-holders", "intelligence"),
  alias("whale-map", "Whale Map", "Whale wallet overlap on a mint.", "og-holders", "intelligence"),
  alias("dev-wallet", "Dev Wallet", "Developer wallet forensics.", "ogdex-firstbuyer", "intelligence"),
  alias("sniper-scan", "Sniper Scan", "Early sniper wallet detection.", "ogdex-firstbuyer", "intelligence"),
  alias("bundle-scan", "Bundle Scan", "Bundle and insider flow scan.", "ogdex-xray", "intelligence"),
  alias("xray-scan", "X-Ray Scan", "Mechanics and anomaly breakdown.", "ogdex-xray", "intelligence"),
  alias("intel-v2", "Intel v2", "Enhanced OGDEX intelligence.", "ogdex-intel-v2", "intelligence"),
  alias("intel-pass", "Intel Pass", "Legacy OGDEX intel.", "ogdex-intel", "intelligence"),
  alias("unified-scan", "Unified Scan", "Multi-source intel bundle.", "unified-intelligence", "intelligence"),
  alias("enhanced-scan", "Enhanced Scan", "AI-enriched intelligence.", "enhanced-intelligence", "intelligence"),
  alias("ai-brief", "AI Brief", "LLM analysis over structured data.", "ai-analyzer", "intelligence"),
  alias("oxw-scan", "OXW Scan", "OrbitX wallet-native scan.", "oxw-token-scan", "intelligence"),
  alias("metadata-lookup", "Metadata Lookup", "On-chain token metadata.", "token-data", "intelligence"),
  alias("trending-scan", "Trending Scan", "Trending tokens screen.", "token-data", "intelligence"),
  alias("mcap-lookup", "Market Cap Lookup", "Market cap and liquidity snapshot.", "token-data", "intelligence"),
  alias("liquidity-scan", "Liquidity Scan", "Pool liquidity analysis.", "birdseye-analytics", "intelligence"),
  alias("volume-scan", "Volume Scan", "24h volume and flow.", "birdseye-analytics", "intelligence"),

  // Wallet & portfolio
  alias("wallet-scan", "Wallet Scan", "Wallet holdings and history.", "og-wallet", "intelligence"),
  alias("pnl-lookup", "PnL Lookup", "Realized/unrealized PnL.", "pnl-scan", "intelligence"),
  alias("balance-check", "Balance Check", "Wallet balance snapshot.", "wallet-manager", "orbitx"),
  alias("holdings-fetch", "Holdings Fetch", "Token account holdings.", "wallet-manager", "orbitx"),
  alias("portfolio-scan", "Portfolio Scan", "Full portfolio overview.", "wallet-manager", "orbitx"),
  alias("activity-feed", "Activity Feed", "Wallet activity stream.", "solana-tracker", "monitor"),

  // Launch & migration
  alias("pump-launch", "Pump Launch", "Launch on pump.fun bonding curve.", "launch-coin", "create", "write"),
  alias("token-launch", "Token Launch", "Create a new SPL memecoin.", "launch-coin", "create", "write"),
  alias("bonding-curve", "Bonding Curve", "Bonding curve status.", "pumpfun-migrations", "monitor"),
  alias("migration-scan", "Migration Scan", "Raydium migration watch.", "migration-watch", "monitor"),
  alias("pump-migration", "Pump Migration", "Pump.fun migration tracker.", "pumpfun-migrations", "monitor"),
  alias("graduation-watch", "Graduation Watch", "Bonding curve graduation monitor.", "pumpfun-migrations", "monitor"),
  alias("launch-intel", "Launch Intel", "Pre-launch token intel.", "token-data", "intelligence"),
  alias("new-pair-scan", "New Pair Scan", "Fresh pair detection.", "token-data", "intelligence"),

  // NFT & mint
  alias("nft-create", "NFT Create", "Mint a new NFT.", "nft-mint", "create", "write"),
  alias("collection-mint", "Collection Mint", "Mint into a collection.", "nft-mint", "create", "write"),
  alias("nft-list", "NFT List", "List NFT for sale.", "nft-execute-sale", "create", "write"),
  alias("nft-sale", "NFT Sale", "Execute NFT sale transaction.", "nft-execute-sale", "create", "write"),
  alias("nft-intel", "NFT Intel", "Collection and floor intel.", "token-data", "intelligence"),

  // Monitor & alerts
  alias("price-alert", "Price Alert", "Set a price alert.", "alerts", "monitor", "write"),
  alias("wallet-alert", "Wallet Alert", "Wallet activity alert.", "alerts", "monitor", "write"),
  alias("push-notify", "Push Notify", "Send push notification.", "send-push", "monitor", "write"),
  alias("macro-analytics", "Macro Analytics", "Sector and macro analytics.", "birdseye-analytics", "monitor"),
  alias("tracker-feed", "Tracker Feed", "Solana activity tracker.", "solana-tracker", "monitor"),
  alias("track-record-lookup", "Track Record", "Signal track record.", "track-record", "monitor"),

  // Social & news
  alias("x-post", "X Post", "Post to connected X account.", "post-to-x", "social", "write"),
  alias("tweet-draft", "Tweet Draft", "Draft an X post.", "ai-analyzer", "social"),
  alias("news-scan", "News Scan", "Crypto news for a token.", "news-fetcher", "intelligence"),
  alias("narrative-scan", "Narrative Scan", "Narrative and sentiment news.", "news-fetcher", "intelligence"),
  alias("kol-scan", "KOL Scan", "KOL and social sentiment.", "news-fetcher", "intelligence"),

  // Reports
  alias("pdf-report", "PDF Report", "Downloadable research PDF.", "og-report-pdf", "create"),
  alias("full-report", "Full Report", "Complete token briefing.", "og-scan-token", "intelligence"),
] as const;

export const TOOL_BACKEND_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  EXTENDED_TOOLS.map((tool) => [tool.id, tool.backend]),
);

export function canonicalToolBackend(toolId: string): string {
  return TOOL_BACKEND_ALIASES[toolId] ?? toolId;
}
