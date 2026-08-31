export type ClaimIntent = {
  kind: "claim";
};

const CLAIM_RE =
  /\b(?:claim|collect|withdraw)\s+(?:my\s+)?(?:creator\s+)?fees?\b/i;

export function parseClaimIntent(text: string): ClaimIntent | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (CLAIM_RE.test(trimmed)) {
    return { kind: "claim" };
  }
  if (/\bclaim\s+fees?\b/i.test(trimmed)) {
    return { kind: "claim" };
  }
  return null;
}
