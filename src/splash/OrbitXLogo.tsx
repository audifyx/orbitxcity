import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

type OrbitXLogoProps = {
  progress: SharedValue<number>;
  size?: number;
};

export function OrbitXLogo({ progress, size = 168 }: OrbitXLogoProps) {
  const barLength = size * 0.42;
  const barThickness = 2.7;
  const center = (width: number, height: number) => ({
    position: "absolute" as const,
    top: (size - height) / 2,
    left: (size - width) / 2,
    width,
    height,
  });

  const markStyle = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.34, 0.54],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: t,
      transform: [
        {
          scale: interpolate(t, [0, 1], [0.86, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const barAStyle = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.36, 0.52],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: t,
      transform: [{ rotate: "45deg" }, { scaleY: t }],
    };
  });

  const barBStyle = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.38, 0.54],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: t,
      transform: [{ rotate: "-45deg" }, { scaleY: t }],
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.42, 0.58],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: t,
      transform: [{ scale: 0.4 + t * 0.6 }],
    };
  });

  const sweepStyle = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.52, 0.7],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: interpolate(t, [0, 0.18, 0.72, 1], [0, 1, 1, 0]),
      transform: [
        {
          translateX: interpolate(t, [0, 1], [-size * 0.55, size * 0.62]),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        markStyle,
      ]}
    >
      <View
        style={[
          styles.glow,
          center(size * 0.84, size * 0.84),
          { borderRadius: size * 0.42 },
        ]}
      />
      <View
        style={[
          styles.ring,
          center(size * 0.47, size * 0.47),
          { borderRadius: size * 0.235 },
        ]}
      />
      <View
        style={[
          styles.innerRing,
          center(size * 0.276, size * 0.276),
          { borderRadius: size * 0.138 },
        ]}
      />

      <Animated.View
        style={[
          styles.bar,
          center(barThickness, barLength),
          { borderRadius: barThickness },
          barAStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.bar,
          center(barThickness, barLength),
          { borderRadius: barThickness },
          barBStyle,
        ]}
      />

      <Animated.View style={[styles.coreWrap, center(20, 20), coreStyle]}>
        <View style={styles.coreHalo} />
        <View style={styles.core} />
      </Animated.View>

      <View style={styles.sweepClip}>
        <Animated.View style={[styles.sweep, sweepStyle]}>
          <LinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.08)",
              "rgba(255,255,255,0.62)",
              "rgba(186,214,255,0.28)",
              "rgba(255,255,255,0)",
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.sweepBar}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    backgroundColor: "rgba(110, 150, 255, 0.12)",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.05,
    borderColor: "rgba(197, 220, 255, 0.55)",
  },
  innerRing: {
    position: "absolute",
    borderWidth: 0.8,
    borderColor: "rgba(155, 176, 255, 0.35)",
  },
  bar: {
    position: "absolute",
    backgroundColor: "#F5F9FF",
  },
  coreWrap: {
    position: "absolute",
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  coreHalo: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(180, 210, 255, 0.35)",
  },
  core: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  sweepClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    borderRadius: 999,
    pointerEvents: "none",
  },
  sweep: {
    position: "absolute",
    top: "-20%",
    height: "140%",
    width: 54,
  },
  sweepBar: {
    flex: 1,
    transform: [{ rotate: "18deg" }],
  },
});
