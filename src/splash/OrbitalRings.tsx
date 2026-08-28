import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

type OrbitalRingsProps = {
  progress: SharedValue<number>;
  size?: number;
};

type RingSpec = {
  radius: number;
  tilt: number;
  spin: number;
  thickness: number;
  color: string;
  opacity: number;
};

const RINGS: RingSpec[] = [
  {
    radius: 148,
    tilt: -26,
    spin: 1,
    thickness: 1.15,
    color: "rgba(201, 224, 255, 0.7)",
    opacity: 0.72,
  },
  {
    radius: 132,
    tilt: 34,
    spin: -0.78,
    thickness: 1,
    color: "rgba(155, 182, 255, 0.55)",
    opacity: 0.5,
  },
  {
    radius: 118,
    tilt: 72,
    spin: 0.62,
    thickness: 0.9,
    color: "rgba(169, 150, 255, 0.48)",
    opacity: 0.38,
  },
];

function OrbitRing({
  ring,
  progress,
  size,
}: {
  ring: RingSpec;
  progress: SharedValue<number>;
  size: number;
}) {
  const offset = (size - ring.radius * 2) / 2;
  const style = useAnimatedStyle(() => {
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
      opacity: drawn * ring.opacity,
      transform: [
        { rotateZ: `${spin * ring.spin}deg` },
        { scaleY: 0.33 },
        { rotateZ: `${ring.tilt}deg` },
        { scale: 0.92 + drawn * 0.08 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: ring.radius * 2,
          height: ring.radius * 2,
          borderRadius: ring.radius,
          borderWidth: ring.thickness,
          borderColor: ring.color,
          top: offset,
          left: offset,
        },
        style,
      ]}
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
  const frameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.16, 0.3],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const coreStyle = useAnimatedStyle(() => {
    const drawn = interpolate(
      progress.value,
      [0.24, 0.46],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: drawn * 0.35,
      transform: [{ scale: 0.9 + drawn * 0.1 }],
    };
  });

  return (
    <Animated.View
      style={[styles.frame, { width: size, height: size }, frameStyle]}
    >
      {RINGS.map((ring) => (
        <OrbitRing
          key={`${ring.tilt}-${ring.radius}`}
          ring={ring}
          progress={progress}
          size={size}
        />
      ))}
      <Animated.View
        style={[
          styles.coreRing,
          {
            top: (size - 132) / 2,
            left: (size - 132) / 2,
          },
          coreStyle,
        ]}
      />
      <View style={styles.nodes}>
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
    pointerEvents: "none",
  },
  ring: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  coreRing: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 0.7,
    borderColor: "rgba(185, 212, 255, 0.55)",
  },
  nodes: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
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
