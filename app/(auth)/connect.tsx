import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { InAppSignIn } from "../../src/components/InAppSignIn";
import { useAuth } from "../../src/lib/auth";
import { colors } from "../../src/theme";

function OrbitMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Circle
        cx="28"
        cy="28"
        r="20"
        fill="none"
        stroke={colors.ring}
        strokeWidth="1.2"
      />
      <Line
        x1="16"
        y1="16"
        x2="40"
        y2="40"
        stroke={colors.frost}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <Line
        x1="40"
        y1="16"
        x2="16"
        y2="40"
        stroke={colors.frost}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <Circle cx="28" cy="28" r="3" fill={colors.core} />
    </Svg>
  );
}

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [router, session]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <OrbitMark />
        <Text style={styles.title}>Sign in to OrbitX</Text>
        <Text style={styles.subtitle}>
          Use your email or phone in this app. After login, connect Jupiter Wallet
          from the Wallet screen to view holdings and approve swaps.
        </Text>
        <InAppSignIn />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.void,
  },
  root: {
    flexGrow: 1,
    backgroundColor: colors.void,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 16,
    maxWidth: 360,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    letterSpacing: -0.4,
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
