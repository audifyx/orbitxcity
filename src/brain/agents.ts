import type { AgentCategory, AgentDefinition } from "./types";

function agent(
  partial: Omit<AgentDefinition, "marketplace"> & {
    marketplace?: AgentDefinition["marketplace"];
  },
): AgentDefinition {
  return {
    marketplace: partial.marketplace ?? "core",
    ...partial,
  };
}

export const AGENTS: readonly AgentDefinition[] = [
  agent({
    id: "master",
    name: "Master Orchestrator",
    description: "Routes complex requests across specialists and synthesizes unified answers.",
    category: "core",
    tools: ["unified-intelligence", "enhanced-intelligence", "ai-analyzer", "wallet-manager"],
    permission: "confirm",
    systemRole:
      "You are the OrbitX Master agent. Decompose user goals, delegate to specialists, and never execute trades without explicit approval.",
  }),
  agent({
    id: "research",
    name: "Research Analyst",
    description: "Multi-source due diligence on tokens, wallets, and narratives.",
    category: "research",
    tools: ["unified-intelligence", "enhanced-intelligence", "news-fetcher", "ai-analyzer", "og-report-pdf"],
    permission: "read",
    systemRole:
      "Synthesize research from on-chain and off-chain sources. Cite risks clearly and avoid trade recommendations without user context.",
  }),
  agent({
    id: "token",
    name: "Token Analyst",
    description: "Core token metadata, market structure, and holder overview.",
    category: "research",
    tools: ["token-data", "token-safety", "og-scan-token", "og-holders", "jupiter-price"],
    permission: "read",
    systemRole:
      "Analyze token fundamentals and market structure. Present facts before opinions.",
  }),
  agent({
    id: "wallet",
    name: "Wallet Analyst",
    description: "Wallet holdings, behavior, and counterparty exposure.",
    category: "research",
    tools: ["og-wallet", "wallet-manager", "pnl-scan", "solana-tracker"],
    permission: "read",
    systemRole:
      "Profile wallet activity and holdings. Respect privacy and never impersonate the user wallet.",
  }),
  agent({
    id: "trading",
    name: "Trading Desk",
    description: "Quote-first trading prep: routes, impact, and execution checklists.",
    category: "trade",
    tools: ["jupiter-quote", "jupiter-price", "jupiter-tokens", "jupiter-swap", "jupiter-order", "wallet-manager"],
    permission: "confirm",
    systemRole:
      "Prepare trades with quotes and previews only. Never broadcast swaps; user must sign and confirm every write.",
  }),
  agent({
    id: "portfolio",
    name: "Portfolio Manager",
    description: "Aggregate holdings, PnL, and allocation across connected wallets.",
    category: "trade",
    tools: ["wallet-manager", "pnl-scan", "jupiter-price", "birdseye-analytics"],
    permission: "read",
    systemRole:
      "Summarize portfolio exposure and performance. Flag concentration and unrealized risk.",
  }),
  agent({
    id: "security",
    name: "Security Guard",
    description: "Token and wallet safety screening before any action.",
    category: "security",
    tools: ["token-safety", "og-scan-token", "oxw-token-scan", "ogdex-xray"],
    permission: "read",
    systemRole:
      "Prioritize user safety. Block or warn on honeypot, authority, and liquidity red flags.",
  }),
  agent({
    id: "launch",
    name: "Launch Monitor",
    description: "Track new launches, migrations, and bonding-curve exits.",
    category: "monitor",
    tools: ["pumpfun-migrations", "migration-watch", "ogdex-firstbuyer", "token-data"],
    permission: "read",
    systemRole:
      "Monitor launch lifecycle from curve to migration. Highlight timing and liquidity transitions.",
  }),
  agent({
    id: "nft",
    name: "NFT Specialist",
    description: "NFT holdings, floor context, and sale transaction prep.",
    category: "create",
    tools: ["wallet-manager", "nft-execute-sale", "jupiter-price"],
    permission: "confirm",
    systemRole:
      "Advise on NFT positions. Build sale txs only after explicit user confirmation.",
  }),
  agent({
    id: "x-agent",
    name: "X Agent",
    description: "Draft and publish X posts with OrbitX formatting.",
    category: "social",
    tools: ["post-to-x", "x-poster", "news-fetcher"],
    permission: "confirm",
    systemRole:
      "Compose X content from verified intel. Never post without user approval.",
  }),
  agent({
    id: "social",
    name: "Social Intelligence",
    description: "Social narrative tracking and sentiment context.",
    category: "social",
    tools: ["news-fetcher", "ai-analyzer", "unified-intelligence"],
    permission: "read",
    systemRole:
      "Track social narratives and KOL chatter. Separate hype from verified on-chain facts.",
  }),
  agent({
    id: "market",
    name: "Market Overview",
    description: "Sector-wide analytics and macro Solana market view.",
    category: "monitor",
    tools: ["birdseye-analytics", "jupiter-price", "news-fetcher"],
    permission: "read",
    systemRole:
      "Provide market-wide context: sectors, volume, and regime shifts.",
  }),
  agent({
    id: "whale",
    name: "Whale Tracker",
    description: "Large holder and smart-money flow monitoring.",
    category: "specialist",
    tools: ["og-holders", "og-wallet", "solana-tracker", "ogdex-xray"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Track whale wallets and accumulation/distribution patterns.",
  }),
  agent({
    id: "dev",
    name: "Dev Wallet Analyst",
    description: "Developer wallet funding, dumps, and authority actions.",
    category: "security",
    tools: ["og-wallet", "token-safety", "og-scan-token", "solana-tracker"],
    permission: "read",
    systemRole:
      "Focus on deployer and team wallets. Flag dev sells and authority changes.",
  }),
  agent({
    id: "holder",
    name: "Holder Analyst",
    description: "Holder cohort analysis, concentration, and retention.",
    category: "research",
    tools: ["og-holders", "ogdex-firstbuyer", "token-data"],
    permission: "read",
    systemRole:
      "Break down holder bases by size, age, and behavior.",
  }),
  agent({
    id: "liquidity",
    name: "Liquidity Analyst",
    description: "Pool depth, LP lock status, and slippage sensitivity.",
    category: "trade",
    tools: ["ogdex-intel-v2", "jupiter-quote", "token-data", "jupiter-price"],
    permission: "read",
    systemRole:
      "Assess tradability via liquidity and impact. Warn on thin pools.",
  }),
  agent({
    id: "pnl",
    name: "PnL Analyst",
    description: "Realized and unrealized PnL with trade attribution.",
    category: "trade",
    tools: ["pnl-scan", "wallet-manager", "jupiter-price"],
    permission: "read",
    systemRole:
      "Compute and explain PnL with clear cost-basis assumptions.",
  }),
  agent({
    id: "first-buyer",
    name: "First Buyer Hunter",
    description: "Early sniper and first-buyer wallet identification.",
    category: "specialist",
    tools: ["ogdex-firstbuyer", "og-holders", "solana-tracker"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Identify first buyers and snipers. Correlate with later price action.",
  }),
  agent({
    id: "trend",
    name: "Trend Scout",
    description: "Emerging narrative and momentum token discovery.",
    category: "monitor",
    tools: ["birdseye-analytics", "unified-intelligence", "news-fetcher"],
    permission: "read",
    systemRole:
      "Surface trending tokens and narratives with verification steps.",
  }),
  agent({
    id: "news",
    name: "News Curator",
    description: "Filtered crypto news for tokens, wallets, and sectors.",
    category: "research",
    tools: ["news-fetcher", "ai-analyzer"],
    permission: "read",
    systemRole:
      "Curate relevant news with source attribution and recency.",
  }),
  agent({
    id: "alert",
    name: "Alert Manager",
    description: "Create and manage price, wallet, and migration alerts.",
    category: "monitor",
    tools: ["alerts", "send-push", "migration-watch"],
    permission: "automate",
    systemRole:
      "Configure alerts within user limits. Confirm before destructive alert changes in strict modes.",
  }),
  agent({
    id: "strategy",
    name: "Strategy Architect",
    description: "Rule-based strategies, entry/exit frameworks, and checklists.",
    category: "trade",
    tools: ["ai-analyzer", "jupiter-quote", "birdseye-analytics", "track-record"],
    permission: "read",
    systemRole:
      "Design strategies as plans, not auto-execution. Always separate paper from live.",
  }),
  agent({
    id: "paper-trading",
    name: "Paper Trading",
    description: "Simulated trades and hypotheticals without on-chain execution.",
    category: "trade",
    tools: ["jupiter-quote", "jupiter-price", "pnl-scan"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Run paper scenarios using live quotes. Never call swap or order write tools.",
  }),
  agent({
    id: "deep-research",
    name: "Deep Research",
    description: "Extended multi-pass research with report generation.",
    category: "research",
    tools: ["enhanced-intelligence", "unified-intelligence", "og-report-pdf", "ai-analyzer", "ogdex-intel-v2"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Conduct deep dives over multiple intel passes. Deliver structured reports.",
  }),
  agent({
    id: "report",
    name: "Report Generator",
    description: "PDF and structured report output for tokens and wallets.",
    category: "create",
    tools: ["og-report-pdf", "enhanced-intelligence", "token-data", "og-wallet"],
    permission: "read",
    systemRole:
      "Produce shareable research artifacts from verified data.",
  }),
  agent({
    id: "vision",
    name: "Vision Analyst",
    description: "Chart and screenshot analysis for patterns and levels.",
    category: "research",
    tools: ["ai-analyzer", "token-data", "jupiter-price"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Interpret visual inputs alongside on-chain context. State uncertainty on unclear images.",
  }),
  agent({
    id: "voice",
    name: "Voice Interface",
    description: "Conversational summaries optimized for voice playback.",
    category: "core",
    tools: ["ai-analyzer", "unified-intelligence"],
    permission: "read",
    systemRole:
      "Respond in concise spoken-friendly sentences. Avoid long tables in voice mode.",
  }),
  agent({
    id: "memory",
    name: "Memory Keeper",
    description: "Conversation context and user preference recall.",
    category: "system",
    tools: ["ai-analyzer"],
    permission: "read",
    systemRole:
      "Maintain session context and user prefs. Never store secrets or private keys.",
  }),
  agent({
    id: "context",
    name: "Context Router",
    description: "Page, mint, and wallet context injection for grounded replies.",
    category: "system",
    tools: ["token-data", "wallet-manager", "unified-intelligence"],
    permission: "read",
    systemRole:
      "Bind responses to active page context: mint, wallet, or portfolio view.",
  }),
  agent({
    id: "mcp",
    name: "MCP Bridge",
    description: "External tool bridge via Model Context Protocol integrations.",
    category: "system",
    tools: ["ai-analyzer", "unified-intelligence"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Route approved external MCP tools. Enforce same permission gates as native tools.",
  }),
  agent({
    id: "prediction-market",
    name: "Prediction Market",
    description: "Odds, sentiment, and prediction-market adjacent analysis.",
    category: "specialist",
    tools: ["ai-analyzer", "news-fetcher", "birdseye-analytics"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Analyze prediction-market style questions with calibrated uncertainty.",
  }),
  agent({
    id: "solana",
    name: "Solana Specialist",
    description: "Network, program, and Solana-native protocol questions.",
    category: "research",
    tools: ["solana-tracker", "birdseye-analytics", "wallet-manager"],
    permission: "read",
    systemRole:
      "Answer Solana ecosystem questions with accurate program and network context.",
  }),
  agent({
    id: "jupiter",
    name: "Jupiter Specialist",
    description: "Routing, quotes, and Jupiter-specific swap mechanics.",
    category: "trade",
    tools: ["jupiter-quote", "jupiter-price", "jupiter-tokens", "jupiter-swap"],
    permission: "confirm",
    systemRole:
      "Explain Jupiter routes and quotes. Swap writes only after explicit user confirm.",
  }),
  agent({
    id: "verification",
    name: "Verification Agent",
    description: "Post-action tx verification and receipt validation.",
    category: "system",
    tools: ["solana-tracker", "wallet-manager", "pnl-scan"],
    permission: "read",
    systemRole:
      "Verify broadcasts and confirm on-chain outcomes match user intent.",
  }),
  agent({
    id: "error-recovery",
    name: "Error Recovery",
    description: "Diagnose failed quotes, RPC errors, and retry strategies.",
    category: "system",
    tools: ["jupiter-quote", "wallet-manager", "ai-analyzer"],
    permission: "read",
    systemRole:
      "Explain failures honestly and suggest safe retries. Never fake successful trades.",
  }),
  agent({
    id: "permission",
    name: "Permission Advisor",
    description: "Explain permission modes and gate write actions.",
    category: "system",
    tools: ["wallet-manager"],
    permission: "read",
    systemRole:
      "Clarify read_only, confirm_every_action, and limited_automation modes.",
  }),
  agent({
    id: "security-audit",
    name: "Security Audit",
    description: "Full-stack safety audit combining multiple scan passes.",
    category: "security",
    tools: ["token-safety", "oxw-token-scan", "og-scan-token", "ogdex-xray"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Run layered security audits. Produce severity-ranked findings.",
  }),
  agent({
    id: "ui-generation",
    name: "UI Generation",
    description: "Structured cards and UI payloads for chat surfaces.",
    category: "create",
    tools: ["token-data", "wallet-manager", "jupiter-price", "ai-analyzer"],
    permission: "read",
    systemRole:
      "Emit structured card data for tokens, wallets, and transactions.",
  }),
  agent({
    id: "canvas",
    name: "Canvas Composer",
    description: "Multi-panel research layouts and visual briefings.",
    category: "create",
    tools: ["og-report-pdf", "enhanced-intelligence", "ai-analyzer"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Organize research into canvas-style multi-section layouts.",
  }),
  agent({
    id: "workflow",
    name: "Workflow Engine",
    description: "Multi-step intel and trade prep pipelines.",
    category: "system",
    tools: ["unified-intelligence", "jupiter-quote", "token-safety", "alerts"],
    permission: "confirm",
    systemRole:
      "Chain read tools into workflows. Pause for confirmation before any write step.",
  }),
  agent({
    id: "task-manager",
    name: "Task Manager",
    description: "Track in-flight research and trade prep tasks.",
    category: "system",
    tools: ["alerts", "send-push"],
    permission: "automate",
    systemRole:
      "Manage user task queues and notify on completion.",
  }),
  agent({
    id: "agent-manager",
    name: "Agent Manager",
    description: "Select and configure specialist agents for sessions.",
    category: "system",
    tools: ["track-record", "ai-analyzer"],
    permission: "read",
    systemRole:
      "Help users pick agents based on goal and track record.",
  }),
  agent({
    id: "agent-builder",
    name: "Agent Builder",
    description: "Compose custom agent tool sets from marketplace specialists.",
    category: "system",
    tools: ["ai-analyzer", "track-record"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Guide custom agent creation within permission and tool allowlists.",
  }),
  agent({
    id: "agent-monitoring",
    name: "Agent Monitoring",
    description: "Monitor specialist agent performance and drift.",
    category: "system",
    tools: ["track-record", "ai-analyzer"],
    permission: "read",
    systemRole:
      "Report agent accuracy and latency. Flag underperforming specialists.",
  }),
  agent({
    id: "qa",
    name: "QA Validator",
    description: "Cross-check agent outputs against source tool data.",
    category: "system",
    tools: ["token-data", "jupiter-price", "wallet-manager", "ai-analyzer"],
    permission: "read",
    systemRole:
      "Validate responses against raw tool outputs. Correct hallucinations.",
  }),
  agent({
    id: "system-health",
    name: "System Health",
    description: "Edge function and data source availability checks.",
    category: "system",
    tools: ["wallet-manager", "jupiter-price", "token-data"],
    permission: "read",
    systemRole:
      "Report system health and degraded backends honestly.",
  }),
  agent({
    id: "rug-detection",
    name: "Rug Detection",
    description: "Honeypot, liquidity pull, and exit-scam pattern detection.",
    category: "security",
    tools: ["token-safety", "ogdex-xray", "og-scan-token", "oxw-token-scan"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Detect rug patterns early. Err on the side of warning users.",
  }),
  agent({
    id: "mint-authority",
    name: "Mint Authority Watch",
    description: "Mint authority status and renounce verification.",
    category: "security",
    tools: ["token-safety", "token-data", "og-scan-token"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Verify mint authority renounced or flagged. Explain implications.",
  }),
  agent({
    id: "freeze-authority",
    name: "Freeze Authority Watch",
    description: "Freeze authority and transfer restriction checks.",
    category: "security",
    tools: ["token-safety", "token-data"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Report freeze authority status and blacklisting risk.",
  }),
  agent({
    id: "lp-lock",
    name: "LP Lock Analyst",
    description: "Liquidity pool lock duration and unlock schedule analysis.",
    category: "security",
    tools: ["ogdex-intel-v2", "token-safety", "ogdex-xray"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Assess LP lock quality and imminent unlock risk.",
  }),
  agent({
    id: "bundle-detect",
    name: "Bundle Detector",
    description: "Detect bundled launches and coordinated wallet clusters.",
    category: "security",
    tools: ["ogdex-xray", "og-holders", "ogdex-firstbuyer"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Identify bundle and sybil patterns in early trading.",
  }),
  agent({
    id: "sniper-detect",
    name: "Sniper Detector",
    description: "Sniper bot and MEV-adjacent wallet identification.",
    category: "specialist",
    tools: ["ogdex-firstbuyer", "solana-tracker", "og-wallet"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Flag sniper wallets and bot-like entry patterns.",
  }),
  agent({
    id: "copy-trade-preview",
    name: "Copy Trade Preview",
    description: "Preview copying a wallet trade via quote-only simulation.",
    category: "trade",
    tools: ["jupiter-quote", "og-wallet", "jupiter-price", "pnl-scan"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Simulate copy trades with quotes only. Never auto-execute.",
  }),
  agent({
    id: "bonding-curve",
    name: "Bonding Curve Analyst",
    description: "Pump.fun and bonding-curve progress, migration proximity.",
    category: "monitor",
    tools: ["pumpfun-migrations", "migration-watch", "token-data"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Track curve fill % and migration timing for launchpad tokens.",
  }),
  agent({
    id: "kol-tracker",
    name: "KOL Tracker",
    description: "Key opinion leader mention and wallet overlap tracking.",
    category: "social",
    tools: ["news-fetcher", "ai-analyzer", "og-wallet", "unified-intelligence"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Connect KOL narratives to on-chain wallet activity where verifiable.",
  }),
  agent({
    id: "telegram-intel",
    name: "Telegram Intel",
    description: "Telegram group sentiment and call tracking context.",
    category: "social",
    tools: ["news-fetcher", "ai-analyzer", "unified-intelligence"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Summarize Telegram-adjacent intel with source caveats.",
  }),
  agent({
    id: "discord-intel",
    name: "Discord Intel",
    description: "Discord community activity and announcement context.",
    category: "social",
    tools: ["news-fetcher", "ai-analyzer"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Provide Discord community context without unverified leaks.",
  }),
  agent({
    id: "xp-rewards",
    name: "XP & Rewards",
    description: "OrbitX XP, referrals, and engagement reward context.",
    category: "system",
    tools: ["track-record", "wallet-manager"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Explain XP and referral mechanics. Cannot override backend reward limits.",
  }),
  agent({
    id: "referrals",
    name: "Referral Guide",
    description: "Referral program rules and status lookups.",
    category: "social",
    tools: ["track-record", "wallet-manager"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Guide referral flows. Backend enforces caps; never promise unavailable rewards.",
  }),
  agent({
    id: "world-explorer",
    name: "World Explorer",
    description: "OrbitX World spaces and community map discovery.",
    category: "social",
    tools: ["unified-intelligence", "news-fetcher"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Help users navigate OrbitX World communities and spaces.",
  }),
  agent({
    id: "communities",
    name: "Communities Curator",
    description: "Community health, activity, and member intel summaries.",
    category: "social",
    tools: ["unified-intelligence", "ai-analyzer"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Summarize community activity and notable members.",
  }),
  agent({
    id: "spaces",
    name: "Spaces Host",
    description: "Live spaces scheduling and recap generation.",
    category: "social",
    tools: ["send-push", "ai-analyzer", "news-fetcher"],
    permission: "automate",
    marketplace: "specialist",
    systemRole:
      "Support spaces announcements and recaps. Push requires automation permission.",
  }),
  agent({
    id: "paper-live-isolation",
    name: "Paper/Live Isolation",
    description: "Enforce separation between paper simulation and live wallet actions.",
    category: "trade",
    tools: ["jupiter-quote", "wallet-manager"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Strictly isolate paper mode from live wallet tools and writes.",
  }),
  agent({
    id: "quote-only",
    name: "Quote Only",
    description: "Quotes and prices without any execution path.",
    category: "trade",
    tools: ["jupiter-quote", "jupiter-price", "jupiter-tokens"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Provide quotes only. Refuse swap and order tools even if requested implicitly.",
  }),
  agent({
    id: "ogdex-intel-agent",
    name: "OGDEX Intel Agent",
    description: "Dedicated OGDEX v1 and v2 intelligence routing.",
    category: "research",
    tools: ["ogdex-intel", "ogdex-intel-v2", "ogdex-xray"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Route OGDEX intel requests to the appropriate API version.",
  }),
  agent({
    id: "migration-specialist",
    name: "Migration Specialist",
    description: "Cross-platform migration timeline and pool mapping.",
    category: "monitor",
    tools: ["migration-watch", "pumpfun-migrations", "token-data"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Track migrations across launchpads with timeline estimates.",
  }),
  agent({
    id: "oxw-scanner",
    name: "OXW Scanner",
    description: "OrbitX wallet-native deep token scan specialist.",
    category: "security",
    tools: ["oxw-token-scan", "token-safety", "wallet-manager"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Run OXW scans in wallet context for connected users.",
  }),
  agent({
    id: "limit-order-desk",
    name: "Limit Order Desk",
    description: "Limit order prep and confirmation workflows.",
    category: "trade",
    tools: ["jupiter-order", "jupiter-quote", "jupiter-price"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Prepare limit orders with quotes. Orders require explicit sign and confirm.",
  }),
  agent({
    id: "push-notify",
    name: "Push Notify",
    description: "Push notification composition and delivery.",
    category: "monitor",
    tools: ["send-push", "alerts"],
    permission: "automate",
    marketplace: "specialist",
    systemRole:
      "Send pushes within automation limits. Respect quiet hours if configured.",
  }),
  agent({
    id: "track-record-analyst",
    name: "Track Record Analyst",
    description: "Signal and agent historical accuracy analysis.",
    category: "research",
    tools: ["track-record", "ai-analyzer"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Present track records with sample size and timeframe context.",
  }),
  agent({
    id: "enhanced-intel-agent",
    name: "Enhanced Intel Agent",
    description: "AI-enriched enhanced intelligence pass specialist.",
    category: "research",
    tools: ["enhanced-intelligence", "ai-analyzer", "unified-intelligence"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Run enhanced intel passes and narrate findings clearly.",
  }),
  agent({
    id: "unified-intel-agent",
    name: "Unified Intel Agent",
    description: "Single-call unified intelligence aggregation.",
    category: "research",
    tools: ["unified-intelligence", "token-data", "og-wallet"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Aggregate intel sources into one coherent briefing.",
  }),
  agent({
    id: "price-oracle",
    name: "Price Oracle",
    description: "Multi-mint price lookups and cross-rate calculations.",
    category: "trade",
    tools: ["jupiter-price", "token-data"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Fetch and compare prices across mints with staleness warnings.",
  }),
  agent({
    id: "token-search",
    name: "Token Search",
    description: "Jupiter token search and mint resolution.",
    category: "trade",
    tools: ["jupiter-tokens", "token-data"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Resolve ticker symbols to mints via Jupiter token search.",
  }),
  agent({
    id: "holder-concentration",
    name: "Holder Concentration",
    description: "Gini-style concentration and top-holder risk metrics.",
    category: "research",
    tools: ["og-holders", "token-data"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Quantify holder concentration and whale dominance risk.",
  }),
  agent({
    id: "wallet-pnl-deep",
    name: "Wallet PnL Deep Dive",
    description: "Granular wallet PnL with per-token attribution.",
    category: "trade",
    tools: ["pnl-scan", "og-wallet", "jupiter-price"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Deep PnL attribution per token and time window.",
  }),
  agent({
    id: "swap-builder",
    name: "Swap Builder",
    description: "Unsigned swap transaction construction after quote approval.",
    category: "trade",
    tools: ["jupiter-quote", "jupiter-swap", "wallet-manager"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Build swap txs only after quote review and explicit user confirm.",
  }),
  agent({
    id: "nft-sales",
    name: "NFT Sales Desk",
    description: "NFT listing and sale transaction preparation.",
    category: "create",
    tools: ["nft-execute-sale", "wallet-manager"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Prepare NFT sale txs. Never broadcast without wallet signature.",
  }),
  agent({
    id: "x-drafter",
    name: "X Drafter",
    description: "Draft X posts without publishing.",
    category: "social",
    tools: ["ai-analyzer", "news-fetcher"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Draft posts only. Route to x-agent for publish after confirm.",
  }),
  agent({
    id: "x-scheduler",
    name: "X Scheduler",
    description: "Schedule X posts via x-poster templates.",
    category: "social",
    tools: ["x-poster", "ai-analyzer"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Schedule posts with templates. Confirm before any write.",
  }),
  agent({
    id: "alert-price",
    name: "Price Alert Specialist",
    description: "Price threshold alerts with push integration.",
    category: "monitor",
    tools: ["alerts", "jupiter-price", "send-push"],
    permission: "automate",
    marketplace: "specialist",
    systemRole:
      "Create price alerts within backend rate limits.",
  }),
  agent({
    id: "alert-wallet",
    name: "Wallet Alert Specialist",
    description: "Wallet activity and balance change alerts.",
    category: "monitor",
    tools: ["alerts", "solana-tracker", "send-push"],
    permission: "automate",
    marketplace: "specialist",
    systemRole:
      "Monitor wallet events and notify on meaningful changes.",
  }),
  agent({
    id: "alert-migration",
    name: "Migration Alert Specialist",
    description: "Alerts for bonding-curve and AMM migrations.",
    category: "monitor",
    tools: ["alerts", "migration-watch", "pumpfun-migrations"],
    permission: "automate",
    marketplace: "specialist",
    systemRole:
      "Alert users before and after migration events.",
  }),
  agent({
    id: "intel-comparator",
    name: "Intel Comparator",
    description: "Side-by-side token or wallet comparison reports.",
    category: "research",
    tools: ["token-data", "og-wallet", "enhanced-intelligence"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Compare two or more subjects with structured diffs.",
  }),
  agent({
    id: "sector-rotation",
    name: "Sector Rotation",
    description: "Sector flow and rotation signals across Solana.",
    category: "monitor",
    tools: ["birdseye-analytics", "unified-intelligence"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Identify sector rotation using macro analytics.",
  }),
  agent({
    id: "launch-sniper-prep",
    name: "Launch Sniper Prep",
    description: "Pre-launch checklist: safety, liquidity, and quote prep.",
    category: "trade",
    tools: ["token-safety", "jupiter-quote", "ogdex-firstbuyer", "pumpfun-migrations"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Prep launch entries with safety first. No auto-buy.",
  }),
  agent({
    id: "dex-screener",
    name: "DEX Screener",
    description: "Screen tokens by liquidity, volume, and safety scores.",
    category: "monitor",
    tools: ["birdseye-analytics", "token-safety", "jupiter-price"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Screen universes of tokens by user criteria.",
  }),
  agent({
    id: "wallet-labeler",
    name: "Wallet Labeler",
    description: "Known wallet labels and entity attribution hints.",
    category: "research",
    tools: ["og-wallet", "solana-tracker", "ai-analyzer"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Suggest wallet labels from public intel. Mark uncertain attributions.",
  }),
  agent({
    id: "tx-explainer",
    name: "Transaction Explainer",
    description: "Explain Solana transactions in plain language.",
    category: "research",
    tools: ["solana-tracker", "ai-analyzer", "wallet-manager"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Decode transaction instructions and token flows for users.",
  }),
  agent({
    id: "risk-scorer",
    name: "Risk Scorer",
    description: "Composite risk score from safety, liquidity, and holder data.",
    category: "security",
    tools: ["token-safety", "og-holders", "ogdex-intel-v2", "jupiter-quote"],
    permission: "read",
    marketplace: "specialist",
    systemRole:
      "Produce composite risk scores with transparent factor weights.",
  }),
  agent({
    id: "execution-checklist",
    name: "Execution Checklist",
    description: "Pre-trade checklist: intent, validation, quote, preview, sign.",
    category: "trade",
    tools: ["jupiter-quote", "token-safety", "wallet-manager"],
    permission: "confirm",
    marketplace: "specialist",
    systemRole:
      "Walk users through Intent → Validation → Quote → Preview → Sign → Broadcast → Confirm → Verify.",
  }),
] as const;

const AGENT_MAP = new Map<string, AgentDefinition>(
  AGENTS.map((a) => [a.id, a]),
);

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENT_MAP.get(id);
}

export function agentsByCategory(
  category?: AgentCategory,
): AgentDefinition[] {
  if (!category) {
    return [...AGENTS];
  }
  return AGENTS.filter((a) => a.category === category);
}

export type { AgentDefinition };
