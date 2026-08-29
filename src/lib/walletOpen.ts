import { Platform } from "react-native";
import * as Linking from "expo-linking";

import {
  appOrigin,
  hostedAuthPageUrl,
  nativeAuthReturnUrl,
  type HostedWalletId,
} from "./hostedAuth";
import { type WalletId } from "./wallets";

const PHANTOM_ANDROID_PACKAGE = "app.phantom";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { appOrigin };

export function connectPageUrl(walletId: WalletId): string {
  return hostedAuthPageUrl(walletId, nativeAuthReturnUrl());
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

  // Jupiter has no browse universal link. Open the OrbitX sign-in page in
  // Chrome so Privy can launch Jupiter. Never open jup.ag/ul/browse.
  if (Platform.OS === "android") {
    urls.push(
      `intent://${hostPath}#Intent;scheme=https;package=com.android.chrome;end`,
    );
    urls.push(`googlechrome://navigate?url=${encoded}`);
  }

  urls.push(target);
  return urls;
}

export async function openWalletInAppBrowser(
  walletId: WalletId,
  targetUrl?: string,
): Promise<void> {
  const target = targetUrl ?? connectPageUrl(walletId);
  const urls =
    walletId === "phantom" ? phantomBrowseUrls(target) : jupiterBrowseUrls(target);

  const opened = await openFirst(urls);
  if (opened) {
    await sleep(300);
    return;
  }

  throw new Error(
    walletId === "jupiter"
      ? "Could not reach Jupiter. Install Jupiter Mobile and tap Connect again."
      : "Could not open Phantom. Install Phantom and try again.",
  );
}

export async function openHostedAuth(walletId: HostedWalletId): Promise<void> {
  const returnTo = nativeAuthReturnUrl();
  const target = hostedAuthPageUrl(walletId, returnTo);
  await openWalletInAppBrowser(walletId, target);
}
