import { Buffer } from "buffer";
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
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

import ConnectScreen from "./(auth)/connect";
import { AuthProvider } from "../src/lib/auth";
import { OrbitxPrivyProvider } from "../src/lib/privyProvider";
import { useUnlockedSession } from "../src/lib/sessionGate";
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

const FONT_BOOT_TIMEOUT_MS = 2500;

class BootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("OrbitX boot error", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.crash}>
          <Text style={styles.crashTitle}>OrbitX failed to start</Text>
          <Text style={styles.crashBody}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function LoginLock() {
  const { unlocked, waiting } = useUnlockedSession();
  if (unlocked) {
    return null;
  }
  return (
    <View style={styles.lock} pointerEvents="auto">
      {waiting ? <View style={styles.boot} /> : <ConnectScreen />}
    </View>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { unlocked, waiting } = useUnlockedSession();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (waiting) {
      return;
    }

    const root = segments[0];
    const isAuthGroup = root === "(auth)";
    const isCallback =
      root === "onconnect" ||
      root === "onsign" ||
      root === "auth" ||
      root === "x-callback";
    const isExport = root === "wallet-export" || pathname === "/wallet-export";
    const onLogin =
      isAuthGroup || pathname === "/connect" || pathname === "/auth";

    if (unlocked && onLogin) {
      router.replace("/");
      return;
    }

    if (!unlocked && !onLogin && !isCallback && !isExport) {
      router.replace("/connect");
    }
  }, [waiting, unlocked, segments, pathname, router]);

  return (
    <>
      {children}
      <LoginLock />
    </>
  );
}

function RootLayoutInner() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
  });
  const [bootReady, setBootReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const reveal = () => {
      if (cancelled) {
        return;
      }
      NativeSplash.hideAsync()
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) {
            setBootReady(true);
          }
        });
    };

    const timeout = setTimeout(reveal, FONT_BOOT_TIMEOUT_MS);
    if (fontsLoaded) {
      reveal();
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [fontsLoaded]);

  useEffect(() => {
    if (!bootReady || !showSplash) {
      return;
    }
    const timeout = setTimeout(() => setShowSplash(false), 4000);
    return () => clearTimeout(timeout);
  }, [bootReady, showSplash]);

  if (!bootReady) {
    return <View style={styles.boot} />;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <OrbitxPrivyProvider>
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
                  <Stack.Screen name="auth" />
                  <Stack.Screen name="wallet-export" />
                  <Stack.Screen name="x-callback" />
                </Stack>
                {showSplash ? (
                  <SplashScreen onComplete={() => setShowSplash(false)} />
                ) : null}
              </View>
            </AuthGate>
          </OrbitxPrivyProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <BootErrorBoundary>
      <RootLayoutInner />
    </BootErrorBoundary>
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
  lock: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.void,
    zIndex: 50,
  },
  crash: {
    flex: 1,
    backgroundColor: colors.void,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  crashTitle: {
    color: colors.frost,
    fontSize: 18,
  },
  crashBody: {
    color: colors.mute,
    fontSize: 14,
    lineHeight: 20,
  },
});
