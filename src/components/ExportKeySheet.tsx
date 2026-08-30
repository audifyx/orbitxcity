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
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent, WebViewNavigation } from "react-native-webview";

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

function isAllowedExportNavigation(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return (
      host === "orbitxcity.vercel.app" ||
      host === "ogscan.fun" ||
      host === "www.ogscan.fun" ||
      host.endsWith(".privy.io") ||
      host.endsWith(".privy.com") ||
      host === "auth.privy.io"
    );
  } catch {
    return false;
  }
}

export function ExportKeySheet({
  visible,
  address,
  onClose,
  onResult,
}: ExportKeySheetProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const sourceUrl = useMemo(() => {
    try {
      return buildExportPageUrl(address);
    } catch {
      return "";
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
      const parsed = parseExportMessage(event.nativeEvent.data);
      if (!parsed) {
        return;
      }
      finish(parsed.status, parsed.error);
    },
    [finish],
  );

  const handleNav = useCallback((request: WebViewNavigation) => {
    if (!request.url) {
      return true;
    }
    if (request.url.startsWith("about:")) {
      return true;
    }
    return isAllowedExportNavigation(request.url);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>PRIVY EXPORT</Text>
            <Text style={styles.title}>Secret key</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close export"
          >
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Privy shows your key in its own window. OrbitX never receives it.
          Confirm the same email or phone you used to sign in.
        </Text>

        {pageError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{pageError}</Text>
          </View>
        ) : null}

        <View style={styles.webWrap}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.signal} />
            </View>
          ) : null}
          {sourceUrl ? (
            <WebView
              source={{ uri: sourceUrl }}
              onMessage={handleMessage}
              onLoadStart={() => {
                setLoading(true);
                setPageError(null);
              }}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setPageError(
                  "Could not open Privy export. Check your connection and try again.",
                );
              }}
              onShouldStartLoadWithRequest={handleNav}
              originWhitelist={["https://*"]}
              incognito
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled={false}
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              style={styles.webview}
            />
          ) : (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                This wallet address cannot be exported.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.8,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 20,
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
  hint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  webWrap: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.void,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
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
    lineHeight: 18,
  },
});
