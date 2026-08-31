import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as NativeSplash from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useFonts, Inter_400Regular, Inter_500Medium } from "@expo-google-fonts/inter";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ChatScreen } from "./src/screens/ChatScreen";
import { ContentDemoScreen } from "./src/screens/ContentDemoScreen";
import { SplashScreen } from "./src/screens/SplashScreen";
import { colors } from "./src/theme";

NativeSplash.preventAutoHideAsync().catch(() => undefined);
SystemUI.setBackgroundColorAsync(colors.void).catch(() => undefined);
if (Platform.OS === "web" && typeof document !== "undefined") {
  document.documentElement.style.backgroundColor = colors.void;
  document.body.style.backgroundColor = colors.void;
}
const contentDemoEnabled = process.env.EXPO_PUBLIC_CONTENT_DEMO === "true";

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, SpaceGrotesk_600SemiBold });
  const [bootReady, setBootReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    if (!fontsLoaded) return;
    NativeSplash.hideAsync().catch(() => undefined).finally(() => setBootReady(true));
  }, [fontsLoaded]);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);
  if (!bootReady) return <View style={styles.boot} />;
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" hidden={showSplash} />
        {contentDemoEnabled ? <ContentDemoScreen /> : <ChatScreen />}
        {showSplash ? <SplashScreen onComplete={handleSplashComplete} /> : null}
      </View>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({ boot: { flex: 1, backgroundColor: colors.void }, root: { flex: 1, backgroundColor: colors.void } });
