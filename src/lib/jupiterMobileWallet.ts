import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const APP_IDENTITY = {
  name: "OrbitX",
  uri: "https://orbitxcity.vercel.app",
};

function addressToBase58(address: string): string {
  return bs58.encode(Uint8Array.from(Buffer.from(address, "base64")));
}

export async function connectJupiterMobileWallet(): Promise<string> {
  return transact(async (wallet) => {
    const authorization = await wallet.authorize({
      identity: APP_IDENTITY,
      chain: "solana:mainnet",
    });
    const account = authorization.accounts[0];
    if (!account?.address) {
      throw new Error("Jupiter Wallet did not return a Solana account.");
    }
    return addressToBase58(account.address);
  });
}

export async function signAndSendJupiterMobileTransaction(
  transaction: Uint8Array,
): Promise<string> {
  return transact(async (wallet) => {
    const authorization = await wallet.authorize({
      identity: APP_IDENTITY,
      chain: "solana:mainnet",
    });
    const signed = await wallet.signAndSendTransactions({
      transactions: [VersionedTransaction.deserialize(transaction)],
      commitment: "confirmed",
      waitForCommitmentToSendNextTransaction: true,
    });
    const signature = signed[0];
    if (!signature) {
      throw new Error("Jupiter Wallet did not return a transaction signature.");
    }
    void authorization;
    return signature;
  });
}
