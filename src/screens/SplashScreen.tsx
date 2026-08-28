import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { Atmosphere } from "../splash/Atmosphere";
import { DataParticles } from "../splash/DataParticles";
import { OrbitalRings } from "../splash/OrbitalRings";
import { OrbitXLogo } from "../splash/OrbitXLogo";
import { StarField } from "../splash/StarField";
import { useSplashTimeline } from "../splash/useSplashTimeline";
import { colors } from "../theme";

type SplashScreenProps = {
  onComplete: () => void;
};

function Wordmark({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.5, 0.68],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: t,
      transform: [
        {
          translateY: interpolate(t, [0, 1], [10, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View style={style}>
      <Text style={styles.wordmark}>ORBITX</Text>
    </Animated.View>
  );
}

function Tagline({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(
      progress.value,
      [0.6, 0.78],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: t * 0.9,
      transform: [
        {
          translateY: interpolate(t, [0, 1], [8, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View style={style}>
      <Text style={styles.tagline}>THE INTELLIGENCE LAYER FOR CRYPTO</Text>
    </Animated.View>
  );
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const { progress, exit } = useSplashTimeline(onComplete);

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(exit.value, [0, 1], [1, 1.045], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.root, stageStyle]}>
      <View style={styles.void} />
      <Atmosphere width={width} height={height} progress={progress} />
      <StarField width={width} height={height} progress={progress} />
      <DataParticles width={width} height={height} progress={progress} />

      <View style={styles.center}>
        <View style={styles.markStage}>
          <OrbitalRings progress={progress} size={320} />
          <View style={styles.logoLayer}>
            <OrbitXLogo progress={progress} size={168} />
          </View>
        </View>
        <View style={styles.copy}>
          <Wordmark progress={progress} />
          <Tagline progress={progress} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.void,
    zIndex: 20,
  },
  void: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.void,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 28,
  },
  markStage: {
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    marginTop: -18,
    alignItems: "center",
    gap: 10,
  },
  wordmark: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
    letterSpacing: 9.5,
    textAlign: "center",
    includeFontPadding: false,
  },
  tagline: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 2.1,
    textAlign: "center",
    includeFontPadding: false,
    paddingHorizontal: 24,
  },
});
