export async function signAndSendSwapTransaction(
  _swapTransactionB64: string,
): Promise<string> {
  throw new Error(
    "Live swaps currently sign with injected Phantom in a browser. Native Universal Link swap signing is not enabled — this is not a simulated fill.",
  );
}
