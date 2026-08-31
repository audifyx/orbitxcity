import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AGENTS,
  DEFAULT_MODEL_ID,
  MODELS,
  SKILLS,
  TOOLS,
  asStreamEvent,
  orchestrateLive,
  planFromUtterance,
  rewriteLegacyToolPrompt,
  searchSkills,
  type OrbitXModelId,
} from "../brain";
import type { ToolCategory as BrainToolCategory } from "../brain/types";
import {
  CommandPalette,
  Composer,
  EmptyHome,
  MessageList,
  ModelSheet,
  ToolSheet,
  type CommandResult,
  type Message,
  type MessageCard,
  type ToolCategory,
} from "../components";
import { useAuth } from "../lib/auth";
import {
  confirmSignature,
  fetchSwapTransaction,
  parseQuoteJson,
  signAndSendSwapTransaction,
} from "../lib/jupiter";
import {
  invokeFunction,
  invokeFunctionStream,
  supabase,
} from "../lib/supabase";
import { colors } from "../theme";

const CATEGORY_MAP: Record<BrainToolCategory, ToolCategory> = {
  trade: "TRADE",
  intelligence: "INTELLIGENCE",
  create: "CREATE",
  social: "SOCIAL",
  monitor: "MONITOR",
  orbitx: "ORBITX",
  defi: "DEFI",
  wallet: "WALLET",
  knowledge: "KNOWLEDGE",
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function flattenCardData(
  data: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else if (value != null) {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

function cardFromUnknown(item: unknown): MessageCard[] {
  if (typeof item !== "object" || item === null) return [];
  const rec = item as Record<string, unknown>;
  return [
    {
      kind: String(rec.kind ?? "token"),
      title: String(rec.title ?? "Card"),
      data:
        typeof rec.data === "object" && rec.data !== null
          ? flattenCardData(rec.data as Record<string, unknown>)
          : {},
    },
  ];
}

function patchCardStatus(
  messages: Message[],
  matcher: (card: MessageCard) => boolean,
  patch: Record<string, string | number | boolean | undefined>,
): Message[] {
  return messages.map((message) => ({
    ...message,
    cards: message.cards?.map((card) =>
      matcher(card)
        ? { ...card, data: { ...card.data, ...patch } }
        : card,
    ),
  }));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export type ChatThreadProps = {
  conversationId?: string;
  initialContext?: string;
  page?: string;
  onConversationCreated?: (id: string) => void;
};

export function ChatThread({
  conversationId: initialConversationId,
  initialContext,
  page = "home",
  onConversationCreated,
}: ChatThreadProps) {
  const insets = useSafeAreaInsets();
  const { userId, wallet } = useAuth();
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelId, setModelId] = useState<OrbitXModelId>(DEFAULT_MODEL_ID);
  const [draft, setDraft] = useState(initialContext ?? "");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(
    Boolean(initialConversationId),
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [toolSheetOpen, setToolSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingHistory(true);
    setStorageError(null);
    try {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("id, role, content, created_at, metadata, tool_events")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) {
        setStorageError(error.message);
        return;
      }

      const mapped: Message[] = (data ?? []).map((row) => {
        const meta =
          typeof row.metadata === "object" && row.metadata !== null
            ? (row.metadata as Record<string, unknown>)
            : {};
        const events = Array.isArray(row.tool_events)
          ? row.tool_events
          : Array.isArray(meta.toolEvents)
            ? meta.toolEvents
            : [];
        const cards = Array.isArray(meta.cards) ? meta.cards : [];
        return {
          id: String(row.id),
          role: (row.role as Message["role"]) ?? "assistant",
          content: String(row.content ?? ""),
          toolEvents: events.flatMap((item) => {
            if (typeof item !== "object" || item === null) return [];
            const rec = item as Record<string, unknown>;
            const status = rec.status;
            if (
              status !== "queued" &&
              status !== "running" &&
              status !== "ok" &&
              status !== "error"
            ) {
              return [];
            }
            return [
              {
                id: String(rec.id ?? rec.toolId ?? "tool"),
                label: String(rec.label ?? rec.toolId ?? "Tool"),
                status,
              },
            ];
          }),
          cards: cards.flatMap(cardFromUnknown),
        };
      });
      setMessages(mapped);
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (initialConversationId) {
      void loadMessages(initialConversationId);
    }
  }, [initialConversationId, loadMessages]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ensureConversation = useCallback(
    async (firstMessage: string): Promise<string | undefined> => {
      if (conversationId && isUuid(conversationId)) {
        return conversationId;
      }

      try {
        const { data, error } = await supabase
          .from("ai_conversations")
          .insert({
            title: firstMessage.trim().slice(0, 48) || "New conversation",
            model: modelId,
            user_id: userId ?? undefined,
            wallet_address: wallet ?? undefined,
          })
          .select("id")
          .single();

        if (error) {
          setStorageError(error.message);
          return undefined;
        }

        const id = String(data.id);
        setConversationId(id);
        onConversationCreated?.(id);
        return id;
      } catch (err) {
        setStorageError(
          err instanceof Error ? err.message : "Failed to create conversation",
        );
        return undefined;
      }
    },
    [conversationId, modelId, onConversationCreated, userId, wallet],
  );

  const handleSend = useCallback(async () => {
    const text = rewriteLegacyToolPrompt(draft.trim(), [...TOOLS]);
    if (!text || sending) {
      return;
    }

    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
    };

    const assistantId = `assistant-${Date.now()}`;
    const plan = planFromUtterance(text, [...AGENTS], [...TOOLS]);
    const plannedEvents = plan.toolIds.map((toolId) => ({
      id: `tool_${toolId}`,
      label: toolId.replace(/-/g, " "),
      status: "running" as const,
    }));

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        toolEvents: plannedEvents,
      },
    ]);
    setDraft("");
    setSending(true);
    setStorageError(null);

    const convId = await ensureConversation(text);
    let streamed = "";

    const patchAssistant = (patch: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, ...patch } : message,
        ),
      );
    };

    const reveal = async (full: string) => {
      if (streamed.length > 0) {
        patchAssistant({ content: full, streaming: false });
        return;
      }
      const chunks = full.split(/(\s+)/);
      let acc = "";
      for (const chunk of chunks) {
        acc += chunk;
        patchAssistant({ content: acc, streaming: true });
        await sleep(16);
      }
      patchAssistant({ content: full, streaming: false });
    };

    const result = await orchestrateLive(
      invokeFunction,
      Platform.OS === "web"
        ? async (name, body, onEvent) => {
            return invokeFunctionStream(name, body, (raw) => {
              const event = asStreamEvent(raw);
              if (!event) {
                return;
              }
              if (event.type === "token") {
                streamed += event.text;
                patchAssistant({ content: streamed, streaming: true });
              }
              if (event.type === "tools") {
                patchAssistant({
                  toolEvents: event.toolEvents.map((item) => ({
                    id: item.id,
                    label: item.label,
                    status: item.status,
                  })),
                });
              }
              onEvent(event);
            });
          }
        : undefined,
      {
        message: text,
        modelId,
        page,
        conversationId: convId,
        walletAddress: wallet ?? undefined,
      },
    );

    await reveal(result.text);

    patchAssistant({
      content: result.text,
      streaming: false,
      toolEvents: result.toolEvents.map((event) => ({
        id: event.id,
        label: event.label,
        status: event.status,
      })),
      cards: result.cards.map((card) => ({
        kind: card.kind,
        title: card.title,
        data: flattenCardData(card.data),
      })),
    });

    if (result.conversationId && isUuid(result.conversationId)) {
      setConversationId(result.conversationId);
      onConversationCreated?.(result.conversationId);
    }

    setSending(false);
  }, [
    draft,
    sending,
    ensureConversation,
    modelId,
    page,
    wallet,
    onConversationCreated,
  ]);

  const matchTxCard = useCallback((card: MessageCard, target: MessageCard) => {
    if (target.data.intentId && card.data.intentId) {
      return card.data.intentId === target.data.intentId;
    }
    return (
      card.kind === "tx" &&
      card.data.quoteJson === target.data.quoteJson &&
      card.data.inAmount === target.data.inAmount
    );
  }, []);

  const handleCancelTx = useCallback(
    async (card: MessageCard) => {
      const intentId = String(card.data.intentId ?? "");
      setMessages((prev) =>
        patchCardStatus(prev, (item) => matchTxCard(item, card), {
          status: "failed",
        }),
      );
      if (intentId && isUuid(intentId)) {
        await supabase
          .from("orbitx_ai_transaction_intents")
          .update({ status: "failed", error_code: "cancelled" })
          .eq("id", intentId);
      }
    },
    [matchTxCard],
  );

  const handleConfirmTx = useCallback(
    async (card: MessageCard) => {
      if (!wallet) {
        setStorageError("Sign in before signing a swap.");
        return;
      }
      const quote = parseQuoteJson(card.data.quoteJson);
      if (!quote) {
        setStorageError("This preview has no Jupiter quote payload to sign.");
        return;
      }
      const intentId = String(card.data.intentId ?? "");
      const patch = (status: string, extra?: Record<string, string>) => {
        setMessages((prev) =>
          patchCardStatus(prev, (item) => matchTxCard(item, card), {
            status,
            ...extra,
          }),
        );
      };

      patch("awaiting_signature");
      try {
        const swapTx = await fetchSwapTransaction({
          quoteResponse: quote,
          userPublicKey: wallet,
        });
        patch("submitted");
        const signature = await signAndSendSwapTransaction(swapTx);
        if (intentId && isUuid(intentId)) {
          await supabase
            .from("orbitx_ai_transaction_intents")
            .update({ status: "submitted", signature })
            .eq("id", intentId);
        }
        patch("confirming", { signature });

        let outcome: "confirmed" | "failed" | "pending" = "pending";
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await sleep(2000);
          outcome = await confirmSignature(signature);
          if (outcome !== "pending") break;
        }

        if (outcome === "confirmed") {
          if (intentId && isUuid(intentId)) {
            await supabase
              .from("orbitx_ai_transaction_intents")
              .update({ status: "confirmed" })
              .eq("id", intentId);
          }
          patch("confirmed", { signature });
        } else if (outcome === "failed") {
          if (intentId && isUuid(intentId)) {
            await supabase
              .from("orbitx_ai_transaction_intents")
              .update({ status: "failed", error_code: "rpc_err" })
              .eq("id", intentId);
          }
          patch("failed", { signature });
        } else {
          if (intentId && isUuid(intentId)) {
            await supabase
              .from("orbitx_ai_transaction_intents")
              .update({ status: "submitted", signature })
              .eq("id", intentId);
          }
          patch("submitted", { signature });
          setStorageError(
            `Swap broadcast (${signature.slice(0, 8)}…). RPC has not confirmed it yet — not marked successful.`,
          );
        }
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Swap signing failed";
        setStorageError(detail);
        patch("failed");
        if (intentId && isUuid(intentId)) {
          await supabase
            .from("orbitx_ai_transaction_intents")
            .update({ status: "failed", error_code: "sign_failed" })
            .eq("id", intentId);
        }
      }
    },
    [matchTxCard, wallet],
  );

  const selectedModel = MODELS.find((model) => model.id === modelId) ?? MODELS[0];

  const paletteResults: CommandResult[] = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    const tools = TOOLS.filter((tool) =>
      q.length === 0
        ? true
        : `${tool.name} ${tool.description}`.toLowerCase().includes(q),
    )
      .slice(0, 6)
      .map((tool) => ({
        id: `tool:${tool.id}`,
        title: tool.name,
        subtitle: tool.description,
        kind: "tool" as const,
      }));
    const agents = AGENTS.filter((agent) =>
      q.length === 0
        ? true
        : `${agent.name} ${agent.description}`.toLowerCase().includes(q),
    )
      .slice(0, 6)
      .map((agent) => ({
        id: `agent:${agent.id}`,
        title: agent.name,
        subtitle: agent.description,
        kind: "agent" as const,
      }));
    const skills = (q.length === 0 ? SKILLS.slice(0, 6) : searchSkills(q, 6)).map(
      (skill) => ({
        id: `skill:${skill.id}`,
        title: skill.name,
        subtitle: skill.summary,
        kind: "skill" as const,
      }),
    );
    const actions: CommandResult[] = [
      {
        id: "nav:wallet",
        title: "Wallet",
        subtitle: "Connected wallet and logout",
        kind: "action",
      },
      {
        id: "nav:settings",
        title: "Settings",
        subtitle: "Model, memory, and permissions",
        kind: "action",
      },
    ];
    return [...actions, ...skills, ...tools, ...agents];
  }, [paletteQuery]);

  const sheetTools = TOOLS.map((tool) => ({
    id: tool.id,
    name: tool.name,
    category: CATEGORY_MAP[tool.category],
    description: tool.description,
  }));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={styles.threadHeader}>
        <Text style={styles.headerKicker}>ORBITX AGENT</Text>
        {Platform.OS !== "web" ? (
          <Pressable
            style={styles.searchButton}
            onPress={() => setPaletteOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open command palette"
          >
            <Text style={styles.searchIcon}>⌕</Text>
          </Pressable>
        ) : (
          <Text style={styles.shortcut}>⌘K</Text>
        )}
      </View>

      {storageError ? (
        <View style={styles.storageBanner}>
          <Text style={styles.storageBannerText}>{storageError}</Text>
        </View>
      ) : null}

      <View style={styles.messagesArea}>
        {loadingHistory ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.signal} />
          </View>
        ) : messages.length === 0 ? (
          <EmptyHome onSuggestionPress={setDraft} />
        ) : (
          <MessageList
            messages={messages}
            onConfirmTx={(card) => void handleConfirmTx(card)}
            onCancelTx={(card) => void handleCancelTx(card)}
            onRegenerate={() => {
              const lastUser = [...messages]
                .reverse()
                .find((message) => message.role === "user");
              if (lastUser) {
                setDraft(lastUser.content);
              }
            }}
          />
        )}
      </View>

      <View
        style={[
          styles.composerWrap,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => void handleSend()}
          loading={sending}
          modelLabel={selectedModel?.label ?? "Balanced"}
          onModelPress={() => setModelSheetOpen(true)}
          onToolsPress={() => setToolSheetOpen(true)}
          mentionTools={TOOLS.map((tool) => ({ id: tool.id, name: tool.name }))}
        />
      </View>

      <ModelSheet
        visible={modelSheetOpen}
        models={MODELS.map((model) => ({
          id: model.id,
          label: model.label,
          description: model.description,
        }))}
        selectedId={modelId}
        onSelect={(id) => setModelId(id as OrbitXModelId)}
        onClose={() => setModelSheetOpen(false)}
      />

      <ToolSheet
        visible={toolSheetOpen}
        tools={sheetTools}
        onSelect={(id) => {
          const tool = TOOLS.find((item) => item.id === id);
          if (tool) {
            setDraft((prev) => {
              const base = prev.replace(/@([a-z0-9-]*)$/i, "").trimEnd();
              return `${base}${base ? " " : ""}@${tool.id} `;
            });
          }
          setToolSheetOpen(false);
        }}
        onClose={() => setToolSheetOpen(false)}
      />

      <CommandPalette
        visible={paletteOpen}
        query={paletteQuery}
        onChangeQuery={setPaletteQuery}
        results={paletteResults}
        onPick={(id) => {
          if (id.startsWith("nav:")) {
            router.push(`/${id.slice(4)}` as "/trending");
          } else if (id.startsWith("tool:")) {
            const tool = TOOLS.find((item) => item.id === id.slice(5));
            if (tool) setDraft(`@${tool.id} `);
          } else if (id.startsWith("skill:")) {
            const skill = SKILLS.find((item) => item.id === id.slice(6));
            if (skill) {
              setDraft(skill.triggers[0] ?? skill.name);
            }
          } else if (id.startsWith("agent:")) {
            const agent = AGENTS.find((item) => item.id === id.slice(6));
            if (agent) setDraft(`Run the ${agent.name} agent`);
          }
          setPaletteOpen(false);
        }}
        onClose={() => setPaletteOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerKicker: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchIcon: {
    color: colors.ice,
    fontSize: 18,
  },
  shortcut: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1,
  },
  storageBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 140, 90, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 160, 120, 0.28)",
  },
  storageBannerText: {
    color: "#FFB899",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  messagesArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.abyss,
  },
});
