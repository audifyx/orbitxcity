import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEFAULT_MODEL_ID, MODELS, resolveModelId } from "../../src/brain";
import { useAuth } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

type MemoryRow = {
  id: string;
  content: string;
  enabled: boolean;
};

type PermissionMode =
  | "read_only"
  | "confirm_every_action"
  | "limited_automation";

const PERMISSION_OPTIONS: PermissionMode[] = [
  "read_only",
  "confirm_every_action",
  "limited_automation",
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_MODEL_ID);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [permissionMode, setPermissionMode] =
    useState<PermissionMode>("read_only");
  const [loading, setLoading] = useState(true);
  const [pausing, setPausing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memoryQuery = supabase
        .from("orbitx_ai_memory")
        .select("id, content, enabled")
        .order("created_at", { ascending: false });

      if (userId) {
        memoryQuery.eq("user_id", userId);
      }

      const [memoryResult, permResult] = await Promise.all([
        memoryQuery,
        userId
          ? supabase
              .from("orbitx_ai_permissions")
              .select("mode")
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (memoryResult.error) {
        setError(memoryResult.error.message);
      } else {
        setMemories(
          (memoryResult.data ?? []).map((row) => ({
            id: String(row.id),
            content: String(row.content ?? ""),
            enabled: row.enabled !== false,
          }))
        );
      }

      if (
        permResult.data &&
        typeof permResult.data.mode === "string" &&
        PERMISSION_OPTIONS.includes(permResult.data.mode as PermissionMode)
      ) {
        setPermissionMode(permResult.data.mode as PermissionMode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const savePermission = async (mode: PermissionMode) => {
    setPermissionMode(mode);
    if (!userId) {
      return;
    }
    try {
      const { error: upsertError } = await supabase
        .from("orbitx_ai_permissions")
        .upsert({ user_id: userId, mode }, { onConflict: "user_id" });
      if (upsertError) {
        setError(upsertError.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    }
  };

  const toggleMemory = async (memory: MemoryRow) => {
    try {
      const { error: updateError } = await supabase
        .from("orbitx_ai_memory")
        .update({ enabled: !memory.enabled })
        .eq("id", memory.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMemories((prev) =>
        prev.map((m) =>
          m.id === memory.id ? { ...m, enabled: !m.enabled } : m
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update memory");
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("orbitx_ai_memory")
        .delete()
        .eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory");
    }
  };

  const pauseAllAgents = () => {
    Alert.alert(
      "Pause all agents",
      "This stops every running agent task until you resume them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pause",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setPausing(true);
              setError(null);
              try {
                if (!userId) {
                  throw new Error("Connect a wallet before pausing agents.");
                }
                const { error: permError } = await supabase
                  .from("orbitx_ai_permissions")
                  .upsert(
                    {
                      user_id: userId,
                      mode: permissionMode,
                      trading_paused: true,
                    },
                    { onConflict: "user_id" },
                  );
                if (permError) {
                  throw new Error(permError.message);
                }
                const { error: updateError } = await supabase
                  .from("orbitx_ai_agent_tasks")
                  .update({ status: "paused" })
                  .eq("user_id", userId);
                if (updateError) {
                  setError(updateError.message);
                }
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Failed to pause agents"
                );
              } finally {
                setPausing(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Text style={styles.title}>Settings</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Default AI model</Text>
      <View style={styles.card}>
        {MODELS.map((model) => (
          <Pressable
            key={model.id}
            style={[
              styles.modelRow,
              defaultModelId === model.id && styles.modelRowActive,
            ]}
            onPress={() => setDefaultModelId(resolveModelId(model.id))}
          >
            <Text style={styles.modelName}>{model.label}</Text>
            {defaultModelId === model.id ? (
              <Text style={styles.check}>✓</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Memory</Text>
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={colors.signal} />
        ) : memories.length === 0 ? (
          <Text style={styles.muted}>No saved memories.</Text>
        ) : (
          memories.map((memory) => (
            <View key={memory.id} style={styles.memoryRow}>
              <View style={styles.memoryBody}>
                <Text style={styles.memoryText} numberOfLines={3}>
                  {memory.content}
                </Text>
                <Switch
                  value={memory.enabled}
                  onValueChange={() => void toggleMemory(memory)}
                  trackColor={{ false: colors.ink, true: colors.signal }}
                />
              </View>
              <Pressable onPress={() => void deleteMemory(memory.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionLabel}>Agent permissions</Text>
      <View style={styles.card}>
        {PERMISSION_OPTIONS.map((mode) => (
          <Pressable
            key={mode}
            style={[
              styles.permRow,
              permissionMode === mode && styles.permRowActive,
            ]}
            onPress={() => void savePermission(mode)}
          >
            <Text style={styles.permText}>{mode.replace(/_/g, " ")}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.pauseButton, pausing && styles.pauseDisabled]}
        onPress={pauseAllAgents}
        disabled={pausing}
      >
        {pausing ? (
          <ActivityIndicator color={colors.frost} />
        ) : (
          <Text style={styles.pauseText}>Pause all agents</Text>
        )}
      </Pressable>

      <Text style={styles.sectionLabel}>Privacy</Text>
      <View style={styles.privacyCard}>
        <Text style={styles.privacyText}>
          Conversations are stored in your OrbitX account with RLS. Message
          contents are sent to the selected model provider to generate replies.
          OrbitX does not log prompt contents in application logs. Email and
          phone sign-in create an in-app wallet. Private keys never leave that
          wallet.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  content: {
    padding: 20,
    gap: 10,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
    marginBottom: 4,
  },
  sectionLabel: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 8,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  modelRowActive: {
    backgroundColor: "rgba(126, 182, 255, 0.12)",
  },
  modelName: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  check: {
    color: colors.signal,
    fontSize: 16,
  },
  memoryRow: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    gap: 8,
  },
  memoryBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memoryText: {
    flex: 1,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  deleteText: {
    color: "#FF8A8A",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  permRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  permRowActive: {
    backgroundColor: "rgba(126, 182, 255, 0.12)",
  },
  permText: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textTransform: "capitalize",
  },
  pauseButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 100, 100, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 130, 130, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseDisabled: {
    opacity: 0.7,
  },
  pauseText: {
    color: "#FFAAAA",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  privacyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
  },
  privacyText: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  muted: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 14,
  },
  errorBox: {
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
});
