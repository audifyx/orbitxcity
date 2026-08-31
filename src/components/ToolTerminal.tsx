import { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../theme";
import type { ToolEvent, ToolEventStatus } from "./types";

export type ToolTerminalProps = {
  events: ToolEvent[];
  visible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

function statusGlyph(status: ToolEventStatus): string {
  switch (status) {
    case "ok":
      return "✓";
    case "error":
      return "✗";
    case "running":
      return "›";
    default:
      return "·";
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

function formatLabel(event: ToolEvent): string {
  if (event.toolId) {
    return event.toolId.replace(/-/g, " ");
  }
  return event.label.replace(/[_-]+/g, " ").trim();
}

export function ToolTerminal({
  events,
  visible = true,
  collapsed = false,
  onToggleCollapse,
}: ToolTerminalProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const running = events.some((event) => event.status === "running");
    if (!running) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [events, pulse]);

  if (!visible || events.length === 0) {
    return null;
  }

  const running = events.some((event) => event.status === "running");
  const done = events.filter((event) => event.status === "ok").length;
  const failed = events.filter((event) => event.status === "error").length;

  return (
    <View style={styles.shell}>
      <Pressable
        style={styles.header}
        onPress={onToggleCollapse}
        accessibilityRole="button"
        accessibilityLabel="Toggle tool activity panel"
      >
        <View style={styles.headerLeft}>
          <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
          <Text style={styles.headerTitle}>agent</Text>
          <Text style={styles.headerMeta}>
            {running
              ? "working…"
              : failed > 0
                ? `${done} ok · ${failed} miss`
                : `${done} tool${done === 1 ? "" : "s"}`}
          </Text>
        </View>
        <Text style={styles.chevron}>{collapsed ? "▾" : "▴"}</Text>
      </Pressable>

      {!collapsed ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {events.map((event) => (
            <View key={event.id} style={styles.row}>
              <Text style={[styles.glyph, { color: statusColor(event.status) }]}>
                {statusGlyph(event.status)}
              </Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {formatLabel(event)}
                </Text>
                {event.detail ? (
                  <Text style={styles.rowDetail} numberOfLines={1}>
                    {event.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const mono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126, 182, 255, 0.22)",
    backgroundColor: "rgba(2, 5, 12, 0.94)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(126, 182, 255, 0.12)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.signal,
  },
  headerTitle: {
    color: colors.signal,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  headerMeta: {
    color: colors.dim,
    fontFamily: mono,
    fontSize: 10,
    flex: 1,
  },
  chevron: {
    color: colors.dim,
    fontFamily: mono,
    fontSize: 10,
    paddingLeft: 8,
  },
  scroll: {
    maxHeight: 72,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    maxWidth: 220,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(126, 182, 255, 0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126, 182, 255, 0.1)",
  },
  glyph: {
    fontFamily: mono,
    fontSize: 11,
    lineHeight: 16,
    width: 10,
  },
  rowBody: {
    flexShrink: 1,
    gap: 1,
  },
  rowLabel: {
    color: colors.mist,
    fontFamily: mono,
    fontSize: 10,
    lineHeight: 14,
  },
  rowDetail: {
    color: colors.dim,
    fontFamily: mono,
    fontSize: 9,
    lineHeight: 12,
  },
});
