import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

const demoTokens = [
  { symbol: "NOVA", mc: "$18.42M", change: "+24.8%", risk: "LOW" },
  { symbol: "ORBIT", mc: "$42.77M", change: "+12.6%", risk: "LOW" },
  { symbol: "CLAW", mc: "$2.34M", change: "+67.9%", risk: "HIGH" },
  { symbol: "CITY", mc: "$9.82M", change: "+18.4%", risk: "MED" },
];

export function ContentDemoScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.demoBar}>
        <Text style={styles.demoKicker}>ORBITX CONTENT DEMO</Text>
        <Text style={styles.demoCopy}>Mock data • no wallet • no real auth • no network trades</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>INTELLIGENCE LAYER</Text>
        <Text style={styles.title}>Explore the market without connecting anything.</Text>
        <View style={styles.grid}>
          {demoTokens.map((token) => (
            <View key={token.symbol} style={styles.card}>
              <Text style={styles.symbol}>{token.symbol}</Text>
              <Text style={styles.mc}>{token.mc}</Text>
              <Text style={styles.meta}>{token.change} · {token.risk} RISK</Text>
            </View>
          ))}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelKicker}>AGENT TERMINAL</Text>
          <Text style={styles.prompt}>Scan NOVA and explain the risk.</Text>
          <Text style={styles.tool}>✓ OG SCAN</Text>
          <Text style={styles.tool}>✓ WALLET INTEL</Text>
          <Text style={styles.tool}>✓ JUPITER QUOTE PREVIEW</Text>
          <Text style={styles.note}>Simulation only. The model cannot authorize a transaction.</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelKicker}>DEMO ACCOUNT</Text>
          <Text style={styles.balance}>$25,000.00</Text>
          <Text style={styles.note}>orbitx-content-demo · fictional balance · no private key · no signature</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
  demoBar: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  demoKicker: { color: colors.signal, fontSize: 10, letterSpacing: 2.2, fontFamily: "Inter_500Medium" },
  demoCopy: { color: colors.mute, fontSize: 11, marginTop: 5, fontFamily: "Inter_400Regular" },
  content: { padding: 22, gap: 18 },
  eyebrow: { color: colors.signal, fontSize: 10, letterSpacing: 2.4, fontFamily: "Inter_500Medium" },
  title: { color: colors.frost, fontSize: 30, lineHeight: 36, fontFamily: "SpaceGrotesk_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { width: "48%", minHeight: 112, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.composer, borderRadius: 16, padding: 15 },
  symbol: { color: colors.frost, fontSize: 18, fontFamily: "SpaceGrotesk_600SemiBold" },
  mc: { color: colors.frost, fontSize: 22, marginTop: 10, fontFamily: "Inter_500Medium" },
  meta: { color: colors.mute, fontSize: 11, marginTop: 5, fontFamily: "Inter_400Regular" },
  panel: { borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.composer, borderRadius: 18, padding: 18, gap: 9 },
  panelKicker: { color: colors.signal, fontSize: 10, letterSpacing: 2.1, fontFamily: "Inter_500Medium" },
  prompt: { color: colors.frost, fontSize: 18, lineHeight: 25, fontFamily: "Inter_400Regular" },
  tool: { color: "#A8DCCB", fontSize: 13, fontFamily: "Inter_500Medium" },
  balance: { color: colors.frost, fontSize: 34, fontFamily: "SpaceGrotesk_600SemiBold" },
  note: { color: colors.mute, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
});
