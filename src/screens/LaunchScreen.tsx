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

import { useAuth } from "../lib/auth";
import { formatBuySol, solAmountForUsd, suggestBuySol } from "../lib/swapGuard";
import { createPumpToken } from "../lib/pumpfun";
import { supabase } from "../lib/supabase";
import { colors } from "../theme";

export function LaunchScreen() {
  const insets = useSafeAreaInsets();
  const { userId, wallet } = useAuth();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [buySol, setBuySol] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadDefault = wallet
      ? suggestBuySol(wallet)
      : solAmountForUsd();
    void loadDefault
      .then((sol) => {
        if (!cancelled) {
          setBuySol((current) =>
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
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function launch() {
    if (!wallet) {
      setResult("Sign in first. Launch signs with your OrbitX wallet.");
      return;
    }
    if (!name.trim() || !symbol.trim()) {
      setResult("Name and ticker are required.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const created = await createPumpToken({
        wallet,
        name,
        symbol,
        description,
        initialBuySol: Number(buySol) || 0,
      });
      if (userId) {
        await supabase.from("orbitx_ai_transaction_intents").insert({
          user_id: userId,
          kind: "launch",
          status: "confirmed",
          quote: {
            name: name.trim(),
            symbol: symbol.trim().toUpperCase(),
            mint: created.mint,
            signature: created.signature,
            wallet,
          },
        });
      }
      setResult(`Launched ${symbol.toUpperCase()} · ${created.mint}\n${created.signature}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Launch failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>PUMP.FUN</Text>
        <Text style={styles.title}>Launch</Text>
        <Text style={styles.subtitle}>
          Creates the coin on pump.fun, then your OrbitX wallet signs the create
          transaction. First buy is optional and happens in the same approve.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Token name"
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
          placeholder="Initial buy in SOL"
          placeholderTextColor={colors.mute}
          value={buySol}
          onChangeText={setBuySol}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[styles.input, styles.area]}
          placeholder="Description"
          placeholderTextColor={colors.mute}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Pressable style={styles.btn} onPress={() => void launch()} disabled={busy}>
          <Text style={styles.btnText}>
            {busy ? "Signing launch…" : "Approve & launch"}
          </Text>
        </Pressable>
        {result ? <Text style={styles.result}>{result}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
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
    marginBottom: 8,
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
  area: { minHeight: 90, textAlignVertical: "top" },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  result: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
});
