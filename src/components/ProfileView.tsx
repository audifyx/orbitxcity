import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../theme";

export type ProfileQuickLink = {
  id: string;
  label: string;
  hint?: string;
};

export type ProfileViewProps = {
  displayName: string;
  handle?: string;
  address?: string | null;
  memberSince?: string;
  network?: string;
  loading?: boolean;
  error?: string | null;
  copied?: boolean;
  quickLinks?: ProfileQuickLink[];
  onCopyAddress?: () => void;
  onOpenExplorer?: () => void;
  onQuickLink?: (id: string) => void;
};

function truncateAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "O";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ProfileView({
  displayName,
  handle,
  address,
  memberSince,
  network = "Solana Mainnet",
  loading = false,
  error = null,
  copied = false,
  quickLinks = [],
  onCopyAddress,
  onOpenExplorer,
  onQuickLink,
}: ProfileViewProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity header */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.signal} style={styles.heroLoader} />
        ) : (
          <>
            <Text style={styles.name}>{displayName}</Text>
            {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
          </>
        )}
        <View style={styles.networkChip}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>{network}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Wallet */}
      <Text style={styles.sectionLabel}>WALLET ADDRESS</Text>
      <View style={styles.card}>
        {address ? (
          <>
            <Text style={styles.address} selectable>
              {address}
            </Text>
            <View style={styles.walletActions}>
              <Pressable
                style={styles.walletAction}
                onPress={onCopyAddress}
                accessibilityRole="button"
                accessibilityLabel="Copy address"
              >
                <Text style={styles.walletActionText}>
                  {copied ? "Copied" : `Copy ${truncateAddress(address)}`}
                </Text>
              </Pressable>
              {onOpenExplorer ? (
                <Pressable
                  style={styles.walletAction}
                  onPress={onOpenExplorer}
                  accessibilityRole="button"
                  accessibilityLabel="View on Solscan"
                >
                  <Text style={styles.walletActionText}>Solscan ↗</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={styles.muted}>No wallet connected.</Text>
        )}
      </View>

      {/* Meta */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.metaKey}>Member since</Text>
          <Text style={styles.metaValue}>{memberSince ?? "—"}</Text>
        </View>
        <View style={[styles.metaRow, styles.metaRowLast]}>
          <Text style={styles.metaKey}>Wallet type</Text>
          <Text style={styles.metaValue}>OrbitX embedded (Privy)</Text>
        </View>
      </View>

      {/* Quick links */}
      {quickLinks.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>QUICK LINKS</Text>
          <View style={styles.card}>
            {quickLinks.map((link, index) => (
              <Pressable
                key={link.id}
                style={[
                  styles.linkRow,
                  index === quickLinks.length - 1 && styles.linkRowLast,
                ]}
                onPress={() => onQuickLink?.(link.id)}
                accessibilityRole="button"
              >
                <View style={styles.linkText}>
                  <Text style={styles.linkLabel}>{link.label}</Text>
                  {link.hint ? (
                    <Text style={styles.linkHint}>{link.hint}</Text>
                  ) : null}
                </View>
                <Text style={styles.linkChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  content: {
    padding: 20,
    gap: 10,
    paddingBottom: 40,
  },
  hero: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(126, 182, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(126, 182, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.ice,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 30,
  },
  heroLoader: {
    marginVertical: 12,
  },
  name: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    marginTop: 4,
  },
  handle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  networkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  networkText: {
    color: colors.mist,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  sectionLabel: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    gap: 10,
  },
  address: {
    color: colors.ice,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  walletActions: {
    flexDirection: "row",
    gap: 8,
  },
  walletAction: {
    backgroundColor: "rgba(126, 182, 255, 0.14)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  walletActionText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  muted: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  metaRowLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  metaKey: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  metaValue: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkText: {
    gap: 2,
    flex: 1,
  },
  linkLabel: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  linkHint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  linkChevron: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 22,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 120, 90, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 150, 120, 0.25)",
  },
  errorText: {
    color: "#FFB899",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});
