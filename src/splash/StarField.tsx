import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

type StarFieldProps = {
  width: number;
  height: number;
  progress: SharedValue<number>;
};

type Star = {
  id: number;
  x: number;
  y: number;
  size: number;
  peak: number;
  appear: number;
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function StarDot({
  star,
  progress,
}: {
  star: Star;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [star.appear, star.appear + 0.12],
      [0, star.peak],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [
        {
          scale: interpolate(
            progress.value,
            [star.appear, star.appear + 0.16],
            [0.4, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
        },
        style,
      ]}
    />
  );
}

export function StarField({ width, height, progress }: StarFieldProps) {
  const stars = useMemo(() => {
    const rand = mulberry32(42);
    const next: Star[] = [];
    for (let i = 0; i < 52; i += 1) {
      next.push({
        id: i,
        x: rand() * width,
        y: rand() * height,
        size: rand() > 0.82 ? 2.2 : 1.15 + rand() * 0.7,
        peak: 0.18 + rand() * 0.7,
        appear: rand() * 0.16,
      });
    }
    return next;
  }, [height, width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((star) => (
        <StarDot key={star.id} star={star} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: "absolute",
    backgroundColor: "#E7F1FF",
  },
});
