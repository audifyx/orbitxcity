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
import {
  buyOrbitxNft,
  listMarketplaceNfts,
  listOrbitxNft,
  mintOrbitxNft,
  type OrbitxNft,
} from "../lib/nftMarket";
import { colors } from "../theme";

export function NftScreen() {
  const insets = useSafeAreaInsets();
  const { wallet } = useAuth();
  const [rows, setRows] = useState<OrbitxNft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState("0.1");
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await listMarketplaceNfts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load NFTs.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function mint() {
    if (!wallet) {
      setError("Sign in to mint.");
      return;
    }
    if (!name.trim() || !symbol.trim()) {
      setError("Name and ticker are required.");
      return;
    }
    setBusy("mint");
    setError(null);
    try {
      const minted = await mintOrbitxNft({ wallet, name, symbol });
      setName("");
      setSymbol("");
      setError(`Minted ${minted.mint}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed.");
    } finally {
      setBusy(null);
    }
  }

  async function list(nft: OrbitxNft) {
    if (!wallet) {
      setError("Sign in to list.");
      return;
    }
    setBusy(nft.id);
    setError(null);
    try {
      await listOrbitxNft({
        nftId: nft.id,
        wallet,
        priceSol: Number(price) || 0.1,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "List failed.");
    } finally {
      setBusy(null);
    }
  }

  async function buy(nft: OrbitxNft) {
    if (!wallet || !nft.listing_id) {
      setError("Sign in and pick an active listing.");
      return;
    }
    setBusy(nft.id);
    setError(null);
    try {
      const signature = await buyOrbitxNft({
        listingId: nft.listing_id,
        wallet,
      });
      setError(`Bought · ${signature}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Buy failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>ORBITX MARKET</Text>
        <Text style={styles.title}>NFTs</Text>
        <Text style={styles.subtitle}>
          Mint a 1/1 on your wallet, list it, or buy a live listing. Buys settle
          through the OrbitX marketplace authority.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="NFT name"
          placeholderTextColor={colors.mute}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Ticker"
          placeholderTextColor={colors.mute}
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
        />
        <TextInput
          style={styles.input}
          placeholder="List price in SOL"
          placeholderTextColor={colors.mute}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />
        <Pressable style={styles.btn} onPress={() => void mint()} disabled={busy === "mint"}>
          <Text style={styles.btnText}>
            {busy === "mint" ? "Minting…" : "Approve & mint"}
          </Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {rows.length === 0 && !error ? (
          <Text style={styles.empty}>No NFTs visible yet. Mint the first one.</Text>
        ) : null}
        {rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.meta}>
              {row.symbol} · {row.status}
              {row.price_sol != null ? ` · ${row.price_sol} SOL` : ""}
            </Text>
            <Text style={styles.mint} numberOfLines={1}>
              {row.mint_address}
            </Text>
            <View style={styles.row}>
              {wallet && row.current_owner === wallet ? (
                <Pressable style={styles.small} onPress={() => void list(row)}>
                  <Text style={styles.smallText}>
                    {busy === row.id ? "…" : "List"}
                  </Text>
                </Pressable>
              ) : null}
              {row.listing_id ? (
                <Pressable style={styles.smallAccent} onPress={() => void buy(row)}>
                  <Text style={styles.smallAccentText}>
                    {busy === row.id ? "…" : "Buy"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
  content: { padding: 20, gap: 10, paddingBottom: 48 },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2.4,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 28,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.frost,
    backgroundColor: colors.surface,
  },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  error: { color: colors.warning, fontFamily: "Inter_400Regular", fontSize: 13 },
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
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  small: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallText: { color: colors.frost, fontFamily: "Inter_500Medium", fontSize: 12 },
  smallAccent: {
    borderRadius: 8,
    backgroundColor: colors.signal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallAccentText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
