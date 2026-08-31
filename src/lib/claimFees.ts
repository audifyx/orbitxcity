import { Buffer } from "buffer";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { solanaRpcUrl } from "./env";
import { signAndSendWithPrivy } from "./privyTx";
import { isSolanaPubkey } from "./wallets";

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_TRADE_LOCAL = "https://pumpportal.fun/api/trade-local";

export function pumpCreatorVaultPda(creator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM_ID,
  )[0];
}

export async function getPumpClaimableSol(wallet: string): Promise<number> {
  if (!isSolanaPubkey(wallet)) {
    return 0;
  }
  const connection = new Connection(solanaRpcUrl, "confirmed");
  const creator = new PublicKey(wallet);
  const vault = pumpCreatorVaultPda(creator);
  const [balance, rentFloor] = await Promise.all([
    connection.getBalance(vault),
    connection.getMinimumBalanceForRentExemption(0),
  ]);
  return Math.max(0, balance - rentFloor) / LAMPORTS_PER_SOL;
}

export async function claimPumpCreatorFees(
  wallet: string,
): Promise<{ signature: string; claimedSol: number }> {
  if (!isSolanaPubkey(wallet)) {
    throw new Error("Sign in before claiming creator fees.");
  }

  const claimable = await getPumpClaimableSol(wallet);
  if (claimable <= 0) {
    throw new Error("No pump.fun creator fees to claim right now.");
  }

  const response = await fetch(PUMP_TRADE_LOCAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: wallet,
      action: "collectCreatorFee",
      priorityFee: 0.000001,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Claim build failed (${response.status}): ${message || response.statusText}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const transactionB64 = Buffer.from(bytes).toString("base64");
  const signature = await signAndSendWithPrivy(transactionB64);
  return { signature, claimedSol: claimable };
}
