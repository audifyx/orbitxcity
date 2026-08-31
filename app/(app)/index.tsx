import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { HomeSnapshotBar } from "../../src/components";
import { ChatThread } from "../../src/screens/ChatThread";
import { colors } from "../../src/theme";

export default function HomeScreen() {
  const params = useLocalSearchParams<{ context?: string }>();
  const initialContext =
    typeof params.context === "string" ? params.context : undefined;

  return (
    <View style={styles.root}>
      <HomeSnapshotBar />
      <ChatThread initialContext={initialContext} page="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
});
