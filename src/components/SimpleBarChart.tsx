import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type SimpleBarChartPoint = {
  label: string;
  value: number;
};

export type SimpleBarChartProps = {
  points: SimpleBarChartPoint[];
  height?: number;
  barColor?: string;
  emptyLabel?: string;
};

/**
 * Minimal bar chart built from plain Views — no chart/SVG library dependency.
 * Intentionally simple: this app has no chart package installed, and adding
 * one mid-project risks native-module issues we can't verify in this
 * environment. Good enough for small counts (trades/day); not meant to
 * replace a real charting library if one gets added later.
 */
export function SimpleBarChart({
  points,
  height = 96,
  barColor = colors.signal,
  emptyLabel = "No data yet",
}: SimpleBarChartProps) {
  const max = Math.max(1, ...points.map((p) => p.value));

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { height }]}>
      {points.map((point, index) => {
        const barHeight = Math.max(3, (point.value / max) * (height - 20));
        return (
          <View key={`${point.label}-${index}`} style={styles.column}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { height: barHeight, backgroundColor: barColor },
                ]}
              />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {point.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
    height: "100%",
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "60%",
    borderRadius: 3,
    minHeight: 3,
  },
  label: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 9,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});
