let siwsTail: Promise<void> = Promise.resolve();

export function isMissingNonceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no nonce/i.test(message);
}

export function isTransientAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /503|504|timed out|timeout|aborted|failed to fetch|network request failed|can't reach|schema cache|could not query the database|could not store nonce|could not read nonce/i.test(
    message,
  );
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
