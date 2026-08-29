import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const NVIDIA_API_KEYS = [
  Deno.env.get("NVIDIA_API_KEY") || "",
  Deno.env.get("NVIDIA_KEY_1") || "",
  Deno.env.get("NVIDIA_KEY_2") || "",
  Deno.env.get("NVIDIA_KEY_3") || "",
].filter((key) => key.trim().length > 0);
const NVIDIA_BASE_URL = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODELS = [
  Deno.env.get("NVIDIA_CHAT_MODEL") || "",
  Deno.env.get("NVIDIA_MODEL") || "",
  "minimaxai/minimax-m3",
  "meta/llama-4-maverick-17b-128e-instruct",
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-70b-instruct",
].filter((id, index, all) => id && all.indexOf(id) === index);
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";
const XAI_API_KEY = Deno.env.get("XAI_API_KEY") || Deno.env.get("GROK_API_KEY") || "";
const XAI_MODEL = Deno.env.get("XAI_MODEL") || Deno.env.get("GROK_MODEL") || "grok-2-latest";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODELS = [
  Deno.env.get("GEMINI_MODEL") || "",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
].filter((id, index, all) => id && all.indexOf(id) === index);
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_MODEL") || "meta-llama/llama-3.3-70b-instruct:free";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const BASE58_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASK_FOR_TOOLS =
  /\b(scan|analyze|analyse|quote|swap|inspect|look\s?up|lookup|deep[- ]?dive|fetch news|research this|run (the )?tool|use @|use [a-z]|metadata|on-chain|tell me about|full report|info on|launch a|mint (an? )?nft|create (a |an )?(coin|token|nft))\b/i;
const CREATE_LAUNCH_VERBS =
  /\b(launch (a |the )?(coin|token|memecoin)|create (a |the )?(coin|token|memecoin)|mint (a |the )?(coin|token)|pump\.?fun create)\b/i;
const MINT_NFT_VERBS =
  /\b(mint (an? |the )?nft|create (an? |the )?nft|nft mint)\b/i;
const TELL_ABOUT =
  /\b(tell me about|what(?:'s| is)|full report|deep ?dive|breakdown|info(?:rmation)? (on|about)|look(?:ing)? (this )?up|report on)\b/i;
const FULL_TOKEN_REPORT = [
  "og-scan-token",
  "token-data",
  "token-safety",
  "og-holders",
  "jupiter-price",
  "birdseye-analytics",
  "ogdex-intel-v2",
  "ogdex-xray",
  "ogdex-firstbuyer",
  "enhanced-intelligence",
];
const KNOWN_TOOLS = [
  "token-data",
  "token-safety",
  "og-scan-token",
  "og-wallet",
  "og-holders",
  "ogdex-intel",
  "ogdex-intel-v2",
  "ogdex-xray",
  "ogdex-firstbuyer",
  "pnl-scan",
  "unified-intelligence",
  "enhanced-intelligence",
  "ai-analyzer",
  "birdseye-analytics",
  "solana-tracker",
  "oxw-token-scan",
  "jupiter-quote",
  "jupiter-price",
  "jupiter-tokens",
  "alerts",
  "wallet-manager",
  "news-fetcher",
  "migration-watch",
  "pumpfun-migrations",
  "launch-coin",
  "nft-mint",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

type Msg = { role: "system" | "user" | "assistant"; content: string };
type ToolEvent = {
  id: string;
  toolId: string;
  label: string;
  status: "queued" | "running" | "ok" | "error";
  detail?: string;
};
type ChatCard = {
  kind: "token" | "wallet" | "tx";
  title: string;
  data: Record<string, unknown>;
};

const CHAT_SYSTEM = `You are OrbitX, a live chat partner who also has on-chain Solana tools.

Talk like a sharp human in a chat — first person, react to what they just said. Casual chat: 2–6 short sentences. Mint / “tell me about” / full report: write a complete advanced briefing with sections (identity, market, safety, holders, forensics, links). Never write a status report about tool counts.

Iron laws:
1. Never fabricate prices, holders, liquidity, or tx results.
2. If a tool failed, say it failed.
3. Never claim a swap or transfer landed. Quotes are previews until they sign in their wallet.
4. Never ask for a seed phrase or private key.
5. If they pasted a mint, that is the subject.
6. Casual chat = just talk. If tools ran, weave the facts in like you just looked them up.

Never say "N/N tools returned data" or "I ran live tools against existing backend functions".`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tfetch(url: string, init: RequestInit = {}, ms = 18000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t));
}

async function callOpenAiCompat(
  base: string,
  key: string,
  model: string,
  provider: string,
  messages: Msg[],
): Promise<string> {
  if (!key) throw new Error(`no ${provider} key`);
  if (!model) throw new Error(`no ${provider} model`);
  const r = await tfetch(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 1800,
      }),
    },
    22000,
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`${provider} ${r.status}`);
  const text = j?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${provider} empty`);
  return String(text);
}

async function* streamOpenAiCompat(
  base: string,
  key: string,
  model: string,
  provider: string,
  messages: Msg[],
): AsyncGenerator<string> {
  if (!key) throw new Error(`no ${provider} key`);
  const r = await tfetch(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 1800,
        stream: true,
      }),
    },
    28000,
  );
  if (!r.ok || !r.body) throw new Error(`${provider} ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let saw = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        if (!saw) throw new Error(`${provider} empty stream`);
        return;
      }
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          saw = true;
          yield delta;
        }
      } catch {
        // ignore malformed frames
      }
    }
  }
  if (!saw) throw new Error(`${provider} empty stream`);
}

async function callGemini(messages: Msg[], model: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("no gemini key");
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const rest = messages.filter((m) => m.role !== "system");
  const r = await tfetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: rest.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.5, maxOutputTokens: 1800 },
      }),
    },
    22000,
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const text = j?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("gemini empty");
  return String(text);
}

async function synthesize(messages: Msg[]): Promise<string> {
  const attempts: Array<() => Promise<string>> = [];
  for (const model of NVIDIA_MODELS) {
    for (const key of NVIDIA_API_KEYS) {
      attempts.push(() =>
        callOpenAiCompat(NVIDIA_BASE_URL, key, model, `nvidia:${model}`, messages),
      );
    }
  }
  if (XAI_API_KEY) {
    attempts.push(() =>
      callOpenAiCompat("https://api.x.ai/v1", XAI_API_KEY, XAI_MODEL, "grok", messages),
    );
  }
  attempts.push(() =>
    callOpenAiCompat(
      "https://api.groq.com/openai/v1",
      GROQ_API_KEY,
      GROQ_MODEL,
      "groq",
      messages,
    ),
  );
  for (const model of GEMINI_MODELS) {
    attempts.push(() => callGemini(messages, model));
  }
  attempts.push(() =>
    callOpenAiCompat(
      "https://openrouter.ai/api/v1",
      OPENROUTER_API_KEY,
      OPENROUTER_MODEL,
      "openrouter",
      messages,
    ),
  );
  const errors: string[] = [];
  for (const fn of attempts) {
    try {
      return await fn();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  console.error("orbitx synthesize failed", errors.join(" | "));
  throw new Error(errors.join(" | "));
}

function extractAddresses(text: string): string[] {
  return Array.from(new Set(text.match(BASE58_RE) ?? []));
}

function parseSolAmount(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*sol\b/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function slugName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function resolveKnownTool(raw: string): string | undefined {
  const dashed = slugName(raw);
  return (
    KNOWN_TOOLS.find((tool) => tool === dashed) ??
    KNOWN_TOOLS.find((tool) => tool.startsWith(dashed) && dashed.length >= 4)
  );
}

function extractMentions(message: string): string[] {
  const found: string[] = [];
  const add = (id?: string) => {
    if (id && !found.includes(id)) found.push(id);
  };
  const mentionRe = /@([a-z0-9][a-z0-9-]{0,40})/gi;
  let match: RegExpExecArray | null = mentionRe.exec(message);
  while (match) {
    add(resolveKnownTool(match[1]));
    match = mentionRe.exec(message);
  }
  const useRe = /use\s+([a-z0-9][a-z0-9\s/-]{1,48}?)(?:\s*:|\s+fetch|\s+run|\s+for\b|$)/gi;
  let useMatch: RegExpExecArray | null = useRe.exec(message);
  while (useMatch) {
    add(resolveKnownTool(useMatch[1]));
    useMatch = useRe.exec(message);
  }
  const lower = message.toLowerCase();
  if (lower.includes("use token data") || lower.includes("fetch on-chain and market metadata")) {
    add("token-data");
  }
  if (lower.includes("use og token scan") || lower.includes("@og-scan-token")) {
    add("og-scan-token");
  }
  if (lower.includes("use launch coin") || lower.includes("launch a coin")) {
    add("launch-coin");
  }
  if (lower.includes("use mint nft") || MINT_NFT_VERBS.test(message)) {
    add("nft-mint");
  }
  return found;
}

function wantsTools(message: string, mentions: string[]): boolean {
  if (mentions.length > 0) return true;
  if (ASK_FOR_TOOLS.test(message)) return true;
  return extractAddresses(message).length > 0;
}

function wantsFullReport(message: string): boolean {
  return extractAddresses(message).length > 0 && (
    TELL_ABOUT.test(message) ||
    /\b(scan|analyze|analyse|report|token|ca\b|mint)\b/i.test(message) ||
    extractAddresses(message).length > 0
  );
}

function planTools(message: string, intentHint?: string): string[] {
  const lower = message.toLowerCase();
  const addresses = extractAddresses(message);
  const tools: string[] = [];
  const trade = /\b(buy|sell|swap|trade|quote)\b/.test(lower);
  const wallet = /\b(wallet|pnl|portfolio|holdings)\b/.test(lower);
  const alert = /\b(alert|watch|notify)\b/.test(lower);
  const trending = /\b(trend|trending|momentum|movers|screen|gems)\b/.test(lower);
  const news = /\b(news|headline|narrative|kols?)\b/.test(lower);

  if (CREATE_LAUNCH_VERBS.test(message) || intentHint === "launch" && CREATE_LAUNCH_VERBS.test(message)) {
    return ["launch-coin"];
  }
  if (MINT_NFT_VERBS.test(message)) {
    return ["nft-mint"];
  }
  if (trade) tools.push("jupiter-quote", "jupiter-price");
  if (wallet) tools.push("og-wallet", "pnl-scan", "wallet-manager");
  if (alert) tools.push("alerts");
  if (trending) tools.push("token-data", "birdseye-analytics");
  if (news) tools.push("news-fetcher");
  if (/\b(launch|pump\.?fun|migrat)/.test(lower) && !CREATE_LAUNCH_VERBS.test(message)) {
    tools.push("pumpfun-migrations", "migration-watch", "token-data");
  }
  if (addresses.length > 0 || /\b(token|scan|analyze|ca\b|mint|tell me about)\b/.test(lower)) {
    tools.push(...FULL_TOKEN_REPORT);
  }
  if (intentHint === "analyze_token") tools.push(...FULL_TOKEN_REPORT);
  if (intentHint === "analyze_wallet") tools.push("og-wallet", "pnl-scan", "wallet-manager");
  if (intentHint === "screen") tools.push("token-data", "birdseye-analytics");
  if (intentHint === "news") tools.push("news-fetcher");
  if (intentHint === "launch") tools.push("pumpfun-migrations", "migration-watch");
  if (intentHint === "nft") tools.push("nft-mint");
  return Array.from(new Set(tools)).slice(0, 10);
}

async function callFn(
  name: string,
  body: Record<string, unknown>,
  jwt: string,
): Promise<unknown> {
  const r = await tfetch(
    `${SUPABASE_URL}/functions/v1/${name}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: ANON,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    25000,
  );
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: r.ok, raw: text.slice(0, 400) };
  }
}

function compact(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 8).map((item) => compact(item, depth + 1));
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 24)) {
      if (["content", "prompt", "messages", "system"].includes(key)) continue;
      out[key] = compact(item, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 400) return `${value.slice(0, 400)}…`;
  return value;
}

function cardsFromTool(toolId: string, result: unknown): ChatCard[] {
  if (!isRecord(result)) return [];
  if (toolId === "og-scan-token" && isRecord(result.token)) {
    const token = result.token;
    return [
      {
        kind: "token",
        title: String(token.symbol ?? token.name ?? "Token"),
        data: {
          mint: token.mint,
          symbol: token.symbol,
          price: token.priceUsd,
          marketCap: token.mcap,
          liquidity: token.liquidity,
          volume: token.buyVolume24h,
          risk: result.verdict,
        },
      },
    ];
  }
  if (toolId === "jupiter-quote" && (result.quote || result.success || result.outAmount)) {
    const quote = isRecord(result.quote) ? result.quote : result;
    const hops = Array.isArray(quote.routePlan) ? quote.routePlan.length : 0;
    return [
      {
        kind: "tx",
        title: "Swap quote preview",
        data: {
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          slippageBps: quote.slippageBps,
          status: "preview",
          route: hops > 0 ? `${hops} hop Jupiter` : "Jupiter",
          quoteJson: JSON.stringify(compact(quote)),
          inputMint: quote.inputMint,
          outputMint: quote.outputMint,
        },
      },
    ];
  }
  if (toolId === "og-wallet") {
    return [
      {
        kind: "wallet",
        title: "Wallet scan",
        data: {
          address: String(result.wallet ?? result.address ?? ""),
        },
      },
    ];
  }
  return [];
}

function fmtUsd(n: unknown): string | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(v < 1 ? 6 : 2)}`;
}

function pickStr(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() && value !== "[truncated]") {
      return value.trim();
    }
  }
  return null;
}

function pickNum(...values: unknown[]): number | null {
  for (const value of values) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function byTool(
  toolEvents: ToolEvent[],
  results: unknown[],
  id: string,
): unknown {
  const index = toolEvents.findIndex((event) => event.toolId === id);
  return index >= 0 ? results[index] : undefined;
}

function parseCreateDraft(text: string): {
  name: string | null;
  symbol: string | null;
  supply: string | null;
  description: string | null;
} {
  const named = text.match(
    /(?:named|called|name[:\s]+)\s*["']?([A-Za-z0-9][A-Za-z0-9 ._-]{1,39})["']?/i,
  );
  const ticker = text.match(/(?:ticker|symbol|\$)\s*[:\s]*([A-Za-z0-9]{2,12})/i);
  const supply = text.match(/(\d[\d,]{2,18})\s*(?:supply|tokens)?/i);
  const desc = text.match(/(?:desc(?:ription)?|about)[:\s]+(.{8,160})/i);
  return {
    name: named?.[1]?.trim() ?? null,
    symbol: ticker?.[1]?.toUpperCase() ?? null,
    supply: supply?.[1]?.replace(/,/g, "") ?? null,
    description: desc?.[1]?.trim() ?? null,
  };
}

function payloadForTool(
  toolId: string,
  message: string,
  addresses: string[],
  walletAddress?: string,
): Record<string, unknown> {
  const mint = addresses[0];
  const wallet = walletAddress ?? mint;
  if (toolId === "og-scan-token") {
    return { query: mint ?? message.slice(0, 80), source: "orbitx-ai" };
  }
  if (toolId === "token-data") {
    return mint
      ? { action: "get_metadata", token_address: mint }
      : { action: "trending" };
  }
  if (toolId === "token-safety") {
    return { mint: mint ?? message };
  }
  if (toolId === "og-holders") {
    return { mint, limit: 20 };
  }
  if (toolId === "og-wallet") {
    return { address: wallet, wallet };
  }
  if (toolId === "pnl-scan") {
    return { wallet, mint };
  }
  if (toolId === "jupiter-quote") {
    const sol = parseSolAmount(message) ?? 0.1;
    return {
      inputMint: SOL_MINT,
      outputMint: mint ?? SOL_MINT,
      amount: Math.round(sol * 1_000_000_000),
      slippageBps: 50,
    };
  }
  if (toolId === "jupiter-price") {
    return { ids: addresses.length > 0 ? addresses : [SOL_MINT] };
  }
  if (toolId === "jupiter-tokens") {
    return { query: mint ?? message.slice(0, 80) };
  }
  if (toolId === "alerts") {
    return { action: "parse", nl_request: message, mint };
  }
  if (
    toolId === "ogdex-xray" ||
    toolId === "ogdex-intel-v2" ||
    toolId === "ogdex-intel" ||
    toolId === "ogdex-firstbuyer"
  ) {
    return { mint: mint ?? message };
  }
  if (toolId === "wallet-manager") {
    return { action: "get_balance", wallet_address: wallet };
  }
  if (toolId === "solana-tracker") {
    return { wallet_address: wallet };
  }
  if (toolId === "news-fetcher") {
    return {};
  }
  if (toolId === "unified-intelligence" || toolId === "enhanced-intelligence") {
    return {
      messages: [{ role: "user", content: message }],
      context: mint ? `Analyze mint ${mint}` : message.slice(0, 160),
    };
  }
  if (toolId === "ai-analyzer") {
    return {
      action: "chat",
      messages: [{ role: "user", content: message }],
    };
  }
  if (toolId === "birdseye-analytics") {
    return mint
      ? { address: mint }
      : { address: SOL_MINT };
  }
  if (toolId === "pumpfun-migrations") {
    return { limit: 20 };
  }
  if (toolId === "migration-watch") {
    return { action: "list" };
  }
  if (toolId === "oxw-token-scan") {
    return { mint: mint ?? message };
  }
  return { query: message, mint, wallet };
}

function firstUsefulString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 24 && !trimmed.startsWith("{")) return trimmed.slice(0, 500);
  }
  if (!isRecord(value)) return null;
  for (const key of [
    "analysis",
    "summary",
    "narrative",
    "text",
    "answer",
    "insight",
    "verdict",
    "output",
    "reply",
  ]) {
    const hit = firstUsefulString(value[key]);
    if (hit) return hit;
  }
  if (isRecord(value.data)) return firstUsefulString(value.data);
  if (isRecord(value.result)) return firstUsefulString(value.result);
  return null;
}

function flattenFacts(value: unknown, prefix = ""): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    if (!text || text === "[truncated]" || text.startsWith("{")) return [];
    return [`${prefix}${text}`];
  }
  if (!isRecord(value)) return [];
  const facts: string[] = [];
  const prefer = [
    "symbol",
    "name",
    "price",
    "priceUsd",
    "marketCap",
    "mcap",
    "liquidity",
    "volume",
    "volume24h",
    "verdict",
    "risk",
    "holders",
    "supply",
    "mint",
  ];
  for (const key of prefer) {
    if (value[key] != null && value[key] !== "") {
      facts.push(`${key}: ${String(value[key])}`);
    }
  }
  if (facts.length === 0) {
    for (const [key, item] of Object.entries(value).slice(0, 8)) {
      facts.push(...flattenFacts(item, facts.length === 0 ? `${key} ` : ""));
    }
  }
  return facts.slice(0, 8);
}

function buildAdvancedReport(
  message: string,
  toolEvents: ToolEvent[],
  results: unknown[],
): string | null {
  const mint = extractAddresses(message)[0];
  const scan = byTool(toolEvents, results, "og-scan-token");
  const meta = byTool(toolEvents, results, "token-data");
  const safety = byTool(toolEvents, results, "token-safety");
  const holders = byTool(toolEvents, results, "og-holders");
  const price = byTool(toolEvents, results, "jupiter-price");
  const birds = byTool(toolEvents, results, "birdseye-analytics");
  const intel = byTool(toolEvents, results, "ogdex-intel-v2");
  const xray = byTool(toolEvents, results, "ogdex-xray");
  const first = byTool(toolEvents, results, "ogdex-firstbuyer");
  const enhanced = byTool(toolEvents, results, "enhanced-intelligence");

  const scanRec = isRecord(scan) ? scan : {};
  const token = isRecord(scanRec.token) ? scanRec.token : {};
  const metaRec = isRecord(meta) && isRecord(meta.token) ? meta.token : isRecord(meta) ? meta : {};
  const safetyRec = isRecord(safety) ? safety : {};
  const birdsRec = isRecord(birds) && isRecord(birds.data) ? birds.data : isRecord(birds) ? birds : {};
  const holdersRec = isRecord(holders) ? holders : {};
  const intelRec = isRecord(intel) ? intel : {};
  const priceMap = isRecord(price) && isRecord(price.data) ? price.data : isRecord(price) ? price : {};
  const mintPrice = mint && isRecord(priceMap[mint]) ? priceMap[mint] : {};

  const name = pickStr(token.name, metaRec.name, birdsRec.name);
  const symbol = pickStr(token.symbol, metaRec.symbol, birdsRec.symbol);
  const priceUsd = pickNum(
    token.priceUsd,
    birdsRec.price,
    isRecord(mintPrice) ? mintPrice.usdPrice : null,
  );
  const mcap = pickNum(token.mcap, token.marketCap, birdsRec.marketCap, safetyRec.marketCap);
  const fdv = pickNum(token.fdv, birdsRec.fdv);
  const liq = pickNum(token.liquidity, birdsRec.liquidityUsd, birdsRec.liquidity);
  const vol = pickNum(token.buyVolume24h, birdsRec.volume24h, token.volume);
  const change = pickNum(token.priceChange24h, birdsRec.priceChange24h);
  const holderCount = pickNum(
    token.holderCount,
    safetyRec.totalHolders,
    holdersRec.totalHolders,
    holdersRec.count,
  );
  const top10 = pickNum(
    token.topHoldersPct,
    safetyRec.top10RealHolderPct,
    holdersRec.top10pct,
    holdersRec.top10Pct,
  );
  const verdict = pickStr(
    typeof scanRec.verdict === "string" ? scanRec.verdict : null,
    typeof safetyRec.rugged === "boolean"
      ? safetyRec.rugged
        ? "RUGGED"
        : null
      : null,
  );
  const risk = pickNum(safetyRec.riskScore);
  const launchpad = pickStr(safetyRec.launchpad);
  const mintRenounced =
    safetyRec.mintAuthorityRenounced ??
    (isRecord(scanRec.flags) ? scanRec.flags.mintAuthorityDisabled : null);
  const freezeRenounced =
    safetyRec.freezeAuthorityRenounced ??
    (isRecord(scanRec.flags) ? scanRec.flags.freezeAuthorityDisabled : null);
  const lpLocked = pickNum(safetyRec.lpLockedPct);
  const dexUrl = pickStr(token.dexUrl, birdsRec.dexUrl);
  const supply = pickStr(
    token.totalSupply != null ? String(token.totalSupply) : null,
    metaRec.supply != null ? String(metaRec.supply) : null,
  );

  const hasCore =
    name || symbol || priceUsd != null || mcap != null || verdict || risk != null;
  if (!hasCore && !mint) return null;

  const lines: string[] = [];
  const title = [symbol ? `$${symbol}` : null, name && name !== symbol ? name : null]
    .filter(Boolean)
    .join(" · ") || (mint ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : "This token");
  lines.push(`${title} — live advanced report`);
  if (mint === "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9") {
    lines.push("This is the official $ORBITX mint.");
  }
  if (verdict) lines.push(`Verdict: ${verdict}`);
  lines.push("");
  lines.push("Market");
  if (priceUsd != null) {
    lines.push(
      `• Price ${fmtUsd(priceUsd)}${change != null ? ` (${change > 0 ? "+" : ""}${change.toFixed(1)}% 24h)` : ""}`,
    );
  }
  if (mcap != null) lines.push(`• Market cap ${fmtUsd(mcap)}`);
  if (fdv != null) lines.push(`• FDV ${fmtUsd(fdv)}`);
  if (liq != null) lines.push(`• Liquidity ${fmtUsd(liq)}`);
  if (vol != null) lines.push(`• 24h volume ${fmtUsd(vol)}`);
  if (supply) lines.push(`• Supply ${supply}`);
  if (holderCount != null) {
    lines.push(
      `• Holders ${holderCount}${top10 != null ? ` (top 10 ≈ ${top10}%)` : ""}`,
    );
  }

  lines.push("");
  lines.push("Safety");
  if (risk != null) lines.push(`• Rugcheck risk ${risk}`);
  if (mintRenounced != null) {
    lines.push(`• Mint authority ${mintRenounced ? "renounced" : "STILL ACTIVE"}`);
  }
  if (freezeRenounced != null) {
    lines.push(`• Freeze authority ${freezeRenounced ? "renounced" : "STILL ACTIVE"}`);
  }
  if (lpLocked != null) lines.push(`• LP locked ${lpLocked}%`);
  if (launchpad) lines.push(`• Launchpad ${launchpad}`);
  if (isRecord(safetyRec) && Array.isArray(safetyRec.risks) && safetyRec.risks.length > 0) {
    const risks = safetyRec.risks
      .slice(0, 5)
      .map((item) => (isRecord(item) ? pickStr(item.name, item.desc) : null))
      .filter((item): item is string => Boolean(item));
    if (risks.length) lines.push(`• Flags: ${risks.join("; ")}`);
  }

  const topHolders = Array.isArray(holdersRec.holders)
    ? holdersRec.holders
    : Array.isArray(safetyRec.topHolders)
      ? safetyRec.topHolders
      : Array.isArray(intelRec.holders)
        ? intelRec.holders
        : [];
  if (topHolders.length > 0) {
    lines.push("");
    lines.push("Top holders");
    for (const row of topHolders.slice(0, 5)) {
      if (!isRecord(row)) continue;
      const addr = pickStr(row.address, row.owner, row.wallet);
      const pct = pickNum(row.pct, row.percentage, row.percent);
      if (addr) {
        lines.push(`• ${addr.slice(0, 4)}…${addr.slice(-4)}${pct != null ? ` ${pct}%` : ""}`);
      }
    }
  }

  const firstRec = isRecord(first) ? first : {};
  const xrayRec = isRecord(xray) ? xray : {};
  const firstWallet = pickStr(
    firstRec.wallet,
    firstRec.address,
    isRecord(firstRec.firstBuyer) ? firstRec.firstBuyer.wallet : null,
  );
  if (firstWallet || isRecord(xrayRec) && (xrayRec.snipers || xrayRec.earlyBuyers)) {
    lines.push("");
    lines.push("Forensics");
    if (firstWallet) {
      lines.push(
        `• First buyer ${firstWallet.slice(0, 4)}…${firstWallet.slice(-4)} — https://solscan.io/account/${firstWallet}`,
      );
    }
    if (Array.isArray(xrayRec.snipers)) {
      lines.push(`• Snipers tagged: ${xrayRec.snipers.length}`);
    }
    if (Array.isArray(xrayRec.bundles)) {
      lines.push(`• Bundle clusters: ${xrayRec.bundles.length}`);
    }
  }

  const enhancedText = firstUsefulString(enhanced);
  if (enhancedText) {
    lines.push("");
    lines.push("Analyst note");
    lines.push(enhancedText.slice(0, 700));
  }

  if (mint) {
    lines.push("");
    lines.push("Links");
    lines.push(`• Solscan https://solscan.io/token/${mint}`);
    lines.push(`• DexScreener ${dexUrl ?? `https://dexscreener.com/solana/${mint}`}`);
    lines.push(`• CA \`${mint}\``);
  }

  const failed = toolEvents.filter((event) => event.status === "error");
  if (failed.length > 0) {
    lines.push("");
    lines.push(
      `Some live tools missed this turn (${failed.map((event) => event.toolId).join(", ")}). Numbers above are from the tools that returned.`,
    );
  }
  lines.push("");
  lines.push("NFA. DYOR.");
  return lines.join("\n");
}

function speakFromResults(
  message: string,
  toolEvents: ToolEvent[],
  results: unknown[],
): string {
  const mint = extractAddresses(message)[0];
  const launch = byTool(toolEvents, results, "launch-coin");
  if (isRecord(launch) && (launch.kind === "launch" || launch.preview === true)) {
    const name = pickStr(launch.name) ?? "your token";
    const symbol = pickStr(launch.symbol);
    const url = pickStr(launch.openUrl) ?? "https://pump.fun/create";
    return [
      `Launch draft for ${name}${symbol ? ` ($${symbol})` : ""}. Nothing was broadcast.`,
      `Open ${url} and sign the create tx in Phantom. I still need an image plus optional twitter/telegram if you want the metadata packed.`,
      pickStr(launch.note) ?? "A live launch only happens after your wallet signature.",
    ].join(" ");
  }
  const nft = byTool(toolEvents, results, "nft-mint");
  if (isRecord(nft) && (nft.kind === "nft_mint" || nft.preview === true)) {
    const name = pickStr(nft.name) ?? "your NFT";
    return [
      `NFT mint draft for ${name}. Nothing is minted yet.`,
      "You sign a Metaplex create in your wallet. I need name, symbol, and a metadata URI (or image) before we can build the unsigned tx.",
      pickStr(nft.openUrl) ?? "Use the OrbitX NFT hub when you're ready to sign.",
    ].join(" ");
  }

  const report = buildAdvancedReport(message, toolEvents, results);
  if (report) return report;

  if (toolEvents.length === 0) {
    if (mint) {
      return `That's ${mint.slice(0, 4)}…${mint.slice(-4)} — official $ORBITX if it matches 13H4…sPX9. I didn't get a live book on it that turn. Send it again and I'll pull the full stack.`;
    }
    return "Got you. Paste a mint for a full report, or say launch a coin / mint an NFT. @token-data, @og-scan-token, @jupiter-quote still work too.";
  }

  const bits: string[] = [];
  for (let i = 0; i < results.length; i += 1) {
    const event = toolEvents[i];
    const result = results[i];
    if (!event) continue;
    if (event.status === "error") {
      bits.push(`${event.label} didn't come back${event.detail ? ` (${event.detail})` : ""}.`);
      continue;
    }
    const useful = firstUsefulString(result);
    if (useful) {
      bits.push(useful);
      continue;
    }
    const facts = flattenFacts(result);
    if (facts.length > 0) {
      bits.push(`From ${event.label}: ${facts.join(" · ")}.`);
    }
  }
  if (bits.length === 0) {
    return `I ran ${toolEvents.map((event) => event.label).join(", ")}${mint ? ` on ${mint.slice(0, 4)}…${mint.slice(-4)}` : ""}. The payload came back thin — say that again and I'll retry the stack.`;
  }
  return bits.slice(0, 8).join("\n");
}

async function speakViaAnalyzer(
  jwt: string,
  message: string,
  toolContext: string,
): Promise<string> {
  const result = await callFn(
    "ai-analyzer",
    {
      action: "chat",
      messages: [
        {
          role: "user",
          content: `${
            extractAddresses(message).length > 0 || TELL_ABOUT.test(message)
              ? "Write a full advanced token briefing with sections. Use only the live context. Do not invent numbers."
              : "Speak in first person like a live chat, 2–6 short sentences."
          } User said: ${message}\n\nLive context:\n${toolContext || "(no tools this turn)"}`,
        },
      ],
    },
    jwt,
  );
  if (isRecord(result) && typeof result.error === "string") {
    throw new Error(result.error);
  }
  const text = firstUsefulString(result);
  if (!text) throw new Error("analyzer empty");
  return text;
}

function buildSpeakMessages(
  knowledge: string,
  history: Msg[],
  message: string,
  results: unknown[],
): Msg[] {
  let user = message;
  if (results.length > 0) {
    user += `\n\n[You just looked this up. If this is a mint or they asked for a report, write the FULL advanced briefing. Do not mention tool counts. Never invent numbers.]\n${JSON.stringify(results).slice(0, 7000)}`;
  }
  return [
    { role: "system", content: knowledge.slice(0, 2400) },
    ...history,
    { role: "user", content: user },
  ];
}

async function speakAll(
  messages: Msg[],
  jwt: string,
  userMessage: string,
  toolEvents: ToolEvent[],
  results: unknown[],
): Promise<string> {
  const report = speakFromResults(userMessage, toolEvents, results);
  const dead =
    /I'm here\. Ask me anything|N\/N tools returned|I ran live tools against|type @ and a tool/i;
  try {
    const text = await synthesize(messages);
    if (text && !dead.test(text)) {
      if (extractAddresses(userMessage).length > 0 && text.length < 320 && report.length > text.length) {
        return report;
      }
      return text;
    }
  } catch (error) {
    console.error("orbitx speak synthesize", error instanceof Error ? error.message : error);
  }
  try {
    const text = await speakViaAnalyzer(jwt, userMessage, JSON.stringify(results).slice(0, 4000));
    if (text && !dead.test(text)) {
      if (extractAddresses(userMessage).length > 0 && text.length < 320 && report.length > text.length) {
        return report;
      }
      return text;
    }
  } catch (error) {
    console.error("orbitx speak analyzer", error instanceof Error ? error.message : error);
  }
  return report;
}

function chunkWords(text: string, size = 3): string[] {
  const parts = text.split(/(\s+)/);
  const chunks: string[] = [];
  for (let i = 0; i < parts.length; i += size) {
    chunks.push(parts.slice(i, i + size).join(""));
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    const user = userData.user;
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    if (!message) return json({ error: "message required" }, 400);
    const stream = body.stream === true;

    const modelId = String(body.modelId || "orbitx-balanced");
    const page = String(body.page || "home");
    const walletAddress =
      typeof body.walletAddress === "string" ? body.walletAddress : undefined;
    const incomingPlan = isRecord(body.plan) ? body.plan : {};
    const requestedTools = Array.isArray(incomingPlan.toolIds)
      ? incomingPlan.toolIds.map(String)
      : [];
    const intent = String(incomingPlan.intent || "");
    const knowledge =
      typeof body.knowledge === "string" && body.knowledge.length > 0
        ? body.knowledge.slice(0, 2400)
        : CHAT_SYSTEM;

    let conversationId =
      typeof body.conversationId === "string" && UUID_RE.test(body.conversationId)
        ? body.conversationId
        : "";

    if (!conversationId) {
      const { data: conv, error: convError } = await userClient
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          wallet_address: walletAddress ?? null,
          title: message.slice(0, 48),
          model: modelId,
          metadata: { page },
        })
        .select("id")
        .single();
      if (convError || !conv) {
        return json({ error: convError?.message || "Could not create conversation" }, 400);
      }
      conversationId = String(conv.id);
    }

    const { data: lastMessage } = await userClient
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      !(
        lastMessage &&
        lastMessage.role === "user" &&
        String(lastMessage.content ?? "") === message
      )
    ) {
      await userClient.from("ai_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: message,
        model: modelId,
      });
    }

    const addresses = extractAddresses(message);
    const mentions = extractMentions(message);
    const live = wantsTools(message, mentions);
    const blocked = new Set([
      "jupiter-swap",
      "jupiter-order",
      "post-to-x",
      "x-poster",
      "nft-execute-sale",
    ]);
    let toolIds = (
      !live
        ? []
        : mentions.length > 0
          ? mentions
          : requestedTools.length > 0
            ? requestedTools
            : planTools(message, intent)
    ).filter((id) => !blocked.has(id));

    if (
      mentions.length === 0 &&
      addresses.length > 0 &&
      wantsFullReport(message) &&
      !toolIds.includes("launch-coin") &&
      !toolIds.includes("nft-mint") &&
      !toolIds.includes("jupiter-quote")
    ) {
      toolIds = Array.from(new Set([...toolIds, ...FULL_TOKEN_REPORT])).slice(0, 10);
    }

    const toolEvents: ToolEvent[] = toolIds.map((toolId) => ({
      id: `tool_${toolId}`,
      toolId,
      label: toolId.replace(/-/g, " "),
      status: "running" as const,
    }));
    const results: unknown[] = new Array(toolIds.length);
    const cards: ChatCard[] = [];

    await Promise.all(
      toolIds.map(async (toolId, index) => {
        const event = toolEvents[index];
        if (!event) return;
        const started = Date.now();
        try {
          let result: unknown;
          if (toolId === "launch-coin" || toolId === "nft-mint") {
            const draft = parseCreateDraft(message);
            const kind = toolId === "launch-coin" ? "launch" : "nft_mint";
            const openUrl =
              toolId === "launch-coin"
                ? "https://pump.fun/create"
                : "https://orbitx.world";
            const quote = {
              ...draft,
              wallet: walletAddress ?? null,
              note:
                toolId === "launch-coin"
                  ? "Draft only. Sign the pump.fun / OrbitX launchpad create tx in your wallet. Nothing was broadcast."
                  : "Draft only. Sign the Metaplex mint in your wallet. Nothing was minted.",
              openUrl,
            };
            const { data: intentRow } = await userClient
              .from("orbitx_ai_transaction_intents")
              .insert({
                user_id: user.id,
                conversation_id: conversationId,
                kind,
                status: "preview",
                quote,
              })
              .select("id")
              .single();
            result = {
              preview: true,
              kind,
              ...draft,
              openUrl,
              intentId: intentRow?.id ?? "",
              note: quote.note,
            };
            cards.push({
              kind: "tx",
              title: toolId === "launch-coin" ? "Launch draft" : "NFT mint draft",
              data: {
                status: "preview",
                name: draft.name ?? "",
                symbol: draft.symbol ?? "",
                openUrl,
                intentId: intentRow?.id ?? "",
              },
            });
          } else {
            const payload = payloadForTool(toolId, message, addresses, walletAddress);
            result = await callFn(toolId, payload, jwt);
            if (toolId === "jupiter-quote" && isRecord(result)) {
              const quote = isRecord(result.quote) ? result.quote : result;
              const { data: intentRow } = await userClient
                .from("orbitx_ai_transaction_intents")
                .insert({
                  user_id: user.id,
                  conversation_id: conversationId,
                  kind: "swap",
                  status: "preview",
                  input_mint: SOL_MINT,
                  output_mint: addresses[0] ?? null,
                  amount_raw: String(payload.amount ?? ""),
                  quote: compact(quote),
                })
                .select("id")
                .single();
              const hops = Array.isArray(quote.routePlan) ? quote.routePlan.length : 0;
              cards.push({
                kind: "tx",
                title: "Swap quote preview",
                data: {
                  inAmount: String(quote.inAmount ?? ""),
                  outAmount: String(quote.outAmount ?? ""),
                  slippageBps: quote.slippageBps ?? 50,
                  status: "preview",
                  route: hops > 0 ? `${hops} hop Jupiter` : "Jupiter",
                  intentId: intentRow?.id ?? "",
                  quoteJson: JSON.stringify(compact(quote)),
                  inputMint: SOL_MINT,
                  outputMint: addresses[0] ?? SOL_MINT,
                },
              });
            } else {
              cards.push(...cardsFromTool(toolId, result));
            }
          }

          results[index] = compact(result);
          event.status = "ok";
          await userClient.from("orbitx_ai_tool_executions").insert({
            user_id: user.id,
            conversation_id: conversationId,
            tool_id: toolId,
            status: "ok",
            duration_ms: Date.now() - started,
          });
        } catch (error) {
          event.status = "error";
          event.detail = error instanceof Error ? error.message : "tool failed";
          results[index] = { error: event.detail };
          await userClient.from("orbitx_ai_tool_executions").insert({
            user_id: user.id,
            conversation_id: conversationId,
            tool_id: toolId,
            status: "error",
            duration_ms: Date.now() - started,
            error_code: "invoke_failed",
          });
        }
      }),
    );

    const { data: historyRows } = await userClient
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(8);

    const history = Array.isArray(historyRows)
      ? [...historyRows]
          .reverse()
          .filter((row) => isRecord(row) && (row.role === "user" || row.role === "assistant"))
          .slice(0, -1)
          .map((row) => ({
            role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: String(row.content ?? "").slice(0, 500),
          }))
      : [];

    const speakMessages = buildSpeakMessages(knowledge, history, message, results);
    const title = message.slice(0, 48);

    const persist = async (text: string) => {
      await userClient.from("ai_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: text,
        model: modelId,
        tool_events: toolEvents,
        metadata: { cards, toolIds },
      });
      await userClient
        .from("ai_conversations")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    };

    if (stream) {
      const encoder = new TextEncoder();
      const streamBody = new ReadableStream({
        async start(controller) {
          const send = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          };
          try {
            if (toolEvents.length > 0) {
              send({ type: "tools", toolEvents });
            }
            let text = "";
            try {
              const streamers = [
                ...NVIDIA_MODELS.flatMap((model) =>
                  NVIDIA_API_KEYS.map(
                    (key) => () =>
                      streamOpenAiCompat(
                        NVIDIA_BASE_URL,
                        key,
                        model,
                        `nvidia:${model}`,
                        speakMessages,
                      ),
                  ),
                ),
                () =>
                  streamOpenAiCompat(
                    "https://api.groq.com/openai/v1",
                    GROQ_API_KEY,
                    GROQ_MODEL,
                    "groq",
                    speakMessages,
                  ),
              ];
              let streamed = false;
              for (const start of streamers) {
                try {
                  for await (const token of start()) {
                    text += token;
                    send({ type: "token", text: token });
                    streamed = true;
                  }
                  if (streamed) break;
                } catch (error) {
                  console.error(
                    "orbitx stream provider failed",
                    error instanceof Error ? error.message : error,
                  );
                  if (streamed) break;
                }
              }
              if (!streamed) {
                text = await speakAll(speakMessages, jwt, message, toolEvents, results);
                for (const chunk of chunkWords(text, 3)) {
                  send({ type: "token", text: chunk });
                }
              }
            } catch (error) {
              console.error(
                "orbitx stream speak failed",
                error instanceof Error ? error.message : error,
              );
              text = speakFromResults(message, toolEvents, results);
              for (const chunk of chunkWords(text, 3)) {
                send({ type: "token", text: chunk });
              }
            }
            await persist(text);
            send({
              type: "done",
              conversationId,
              text,
              toolEvents,
              cards,
              title,
            });
          } catch (error) {
            send({
              type: "error",
              error: error instanceof Error ? error.message : "stream failed",
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(streamBody, {
        headers: {
          ...cors,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    const text = await speakAll(speakMessages, jwt, message, toolEvents, results);
    await persist(text);

    return json({
      conversationId,
      text,
      toolEvents,
      cards,
      title,
    });
  } catch (error) {
    console.error("orbitx-ai-orchestrate failed", {
      name: error instanceof Error ? error.name : "error",
    });
    return json(
      {
        error: error instanceof Error ? error.message : "orchestrator error",
      },
      500,
    );
  }
});
