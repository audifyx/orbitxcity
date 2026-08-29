import type { AgentDefinition, PlanIntent, ToolDefinition, UtterancePlan } from "./types";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_RE = new RegExp(`[${BASE58}]{32,44}`);

const TRADE_VERBS =
  /\b(buy|sell|swap|trade|purchase|exchange|long|short|market\s?order|limit\s?order)\b/i;

const ALERT_VERBS = /\b(alert|notify|watch|ping|remind)\b/i;
const SOCIAL_VERBS = /\b(tweet|post|share|x\.com|twitter)\b/i;
const LAUNCH_VERBS = /\b(launch|pump\.?fun|bonding\s?curve|migrate|migration)\b/i;
const NFT_VERBS = /\b(nft|listing|floor|collection)\b/i;
const PORTFOLIO_VERBS = /\b(portfolio|holdings|balance|positions|bag)\b/i;
const RESEARCH_VERBS =
  /\b(research|analyze|analysis|report|deep\s?dive|due\s?diligence|dd)\b/i;
const TOKEN_VERBS = /\b(token|rug|honeypot|mint|ca\b|contract)\b/i;
const WALLET_VERBS = /\b(wallet|holder|whale|address)\b/i;
const SCREEN_VERBS =
  /\b(trend|trending|screen|screener|runners|movers|gems|new\s?pairs|moonshot)\b/i;
const NEWS_VERBS = /\b(news|headline|narrative|kols?|sentiment)\b/i;
const FORENSIC_VERBS =
  /\b(forensic|x-?ray|first\s?buyer|sniper|bundle|insider|dev\s?wallet)\b/i;

const EXPLICIT_WRITE_VERBS =
  /\b(execute|broadcast|send\s?swap|place\s?order|post\s?now|publish|list\s?nft|sell\s?nft)\b/i;

const QUOTE_ONLY_VERBS = /\b(quote|price|how\s?much|estimate)\b/i;

function extractAddresses(text: string): string[] {
  const matches = text.match(new RegExp(BASE58_RE.source, "g"));
  if (!matches) {
    return [];
  }
  return Array.from(new Set(matches));
}

function detectIntent(text: string, addresses: string[]): PlanIntent {
  const lower = text.toLowerCase();

  if (TRADE_VERBS.test(text) && !QUOTE_ONLY_VERBS.test(text)) {
    return "trade";
  }
  if (ALERT_VERBS.test(text)) {
    return "alert";
  }
  if (SOCIAL_VERBS.test(text)) {
    return "social";
  }
  if (NFT_VERBS.test(text)) {
    return "nft";
  }
  if (LAUNCH_VERBS.test(text)) {
    return "launch";
  }
  if (PORTFOLIO_VERBS.test(text)) {
    return "portfolio";
  }
  if (SCREEN_VERBS.test(text) && addresses.length === 0) {
    return "screen";
  }
  if (NEWS_VERBS.test(text) && addresses.length === 0) {
    return "news";
  }
  if (RESEARCH_VERBS.test(text)) {
    return "research";
  }
  if (TOKEN_VERBS.test(text) || (addresses.length > 0 && WALLET_VERBS.test(text) === false)) {
    return "analyze_token";
  }
  if (WALLET_VERBS.test(text) || addresses.length > 0) {
    return "analyze_wallet";
  }
  if (addresses.length > 0) {
    return "analyze_token";
  }

  void lower;
  return "other";
}

function pickAgents(intent: PlanIntent, text: string): string[] {
  const ids: string[] = ["master"];

  switch (intent) {
    case "analyze_token":
      ids.push("token", "security", "research");
      if (/\b(rug|safe|honeypot|scam)\b/i.test(text)) {
        ids.push("rug-detection", "security-audit");
      }
      if (/\b(holder|whale|concentration)\b/i.test(text)) {
        ids.push("holder", "whale");
      }
      if (/\b(liquidity|lp|pool)\b/i.test(text)) {
        ids.push("liquidity", "lp-lock");
      }
      break;
    case "analyze_wallet":
      ids.push("wallet", "pnl", "portfolio");
      if (/\b(whale|smart\s?money)\b/i.test(text)) {
        ids.push("whale");
      }
      break;
    case "trade":
      ids.push("trading", "jupiter", "quote-only", "execution-checklist");
      break;
    case "alert":
      ids.push("alert", "alert-price");
      break;
    case "social":
      ids.push("x-agent", "social", "x-drafter");
      break;
    case "research":
      ids.push("research", "deep-research", "news");
      break;
    case "screen":
      ids.push("market", "token", "launch");
      break;
    case "news":
      ids.push("news", "social", "research");
      break;
    case "launch":
      ids.push("launch", "bonding-curve", "migration-specialist");
      break;
    case "nft":
      ids.push("nft", "nft-sales");
      break;
    case "portfolio":
      ids.push("portfolio", "wallet", "pnl");
      break;
    default:
      ids.push("context", "research");
      break;
  }

  return Array.from(new Set(ids));
}

function pickTools(
  intent: PlanIntent,
  text: string,
  addresses: string[],
  tools: ToolDefinition[],
  explicitWrite: boolean,
): { toolIds: string[]; notes: string[] } {
  const notes: string[] = [];
  const toolIds: string[] = [];
  const toolSet = new Set(tools.map((t) => t.id));

  function add(id: string): void {
    if (toolSet.has(id)) {
      toolIds.push(id);
    }
  }

  const hasMint = addresses.length > 0;

  switch (intent) {
    case "analyze_token":
      add("og-scan-token");
      add("token-safety");
      if (/\b(holder|whale|concentration)\b/i.test(text)) {
        add("og-holders");
      }
      if (FORENSIC_VERBS.test(text) || /\b(ogdex|xray|x-ray)\b/i.test(text)) {
        add("ogdex-xray");
        add("ogdex-firstbuyer");
      }
      if (hasMint) {
        notes.push(`Detected mint candidate: ${addresses[0]}`);
      }
      break;

    case "analyze_wallet":
      add("og-wallet");
      add("wallet-manager");
      add("pnl-scan");
      add("solana-tracker");
      if (hasMint) {
        notes.push(`Detected wallet candidate: ${addresses[0]}`);
      }
      break;

    case "trade":
      add("jupiter-quote");
      add("jupiter-price");
      notes.push(
        "Trade intent detected: quote-only stage. jupiter-swap and jupiter-order excluded until explicit execute request.",
      );
      if (explicitWrite) {
        notes.push(
          "User requested execution language — swap/order tools require confirmation before inclusion.",
        );
        if (/\border\b/i.test(text)) {
          add("jupiter-order");
          notes.push("jupiter-order marked for confirmation gate.");
        } else {
          add("jupiter-swap");
          notes.push("jupiter-swap marked for confirmation gate.");
        }
      }
      break;

    case "alert":
      add("alerts");
      if (/\b(push|notify)\b/i.test(text)) {
        add("send-push");
      }
      if (hasMint) {
        add("jupiter-price");
      }
      break;

    case "social":
      add("news-fetcher");
      add("ai-analyzer");
      if (explicitWrite) {
        add("post-to-x");
        add("x-poster");
        notes.push("Social write tools require explicit user confirmation.");
      } else {
        notes.push("Draft-only social mode: post tools excluded.");
      }
      break;

    case "research":
      add("unified-intelligence");
      if (/\bnews\b/i.test(text)) {
        add("news-fetcher");
      }
      if (/\breport\b/i.test(text)) {
        add("og-report-pdf");
      }
      break;

    case "launch":
      add("pumpfun-migrations");
      add("migration-watch");
      add("ogdex-firstbuyer");
      add("token-data");
      break;

    case "nft":
      add("wallet-manager");
      if (explicitWrite) {
        add("nft-execute-sale");
        notes.push("NFT sale tool requires wallet sign and confirmation.");
      }
      break;

    case "portfolio":
      add("wallet-manager");
      add("pnl-scan");
      add("jupiter-price");
      add("birdseye-analytics");
      break;

    case "screen":
      add("token-data");
      add("birdseye-analytics");
      notes.push("Screener / trending pass — no mint required.");
      break;

    case "news":
      add("news-fetcher");
      break;

    default:
      notes.push("Chat only — no tools unless @mentioned or explicitly asked.");
      break;
  }

  const writeIds = new Set(tools.filter((t) => t.side === "write").map((t) => t.id));
  const filtered = Array.from(new Set(toolIds)).filter((id) => {
    if (!writeIds.has(id)) {
      return true;
    }
    if (!explicitWrite) {
      notes.push(`Excluded write tool '${id}' — no explicit execute request.`);
      return false;
    }
    const def = tools.find((t) => t.id === id);
    if (def?.confirmationRequired) {
      notes.push(`Write tool '${id}' requires user confirmation before invoke.`);
    }
    return true;
  });

  return { toolIds: filtered, notes };
}

const ASK_FOR_TOOLS =
  /\b(scan|analyze|analyse|quote|swap|inspect|look\s?up|lookup|deep[- ]?dive|fetch news|research this|run (the )?tool|use @|use [a-z]|metadata|on-chain)\b/i;

function slugName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function matchTool(raw: string, tools: ToolDefinition[]): ToolDefinition | undefined {
  const needle = raw.toLowerCase().trim();
  const dashed = slugName(needle);
  return (
    tools.find((item) => item.id === needle || item.id === dashed) ??
    tools.find((item) => slugName(item.name) === dashed) ??
    tools.find(
      (item) =>
        item.id.startsWith(dashed) ||
        slugName(item.name).startsWith(dashed) ||
        item.name.toLowerCase() === needle,
    )
  );
}

export function extractToolMentions(
  text: string,
  tools: ToolDefinition[],
): ToolDefinition[] {
  const found = new Map<string, ToolDefinition>();
  const mentionRe = /@([a-z0-9][a-z0-9-]{0,40})/gi;
  let match: RegExpExecArray | null = mentionRe.exec(text);
  while (match) {
    const tool = matchTool(match[1], tools);
    if (tool) {
      found.set(tool.id, tool);
    }
    match = mentionRe.exec(text);
  }

  const useRe = /use\s+([a-z0-9][a-z0-9\s/-]{1,48}?)(?:\s*:|\s+fetch|\s+run|\s+for\b|$)/gi;
  let useMatch: RegExpExecArray | null = useRe.exec(text);
  while (useMatch) {
    const tool = matchTool(useMatch[1], tools);
    if (tool) {
      found.set(tool.id, tool);
    }
    useMatch = useRe.exec(text);
  }

  const lower = text.toLowerCase();
  for (const tool of tools) {
    if (lower.includes(`use ${tool.name.toLowerCase()}`)) {
      found.set(tool.id, tool);
    }
    if (tool.description.length > 24 && lower.includes(tool.description.toLowerCase())) {
      found.set(tool.id, tool);
    }
  }

  return [...found.values()];
}

export function rewriteLegacyToolPrompt(
  text: string,
  tools: ToolDefinition[],
): string {
  let next = text;
  for (const tool of tools) {
    const legacy = `Use ${tool.name}: ${tool.description}`;
    if (next.includes(legacy)) {
      next = next.split(legacy).join(`@${tool.id}`);
    }
    const prefix = new RegExp(`Use\\s+${tool.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "gi");
    if (prefix.test(next) && !next.includes(`@${tool.id}`)) {
      next = next.replace(prefix, `@${tool.id}`);
    }
  }
  return next.replace(/\s+/g, " ").trim();
}

export function mentionSuggestions(
  partial: string,
  tools: ToolDefinition[],
): ToolDefinition[] {
  const q = partial.toLowerCase();
  return tools
    .filter(
      (tool) =>
        tool.id.includes(q) ||
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q),
    )
    .slice(0, 8);
}

function wantsLiveTools(
  text: string,
  addresses: string[],
  mentions: ToolDefinition[],
): boolean {
  if (mentions.length > 0) {
    return true;
  }
  if (ASK_FOR_TOOLS.test(text)) {
    return true;
  }
  if (addresses.length === 0) {
    return false;
  }
  return true;
}

export function planFromUtterance(
  text: string,
  agents: AgentDefinition[],
  tools: ToolDefinition[],
): UtterancePlan {
  const trimmed = text.trim();
  const addresses = extractAddresses(trimmed);
  const mentions = extractToolMentions(trimmed, tools);
  const intent = detectIntent(trimmed, addresses);
  const explicitWrite = EXPLICIT_WRITE_VERBS.test(trimmed);
  const live = wantsLiveTools(trimmed, addresses, mentions);

  const agentIds = (live ? pickAgents(intent, trimmed) : ["master"]).filter((id) =>
    agents.some((a) => a.id === id),
  );

  if (!live) {
    return {
      agentIds: agentIds.length > 0 ? agentIds : ["master"],
      toolIds: [],
      intent,
      notes: ["Just talking — no @tool and no scan/quote ask."],
    };
  }

  if (mentions.length > 0) {
    const notes = [`Using @ ${mentions.map((tool) => tool.id).join(", ")}`];
    if (addresses.length > 0) {
      notes.push(`Solana address(es) detected: ${addresses.join(", ")}`);
    }
    return {
      agentIds: agentIds.length > 0 ? agentIds : ["master"],
      toolIds: mentions.map((tool) => tool.id),
      intent,
      notes,
    };
  }

  const { toolIds, notes: toolNotes } = pickTools(
    intent,
    trimmed,
    addresses,
    tools,
    explicitWrite,
  );

  const notes = [...toolNotes];

  if (addresses.length > 0) {
    notes.push(`Solana address(es) detected: ${addresses.join(", ")}`);
  }

  if (intent === "trade" && !explicitWrite) {
    notes.push("Flow stage: Intent → Validation → Quote (no auto-swap).");
  }

  if (agentIds.length === 0) {
    agentIds.push("master");
  }

  return {
    agentIds,
    toolIds,
    intent,
    notes,
  };
}
