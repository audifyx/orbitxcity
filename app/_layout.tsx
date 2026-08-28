import { Buffer } from "buffer";
import { useEffect, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as NativeSplash from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { SplashScreen } from "../src/screens/SplashScreen";
import { colors } from "../src/theme";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

NativeSplash.preventAutoHideAsync().catch(() => undefined);
SystemUI.setBackgroundColorAsync(colors.void).catch(() => undefined);

if (Platform.OS === "web" && typeof document !== "undefined") {
  document.documentElement.style.backgroundColor = colors.void;
  document.body.style.backgroundColor = colors.void;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    const root = segments[0];
    const isAuthGroup = root === "(auth)";
    const isCallback = root === "onconnect" || root === "onsign";

    if (!session && !isAuthGroup && !isCallback) {
      router.replace("/connect");
      return;
    }

    if (session && (isAuthGroup || pathname === "/connect")) {
      router.replace("/");
    }
  }, [loading, session, segments, pathname, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
  });
  const [bootReady, setBootReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }
    NativeSplash.hideAsync()
      .catch(() => undefined)
      .finally(() => setBootReady(true));
  }, [fontsLoaded]);

  if (!bootReady) {
    return <View style={styles.boot} />;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate>
            <View style={styles.flex}>
              <StatusBar style="light" hidden={showSplash} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.void },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="(app)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="onconnect" />
                <Stack.Screen name="onsign" />
              </Stack>
              {showSplash ? (
                <SplashScreen onComplete={() => setShowSplash(false)} />
              ) : null}
            </View>
          </AuthGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.void,
  },
  flex: {
    flex: 1,
    backgroundColor: colors.void,
  },
});
