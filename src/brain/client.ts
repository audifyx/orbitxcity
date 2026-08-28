import { resolveModelId } from "./models";
import { planFromUtterance } from "./planner";
import { AGENTS } from "./agents";
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

export type EdgeInvokeFn = (
  name: string,
  body: Record<string, unknown>,
) => Promise<unknown>;

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

export async function orchestrate(
  invoke: EdgeInvokeFn,
  req: OrchestrateRequest,
): Promise<OrchestrateResponse> {
  const modelId = resolveModelId(req.modelId);
  const fallbackId = req.conversationId ?? "";
  const plan = planFromUtterance(req.message, [...AGENTS], [...TOOLS]);

  const body: Record<string, unknown> = {
    conversationId: req.conversationId,
    message: req.message,
    modelId,
    page: req.page,
    tokenMint: req.tokenMint,
    walletAddress: req.walletAddress,
    plan: {
      agentIds: plan.agentIds,
      toolIds: plan.toolIds,
      intent: plan.intent,
      notes: plan.notes,
    },
  };

  try {
    const raw = await invoke("orbitx-ai-orchestrate", body);
    return coerceOrchestrateResponse(raw, fallbackId);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown orchestration error";

    return {
      conversationId: fallbackId,
      text: `OrbitX could not reach the orchestrator (${detail}). No trade or write action was performed.`,
      toolEvents: plan.toolIds.map((toolId, index) => ({
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
}
