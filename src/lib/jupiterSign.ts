import { signAndSendWithPrivy, signTransactionWithPrivy } from "./privyTx";

export async function signAndSendSwapTransaction(
  swapTransactionB64: string,
): Promise<string> {
  return signAndSendWithPrivy(swapTransactionB64);
}

export async function signSwapTransaction(
  swapTransactionB64: string,
): Promise<string> {
  return signTransactionWithPrivy(swapTransactionB64);
}
