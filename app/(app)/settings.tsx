import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_MODEL_ID,
  MODELS,
  resolveModelId,
} from "../../src/brain";
import {
  SettingsView,
  type SettingsPermissionOption,
} from "../../src/components";
import { useAuth } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { openExternalUrl } from "../../src/lib/walletOpen";

type MemoryRow = {
  id: string;
  content: string;
  enabled: boolean;
};

type PermissionMode =
  | "read_only"
  | "confirm_every_action"
  | "limited_automation";

const PERMISSION_OPTIONS: SettingsPermissionOption[] = [
  { id: "read_only", label: "Read only" },
  { id: "confirm_every_action", label: "Confirm every action" },
  { id: "limited_automation", label: "Limited automation" },
];

const MODEL_STORAGE_KEY = "orbitx.defaultModelId";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, wallet } = useAuth();

  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_MODEL_ID);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [permissionMode, setPermissionMode] =
    useState<PermissionMode>("read_only");
  const [loading, setLoading] = useState(true);
  const [pausing, setPausing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Restore the persisted default model so it survives reloads.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
        if (!cancelled && stored) {
          setDefaultModelId(resolveModelId(stored));
        }
      } catch {
        // Non-fatal: fall back to the default model.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectModel = useCallback((id: string) => {
    const resolved = resolveModelId(id);
    setDefaultModelId(resolved);
    void AsyncStorage.setItem(MODEL_STORAGE_KEY, resolved).catch(() => undefined);
  }, []);

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
          })),
        );
      }

      if (
        permResult.data &&
        typeof permResult.data.mode === "string" &&
        PERMISSION_OPTIONS.some((option) => option.id === permResult.data?.mode)
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

  const savePermission = useCallback(
    async (mode: string) => {
      setPermissionMode(mode as PermissionMode);
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
        setError(
          err instanceof Error ? err.message : "Failed to save permissions",
        );
      }
    },
    [userId],
  );

  const toggleMemory = useCallback(
    async (id: string) => {
      const memory = memories.find((m) => m.id === id);
      if (!memory) {
        return;
      }
      try {
        const { error: updateError } = await supabase
          .from("orbitx_ai_memory")
          .update({ enabled: !memory.enabled })
          .eq("id", id);
        if (updateError) {
          setError(updateError.message);
          return;
        }
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update memory");
      }
    },
    [memories],
  );

  const deleteMemory = useCallback(async (id: string) => {
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
  }, []);

  const runPause = useCallback(async () => {
    setPausing(true);
    setError(null);
    try {
      if (!userId) {
        throw new Error("Connect a wallet before pausing agents.");
      }
      const { error: permError } = await supabase
        .from("orbitx_ai_permissions")
        .upsert(
          { user_id: userId, mode: permissionMode, trading_paused: true },
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
      setError(err instanceof Error ? err.message : "Failed to pause agents");
    } finally {
      setPausing(false);
    }
  }, [permissionMode, userId]);

  const pauseAllAgents = useCallback(() => {
    if (Platform.OS === "web") {
      const ok =
        typeof window === "undefined" ||
        window.confirm(
          "Pause all agents? This stops every running agent task until you resume them.",
        );
      if (ok) {
        void runPause();
      }
      return;
    }
    Alert.alert(
      "Pause all agents",
      "This stops every running agent task until you resume them.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Pause", style: "destructive", onPress: () => void runPause() },
      ],
    );
  }, [runPause]);

  const copyAddress = useCallback(async () => {
    if (
      wallet &&
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.clipboard
    ) {
      try {
        await navigator.clipboard.writeText(wallet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Could not copy address.");
      }
    }
  }, [wallet]);

  return (
    <SettingsView
      walletAddress={wallet}
      models={MODELS.map((model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
      }))}
      selectedModelId={defaultModelId}
      onSelectModel={selectModel}
      memories={memories}
      memoriesLoading={loading}
      onToggleMemory={(id) => void toggleMemory(id)}
      onDeleteMemory={(id) => void deleteMemory(id)}
      permissionOptions={PERMISSION_OPTIONS}
      permissionMode={permissionMode}
      onSelectPermission={(id) => void savePermission(id)}
      pausing={pausing}
      onPauseAll={pauseAllAgents}
      onOpenProfile={() => router.push("/profile")}
      copied={copied}
      onCopyAddress={() => void copyAddress()}
      error={error}
      bottomInset={insets.bottom}
    />
  );
}
