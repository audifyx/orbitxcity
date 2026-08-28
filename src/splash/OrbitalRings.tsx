import { StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from "react-native-reanimated";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type OrbitalRingsProps = {
  progress: SharedValue<number>;
  size?: number;
};

type RingSpec = {
  rx: number;
  ry: number;
  base: number;
  sweep: number;
  length: number;
  width: number;
  opacity: number;
  color: string;
};

const RINGS: RingSpec[] = [
  {
    rx: 148,
    ry: 46,
    base: -26,
    sweep: 210,
    length: 620,
    width: 1.15,
    opacity: 0.72,
    color: "#C9E0FF",
  },
  {
    rx: 132,
    ry: 40,
    base: 34,
    sweep: -165,
    length: 560,
    width: 1,
    opacity: 0.5,
    color: "#9BB6FF",
  },
  {
    rx: 118,
    ry: 34,
    base: 72,
    sweep: 130,
    length: 500,
    width: 0.9,
    opacity: 0.38,
    color: "#A996FF",
  },
];

function OrbitRing({
  ring,
  progress,
  origin,
}: {
  ring: RingSpec;
  progress: SharedValue<number>;
  origin: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const drawn = interpolate(
      progress.value,
      [0.18, 0.42],
      [0, 1],
      Extrapolation.CLAMP
    );
    const spin = interpolate(
      progress.value,
      [0.22, 0.58, 0.74, 1],
      [0, 38, 168, 198],
      Extrapolation.CLAMP
    );
    return {
      strokeDashoffset: ring.length * (1 - drawn),
      rotation: ring.base + (spin * ring.sweep) / 210,
    };
  });

  return (
    <AnimatedEllipse
      cx={origin}
      cy={origin}
      rx={ring.rx}
      ry={ring.ry}
      originX={origin}
      originY={origin}
      fill="none"
      stroke={ring.color}
      strokeWidth={ring.width}
      strokeOpacity={ring.opacity}
      strokeDasharray={`${ring.length} ${ring.length}`}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

function OrbitNode({
  progress,
  radius,
  delay,
  color,
}: {
  progress: SharedValue<number>;
  radius: number;
  delay: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const appear = interpolate(
      progress.value,
      [0.28 + delay, 0.4 + delay],
      [0, 1],
      Extrapolation.CLAMP
    );
    const angle = interpolate(
      progress.value,
      [0.28, 1],
      [delay * 360, 140 + delay * 220],
      Extrapolation.CLAMP
    );
    const rad = (angle * Math.PI) / 180;
    return {
      opacity: appear * 0.9,
      transform: [
        { translateX: Math.cos(rad) * radius },
        { translateY: Math.sin(rad) * radius * 0.32 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.nodeWrap, style]}>
      <View style={[styles.nodeHalo, { backgroundColor: `${color}33` }]} />
      <View style={[styles.node, { backgroundColor: color }]} />
    </Animated.View>
  );
}

export function OrbitalRings({ progress, size = 320 }: OrbitalRingsProps) {
  const origin = size / 2;
  const frameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.16, 0.3],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const coreRingProps = useAnimatedProps(() => {
    const drawn = interpolate(
      progress.value,
      [0.24, 0.46],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      strokeDashoffset: 420 * (1 - drawn),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.frame, { width: size, height: size }, frameStyle]}
    >
      <Svg width={size} height={size}>
        {RINGS.map((ring) => (
          <OrbitRing
            key={`${ring.base}-${ring.rx}`}
            ring={ring}
            progress={progress}
            origin={origin}
          />
        ))}
        <AnimatedCircle
          cx={origin}
          cy={origin}
          r={66}
          fill="none"
          stroke="#B9D4FF"
          strokeWidth={0.7}
          strokeOpacity={0.28}
          strokeDasharray="420 420"
          animatedProps={coreRingProps}
        />
      </Svg>
      <View style={styles.nodes} pointerEvents="none">
        <OrbitNode
          progress={progress}
          radius={148}
          delay={0}
          color="#E8F3FF"
        />
        <OrbitNode
          progress={progress}
          radius={132}
          delay={0.18}
          color="#9BB6FF"
        />
        <OrbitNode
          progress={progress}
          radius={118}
          delay={0.32}
          color="#C4B5FF"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
  },
  nodes: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeWrap: {
    position: "absolute",
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeHalo: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  node: {
    width: 3.4,
    height: 3.4,
    borderRadius: 2,
  },
});
