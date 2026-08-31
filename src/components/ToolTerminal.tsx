import { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import type { ToolEvent, ToolEventStatus } from "./types";

export type ToolTerminalProps = {
  events: ToolEvent[];
  /** Optional label shown in the terminal title bar. */
  title?: string;
};

const MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

function glyph(status: ToolEventStatus): string {
  switch (status) {
    case "ok":
      return "✓";
    case "error":
      return "✗";
    case "running":
      return "▸";
    default:
      return "•";
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

function statusWord(status: ToolEventStatus): string {
  switch (status) {
    case "ok":
      return "done";
    case "error":
      return "failed";
    case "running":
      return "running";
    default:
      return "queued";
  }
}

function commandText(label: string): string {
  return label.trim().replace(/\s+/g, "-").toLowerCase();
}

function BlinkingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.15,
          duration: 520,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.cursor, { opacity }]} accessibilityElementsHidden>
      ▋
    </Animated.Text>
  );
}

export function ToolTerminal({ events, title = "orbitx-agent · tools" }: ToolTerminalProps) {
  const [elapsed, setElapsed] = useState(0);
  const running = events.filter((e) => e.status === "running").length;
  const ok = events.filter((e) => e.status === "ok").length;
  const failed = events.filter((e) => e.status === "error").length;
  const active = running > 0;

  useEffect(() => {
    if (!active) {
      return;
    }
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 100) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [active]);

  if (events.length === 0) {
    return null;
  }

  return (
    <View style={styles.root} accessibilityLabel="Agent tool terminal">
      <View style={styles.titleBar}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotRed]} />
          <View style={[styles.dot, styles.dotAmber]} />
          <View style={[styles.dot, styles.dotGreen]} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.badge}>
          {active ? `● ${elapsed.toFixed(1)}s` : `${events.length} calls`}
        </Text>
      </View>

      <View style={styles.body}>
        {events.map((event, index) => {
          const color = statusColor(event.status);
          const isLast = index === events.length - 1;
          return (
            <View key={event.id} style={styles.line}>
              <Text style={styles.prompt}>$</Text>
              <Text style={styles.command} numberOfLines={1}>
                orbitx run{" "}
                <Text style={styles.commandName}>{commandText(event.label)}</Text>
              </Text>
              <View style={styles.statusWrap}>
                <Text style={[styles.statusGlyph, { color }]}>
                  {glyph(event.status)}
                </Text>
                <Text style={[styles.statusWord, { color }]}>
                  {statusWord(event.status)}
                </Text>
                {event.status === "running" && isLast ? <BlinkingCursor /> : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ⌁ {events.length} {events.length === 1 ? "call" : "calls"}
          {ok > 0 ? `  ·  ${ok} done` : ""}
          {running > 0 ? `  ·  ${running} running` : ""}
          {failed > 0 ? `  ·  ${failed} failed` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: "#070910",
    overflow: "hidden",
  },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(150, 180, 255, 0.04)",
  },
  dots: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotRed: {
    backgroundColor: "#F06A62",
  },
  dotAmber: {
    backgroundColor: "#E8C17A",
  },
  dotGreen: {
    backgroundColor: "#7EE0C4",
  },
  title: {
    flex: 1,
    color: colors.mist,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  badge: {
    color: colors.signal,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prompt: {
    color: colors.success,
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
  },
  command: {
    flex: 1,
    color: colors.mist,
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
  },
  commandName: {
    color: colors.ice,
    fontFamily: MONO,
  },
  statusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusGlyph: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
  },
  statusWord: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 18,
  },
  cursor: {
    color: colors.signal,
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 1,
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: "rgba(150, 180, 255, 0.03)",
  },
  footerText: {
    color: colors.dim,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
