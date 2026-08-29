import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertCard } from "../../src/components";
import { useAuth } from "../../src/lib/auth";
import { invokeFunction } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

type AlertItem = {
  id: string;
  condition: string;
  status: string;
  createdAt?: string;
};

function parseAlerts(value: unknown): AlertItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, index) => ({
      id: String(item.id ?? `alert-${index}`),
      condition: String(item.nl_request ?? item.name ?? item.condition ?? "Alert"),
      status: item.enabled === false ? "paused" : String(item.status ?? "active"),
      createdAt:
        typeof item.created_at === "string" ? item.created_at : undefined,
    }));
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { wallet, userId } = useAuth();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeFunction("alerts", {
        action: "list",
        wallet,
        userId,
      });
      const parsed = parseAlerts(
        typeof result === "object" && result !== null && "rules" in result
          ? (result as { rules: unknown }).rules
          : result
      );
      setAlerts(parsed);
    } catch (err) {
      setAlerts([]);
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [wallet, userId]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const createAlert = async () => {
    const condition = draft.trim();
    if (!condition || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const parsed = await invokeFunction("alerts", {
        action: "parse",
        nl_request: condition,
      });
      setError(
        "Condition parsed. Creating a live alert still needs a webhook URL in OrbitX Alerts — OrbitX will not silently invent a destination.",
      );
      const conditions =
        typeof parsed === "object" &&
        parsed !== null &&
        "conditions" in parsed
          ? JSON.stringify((parsed as { conditions: unknown }).conditions)
          : JSON.stringify(parsed);
      setAlerts((prev) => [
        {
          id: `draft-${Date.now()}`,
          condition: `${condition} → ${conditions}`,
          status: "draft",
        },
        ...prev,
      ]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <Text style={styles.subtitle}>Get notified when conditions hit</Text>
      </View>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Alert me when…"
          placeholderTextColor={colors.mute}
          style={styles.input}
          selectionColor={colors.signal}
          multiline
        />
        <Pressable
          style={[styles.sendButton, submitting && styles.sendDisabled]}
          onPress={() => void createAlert()}
          disabled={submitting || !draft.trim()}
        >
          {submitting ? (
            <ActivityIndicator color={colors.void} size="small" />
          ) : (
            <Text style={styles.sendText}>Set</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <ActivityIndicator color={colors.signal} style={styles.loader} />
        ) : alerts.length === 0 ? (
          <Text style={styles.empty}>
            No alerts yet. Describe a condition above to create one.
          </Text>
        ) : (
          alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              condition={alert.condition}
              status={alert.status}
              createdAt={alert.createdAt}
            />
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
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    margin: 16,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.composer,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  input: {
    flex: 1,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 6,
  },
  sendButton: {
    minWidth: 52,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sendDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
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
  list: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginTop: 32,
    lineHeight: 22,
  },
});
