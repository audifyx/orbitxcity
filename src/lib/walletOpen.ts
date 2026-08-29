import { Platform } from "react-native";
import * as Linking from "expo-linking";

import { publicAppUrl } from "./env";
import { type WalletId } from "./wallets";

const PHANTOM_ANDROID_PACKAGE = "app.phantom";
const JUPITER_ANDROID_PACKAGE = "ag.jup.jupiter.android";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, host } = window.location;
    if (protocol === "https:" && host && !host.includes("localhost")) {
      return `${protocol}//${host}`;
    }
  }
  return publicAppUrl.replace(/\/$/, "");
}

export function connectPageUrl(walletId: WalletId): string {
  return `${appOrigin()}/connect?wallet=${walletId}`;
}

export function isMobileDevice(): boolean {
  if (Platform.OS !== "web") {
    return true;
  }
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isInsideWalletBrowser(walletId?: WalletId): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent.toLowerCase();
  const phantomUa = ua.includes("phantom");
  const jupiterUa =
    ua.includes("jupiter") || ua.includes("jup.ag") || ua.includes("jupmobile");

  if (walletId === "phantom") {
    return phantomUa;
  }
  if (walletId === "jupiter") {
    return jupiterUa;
  }
  return phantomUa || jupiterUa;
}

async function openFirst(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Try the next candidate. Do not use canOpenURL — Expo Go iOS
      // often returns false for wallet schemes that still open.
    }
  }
  return false;
}

function phantomBrowseUrls(target: string): string[] {
  const encodedTarget = encodeURIComponent(target);
  const encodedRef = encodeURIComponent(appOrigin());
  const path = `ul/browse/${encodedTarget}?ref=${encodedRef}`;
  const urls: string[] = [];

  if (Platform.OS === "android") {
    urls.push(
      `intent://${path}#Intent;scheme=https;host=phantom.app;package=${PHANTOM_ANDROID_PACKAGE};end`,
    );
  }

  urls.push(`https://phantom.app/${path}`);
  urls.push(`phantom://${path}`);
  return urls;
}

function jupiterBrowseUrls(target: string): string[] {
  const encoded = encodeURIComponent(target);
  const hostPath = target.replace(/^https?:\/\//, "");
  const urls: string[] = [];

  if (Platform.OS === "android") {
    urls.push(
      `intent://${hostPath}#Intent;scheme=https;package=${JUPITER_ANDROID_PACKAGE};end`,
    );
  }

  // Official public browse UL is not documented. Try the patterns Jupiter
  // and other Solana wallets have used, but never a bare jupiter:// home.
  urls.push(`https://jup.ag/ul/browse/${encoded}`);
  urls.push(`https://jup.ag/browse?url=${encoded}`);
  urls.push(`jupiter://ul/browse?url=${encoded}`);
  urls.push(`jupiter://dapp?url=${encoded}`);
  urls.push(`jup://ul/browse?url=${encoded}`);
  return urls;
}

export async function openWalletInAppBrowser(walletId: WalletId): Promise<void> {
  const target = connectPageUrl(walletId);
  const urls =
    walletId === "phantom" ? phantomBrowseUrls(target) : jupiterBrowseUrls(target);

  const opened = await openFirst(urls);
  if (opened) {
    await sleep(300);
    return;
  }

  throw new Error(
    walletId === "jupiter"
      ? "Could not open Jupiter. Open Jupiter, tap the globe, and go to orbitxcity.vercel.app."
      : "Could not open Phantom. Install Phantom and try again.",
  );
}
