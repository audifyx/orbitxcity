import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { colors } from "../src/theme";

export default function WalletExportScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>PRIVY EXPORT</Text>
      <Text style={styles.title}>Export from Wallet</Text>
      <Text style={styles.body}>
        Secret-key export stays inside OrbitX. Open Wallet and tap Export key.
        Privy shows the encoded key. OrbitX never receives it.
      </Text>
      <Pressable style={styles.button} onPress={() => router.replace("/wallet")}>
        <Text style={styles.buttonText}>Open Wallet</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    padding: 28,
    justifyContent: "center",
    gap: 14,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
  },
  body: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
