import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import type { ToolEvent, ToolEventStatus } from "./types";

export type ToolProgressProps = {
  events: ToolEvent[];
};

function statusWord(status: ToolEventStatus): string {
  switch (status) {
    case "ok":
      return "done";
    case "error":
      return "miss";
    case "running":
      return "…";
    default:
      return "";
  }
}

export function ToolProgress({ events }: ToolProgressProps) {
  if (events.length === 0) {
    return null;
  }

  const running = events.some((event) => event.status === "running");

  return (
    <View style={styles.root}>
      {running ? <ActivityIndicator color={colors.signal} size="small" /> : null}
      <Text style={styles.text} numberOfLines={2}>
        {events
          .map((event) => {
            const tail = statusWord(event.status);
            const label = event.label.replace(/[_-]+/g, " ").trim();
            return tail ? `${label} ${tail}` : label;
          })
          .join(" · ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    opacity: 0.9,
  },
  text: {
    flex: 1,
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
  },
});
