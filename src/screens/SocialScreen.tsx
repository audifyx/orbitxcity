import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../lib/auth";
import { invokeFunction, supabase } from "../lib/supabase";
import { colors } from "../theme";

export function SocialScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [status, setStatus] = useState("Checking X connection…");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await invokeFunction("x-poster", { action: "status" });
      const rec =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : {};
      if (rec.connected === true) {
        const username =
          typeof rec.username === "string" ? rec.username : undefined;
        setStatus(`Connected${username ? ` as @${username}` : ""}`);
      } else {
        setStatus(
          typeof rec.error === "string"
            ? rec.error
            : "X is not connected for this wallet.",
        );
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not read X status",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveDraft() {
    if (!userId) {
      setMessage("Sign in with email or phone first.");
      return;
    }
    if (!draft.trim()) return;
    const { error } = await supabase.from("orbitx_ai_transaction_intents").insert({
      user_id: userId,
      kind: "x_post",
      status: "preview",
      quote: {
        text: draft.trim(),
        note: "User JWT cannot call x-poster action=post (service-role only).",
      },
    });
    setMessage(
      error
        ? error.message
        : "Draft saved. Publishing is service-role only — this app will not fake a tweet.",
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Social</Text>
        <Text style={styles.subtitle}>
          X status via existing x-poster. Compose drafts; never fake publish.
        </Text>
        <View style={styles.card}>
          <Text style={styles.k}>Status</Text>
          <Text style={styles.v}>{status}</Text>
        </View>
        <TextInput
          style={[styles.input, styles.area]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Compose a post…"
          placeholderTextColor={colors.mute}
          multiline
          maxLength={280}
        />
        <Pressable style={styles.btn} onPress={() => void saveDraft()}>
          <Text style={styles.btnText}>Save draft</Text>
        </Pressable>
        <Pressable onPress={() => void refresh()}>
          <Text style={styles.link}>Refresh connection</Text>
        </Pressable>
        {message ? <Text style={styles.note}>{message}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
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
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    backgroundColor: colors.surface,
  },
  k: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  v: { color: colors.frost, fontFamily: "Inter_400Regular", lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    backgroundColor: colors.surface,
  },
  area: { minHeight: 120, textAlignVertical: "top" },
  btn: {
    backgroundColor: colors.frost,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  link: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  note: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
});
