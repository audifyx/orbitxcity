export type SocialPostIntent = {
  kind: "tweet";
  text: string;
};

const TWEET_RE =
  /^(?:tweet|post to x|post on x|x post|post this on x)[:\s]+(.+)/is;

export function parseSocialPostIntent(text: string): SocialPostIntent | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(TWEET_RE);
  if (match?.[1]) {
    const body = match[1].trim();
    if (body.length > 0) {
      return { kind: "tweet", text: body.slice(0, 280) };
    }
  }

  if (/^tweet\b/i.test(trimmed) && trimmed.length > 6) {
    const body = trimmed.replace(/^tweet[:\s]*/i, "").trim();
    if (body.length > 0) {
      return { kind: "tweet", text: body.slice(0, 280) };
    }
  }

  return null;
}
