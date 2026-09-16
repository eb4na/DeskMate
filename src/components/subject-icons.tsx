import Svg, { Path } from 'react-native-svg';

// Shared sketchy bakery palette (mirrors settings-icons.tsx)
const S = '#7A5240'; // sketch stroke
const D = '#E05C3A'; // warm delete red

type IconProps = { size?: number };

// ── ↑ Move up → sketch arrow ──────────────────────────────────────────────────
export function ArrowUpIcon({ size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 19 L12 6" stroke={S} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M6.5 11 L12 5.5 L17.5 11" stroke={S} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// ── ↓ Move down → sketch arrow ────────────────────────────────────────────────
export function ArrowDownIcon({ size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5 L12 18" stroke={S} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M6.5 13 L12 18.5 L17.5 13" stroke={S} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// ── ✕ Delete → sketch cross ───────────────────────────────────────────────────
export function RemoveIcon({ size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 7 L17 17" stroke={D} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M17 7 L7 17" stroke={D} strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

// ── ≡ Drag handle → sketch grip ───────────────────────────────────────────────
// Three lines rather than the usual six-dot grip: the rest of this screen is drawn
// with a pen (sketch arrows, sketch cross), and a dot grid reads as a different,
// more "system UI" language beside them. The middle line is shortest so the shape
// still reads as a handle and not as a hamburger menu.
export function GripIcon({ size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 8 L18 8" stroke={S} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M7.5 12 L16.5 12" stroke={S} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M6 16 L18 16" stroke={S} strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}
