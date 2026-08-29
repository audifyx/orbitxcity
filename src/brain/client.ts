import { resolveModelId } from "./models";
import { planFromUtterance } from "./planner";
import { AGENTS } from "./agents";
import { CHAT_SYSTEM } from "./knowledge";
import { TOOLS } from "./tools";

export type ChatCard = {
  kind: "token" | "wallet" | "tx";
  title: string;
  data: Record<string, unknown>;
};

export type ToolEvent = {
  id: string;
  toolId: string;
  label: string;
  status: "queued" | "running" | "ok" | "error";
  detail?: string;
};

export type OrchestrateRequest = {
  conversationId?: string;
  message: string;
  modelId: string;
  page?: string;
  tokenMint?: string;
  walletAddress?: string;
};

export type OrchestrateResponse = {
  conversationId: string;
  text: string;
  toolEvents: ToolEvent[];
  cards: ChatCard[];
  title?: string;
};

export type StreamEvent =
  | { type: "tools"; toolEvents: ToolEvent[] }
  | { type: "token"; text: string }
  | {
      type: "done";
      conversationId: string;
      text: string;
      toolEvents: ToolEvent[];
      cards: ChatCard[];
      title?: string;
    }
  | { type: "error"; error: string };

export type EdgeInvokeFn = (
  name: string,
  body: Record<string, unknown>,
) => Promise<unknown>;

export type EdgeStreamFn = (
  name: string,
  body: Record<string, unknown>,
  onEvent: (event: StreamEvent) => void,
) => Promise<unknown>;

export type StreamHandlers = {
  onTools?: (events: ToolEvent[]) => void;
  onToken?: (delta: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceOrchestrateResponse(
  raw: unknown,
  fallbackConversationId: string,
): OrchestrateResponse {
  if (!isRecord(raw)) {
    return {
      conversationId: fallbackConversationId,
      text: "Orchestrator returned an invalid response shape.",
      toolEvents: [],
      cards: [],
    };
  }

  const conversationId =
    typeof raw.conversationId === "string"
      ? raw.conversationId
      : fallbackConversationId;

  const text = typeof raw.text === "string" ? raw.text : "";

  const toolEvents: ToolEvent[] = Array.isArray(raw.toolEvents)
    ? raw.toolEvents.flatMap((item): ToolEvent[] => {
        if (!isRecord(item)) {
          return [];
        }
        const id = typeof item.id === "string" ? item.id : "";
        const toolId = typeof item.toolId === "string" ? item.toolId : "";
        const label = typeof item.label === "string" ? item.label : toolId;
        const status = item.status;
        if (
          !id ||
          !toolId ||
          (status !== "queued" &&
            status !== "running" &&
            status !== "ok" &&
            status !== "error")
        ) {
          return [];
        }
        return [
          {
            id,
            toolId,
            label,
            status,
            detail: typeof item.detail === "string" ? item.detail : undefined,
          },
        ];
      })
    : [];

  const cards: ChatCard[] = Array.isArray(raw.cards)
    ? raw.cards.flatMap((item): ChatCard[] => {
        if (!isRecord(item)) {
          return [];
        }
        const kind = item.kind;
        const title = typeof item.title === "string" ? item.title : "";
        const data = isRecord(item.data) ? item.data : {};
        if (
          !title ||
          (kind !== "token" && kind !== "wallet" && kind !== "tx")
        ) {
          return [];
        }
        return [{ kind, title, data }];
      })
    : [];

  const title = typeof raw.title === "string" ? raw.title : undefined;

  return { conversationId, text, toolEvents, cards, title };
}

function buildOrchestrateBody(req: OrchestrateRequest): {
  body: Record<string, unknown>;
  planToolIds: string[];
} {
  const modelId = resolveModelId(req.modelId);
  const plan = planFromUtterance(req.message, [...AGENTS], [...TOOLS]);
  const specialists = plan.toolIds.length
    ? plan.agentIds
        .map((id) => AGENTS.find((agent) => agent.id === id))
        .filter((agent): agent is (typeof AGENTS)[number] => Boolean(agent))
        .slice(0, 2)
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
          systemRole: agent.systemRole.slice(0, 220),
        }))
    : [];

  return {
    planToolIds: plan.toolIds,
    body: {
      conversationId: req.conversationId,
      message: req.message,
      modelId,
      page: req.page,
      tokenMint: req.tokenMint,
      walletAddress: req.walletAddress,
      knowledge: CHAT_SYSTEM,
      specialists,
      plan: {
        agentIds: plan.agentIds,
        toolIds: plan.toolIds,
        intent: plan.intent,
        notes: plan.notes,
      },
    },
  };
}

function failResponse(
  fallbackId: string,
  planToolIds: string[],
  detail: string,
): OrchestrateResponse {
  return {
    conversationId: fallbackId,
    text: `I couldn't reach the brain just then (${detail}). Say that again and I'll pick it up.`,
    toolEvents: planToolIds.map((toolId, index) => ({
      id: `err_${index}`,
      toolId,
      label: toolId,
      status: "error" as const,
      detail,
    })),
    cards: [],
    title: "Orchestration Error",
  };
}

export async function orchestrate(
  invoke: EdgeInvokeFn,
  req: OrchestrateRequest,
): Promise<OrchestrateResponse> {
  const fallbackId = req.conversationId ?? "";
  const { body, planToolIds } = buildOrchestrateBody(req);

  try {
    const raw = await invoke("orbitx-ai-orchestrate", body);
    return coerceOrchestrateResponse(raw, fallbackId);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown orchestration error";
    return failResponse(fallbackId, planToolIds, detail);
  }
}

function asStreamEvent(value: unknown): StreamEvent | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "token" && typeof value.text === "string") {
    return { type: "token", text: value.text };
  }
  if (value.type === "error" && typeof value.error === "string") {
    return { type: "error", error: value.error };
  }
  if (value.type === "tools") {
    const coerced = coerceOrchestrateResponse(
      { conversationId: "", text: "", toolEvents: value.toolEvents, cards: [] },
      "",
    );
    return { type: "tools", toolEvents: coerced.toolEvents };
  }
  if (value.type === "done") {
    const coerced = coerceOrchestrateResponse(value, "");
    return {
      type: "done",
      conversationId: coerced.conversationId,
      text: coerced.text,
      toolEvents: coerced.toolEvents,
      cards: coerced.cards,
      title: coerced.title,
    };
  }
  return null;
}

export async function orchestrateLive(
  invoke: EdgeInvokeFn,
  stream: EdgeStreamFn | undefined,
  req: OrchestrateRequest,
  handlers: StreamHandlers = {},
): Promise<OrchestrateResponse> {
  const fallbackId = req.conversationId ?? "";
  const { body, planToolIds } = buildOrchestrateBody(req);

  if (stream) {
    try {
      let latest: OrchestrateResponse | null = null;
      const raw = await stream("orbitx-ai-orchestrate", body, (event) => {
        if (event.type === "tools") {
          handlers.onTools?.(event.toolEvents);
        } else if (event.type === "token") {
          handlers.onToken?.(event.text);
        } else if (event.type === "done") {
          latest = {
            conversationId: event.conversationId || fallbackId,
            text: event.text,
            toolEvents: event.toolEvents,
            cards: event.cards,
            title: event.title,
          };
        }
      });
      if (latest) {
        return latest;
      }
      return coerceOrchestrateResponse(raw, fallbackId);
    } catch {
      // Fall through to a single JSON turn.
    }
  }

  try {
    const raw = await invoke("orbitx-ai-orchestrate", body);
    return coerceOrchestrateResponse(raw, fallbackId);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown orchestration error";
    return failResponse(fallbackId, planToolIds, detail);
  }
}

export { asStreamEvent };
