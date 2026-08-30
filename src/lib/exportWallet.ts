import { privyAppId, publicAppUrl } from "./env";
import { isSolanaPubkey } from "./wallets";

export const EXPORT_CHANNEL = "orbitx-export-v1";

export type ExportPageStatus = "success" | "error" | "closed";

export type ExportPageResult = {
  status: ExportPageStatus;
  error?: string;
};

export function buildExportPageUrl(address: string, appUrl = publicAppUrl): string {
  const trimmed = address.trim();
  if (!isSolanaPubkey(trimmed)) {
    throw new Error("Cannot export: wallet address is invalid.");
  }

  const url = new URL("/wallet-export", `${appUrl.replace(/\/+$/, "")}/`);
  url.searchParams.set("appId", privyAppId);
  url.searchParams.set("address", trimmed);
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseExportMessage(raw: string): ExportPageResult | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const rec = asRecord(parsed);
  if (!rec || rec.source !== EXPORT_CHANNEL) {
    return null;
  }

  if (
    rec.status !== "success" &&
    rec.status !== "error" &&
    rec.status !== "closed"
  ) {
    return null;
  }

  const error =
    typeof rec.error === "string" && rec.error.trim()
      ? rec.error.trim().slice(0, 280)
      : undefined;

  return {
    status: rec.status,
    error,
  };
}
