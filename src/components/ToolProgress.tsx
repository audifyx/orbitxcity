import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import type { ToolEvent, ToolEventStatus } from "./types";

export type ToolProgressProps = {
  events: ToolEvent[];
};

function statusIcon(status: ToolEventStatus): string {
  switch (status) {
    case "ok":
      return "✓";
    case "error":
      return "✕";
    case "running":
      return "◌";
    default:
      return "○";
  }
}

function statusColor(status: ToolEventStatus): string {
  switch (status) {
    case "ok":
      return colors.success;
    case "error":
      return colors.danger;
    case "running":
      return colors.signal;
    default:
      return colors.dim;
  }
}

export function ToolProgress({ events }: ToolProgressProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>TOOLS</Text>
      {events.map((event, index) => (
        <View key={event.id} style={styles.row}>
          <View style={styles.iconWrap}>
            <Text style={[styles.icon, { color: statusColor(event.status) }]}>
              {statusIcon(event.status)}
            </Text>
          </View>
          <View style={styles.content}>
            <Text
              style={[
                styles.label,
                event.status === "ok" && styles.labelDone,
                event.status === "error" && styles.labelError,
              ]}
            >
              {event.label}
            </Text>
            {index < events.length - 1 ? <View style={styles.connector} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  title: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.4,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 18,
    alignItems: "center",
    paddingTop: 1,
  },
  icon: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  label: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  labelDone: {
    color: colors.frost,
  },
  labelError: {
    color: colors.danger,
  },
  connector: {
    width: StyleSheet.hairlineWidth,
    height: 10,
    backgroundColor: colors.line,
    marginLeft: -19,
    marginTop: 2,
  },
});
