import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { HoldingsCard } from "./HoldingsCard";
import { CreateCard } from "./CreateCard";
import { ClaimCard } from "./ClaimCard";
import { OrbitXMark } from "./OrbitXMark";
import { OrderCard, type OrderCardStatus } from "./OrderCard";
import { TokenCard } from "./TokenCard";
import { ToolProgress } from "./ToolProgress";
import { TradeReceipt } from "./TradeReceipt";
import { TxPreview, type TxPreviewStatus } from "./TxPreview";
import { WalletCard } from "./WalletCard";
import type { Message, MessageCard } from "./types";
import { colors } from "../theme";

export type { Message, MessageCard, ToolEvent, ToolEventStatus } from "./types";

export type MessageListProps = {
  messages: Message[];
  onRegenerate?: () => void;
  onConfirmTx?: (card: MessageCard) => void;
  onCancelTx?: (card: MessageCard) => void;
  onCancelOrder?: (orderId: string) => void;
  onBuyToken?: (mint: string) => void;
  onSellToken?: (mint: string) => void;
  onOpenCreate?: (kind: "launch" | "nft", card: MessageCard) => void;
  onApproveCreate?: (kind: "launch" | "nft", card: MessageCard) => void;
  onClaimFees?: (card: MessageCard) => void;
  onBuyNft?: (card: MessageCard) => void;
};

type InlineSegment = {
  text: string;
  bold?: boolean;
  code?: boolean;
};

type MarkdownBlock =
  | { type: "paragraph"; segments: InlineSegment[] }
  | { type: "list"; items: InlineSegment[][] };

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith("**")) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("`")) {
      segments.push({ text: token.slice(1, -1), code: true });
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    const joined = paragraphLines.join(" ").trim();
    if (joined) {
      blocks.push({ type: "paragraph", segments: parseInline(joined) });
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    blocks.push({
      type: "list",
      items: listItems.map((item) => parseInline(item)),
    });
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (trimmed.length === 0) {
      flushList();
      flushParagraph();
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushList();
  flushParagraph();

  return blocks;
}

function InlineText({ segments }: { segments: InlineSegment[] }) {
  return (
    <Text style={styles.bodyText}>
      {segments.map((segment, index) => {
        if (segment.code) {
          return (
            <Text key={`${index}-${segment.text}`} style={styles.inlineCode}>
              {segment.text}
            </Text>
          );
        }
        if (segment.bold) {
          return (
            <Text key={`${index}-${segment.text}`} style={styles.boldText}>
              {segment.text}
            </Text>
          );
        }
        return segment.text;
      })}
    </Text>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

const TX_STATUSES: TxPreviewStatus[] = [
  "preview",
  "awaiting_signature",
  "submitted",
  "confirming",
  "confirmed",
  "failed",
];

function asTxStatus(value: unknown): TxPreviewStatus {
  return TX_STATUSES.includes(value as TxPreviewStatus)
    ? (value as TxPreviewStatus)
    : "preview";
}

function asOrderStatus(value: unknown): OrderCardStatus {
  const statuses: OrderCardStatus[] = [
    "pending",
    "triggered",
    "confirmed",
    "failed",
    "cancelled",
  ];
  return statuses.includes(value as OrderCardStatus)
    ? (value as OrderCardStatus)
    : "pending";
}

function MessageCardView({
  card,
  onConfirmTx,
  onCancelTx,
  onCancelOrder,
  onBuyToken,
  onSellToken,
  onOpenCreate,
  onApproveCreate,
  onOpenOrders,
  onOpenWallet,
  onClaimFees,
  onBuyNft,
}: {
  card: MessageCard;
  onConfirmTx?: (card: MessageCard) => void;
  onCancelTx?: (card: MessageCard) => void;
  onCancelOrder?: (orderId: string) => void;
  onBuyToken?: (mint: string) => void;
  onSellToken?: (mint: string) => void;
  onOpenCreate?: (kind: "launch" | "nft", card: MessageCard) => void;
  onApproveCreate?: (kind: "launch" | "nft", card: MessageCard) => void;
  onOpenOrders?: () => void;
  onOpenWallet?: () => void;
  onClaimFees?: (card: MessageCard) => void;
  onBuyNft?: (card: MessageCard) => void;
}) {
  if (card.kind === "token") {
    const mint = String(card.data.mint ?? "");
    return (
      <TokenCard
        symbol={String(card.data.symbol ?? card.title)}
        price={String(card.data.price ?? "—")}
        marketCap={String(card.data.mcap ?? card.data.marketCap ?? "—")}
        liquidity={String(card.data.liq ?? card.data.liquidity ?? "—")}
        volume={String(card.data.vol ?? card.data.volume ?? "—")}
        risk={String(card.data.risk ?? "—")}
        onBuy={() => mint && onBuyToken?.(mint)}
        onSell={() => mint && onSellToken?.(mint)}
      />
    );
  }

  if (card.kind === "launch" || card.kind === "nft") {
    const status = String(card.data.status ?? "preview");
    return (
      <CreateCard
        kind={card.kind}
        name={String(card.data.name ?? card.title)}
        symbol={String(card.data.symbol ?? "")}
        note={String(card.data.note ?? "")}
        status={
          status === "signing" ||
          status === "confirmed" ||
          status === "failed"
            ? status
            : "preview"
        }
        mint={String(card.data.mint ?? "") || undefined}
        signature={String(card.data.signature ?? "") || undefined}
        onOpen={() => onOpenCreate?.(card.kind === "nft" ? "nft" : "launch", card)}
        onApprove={
          status === "preview"
            ? () =>
                onApproveCreate?.(card.kind === "nft" ? "nft" : "launch", card)
            : undefined
        }
      />
    );
  }

  if (card.kind === "social") {
    const status = String(card.data.status ?? "preview");
    const text = String(card.data.text ?? card.title);
    const url = String(card.data.url ?? "");
    return (
      <View style={styles.genericCard}>
        <Text style={styles.genericCardKind}>POST TO X</Text>
        <Text style={styles.genericCardTitle} numberOfLines={4}>
          {text}
        </Text>
        {status === "posting" ? (
          <Text style={styles.socialPending}>Posting…</Text>
        ) : null}
        {status === "confirmed" ? (
          <Text style={styles.nftBuySuccess}>
            {url ? `Live · ${url}` : "Posted on X."}
          </Text>
        ) : null}
        {status === "failed" ? (
          <Text style={styles.socialFailed}>Post failed — connect X in Social tab.</Text>
        ) : null}
      </View>
    );
  }

  if (card.kind === "wallet") {
    const status = String(card.data.status ?? "ready");
    const holdingsRaw = String(card.data.holdingsJson ?? "");
    let holdings: {
      mint: string;
      symbol: string;
      balance: number;
      usdValue?: number;
    }[] = [];
    if (holdingsRaw) {
      try {
        const parsed: unknown = JSON.parse(holdingsRaw);
        if (Array.isArray(parsed)) {
          holdings = parsed
            .map((item) => {
              const row =
                typeof item === "object" && item !== null
                  ? (item as Record<string, unknown>)
                  : null;
              if (!row || typeof row.mint !== "string") {
                return null;
              }
              const balance = Number(row.balance);
              if (!Number.isFinite(balance)) {
                return null;
              }
              return {
                mint: row.mint,
                symbol:
                  typeof row.symbol === "string" ? row.symbol : row.mint.slice(0, 4),
                balance,
                usdValue:
                  typeof row.usdValue === "number" ? row.usdValue : undefined,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);
        }
      } catch {
        holdings = [];
      }
    }

    if (status === "loading") {
      return (
        <View style={styles.genericCard}>
          <Text style={styles.genericCardKind}>HOLDINGS</Text>
          <Text style={styles.socialPending}>Loading from Solana…</Text>
        </View>
      );
    }

    if (holdings.length > 0 || card.data.solBalance !== undefined) {
      return (
        <HoldingsCard
          address={String(card.data.address ?? card.title)}
          portfolio={String(card.data.portfolio ?? "—")}
          pnl={String(card.data.pnl ?? "") || undefined}
          solBalance={
            typeof card.data.solBalance === "number"
              ? card.data.solBalance
              : undefined
          }
          holdings={holdings}
          onOpenWallet={onOpenWallet}
        />
      );
    }

    return (
      <WalletCard
        address={String(card.data.address ?? card.title)}
        portfolio={String(card.data.portfolio ?? "—")}
        pnl={String(card.data.pnl ?? "—")}
      />
    );
  }

  if (card.kind === "claim") {
    const status = String(card.data.status ?? "preview");
    return (
      <ClaimCard
        claimableSol={
          typeof card.data.claimableSol === "number"
            ? card.data.claimableSol
            : undefined
        }
        status={
          status === "claiming" ||
          status === "confirmed" ||
          status === "failed"
            ? status
            : "preview"
        }
        signature={String(card.data.signature ?? "") || undefined}
        onClaim={
          status === "preview" ? () => onClaimFees?.(card) : undefined
        }
      />
    );
  }

  if (card.kind === "nft_buy") {
    const status = String(card.data.status ?? "preview");
    return (
      <View style={styles.genericCard}>
        <Text style={styles.genericCardKind}>NFT BUY</Text>
        <Text style={styles.genericCardTitle}>
          {String(card.data.name ?? card.title)}
        </Text>
        <Text style={styles.nftBuyMeta}>
          {typeof card.data.priceSol === "number"
            ? `${card.data.priceSol} SOL`
            : "Listed NFT"}
        </Text>
        {status === "preview" && onBuyNft ? (
          <Pressable
            style={({ pressed }) => [
              styles.nftBuyButton,
              pressed && styles.actionPressed,
            ]}
            onPress={() => onBuyNft(card)}
            accessibilityRole="button"
          >
            <Text style={styles.nftBuyButtonText}>Buy with OrbitX wallet</Text>
          </Pressable>
        ) : null}
        {status === "confirmed" ? (
          <Text style={styles.nftBuySuccess}>Purchased on chain.</Text>
        ) : null}
      </View>
    );
  }

  if (card.kind === "order") {
    return (
      <OrderCard
        side={String(card.data.side) === "buy" ? "buy" : "sell"}
        percent={
          typeof card.data.percent === "number" ? card.data.percent : undefined
        }
        amountSol={
          typeof card.data.amountSol === "number"
            ? card.data.amountSol
            : undefined
        }
        triggerType={
          String(card.data.triggerType) === "price" ? "price" : "mcap"
        }
        triggerValue={Number(card.data.triggerValue ?? 0)}
        symbol={String(card.data.symbol ?? "")}
        mint={String(card.data.mint ?? "")}
        status={asOrderStatus(card.data.status)}
        signature={String(card.data.signature ?? "") || undefined}
        onCancel={
          card.data.orderId
            ? () => onCancelOrder?.(String(card.data.orderId))
            : undefined
        }
        onOpenDashboard={onOpenOrders}
      />
    );
  }

  if (card.kind === "tx") {
    const status = asTxStatus(card.data.status);
    const side = String(card.data.side ?? "buy") === "sell" ? "sell" : "buy";
    const compact =
      card.data.compact === true ||
      status === "confirmed" ||
      status === "failed" ||
      status === "submitted" ||
      status === "confirming";
    if (compact) {
      const amount =
        typeof card.data.amount === "number"
          ? `${card.data.amount}${typeof card.data.percent === "number" ? `% (${card.data.percent}%)` : ""}`
          : undefined;
      return (
        <TradeReceipt
          side={side}
          status={status}
          amountLabel={amount}
          signature={String(card.data.signature ?? card.data.tx ?? "") || undefined}
        />
      );
    }
    const warnings =
      typeof card.data.warnings === "string" && card.data.warnings
        ? card.data.warnings.split(" | ")
        : [];
    return (
      <TxPreview
        inAmount={String(card.data.inAmount ?? "—")}
        outAmount={String(card.data.outAmount ?? "—")}
        slippage={String(card.data.slippage ?? `${card.data.slippageBps ?? 50} bps`)}
        route={String(card.data.route ?? "Jupiter")}
        warnings={warnings}
        status={asTxStatus(card.data.status)}
        confirmLabel={
          String(card.data.side ?? "buy") === "sell"
            ? "Approve & sell"
            : "Approve & buy"
        }
        onConfirm={() => onConfirmTx?.(card)}
        onCancel={() => onCancelTx?.(card)}
      />
    );
  }

  return (
    <View style={styles.genericCard}>
      <Text style={styles.genericCardKind}>{card.kind.toUpperCase()}</Text>
      <Text style={styles.genericCardTitle}>{card.title}</Text>
    </View>
  );
}

type MessageItemProps = {
  message: Message;
  isLastAssistant: boolean;
  onRegenerate?: () => void;
  onConfirmTx?: (card: MessageCard) => void;
  onCancelTx?: (card: MessageCard) => void;
  onCancelOrder?: (orderId: string) => void;
  onBuyToken?: (mint: string) => void;
  onSellToken?: (mint: string) => void;
  onOpenCreate?: (kind: "launch" | "nft", card: MessageCard) => void;
  onApproveCreate?: (kind: "launch" | "nft", card: MessageCard) => void;
  onOpenOrders?: () => void;
  onOpenWallet?: () => void;
  onClaimFees?: (card: MessageCard) => void;
  onBuyNft?: (card: MessageCard) => void;
};

function MessageItem({
  message,
  isLastAssistant,
  onRegenerate,
  onConfirmTx,
  onCancelTx,
  onCancelOrder,
  onBuyToken,
  onSellToken,
  onOpenCreate,
  onApproveCreate,
  onOpenOrders,
  onOpenWallet,
  onClaimFees,
  onBuyNft,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const blocks = parseMarkdown(message.content);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }, [message.content]);

  if (message.role === "system") {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemKicker}>SYSTEM</Text>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  const isUser = message.role === "user";

  return (
    <View style={[styles.messageWrap, isUser && styles.messageWrapUser]}>
      {!isUser ? (
        <View style={styles.agentRow}>
          <View style={styles.agentAvatar}>
            <OrbitXMark size={16} />
          </View>
          <View style={styles.agentMeta}>
            <Text style={styles.agentKicker}>ORBITX CORE</Text>
            <Text style={styles.agentSub}>Auto-sign · Jupiter · pump.fun</Text>
          </View>
          <View style={styles.agentPulse} />
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {blocks.map((block, blockIndex) => {
          if (block.type === "list") {
            return (
              <View key={`list-${blockIndex}`} style={styles.listBlock}>
                {block.items.map((item, itemIndex) => (
                  <View key={`item-${itemIndex}`} style={styles.listRow}>
                    <Text style={styles.listBullet}>–</Text>
                    <InlineText segments={item} />
                  </View>
                ))}
              </View>
            );
          }

          return (
            <View key={`p-${blockIndex}`} style={styles.paragraph}>
              <InlineText segments={block.segments} />
              {message.streaming && blockIndex === blocks.length - 1 ? (
                <Text style={styles.cursor}>▍</Text>
              ) : null}
            </View>
          );
        })}

        {message.streaming && blocks.length === 0 ? (
          <Text style={styles.cursor}>▍</Text>
        ) : null}

        {message.toolEvents && message.toolEvents.length > 0 ? (
          <View style={styles.toolProgressWrap}>
            <ToolProgress events={message.toolEvents} />
          </View>
        ) : null}

        {message.cards?.map((card, index) => (
          <View key={`${card.kind}-${index}`} style={styles.cardWrap}>
            <MessageCardView
              card={card}
              onConfirmTx={onConfirmTx}
              onCancelTx={onCancelTx}
              onCancelOrder={onCancelOrder}
              onBuyToken={onBuyToken}
              onSellToken={onSellToken}
              onOpenCreate={onOpenCreate}
              onApproveCreate={onApproveCreate}
              onOpenOrders={onOpenOrders}
              onOpenWallet={onOpenWallet}
              onClaimFees={onClaimFees}
              onBuyNft={onBuyNft}
            />
          </View>
        ))}
      </View>

      {!isUser ? (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionChip, pressed && styles.actionPressed]}
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel="Copy message"
          >
            <Text style={styles.actionChipText}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>

          {isLastAssistant && onRegenerate ? (
            <Pressable
              style={({ pressed }) => [styles.actionChip, pressed && styles.actionPressed]}
              onPress={onRegenerate}
              accessibilityRole="button"
              accessibilityLabel="Regenerate response"
            >
              <Text style={styles.actionChipText}>Regenerate</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function MessageList({
  messages,
  onRegenerate,
  onConfirmTx,
  onCancelTx,
  onCancelOrder,
  onBuyToken,
  onSellToken,
  onOpenCreate,
  onApproveCreate,
  onClaimFees,
  onBuyNft,
}: MessageListProps) {
  const router = useRouter();
  const openOrders = () => router.push("/orders");
  const openWallet = () => router.push("/wallet");
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <MessageItem
          message={item}
          isLastAssistant={item.id === lastAssistantId}
          onRegenerate={onRegenerate}
          onConfirmTx={onConfirmTx}
          onCancelTx={onCancelTx}
          onCancelOrder={onCancelOrder}
          onBuyToken={onBuyToken}
          onSellToken={onSellToken}
          onOpenCreate={onOpenCreate}
          onApproveCreate={onApproveCreate}
          onOpenOrders={openOrders}
          onOpenWallet={openWallet}
          onClaimFees={onClaimFees}
          onBuyNft={onBuyNft}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 22,
  },
  messageWrap: {
    alignItems: "stretch",
    width: "100%",
    gap: 10,
  },
  messageWrapUser: {
    alignItems: "flex-end",
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 2,
    marginBottom: 2,
  },
  agentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(126, 182, 255, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126, 182, 255, 0.24)",
  },
  agentMeta: {
    flex: 1,
    gap: 1,
  },
  agentPulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  agentKicker: {
    color: colors.signal,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 2.4,
  },
  agentSub: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  bubble: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleUser: {
    width: "86%",
    maxWidth: 420,
    alignSelf: "flex-end",
    backgroundColor: "rgba(90, 140, 255, 0.16)",
    borderColor: "rgba(150, 196, 255, 0.32)",
  },
  bubbleAssistant: {
    alignSelf: "stretch",
    backgroundColor: "rgba(4, 7, 14, 0.98)",
    borderColor: "rgba(126, 182, 255, 0.2)",
    borderLeftWidth: 3,
    borderLeftColor: colors.signal,
    shadowColor: colors.signal,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  paragraph: {
    marginBottom: 8,
  },
  bodyText: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
  },
  cursor: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 23,
  },
  boldText: {
    fontFamily: "Inter_600SemiBold",
    color: colors.frost,
  },
  inlineCode: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 13,
    color: colors.ice,
    backgroundColor: "rgba(126, 182, 255, 0.1)",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  listBlock: {
    gap: 6,
    marginBottom: 8,
  },
  listRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  listBullet: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 23,
  },
  toolProgressWrap: {
    marginTop: 10,
    width: "100%",
    alignSelf: "stretch",
  },
  cardWrap: {
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingLeft: 4,
  },
  actionChip: {
    minHeight: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.72,
  },
  actionChipText: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  systemWrap: {
    gap: 6,
    paddingVertical: 4,
  },
  systemKicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2.2,
  },
  systemText: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  genericCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  genericCardKind: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.4,
  },
  genericCardTitle: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  nftBuyMeta: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  nftBuyButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: colors.signal,
  },
  nftBuyButtonText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  nftBuySuccess: {
    marginTop: 6,
    color: colors.success,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  socialPending: {
    marginTop: 6,
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  socialFailed: {
    marginTop: 6,
    color: colors.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
