import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import {
  buildExportPageUrl,
  parseExportMessage,
  type ExportPageStatus,
} from "../lib/exportWallet";
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
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);

  const exportUrl = useMemo(() => {
    try {
      return buildExportPageUrl(address);
    } catch (error) {
      return null;
    }
  }, [address]);

  const finish = useCallback(
    (status: ExportPageStatus, error?: string) => {
      onResult(status, error);
      onClose();
    },
    [onClose, onResult],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const result = parseExportMessage(event.nativeEvent.data);
      if (!result) {
        return;
      }
      finish(result.status, result.error);
    },
    [finish],
  );

  const handleClose = useCallback(() => {
    finish("closed");
  }, [finish]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>PRIVY · USER-CONTROLLED</Text>
            <Text style={styles.title}>Export secret key</Text>
            <Text style={styles.hint}>
              Confirm the same email or phone. OrbitX never sees your key.
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close export"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        {!exportUrl ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {webError ?? "Cannot export — wallet address is invalid."}
            </Text>
          </View>
        ) : (
          <View style={styles.webWrap}>
            {loading ? (
              <ActivityIndicator
                color={colors.signal}
                style={styles.loader}
              />
            ) : null}
            <WebView
              source={{ uri: exportUrl }}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setWebError("Could not load the Privy export page.");
              }}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              originWhitelist={["*"]}
              style={styles.webview}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 20,
  },
  hint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
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
  closeText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  webWrap: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  loader: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    zIndex: 2,
  },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: "#FF9A9A",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
