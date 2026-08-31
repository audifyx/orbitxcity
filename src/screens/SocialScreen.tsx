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

import { useAuth } from "../lib/auth";
import { postToX } from "../lib/xPost";
import {
  disconnectXAccount,
  fetchXConnectionStatus,
  startXOAuth,
  type XConnectionStatus,
} from "../lib/xConnect";
import { colors } from "../theme";

export function SocialScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [connection, setConnection] = useState<XConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setConnection({ connected: false });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const status = await fetchXConnectionStatus(userId);
      setConnection(status);
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not read X status",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleConnect() {
    if (!userId) {
      setMessage("Sign in before connecting X.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const status = await startXOAuth();
      setConnection(status);
      setMessage(
        status.username
          ? `Connected as @${status.username}`
          : "X account connected.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "X connect failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setMessage(null);
    try {
      await disconnectXAccount();
      setConnection({ connected: false });
      setMessage("Disconnected from X.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not disconnect X.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePost() {
    if (!userId) {
      setMessage("Sign in before posting.");
      return;
    }
    if (!connection?.connected) {
      setMessage("Connect your X account first.");
      return;
    }
    if (!draft.trim()) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await postToX(draft);
      setDraft("");
      setMessage(
        result.url
          ? `Posted · ${result.url}`
          : result.tweetId
            ? `Posted · tweet ${result.tweetId}`
            : "Posted on X.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Post failed.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = loading
    ? "Checking X connection…"
    : connection?.connected
      ? `Connected${connection.username ? ` as @${connection.username}` : ""}`
      : "Not connected — link X to post from OrbitX.";

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Social</Text>
        <Text style={styles.subtitle}>
          Connect X once, then post from here or tell the agent{" "}
          <Text style={styles.mono}>tweet: your message</Text>.
        </Text>

        <View style={styles.card}>
          <Text style={styles.k}>X account</Text>
          {loading ? (
            <ActivityIndicator color={colors.signal} />
          ) : (
            <Text style={styles.v}>{statusLabel}</Text>
          )}
          {connection?.displayName ? (
            <Text style={styles.meta}>{connection.displayName}</Text>
          ) : null}
        </View>

        <View style={styles.row}>
          {connection?.connected ? (
            <Pressable
              style={[styles.btnGhost, busy && styles.disabled]}
              onPress={() => void handleDisconnect()}
              disabled={busy}
            >
              <Text style={styles.btnGhostText}>Disconnect</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.btn, busy && styles.disabled]}
              onPress={() => void handleConnect()}
              disabled={busy}
            >
              <Text style={styles.btnText}>
                {busy ? "Connecting…" : "Connect X"}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => void refresh()} disabled={busy}>
            <Text style={styles.link}>Refresh</Text>
          </Pressable>
        </View>

        <TextInput
          style={[styles.input, styles.area]}
          value={draft}
          onChangeText={setDraft}
          placeholder="What's happening?"
          placeholderTextColor={colors.mute}
          multiline
          maxLength={280}
          editable={!busy}
        />
        <Text style={styles.counter}>{draft.length}/280</Text>

        <Pressable
          style={[
            styles.btn,
            (!connection?.connected || !draft.trim() || busy) && styles.disabled,
          ]}
          onPress={() => void handlePost()}
          disabled={!connection?.connected || !draft.trim() || busy}
        >
          <Text style={styles.btnText}>
            {busy ? "Posting…" : "Post to X"}
          </Text>
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
  mono: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
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
  meta: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
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
  counter: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "right",
    marginTop: -6,
  },
  btn: {
    backgroundColor: colors.frost,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  btnGhost: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  btnGhostText: { color: colors.mist, fontFamily: "Inter_600SemiBold" },
  link: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    paddingVertical: 14,
  },
  disabled: { opacity: 0.45 },
  note: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
});
