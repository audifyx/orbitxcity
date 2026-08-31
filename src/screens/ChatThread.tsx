import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  asStreamEvent,
  orchestrateLive,
  planFromUtterance,
  rewriteLegacyToolPrompt,
  type OrbitXModelId,
} from "../brain";
import type { ToolCategory as BrainToolCategory } from "../brain/types";
import {
  ApproveSheet,
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
import { readAutoApproveBuys, writeAutoApproveBuys } from "../lib/autoApprove";
import { claimPumpCreatorFees, getPumpClaimableSol } from "../lib/claimFees";
import { parseClaimIntent } from "../lib/claimIntent";
import { resolveCreateFields } from "../lib/createFields";
import { parseCreateIntent } from "../lib/createIntent";
import {
  executeDexSwap,
  resolveTradeAmount,
  SOL_MINT,
} from "../lib/dexTrade";
import { cancelLimitOrder, createLimitOrder } from "../lib/limitOrders";
import { parseTradeIntent } from "../lib/tradeIntent";
import { voiceForLimitOrder, voiceForMarketTrade, voiceForClaimFees } from "../lib/tradeVoice";
import {
  formatSwapError,
  prefetchBuyAmount,
  suggestBuySol,
} from "../lib/swapGuard";
import { isSolanaPubkey } from "../lib/wallets";
import { mintOrbitxNft, buyOrbitxNft } from "../lib/nftMarket";
import { parseNftBuyIntent } from "../lib/nftBuyIntent";
import { createPumpToken } from "../lib/pumpfun";
import { getPrivyWalletAddress } from "../lib/privyTx";
import { parseSocialPostIntent } from "../lib/socialPostIntent";
import { postToX } from "../lib/xPost";
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
  const [instantBuy, setInstantBuy] = useState(true);
  const [approveOpen, setApproveOpen] = useState(false);
  const autoFired = useRef<Set<string>>(new Set());
  const tradeBusy = useRef(false);

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

  const runJupiterTrade = useCallback(
    async (input: {
      mint: string;
      side: "buy" | "sell";
      amount?: number;
      percent?: number;
      card?: MessageCard;
    }) => {
      if (!isSolanaPubkey(input.mint) || input.mint === SOL_MINT) {
        setStorageError("This card has no token mint to swap.");
        return;
      }
      if (!wallet) {
        setStorageError("Sign in before trading.");
        return;
      }
      if (!getPrivyWalletAddress()) {
        setStorageError("Stay signed in — your OrbitX wallet is still loading.");
        return;
      }
      if (tradeBusy.current) {
        return;
      }
      tradeBusy.current = true;

      let amount = 0;
      try {
        amount = await resolveTradeAmount({
          wallet,
          side: input.side,
          mint: input.mint,
          amount: input.amount,
          percent: input.percent,
        });
      } catch (error) {
        setStorageError(formatSwapError(error));
        tradeBusy.current = false;
        return;
      }

      const localId = `trade-${Date.now()}`;
      const startVoice = voiceForMarketTrade({
        side: input.side,
        phase: "start",
        percent: input.percent,
      });
      if (!input.card) {
        setMessages((prev) => [
          ...prev,
          {
            id: localId,
            role: "assistant",
            content: startVoice,
            cards: [
              {
                kind: "tx",
                title: input.side === "sell" ? "Sell" : "Buy",
                data: {
                  status: "submitted",
                  side: input.side,
                  mint: input.mint,
                  amount,
                  percent: input.percent,
                  route: "Jupiter",
                  compact: true,
                },
              },
            ],
          },
        ]);
      }
      const matches = (card: MessageCard) =>
        input.card
          ? matchTxCard(card, input.card)
          : card.kind === "tx" &&
            card.data.mint === input.mint &&
            card.data.amount === amount &&
            (String(card.data.status) === "submitted" ||
              String(card.data.status) === "awaiting_signature");
      const patch = (
        status: string,
        extra?: Record<string, string | number | boolean | undefined>,
      ) => {
        setMessages((prev) => patchCardStatus(prev, matches, { status, ...extra }));
      };
      if (input.card) {
        patch("awaiting_signature");
      }
      setStorageError(null);
      try {
        const result = await executeDexSwap({
          wallet,
          side: input.side,
          mint: input.mint,
          amount,
        });
        patch("confirmed", {
          signature: result.signature,
          tx: result.signature,
          inAmount: result.quote.inAmount,
          outAmount: result.quote.outAmount,
          compact: true,
        });
        const successVoice = voiceForMarketTrade({
          side: input.side,
          phase: "success",
          percent: input.percent,
          signature: result.signature,
        });
        setMessages((prev) =>
          prev.map((message) =>
            message.cards?.some(matches)
              ? { ...message, content: successVoice }
              : message,
          ),
        );
      } catch (error) {
        const detail = formatSwapError(error);
        setStorageError(detail);
        patch("failed");
        setMessages((prev) =>
          prev.map((message) =>
            message.cards?.some(matches)
              ? {
                  ...message,
                  content: voiceForMarketTrade({
                    side: input.side,
                    phase: "fail",
                  }),
                }
              : message,
          ),
        );
      } finally {
        tradeBusy.current = false;
      }
    },
    [matchTxCard, wallet],
  );

  const placeLimitOrder = useCallback(
    async (input: {
      mint: string;
      side: "buy" | "sell";
      percent?: number;
      amountSol?: number;
      triggerType: "mcap" | "price";
      triggerValue: number;
    }) => {
      if (!wallet) {
        setStorageError("Sign in before trading.");
        return;
      }
      try {
        const order = await createLimitOrder({
          wallet,
          mint: input.mint,
          side: input.side,
          percent: input.percent,
          amountSol: input.amountSol,
          triggerType: input.triggerType,
          triggerValue: input.triggerValue,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `limit-${order.id}`,
            role: "assistant",
            content: voiceForLimitOrder(order, "create"),
            cards: [
              {
                kind: "order",
                title: input.side === "buy" ? "Limit buy" : "Limit sell",
                data: {
                  orderId: order.id,
                  side: order.side,
                  percent: order.percent,
                  amountSol: order.amountSol,
                  triggerType: order.triggerType,
                  triggerValue: order.triggerValue,
                  mint: order.mint,
                  status: order.status,
                },
              },
            ],
          },
        ]);
        setStorageError(null);
      } catch (error) {
        setStorageError(formatSwapError(error));
      }
    },
    [wallet],
  );

  const runCreateAction = useCallback(
    async (input: {
      kind: "launch" | "nft";
      name?: string;
      symbol?: string;
      description?: string;
      card?: MessageCard;
    }) => {
      const signingWallet = getPrivyWalletAddress() ?? wallet;
      if (!signingWallet) {
        setStorageError("Stay signed in — your OrbitX wallet is still loading.");
        return;
      }
      if (tradeBusy.current) {
        return;
      }
      tradeBusy.current = true;
      setStorageError(null);

      const { name, symbol } = resolveCreateFields(
        input.kind,
        input.name,
        input.symbol,
      );
      const description = String(input.description ?? "");
      const localId = `create-${Date.now()}`;
      const matches = (card: MessageCard) =>
        input.card ? card === input.card : false;

      if (input.card) {
        setMessages((prev) =>
          patchCardStatus(prev, matches, { status: "signing", name, symbol }),
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: localId,
            role: "assistant",
            content:
              input.kind === "launch"
                ? `Got you — launching ${name} on pump.fun with your OrbitX wallet.`
                : `On it — minting ${name} with your OrbitX wallet.`,
            cards: [
              {
                kind: input.kind,
                title: name,
                data: { status: "signing", name, symbol },
              },
            ],
          },
        ]);
      }

      try {
        if (input.kind === "launch") {
          let initialBuySol = 0;
          try {
            initialBuySol = await suggestBuySol(signingWallet);
          } catch {
            initialBuySol = 0;
          }
          const created = await createPumpToken({
            wallet: signingWallet,
            name,
            symbol,
            description,
            initialBuySol,
          });
          const success = `Launched $${symbol} · ${created.mint}`;
          setStorageError(success);
          setMessages((prev) =>
            prev.map((message) => {
              const hasCard = input.card
                ? message.cards?.some(matches)
                : message.id === localId;
              if (!hasCard) {
                return message;
              }
              return {
                ...message,
                content: success,
                cards: message.cards?.map((card) =>
                  input.card && !matches(card)
                    ? card
                    : {
                        kind: input.kind,
                        title: name,
                        data: {
                          ...card.data,
                          status: "confirmed",
                          name,
                          symbol,
                          mint: created.mint,
                          signature: created.signature,
                        },
                      },
                ),
              };
            }),
          );
          return;
        }

        const minted = await mintOrbitxNft({
          wallet: signingWallet,
          name,
          symbol,
          description,
        });
        const success = `Minted ${name} · ${minted.mint}`;
        setStorageError(success);
        setMessages((prev) =>
          prev.map((message) => {
            const hasCard = input.card
              ? message.cards?.some(matches)
              : message.id === localId;
            if (!hasCard) {
              return message;
            }
            return {
              ...message,
              content: success,
              cards: message.cards?.map((card) =>
                input.card && !matches(card)
                  ? card
                  : {
                      kind: input.kind,
                      title: name,
                      data: {
                        ...card.data,
                        status: "confirmed",
                        name,
                        symbol,
                        mint: minted.mint,
                        signature: minted.signature,
                      },
                    },
              ),
            };
          }),
        );
      } catch (error) {
        const failure = formatSwapError(error);
        setStorageError(failure);
        if (input.card) {
          setMessages((prev) =>
            patchCardStatus(prev, matches, { status: "failed" }),
          );
        } else {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === localId
                ? {
                    ...message,
                    content: failure,
                    cards: message.cards?.map((card) => ({
                      ...card,
                      data: { ...card.data, status: "failed" },
                    })),
                  }
                : message,
            ),
          );
        }
      } finally {
        tradeBusy.current = false;
      }
    },
    [wallet],
  );

  const runPostAction = useCallback(
    async (input: { text: string; card?: MessageCard }) => {
      if (!userId) {
        setStorageError("Sign in to post on X.");
        return;
      }
      if (tradeBusy.current) {
        return;
      }
      tradeBusy.current = true;
      setStorageError(null);

      const text = input.text.trim();
      const matches = (card: MessageCard) =>
        input.card ? card === input.card : false;
      const localId = `post-${Date.now()}`;

      if (input.card) {
        setMessages((prev) =>
          patchCardStatus(prev, matches, { status: "posting", text }),
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: localId,
            role: "assistant",
            content: "Posting to X with your connected account…",
            cards: [
              {
                kind: "social",
                title: "Post to X",
                data: { status: "posting", text },
              },
            ],
          },
        ]);
      }

      try {
        const result = await postToX(text);
        const success = result.url
          ? `Posted on X · ${result.url}`
          : `Posted on X · ${result.tweetId ?? "live"}`;
        setStorageError(success);
        setMessages((prev) =>
          prev.map((message) => {
            const hasCard = input.card
              ? message.cards?.some(matches)
              : message.id === localId;
            if (!hasCard) {
              return message;
            }
            return {
              ...message,
              content: success,
              cards: message.cards?.map((card) =>
                input.card && !matches(card)
                  ? card
                  : {
                      kind: "social",
                      title: "Post to X",
                      data: {
                        ...card.data,
                        status: "confirmed",
                        text,
                        url: result.url,
                        tweetId: result.tweetId,
                      },
                    },
              ),
            };
          }),
        );
      } catch (error) {
        const failure =
          error instanceof Error ? error.message : "X post failed.";
        setStorageError(failure);
        if (input.card) {
          setMessages((prev) =>
            patchCardStatus(prev, matches, { status: "failed" }),
          );
        } else {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === localId
                ? {
                    ...message,
                    content: failure,
                    cards: message.cards?.map((card) => ({
                      ...card,
                      data: { ...card.data, status: "failed" },
                    })),
                  }
                : message,
            ),
          );
        }
      } finally {
        tradeBusy.current = false;
      }
    },
    [userId],
  );

  const runClaimAction = useCallback(
    async (input?: { card?: MessageCard }) => {
      const signingWallet = getPrivyWalletAddress() ?? wallet;
      if (!signingWallet) {
        setStorageError("Stay signed in — your OrbitX wallet is still loading.");
        return;
      }
      if (tradeBusy.current) {
        return;
      }
      tradeBusy.current = true;
      setStorageError(null);

      const matches = (card: MessageCard) =>
        input?.card ? card === input.card : false;
      const localId = `claim-${Date.now()}`;

      if (!input?.card) {
        setMessages((prev) => [
          ...prev,
          {
            id: localId,
            role: "assistant",
            content: voiceForClaimFees("start"),
            cards: [
              {
                kind: "claim",
                title: "Claim fees",
                data: { status: "claiming" },
              },
            ],
          },
        ]);
      } else {
        setMessages((prev) =>
          patchCardStatus(prev, matches, { status: "claiming" }),
        );
      }

      try {
        const claimable = await getPumpClaimableSol(signingWallet);
        const result = await claimPumpCreatorFees(signingWallet);
        const success = `Claimed ${result.claimedSol.toFixed(4)} SOL · ${result.signature.slice(0, 8)}…`;
        setStorageError(success);
        setMessages((prev) =>
          prev.map((message) => {
            if (input?.card && message.cards?.some(matches)) {
              return {
                ...message,
                content: voiceForClaimFees("success"),
                cards: message.cards.map((card) =>
                  matches(card)
                    ? {
                        ...card,
                        data: {
                          ...card.data,
                          status: "confirmed",
                          signature: result.signature,
                          claimableSol: claimable,
                        },
                      }
                    : card,
                ),
              };
            }
            if (!input?.card && message.id === localId) {
              return {
                ...message,
                content: voiceForClaimFees("success"),
                cards: [
                  {
                    kind: "claim",
                    title: "Claim fees",
                    data: {
                      status: "confirmed",
                      signature: result.signature,
                      claimableSol: claimable,
                    },
                  },
                ],
              };
            }
            return message;
          }),
        );
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Claim failed.";
        setStorageError(detail);
        if (input?.card) {
          setMessages((prev) =>
            prev.map((message) =>
              message.cards?.some(matches)
                ? {
                    ...message,
                    content: voiceForClaimFees("fail"),
                    cards: message.cards.map((card) =>
                      matches(card)
                        ? { ...card, data: { ...card.data, status: "failed" } }
                        : card,
                    ),
                  }
                : message,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === localId
                ? {
                    ...message,
                    content: voiceForClaimFees("fail"),
                    cards: [
                      {
                        kind: "claim",
                        title: "Claim fees",
                        data: { status: "failed" },
                      },
                    ],
                  }
                : message,
            ),
          );
        }
      } finally {
        tradeBusy.current = false;
      }
    },
    [wallet],
  );

  const runNftBuyAction = useCallback(
    async (input: { listingId: string; card?: MessageCard }) => {
      const signingWallet = getPrivyWalletAddress() ?? wallet;
      if (!signingWallet) {
        setStorageError("Stay signed in — your OrbitX wallet is still loading.");
        return;
      }
      if (tradeBusy.current) {
        return;
      }
      tradeBusy.current = true;
      setStorageError(null);

      const matches = (card: MessageCard) =>
        input.card ? card === input.card : false;
      if (input.card) {
        setMessages((prev) =>
          patchCardStatus(prev, matches, { status: "claiming" }),
        );
      }

      try {
        const signature = await buyOrbitxNft({
          listingId: input.listingId,
          wallet: signingWallet,
        });
        const success = `NFT purchased · ${signature.slice(0, 8)}…`;
        setStorageError(success);
        if (input.card) {
          setMessages((prev) =>
            patchCardStatus(prev, matches, {
              status: "confirmed",
              signature,
            }),
          );
        }
      } catch (error) {
        setStorageError(
          error instanceof Error ? error.message : "NFT buy failed.",
        );
        if (input.card) {
          setMessages((prev) =>
            patchCardStatus(prev, matches, { status: "failed" }),
          );
        }
      } finally {
        tradeBusy.current = false;
      }
    },
    [wallet],
  );

  const handleSend = useCallback(async () => {
    const text = rewriteLegacyToolPrompt(draft.trim(), [...TOOLS]);
    if (!text || sending) {
      return;
    }

    const intent = parseTradeIntent(text);
    if (intent) {
      const userMessage: Message = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setDraft("");
      setStorageError(null);
      if (intent.kind === "limit") {
        await placeLimitOrder({
          mint: intent.mint,
          side: intent.side,
          percent: intent.percent,
          amountSol: intent.amountSol,
          triggerType: intent.triggerType,
          triggerValue: intent.triggerValue,
        });
        return;
      }
      await runJupiterTrade({
        mint: intent.mint,
        side: intent.side,
        amount: intent.amount,
        percent: intent.percent,
      });
      return;
    }

    const claimIntent = parseClaimIntent(text);
    if (claimIntent) {
      const userMessage: Message = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setDraft("");
      setStorageError(null);
      await runClaimAction();
      return;
    }

    const nftBuyIntent = parseNftBuyIntent(text);
    if (nftBuyIntent) {
      const userMessage: Message = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setDraft("");
      setStorageError(null);
      await runNftBuyAction({ listingId: nftBuyIntent.listingId });
      return;
    }

    const createIntent = parseCreateIntent(text);
    if (createIntent) {
      const userMessage: Message = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setDraft("");
      setStorageError(null);
      await runCreateAction({
        kind: createIntent.kind,
        name: createIntent.name,
        symbol: createIntent.symbol,
        description: createIntent.description,
      });
      return;
    }

    const socialIntent = parseSocialPostIntent(text);
    if (socialIntent) {
      const userMessage: Message = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setDraft("");
      setStorageError(null);
      await runPostAction({ text: socialIntent.text });
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
      label: TOOLS.find((tool) => tool.id === toolId)?.name ?? toolId.replace(/-/g, " "),
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
    runJupiterTrade,
    placeLimitOrder,
    runCreateAction,
    runClaimAction,
    runNftBuyAction,
    runPostAction,
  ]);

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
      const mint = String(
        card.data.mint ?? card.data.outputMint ?? card.data.inputMint ?? "",
      );
      const side = String(card.data.side ?? "buy") === "sell" ? "sell" : "buy";
      const percent =
        typeof card.data.percent === "number" ? card.data.percent : undefined;
      let amount =
        typeof card.data.amount === "number" ? card.data.amount : undefined;
      if (amount === undefined && side === "buy" && typeof card.data.inAmount === "string" && /^\d+$/.test(card.data.inAmount)) {
        amount = Number(card.data.inAmount) / 1e9;
      }
      await runJupiterTrade({ mint, side, amount, percent, card });
    },
    [runJupiterTrade],
  );

  const handleTokenTrade = useCallback(
    async (mint: string, side: "buy" | "sell") => {
      await runJupiterTrade({
        mint,
        side,
        percent: side === "sell" ? 100 : undefined,
      });
    },
    [runJupiterTrade],
  );

  useEffect(() => {
    prefetchBuyAmount(wallet ?? undefined);
  }, [wallet]);

  useEffect(() => {
    void readAutoApproveBuys().then(setInstantBuy);
  }, []);

  useEffect(() => {
    if (!instantBuy || sending) {
      return;
    }
    for (const message of messages) {
      for (const card of message.cards ?? []) {
        if (card.kind === "claim") {
          const status = String(card.data.status ?? "preview");
          const key = `claim:${String(card.data.signature ?? card.title)}`;
          if (status !== "preview" || autoFired.current.has(key)) {
            continue;
          }
          autoFired.current.add(key);
          void runClaimAction({ card });
          continue;
        }
        if (card.kind === "nft_buy") {
          const status = String(card.data.status ?? "preview");
          const listingId = String(card.data.listingId ?? "");
          const key = `nftbuy:${listingId}`;
          if (status !== "preview" || !listingId || autoFired.current.has(key)) {
            continue;
          }
          autoFired.current.add(key);
          void runNftBuyAction({ listingId, card });
          continue;
        }
        if (card.kind === "social") {
          const status = String(card.data.status ?? "preview");
          const key = `social:${String(card.data.tweetId ?? card.data.text ?? card.title)}`;
          if (status !== "preview" || autoFired.current.has(key)) {
            continue;
          }
          const postText = String(card.data.text ?? "");
          if (!postText) {
            continue;
          }
          autoFired.current.add(key);
          void runPostAction({ text: postText, card });
          continue;
        }
        if (card.kind === "launch" || card.kind === "nft") {
          const status = String(card.data.status ?? "preview");
          const key = `create:${String(card.data.intentId ?? card.data.name)}:${card.kind}`;
          if (status !== "preview" || autoFired.current.has(key)) {
            continue;
          }
          autoFired.current.add(key);
          void runCreateAction({
            kind: card.kind,
            name: String(card.data.name ?? ""),
            symbol: String(card.data.symbol ?? ""),
            description: String(card.data.description ?? ""),
            card,
          });
          continue;
        }
        if (card.kind !== "tx") {
          continue;
        }
        const canQuote =
          Boolean(card.data.quoteJson) ||
          Boolean(card.data.inputMint && card.data.outputMint && card.data.inAmount) ||
          Boolean(card.data.mint);
        if (!canQuote) {
          continue;
        }
        const status = String(card.data.status ?? "preview");
        const key = String(card.data.intentId ?? card.data.quoteJson ?? card.data.mint);
        if (status !== "preview" || autoFired.current.has(key)) {
          continue;
        }
        autoFired.current.add(key);
        void handleConfirmTx(card);
      }
    }
  }, [handleConfirmTx, instantBuy, messages, runCreateAction, runClaimAction, runNftBuyAction, runPostAction, sending]);

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
        id: "nav:orders",
        title: "Limit orders",
        subtitle: "Pending buy & sell limits",
        kind: "action",
      },
      {
        id: "nav:wallet",
        title: "Wallet",
        subtitle: "Connected wallet and logout",
        kind: "action",
      },
      {
        id: "nav:dex",
        title: "DEX",
        subtitle: "Buy and sell with Jupiter / pump.fun",
        kind: "action",
      },
      {
        id: "nav:launch",
        title: "Launch",
        subtitle: "Create a coin on pump.fun",
        kind: "action",
      },
      {
        id: "nav:nft",
        title: "NFTs",
        subtitle: "Mint, list, and buy",
        kind: "action",
      },
      {
        id: "nav:social",
        title: "Social",
        subtitle: "Connect X and post",
        kind: "action",
      },
      {
        id: "nav:settings",
        title: "Settings",
        subtitle: "Model, memory, and permissions",
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
        <View style={styles.headerCopy}>
          <View style={styles.headerLiveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.headerKicker}>ORBITX CORE · LIVE</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)} armed` : "Sign in to trade"}
          </Text>
        </View>
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
            onCancelOrder={(orderId) => {
              void cancelLimitOrder(orderId);
            }}
            onBuyToken={(mint) => {
              void handleTokenTrade(mint, "buy");
            }}
            onSellToken={(mint) => {
              void handleTokenTrade(mint, "sell");
            }}
            onOpenCreate={(kind) => {
              router.push(kind === "nft" ? "/nft" : "/launch");
            }}
            onApproveCreate={(kind, card) => {
              void runCreateAction({
                kind,
                name: String(card.data.name ?? ""),
                symbol: String(card.data.symbol ?? ""),
                description: String(card.data.description ?? ""),
                card,
              });
            }}
            onClaimFees={(card) => {
              void runClaimAction({ card });
            }}
            onBuyNft={(card) => {
              const listingId = String(card.data.listingId ?? "");
              if (listingId) {
                void runNftBuyAction({ listingId, card });
              }
            }}
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
          instantBuy={instantBuy}
          onInstantBuyPress={() => {
            if (instantBuy) {
              setInstantBuy(false);
              void writeAutoApproveBuys(false);
              return;
            }
            setApproveOpen(true);
          }}
          mentionTools={TOOLS.map((tool) => ({ id: tool.id, name: tool.name }))}
        />
      </View>

      <ApproveSheet
        visible={approveOpen}
        title="Approve auto-sign"
        body="OrbitX auto-signs buys, sells, limit orders, launches, NFT mints, NFT buys, creator-fee claims, and X posts with your connected accounts as soon as a quote or draft is ready. You can turn this off anytime. This is not a seed export."
        confirmLabel="Turn on auto-sign"
        onClose={() => setApproveOpen(false)}
        onConfirm={() => {
          setInstantBuy(true);
          void writeAutoApproveBuys(true);
          setApproveOpen(false);
        }}
      />

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
            router.push(`/${id.slice(4)}` as "/dex");
          } else if (id.startsWith("tool:")) {
            const tool = TOOLS.find((item) => item.id === id.slice(5));
            if (tool) setDraft(`@${tool.id} `);
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.void,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  headerLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  headerKicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2.4,
  },
  headerTitle: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 15,
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
