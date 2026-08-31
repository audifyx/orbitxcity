import { isSolanaPubkey } from "./wallets";

const BLOCK_RE =
  /\b(buy|sell|swap|trade|launch|mint|tweet|post|claim|limit)\b/i;

const PORTFOLIO_PATTERNS = [
  /\b(?:my|our)\s+(?:full\s+)?(?:portfolio|holdings|positions|bag|balances?)\b/i,
  /\bwhat(?:'s|\s+is)?\s+(?:in\s+)?(?:my|our)\s+(?:portfolio|wallet|bag|holdings?)\b/i,
  /\bwhat\s+(?:am\s+i|do\s+i|are\s+we)\s+(?:holding|hold)\b/i,
  /\bshow\s+(?:me\s+)?(?:my\s+)?(?:portfolio|holdings|bag|positions?)\b/i,
  /\b(?:pull|get|check|load)\s+(?:my\s+)?(?:portfolio|holdings|bag)\b/i,
  /\bhow\s+much\s+(?:sol|money|usd)\s+(?:do\s+i|am\s+i)\s+have\b/i,
  /\beverything\s+(?:i(?:'m|\s+am)\s+)?holding\b/i,
];

export type PortfolioIntent = {
  kind: "portfolio";
};

export function parsePortfolioIntent(text: string): PortfolioIntent | null {
  const trimmed = text.trim();
  if (!trimmed || BLOCK_RE.test(trimmed)) {
    return null;
  }

  const addresses = trimmed
    .split(/\s+/)
    .map((part) => part.replace(/[.,!?]+$/g, ""))
    .filter((part) => isSolanaPubkey(part));
  const looksLikeMyWallet =
    /\b(my|our|me)\b/i.test(trimmed) || addresses.length === 0;
  if (addresses.length > 0 && !looksLikeMyWallet) {
    return null;
  }

  if (PORTFOLIO_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { kind: "portfolio" };
  }

  if (/^(?:portfolio|holdings|my\s+bag|positions|my\s+balance)$/i.test(trimmed)) {
    return { kind: "portfolio" };
  }

  return null;
}
