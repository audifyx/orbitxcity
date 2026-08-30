import { useEffect, type ReactNode } from "react";
import { Buffer } from "buffer";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { PrivyProvider, useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";

import { privyAppId, privyClientId, solanaRpcUrl } from "./env";
import { setPrivySignOnly, setPrivyTransactionSigner } from "./privyTx";
import { formatCaughtSwapError } from "./swapGuard";
import { isSolanaPubkey } from "./wallets";

let logoutPrivyImpl: (() => Promise<void>) | null = null;

export async function logoutPrivySession(): Promise<void> {
  if (!logoutPrivyImpl) {
    return;
  }
  await logoutPrivyImpl();
}

function decodeTransaction(transactionB64: string): Transaction | VersionedTransaction {
  const bytes = Uint8Array.from(Buffer.from(transactionB64, "base64"));
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

function PrivySessionBinder({ children }: { children: ReactNode }) {
  const { logout } = usePrivy();
  const solana = useEmbeddedSolanaWallet();

  useEffect(() => {
    logoutPrivyImpl = logout;
    return () => {
      if (logoutPrivyImpl === logout) {
        logoutPrivyImpl = null;
      }
    };
  }, [logout]);

  useEffect(() => {
    const wallet = (solana.wallets ?? []).find((item) => isSolanaPubkey(item.address));
    if (!wallet) {
      setPrivyTransactionSigner(null);
      setPrivySignOnly(null);
      return;
    }

    setPrivyTransactionSigner(async (transactionB64) => {
      try {
        const provider = await wallet.getProvider();
        const connection = new Connection(solanaRpcUrl, "processed");
        const result = await provider.request({
          method: "signAndSendTransaction",
          params: {
            transaction: decodeTransaction(transactionB64),
            connection,
          },
        });
        const signature =
          result && typeof result === "object" && "signature" in result
            ? String(result.signature)
            : "";
        if (!signature) {
          throw new Error("Privy did not return a transaction signature.");
        }
        return signature;
      } catch (error) {
        throw new Error(await formatCaughtSwapError(error));
      }
    });

    setPrivySignOnly(async (transactionB64) => {
      const provider = await wallet.getProvider();
      const decoded = decodeTransaction(transactionB64);
      const result = await provider.request({
        method: "signTransaction",
        params: { transaction: decoded },
      });
      const signed: unknown =
        result && typeof result === "object" && "signedTransaction" in result
          ? result.signedTransaction
          : result;
      if (signed instanceof Uint8Array) {
        return Buffer.from(signed).toString("base64");
      }
      if (
        signed &&
        typeof signed === "object" &&
        "serialize" in signed &&
        typeof (signed as { serialize?: unknown }).serialize === "function"
      ) {
        const bytes = (signed as { serialize: () => Uint8Array }).serialize();
        return Buffer.from(bytes).toString("base64");
      }
      if (typeof signed === "string" && signed.length > 20) {
        return signed;
      }
      throw new Error("Privy did not return a signed transaction.");
    });

    return () => {
      setPrivyTransactionSigner(null);
      setPrivySignOnly(null);
    };
  }, [solana.wallets]);

  return <>{children}</>;
}

export function OrbitxPrivyProvider({ children }: { children: ReactNode }) {
  if (!privyAppId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId || undefined}
      config={{
        embedded: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "all-users" },
        },
      }}
    >
      <PrivySessionBinder>{children}</PrivySessionBinder>
    </PrivyProvider>
  );
}
