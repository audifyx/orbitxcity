import { Platform } from "react-native";
import * as Linking from "expo-linking";

import {
  appOrigin,
  hostedAuthPageUrl,
  nativeAuthReturnUrl,
} from "./hostedAuth";
import { type WalletId } from "./wallets";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { appOrigin };

export function connectPageUrl(): string {
  return hostedAuthPageUrl(nativeAuthReturnUrl());
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

export function isInsideWalletBrowser(_walletId?: WalletId): boolean {
  return false;
}

export async function openWalletInAppBrowser(
  _walletId: WalletId,
  targetUrl?: string,
): Promise<void> {
  await openHostedAuth(targetUrl);
}

export async function openHostedAuth(targetUrl?: string): Promise<void> {
  const target = targetUrl ?? connectPageUrl();
  try {
    await Linking.openURL(target);
    await sleep(300);
  } catch {
    throw new Error(
      "Could not open OrbitX sign-in. Check your connection and try again.",
    );
  }
}
