import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";

export type CommandResultKind =
  | "token"
  | "wallet"
  | "conversation"
  | "agent"
  | "tool"
  | "action";

export type CommandResult = {
  id: string;
  title: string;
  subtitle: string;
  kind: CommandResultKind;
};

export type CommandPaletteProps = {
  visible: boolean;
  query: string;
  onChangeQuery: (query: string) => void;
  results: CommandResult[];
  onPick: (id: string) => void;
  onClose: () => void;
};

const KIND_LABELS: Record<CommandResultKind, string> = {
  token: "TOKEN",
  wallet: "WALLET",
  conversation: "CHAT",
  agent: "AGENT",
  tool: "TOOL",
  action: "ACTION",
};

export function CommandPalette({
  visible,
  query,
  onChangeQuery,
  results,
  onPick,
  onClose,
}: CommandPaletteProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 48) }]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close command palette"
        />

        <View style={styles.panel}>
          <View style={styles.inputRow}>
            <Text style={styles.prompt}>›</Text>
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Search tokens, wallets, conversations, agents, tools"
              placeholderTextColor="rgba(176, 198, 232, 0.38)"
              style={styles.input}
              selectionColor={colors.signal}
              autoFocus
              autoCorrect={false}
              {...(Platform.OS === "web"
                ? ({ outlineStyle: "none" } as Record<string, string>)
                : {})}
            />
          </View>

          <Text style={styles.hint}>
            Search tokens, wallets, conversations, agents, tools
          </Text>

          <ScrollView
            style={styles.results}
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {results.map((result) => (
              <Pressable
                key={result.id}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                onPress={() => {
                  onPick(result.id);
                  onClose();
                }}
                accessibilityRole="button"
              >
                <View style={styles.resultMain}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {result.title}
                  </Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {result.subtitle}
                  </Text>
                </View>
                <Text style={styles.resultKind}>{KIND_LABELS[result.kind]}</Text>
              </Pressable>
            ))}

            {results.length === 0 ? (
              <Text style={styles.empty}>No results</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  panel: {
    width: "100%",
    maxWidth: 640,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.glass,
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  prompt: {
    color: colors.signal,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  input: {
    flex: 1,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    paddingVertical: 0,
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none" } as Record<string, string>)
      : {}),
  },
  hint: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  results: {
    maxHeight: 360,
  },
  resultsContent: {
    paddingBottom: 8,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  resultMain: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  resultSubtitle: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  resultKind: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  empty: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 28,
  },
  pressed: {
    backgroundColor: colors.grid,
  },
});
