import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type AgentCardProps = {
  name: string;
  description: string;
  status?: string;
  tier?: "core" | "specialist";
  onPress?: () => void;
};

export function AgentCard({
  name,
  description,
  status = "idle",
  tier = "core",
  onPress,
}: AgentCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.root, pressed && onPress ? styles.pressed : null]}
      accessibilityRole={onPress ? "button" : "none"}
    >
      <View style={styles.top}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {tier} · {status}
        </Text>
      </View>
      <Text style={styles.description} numberOfLines={3}>
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: 6,
  },
  pressed: {
    opacity: 0.85,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  name: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    flex: 1,
  },
  meta: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  description: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
});
