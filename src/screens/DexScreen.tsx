import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { ORBITX_TOKEN_MINT } from "../brain/knowledge";
import { useAuth } from "../lib/auth";
import { executeDexSwap, quoteDexSwap, type TradeSide } from "../lib/dexTrade";
import {
  formatBuySol,
  formatSwapError,
  solAmountForUsd,
  suggestBuySol,
} from "../lib/swapGuard";
import { colors } from "../theme";

export function DexScreen() {
  const insets = useSafeAreaInsets();
  const { wallet } = useAuth();
  const [mint, setMint] = useState(ORBITX_TOKEN_MINT);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadDefault = wallet
      ? suggestBuySol(wallet)
      : solAmountForUsd();
    void loadDefault
      .then((sol) => {
        if (!cancelled) {
          setAmount((current) =>
            current === "" || current === "0.05" ? formatBuySol(sol) : current,
          );
        }
      })
      .catch(() => {
        // Keep empty until they type an amount.
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);
  const [side, setSide] = useState<TradeSide>("buy");
  const [busy, setBusy] = useState(false);
  const [desk, setDesk] = useState<"native" | "og">("native");
  const [status, setStatus] = useState<string | null>(null);

  async function run(nextSide: TradeSide) {
    if (!wallet) {
      setStatus("Sign in to trade.");
      return;
    }
    const tradeAmount = Number(amount);
    if (!Number.isFinite(tradeAmount) || tradeAmount <= 0) {
      setStatus(nextSide === "sell" ? "Enter a token amount." : "Enter a SOL amount.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const quote = await quoteDexSwap({
        side: nextSide,
        mint: mint.trim(),
        amount: tradeAmount,
      });
      setStatus(
        `Quote ready · in ${quote.inAmount} → out ${quote.outAmount}. Signing…`,
      );
      const result = await executeDexSwap({
        wallet,
        side: nextSide,
        mint: mint.trim(),
        amount: tradeAmount,
      });
      setStatus(`${result.route} ${nextSide} · ${result.signature}`);
    } catch (error) {
      setStatus(formatSwapError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.switchRow}>
        <Pressable
          style={[styles.switchChip, desk === "native" && styles.switchLive]}
          onPress={() => setDesk("native")}
        >
          <Text style={styles.switchText}>OrbitX DEX</Text>
        </Pressable>
        <Pressable
          style={[styles.switchChip, desk === "og" && styles.switchLive]}
          onPress={() => setDesk("og")}
        >
          <Text style={styles.switchText}>OG Scan desk</Text>
        </Pressable>
      </View>

      {desk === "og" ? (
        <WebView
          source={{ uri: "https://ogscan.fun/og-scan" }}
          style={styles.web}
          startInLoadingState
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>LIVE DESK</Text>
          <Text style={styles.title}>Trade</Text>
          <Text style={styles.subtitle}>
            Jupiter first. If the pair is still on the pump.fun curve, OrbitX
            falls back to the pump launch API. Instant buy uses the same wallet
            approve already on this phone.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Mint"
            placeholderTextColor={colors.mute}
            value={mint}
            onChangeText={setMint}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder={side === "sell" ? "Token amount" : "SOL amount"}
            placeholderTextColor={colors.mute}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <View style={styles.row}>
            <Pressable
              style={[styles.side, side === "buy" && styles.sideLive]}
              onPress={() => setSide("buy")}
            >
              <Text style={styles.sideText}>Buy</Text>
            </Pressable>
            <Pressable
              style={[styles.side, side === "sell" && styles.sideLive]}
              onPress={() => setSide("sell")}
            >
              <Text style={styles.sideText}>Sell</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.btn}
            disabled={busy}
            onPress={() => void run(side)}
          >
            <Text style={styles.btnText}>
              {busy ? "Signing…" : `Approve & ${side}`}
            </Text>
          </Pressable>
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
  switchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  switchChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchLive: {
    borderColor: colors.signal,
    backgroundColor: "rgba(126, 182, 255, 0.12)",
  },
  switchText: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  web: { flex: 1, backgroundColor: colors.void, marginTop: 8 },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
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
  row: { flexDirection: "row", gap: 8 },
  side: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 12,
    alignItems: "center",
  },
  sideLive: {
    borderColor: colors.signal,
    backgroundColor: "rgba(126, 182, 255, 0.12)",
  },
  sideText: { color: colors.frost, fontFamily: "Inter_500Medium" },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  status: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
});
