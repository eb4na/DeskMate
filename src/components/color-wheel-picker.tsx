import { useCallback, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const BASE_SIZE = 216;
const SEGMENTS = 72; // 5° each
const STEP = 360 / SEGMENTS;
// Fixed saturation so every pick stays in the app's pastel family.
const SAT = 62;
// Default lightness — where the ring itself is drawn, and what a hue-only picker
// (no brightness slider) always emits.
const LIG = 73;
// The brightness slider's range. Deliberately NOT 0–100, and deliberately capped
// at LIG rather than above it: a subject colour is drawn as TEXT in places
// (calendar chips use `color: c.color`), where lighter means less readable. The
// shipped palette bottoms out at 1.34:1 against the cream page (#FFD54F yellow)
// and this picker's own pastel default sits at 1.29:1, so allowing anything
// LIGHTER than the default would put custom colours below everything the app
// already ships. The slider therefore runs from that default down to a deeper 45,
// i.e. it can only ever improve contrast, never worsen it.
export const LIG_MIN = 45;
export const LIG_MAX = LIG;
const clampLig = (l: number) => Math.min(LIG_MAX, Math.max(LIG_MIN, l));

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

/** Full h/s/l from a hex — hueFromHex only recovers the hue, which isn't enough
 *  to put the brightness slider's thumb back where the user left it. */
export function hslFromHex(hex: string): { h: number; s: number; l: number } {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return { h: 0, s: SAT, l: LIG };
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: hueFromHex(hex), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function ColorWheelPicker({
  value,
  onChange,
  size = BASE_SIZE,
  brightness = false,
}: {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
  /** Show a light/dark slider under the ring. Off = hue only, at the fixed
   *  pastel lightness, which is how this picker behaved before. */
  brightness?: boolean;
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
  // The ring and the slider each change ONE axis and must preserve the other, so
  // both read the live colour through a ref rather than closing over a stale prop.
  const ligRef = useRef(LIG);
  const hueRef = useRef(0);
  const parsed = hslFromHex(value);
  ligRef.current = brightness ? clampLig(parsed.l) : LIG;
  hueRef.current = parsed.h;

  const handleXY = useCallback((x: number, y: number) => {
    const dx = x - CENTER;
    const dy = y - CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < INNER_R - 12 || dist > OUTER_R + 12) return;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const hue = ((angle % 360) + 360) % 360;
    onChangeRef.current(hslToHex(hue, SAT, ligRef.current));
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

  // ── Brightness slider ────────────────────────────────────────────────────
  const BAR_H = Math.round(size * 0.075);
  const BAR_PAD = dotR; // room for the thumb at either end
  const BAR_W = size - BAR_PAD * 2;
  const handleSlide = useCallback((x: number) => {
    const t = Math.min(1, Math.max(0, (x - BAR_PAD) / BAR_W));
    // Left = light, right = dark, matching how the gradient below is drawn.
    const l = LIG_MAX - t * (LIG_MAX - LIG_MIN);
    onChangeRef.current(hslToHex(hueRef.current, SAT, Math.round(l)));
  }, [BAR_PAD, BAR_W]);

  const barResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleSlide(e.nativeEvent.locationX),
      onPanResponderMove: (e) => handleSlide(e.nativeEvent.locationX),
    }),
  ).current;

  // Thumb position from the live lightness, so it lands where the colour actually is.
  const ligT = (LIG_MAX - ligRef.current) / (LIG_MAX - LIG_MIN);
  const thumbX = BAR_PAD + Math.min(1, Math.max(0, ligT)) * BAR_W;
  // A handful of stops rather than a real gradient: RNSVG gradients need Defs +
  // an id, and at this width a stepped ramp is indistinguishable.
  const STOPS = 24;

  return (
    <View style={{ width: size }}>
      <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
        <Svg width={size} height={size}>
          {segments.map((seg, i) => (
            <Path key={i} d={seg.d} fill={seg.fill} />
          ))}
          <Circle cx={dot.x} cy={dot.y} r={dotR} fill={value} stroke="#fff" strokeWidth={3} />
          <Circle cx={dot.x} cy={dot.y} r={dotR} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
        </Svg>
      </View>

      {brightness && (
        <View
          style={{ width: size, height: BAR_H + dotR * 2, marginTop: 6 }}
          {...barResponder.panHandlers}>
          <Svg width={size} height={BAR_H + dotR * 2}>
            {Array.from({ length: STOPS }, (_, i) => {
              const t = i / (STOPS - 1);
              const l = LIG_MAX - t * (LIG_MAX - LIG_MIN);
              return (
                <Rect
                  key={i}
                  x={BAR_PAD + t * BAR_W}
                  y={dotR}
                  width={BAR_W / (STOPS - 1) + 1}
                  height={BAR_H}
                  fill={hslToHex(hue, SAT, Math.round(l))}
                />
              );
            })}
            <Circle cx={thumbX} cy={dotR + BAR_H / 2} r={dotR} fill={value} stroke="#fff" strokeWidth={3} />
            <Circle cx={thumbX} cy={dotR + BAR_H / 2} r={dotR} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
          </Svg>
        </View>
      )}
    </View>
  );
}
