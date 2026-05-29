import Svg, { Path, Rect, Circle, Line, Ellipse } from 'react-native-svg';
import type { ColorValue } from 'react-native';

type P = { color: ColorValue; size?: number };
const c = (color: ColorValue) => color as string;

// Home → sketchy bread cottage
export function HomeTabIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Chimney */}
      <Rect x="16" y="5" width="3" height="6" rx="1" fill={c(color)} opacity={0.8} />
      {/* Loaf-arch roof */}
      <Path d="M1 11 Q1 3 12 3 Q23 3 23 11 Z"
        fill={c(color)} strokeLinecap="round" strokeLinejoin="round" />
      {/* Score on roof */}
      <Path d="M4 10 Q12 6 20 10" stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity={0.35} />
      {/* House body */}
      <Rect x="3" y="11" width="18" height="11" rx="2" fill={c(color)} opacity={0.85} />
      {/* Door */}
      <Path d="M10 15 Q10 13 12 13 Q14 13 14 15 L14 22 L10 22 Z" fill="white" opacity={0.45} />
      {/* Left window */}
      <Rect x="4.5" y="13" width="4" height="3.5" rx="1" fill="white" opacity={0.35} />
      {/* Right window */}
      <Rect x="15.5" y="13" width="4" height="3.5" rx="1" fill="white" opacity={0.35} />
    </Svg>
  );
}

// Tasks → sketchy toast clipboard with checklist
export function TasksTabIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Clipboard body */}
      <Path d="M4 5 Q4 3 6 3 L18 3 Q20 3 20 5 L20 21 Q20 23 18 23 L6 23 Q4 23 4 21 Z"
        fill={c(color)} strokeLinejoin="round" />
      {/* Clip at top */}
      <Rect x="9" y="2" width="6" height="4" rx="2" fill={c(color)} />
      <Rect x="8" y="3" width="8" height="2.5" rx="1" fill="white" opacity={0.4} />
      {/* Bread score on top */}
      <Path d="M6 8 Q12 6 18 8" stroke="white" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity={0.3} />
      {/* Checkmark */}
      <Path d="M7 13 L10 16 L15 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Bottom line */}
      <Line x1="7" y1="19" x2="17" y2="19" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

// Progress → sketchy bar chart with bread-loaf tops
export function ProgressTabIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Base line */}
      <Line x1="1" y1="22" x2="23" y2="22" stroke={c(color)} strokeWidth="1.5" strokeLinecap="round" opacity={0.6} />
      {/* Bar 1 - short */}
      <Rect x="2" y="17" width="6" height="5" rx="1.5" fill={c(color)} opacity={0.55} />
      <Path d="M2 18 Q5 15.5 8 18 Z" fill={c(color)} opacity={0.55} />
      {/* Bar 2 - medium */}
      <Rect x="9" y="12" width="6" height="10" rx="1.5" fill={c(color)} opacity={0.75} />
      <Path d="M9 13 Q12 10 15 13 Z" fill={c(color)} opacity={0.75} />
      {/* Bar 3 - tall */}
      <Rect x="16" y="6" width="6" height="16" rx="1.5" fill={c(color)} />
      <Path d="M16 7 Q19 4 22 7 Z" fill={c(color)} />
      {/* Sketch detail lines */}
      <Line x1="4" y1="19" x2="6" y2="18" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity={0.3} />
      <Line x1="11" y1="14" x2="13" y2="13" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity={0.3} />
    </Svg>
  );
}

// Shop → sketchy bread basket
export function ShopTabIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Handle - arch */}
      <Path d="M8 11 Q7 4 12 4 Q17 4 16 11"
        fill="none" stroke={c(color)} strokeWidth="2.2" strokeLinecap="round" opacity={0.85} />
      {/* Basket body */}
      <Path d="M2 12 L4 21 Q4 22 6 22 L18 22 Q20 22 20 21 L22 12 Z"
        fill={c(color)} strokeLinejoin="round" />
      {/* Weave horizontal */}
      <Line x1="2.5" y1="15.5" x2="21.5" y2="15.5" stroke="white" strokeWidth="1.2" opacity={0.35} />
      <Line x1="3.5" y1="19" x2="20.5" y2="19" stroke="white" strokeWidth="1.2" opacity={0.35} />
      {/* Weave vertical */}
      <Line x1="9" y1="12" x2="7.5" y2="22" stroke="white" strokeWidth="1" opacity={0.25} />
      <Line x1="14" y1="12" x2="14" y2="22" stroke="white" strokeWidth="1" opacity={0.25} />
      <Line x1="19" y1="12" x2="20.5" y2="22" stroke="white" strokeWidth="1" opacity={0.25} />
      {/* Bread peeking out */}
      <Path d="M9 12 Q12 8 15 12 Z" fill={c(color)} opacity={0.6} />
      <Circle cx="12" cy="10.5" r="3" fill={c(color)} opacity={0.65} />
      <Path d="M10 10 Q12 8.5 14 10" stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
  );
}
