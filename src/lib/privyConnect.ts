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
  throw new Error("Email or phone sign-in is only available on the OrbitX website.");
}
