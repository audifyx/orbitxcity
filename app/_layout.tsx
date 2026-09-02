import { Buffer } from "buffer";
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { usePrivy } from "@privy-io/expo";
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
import { OrbitxPrivyProvider } from "../src/lib/privyProvider";
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

function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { isReady, user, getAccessToken } = usePrivy();
  const authenticated = isReady && Boolean(user);
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const [privyTokenState, setPrivyTokenState] = useState<"unknown" | "checking" | "present" | "missing">("unknown");

  useEffect(() => {
    let active = true;
    if (!isReady) {
      setPrivyTokenState("unknown");
      return () => {
        active = false;
      };
    }
    if (!authenticated) {
      setPrivyTokenState("missing");
      console.debug("[OrbitX auth] Privy ready state", {
        ready: isReady,
        authenticated,
        user: Boolean(user),
        route: pathname,
        accessToken: false,
      });
      return () => {
        active = false;
      };
    }

    setPrivyTokenState("checking");
    void getAccessToken()
      .then((token) => {
        if (!active) return;
        const hasToken = typeof token === "string" && token.length > 0;
        setPrivyTokenState(hasToken ? "present" : "missing");
        console.debug("[OrbitX auth] Privy ready state", {
          ready: isReady,
          authenticated,
          user: Boolean(user),
          route: pathname,
          accessToken: hasToken,
        });
      })
      .catch((error) => {
        if (!active) return;
        setPrivyTokenState("missing");
        console.warn("[OrbitX auth] Privy access-token refresh failed", {
          ready: isReady,
          authenticated,
          user: Boolean(user),
          route: pathname,
          accessToken: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      active = false;
    };
  }, [authenticated, getAccessToken, isReady, pathname, user]);

  useEffect(() => {
    const root = segments[0];
    const isAuthGroup = root === "(auth)";
    const isCallback =
      root === "onconnect" ||
      root === "onsign" ||
      root === "auth" ||
      root === "content-demo";
    const privyAuthenticated = isReady && authenticated && Boolean(user);
    const initializing = !isReady || loading || (authenticated && privyTokenState === "checking");

    console.debug("[OrbitX auth] route decision", {
      ready: isReady,
      authenticated,
      user: Boolean(user),
      route: pathname,
      accessToken: privyTokenState === "present",
      supabaseSession: Boolean(session),
      loading,
      initializing,
    });

    // Never redirect while Privy or Supabase is hydrating. A valid Privy session
    // is also a recovery state: InAppSignIn can restore the OrbitX session.
    if (initializing) {
      return;
    }

    if (session && (isAuthGroup || pathname === "/connect" || pathname === "/auth")) {
      router.replace("/");
      return;
    }

    if (privyAuthenticated) {
      return;
    }

    if (!session && !isAuthGroup && !isCallback) {
      router.replace("/connect");
    }
  }, [authenticated, isReady, loading, pathname, privyTokenState, router, segments, session, user]);

  return <>{children}</>;
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
                  <Stack.Screen name="content-demo" />
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
