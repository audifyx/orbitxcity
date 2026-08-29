import Svg, { Circle, Line } from "react-native-svg";

import { colors } from "../theme";

type OrbitXMarkProps = {
  size?: number;
};

export function OrbitXMark({ size = 28 }: OrbitXMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle
        cx="14"
        cy="14"
        r="10"
        fill="none"
        stroke={colors.ring}
        strokeWidth="0.9"
        strokeOpacity="0.7"
      />
      <Circle
        cx="14"
        cy="14"
        r="12.5"
        fill="none"
        stroke={colors.ringDim}
        strokeWidth="0.6"
        strokeOpacity="0.45"
      />
      <Line
        x1="8.4"
        y1="8.4"
        x2="19.6"
        y2="19.6"
        stroke={colors.frost}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Line
        x1="19.6"
        y1="8.4"
        x2="8.4"
        y2="19.6"
        stroke={colors.frost}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Circle cx="14" cy="14" r="1.6" fill={colors.core} />
    </Svg>
  );
}
