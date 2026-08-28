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
  TOOLS,
  orchestrate,
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
  type ToolCategory,
} from "../components";
import { useAuth } from "../lib/auth";
import { invokeFunction, supabase } from "../lib/supabase";
import { colors } from "../theme";

const CATEGORY_MAP: Record<BrainToolCategory, ToolCategory> = {
  trade: "TRADE",
  intelligence: "INTELLIGENCE",
  create: "CREATE",
  social: "SOCIAL",
  monitor: "MONITOR",
  orbitx: "ORBITX",
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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
          cards: cards.flatMap((item) => {
            if (typeof item !== "object" || item === null) return [];
            const rec = item as Record<string, unknown>;
            return [
              {
                kind: String(rec.kind ?? "token"),
                title: String(rec.title ?? "Card"),
                data:
                  typeof rec.data === "object" && rec.data !== null
                    ? (rec.data as Record<string, string | number | boolean | undefined>)
                    : {},
              },
            ];
          }),
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
    const text = draft.trim();
    if (!text || sending) {
      return;
    }

    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setSending(true);
    setStorageError(null);

    const convId = await ensureConversation(text);

    setMessages((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        role: "assistant",
        content: "Working…",
        toolEvents: [{ id: "plan", label: "Planning", status: "running" }],
      },
    ]);

    const result = await orchestrate(invokeFunction, {
      message: text,
      modelId,
      page,
      conversationId: convId,
      walletAddress: wallet ?? undefined,
    });

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: result.text,
      toolEvents: result.toolEvents.map((event) => ({
        id: event.id,
        label: event.label,
        status: event.status,
      })),
      cards: result.cards.map((card) => ({
        kind: card.kind,
        title: card.title,
        data: Object.fromEntries(
          Object.entries(card.data).map(([key, value]) => [
            key,
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
              ? value
              : undefined,
          ]),
        ),
      })),
    };

    setMessages((prev) =>
      prev.filter((message) => !message.id.startsWith("pending-")).concat(assistantMessage),
    );

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
    const actions: CommandResult[] = [
      {
        id: "nav:trending",
        title: "Trending",
        subtitle: "Live Solana market intelligence",
        kind: "action",
      },
      {
        id: "nav:wallet",
        title: "Wallet",
        subtitle: "Portfolio command center",
        kind: "action",
      },
    ];
    return [...actions, ...tools, ...agents];
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
        <Text style={styles.headerKicker}>ORBITX INTELLIGENCE</Text>
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
            setDraft(`Use ${tool.name}: ${tool.description}`);
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
            if (tool) setDraft(`Use ${tool.name}`);
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
