import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../theme";

export type MentionOption = {
  id: string;
  name: string;
};

export type ComposerProps = {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  loading?: boolean;
  modelLabel: string;
  onModelPress: () => void;
  onToolsPress: () => void;
  instantBuy?: boolean;
  onInstantBuyPress?: () => void;
  disabled?: boolean;
  mentionTools?: MentionOption[];
};

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  loading = false,
  modelLabel,
  onModelPress,
  onToolsPress,
  instantBuy = false,
  onInstantBuyPress,
  disabled = false,
  mentionTools = [],
}: ComposerProps) {
  const canSend = !disabled && !loading && value.trim().length > 0;
  const mentionMatch = value.match(/@([a-z0-9-]*)$/i);
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null;
  const mentionHits =
    mentionQuery !== null
      ? mentionTools
          .filter(
            (tool) =>
              tool.id.includes(mentionQuery) ||
              tool.name.toLowerCase().includes(mentionQuery),
          )
          .slice(0, 6)
      : [];

  const insertMention = (id: string) => {
    onChange(value.replace(/@([a-z0-9-]*)$/i, `@${id} `));
  };

  return (
    <View style={styles.root}>
      {mentionHits.length > 0 ? (
        <View style={styles.mentionList}>
          {mentionHits.map((tool) => (
            <Pressable
              key={tool.id}
              style={({ pressed }) => [
                styles.mentionRow,
                pressed && styles.chipPressed,
              ]}
              onPress={() => insertMention(tool.id)}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${tool.name}`}
            >
              <Text style={styles.mentionAt}>@{tool.id}</Text>
              <Text style={styles.mentionName} numberOfLines={1}>
                {tool.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.chipRow}>
        <Pressable
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          onPress={onModelPress}
          accessibilityRole="button"
          accessibilityLabel="Select model"
        >
          <Text style={styles.chipDot}>◆</Text>
          <Text style={styles.chipLabel} numberOfLines={1}>
            {modelLabel}
          </Text>
          <Text style={styles.chipChevron}>▾</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          onPress={onToolsPress}
          accessibilityRole="button"
          accessibilityLabel="Open tools"
        >
          <Text style={styles.chipIcon}>⬡</Text>
          <Text style={styles.chipLabel}>Tools</Text>
        </Pressable>

        {onInstantBuyPress ? (
          <Pressable
            style={({ pressed }) => [
              styles.chip,
              instantBuy && styles.chipLive,
              pressed && styles.chipPressed,
            ]}
            onPress={onInstantBuyPress}
            accessibilityRole="button"
            accessibilityLabel="Toggle instant buy"
          >
            <Text style={styles.chipIcon}>{instantBuy ? "●" : "○"}</Text>
            <Text style={styles.chipLabel}>
              {instantBuy ? "Auto-sign" : "Manual sign"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Ask OrbitX anything…"
          placeholderTextColor="rgba(176, 198, 232, 0.38)"
          style={styles.input}
          selectionColor={colors.signal}
          multiline
          editable={!disabled}
          textAlignVertical="top"
        />

        {loading ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.stopBtn,
              pressed && styles.actionPressed,
            ]}
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Stop generation"
          >
            <View style={styles.stopSquare} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              canSend ? styles.sendBtn : styles.sendBtnDisabled,
              pressed && canSend && styles.actionPressed,
            ]}
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  mentionList: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  mentionAt: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  mentionName: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flexShrink: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 180,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.glass,
    paddingHorizontal: 10,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipLive: {
    borderColor: "rgba(126, 255, 196, 0.35)",
    backgroundColor: "rgba(126, 224, 196, 0.1)",
  },
  chipDot: {
    color: colors.signal,
    fontSize: 8,
    fontFamily: "Inter_500Medium",
  },
  chipIcon: {
    color: colors.signal,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  chipLabel: {
    color: colors.mist,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    flexShrink: 1,
  },
  chipChevron: {
    color: colors.dim,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  inputWrap: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.composer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingLeft: 16,
    paddingRight: 8,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 140,
    paddingVertical: 4,
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none" } as Record<string, string>)
      : {}),
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendBtn: {
    backgroundColor: "rgba(126, 182, 255, 0.16)",
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(126, 182, 255, 0.06)",
  },
  stopBtn: {
    backgroundColor: "rgba(232, 121, 121, 0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(232, 121, 121, 0.28)",
  },
  actionPressed: {
    opacity: 0.78,
  },
  sendIcon: {
    color: colors.ice,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    marginTop: -1,
  },
  stopSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.danger,
  },
});
