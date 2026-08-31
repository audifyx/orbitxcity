import { Platform } from "react-native";
import * as Linking from "expo-linking";
import bs58 from "bs58";

import { privyAppId, publicAppUrl } from "./env";

function isSolanaPubkey(value: string): boolean {
  try {
    return bs58.decode(value.trim()).length === 32;
  } catch {
    return false;
  }
}

function isSolanaSignature(value: string): boolean {
  try {
    return bs58.decode(value.trim()).length === 64;
  } catch {
    return false;
  }
}

export function appOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, host } = window.location;
    if (
      host &&
      !host.includes("localhost") &&
      !host.includes("exp.direct") &&
      !host.includes("exp.host") &&
      protocol !== "file:"
    ) {
      return `${protocol}//${host}`;
    }
  }
  return publicAppUrl.replace(/\/$/, "");
}

export function allowedHttpsOrigins(): string[] {
  const origins = new Set<string>([publicAppUrl.replace(/\/$/, "")]);
  if (typeof window !== "undefined" && window.location?.origin) {
    const host = window.location.host;
    if (
      host &&
      !host.includes("localhost") &&
      !host.includes("exp.direct") &&
      !host.includes("exp.host")
    ) {
      origins.add(window.location.origin.replace(/\/$/, ""));
    }
  }
  return [...origins];
}

export function isSafeAppReturn(
  value: string,
  httpsOrigins: string[] = allowedHttpsOrigins(),
): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    return false;
  }

  try {
    const url = new URL(trimmed);
    if (url.username || url.password) {
      return false;
    }

    if (url.protocol === "orbitx:") {
      const path = `${url.host}${url.pathname}`.replace(/\/+$/, "");
      return path === "auth" || path === "/auth" || path.endsWith("/auth");
    }

    if (url.protocol === "exp:" || url.protocol === "exps:") {
      return url.href.includes("/auth");
    }

    if (url.protocol === "https:" || url.protocol === "http:") {
      const origin = url.origin.replace(/\/$/, "");
      const allowed = httpsOrigins.some(
        (item) => item.replace(/\/$/, "") === origin,
      );
      return allowed && url.pathname.replace(/\/+$/, "") === "/auth";
    }
  } catch {
    return false;
  }

  return false;
}

export function parseAuthCallback(
  href: string,
): { pubkey: string; signature: string } | null {
  if (!href.trim()) {
    return null;
  }

  let params: URLSearchParams;
  try {
    const url = new URL(href);
    params = url.searchParams;
    if (!params.get("pubkey") && url.hash.includes("=")) {
      params = new URLSearchParams(url.hash.replace(/^#/, ""));
    }
  } catch {
    const query = href.split("?")[1] ?? href.split("#")[1] ?? "";
    params = new URLSearchParams(query);
  }

  const pubkey = (params.get("pubkey") ?? "").trim();
  const signature = (params.get("signature") ?? "").trim();
  if (!isSolanaPubkey(pubkey) || !isSolanaSignature(signature)) {
    return null;
  }
  return { pubkey, signature };
}

export function appendAuthResult(
  returnTo: string,
  result: { pubkey: string; signature: string },
): string {
  const url = new URL(returnTo);
  url.searchParams.set("pubkey", result.pubkey);
  url.searchParams.set("signature", result.signature);
  return url.toString();
}

export function hostedAuthPageUrl(returnTo: string): string {
  const url = new URL("/auth", `${appOrigin()}/`);
  url.searchParams.set("return", returnTo);
  url.searchParams.set("appId", privyAppId);
  return url.toString();
}

export function privyHostUrl(returnTo?: string): string {
  const url = new URL("/privy-host", `${appOrigin()}/`);
  url.searchParams.set("appId", privyAppId);
  if (returnTo && isSafeAppReturn(returnTo)) {
    url.searchParams.set("return", returnTo);
  }
  return url.toString();
}

/**
 * Public OrbitX web domain. Wallet key export must happen on an HTTPS origin
 * that is allow-listed in Privy (ogscan.fun is), never on the in-app or a
 * localhost origin — otherwise Privy's secure export iframe refuses to load
 * and the user lands on a non-routed/blocked page.
 */
export const OGSCAN_ORIGIN = "https://ogscan.fun";

/**
 * URL of the hosted wallet-export page on ogscan.fun. The `/privy-host` page is
 * served on this domain and, with `flow=export`, runs Privy's secure export
 * modal so users can reveal their embedded Solana private key.
 */
export function walletExportUrl(): string {
  const url = new URL("/privy-host", `${OGSCAN_ORIGIN}/`);
  url.searchParams.set("appId", privyAppId);
  url.searchParams.set("flow", "export");
  return url.toString();
}

export function nativeAuthReturnUrl(): string {
  return Linking.createURL("/auth");
}
