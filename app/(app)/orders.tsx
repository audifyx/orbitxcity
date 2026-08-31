import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OrderCard } from "../../src/components/OrderCard";
import { useAuth } from "../../src/lib/auth";
import {
  cancelLimitOrder,
  createLimitOrder,
  listLimitOrders,
  subscribeLimitOrders,
  type LimitOrder,
  type LimitOrderSide,
} from "../../src/lib/limitOrders";
import { isSolanaPubkey } from "../../src/lib/wallets";
import { colors } from "../../src/theme";

type DeskTab = "all" | "buy" | "sell";

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { wallet } = useAuth();
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DeskTab>("all");
  const [side, setSide] = useState<LimitOrderSide>("sell");
  const [mint, setMint] = useState("");
  const [percent, setPercent] = useState("25");
  const [amountSol, setAmountSol] = useState("0.1");
  const [triggerType, setTriggerType] = useState<"mcap" | "price">("mcap");
  const [triggerValue, setTriggerValue] = useState("100000");
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await listLimitOrders(wallet);
    setOrders(rows);
    setLoading(false);
  }, [wallet]);

  useEffect(() => {
    void refresh();
    return subscribeLimitOrders((all) => {
      if (!wallet) {
        setOrders([]);
        return;
      }
      setOrders(all.filter((order) => order.wallet === wallet));
    });
  }, [refresh, wallet]);

  const filtered = useMemo(() => {
    if (tab === "all") {
      return orders;
    }
    return orders.filter((order) => order.side === tab);
  }, [orders, tab]);

  const pendingCount = orders.filter((order) => order.status === "pending").length;

  const placeOrder = async () => {
    if (!wallet) {
      setFormError("Sign in before placing a limit order.");
      return;
    }
    if (!isSolanaPubkey(mint.trim())) {
      setFormError("Paste a valid token mint.");
      return;
    }
    const target = Number(triggerValue);
    if (!Number.isFinite(target) || target <= 0) {
      setFormError("Enter a target mcap or price.");
      return;
    }

    setPlacing(true);
    setFormError(null);
    try {
      if (side === "sell") {
        const pct = Number(percent);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          throw new Error("Sell percent must be between 1 and 100.");
        }
        await createLimitOrder({
          wallet,
          mint: mint.trim(),
          side: "sell",
          percent: pct,
          triggerType,
          triggerValue: target,
        });
      } else {
        const sol = Number(amountSol);
        if (!Number.isFinite(sol) || sol <= 0) {
          throw new Error("Buy size must be greater than 0 SOL.");
        }
        await createLimitOrder({
          wallet,
          mint: mint.trim(),
          side: "buy",
          amountSol: sol,
          triggerType,
          triggerValue: target,
        });
      }
      setMint("");
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not place order.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <Text style={styles.kicker}>LIMIT DESK</Text>
      <Text style={styles.title}>Buy & sell limits</Text>
      <Text style={styles.subtitle}>
        Orders auto-sign with your OrbitX wallet when mcap or price hits your
        target. {pendingCount > 0 ? `${pendingCount} pending.` : ""}
      </Text>

      <View style={styles.tabRow}>
        {(["all", "buy", "sell"] as DeskTab[]).map((item) => (
          <Pressable
            key={item}
            style={[styles.tab, tab === item && styles.tabActive]}
            onPress={() => setTab(item)}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>
              {item === "all" ? "All" : item === "buy" ? "Buys" : "Sells"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>New limit order</Text>
        <View style={styles.sideRow}>
          {(["buy", "sell"] as LimitOrderSide[]).map((item) => (
            <Pressable
              key={item}
              style={[styles.sideChip, side === item && styles.sideChipActive]}
              onPress={() => setSide(item)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.sideChipText,
                  side === item && styles.sideChipTextActive,
                ]}
              >
                {item === "buy" ? "Limit buy" : "Limit sell"}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={mint}
          onChangeText={setMint}
          placeholder="Token mint"
          placeholderTextColor={colors.dim}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {side === "sell" ? (
          <TextInput
            style={styles.input}
            value={percent}
            onChangeText={setPercent}
            placeholder="Sell percent (1-100)"
            placeholderTextColor={colors.dim}
            keyboardType="decimal-pad"
          />
        ) : (
          <TextInput
            style={styles.input}
            value={amountSol}
            onChangeText={setAmountSol}
            placeholder="Buy size in SOL"
            placeholderTextColor={colors.dim}
            keyboardType="decimal-pad"
          />
        )}
        <View style={styles.triggerRow}>
          <Pressable
            style={[
              styles.triggerChip,
              triggerType === "mcap" && styles.triggerChipActive,
            ]}
            onPress={() => setTriggerType("mcap")}
          >
            <Text
              style={[
                styles.triggerChipText,
                triggerType === "mcap" && styles.triggerChipTextActive,
              ]}
            >
              Mcap
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.triggerChip,
              triggerType === "price" && styles.triggerChipActive,
            ]}
            onPress={() => setTriggerType("price")}
          >
            <Text
              style={[
                styles.triggerChipText,
                triggerType === "price" && styles.triggerChipTextActive,
              ]}
            >
              Price
            </Text>
          </Pressable>
          <TextInput
            style={[styles.input, styles.triggerInput]}
            value={triggerValue}
            onChangeText={setTriggerValue}
            placeholder={triggerType === "mcap" ? "100000" : "0.001"}
            placeholderTextColor={colors.dim}
            keyboardType="decimal-pad"
          />
        </View>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Pressable
          style={({ pressed }) => [
            styles.placeButton,
            pressed && styles.pressed,
            placing && styles.placeButtonDisabled,
          ]}
          onPress={() => void placeOrder()}
          disabled={placing}
          accessibilityRole="button"
        >
          <Text style={styles.placeButtonText}>
            {placing ? "Placing…" : "Arm limit order"}
          </Text>
        </Pressable>
        <Text style={styles.hint}>
          Chat examples:{" "}
          {side === "sell"
            ? `sell 25% when mcap hits ${formatCompact(Number(triggerValue) || 100000)} <mint>`
            : `buy 0.1 sol when mcap hits ${formatCompact(Number(triggerValue) || 100000)} <mint>`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.signal} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No {tab === "all" ? "" : `${tab} `}limit orders yet. Arm one above or
            ask the agent in chat.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((order) => (
            <View key={order.id} style={styles.cardWrap}>
              <OrderCard
                side={order.side}
                percent={order.percent}
                amountSol={order.amountSol}
                triggerType={order.triggerType}
                triggerValue={order.triggerValue}
                symbol={order.symbol}
                mint={order.mint}
                status={order.status}
                signature={order.signature}
                onCancel={
                  order.status === "pending"
                    ? () => void cancelLimitOrder(order.id).then(refresh)
                    : undefined
                }
              />
              {order.signature ? (
                <Pressable
                  onPress={() =>
                    void Linking.openURL(
                      `https://solscan.io/tx/${order.signature}`,
                    )
                  }
                >
                  <Text style={styles.solscan}>View on Solscan ↗</Text>
                </Pressable>
              ) : null}
              {order.error ? (
                <Text style={styles.error}>{order.error}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    paddingHorizontal: 16,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  tabActive: {
    backgroundColor: colors.grid,
    borderColor: colors.signal,
  },
  tabText: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.frost,
  },
  formCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  formTitle: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 16,
  },
  sideRow: {
    flexDirection: "row",
    gap: 8,
  },
  sideChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  sideChipActive: {
    borderColor: colors.signal,
    backgroundColor: "rgba(126, 182, 255, 0.1)",
  },
  sideChipText: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  sideChipTextActive: {
    color: colors.frost,
  },
  input: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingHorizontal: 12,
  },
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  triggerChip: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  triggerChipActive: {
    borderColor: colors.signal,
    backgroundColor: "rgba(126, 182, 255, 0.1)",
  },
  triggerChipText: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  triggerChipTextActive: {
    color: colors.frost,
  },
  triggerInput: {
    flex: 1,
  },
  formError: {
    color: colors.danger,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  placeButton: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.signal,
  },
  placeButtonDisabled: {
    opacity: 0.6,
  },
  placeButtonText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  hint: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 80,
  },
  emptyText: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  list: {
    gap: 14,
    paddingBottom: 40,
  },
  cardWrap: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 8,
  },
  solscan: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
  },
});
