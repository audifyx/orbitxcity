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
import { supabase } from "../lib/supabase";
import { colors } from "../theme";

type Portfolio = {
  user_id: string;
  sol_balance: number;
  total_realized_pnl: number;
  total_trades: number | null;
};

export function PaperScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [symbol, setSymbol] = useState("BONK");
  const [qty, setQty] = useState("0.1");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("paper_portfolio")
      .select("user_id, sol_balance, total_realized_pnl, total_trades")
      .eq("user_id", userId)
      .maybeSingle();
    setPortfolio((data as Portfolio | null) ?? null);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensurePortfolio(): Promise<Portfolio> {
    if (!userId) throw new Error("Connect wallet first");
    if (portfolio) return portfolio;
    const { data, error } = await supabase
      .from("paper_portfolio")
      .upsert(
        {
          user_id: userId,
          sol_balance: 10,
          win_count: 0,
          loss_count: 0,
          total_realized_pnl: 0,
          initial_balance: 10,
          total_trades: 0,
        },
        { onConflict: "user_id" },
      )
      .select("user_id, sol_balance, total_realized_pnl, total_trades")
      .single();
    if (error) throw error;
    const book = data as Portfolio;
    setPortfolio(book);
    return book;
  }

  async function simulate() {
    try {
      const book = await ensurePortfolio();
      const size = Number(qty);
      if (!Number.isFinite(size) || size <= 0) {
        throw new Error("SOL amount must be positive");
      }
      const nextCash =
        side === "buy"
          ? Number(book.sol_balance) - size
          : Number(book.sol_balance) + size;
      if (nextCash < 0) throw new Error("Insufficient paper SOL");
      const tokenMint =
        symbol.trim().length >= 32
          ? symbol.trim()
          : `paper:${symbol.trim().toUpperCase() || "TOKEN"}`;
      const { error: orderError } = await supabase.from("paper_orders").insert({
        user_id: userId,
        order_type: "market",
        side,
        token_mint: tokenMint,
        token_symbol: symbol.trim().toUpperCase() || "TOKEN",
        sol_amount: size,
        fill_price: 1,
        token_amount: size,
        status: "filled",
        filled_at: new Date().toISOString(),
      });
      if (orderError) throw orderError;
      await supabase
        .from("paper_portfolio")
        .update({
          sol_balance: nextCash,
          total_trades: (book.total_trades ?? 0) + 1,
        })
        .eq("user_id", userId);
      setMessage(
        `${side.toUpperCase()} ${size} SOL of ${symbol.toUpperCase()} filled at sim price 1. Paper only — no chain tx.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Paper trade failed");
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Paper</Text>
        <Text style={styles.subtitle}>
          Simulated fills against paper_portfolio. Never broadcasts on-chain.
        </Text>
        <View style={styles.card}>
          <Text style={styles.k}>Paper SOL</Text>
          <Text style={styles.v}>
            {portfolio ? Number(portfolio.sol_balance).toFixed(4) : "—"}
          </Text>
          <Text style={styles.k}>Realized PnL</Text>
          <Text style={styles.v}>
            {portfolio ? Number(portfolio.total_realized_pnl).toFixed(4) : "—"}
          </Text>
        </View>
        <View style={styles.row}>
          <Pressable
            style={[styles.side, side === "buy" && styles.sideOn]}
            onPress={() => setSide("buy")}
          >
            <Text style={[styles.sideText, side === "buy" && styles.sideTextOn]}>
              Buy
            </Text>
          </Pressable>
          <Pressable
            style={[styles.side, side === "sell" && styles.sideOn]}
            onPress={() => setSide("sell")}
          >
            <Text style={[styles.sideText, side === "sell" && styles.sideTextOn]}>
              Sell
            </Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
          placeholder="Symbol or mint"
          placeholderTextColor={colors.mute}
        />
        <TextInput
          style={styles.input}
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          placeholder="SOL amount"
          placeholderTextColor={colors.mute}
        />
        <Pressable style={styles.btn} onPress={() => void simulate()}>
          <Text style={styles.btnText}>Simulate fill</Text>
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
    gap: 4,
    backgroundColor: colors.surface,
  },
  k: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  v: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  side: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  sideOn: { backgroundColor: colors.frost, borderColor: colors.frost },
  sideText: { color: colors.frost, fontFamily: "Inter_500Medium" },
  sideTextOn: { color: colors.void },
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
  btn: {
    backgroundColor: colors.frost,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  note: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
});
