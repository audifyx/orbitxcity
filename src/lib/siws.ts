let siwsTail: Promise<void> = Promise.resolve();

export function isMissingNonceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no nonce/i.test(message);
}

export async function withSiwsLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void = () => undefined;
  const previous = siwsTail;
  siwsTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
