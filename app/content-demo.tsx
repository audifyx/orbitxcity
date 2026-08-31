import { SafeAreaView, StyleSheet } from "react-native";

import { ContentDemoScreen } from "../src/screens/ContentDemoScreen";
import { colors } from "../src/theme";

/**
 * Public, login-less content-demo route (`/content-demo`).
 *
 * Uses the `orbitx-content-demo` identity: mock data only, no wallet, no auth
 * session, and no network trades. Safe for capturing marketing screenshots
 * without connecting anything. The normal production paths are unchanged.
 */
export default function ContentDemoRoute() {
  return (
    <SafeAreaView style={styles.root}>
      <ContentDemoScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
  },
});
