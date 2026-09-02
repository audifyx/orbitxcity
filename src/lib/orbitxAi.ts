import { supabase } from "./supabase";

const ORBITX_AI_URL = "https://www.orbitx.world/api/orbitx-ai";

export type AiToolEvent = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: "completed" | "failed" | "confirmation_required" | "executing" | "cancelled";
  result: unknown;
  expiresAt?: string;
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  model?: string | null;
  toolEvents: AiToolEvent[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AiConversation = {
  id: string;
  title: string;
  model: string;
  walletAddress?: string | null;
  archived: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AiGate = {
  hasAccess: boolean;
  meetsRequirement?: boolean;
  exempt?: boolean;
  message?: string;
  wallet?: string | null;
  holdingUsd?: number;
  minUsd?: number;
  accessSource?: string | null;
};

export type AiBootstrap = {
  ok: boolean;
  gate: AiGate;
  walletAddress: string | null;
  models: Array<{ id: string; label: string }>;
  defaultModel: string;
  conversations: AiConversation[];
  generations: unknown[];
  tools: Array<{
    name: string;
    description: string;
    category: string;
    requiresConfirmation: boolean;
    parameters: unknown[];
  }>;
};

type ApiError = { error?: string; message?: string; gate?: AiGate };

export class OrbitXAiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly gate?: AiGate,
  ) {
    super(message);
    this.name = "OrbitXAiError";
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new OrbitXAiError("Sign in to use OrbitX AI.", 401);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 115_000,
): Promise<T> {
  const headers = await authHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${ORBITX_AI_URL}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      signal: init.signal || controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as T & ApiError;
    if (!response.ok) {
      throw new OrbitXAiError(
        payload.message || payload.error || `OrbitX AI request failed (${response.status})`,
        response.status,
        payload.gate,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new OrbitXAiError("OrbitX AI took too long to respond. Try again.", 408);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function post<T>(action: string, body: Record<string, unknown>, timeoutMs?: number): Promise<T> {
  return request<T>("", {
    method: "POST",
    body: JSON.stringify({ action, ...body }),
  }, timeoutMs);
}

export async function bootstrapOrbitXAi(): Promise<AiBootstrap> {
  return request<AiBootstrap>("?action=bootstrap", { method: "GET" }, 45_000);
}

export async function fetchAiMessages(
  conversationId: string,
): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
  return request(`?action=messages&conversationId=${encodeURIComponent(conversationId)}`, { method: "GET" }, 45_000);
}

export async function sendAiMessage(payload: {
  conversationId?: string | null;
  message: string;
  model?: string;
}): Promise<{
  ok: boolean;
  conversation: AiConversation;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
}> {
  return post("chat", payload);
}

export async function createAiConversation(model?: string): Promise<{ conversation: AiConversation }> {
  return post("conversation", { operation: "create", model: model || "" }, 30_000);
}

export async function executeAiTool(payload: {
  conversationId: string;
  messageId: string;
  eventId: string;
}): Promise<{ ok: boolean; event: AiToolEvent; message?: AiMessage | null }> {
  return post("tool.execute", payload);
}

export async function cancelAiTool(payload: {
  conversationId: string;
  messageId: string;
  eventId: string;
}): Promise<{ ok: boolean; event: AiToolEvent }> {
  return post("tool.cancel", payload, 30_000);
}
