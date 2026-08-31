const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NftBuyIntent = {
  kind: "nft_buy";
  listingId: string;
};

export function parseNftBuyIntent(text: string): NftBuyIntent | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (!/\bbuy\s+(?:the\s+)?nft\b/i.test(trimmed)) {
    return null;
  }
  const tokens = trimmed.split(/\s+/);
  const listingId = tokens.find((token) => UUID_RE.test(token));
  if (!listingId) {
    return null;
  }
  return { kind: "nft_buy", listingId };
}
