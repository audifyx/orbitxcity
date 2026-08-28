import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { OrbitXMark } from "./OrbitXMark";
import { colors } from "../theme";

export type NavRoute =
  | "home"
  | "trending"
  | "wallet"
  | "tools"
  | "agents"
  | "activity"
  | "alerts"
  | "launch"
  | "nft"
  | "paper"
  | "research"
  | "strategy"
  | "social"
  | "profile"
  | "settings";

type Conversation = {
  id: string;
  title: string;
};

type NavItem = {
  route: NavRoute;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { route: "home", label: "Home" },
  { route: "trending", label: "Trending" },
  { route: "wallet", label: "Wallet" },
  { route: "tools", label: "Tools" },
  { route: "agents", label: "Agents" },
  { route: "activity", label: "Activity" },
  { route: "alerts", label: "Alerts" },
  { route: "launch", label: "Launch" },
  { route: "nft", label: "NFT" },
  { route: "paper", label: "Paper" },
  { route: "research", label: "Research" },
  { route: "strategy", label: "Strategy" },
  { route: "social", label: "Social" },
  { route: "profile", label: "Profile" },
  { route: "settings", label: "Settings" },
];

export type SidebarProps = {
  conversations?: Conversation[];
  activeId?: string;
  onNew?: () => void;
  onSelect?: (id: string) => void;
  onNavigate: (route: NavRoute) => void;
  onSearch?: () => void;
  activeRoute?: NavRoute;
  currentPath?: string;
  onClose?: () => void;
};

function routeFromPath(path?: string): NavRoute {
  if (!path) {
    return "home";
  }
  if (path.includes("trending")) return "trending";
  if (path.includes("wallet")) return "wallet";
  if (path.includes("tools")) return "tools";
  if (path.includes("agents")) return "agents";
  if (path.includes("activity")) return "activity";
  if (path.includes("launch")) return "launch";
  if (path.includes("nft")) return "nft";
  if (path.includes("paper")) return "paper";
  if (path.includes("research")) return "research";
  if (path.includes("strategy")) return "strategy";
  if (path.includes("social")) return "social";
  if (path.includes("profile")) return "profile";
  if (path.includes("settings")) return "settings";
  return "home";
}

export function Sidebar({
  conversations = [],
  activeId,
  onNew,
  onSelect,
  onNavigate,
  onSearch,
  activeRoute,
  currentPath,
  onClose,
}: SidebarProps) {
  const resolvedRoute = activeRoute ?? routeFromPath(currentPath);
  return (
    <View style={styles.root}>
      <View style={styles.brandRow}>
        <OrbitXMark size={22} />
        <Text style={styles.brandName}>ORBITX</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        onPress={() => {
          onNew?.();
          onClose?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="New conversation"
      >
        <Text style={styles.primaryBtnIcon}>+</Text>
        <Text style={styles.primaryBtnLabel}>New Conversation</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
        onPress={() => {
          onSearch?.();
          onClose?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Search conversations"
      >
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={styles.searchLabel}>Search</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>RECENT</Text>
      <ScrollView
        style={styles.conversationList}
        contentContainerStyle={styles.conversationContent}
        showsVerticalScrollIndicator={false}
      >
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeId;
          return (
            <Pressable
              key={conversation.id}
              style={({ pressed }) => [
                styles.conversationItem,
                isActive && styles.conversationItemActive,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                onSelect?.(conversation.id);
                onClose?.();
              }}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.conversationTitle,
                  isActive && styles.conversationTitleActive,
                ]}
                numberOfLines={1}
              >
                {conversation.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.divider} />

      <ScrollView
        style={styles.navList}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.route === resolvedRoute;
          return (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                styles.navItem,
                isActive && styles.navItemActive,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                onNavigate(item.route);
                onClose?.();
              }}
              accessibilityRole="button"
            >
              <Text
                style={[styles.navLabel, isActive && styles.navLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 260,
    flex: 1,
    backgroundColor: colors.ink,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  brandName: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 12,
    letterSpacing: 3.6,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.glass,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  primaryBtnIcon: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    lineHeight: 18,
  },
  primaryBtnLabel: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  searchIcon: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  searchLabel: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  sectionLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  conversationList: {
    flex: 1,
    maxHeight: 220,
  },
  conversationContent: {
    gap: 2,
    paddingBottom: 8,
  },
  conversationItem: {
    minHeight: 34,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  conversationItemActive: {
    backgroundColor: colors.grid,
  },
  conversationTitle: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  conversationTitleActive: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: 10,
  },
  navList: {
    flexShrink: 0,
  },
  navContent: {
    gap: 2,
  },
  navItem: {
    minHeight: 32,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  navItemActive: {
    backgroundColor: colors.grid,
  },
  navLabel: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  navLabelActive: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
  },
  pressed: {
    opacity: 0.72,
  },
});
