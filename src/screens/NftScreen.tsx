import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { colors } from "../theme";

type NftRow = {
  id: string;
  name: string | null;
  symbol: string | null;
  mint_address: string | null;
  status: string | null;
  current_owner: string | null;
};

export function NftScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<NftRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: qError } = await supabase
        .from("orbitx_nfts")
        .select("id, name, symbol, mint_address, status, current_owner")
        .limit(40);
      if (qError) setError(qError.message);
      else setRows((data as NftRow[]) ?? []);
    })();
  }, []);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>NFTs</Text>
        <Text style={styles.subtitle}>
          Reads orbitx_nfts. Sales use nft-execute-sale after wallet confirm.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {rows.length === 0 && !error ? (
          <Text style={styles.empty}>No NFTs visible under current RLS.</Text>
        ) : null}
        {rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.name}>{row.name ?? "Untitled"}</Text>
            <Text style={styles.meta}>
              {row.symbol ?? "—"} · {row.status ?? "unknown"}
            </Text>
            <Text style={styles.mint} numberOfLines={1}>
              {row.mint_address}
            </Text>
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
    marginBottom: 8,
  },
  error: { color: colors.danger, fontFamily: "Inter_400Regular", fontSize: 13 },
  empty: { color: colors.mute, fontFamily: "Inter_400Regular" },
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    backgroundColor: colors.surface,
  },
  name: { color: colors.frost, fontFamily: "Inter_500Medium" },
  meta: { color: colors.mist, fontFamily: "Inter_400Regular", fontSize: 12 },
  mint: { color: colors.mute, fontFamily: "Inter_400Regular", fontSize: 11 },
});
