import Svg, { Path, Rect } from 'react-native-svg';

// Code-drawn settings glyphs (bakery palette). Kept as SVG so they stay crisp at
// any size and match the app's "generate art = SVG" convention.

const JAM = '#E48A9A'; // primary pink
const COCOA = '#5D3C2E'; // outline
const DANGER = '#D0392B'; // delete red

// Replay tutorial — a soft circular replay arrow (curved arrow sweeping most of a
// ring, arrowhead pointing back to the start) with a little play triangle inside.
export function ReplayGlyph({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* ring arrow — open at the top-left where the arrowhead sits */}
      <Path
        d="M20 8.5 A11.5 11.5 0 1 1 9.2 15.5"
        fill="none"
        stroke={JAM}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* arrowhead at the start of the sweep */}
      <Path
        d="M20 3.5 L20 13.5 L14 8.5 Z"
        fill={JAM}
        stroke={JAM}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* little play triangle in the middle */}
      <Path d="M17.5 15.5 L25 20 L17.5 24.5 Z" fill={COCOA} strokeLinejoin="round" />
    </Svg>
  );
}

// Delete account — a rounded trash can with a lid, handle and two stripes.
export function TrashGlyph({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* lid handle */}
      <Path
        d="M15.5 11 V9.5 A2.2 2.2 0 0 1 17.7 7.3 H22.3 A2.2 2.2 0 0 1 24.5 9.5 V11"
        fill="none"
        stroke={DANGER}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* lid bar */}
      <Rect x="9" y="11.4" width="22" height="3.6" rx="1.8" fill={DANGER} />
      {/* can body */}
      <Path
        d="M12 16.5 H28 L26.4 31.6 A2.4 2.4 0 0 1 24 33.8 H16 A2.4 2.4 0 0 1 13.6 31.6 Z"
        fill={DANGER}
      />
      {/* stripes */}
      <Rect x="16.7" y="19.8" width="2.3" height="10.6" rx="1.15" fill="#FFFFFF" opacity="0.85" />
      <Rect x="21" y="19.8" width="2.3" height="10.6" rx="1.15" fill="#FFFFFF" opacity="0.85" />
    </Svg>
  );
}
