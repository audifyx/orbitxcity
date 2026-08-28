import { useCallback, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { TokenCard } from "./TokenCard";
import { ToolProgress } from "./ToolProgress";
import { WalletCard } from "./WalletCard";
import type { Message, MessageCard } from "./types";
import { colors } from "../theme";

export type { Message, MessageCard, ToolEvent, ToolEventStatus } from "./types";

export type MessageListProps = {
  messages: Message[];
  onRegenerate?: () => void;
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

function MessageCardView({ card }: { card: MessageCard }) {
  if (card.kind === "token") {
    return (
      <TokenCard
        symbol={String(card.data.symbol ?? card.title)}
        price={String(card.data.price ?? "—")}
        marketCap={String(card.data.mcap ?? "—")}
        liquidity={String(card.data.liq ?? "—")}
        volume={String(card.data.vol ?? "—")}
        risk={String(card.data.risk ?? "—")}
      />
    );
  }

  if (card.kind === "wallet") {
    return (
      <WalletCard
        address={String(card.data.address ?? card.title)}
        portfolio={String(card.data.portfolio ?? "—")}
        pnl={String(card.data.pnl ?? "—")}
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
};

function MessageItem({ message, isLastAssistant, onRegenerate }: MessageItemProps) {
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
            </View>
          );
        })}

        {message.toolEvents && message.toolEvents.length > 0 ? (
          <View style={styles.toolProgressWrap}>
            <ToolProgress events={message.toolEvents} />
          </View>
        ) : null}

        {message.cards?.map((card, index) => (
          <View key={`${card.kind}-${index}`} style={styles.cardWrap}>
            <MessageCardView card={card} />
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

export function MessageList({ messages, onRegenerate }: MessageListProps) {
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
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 18,
  },
  messageWrap: {
    alignItems: "flex-start",
    gap: 8,
  },
  messageWrapUser: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "92%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleUser: {
    backgroundColor: "rgba(126, 182, 255, 0.1)",
    borderColor: "rgba(126, 182, 255, 0.22)",
  },
  bubbleAssistant: {
    backgroundColor: colors.glass,
    borderColor: colors.line,
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
});
