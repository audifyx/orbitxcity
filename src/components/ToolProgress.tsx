import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import type { ToolEvent, ToolEventStatus } from "./types";

export type ToolProgressProps = {
  events: ToolEvent[];
};

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

function prettyLabel(label: string): string {
  return label
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function ToolProgress({ events }: ToolProgressProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>LIVE TOOLS</Text>
      <View style={styles.chips}>
        {events.map((event) => (
          <View key={event.id} style={styles.chip}>
            {event.status === "running" ? (
              <ActivityIndicator color={colors.signal} size="small" />
            ) : (
              <View style={[styles.dot, { backgroundColor: statusColor(event.status) }]} />
            )}
            <Text style={styles.label} numberOfLines={1}>
              {prettyLabel(event.label)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: "stretch",
    width: "100%",
    minWidth: "100%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: "rgba(8, 10, 16, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  title: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
    maxWidth: "100%",
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flexShrink: 1,
  },
});
