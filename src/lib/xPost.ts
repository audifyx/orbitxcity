import { invokeFunction } from "./supabase";

export type PostToXResult = {
  success: boolean;
  tweetId?: string;
  url?: string;
  text?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function postToX(text: string): Promise<PostToXResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Write something to post.");
  }

  const data = await invokeFunction("post-to-x", { text: trimmed.slice(0, 280) });
  const rec = asRecord(data);
  if (!rec) {
    throw new Error("X post failed — empty response.");
  }

  if (rec.error) {
    throw new Error(String(rec.error));
  }

  const tweetId =
    typeof rec.tweet_id === "string"
      ? rec.tweet_id
      : typeof rec.tweetId === "string"
        ? rec.tweetId
        : undefined;
  const url =
    typeof rec.url === "string"
      ? rec.url
      : tweetId
        ? `https://x.com/i/web/status/${tweetId}`
        : undefined;

  return {
    success: true,
    tweetId,
    url,
    text: typeof rec.text === "string" ? rec.text : trimmed,
  };
}
