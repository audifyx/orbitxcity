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

export function StrategyScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [name, setName] = useState("Mean reversion desk");
  const [rules, setRules] = useState(
    "If 15m RSI < 30 and volume > 2x average, paper-buy. Never auto-execute live.",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (!userId) {
      setMessage("Connect Phantom first.");
      return;
    }
    const { error } = await supabase.from("orbitx_ai_memory").insert({
      user_id: userId,
      kind: "strategy",
      content: `${name.trim() || "untitled"}\n${rules}\nauto_execute=false`,
      enabled: true,
    });
    setMessage(
      error
        ? error.message
        : "Strategy saved to orbitx_ai_memory. Auto-execute stays off.",
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Strategy</Text>
        <Text style={styles.subtitle}>
          Store rules. Live orders still require explicit wallet confirm.
        </Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Strategy name"
          placeholderTextColor={colors.mute}
        />
        <TextInput
          style={[styles.input, styles.area]}
          value={rules}
          onChangeText={setRules}
          multiline
          placeholder="Rules"
          placeholderTextColor={colors.mute}
        />
        <View style={styles.flag}>
          <Text style={styles.flagText}>auto_execute = false</Text>
        </View>
        <Pressable style={styles.btn} onPress={() => void save()}>
          <Text style={styles.btnText}>Save strategy</Text>
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
  area: { minHeight: 140, textAlignVertical: "top" },
  flag: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
  },
  flagText: { color: colors.mist, fontFamily: "Inter_400Regular", fontSize: 12 },
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
