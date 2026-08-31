import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import { openExternalUrl } from "../lib/walletOpen";

export type DexChartProps = {
  /** Solana pair address from DexScreener (pair.pairAddress), not the token mint. */
  pairAddress: string;
  symbol?: string;
  height?: number;
};

function dexscreenerUrl(pairAddress: string, embed: boolean): string {
  const base = `https://dexscreener.com/solana/${pairAddress}`;
  if (!embed) return base;
  return `${base}?embed=1&theme=dark&trades=0&info=0`;
}

/**
 * Real DexScreener chart — not a custom-drawn chart. On web this renders
 * DexScreener's own embeddable iframe directly. React Native has no built-in
 * iframe/webview, and this project doesn't have react-native-webview
 * installed; adding a native dependency here isn't something this
 * environment can verify (native rebuild required), so native opens the
 * real chart externally instead of pretending to embed it.
 */
export function DexChart({ pairAddress, symbol, height = 360 }: DexChartProps) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.webFrame, { height }]}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe
          src={dexscreenerUrl(pairAddress, true)}
          style={{ width: "100%", height: "100%", border: "none" }}
          title={`${symbol ?? "Token"} chart`}
        />
      </View>
    );
  }

  return (
    <View style={[styles.nativeFallback, { height }]}>
      <Text style={styles.nativeTitle}>Live chart</Text>
      <Text style={styles.nativeBody}>
        Opens the real DexScreener chart for {symbol ?? "this token"} in your browser.
      </Text>
      <Pressable
        style={styles.nativeButton}
        onPress={() => void openExternalUrl(dexscreenerUrl(pairAddress, false))}
        accessibilityRole="button"
      >
        <Text style={styles.nativeButtonText}>Open chart</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  webFrame: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  nativeFallback: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  nativeTitle: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  nativeBody: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  nativeButton: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  nativeButtonText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
