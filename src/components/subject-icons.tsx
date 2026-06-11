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
