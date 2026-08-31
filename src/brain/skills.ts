import type {
  SkillCategory,
  SkillDefinition,
  SkillKind,
  SkillLevel,
} from "./types";
import { TOOLS } from "./tools";

const TOOL_IDS = new Set(TOOLS.map((t) => t.id));

/** Exact number of skills exposed by the OrbitX agent. */
export const SKILL_TARGET = 250;

type Seed = {
  name: string;
  category: SkillCategory;
  kind: SkillKind;
  level?: SkillLevel;
  summary: string;
  toolIds?: string[];
  agentId?: string;
  tags?: string[];
  triggers?: string[];
};

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function build(seeds: Seed[]): SkillDefinition[] {
  const seen = new Set<string>();
  const out: SkillDefinition[] = [];
  for (const seed of seeds) {
    const id = slug(seed.name);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({
      id,
      name: seed.name,
      category: seed.category,
      kind: seed.kind,
      level: seed.level ?? "advanced",
      summary: seed.summary,
      toolIds: (seed.toolIds ?? []).filter((t) => TOOL_IDS.has(t)),
      agentId: seed.agentId,
      triggers: seed.triggers ?? [],
      tags: seed.tags ?? [],
    });
  }
  return out;
}

// ── Curated core skills ────────────────────────────────────────────────
const CURATED: Seed[] = [
  // Trading
  { name: "Quote a Swap", category: "trading", kind: "analysis", level: "core", summary: "Fetch a Jupiter route and price impact for a swap without executing.", toolIds: ["jupiter-quote", "jupiter-price"], agentId: "trading", tags: ["swap", "quote", "jupiter"], triggers: ["quote 1 SOL to USDC", "how much for this swap"] },
  { name: "Build Swap Preview", category: "trading", kind: "action", level: "core", summary: "Assemble an unsigned swap transaction for wallet signature after quote review.", toolIds: ["jupiter-quote", "jupiter-swap", "wallet-manager"], agentId: "swap-builder", tags: ["swap", "sign"], triggers: ["build the swap", "execute this swap"] },
  { name: "Place Limit Order", category: "trading", kind: "action", summary: "Prepare a Jupiter limit order for wallet signing.", toolIds: ["jupiter-order", "jupiter-quote"], agentId: "limit-order-desk", tags: ["limit", "order"], triggers: ["set a limit order", "buy at price"] },
  { name: "Price Impact Check", category: "trading", kind: "analysis", summary: "Estimate slippage and price impact for a trade size against pool depth.", toolIds: ["jupiter-quote", "ogdex-intel-v2"], agentId: "liquidity", tags: ["impact", "slippage"], triggers: ["price impact for 10 SOL"] },
  { name: "Best Route Finder", category: "trading", kind: "analysis", summary: "Compare Jupiter routes for best execution across DEXes.", toolIds: ["jupiter-quote", "jupiter-tokens"], agentId: "jupiter", tags: ["routing"], triggers: ["best route to swap"] },
  { name: "Dollar Cost Average Plan", category: "trading", kind: "analysis", summary: "Design a DCA schedule with quote-only previews per tranche.", toolIds: ["jupiter-quote", "jupiter-price"], agentId: "strategy", tags: ["dca", "plan"], triggers: ["dca into this token"] },
  { name: "Take-Profit Ladder", category: "trading", kind: "analysis", summary: "Build a staged take-profit ladder with target prices and sizes.", toolIds: ["jupiter-price", "ai-analyzer"], agentId: "strategy", tags: ["exit", "tp"], triggers: ["set take profit levels"] },
  { name: "Stop-Loss Planner", category: "trading", kind: "analysis", summary: "Define invalidation and stop levels for a position.", toolIds: ["jupiter-price", "support-resistance"], agentId: "strategy", tags: ["risk", "stop"], triggers: ["where should my stop be"] },
  { name: "Entry Timing Check", category: "trading", kind: "analysis", summary: "Assess entry timing from momentum, volume, and levels.", toolIds: ["technical-indicators", "volume-profile"], agentId: "strategy", tags: ["entry"], triggers: ["good entry here?"] },
  { name: "Position Sizer", category: "trading", kind: "analysis", summary: "Size a position from account risk, stop distance, and volatility.", toolIds: ["ai-analyzer", "jupiter-price"], agentId: "strategy", tags: ["sizing", "risk"], triggers: ["how much should I buy"] },
  { name: "Copy Trade Preview", category: "trading", kind: "analysis", summary: "Simulate copying a wallet's trade with quote-only math.", toolIds: ["og-wallet", "jupiter-quote", "pnl-scan"], agentId: "copy-trade-preview", tags: ["copy"], triggers: ["copy this wallet's trade"] },
  { name: "Paper Trade Simulator", category: "trading", kind: "analysis", summary: "Run a simulated trade using live quotes with no on-chain execution.", toolIds: ["jupiter-quote", "jupiter-price", "pnl-scan"], agentId: "paper-trading", tags: ["paper", "sim"], triggers: ["paper trade this"] },
  { name: "Launch Sniper Checklist", category: "trading", kind: "analysis", summary: "Pre-launch safety, liquidity, and quote prep before any buy.", toolIds: ["token-safety", "jupiter-quote", "ogdex-firstbuyer"], agentId: "launch-sniper-prep", tags: ["snipe", "launch"], triggers: ["prep to snipe this launch"] },
  { name: "Execution Checklist", category: "trading", kind: "analysis", summary: "Walk Intent → Validation → Quote → Preview → Sign → Verify.", toolIds: ["jupiter-quote", "token-safety", "wallet-manager"], agentId: "execution-checklist", tags: ["process"], triggers: ["run the trade checklist"] },
  { name: "Perps Position Quote", category: "trading", kind: "analysis", summary: "Quote a perp position with leverage, funding, and liquidation price.", toolIds: ["perps-quote", "jupiter-price"], agentId: "trading", tags: ["perps", "leverage"], triggers: ["quote a 5x long"] },

  // Intelligence / research
  { name: "Full Token Report", category: "intelligence", kind: "analysis", level: "core", summary: "Complete token briefing: identity, market, safety, holders, forensics, links.", toolIds: ["og-scan-token", "token-data", "token-safety", "og-holders", "jupiter-price", "birdseye-analytics", "ogdex-intel-v2", "ogdex-xray", "ogdex-firstbuyer", "enhanced-intelligence"], agentId: "token", tags: ["report", "token"], triggers: ["tell me about this token", "full report on CA"] },
  { name: "Token Metadata Lookup", category: "intelligence", kind: "analysis", level: "core", summary: "Fetch on-chain and market metadata for a mint.", toolIds: ["token-data"], agentId: "token", tags: ["metadata"], triggers: ["token info"] },
  { name: "Holder Distribution", category: "intelligence", kind: "analysis", summary: "Analyze holder concentration, cohorts, and smart-money overlap.", toolIds: ["og-holders", "token-data"], agentId: "holder", tags: ["holders"], triggers: ["who holds this"] },
  { name: "First Buyer Trace", category: "intelligence", kind: "analysis", summary: "Identify early buyers and sniper wallets with timestamps.", toolIds: ["ogdex-firstbuyer", "solana-tracker"], agentId: "first-buyer", tags: ["snipers"], triggers: ["first buyers of this"] },
  { name: "Wallet Deep Dive", category: "intelligence", kind: "analysis", summary: "Profile a wallet's holdings, PnL, and behavior.", toolIds: ["og-wallet", "wallet-manager", "pnl-scan", "solana-tracker"], agentId: "wallet", tags: ["wallet"], triggers: ["analyze this wallet"] },
  { name: "Unified Intelligence Briefing", category: "intelligence", kind: "analysis", summary: "Aggregate multi-source intel into a single briefing.", toolIds: ["unified-intelligence", "token-data", "og-wallet"], agentId: "unified-intel-agent", tags: ["intel"], triggers: ["give me the full intel"] },
  { name: "Enhanced AI Intel", category: "intelligence", kind: "analysis", summary: "Deep AI-enriched intelligence pass with narrative synthesis.", toolIds: ["enhanced-intelligence", "ai-analyzer"], agentId: "enhanced-intel-agent", tags: ["ai", "intel"], triggers: ["deep intel on this"] },
  { name: "OGDEX X-Ray", category: "intelligence", kind: "analysis", summary: "X-ray token mechanics, flows, and anomalies.", toolIds: ["ogdex-xray"], agentId: "ogdex-intel-agent", tags: ["xray"], triggers: ["x-ray this token"] },
  { name: "Compare Two Tokens", category: "intelligence", kind: "analysis", summary: "Side-by-side structured comparison of two tokens.", toolIds: ["token-data", "enhanced-intelligence", "jupiter-price"], agentId: "intel-comparator", tags: ["compare"], triggers: ["compare A vs B"] },
  { name: "Transaction Explainer", category: "intelligence", kind: "analysis", summary: "Decode a Solana transaction's instructions and token flows.", toolIds: ["solana-tracker", "ai-analyzer", "wallet-manager"], agentId: "tx-explainer", tags: ["tx"], triggers: ["what did this tx do"] },
  { name: "Wallet Labeler", category: "intelligence", kind: "analysis", summary: "Suggest entity labels for a wallet from public intel.", toolIds: ["og-wallet", "solana-tracker", "ai-analyzer"], agentId: "wallet-labeler", tags: ["labels"], triggers: ["who is this wallet"] },
  { name: "PnL Attribution", category: "intelligence", kind: "analysis", summary: "Break down realized and unrealized PnL per token.", toolIds: ["pnl-scan", "og-wallet", "jupiter-price"], agentId: "wallet-pnl-deep", tags: ["pnl"], triggers: ["pnl for this wallet"] },
  { name: "Research PDF Report", category: "intelligence", kind: "analysis", summary: "Generate a downloadable PDF research report.", toolIds: ["og-report-pdf", "enhanced-intelligence", "token-data"], agentId: "report", tags: ["pdf", "report"], triggers: ["make a pdf report"] },
  { name: "News Digest", category: "intelligence", kind: "analysis", summary: "Curate relevant crypto and Solana news with sources.", toolIds: ["news-fetcher", "ai-analyzer"], agentId: "news", tags: ["news"], triggers: ["latest news on this"] },

  // Security
  { name: "Token Safety Scan", category: "security", kind: "analysis", level: "core", summary: "Run honeypot, mint/freeze authority, and risk heuristics.", toolIds: ["token-safety", "og-scan-token"], agentId: "security", tags: ["safety"], triggers: ["is this safe", "honeypot check"] },
  { name: "Rug Pull Detector", category: "security", kind: "analysis", summary: "Detect rug, liquidity-pull, and exit-scam patterns early.", toolIds: ["token-safety", "ogdex-xray", "og-scan-token", "oxw-token-scan"], agentId: "rug-detection", tags: ["rug"], triggers: ["will this rug"] },
  { name: "Mint Authority Check", category: "security", kind: "analysis", summary: "Verify mint authority renounced or flagged.", toolIds: ["token-safety", "token-data"], agentId: "mint-authority", tags: ["mint"], triggers: ["is mint renounced"] },
  { name: "Freeze Authority Check", category: "security", kind: "analysis", summary: "Report freeze authority and transfer-restriction risk.", toolIds: ["token-safety", "token-data"], agentId: "freeze-authority", tags: ["freeze"], triggers: ["can they freeze this"] },
  { name: "LP Lock Analysis", category: "security", kind: "analysis", summary: "Assess LP lock quality and imminent unlock risk.", toolIds: ["ogdex-intel-v2", "token-safety", "ogdex-xray"], agentId: "lp-lock", tags: ["lp"], triggers: ["is liquidity locked"] },
  { name: "Bundle Detection", category: "security", kind: "analysis", summary: "Detect bundled launches and coordinated wallet clusters.", toolIds: ["ogdex-xray", "og-holders", "ogdex-firstbuyer"], agentId: "bundle-detect", tags: ["bundle"], triggers: ["is this bundled"] },
  { name: "Sniper Detection", category: "security", kind: "analysis", summary: "Flag sniper bots and MEV-adjacent entry patterns.", toolIds: ["ogdex-firstbuyer", "solana-tracker", "og-wallet"], agentId: "sniper-detect", tags: ["snipers"], triggers: ["snipers in this"] },
  { name: "Dev Wallet Watch", category: "security", kind: "analysis", summary: "Track deployer/team wallets for dumps and authority changes.", toolIds: ["og-wallet", "token-safety", "solana-tracker"], agentId: "dev", tags: ["dev"], triggers: ["watch the dev wallet"] },
  { name: "Composite Risk Score", category: "security", kind: "analysis", summary: "Produce a composite risk score with transparent factor weights.", toolIds: ["token-safety", "og-holders", "ogdex-intel-v2"], agentId: "risk-scorer", tags: ["risk"], triggers: ["risk score this"] },
  { name: "Security Audit Pass", category: "security", kind: "analysis", summary: "Layered safety audit combining multiple scan passes.", toolIds: ["token-safety", "oxw-token-scan", "og-scan-token", "ogdex-xray"], agentId: "security-audit", tags: ["audit"], triggers: ["full security audit"] },
  { name: "Approval Risk Review", category: "security", kind: "analysis", summary: "List token delegate approvals and flag drain risk.", toolIds: ["wallet-approvals"], agentId: "wallet", tags: ["approvals"], triggers: ["check my approvals"] },
  { name: "Revoke Risky Approval", category: "security", kind: "action", summary: "Prepare a revoke transaction for a risky delegate.", toolIds: ["revoke-approval", "wallet-approvals"], agentId: "wallet", tags: ["revoke"], triggers: ["revoke this approval"] },

  // Wallet / portfolio
  { name: "Portfolio Snapshot", category: "portfolio", kind: "analysis", level: "core", summary: "Full portfolio breakdown with allocations and USD value.", toolIds: ["wallet-portfolio", "jupiter-price"], agentId: "portfolio", tags: ["portfolio"], triggers: ["show my portfolio"] },
  { name: "Portfolio PnL", category: "portfolio", kind: "analysis", summary: "Aggregate realized and unrealized PnL across holdings.", toolIds: ["pnl-scan", "wallet-manager", "jupiter-price"], agentId: "pnl", tags: ["pnl"], triggers: ["my pnl"] },
  { name: "Concentration Risk", category: "portfolio", kind: "analysis", summary: "Flag over-concentration and correlated exposure.", toolIds: ["wallet-portfolio", "correlation-matrix"], agentId: "portfolio", tags: ["risk"], triggers: ["am I too concentrated"] },
  { name: "Rebalance Plan", category: "portfolio", kind: "analysis", summary: "Build a target-allocation rebalance plan as quote-only steps.", toolIds: ["rebalance-plan", "jupiter-quote"], agentId: "portfolio", tags: ["rebalance"], triggers: ["rebalance my bag"] },
  { name: "Tax Summary", category: "wallet", kind: "analysis", summary: "Estimate realized gains/losses and a tax-style summary.", toolIds: ["wallet-tax"], agentId: "wallet", tags: ["tax"], triggers: ["tax report"] },
  { name: "Airdrop Eligibility", category: "wallet", kind: "analysis", summary: "Check wallet eligibility across known airdrops.", toolIds: ["airdrop-checker"], agentId: "wallet", tags: ["airdrop"], triggers: ["any airdrops for me"] },
  { name: "Wallet Balance Check", category: "wallet", kind: "analysis", level: "core", summary: "Read wallet balances, token accounts, and connection state.", toolIds: ["wallet-manager"], agentId: "wallet", tags: ["balance"], triggers: ["my balance"] },

  // DeFi
  { name: "Yield Finder", category: "defi", kind: "analysis", level: "core", summary: "Scan staking, lending, and LP yields across Solana.", toolIds: ["yield-scan"], agentId: "strategy", tags: ["yield", "apy"], triggers: ["best yields on SOL"] },
  { name: "Supply to Lending Market", category: "defi", kind: "action", summary: "Prepare a supply/deposit into Kamino/Solend.", toolIds: ["lend-supply", "yield-scan"], agentId: "strategy", tags: ["lend"], triggers: ["supply USDC to earn"] },
  { name: "Borrow Against Collateral", category: "defi", kind: "action", summary: "Prepare a borrow against supplied collateral.", toolIds: ["lend-borrow"], agentId: "strategy", tags: ["borrow"], triggers: ["borrow against my SOL"] },
  { name: "Add Liquidity", category: "defi", kind: "action", summary: "Prepare an add-liquidity transaction for an AMM pool.", toolIds: ["lp-add", "jupiter-price"], agentId: "liquidity", tags: ["lp"], triggers: ["add liquidity to pool"] },
  { name: "Remove Liquidity", category: "defi", kind: "action", summary: "Prepare a remove-liquidity transaction for an AMM pool.", toolIds: ["lp-remove"], agentId: "liquidity", tags: ["lp"], triggers: ["pull my liquidity"] },
  { name: "Bridge Route Quote", category: "defi", kind: "analysis", summary: "Quote a cross-chain bridge route, fees, and ETA.", toolIds: ["bridge-quote"], agentId: "solana", tags: ["bridge"], triggers: ["bridge to Solana"] },

  // Social
  { name: "Sentiment Read", category: "social", kind: "analysis", level: "core", summary: "Aggregate social sentiment for a token from public sources.", toolIds: ["sentiment-scan", "news-fetcher"], agentId: "social", tags: ["sentiment"], triggers: ["sentiment on this"] },
  { name: "X Mentions Scan", category: "social", kind: "analysis", summary: "Search recent X posts and mentions for a token or query.", toolIds: ["twitter-search"], agentId: "social", tags: ["x", "twitter"], triggers: ["what's X saying"] },
  { name: "KOL Tracker", category: "social", kind: "analysis", summary: "Surface KOL mentions and their historical accuracy.", toolIds: ["kol-mentions", "og-wallet"], agentId: "kol-tracker", tags: ["kol"], triggers: ["which KOLs called this"] },
  { name: "Draft X Post", category: "social", kind: "analysis", summary: "Draft an X post from verified intel without publishing.", toolIds: ["ai-analyzer", "news-fetcher"], agentId: "x-drafter", tags: ["draft"], triggers: ["draft a tweet about this"] },
  { name: "Publish X Post", category: "social", kind: "action", summary: "Publish an X post on explicit user confirmation.", toolIds: ["post-to-x"], agentId: "x-agent", tags: ["post"], triggers: ["post this to X"] },
  { name: "Schedule X Post", category: "social", kind: "action", summary: "Schedule an X post via OrbitX templates.", toolIds: ["x-poster", "ai-analyzer"], agentId: "x-scheduler", tags: ["schedule"], triggers: ["schedule this post"] },

  // Create
  { name: "Launch a Coin", category: "create", kind: "action", level: "core", summary: "Draft a pump.fun / OrbitX launch — returns a sign/open preview only.", toolIds: ["launch-coin"], agentId: "launch", tags: ["launch", "coin"], triggers: ["launch a coin named X"] },
  { name: "Mint an NFT", category: "create", kind: "action", summary: "Draft a Metaplex NFT mint — returns a wallet-sign preview only.", toolIds: ["nft-mint"], agentId: "nft", tags: ["nft", "mint"], triggers: ["mint an NFT called X"] },
  { name: "List NFT for Sale", category: "create", kind: "action", summary: "Build an NFT sale/listing transaction for wallet signing.", toolIds: ["nft-execute-sale", "wallet-manager"], agentId: "nft-sales", tags: ["nft", "sale"], triggers: ["list my NFT"] },
  { name: "Generate Report Card", category: "create", kind: "analysis", summary: "Emit structured card data for tokens, wallets, and transactions.", toolIds: ["token-data", "wallet-manager", "jupiter-price"], agentId: "ui-generation", tags: ["card"], triggers: ["make a token card"] },

  // Monitor / alerts
  { name: "Create Price Alert", category: "monitor", kind: "automation", level: "core", summary: "Create a price threshold alert with push delivery.", toolIds: ["alerts", "jupiter-price", "send-push"], agentId: "alert-price", tags: ["alert", "price"], triggers: ["alert me at price"] },
  { name: "Create Wallet Alert", category: "monitor", kind: "automation", summary: "Alert on wallet activity and balance changes.", toolIds: ["alerts", "solana-tracker", "send-push"], agentId: "alert-wallet", tags: ["alert", "wallet"], triggers: ["alert on this wallet"] },
  { name: "Create Migration Alert", category: "monitor", kind: "automation", summary: "Alert before and after bonding-curve/AMM migrations.", toolIds: ["alerts", "migration-watch", "pumpfun-migrations"], agentId: "alert-migration", tags: ["alert", "migration"], triggers: ["alert on migration"] },
  { name: "Migration Watch", category: "monitor", kind: "analysis", summary: "Monitor token migration events across launchpads.", toolIds: ["migration-watch", "pumpfun-migrations", "token-data"], agentId: "migration-specialist", tags: ["migration"], triggers: ["migration status"] },
  { name: "Bonding Curve Tracker", category: "monitor", kind: "analysis", summary: "Track pump.fun curve fill % and migration proximity.", toolIds: ["pumpfun-migrations", "migration-watch", "token-data"], agentId: "bonding-curve", tags: ["curve"], triggers: ["curve progress"] },
  { name: "Trending Screener", category: "monitor", kind: "analysis", level: "core", summary: "Screen trending tokens by liquidity, volume, and safety.", toolIds: ["birdseye-analytics", "token-safety", "jupiter-price"], agentId: "dex-screener", tags: ["trending", "screen"], triggers: ["what's trending", "show me runners"] },
  { name: "Sector Rotation Signal", category: "monitor", kind: "analysis", summary: "Identify sector flows and rotation across Solana.", toolIds: ["birdseye-analytics", "unified-intelligence"], agentId: "sector-rotation", tags: ["sector"], triggers: ["sector rotation"] },
  { name: "Whale Flow Monitor", category: "monitor", kind: "analysis", summary: "Track large-holder accumulation and distribution.", toolIds: ["og-holders", "og-wallet", "solana-tracker"], agentId: "whale", tags: ["whale"], triggers: ["whale activity"] },
  { name: "Track Record Lookup", category: "monitor", kind: "analysis", summary: "Historical performance and call accuracy for signals/agents.", toolIds: ["track-record", "ai-analyzer"], agentId: "track-record-analyst", tags: ["record"], triggers: ["track record of this"] },
  { name: "Send Push Notification", category: "monitor", kind: "automation", summary: "Send a push notification within automation limits.", toolIds: ["send-push"], agentId: "push-notify", tags: ["push"], triggers: ["push me a reminder"] },

  // Knowledge
  { name: "Explain a Term", category: "knowledge", kind: "knowledge", level: "core", summary: "Define crypto, Solana, and DeFi terms in plain language.", toolIds: ["glossary-lookup"], agentId: "memory", tags: ["glossary"], triggers: ["what is slippage"] },
  { name: "How OrbitX Works", category: "knowledge", kind: "knowledge", level: "core", summary: "Explain OrbitX capabilities, permissions, and the sign-to-execute model.", toolIds: ["knowledge-base"], agentId: "permission", tags: ["orbitx"], triggers: ["how does OrbitX work"] },
  { name: "Wallet Security 101", category: "knowledge", kind: "knowledge", summary: "Best practices: seed phrase safety, approvals, and phishing.", toolIds: ["knowledge-base"], agentId: "security", tags: ["security"], triggers: ["how do I stay safe"] },
  { name: "Reading a Token Chart", category: "knowledge", kind: "knowledge", summary: "How to read candles, volume, and market structure.", toolIds: ["knowledge-base"], agentId: "vision", tags: ["charting"], triggers: ["how to read a chart"] },
  { name: "Understand Permission Modes", category: "knowledge", kind: "knowledge", summary: "Explain read-only, confirm-every-action, and limited-automation.", toolIds: ["knowledge-base"], agentId: "permission", tags: ["permissions"], triggers: ["what are the permission modes"] },
];

// ── Templated expansions (all reference real tools) ─────────────────────
const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"] as const;
const TA: Array<{ name: string; tool: string; tag: string }> = [
  { name: "RSI", tool: "technical-indicators", tag: "rsi" },
  { name: "MACD", tool: "technical-indicators", tag: "macd" },
  { name: "EMA Cross", tool: "technical-indicators", tag: "ema" },
  { name: "Bollinger Bands", tool: "technical-indicators", tag: "bollinger" },
  { name: "VWAP", tool: "technical-indicators", tag: "vwap" },
  { name: "Volume Profile", tool: "volume-profile", tag: "volume" },
  { name: "Candle Patterns", tool: "candle-patterns", tag: "patterns" },
];

const TA_SEEDS: Seed[] = TA.flatMap((ind) =>
  TIMEFRAMES.map((tf) => ({
    name: `${ind.name} Read ${tf}`,
    category: "intelligence" as SkillCategory,
    kind: "analysis" as SkillKind,
    level: "advanced" as SkillLevel,
    summary: `Compute ${ind.name} on the ${tf} timeframe and read the signal.`,
    toolIds: [ind.tool, "chart-data"],
    agentId: "vision",
    tags: ["ta", ind.tag, tf],
    triggers: [`${ind.name.toLowerCase()} on ${tf}`],
  })),
);

const PROTOCOLS = [
  "Jupiter", "Raydium", "Orca", "Meteora", "Kamino", "MarginFi", "Solend",
  "Marinade", "Jito", "Drift", "Zeta", "Phoenix", "Pump.fun", "Tensor",
  "Magic Eden", "Metaplex", "Squads", "Helius", "Pyth", "Switchboard",
  "Wormhole", "Sanctum",
];
const PROTOCOL_SEEDS: Seed[] = PROTOCOLS.map((p) => ({
  name: `Explain ${p}`,
  category: "knowledge",
  kind: "knowledge",
  level: "advanced",
  summary: `Explain how ${p} works on Solana, its mechanics, and its risks.`,
  toolIds: ["protocol-explainer", "knowledge-base"],
  agentId: "solana",
  tags: ["protocol", p.toLowerCase().replace(/[^a-z0-9]+/g, "")],
  triggers: [`how does ${p} work`, `explain ${p}`],
}));

const TERMS = [
  "Slippage", "Liquidity", "Market Cap", "FDV", "Bonding Curve", "Honeypot",
  "Mint Authority", "Freeze Authority", "LP Lock", "Rug Pull", "Impermanent Loss",
  "APY vs APR", "Staking", "Liquid Staking", "Perpetuals", "Funding Rate",
  "Liquidation", "Whale", "Smart Money", "MEV", "Sandwich Attack", "Sniper",
  "Airdrop", "Vesting", "Emissions", "TVL", "Oracle", "Priority Fee",
  "Compute Units", "Program Derived Address",
];
const TERM_SEEDS: Seed[] = TERMS.map((t) => ({
  name: `Define ${t}`,
  category: "knowledge",
  kind: "knowledge",
  level: "core",
  summary: `Plain-language definition and Solana context for ${t}.`,
  toolIds: ["glossary-lookup"],
  agentId: "memory",
  tags: ["glossary", t.toLowerCase().replace(/[^a-z0-9]+/g, "")],
  triggers: [`what is ${t.toLowerCase()}`, `define ${t.toLowerCase()}`],
}));

const LSTS = [
  { name: "Marinade mSOL", tag: "msol" },
  { name: "Jito jitoSOL", tag: "jitosol" },
  { name: "BlazeStake bSOL", tag: "bsol" },
  { name: "Sanctum INF", tag: "inf" },
  { name: "Jupiter jupSOL", tag: "jupsol" },
];
const STAKE_SEEDS: Seed[] = LSTS.map((l) => ({
  name: `Stake into ${l.name}`,
  category: "defi",
  kind: "action",
  level: "advanced",
  summary: `Prepare a liquid-staking deposit into ${l.name} for wallet signing.`,
  toolIds: ["stake-sol", "yield-scan"],
  agentId: "strategy",
  tags: ["staking", "lst", l.tag],
  triggers: [`stake into ${l.name}`],
}));

const CHAINS = ["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "BSC", "Avalanche"];
const BRIDGE_SEEDS: Seed[] = CHAINS.map((c) => ({
  name: `Bridge from ${c}`,
  category: "defi",
  kind: "analysis",
  level: "advanced",
  summary: `Quote a bridge route from ${c} to Solana with fees and ETA.`,
  toolIds: ["bridge-quote"],
  agentId: "solana",
  tags: ["bridge", c.toLowerCase()],
  triggers: [`bridge from ${c} to Solana`],
}));

const SECTORS = ["AI", "DePIN", "Memecoins", "DeFi", "Gaming", "RWA", "LSD", "NFT", "Payments", "Social"];
const SECTOR_SEEDS: Seed[] = SECTORS.map((s) => ({
  name: `${s} Sector Screen`,
  category: "monitor",
  kind: "analysis",
  level: "advanced",
  summary: `Screen the ${s} sector for movers by liquidity, volume, and safety.`,
  toolIds: ["birdseye-analytics", "token-safety", "jupiter-price"],
  agentId: "dex-screener",
  tags: ["sector", s.toLowerCase()],
  triggers: [`screen ${s} tokens`],
}));

const ALERT_KINDS = [
  { name: "Price Above", tag: "above" },
  { name: "Price Below", tag: "below" },
  { name: "Percent Move", tag: "move" },
  { name: "Volume Spike", tag: "volume" },
  { name: "New All-Time High", tag: "ath" },
  { name: "Wallet Buy", tag: "buy" },
  { name: "Wallet Sell", tag: "sell" },
  { name: "LP Unlock", tag: "unlock" },
  { name: "Dev Sell", tag: "devsell" },
  { name: "Whale Inflow", tag: "inflow" },
  { name: "Whale Outflow", tag: "outflow" },
  { name: "Migration Ready", tag: "migration" },
];
const ALERT_SEEDS: Seed[] = ALERT_KINDS.map((a) => ({
  name: `${a.name} Alert`,
  category: "monitor",
  kind: "automation",
  level: "advanced",
  summary: `Create a "${a.name}" alert and deliver it via push.`,
  toolIds: ["alerts", "send-push"],
  agentId: "alert",
  tags: ["alert", a.tag],
  triggers: [`alert me on ${a.name.toLowerCase()}`],
}));

const SCAN_ASSETS = [
  "SOL", "USDC", "BONK", "WIF", "JUP", "JTO", "PYTH", "RAY", "ORCA", "MSOL",
];
const PRICE_SEEDS: Seed[] = SCAN_ASSETS.map((a) => ({
  name: `${a} Price Check`,
  category: "trading",
  kind: "analysis",
  level: "core",
  summary: `Fetch the live ${a} price and recent change via Jupiter.`,
  toolIds: ["jupiter-price", "chart-data"],
  agentId: "price-oracle",
  tags: ["price", a.toLowerCase()],
  triggers: [`price of ${a}`],
}));

const SCREEN_METRICS = [
  "Top Gainers", "Top Losers", "New Pairs", "High Volume", "Low FDV",
  "High Liquidity", "Most Holders", "Recently Migrated", "Trending on X",
  "Smart Money Buys",
];
const SCREEN_SEEDS: Seed[] = SCREEN_METRICS.map((m) => ({
  name: `Screen ${m}`,
  category: "monitor",
  kind: "analysis",
  level: "advanced",
  summary: `Screen the market for ${m} with safety and liquidity context.`,
  toolIds: ["birdseye-analytics", "jupiter-price", "token-safety"],
  agentId: "dex-screener",
  tags: ["screen", m.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
  triggers: [`show me ${m.toLowerCase()}`],
}));

const RISK_PATTERNS = [
  "a Rug", "a Honeypot", "a Bundle", "a Sniper Cluster", "a Dev Dump",
  "Fake Volume", "Wash Trading", "an LP Pull", "a Freeze Trap", "a Sybil Cluster",
];
const RISK_KNOWLEDGE_SEEDS: Seed[] = RISK_PATTERNS.map((p) => ({
  name: `How to Spot ${p}`,
  category: "knowledge",
  kind: "knowledge",
  level: "advanced",
  summary: `Learn the on-chain signals that reveal ${p} before you ape.`,
  toolIds: ["knowledge-base"],
  agentId: "rug-detection",
  tags: ["risk", "education", p.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
  triggers: [`how do I spot ${p.replace(/^(a |an )/, "").toLowerCase()}`],
}));

const STRATEGIES = [
  "Breakout", "Mean Reversion", "Momentum", "Scalping", "Swing", "Grid",
  "DCA", "Range", "Trend Following", "Liquidity Sniping",
];
const STRATEGY_SEEDS: Seed[] = STRATEGIES.map((s) => ({
  name: `${s} Strategy Playbook`,
  category: "knowledge",
  kind: "knowledge",
  level: "expert",
  summary: `Rules, entries, exits, and risk for a ${s} strategy on Solana.`,
  toolIds: ["strategy-library", "ai-analyzer"],
  agentId: "strategy",
  tags: ["strategy", s.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
  triggers: [`${s.toLowerCase()} strategy`],
}));

const PORTFOLIO_VIEWS = [
  "Allocation", "Diversification", "Drawdown", "Win Rate", "Best Trade",
  "Worst Trade", "Realized PnL", "Unrealized PnL",
];
const PORTFOLIO_SEEDS: Seed[] = PORTFOLIO_VIEWS.map((v) => ({
  name: `Portfolio ${v}`,
  category: "portfolio",
  kind: "analysis",
  level: "advanced",
  summary: `Compute and explain your portfolio ${v}.`,
  toolIds: ["wallet-portfolio", "pnl-scan", "jupiter-price"],
  agentId: "portfolio",
  tags: ["portfolio", v.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
  triggers: [`my ${v.toLowerCase()}`],
}));

const WALLET_WINDOWS = ["24h", "7d", "30d", "90d", "All-Time"];
const WALLET_ACTIVITY_SEEDS: Seed[] = WALLET_WINDOWS.map((w) => ({
  name: `Wallet Activity ${w}`,
  category: "wallet",
  kind: "analysis",
  level: "advanced",
  summary: `Summarize a wallet's on-chain activity over the ${w} window.`,
  toolIds: ["solana-tracker", "og-wallet", "pnl-scan"],
  agentId: "wallet",
  tags: ["activity", w.toLowerCase()],
  triggers: [`wallet activity last ${w}`],
}));

const NEWS_TOPICS = [
  "Solana", "Bitcoin", "Macro", "Regulation", "Airdrops", "Hacks", "Listings",
];
const NEWS_SEEDS: Seed[] = NEWS_TOPICS.map((t) => ({
  name: `${t} News Brief`,
  category: "intelligence",
  kind: "analysis",
  level: "core",
  summary: `Curate the latest ${t} news with sources and recency.`,
  toolIds: ["news-fetcher", "ai-analyzer"],
  agentId: "news",
  tags: ["news", t.toLowerCase()],
  triggers: [`${t.toLowerCase()} news`],
}));

const built = build([
  ...CURATED,
  ...TA_SEEDS,
  ...PROTOCOL_SEEDS,
  ...TERM_SEEDS,
  ...STAKE_SEEDS,
  ...BRIDGE_SEEDS,
  ...SECTOR_SEEDS,
  ...ALERT_SEEDS,
  ...PRICE_SEEDS,
  ...SCREEN_SEEDS,
  ...RISK_KNOWLEDGE_SEEDS,
  ...STRATEGY_SEEDS,
  ...PORTFOLIO_SEEDS,
  ...WALLET_ACTIVITY_SEEDS,
  ...NEWS_SEEDS,
]);

/** The 250 skills the OrbitX agent can perform. */
export const SKILLS: readonly SkillDefinition[] = Object.freeze(
  built.slice(0, SKILL_TARGET),
);

/** Actual number of registered skills (== SKILL_TARGET). */
export const SKILL_COUNT = SKILLS.length;

const SKILL_MAP = new Map<string, SkillDefinition>(
  SKILLS.map((s) => [s.id, s]),
);

export function getSkill(id: string): SkillDefinition | undefined {
  return SKILL_MAP.get(id);
}

export function skillsByCategory(category?: SkillCategory): SkillDefinition[] {
  if (!category) {
    return [...SKILLS];
  }
  return SKILLS.filter((s) => s.category === category);
}

export function skillsByKind(kind: SkillKind): SkillDefinition[] {
  return SKILLS.filter((s) => s.kind === kind);
}

export function searchSkills(query: string, limit = 12): SkillDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return SKILLS.slice(0, limit);
  }
  return SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.tags.some((tag) => tag.includes(q)) ||
      s.triggers.some((t) => t.toLowerCase().includes(q)),
  ).slice(0, limit);
}

export type SkillCategoryCount = { category: SkillCategory; count: number };

export function skillCategoryCounts(): SkillCategoryCount[] {
  const counts = new Map<SkillCategory, number>();
  for (const s of SKILLS) {
    counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

/**
 * Compact capability index handed to the orchestrator so the backend brain
 * knows which skills exist. Kept small (id + name + category) to bound token cost.
 */
export function skillCapabilityIndex(): string {
  return SKILLS.map((s) => `${s.id}:${s.category}`).join(",");
}
