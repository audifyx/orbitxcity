export type CreateIntent =
  | {
      kind: "launch";
      name?: string;
      symbol?: string;
      description?: string;
    }
  | {
      kind: "nft";
      name?: string;
      symbol?: string;
      description?: string;
    };

const LAUNCH_RE =
  /\b(?:launch|create|deploy|start)\s+(?:a\s+)?(?:coin|token|memecoin)(?:\s+(?:on\s+)?pump\.?fun)?\b/i;
const NFT_RE = /\b(?:mint|create)\s+(?:an?\s+)?nft\b/i;

function parseNamed(text: string): string | undefined {
  const named = text.match(
    /(?:named|called|name[:\s]+)\s*["']?([A-Za-z0-9][A-Za-z0-9 ._-]{1,39})["']?/i,
  );
  return named?.[1]?.trim() || undefined;
}

function parseSymbol(text: string): string | undefined {
  const ticker = text.match(
    /(?:ticker|symbol|\$)\s*[:\s]*([A-Za-z0-9]{2,12})\b/i,
  );
  return ticker?.[1]?.toUpperCase() || undefined;
}

function parseDescription(text: string): string | undefined {
  const desc = text.match(/(?:desc(?:ription)?|about)[:\s]+(.{8,160})/i);
  return desc?.[1]?.trim() || undefined;
}

function fallbackName(text: string, kind: CreateIntent["kind"]): string {
  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const skip = new Set([
    "launch",
    "create",
    "deploy",
    "mint",
    "coin",
    "token",
    "memecoin",
    "nft",
    "pump",
    "fun",
    "named",
    "called",
    "ticker",
    "symbol",
  ]);
  const candidate = words.find((word) => !skip.has(word.toLowerCase()));
  return candidate
    ? candidate.charAt(0).toUpperCase() + candidate.slice(1)
    : kind === "launch"
      ? "OrbitX Coin"
      : "OrbitX Pass";
}

function fallbackSymbol(name: string, kind: CreateIntent["kind"]): string {
  const letters = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (letters.length >= 2) {
    return letters.slice(0, 6);
  }
  return kind === "launch" ? "ORB" : "PASS";
}

export function parseCreateIntent(text: string): CreateIntent | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const name = parseNamed(trimmed);
  const symbol = parseSymbol(trimmed);
  const description = parseDescription(trimmed);

  if (LAUNCH_RE.test(trimmed)) {
    const resolvedName = name ?? fallbackName(trimmed, "launch");
    return {
      kind: "launch",
      name: resolvedName,
      symbol: symbol ?? fallbackSymbol(resolvedName, "launch"),
      description,
    };
  }

  if (NFT_RE.test(trimmed)) {
    const resolvedName = name ?? fallbackName(trimmed, "nft");
    return {
      kind: "nft",
      name: resolvedName,
      symbol: symbol ?? fallbackSymbol(resolvedName, "nft"),
      description,
    };
  }

  return null;
}
