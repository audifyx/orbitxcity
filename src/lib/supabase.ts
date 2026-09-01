import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { supabaseAnonKey, supabaseUrl } from "./env";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

const FUNCTION_TIMEOUT_MS = 60_000;
const FUNCTION_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted")
  );
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  attempts = FUNCTION_RETRIES,
): Promise<Response> {
  let lastError: Error = new Error("Request failed");

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrl(input), {
        ...init,
        signal: controller.signal,
      });

      if (isRetryableStatus(response.status) && attempt < attempts) {
        await sleep(400 * attempt);
        continue;
      }

      return response;
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? new Error("OrbitX sign-in timed out. Try again.")
          : error instanceof Error
            ? error
            : new Error("Request failed");

      if (attempt < attempts && isRetryableNetworkError(error)) {
        await sleep(400 * attempt);
        continue;
      }

      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

const functionHeaders = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  "Content-Type": "application/json",
};

const webAuthStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithRetry,
  },
  auth: {
    storage: Platform.OS === "web" ? webAuthStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function invokeFunction(
  name: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error("Connect your wallet to use OrbitX.");
  }

  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context && typeof context === "object" && "clone" in context) {
      try {
        const detail = await (context as Response).clone().json() as unknown;
        if (detail && typeof detail === "object") {
          const record = detail as Record<string, unknown>;
          const serverMessage =
            (typeof record.error === "string" && record.error) ||
            (typeof record.message === "string" && record.message);
          if (serverMessage) {
            throw new Error(serverMessage);
          }
        }
      } catch (detailError) {
        if (detailError instanceof Error && detailError.message !== error.message) {
          throw detailError;
        }
      }
    }
    throw new Error(error.message ?? `Edge function "${name}" failed`);
  }

  return data;
}

export async function invokeFunctionStream(
  name: string,
  body: Record<string, unknown>,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<unknown> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Connect your wallet to use OrbitX.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail.slice(0, 280) || `Edge function "${name}" failed`);
    }

    if (!contentType.includes("text/event-stream") || !response.body) {
      return (await response.json()) as unknown;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastDone: Record<string, unknown> | null = null;

    const flushBlock = (block: string) => {
      const lines = block.split("\n");
      const dataLines = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) {
        return;
      }
      const payload = dataLines.join("\n");
      if (payload === "[DONE]") {
        return;
      }
      try {
        const parsed = JSON.parse(payload) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const rec = parsed as Record<string, unknown>;
          onEvent(rec);
          if (rec.type === "done") {
            lastDone = rec;
          }
        }
      } catch {
        // Partial SSE frames are ignored until the next flush.
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        flushBlock(block);
      }
    }
    if (buffer.trim()) {
      flushBlock(buffer);
    }
    return lastDone;
  } finally {
    clearTimeout(timer);
  }
}

export async function walletAuth(
  action: "nonce" | "verify",
  payload: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetchWithRetry(`${supabaseUrl}/functions/v1/wallet-auth`, {
    method: "POST",
    headers: functionHeaders,
    body: JSON.stringify({ action, ...payload }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `wallet-auth ${action} failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function warmWalletAuth(): Promise<void> {
  try {
    await walletAuth("nonce", {
      pubkey: "11111111111111111111111111111111",
    });
  } catch {
    // Warm-up only. The next user-facing call retries.
  }
}
