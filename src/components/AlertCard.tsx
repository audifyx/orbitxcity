import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type AlertCardProps = {
  condition: string;
  status: string;
  createdAt?: string;
};

export function AlertCard({ condition, status, createdAt }: AlertCardProps) {
  const active = status.toLowerCase() === "active" || status.toLowerCase() === "enabled";

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={[styles.dot, active ? styles.dotOn : styles.dotOff]} />
        <Text style={styles.status}>{status}</Text>
        {createdAt ? (
          <Text style={styles.time}>{new Date(createdAt).toLocaleString()}</Text>
        ) : null}
      </View>
      <Text style={styles.condition}>{condition}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOn: {
    backgroundColor: colors.success,
  },
  dotOff: {
    backgroundColor: colors.mute,
  },
  status: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  time: {
    marginLeft: "auto",
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  condition: {
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
});
