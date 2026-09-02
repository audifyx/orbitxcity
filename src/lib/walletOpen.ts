import { Platform } from "react-native";
import * as Linking from "expo-linking";

import { publicAppUrl } from "./env";
import { type WalletId } from "./wallets";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function appOrigin(): string {
  return publicAppUrl.replace(/\/$/, "");
}

export function connectPageUrl(): string {
  return `${appOrigin()}/connect`;
}

export function isMobileDevice(): boolean {
  if (Platform.OS !== "web") return true;
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isInsideWalletBrowser(_walletId?: WalletId): boolean {
  return false;
}

export async function openWalletInAppBrowser(
  _walletId: WalletId,
  targetUrl?: string,
): Promise<void> {
  await openExternalUrl(targetUrl ?? connectPageUrl());
}

export async function openExternalUrl(url: string): Promise<void> {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof window.open === "function"
  ) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await Linking.openURL(url);
  await sleep(300);
}
