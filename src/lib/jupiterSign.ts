import { signAndSendWithPrivy } from "./privyTx";

export async function signAndSendSwapTransaction(
  swapTransactionB64: string,
): Promise<string> {
  return signAndSendWithPrivy(swapTransactionB64);
}
