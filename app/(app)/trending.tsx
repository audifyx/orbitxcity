import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TokenCard } from "../../src/components";
import { invokeFunction } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

type TokenItem = {
  mint: string;
  symbol: string;
  price: string;
  marketCap: string;
  liquidity: string;
  volume: string;
  risk: string;
};

type SectionKey =
  | "trending"
  | "volume"
  | "momentum"
  | "new"
  | "whales"
  | "social"
  | "movers";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "volume", label: "Volume" },
  { key: "momentum", label: "Momentum" },
  { key: "new", label: "New" },
  { key: "whales", label: "Whales" },
  { key: "social", label: "Social" },
  { key: "movers", label: "Movers" },
];

function formatUsd(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return "—";
  }
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pairToToken(pair: unknown): TokenItem | null {
  if (!isRecord(pair)) {
    return null;
  }
  const base = isRecord(pair.baseToken) ? pair.baseToken : {};
  const mint = String(base.address ?? pair.pairAddress ?? "");
  const symbol = String(base.symbol ?? "—");
  if (!mint && symbol === "—") {
    return null;
  }
  const liquidity = isRecord(pair.liquidity) ? pair.liquidity.usd : undefined;
  const volume = isRecord(pair.volume) ? pair.volume.h24 : undefined;
  const change = isRecord(pair.priceChange) ? Number(pair.priceChange.h24) : NaN;
  return {
    mint: mint || symbol,
    symbol,
    price: formatUsd(pair.priceUsd),
    marketCap: formatUsd(pair.marketCap ?? pair.fdv),
    liquidity: formatUsd(liquidity),
    volume: formatUsd(volume),
    risk: Number.isFinite(change)
      ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}% 24h`
      : "—",
  };
}

async function fetchDex(): Promise<TokenItem[]> {
  const response = await fetch(
    "https://api.dexscreener.com/latest/dex/search?q=solana",
  );
  if (!response.ok) {
    throw new Error(`DexScreener ${response.status}`);
  }
  const json: unknown = await response.json();
  const pairs = isRecord(json) && Array.isArray(json.pairs) ? json.pairs : [];
  return pairs
    .map(pairToToken)
    .filter((item): item is TokenItem => item !== null)
    .slice(0, 16);
}

function sortSection(tokens: TokenItem[], section: SectionKey): TokenItem[] {
  const copy = [...tokens];
  if (section === "volume") {
    copy.sort((a, b) => b.volume.localeCompare(a.volume));
  }
  return copy;
}

async function fetchSection(section: SectionKey): Promise<TokenItem[]> {
  try {
    const remote = await invokeFunction("token-data", { action: "trending" });
    const trending =
      isRecord(remote) && Array.isArray(remote.trending) ? remote.trending : [];
    const mapped = trending
      .map(pairToToken)
      .filter((item): item is TokenItem => item !== null);
    if (mapped.length > 0) {
      return sortSection(mapped, section);
    }
  } catch {
    // Fall through to public DexScreener — token-data CORS is locked to orbitx.world.
  }

  return sortSection(await fetchDex(), section);
}

export default function TrendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionKey>("trending");
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (section: SectionKey) => {
    setError(null);
    try {
      const data = await fetchSection(section);
      setTokens(data);
      if (data.length === 0) {
        setError("No token data returned for this section.");
      }
    } catch (err) {
      setTokens([]);
      setError(err instanceof Error ? err.message : "Failed to load trending data");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load(activeSection).finally(() => setLoading(false));
  }, [activeSection, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(activeSection);
    setRefreshing(false);
  }, [activeSection, load]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Trending</Text>
        <Text style={styles.subtitle}>Live Solana market intelligence</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {SECTIONS.map((section) => {
          const active = section.key === activeSection;
          return (
            <Pressable
              key={section.key}
              onPress={() => setActiveSection(section.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.signal}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.signal} style={styles.loader} />
        ) : tokens.length === 0 && !error ? (
          <Text style={styles.empty}>No tokens to show right now.</Text>
        ) : (
          tokens.map((token) => (
            <TokenCard
              key={token.mint}
              symbol={token.symbol}
              price={token.price}
              marketCap={token.marketCap}
              liquidity={token.liquidity}
              volume={token.volume}
              risk={token.risk}
              onAnalyze={() =>
                router.push({
                  pathname: "/",
                  params: { context: `Analyze ${token.symbol} ${token.mint}` },
                })
              }
              onTrack={() =>
                router.push({
                  pathname: "/alerts",
                  params: { mint: token.mint, symbol: token.symbol },
                })
              }
              onBuy={() =>
                router.push({
                  pathname: "/",
                  params: {
                    context: `Quote buying 0.1 SOL of ${token.symbol} (${token.mint}). Do not execute.`,
                  },
                })
              }
              onSell={() =>
                router.push({
                  pathname: "/",
                  params: {
                    context: `Quote selling ${token.symbol} (${token.mint}) back to SOL. Do not execute.`,
                  },
                })
              }
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
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  tabs: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: "rgba(126, 182, 255, 0.18)",
  },
  tabText: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.frost,
  },
  errorBox: {
    marginHorizontal: 20,
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
    marginTop: 40,
  },
  empty: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginTop: 40,
  },
});
