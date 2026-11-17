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

// ── Archive → sketch storage box ──────────────────────────────────────────────
// A lidded box with a handle slot: the "put it away" mark beside the delete cross.
// Same pen as the arrows and grip so the row's controls read as one set.
export function ArchiveIcon({ size = 18, color = S }: IconProps & { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 5.5 H19.5 Q20.5 5.5 20.5 6.5 V8.5 Q20.5 9.5 19.5 9.5 H4.5 Q3.5 9.5 3.5 8.5 V6.5 Q3.5 5.5 4.5 5.5 Z"
        stroke={color} strokeWidth="2.2" strokeLinejoin="round" fill="none"
      />
      <Path
        d="M5.5 9.5 V17.5 Q5.5 19.5 7.5 19.5 H16.5 Q18.5 19.5 18.5 17.5 V9.5"
        stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" fill="none"
      />
      <Path d="M10 13.5 H14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Restore → sketch box with an up arrow ─────────────────────────────────────
// The archive box's open tray with an arrow lifting out of it — "take it back
// out", the reverse of ArchiveIcon.
export function RestoreIcon({ size = 18, color = S }: IconProps & { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 V17.5 Q4.5 19.5 6.5 19.5 H17.5 Q19.5 19.5 19.5 17.5 V12.5"
        stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" fill="none"
      />
      <Path d="M12 15 V4.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M8 8.5 L12 4.5 L16 8.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// ── › Chevron → sketch caret (row "go to" / back) ─────────────────────────────
export function ChevronIcon({ size = 16, direction = 'right', color = S }: IconProps & { direction?: 'left' | 'right'; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={direction === 'right' ? 'M9 5.5 L15.5 12 L9 18.5' : 'M15 5.5 L8.5 12 L15 18.5'}
        stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </Svg>
  );
}
