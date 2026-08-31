export function isPrivyConfigured(): boolean {
  return false;
}

export function consumePrivyHostResult(): { pubkey: string; signature: string } | null {
  return null;
}

export async function connectWithPrivy(): Promise<{
  pubkey: string;
  signature: string;
}> {
  throw new Error(
    "Use email or phone on this screen. OrbitX signs you in inside the app.",
  );
}
