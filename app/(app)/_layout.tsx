import { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { Sidebar, type NavRoute } from "../../src/components";
import { useUnlockedSession } from "../../src/lib/sessionGate";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

const DESKTOP_BREAKPOINT = 900;

const ROUTE_MAP: Record<NavRoute, string> = {
  home: "/",
  trending: "/trending",
  wallet: "/wallet",
  tools: "/tools",
  agents: "/agents",
  activity: "/activity",
  alerts: "/alerts",
  launch: "/launch",
  nft: "/nft",
  paper: "/paper",
  research: "/research",
  strategy: "/strategy",
  social: "/social",
  profile: "/profile",
  settings: "/settings",
};

function MobileHeader({ onMenuPress }: { onMenuPress: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.mobileHeader, { paddingTop: Math.max(insets.top, 12) }]}>
      <Pressable
        onPress={onMenuPress}
        style={styles.menuButton}
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
      >
        <View style={styles.menuBar} />
        <View style={styles.menuBar} />
        <View style={styles.menuBar} />
      </Pressable>
      <Text style={styles.mobileTitle}>ORBITX</Text>
      <View style={styles.menuSpacer} />
    </View>
  );
}

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unlocked, waiting } = useUnlockedSession();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<
    { id: string; title: string }[]
  >([]);

  useEffect(() => {
    if (!waiting && !unlocked) {
      router.replace("/connect");
    }
  }, [waiting, router, unlocked]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("id, title")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(24);
      if (!cancelled && data) {
        setConversations(
          data.map((row) => ({
            id: String(row.id),
            title: String(row.title ?? "Conversation"),
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleNavigate = useCallback(
    (route: NavRoute) => {
      router.push(ROUTE_MAP[route] as "/");
      setDrawerOpen(false);
    },
    [router],
  );

  const sidebar = (
    <Sidebar
      conversations={conversations}
      currentPath={pathname}
      onNavigate={handleNavigate}
      onNew={() => router.push("/")}
      onSelect={(id) => router.push(`/conversation/${id}`)}
      onSearch={() => router.push("/")}
      onClose={() => setDrawerOpen(false)}
    />
  );

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.abyss },
        animation: Platform.OS === "web" ? "fade" : "default",
      }}
    />
  );

  if (waiting || !unlocked) {
    return <View style={styles.root} />;
  }

  if (isDesktop) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.desktopRow}>
          {sidebar}
          <View style={styles.desktopMain}>{stack}</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["left", "right"]}>
      <MobileHeader onMenuPress={() => setDrawerOpen(true)} />
      <View style={styles.mobileMain}>{stack}</View>

      {drawerOpen ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable
            style={styles.overlay}
            onPress={() => setDrawerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
          />
          <View
            style={[
              styles.drawer,
              { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
          >
            {sidebar}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
  },
  desktopRow: {
    flex: 1,
    flexDirection: "row",
  },
  desktopMain: {
    flex: 1,
  },
  mobileMain: {
    flex: 1,
  },
  mobileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.void,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  menuBar: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.frost,
  },
  menuSpacer: {
    width: 40,
  },
  mobileTitle: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 14,
    letterSpacing: 3.6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: colors.ink,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.hairline,
  },
});
