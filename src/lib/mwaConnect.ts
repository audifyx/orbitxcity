import { Buffer } from "buffer";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import { isSolanaPubkey, isSolanaSignature } from "./wallets";
import { MWA_CHAIN, MWA_IDENTITY } from "./mwaIdentity";

function isExpoGoRuntime(): boolean {
  const ownership = Constants.appOwnership;
  const environment = String(Constants.executionEnvironment ?? "");
  return ownership === "expo" || environment === "storeClient";
}

export function isNativeMwaSupported(): boolean {
  if (Platform.OS !== "android" || isExpoGoRuntime()) {
    return false;
  }

  const modules = NativeModules as Record<string, unknown>;
  return Boolean(modules.SolanaMobileWalletAdapter);
}

export function isMwaUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message === "MWA_UNAVAILABLE" ||
    /doesn't seem to be linked/i.test(message) ||
    /native module/i.test(message) ||
    /TurboModuleRegistry/i.test(message) ||
    /SolanaMobileWalletAdapter/i.test(message)
  );
}

function addressToBase58(address: string): string {
  if (isSolanaPubkey(address)) {
    return address.trim();
  }

  try {
    return new PublicKey(Buffer.from(address, "base64")).toBase58();
  } catch {
    throw new Error("Wallet did not return a valid public key.");
  }
}

function signatureToBase58(signed: Uint8Array, message: Uint8Array): string {
  const bytes =
    signed.length === 64
      ? signed
      : signed.length === message.length + 64
        ? signed.slice(message.length)
        : signed.slice(-64);

  const encoded = bs58.encode(bytes);
  if (!isSolanaSignature(encoded)) {
    throw new Error("Wallet did not return a valid signature.");
  }
  return encoded;
}

export async function connectAndSignWithMwa(
  requestMessage: (pubkey: string) => Promise<string>,
): Promise<{ pubkey: string; signature: string }> {
  if (Platform.OS !== "android") {
    throw new Error("MWA_UNAVAILABLE");
  }

  const { transact } = await import(
    "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
  );

  return transact(async (wallet) => {
    const authorization = await wallet.authorize({
      chain: MWA_CHAIN,
      identity: MWA_IDENTITY,
    });

    const account = authorization.accounts[0];
    if (!account?.address) {
      throw new Error("Wallet did not return an account.");
    }

    const pubkey = addressToBase58(account.address);
    const message = await requestMessage(pubkey);
    const payload = new TextEncoder().encode(message);
    const signed = await wallet.signMessages({
      addresses: [account.address],
      payloads: [payload],
    });

    const signatureBytes = signed[0];
    if (!signatureBytes) {
      throw new Error("Wallet did not return a signature.");
    }

    return {
      pubkey,
      signature: signatureToBase58(signatureBytes, payload),
    };
  });
}
