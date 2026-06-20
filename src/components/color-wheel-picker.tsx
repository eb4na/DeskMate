import { useCallback, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const BASE_SIZE = 216;
const SEGMENTS = 72; // 5° each
const STEP = 360 / SEGMENTS;
// Fixed saturation + lightness so every picked hue produces a soft pastel
const SAT = 62;
const LIG = 73;

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, inner: number, outer: number, start: number, end: number) {
  const s1 = polarToCartesian(cx, cy, outer, start);
  const e1 = polarToCartesian(cx, cy, outer, end);
  const s2 = polarToCartesian(cx, cy, inner, end);
  const e2 = polarToCartesian(cx, cy, inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${s1.x} ${s1.y} A${outer} ${outer} 0 ${large} 1 ${e1.x} ${e1.y} L${s2.x} ${s2.y} A${inner} ${inner} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
}

export function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hueFromHex(hex: string): number {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

export function ColorWheelPicker({
  value,
  onChange,
  size = BASE_SIZE,
}: {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const CENTER = size / 2;
  const OUTER_R = size / 2 - 6;
  const INNER_R = OUTER_R - Math.round(size * 0.165);
  const MID_R = (INNER_R + OUTER_R) / 2;

  const segments = Array.from({ length: SEGMENTS }, (_, i) => {
    const start = i * STEP;
    const end = start + STEP + 0.5;
    const hue = start + STEP / 2;
    return { d: arcPath(CENTER, CENTER, INNER_R, OUTER_R, start, end), fill: `hsl(${hue}, ${SAT}%, ${LIG}%)` };
  });

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleXY = useCallback((x: number, y: number) => {
    const dx = x - CENTER;
    const dy = y - CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < INNER_R - 12 || dist > OUTER_R + 12) return;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const hue = ((angle % 360) + 360) % 360;
    onChangeRef.current(hslToHex(hue, SAT, LIG));
  }, [CENTER, INNER_R, OUTER_R]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleXY(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => handleXY(e.nativeEvent.locationX, e.nativeEvent.locationY),
    }),
  ).current;

  const hue = hueFromHex(value);
  const dot = polarToCartesian(CENTER, CENTER, MID_R, hue);
  const dotR = Math.round(size * 0.065);

  return (
    <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
      <Svg width={size} height={size}>
        {segments.map((seg, i) => (
          <Path key={i} d={seg.d} fill={seg.fill} />
        ))}
        <Circle cx={dot.x} cy={dot.y} r={dotR} fill={value} stroke="#fff" strokeWidth={3} />
        <Circle cx={dot.x} cy={dot.y} r={dotR} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
      </Svg>
    </View>
  );
}
