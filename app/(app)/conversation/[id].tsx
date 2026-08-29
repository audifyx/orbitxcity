import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { ChatThread } from "../../../src/screens/ChatThread";
import { colors } from "../../../src/theme";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = typeof id === "string" ? id : undefined;

  return (
    <View style={styles.root}>
      <ChatThread conversationId={conversationId} page="conversation" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
});
