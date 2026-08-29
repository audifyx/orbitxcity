import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TOOLS, getTool, type ToolDefinition } from "../../src/brain";
import { colors } from "../../src/theme";

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const filtered = TOOLS.filter((tool) => {
      const haystack = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });

    const map = new Map<string, ToolDefinition[]>();
    for (const tool of filtered) {
      const category = tool.category || "General";
      const list = map.get(category) ?? [];
      list.push(tool);
      map.set(category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [query]);

  const startToolChat = (toolId: string) => {
    const tool = getTool(toolId);
    if (!tool) {
      return;
    }
    router.push({
      pathname: "/(app)",
      params: {
        context: `Use the ${tool.name} tool: ${tool.description}`,
      },
    });
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Tools</Text>
        <Text style={styles.subtitle}>Searchable catalog of OrbitX capabilities</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tools…"
          placeholderTextColor={colors.mute}
          style={styles.search}
          selectionColor={colors.signal}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {grouped.length === 0 ? (
          <Text style={styles.empty}>No tools match your search.</Text>
        ) : (
          grouped.map(([category, tools]) => (
            <View key={category} style={styles.section}>
              <Text style={styles.sectionTitle}>{category}</Text>
              {tools.map((tool) => (
                <Pressable
                  key={tool.id}
                  style={({ pressed }) => [
                    styles.toolCard,
                    pressed && styles.toolCardPressed,
                  ]}
                  onPress={() => startToolChat(tool.id)}
                >
                  <Text style={styles.toolName}>{tool.name}</Text>
                  <Text style={styles.toolDescription} numberOfLines={2}>
                    {tool.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  header: {
    padding: 20,
    gap: 8,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  search: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  toolCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: 6,
  },
  toolCardPressed: {
    opacity: 0.85,
  },
  toolName: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  toolDescription: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginTop: 40,
  },
});
