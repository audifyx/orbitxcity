import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { buildExportPageUrl, type ExportPageStatus } from "../lib/exportWallet";
import { colors } from "../theme";

export type ExportKeySheetProps = {
  visible: boolean;
  address: string;
  onClose: () => void;
  onResult: (status: ExportPageStatus, error?: string) => void;
};

export function ExportKeySheet({
  visible,
  address,
  onClose,
  onResult,
}: ExportKeySheetProps) {
  const sourceUrl = useMemo(() => {
    try {
      return buildExportPageUrl(address);
    } catch {
      return "";
    }
  }, [address]);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Export stays in Expo Go</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        <Text style={styles.body}>
          Secret-key export is handled by Privy inside the OrbitX app. Open
          Wallet in Expo Go and tap Export key. OrbitX never receives the key.
        </Text>
        {sourceUrl ? (
          <Pressable
            style={styles.secondary}
            onPress={() => onResult("closed")}
          >
            <Text style={styles.secondaryLabel}>Done</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    padding: 24,
    justifyContent: "center",
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 22,
    flex: 1,
  },
  closeBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  closeLabel: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  body: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
