import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

type ActivityItem = {
  id: string;
  kind: "task" | "tool" | "intent";
  title: string;
  status: string;
  detail?: string;
  createdAt?: string;
};

function statusColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("pending") || normalized.includes("awaiting")) {
    return "#FFCC80";
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return "#FF8A8A";
  }
  if (normalized.includes("complete") || normalized.includes("success")) {
    return "#7EE0C4";
  }
  return colors.mute;
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasks, tools, intents] = await Promise.all([
        supabase
          .from("orbitx_ai_agent_tasks")
          .select("id, title, status, payload, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("orbitx_ai_tool_executions")
          .select("id, tool_id, status, error_code, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("orbitx_ai_transaction_intents")
          .select("id, kind, status, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      const errors = [tasks.error, tools.error, intents.error].filter(Boolean);
      if (errors.length > 0) {
        setError(errors.map((e) => e?.message).join(" · "));
      }

      const merged: ActivityItem[] = [
        ...(tasks.data ?? []).map((row) => ({
          id: `task-${String(row.id)}`,
          kind: "task" as const,
          title: String(row.title ?? "Agent task"),
          status: String(row.status ?? "idle"),
          detail:
            typeof row.payload === "object" &&
            row.payload !== null &&
            "trigger" in (row.payload as Record<string, unknown>)
              ? String((row.payload as Record<string, unknown>).trigger ?? "")
              : undefined,
          createdAt: row.created_at ?? undefined,
        })),
        ...(tools.data ?? []).map((row) => ({
          id: `tool-${String(row.id)}`,
          kind: "tool" as const,
          title: String(row.tool_id ?? "Tool execution"),
          status: String(row.status ?? "unknown"),
          detail: typeof row.error_code === "string" ? row.error_code : undefined,
          createdAt: row.created_at ?? undefined,
        })),
        ...(intents.data ?? []).map((row) => ({
          id: `intent-${String(row.id)}`,
          kind: "intent" as const,
          title: String(row.kind ?? "Transaction intent"),
          status: String(row.status ?? "pending"),
          createdAt: row.created_at ?? undefined,
        })),
      ].sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
      });

      setItems(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const pendingSignatures = items.filter(
    (item) =>
      item.kind === "intent" &&
      item.status.toLowerCase().includes("pending")
  );

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>
          Agent tasks, tool runs, and transaction intents
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {pendingSignatures.length > 0 ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Pending signatures</Text>
          {pendingSignatures.map((item) => (
            <Text key={item.id} style={styles.pendingItem}>
              {item.title} · {item.status}
            </Text>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <ActivityIndicator color={colors.signal} style={styles.loader} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>No activity yet.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.kind}>{item.kind}</Text>
                <Text style={[styles.status, { color: statusColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.detail ? (
                <Text style={styles.rowDetail} numberOfLines={2}>
                  {item.detail}
                </Text>
              ) : null}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 4,
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
  errorBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 120, 90, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 150, 120, 0.25)",
  },
  errorText: {
    color: "#FFB899",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  pendingBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 200, 120, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 210, 140, 0.28)",
    gap: 6,
  },
  pendingTitle: {
    color: "#FFD699",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pendingItem: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 32,
  },
  empty: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginTop: 40,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: 6,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kind: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  status: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  rowTitle: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  rowDetail: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
});
