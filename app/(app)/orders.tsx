import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OrderCard } from "../../src/components/OrderCard";
import { useAuth } from "../../src/lib/auth";
import {
  cancelLimitOrder,
  listLimitOrders,
  subscribeLimitOrders,
  type LimitOrder,
} from "../../src/lib/limitOrders";
import { colors } from "../../src/theme";

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { wallet } = useAuth();
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <Text style={styles.kicker}>LIMIT DESK</Text>
      <Text style={styles.title}>Pending & filled sells</Text>
      <Text style={styles.subtitle}>
        Orders sit here until price or mcap hits your target, then OrbitX sells
        automatically.
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.signal} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No limit orders yet. Try: sell 25% when mcap hits 100k &lt;mint&gt;
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {orders.map((order) => (
            <View key={order.id} style={styles.cardWrap}>
              <OrderCard
                percent={order.percent}
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
                    void Linking.openURL(`https://solscan.io/tx/${order.signature}`)
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
    marginBottom: 16,
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
});
