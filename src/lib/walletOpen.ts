import { Platform } from "react-native";

import { type WalletId } from "./wallets";

export function isMobileDevice(): boolean {
  return Platform.OS !== "web";
}

export function isInsideWalletBrowser(_walletId?: WalletId): boolean {
  return false;
}

export async function openWalletInAppBrowser(
  _walletId: WalletId,
  _targetUrl?: string,
): Promise<void> {
  throw new Error(
    "Use email or phone in the OrbitX app. Sign-in does not open a browser.",
  );
}

export async function openHostedAuth(_targetUrl?: string): Promise<void> {
  throw new Error(
    "Use email or phone in the OrbitX app. Sign-in does not open a browser.",
  );
}
