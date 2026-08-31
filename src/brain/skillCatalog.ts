import type { PlanIntent } from "./types";

export type SkillCategory =
  | "trading"
  | "data"
  | "launch"
  | "nft"
  | "mint"
  | "knowledge"
  | "monitor"
  | "social"
  | "wallet"
  | "security"
  | "speed"
  | "orbitx";

export type AgentSkill = {
  id: string;
  name: string;
  category: SkillCategory;
  /** Plain substring or regex source (wrapped in RegExp when pattern starts with ^ or contains \\b). */
  patterns: string[];
  toolIds: string[];
  agentIds: string[];
  intent?: PlanIntent;
  promptHint?: string;
  priority: number;
};

function skill(
  partial: Omit<AgentSkill, "priority"> & { priority?: number },
): AgentSkill {
  return { priority: partial.priority ?? 50, ...partial };
}

const TRADING_VERBS = [
  "buy",
  "sell",
  "swap",
  "trade",
  "market buy",
  "market sell",
  "ape",
  "dump",
  "flip",
  "scalp",
  "long",
  "short",
  "exit",
  "enter",
  "load up",
  "take profit",
  "stop loss",
  "dca",
  "average down",
  "snipe",
  "quick buy",
  "quick sell",
  "instant buy",
  "instant sell",
  "market order",
  "limit order",
  "fill order",
  "execute trade",
  "place trade",
  "route swap",
  "jupiter swap",
  "ultra swap",
];

const DATA_VERBS = [
  "scan",
  "analyze",
  "analyse",
  "lookup",
  "look up",
  "check",
  "inspect",
  "research",
  "report",
  "deep dive",
  "breakdown",
  "audit",
  "profile",
  "intel",
  "x-ray",
  "xray",
  "forensics",
  "due diligence",
  "dd",
  "tell me about",
  "what is",
  "what's",
  "info on",
  "metadata",
  "on-chain",
  "holders",
  "liquidity",
  "volume",
  "mcap",
  "market cap",
  "price check",
  "chart",
  "candles",
  "trending",
  "runners",
  "movers",
  "gems",
  "alpha",
  "signal",
];

const LAUNCH_VERBS = [
  "launch",
  "create coin",
  "create token",
  "deploy token",
  "pump.fun",
  "pumpfun",
  "bonding curve",
  "graduation",
  "migrate",
  "migration",
  "raydium pool",
  "new launch",
  "memecoin",
  "fair launch",
];

const NFT_VERBS = [
  "mint nft",
  "create nft",
  "nft mint",
  "nft collection",
  "floor price",
  "list nft",
  "sell nft",
  "buy nft",
  "nft listing",
  "compressed nft",
  "cnft",
];

const WALLET_VERBS = [
  "portfolio",
  "holdings",
  "my bag",
  "my bags",
  "positions",
  "balance",
  "wallet scan",
  "pnl",
  "profit",
  "loss",
  "what am i holding",
  "show holdings",
  "my tokens",
];

const SECURITY_VERBS = [
  "rug",
  "honeypot",
  "scam",
  "safe",
  "safety",
  "mint authority",
  "freeze authority",
  "dev sold",
  "insider",
  "bundle",
  "sniper",
  "first buyer",
  "lp lock",
  "liquidity lock",
];

const SOCIAL_VERBS = [
  "tweet",
  "post to x",
  "post on x",
  "twitter",
  "x.com",
  "share on x",
  "announce",
  "shill",
];

const MONITOR_VERBS = [
  "alert",
  "notify",
  "watch",
  "ping",
  "remind",
  "track",
  "monitor",
  "migration watch",
  "graduation watch",
];

const KNOWLEDGE_TOPICS = [
  { q: "what is orbitx", tools: ["ai-analyzer"], agents: ["master", "context"] },
  { q: "orbitx token", tools: ["jupiter-price"], agents: ["master"] },
  { q: "orbitx mcp", tools: ["ai-analyzer"], agents: ["master", "context"] },
  { q: "how to burn", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx pro", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx shop", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx city", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx dex", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx launchpad", tools: ["launch-coin"], agents: ["launch"] },
  { q: "orbitx nft", tools: ["nft-mint"], agents: ["nft"] },
  { q: "orbitx predictions", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx gaming", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx telegram", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx hold", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "orbitx utility", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "audifyx", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "og scan", tools: ["ai-analyzer"], agents: ["master", "context"] },
  { q: "non custodial", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "privy wallet", tools: ["wallet-manager"], agents: ["wallet"] },
  { q: "auto sign", tools: ["ai-analyzer"], agents: ["master", "trading"] },
  { q: "limit orders", tools: ["jupiter-price"], agents: ["trading"] },
  { q: "creator fees", tools: ["wallet-manager"], agents: ["launch"] },
  { q: "claim fees", tools: ["wallet-manager"], agents: ["launch"] },
  { q: "jupiter ultra", tools: ["jupiter-quote"], agents: ["trading", "jupiter"] },
  { q: "expo go", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "mobile app", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "social tab", tools: ["post-to-x"], agents: ["x-agent", "social"] },
  { q: "connect x", tools: ["post-to-x"], agents: ["x-agent"] },
  { q: "nfa dyor", tools: ["ai-analyzer"], agents: ["master"] },
  { q: "feature flags", tools: ["ai-analyzer"], agents: ["master"] },
];

function tradingSkills(): AgentSkill[] {
  return TRADING_VERBS.map((verb, index) =>
    skill({
      id: `trade-${verb.replace(/\s+/g, "-")}`,
      name: `Trade: ${verb}`,
      category: "trading",
      patterns: [verb, `${verb} $`, `\\$\\d.*${verb}`],
      toolIds: ["instant-price", "fast-quote", "jupiter-price"],
      agentIds: ["trading", "jupiter", "quote-only", "execution-checklist"],
      intent: "trade",
      promptHint: "Fast trade routing — quote first, execute in-app with Privy auto-sign.",
      priority: 70 - Math.min(index, 20),
    }),
  );
}

function usdTradingSkills(): AgentSkill[] {
  const amounts = ["$1", "$5", "$10", "$25", "$50", "$100", "1 usd", "5 usd", "10 dollars"];
  return amounts.flatMap((amt) => [
    skill({
      id: `usd-buy-${amt.replace(/[^a-z0-9]/gi, "")}`,
      name: `USD buy ${amt}`,
      category: "speed",
      patterns: [`buy ${amt}`, `buy ${amt} of`],
      toolIds: ["usd-price", "fast-quote"],
      agentIds: ["trading", "jupiter"],
      intent: "trade",
      promptHint: "USD-notional buy — convert to SOL size via live price.",
      priority: 85,
    }),
    skill({
      id: `usd-sell-${amt.replace(/[^a-z0-9]/gi, "")}`,
      name: `USD sell ${amt}`,
      category: "speed",
      patterns: [`sell ${amt}`, `sell ${amt} of`],
      toolIds: ["usd-price", "fast-quote"],
      agentIds: ["trading", "jupiter"],
      intent: "trade",
      promptHint: "USD-notional sell — convert token amount via live price.",
      priority: 85,
    }),
  ]);
}

function dataSkills(): AgentSkill[] {
  const toolMap: Record<string, string[]> = {
    scan: ["deep-scan", "quick-scan", "safety-scan"],
    analyze: ["unified-scan", "enhanced-scan", "ai-brief"],
    holders: ["holder-scan", "whale-map"],
    liquidity: ["liquidity-scan", "liquidity-scan"],
    volume: ["volume-scan"],
    rug: ["rug-check", "safety-scan"],
    honeypot: ["rug-check", "safety-scan"],
    "deep dive": ["full-report", "enhanced-scan", "xray-scan"],
    forensics: ["xray-scan", "bundle-scan", "sniper-scan"],
    trending: ["trending-scan", "macro-analytics"],
    metadata: ["metadata-lookup", "token-data"],
    intel: ["intel-v2", "unified-scan"],
    report: ["full-report", "pdf-report"],
  };

  return DATA_VERBS.map((verb, index) => {
    const key = Object.keys(toolMap).find((k) => verb.includes(k));
    const tools = key ? toolMap[key]! : ["quick-scan", "token-data"];
    return skill({
      id: `data-${verb.replace(/\s+/g, "-")}`,
      name: `Data: ${verb}`,
      category: "data",
      patterns: [verb, `${verb} token`, `${verb} mint`],
      toolIds: tools,
      agentIds: ["token", "research", "security"],
      intent: "analyze_token",
      priority: 60 - Math.min(index, 25),
    });
  });
}

function launchSkills(): AgentSkill[] {
  return LAUNCH_VERBS.map((verb, index) =>
    skill({
      id: `launch-${verb.replace(/\s+/g, "-")}`,
      name: `Launch: ${verb}`,
      category: "launch",
      patterns: [verb],
      toolIds: verb.includes("mint") || verb.includes("nft")
        ? ["nft-create"]
        : verb.includes("migrat") || verb.includes("graduat")
          ? ["pump-migration", "migration-scan"]
          : ["pump-launch", "launch-intel"],
      agentIds: ["launch", "bonding-curve", "migration-specialist"],
      intent: "launch",
      promptHint: "Launch signs in-app — never send to external wallet.",
      priority: 65 - Math.min(index, 15),
    }),
  );
}

function nftSkills(): AgentSkill[] {
  return NFT_VERBS.map((verb, index) =>
    skill({
      id: `nft-${verb.replace(/\s+/g, "-")}`,
      name: `NFT: ${verb}`,
      category: "nft",
      patterns: [verb],
      toolIds: /\bmint\b/i.test(verb)
        ? ["nft-create", "collection-mint"]
        : /\b(list|sell)\b/i.test(verb)
          ? ["nft-list", "nft-sale"]
          : ["nft-intel"],
      agentIds: ["nft", "nft-sales"],
      intent: "nft",
      priority: 62 - Math.min(index, 12),
    }),
  );
}

function walletSkills(): AgentSkill[] {
  return WALLET_VERBS.map((verb, index) =>
    skill({
      id: `wallet-${verb.replace(/\s+/g, "-")}`,
      name: `Wallet: ${verb}`,
      category: "wallet",
      patterns: [verb],
      toolIds: ["portfolio-scan", "holdings-fetch", "pnl-lookup", "wallet-scan"],
      agentIds: ["portfolio", "wallet", "pnl"],
      intent: "portfolio",
      promptHint: "Pull live holdings from Solana RPC — same as Wallet tab.",
      priority: 75 - Math.min(index, 15),
    }),
  );
}

function securitySkills(): AgentSkill[] {
  return SECURITY_VERBS.map((verb, index) =>
    skill({
      id: `security-${verb.replace(/\s+/g, "-")}`,
      name: `Security: ${verb}`,
      category: "security",
      patterns: [verb, `${verb} check`, `is it ${verb}`],
      toolIds: ["rug-check", "safety-scan", "xray-scan", "sniper-scan"],
      agentIds: ["security", "rug-detection", "security-audit"],
      intent: "analyze_token",
      priority: 68 - Math.min(index, 12),
    }),
  );
}

function socialSkills(): AgentSkill[] {
  return SOCIAL_VERBS.map((verb, index) =>
    skill({
      id: `social-${verb.replace(/\s+/g, "-")}`,
      name: `Social: ${verb}`,
      category: "social",
      patterns: [verb, `tweet:`, `post to x:`],
      toolIds: ["x-post", "tweet-draft", "news-scan"],
      agentIds: ["x-agent", "social", "x-drafter"],
      intent: "social",
      priority: 55 - Math.min(index, 8),
    }),
  );
}

function monitorSkills(): AgentSkill[] {
  return MONITOR_VERBS.map((verb, index) =>
    skill({
      id: `monitor-${verb.replace(/\s+/g, "-")}`,
      name: `Monitor: ${verb}`,
      category: "monitor",
      patterns: [verb],
      toolIds: ["price-alert", "wallet-alert", "migration-scan", "tracker-feed"],
      agentIds: ["alert", "alert-price", "market"],
      intent: "alert",
      priority: 50 - Math.min(index, 8),
    }),
  );
}

function knowledgeSkills(): AgentSkill[] {
  return KNOWLEDGE_TOPICS.map((topic, index) =>
    skill({
      id: `knowledge-${topic.q.replace(/\s+/g, "-")}`,
      name: `Knowledge: ${topic.q}`,
      category: "knowledge",
      patterns: [topic.q, topic.q.replace("what is ", "")],
      toolIds: topic.tools,
      agentIds: topic.agents,
      intent: "other",
      promptHint: "Answer from OrbitX FAQ — never invent beyond known facts.",
      priority: 40 + index,
    }),
  );
}

function speedSkills(): AgentSkill[] {
  const hints = [
    { id: "fast-exec", p: "execute now", tools: ["fast-quote"], agents: ["trading"] },
    { id: "instant-exec", p: "do it now", tools: ["fast-quote"], agents: ["trading"] },
    { id: "asap-trade", p: "asap", tools: ["instant-price"], agents: ["trading"] },
    { id: "quick-route", p: "best route", tools: ["route-preview"], agents: ["jupiter"] },
    { id: "low-slip", p: "low slippage", tools: ["slippage-check"], agents: ["trading"] },
    { id: "tight-slip", p: "tight slippage", tools: ["slippage-check"], agents: ["trading"] },
    { id: "fast-scan", p: "quick look", tools: ["quick-scan"], agents: ["token"] },
    { id: "fast-intel", p: "quick intel", tools: ["intel-v2"], agents: ["research"] },
    { id: "one-tap", p: "one tap", tools: ["fast-quote"], agents: ["trading"] },
    { id: "auto-sign-hint", p: "auto sign", tools: ["fast-quote"], agents: ["trading"] },
    { id: "no-wallet-app", p: "without phantom", tools: ["fast-quote"], agents: ["trading"] },
    { id: "in-app-trade", p: "in app", tools: ["fast-quote"], agents: ["trading"] },
  ];
  return hints.map((item, index) =>
    skill({
      id: `speed-${item.id}`,
      name: `Speed: ${item.p}`,
      category: "speed",
      patterns: [item.p],
      toolIds: item.tools,
      agentIds: item.agents,
      intent: "trade",
      promptHint: "Prioritize low-latency path — auto-sign in Privy wallet.",
      priority: 90 - index,
    }),
  );
}

function orbitxSkills(): AgentSkill[] {
  const items = [
    { p: "orbitx", tools: ["ai-analyzer"], agents: ["master"] },
    { p: "$orbitx", tools: ["jupiter-price"], agents: ["master"] },
    { p: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9", tools: ["deep-scan", "instant-price"], agents: ["token", "master"] },
    { p: "orbitx.world", tools: ["ai-analyzer"], agents: ["master"] },
    { p: "theorbitxmcpbot", tools: ["ai-analyzer"], agents: ["master"] },
    { p: "orbitx wrld", tools: ["ai-analyzer"], agents: ["master"] },
    { p: "orbitxcity", tools: ["ai-analyzer"], agents: ["master"] },
    { p: "orbitx os", tools: ["ai-analyzer"], agents: ["master"] },
    { p: "orbitx ai", tools: ["ai-analyzer"], agents: ["master"] },
    { p: "orbitx launch", tools: ["pump-launch"], agents: ["launch"] },
    { p: "orbitx wallet", tools: ["balance-check"], agents: ["wallet"] },
    { p: "orbitx social", tools: ["x-post"], agents: ["social"] },
    { p: "orbitx limit", tools: ["limit-quote"], agents: ["trading"] },
    { p: "orbitx holdings", tools: ["holdings-fetch"], agents: ["portfolio"] },
    { p: "orbitx burn", tools: ["ai-analyzer"], agents: ["master"] },
  ];
  return items.map((item, index) =>
    skill({
      id: `orbitx-${index}`,
      name: `OrbitX: ${item.p.slice(0, 24)}`,
      category: "orbitx",
      patterns: [item.p],
      toolIds: item.tools,
      agentIds: item.agents,
      priority: 80 - index,
    }),
  );
}

/** 200+ routable agent skills for faster intent → tool → agent matching. */
export const AGENT_SKILLS: readonly AgentSkill[] = [
  ...tradingSkills(),
  ...usdTradingSkills(),
  ...dataSkills(),
  ...launchSkills(),
  ...nftSkills(),
  ...walletSkills(),
  ...securitySkills(),
  ...socialSkills(),
  ...monitorSkills(),
  ...knowledgeSkills(),
  ...speedSkills(),
  ...orbitxSkills(),
];

export const SKILL_COUNT = AGENT_SKILLS.length;

export function skillsByCategory(category: SkillCategory): AgentSkill[] {
  return AGENT_SKILLS.filter((item) => item.category === category);
}
