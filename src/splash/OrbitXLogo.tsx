import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  Line,
  RadialGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from "react-native-reanimated";

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type OrbitXLogoProps = {
  progress: SharedValue<number>;
  size?: number;
};

export function OrbitXLogo({ progress, size = 168 }: OrbitXLogoProps) {
  const cx = size / 2;
  const cy = size / 2;
  const xPad = size * 0.3;

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

  const xPropsA = useAnimatedProps(() => {
    const drawn = interpolate(
      progress.value,
      [0.36, 0.52],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { strokeDashoffset: 160 * (1 - drawn) };
  });

  const xPropsB = useAnimatedProps(() => {
    const drawn = interpolate(
      progress.value,
      [0.38, 0.54],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { strokeDashoffset: 160 * (1 - drawn) };
  });

  const coreProps = useAnimatedProps(() => {
    const drawn = interpolate(
      progress.value,
      [0.4, 0.56],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: drawn,
      r: interpolate(drawn, [0, 1], [0.5, size * 0.028], Extrapolation.CLAMP),
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
    <Animated.View style={[{ width: size, height: size }, markStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="nucleus" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="42%" stopColor="#D5E8FF" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#7EA6FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="markGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#B9D6FF" stopOpacity="0.42" />
            <Stop offset="55%" stopColor="#6E7BFF" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={cx} cy={cy} r={size * 0.42} fill="url(#markGlow)" />
        <Circle
          cx={cx}
          cy={cy}
          r={size * 0.236}
          fill="none"
          stroke="#C5DCFF"
          strokeWidth={1.05}
          strokeOpacity={0.55}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={size * 0.138}
          fill="none"
          stroke="#9BB0FF"
          strokeWidth={0.8}
          strokeOpacity={0.35}
        />

        <AnimatedLine
          x1={xPad}
          y1={xPad}
          x2={size - xPad}
          y2={size - xPad}
          stroke="#F5F9FF"
          strokeWidth={2.7}
          strokeLinecap="round"
          strokeDasharray="160 160"
          animatedProps={xPropsA}
        />
        <AnimatedLine
          x1={size - xPad}
          y1={xPad}
          x2={xPad}
          y2={size - xPad}
          stroke="#E7F1FF"
          strokeWidth={2.7}
          strokeLinecap="round"
          strokeDasharray="160 160"
          animatedProps={xPropsB}
        />

        <Circle cx={cx} cy={cy} r={size * 0.072} fill="url(#nucleus)" />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          fill="#FFFFFF"
          animatedProps={coreProps}
        />
      </Svg>

      <View style={styles.sweepClip} pointerEvents="none">
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
  sweepClip: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    borderRadius: 999,
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
