import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { colors } from "../theme";

export type SettingsModelOption = {
  id: string;
  label: string;
  description?: string;
};

export type SettingsMemoryItem = {
  id: string;
  content: string;
  enabled: boolean;
};

export type SettingsPermissionOption = {
  id: string;
  label: string;
};

export type SettingsViewProps = {
  walletAddress?: string | null;
  network?: string;
  models: SettingsModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  memories: SettingsMemoryItem[];
  memoriesLoading?: boolean;
  onToggleMemory: (id: string) => void;
  onDeleteMemory: (id: string) => void;
  permissionOptions: SettingsPermissionOption[];
  permissionMode: string;
  onSelectPermission: (id: string) => void;
  pausing?: boolean;
  onPauseAll: () => void;
  onExportWallet: () => void;
  onOpenProfile: () => void;
  copied?: boolean;
  onCopyAddress?: () => void;
  error?: string | null;
  bottomInset?: number;
};

function truncateAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function SettingsView({
  walletAddress,
  network = "Solana Mainnet",
  models,
  selectedModelId,
  onSelectModel,
  memories,
  memoriesLoading = false,
  onToggleMemory,
  onDeleteMemory,
  permissionOptions,
  permissionMode,
  onSelectPermission,
  pausing = false,
  onPauseAll,
  onExportWallet,
  onOpenProfile,
  copied = false,
  onCopyAddress,
  error = null,
  bottomInset = 24,
}: SettingsViewProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Settings</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Account & wallet */}
      <Text style={styles.sectionLabel}>ACCOUNT &amp; WALLET</Text>
      <View style={styles.card}>
        <View style={styles.accountRow}>
          <View style={styles.accountText}>
            <Text style={styles.accountKey}>Network</Text>
            <Text style={styles.accountValue}>{network}</Text>
          </View>
          <View style={styles.networkDot} />
        </View>

        <View style={styles.rowDivider} />

        <View style={styles.accountRow}>
          <View style={styles.accountText}>
            <Text style={styles.accountKey}>Wallet</Text>
            <Text style={styles.accountValue} numberOfLines={1}>
              {walletAddress ? truncateAddress(walletAddress) : "Not connected"}
            </Text>
          </View>
          {walletAddress ? (
            <Pressable
              style={styles.miniButton}
              onPress={onCopyAddress}
              accessibilityRole="button"
              accessibilityLabel="Copy address"
            >
              <Text style={styles.miniButtonText}>
                {copied ? "Copied" : "Copy"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.rowDivider} />

        <Pressable
          style={styles.linkRow}
          onPress={onExportWallet}
          accessibilityRole="button"
          accessibilityLabel="Export wallet"
        >
          <View style={styles.accountText}>
            <Text style={styles.accountValue}>Export wallet</Text>
            <Text style={styles.accountHint}>
              Reveal your private key securely on ogscan.fun
            </Text>
          </View>
          <Text style={styles.linkChevron}>↗</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable
          style={styles.linkRow}
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <View style={styles.accountText}>
            <Text style={styles.accountValue}>Profile</Text>
            <Text style={styles.accountHint}>Your identity and quick links</Text>
          </View>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>
      </View>

      {/* Default model */}
      <Text style={styles.sectionLabel}>DEFAULT AI MODEL</Text>
      <View style={styles.card}>
        {models.map((model, index) => (
          <Pressable
            key={model.id}
            style={[
              styles.selectRow,
              index === models.length - 1 && styles.selectRowLast,
              selectedModelId === model.id && styles.selectRowActive,
            ]}
            onPress={() => onSelectModel(model.id)}
            accessibilityRole="button"
          >
            <View style={styles.selectText}>
              <Text style={styles.selectLabel}>{model.label}</Text>
              {model.description ? (
                <Text style={styles.selectHint} numberOfLines={1}>
                  {model.description}
                </Text>
              ) : null}
            </View>
            {selectedModelId === model.id ? (
              <Text style={styles.check}>✓</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      {/* Memory */}
      <Text style={styles.sectionLabel}>MEMORY</Text>
      <View style={styles.card}>
        {memoriesLoading ? (
          <ActivityIndicator color={colors.signal} style={styles.pad} />
        ) : memories.length === 0 ? (
          <Text style={styles.muted}>No saved memories.</Text>
        ) : (
          memories.map((memory, index) => (
            <View
              key={memory.id}
              style={[
                styles.memoryRow,
                index === memories.length - 1 && styles.memoryRowLast,
              ]}
            >
              <Text style={styles.memoryText} numberOfLines={3}>
                {memory.content}
              </Text>
              <View style={styles.memoryControls}>
                <Switch
                  value={memory.enabled}
                  onValueChange={() => onToggleMemory(memory.id)}
                  trackColor={{ false: colors.ink, true: colors.signal }}
                />
                <Pressable
                  onPress={() => onDeleteMemory(memory.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Permissions */}
      <Text style={styles.sectionLabel}>AGENT PERMISSIONS</Text>
      <View style={styles.card}>
        {permissionOptions.map((option, index) => (
          <Pressable
            key={option.id}
            style={[
              styles.selectRow,
              index === permissionOptions.length - 1 && styles.selectRowLast,
              permissionMode === option.id && styles.selectRowActive,
            ]}
            onPress={() => onSelectPermission(option.id)}
            accessibilityRole="button"
          >
            <Text style={styles.selectLabel}>{option.label}</Text>
            {permissionMode === option.id ? (
              <Text style={styles.check}>✓</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.pauseButton, pausing && styles.pauseDisabled]}
        onPress={onPauseAll}
        disabled={pausing}
        accessibilityRole="button"
      >
        {pausing ? (
          <ActivityIndicator color={colors.frost} />
        ) : (
          <Text style={styles.pauseText}>Pause all agents</Text>
        )}
      </Pressable>

      {/* Privacy */}
      <Text style={styles.sectionLabel}>PRIVACY</Text>
      <View style={styles.card}>
        <Text style={styles.privacyText}>
          Conversations are stored in your OrbitX account with RLS. Message
          contents are sent to the selected model provider to generate replies.
          Email and phone sign-in create an in-app wallet. Private keys never
          leave Privy&apos;s secure environment — OrbitX cannot see them.
        </Text>
      </View>
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
    gap: 8,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
    marginBottom: 4,
  },
  sectionLabel: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  accountText: {
    flex: 1,
    gap: 2,
  },
  accountKey: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  accountValue: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  accountHint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  miniButton: {
    backgroundColor: "rgba(126, 182, 255, 0.14)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  miniButtonText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  linkChevron: {
    color: colors.signal,
    fontFamily: "Inter_400Regular",
    fontSize: 20,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  selectRowLast: {
    borderBottomWidth: 0,
  },
  selectRowActive: {
    backgroundColor: "rgba(126, 182, 255, 0.1)",
  },
  selectText: {
    flex: 1,
    gap: 2,
  },
  selectLabel: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  selectHint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  check: {
    color: colors.signal,
    fontSize: 16,
  },
  memoryRow: {
    padding: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  memoryRowLast: {
    borderBottomWidth: 0,
  },
  memoryText: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  memoryControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteText: {
    color: "#FF8A8A",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  pad: {
    padding: 14,
  },
  muted: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 14,
  },
  pauseButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 100, 100, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 130, 130, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseDisabled: {
    opacity: 0.7,
  },
  pauseText: {
    color: "#FFAAAA",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  privacyText: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    padding: 16,
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
