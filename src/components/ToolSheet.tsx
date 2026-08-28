import { useMemo, useState } from "react";
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

export type ToolCategory =
  | "TRADE"
  | "INTELLIGENCE"
  | "CREATE"
  | "SOCIAL"
  | "MONITOR"
  | "ORBITX";

export type ToolOption = {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
};

export type ToolSheetProps = {
  visible: boolean;
  tools: ToolOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

const CATEGORIES: ToolCategory[] = [
  "TRADE",
  "INTELLIGENCE",
  "CREATE",
  "SOCIAL",
  "MONITOR",
  "ORBITX",
];

export function ToolSheet({ visible, tools, onSelect, onClose }: ToolSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "ALL">("ALL");

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory =
        activeCategory === "ALL" || tool.category === activeCategory;
      const matchesQuery =
        normalized.length === 0 ||
        tool.name.toLowerCase().includes(normalized) ||
        tool.description.toLowerCase().includes(normalized) ||
        tool.category.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [tools, query, activeCategory]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close tools sheet"
        />

        <View
          style={[
            styles.panel,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Tools</Text>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search tools…"
              placeholderTextColor="rgba(176, 198, 232, 0.38)"
              style={styles.searchInput}
              selectionColor={colors.signal}
              autoCorrect={false}
              {...(Platform.OS === "web"
                ? ({ outlineStyle: "none" } as Record<string, string>)
                : {})}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            <Pressable
              style={({ pressed }) => [
                styles.categoryChip,
                activeCategory === "ALL" && styles.categoryChipActive,
                pressed && styles.pressed,
              ]}
              onPress={() => setActiveCategory("ALL")}
            >
              <Text
                style={[
                  styles.categoryLabel,
                  activeCategory === "ALL" && styles.categoryLabelActive,
                ]}
              >
                ALL
              </Text>
            </Pressable>
            {CATEGORIES.map((category) => (
              <Pressable
                key={category}
                style={({ pressed }) => [
                  styles.categoryChip,
                  activeCategory === category && styles.categoryChipActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setActiveCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryLabel,
                    activeCategory === category && styles.categoryLabelActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredTools.map((tool) => (
              <Pressable
                key={tool.id}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                onPress={() => {
                  onSelect(tool.id);
                  onClose();
                }}
                accessibilityRole="button"
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{tool.name}</Text>
                  <Text style={styles.itemCategory}>{tool.category}</Text>
                </View>
                <Text style={styles.itemDescription}>{tool.description}</Text>
              </Pressable>
            ))}

            {filteredTools.length === 0 ? (
              <Text style={styles.empty}>No tools match your search.</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  panel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.glass,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: "82%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  closeLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 8,
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none" } as Record<string, string>)
      : {}),
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 12,
  },
  categoryChip: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  categoryChipActive: {
    backgroundColor: "rgba(126, 182, 255, 0.12)",
    borderColor: "rgba(126, 182, 255, 0.28)",
  },
  categoryLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  categoryLabelActive: {
    color: colors.ice,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 8,
  },
  item: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemName: {
    flex: 1,
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  itemCategory: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  itemDescription: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },
  pressed: {
    opacity: 0.74,
  },
});
