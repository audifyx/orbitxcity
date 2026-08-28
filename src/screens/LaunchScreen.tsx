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

import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { colors } from "../theme";

export function LaunchScreen() {
  const insets = useSafeAreaInsets();
  const { userId, wallet } = useAuth();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function saveDraft() {
    if (!userId) {
      setResult("Connect Phantom first.");
      return;
    }
    if (!name.trim() || !symbol.trim()) {
      setResult("Name and ticker are required.");
      return;
    }
    setBusy(true);
    setResult(null);
    const { error } = await supabase.from("orbitx_ai_transaction_intents").insert({
      user_id: userId,
      kind: "launch",
      status: "preview",
      quote: {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        supply,
        description,
        wallet,
        note: "Draft only. A live launch still requires a signed launchpad transaction.",
      },
    });
    setBusy(false);
    setResult(
      error
        ? error.message
        : "Launch draft saved in Activity. Nothing was broadcast.",
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Launch</Text>
        <Text style={styles.subtitle}>
          Create a token draft. Live mint still requires a wallet signature.
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
          placeholder="Supply"
          placeholderTextColor={colors.mute}
          value={supply}
          onChangeText={setSupply}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.area]}
          placeholder="Description"
          placeholderTextColor={colors.mute}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Pressable
          style={styles.btn}
          onPress={() => void saveDraft()}
          disabled={busy}
        >
          <Text style={styles.btnText}>
            {busy ? "Saving…" : "Save launch draft"}
          </Text>
        </Pressable>
        {result ? <Text style={styles.result}>{result}</Text> : null}
        <Text style={styles.note}>
          Existing agent_token_launches requires a real agent UUID. Drafts live
          in orbitx_ai_transaction_intents until a signed launch tx exists.
        </Text>
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
    backgroundColor: colors.frost,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.void, fontFamily: "Inter_600SemiBold" },
  result: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
});
