import { useEffect } from "react";
import {
  Easing,
  runOnJS,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { timing } from "../theme";

export type SplashClock = {
  progress: SharedValue<number>;
  exit: SharedValue<number>;
};

export function useSplashTimeline(onComplete: () => void): SplashClock {
  const progress = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: timing.splashMs,
      easing: Easing.linear,
    });

    const finish = () => {
      exit.value = withTiming(
        1,
        {
          duration: timing.exitMs,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        },
        (finished) => {
          if (finished) {
            runOnJS(onComplete)();
          }
        }
      );
    };

    const hold = setTimeout(finish, timing.splashMs + 80);
    return () => clearTimeout(hold);
  }, [exit, onComplete, progress]);

  return { progress, exit };
}
