import { Platform } from "react-native";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";

import { MWA_IDENTITY } from "./mwaIdentity";
import { isInsideWalletBrowser } from "./walletOpen";
import { prepareWalletStandard } from "./wallets";

let registered = false;

export function registerWebMwa(): void {
  if (registered || Platform.OS !== "web" || typeof navigator === "undefined") {
    return;
  }
  if (!/Android/i.test(navigator.userAgent)) {
    return;
  }
  if (isInsideWalletBrowser()) {
    return;
  }

  prepareWalletStandard();
  registered = true;
  registerMwa({
    appIdentity: MWA_IDENTITY,
    authorizationCache: createDefaultAuthorizationCache(),
    chains: ["solana:mainnet"],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
}
