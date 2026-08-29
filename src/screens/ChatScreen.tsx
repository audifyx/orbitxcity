import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { colors } from "../theme";

function MiniMark() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Circle
        cx="14"
        cy="14"
        r="10"
        fill="none"
        stroke="#C9DEFF"
        strokeWidth="0.9"
        strokeOpacity="0.7"
      />
      <Line
        x1="8.4"
        y1="8.4"
        x2="19.6"
        y2="19.6"
        stroke="#F4F7FF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Line
        x1="19.6"
        y1="8.4"
        x2="8.4"
        y2="19.6"
        stroke="#F4F7FF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Circle cx="14" cy="14" r="1.6" fill="#FFFFFF" />
    </Svg>
  );
}

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
          <View style={styles.brand}>
            <MiniMark />
            <Text style={styles.brandName}>ORBITX</Text>
          </View>
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>ONLINE</Text>
          </View>
        </View>

        <View style={styles.thread}>
          <View style={styles.systemCard}>
            <Text style={styles.systemKicker}>SYSTEM</Text>
            <Text style={styles.systemCopy}>
              Intelligence layer online. Ask about any market, wallet, or
              protocol.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.composerWrap,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message OrbitX"
              placeholderTextColor="rgba(176, 198, 232, 0.38)"
              style={styles.input}
              selectionColor={colors.signal}
            />
            <Pressable style={styles.send} accessibilityRole="button">
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandName: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 15,
    letterSpacing: 4.2,
  },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7EE0C4",
  },
  liveLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.8,
  },
  thread: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 36,
  },
  systemCard: {
    maxWidth: 320,
    gap: 8,
  },
  systemKicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2.4,
  },
  systemCopy: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  composer: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.composer,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    paddingVertical: 14,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(126, 182, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    color: colors.ice,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    marginTop: -1,
  },
});
