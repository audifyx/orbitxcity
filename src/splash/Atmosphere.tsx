import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  Line,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

type AtmosphereProps = {
  width: number;
  height: number;
  progress: SharedValue<number>;
};

function buildFloorGrid(width: number, height: number) {
  const horizon = height * 0.52;
  const vanishX = width / 2;
  const rows = 11;
  const cols = 14;
  const floorH = height - horizon;

  const horizontals: number[] = [];
  for (let i = 1; i <= rows; i += 1) {
    const t = i / rows;
    horizontals.push(horizon + floorH * t * t);
  }

  const verticals: Array<{ x1: number; y1: number; x2: number; y2: number }> =
    [];
  for (let i = 0; i <= cols; i += 1) {
    const xBottom = (width * i) / cols;
    verticals.push({
      x1: xBottom,
      y1: height,
      x2: vanishX,
      y2: horizon,
    });
  }

  return { horizon, horizontals, verticals };
}

export function Atmosphere({ width, height, progress }: AtmosphereProps) {
  const grid = buildFloorGrid(width, height);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.02, 0.22],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, fadeStyle, styles.layer]}
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="coreBloom" cx="50%" cy="46%" r="42%">
            <Stop offset="0%" stopColor="#8EB7FF" stopOpacity="0.28" />
            <Stop offset="28%" stopColor="#5B7CFF" stopOpacity="0.1" />
            <Stop offset="58%" stopColor="#6B52FF" stopOpacity="0.045" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="leftWash" cx="18%" cy="28%" r="38%">
            <Stop offset="0%" stopColor="#3E7CFF" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="rightWash" cx="82%" cy="36%" r="34%">
            <Stop offset="0%" stopColor="#7A5CFF" stopOpacity="0.09" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="vignette" cx="50%" cy="50%" r="74%">
            <Stop offset="40%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.72" />
          </RadialGradient>
        </Defs>

        <Rect width={width} height={height} fill="url(#leftWash)" />
        <Rect width={width} height={height} fill="url(#rightWash)" />
        <Rect width={width} height={height} fill="url(#coreBloom)" />

        {grid.horizontals.map((y) => {
          const depth = (y - grid.horizon) / (height - grid.horizon);
          return (
            <Line
              key={`h-${y.toFixed(1)}`}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke="#8FB4FF"
              strokeOpacity={0.045 + depth * 0.05}
              strokeWidth={1}
            />
          );
        })}
        {grid.verticals.map((line, index) => (
          <Line
            key={`v-${index}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#8FB4FF"
            strokeOpacity={0.05}
            strokeWidth={1}
          />
        ))}

        <Rect width={width} height={height} fill="url(#vignette)" />
      </Svg>
      <View style={styles.horizonFade} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    pointerEvents: "none",
  },
  horizonFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "46%",
    height: 90,
    backgroundColor: "transparent",
  },
});
