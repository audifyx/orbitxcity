import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { invokeFunction } from "../lib/supabase";
import { colors } from "../theme";

type ScanHit = { mint?: string; symbol?: string; name?: string; score?: number };

function asHits(data: unknown): ScanHit[] {
  if (Array.isArray(data)) return data as ScanHit[];
  if (typeof data === "object" && data !== null) {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.results)) return rec.results as ScanHit[];
    if (Array.isArray(rec.tokens)) return rec.tokens as ScanHit[];
    if (rec.token && typeof rec.token === "object") {
      return [rec.token as ScanHit];
    }
  }
  return [];
}

export function ResearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<ScanHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await invokeFunction("og-scan-token", {
        query: query.trim(),
      });
      const list = asHits(data).slice(0, 20);
      setHits(list);
      if (list.length === 0) setError("No scan hits. Try a mint or ticker.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Research</Text>
        <Text style={styles.subtitle}>
          OG Scan over existing og-scan-token. Not a hallucinated report.
        </Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Mint or ticker"
            placeholderTextColor={colors.mute}
            autoCapitalize="none"
            onSubmitEditing={() => void run()}
          />
          <Pressable style={styles.btn} onPress={() => void run()} disabled={busy}>
            <Text style={styles.btnText}>{busy ? "…" : "Scan"}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {hits.map((hit, index) => (
          <View
            key={`${hit.mint ?? hit.symbol ?? index}`}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{hit.symbol ?? hit.name ?? "Token"}</Text>
            <Text style={styles.meta} numberOfLines={2}>
              {hit.mint ?? "no mint"}
            </Text>
            {hit.score != null ? (
              <Text style={styles.meta}>score {hit.score}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
  content: { padding: 20, gap: 10, paddingBottom: 48 },
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
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    backgroundColor: colors.surface,
  },
  btn: {
    backgroundColor: colors.frost,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  error: { color: colors.danger, fontFamily: "Inter_400Regular", fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.frost, fontFamily: "Inter_500Medium" },
  meta: { color: colors.mute, fontFamily: "Inter_400Regular", fontSize: 12 },
});
