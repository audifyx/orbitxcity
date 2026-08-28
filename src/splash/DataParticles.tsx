import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

type DataParticlesProps = {
  width: number;
  height: number;
  progress: SharedValue<number>;
};

type Particle = {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  appear: number;
  vanish: number;
  streak: boolean;
  angle: number;
  color: string;
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ParticleView({
  particle,
  progress,
}: {
  particle: Particle;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [particle.appear, particle.vanish],
      [0, 1],
      Extrapolation.CLAMP
    );
    const eased = 1 - (1 - t) * (1 - t);
    const x = particle.startX + (particle.endX - particle.startX) * eased;
    const y = particle.startY + (particle.endY - particle.startY) * eased;
    const opacity = interpolate(
      t,
      [0, 0.12, 0.72, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${particle.angle}deg` },
        { scale: interpolate(t, [0, 1], [1, 0.35], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particleWrap, style]}>
      <View
        style={[
          styles.halo,
          {
            width: particle.size * 5,
            height: particle.size * 5,
            borderRadius: particle.size * 2.5,
            backgroundColor: particle.streak
              ? "rgba(126, 182, 255, 0.08)"
              : "rgba(180, 210, 255, 0.12)",
          },
        ]}
      />
      <View
        style={
          particle.streak
            ? [
                styles.streak,
                {
                  backgroundColor: particle.color,
                  shadowColor: particle.color,
                },
              ]
            : [
                styles.dot,
                {
                  width: particle.size,
                  height: particle.size,
                  borderRadius: particle.size / 2,
                  backgroundColor: particle.color,
                  shadowColor: particle.color,
                },
              ]
        }
      />
    </Animated.View>
  );
}

export function DataParticles({
  width,
  height,
  progress,
}: DataParticlesProps) {
  const particles = useMemo(() => {
    const rand = mulberry32(91);
    const cx = width / 2;
    const cy = height * 0.445;
    const items: Particle[] = [];

    for (let i = 0; i < 36; i += 1) {
      const angle = rand() * Math.PI * 2;
      const radius = Math.min(width, height) * (0.28 + rand() * 0.42);
      const startX = cx + Math.cos(angle) * radius;
      const startY = cy + Math.sin(angle) * radius * 0.92;
      const endX = cx + (rand() - 0.5) * 18;
      const endY = cy + (rand() - 0.5) * 18;
      const streak = rand() > 0.62;
      items.push({
        id: i,
        startX,
        startY,
        endX,
        endY,
        size: 1.2 + rand() * 1.6,
        appear: 0.06 + rand() * 0.12,
        vanish: 0.34 + rand() * 0.16,
        streak,
        angle: (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI,
        color: rand() > 0.72 ? "#B7A8FF" : rand() > 0.4 ? "#D7E9FF" : "#8EC2FF",
      });
    }

    return items;
  }, [height, width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle) => (
        <ParticleView
          key={particle.id}
          particle={particle}
          progress={progress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particleWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
  },
  dot: {
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  streak: {
    width: 14,
    height: 1.4,
    borderRadius: 1,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
});
