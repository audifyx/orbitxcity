import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export function InAppSignIn() {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>
        OrbitX sign-in runs in the Expo Go app. Open this project in Expo Go and
        use email or phone there. It does not log you into a website.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  text: {
    color: colors.ice,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
