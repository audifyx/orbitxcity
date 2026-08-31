import { Pressable, StyleSheet, Text, View } from "react-native";

import { AGENT_CAPABILITY_CHIPS } from "../brain/knowledge";
import { OrbitXMark } from "./OrbitXMark";
import { colors } from "../theme";

export type EmptyHomeProps = {
  suggestions?: string[];
  onSuggestionPress?: (suggestion: string) => void;
};

const DEFAULT_SUGGESTIONS = [...AGENT_CAPABILITY_CHIPS];

export function EmptyHome({
  suggestions = DEFAULT_SUGGESTIONS,
  onSuggestionPress,
}: EmptyHomeProps) {
  return (
    <View style={styles.root}>
      <View style={styles.halo} />
      <View style={styles.markWrap}>
        <OrbitXMark size={40} />
      </View>
      <Text style={styles.kicker}>ORBITX CORE</Text>
      <Text style={styles.headline}>Speak. I move the chain.</Text>
      <Text style={styles.subcopy}>
        Live Solana desk in your pocket. Scan a mint, launch on pump.fun, mint
        an NFT, or buy with the wallet already on this phone. I do not wait for
        a browser.
      </Text>
      <View style={styles.chips}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => onSuggestionPress?.(suggestion)}
            accessibilityRole="button"
          >
            <Text style={styles.chipText}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  halo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(90, 140, 255, 0.08)",
  },
  markWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(150, 196, 255, 0.28)",
    backgroundColor: "rgba(8, 12, 22, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 3.2,
  },
  headline: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 28,
    letterSpacing: -0.6,
    textAlign: "center",
    lineHeight: 34,
  },
  subcopy: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 360,
    marginBottom: 8,
  },
  chips: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(150, 196, 255, 0.22)",
    backgroundColor: "rgba(8, 12, 22, 0.86)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  chipPressed: {
    opacity: 0.74,
    backgroundColor: "rgba(126, 182, 255, 0.1)",
    borderColor: "rgba(126, 182, 255, 0.32)",
  },
  chipText: {
    color: colors.mist,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textAlign: "center",
  },
});
