import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AGENTS, TOOLS } from "../../src/brain";
import { AgentCard } from "../../src/components";
import { useAuth } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

type AgentTaskRow = {
  id: string;
  name: string;
  trigger: string;
  status: string;
  tools: string[];
  permissions: string;
};

type BuilderDraft = {
  name: string;
  trigger: string;
  toolIds: string[];
  permissions: "read_only" | "confirm_every_action" | "limited_automation";
};

const DEFAULT_DRAFT: BuilderDraft = {
  name: "",
  trigger: "",
  toolIds: [],
  permissions: "read_only",
};

export default function AgentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();

  const [customAgents, setCustomAgents] = useState<AgentTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draft, setDraft] = useState<BuilderDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);

  const coreAgents = useMemo(
    () => AGENTS.filter((a) => a.marketplace === "core"),
    [],
  );
  const specialistAgents = useMemo(
    () => AGENTS.filter((a) => a.marketplace !== "core"),
    [],
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("orbitx_ai_agent_tasks")
        .select("id, title, status, payload, agent_id, created_at")
        .order("created_at", { ascending: false });

      if (dbError) {
        setError(dbError.message);
        setCustomAgents([]);
        return;
      }

      setCustomAgents(
        (data ?? []).map((row) => {
          const payload =
            typeof row.payload === "object" && row.payload !== null
              ? (row.payload as Record<string, unknown>)
              : {};
          return {
            id: String(row.id),
            name: String(row.title ?? row.agent_id ?? "Agent"),
            trigger: String(payload.trigger ?? ""),
            status: String(row.status ?? "idle"),
            tools: Array.isArray(payload.tools)
              ? payload.tools.map(String)
              : [],
            permissions: String(payload.permissions ?? "confirm_every_action"),
          };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const toggleTool = (toolId: string) => {
    setDraft((prev) => ({
      ...prev,
      toolIds: prev.toolIds.includes(toolId)
        ? prev.toolIds.filter((id) => id !== toolId)
        : [...prev.toolIds, toolId],
    }));
  };

  const activateAgent = async () => {
    if (!draft.name.trim() || !draft.trigger.trim()) {
      setError("Name and trigger are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from("orbitx_ai_agent_tasks")
        .insert({
          user_id: userId ?? undefined,
          agent_id: "custom",
          title: draft.name.trim(),
          status: "idle",
          payload: {
            trigger: draft.trigger.trim(),
            tools: draft.toolIds,
            permissions: draft.permissions,
          },
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setBuilderOpen(false);
      setPreviewOpen(false);
      setDraft(DEFAULT_DRAFT);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Agents</Text>
        <Text style={styles.subtitle}>
          Installed core agents and specialist automations. Agent marketplace is
          not live yet.
        </Text>

        <Pressable
          style={styles.createButton}
          onPress={() => {
            setDraft(DEFAULT_DRAFT);
            setBuilderOpen(true);
          }}
        >
          <Text style={styles.createButtonText}>Create agent</Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Core · Installed</Text>
        {coreAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            name={agent.name}
            description={agent.description}
            status="idle"
            tier="core"
          />
        ))}

        <Text style={styles.sectionLabel}>Specialists</Text>
        {specialistAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            name={agent.name}
            description={agent.description}
            status="idle"
            tier="specialist"
            onPress={() =>
              router.push({
                pathname: "/(app)",
                params: {
                  context: `Configure the ${agent.name} specialist: ${agent.description}`,
                },
              })
            }
          />
        ))}

        <Text style={styles.sectionLabel}>Your agents</Text>
        {loading ? (
          <ActivityIndicator color={colors.signal} />
        ) : customAgents.length === 0 ? (
          <Text style={styles.muted}>No custom agents yet.</Text>
        ) : (
          customAgents.map((agent) => (
            <View key={agent.id} style={styles.customCard}>
              <Text style={styles.customName}>{agent.name}</Text>
              <Text style={styles.customMeta}>
                {agent.status} · {agent.permissions}
              </Text>
              <Text style={styles.customTrigger}>{agent.trigger}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={builderOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>Agent builder</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder="e.g. Whale watcher"
              placeholderTextColor={colors.mute}
            />

            <Text style={styles.fieldLabel}>Trigger</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={draft.trigger}
              onChangeText={(trigger) => setDraft((d) => ({ ...d, trigger }))}
              placeholder="When SOL drops 5% in 1h…"
              placeholderTextColor={colors.mute}
              multiline
            />

            <Text style={styles.fieldLabel}>Tools</Text>
            <ScrollView style={styles.toolPicker} nestedScrollEnabled>
              {TOOLS.slice(0, 12).map((tool) => (
                <Pressable
                  key={tool.id}
                  style={styles.toolRow}
                  onPress={() => toggleTool(tool.id)}
                >
                  <Text style={styles.toolRowName}>{tool.name}</Text>
                  <Switch
                    value={draft.toolIds.includes(tool.id)}
                    onValueChange={() => toggleTool(tool.id)}
                    trackColor={{ false: colors.ink, true: colors.signal }}
                  />
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Permissions</Text>
            {(
              [
                "read_only",
                "confirm_every_action",
                "limited_automation",
              ] as const
            ).map((perm) => (
              <Pressable
                key={perm}
                style={[
                  styles.permChip,
                  draft.permissions === perm && styles.permChipActive,
                ]}
                onPress={() => setDraft((d) => ({ ...d, permissions: perm }))}
              >
                <Text style={styles.permChipText}>{perm.replace(/_/g, " ")}</Text>
              </Pressable>
            ))}

            <View style={styles.sheetActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setBuilderOpen(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setPreviewOpen(true)}
              >
                <Text style={styles.primaryButtonText}>Preview</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={previewOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.previewCard}>
            <Text style={styles.sheetTitle}>Preview before activate</Text>
            <Text style={styles.previewLine}>Name: {draft.name || "—"}</Text>
            <Text style={styles.previewLine}>Trigger: {draft.trigger || "—"}</Text>
            <Text style={styles.previewLine}>
              Tools: {draft.toolIds.length} selected
            </Text>
            <Text style={styles.previewLine}>
              Permissions: {draft.permissions.replace(/_/g, " ")}
            </Text>
            <View style={styles.sheetActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setPreviewOpen(false)}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => void activateAgent()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.void} />
                ) : (
                  <Text style={styles.primaryButtonText}>Activate</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  content: {
    padding: 20,
    gap: 12,
    paddingBottom: 32,
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
    lineHeight: 20,
  },
  createButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
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
  sectionLabel: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 8,
    textTransform: "uppercase",
  },
  muted: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  customCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: 4,
  },
  customName: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  customMeta: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  customTrigger: {
    color: colors.ice,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 8,
    maxHeight: "88%",
  },
  sheetTitle: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 20,
    marginBottom: 4,
  },
  fieldLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 6,
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 12,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  toolPicker: {
    maxHeight: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  toolRowName: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  permChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginTop: 4,
  },
  permChipActive: {
    backgroundColor: "rgba(126, 182, 255, 0.2)",
  },
  permChipText: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textTransform: "capitalize",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  previewCard: {
    margin: 20,
    backgroundColor: colors.ink,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  previewLine: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
