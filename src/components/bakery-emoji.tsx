/**
 * Cute hand-drawn bakery replacements for all UI emojis.
 * Use these instead of emoji strings throughout the app.
 */
import Svg, { Circle, Ellipse, Path, Rect, Line, G } from 'react-native-svg';
import { View } from 'react-native';

const S = '#7A5240'; // sketch stroke
const H = '#F0B44A'; // honey
const B = '#F4C976'; // butter
const C = '#FFF0CC'; // cream
const R = '#F6C8C2'; // rose blush
const P = '#E48A9A'; // pink
const G2 = '#84B88E'; // green

type Sz = { size?: number };

// ── 🌟 Star (Plus / sparkle) ──────────────────────────────────────────────────
export function BakeryStarEmoji({ size = 20 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Rough star body */}
      <Path
        d="M30 5 L35 22 Q37 24 40 22 L55 18 L44 30 Q42 32 44 35 L52 50 L32 42 Q30 41 28 42 L8 50 L16 35 Q18 32 16 30 L5 18 L20 22 Q23 24 25 22 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Inner shimmer */}
      <Path
        d="M30 12 L34 24 L46 22 L38 30 L42 44 L30 38 L18 44 L22 30 L14 22 L26 24 Z"
        fill={H} stroke="none" opacity={0.4}
      />
      {/* Sketch texture lines */}
      <Line x1="26" y1="22" x2="34" y2="18" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.2} />
      <Line x1="36" y1="32" x2="42" y2="28" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.2} />
      {/* Little sparkle dots */}
      <Circle cx="10" cy="10" r="2.5" fill={H} stroke={S} strokeWidth="1" />
      <Circle cx="50" cy="8" r="2" fill={H} stroke={S} strokeWidth="1" />
      <Circle cx="52" cy="52" r="2" fill={H} stroke={S} strokeWidth="1" />
      {/* Blush on star */}
      <Ellipse cx="22" cy="36" rx="4" ry="2.5" fill={R} opacity={0.5} />
      <Ellipse cx="38" cy="36" rx="4" ry="2.5" fill={R} opacity={0.5} />
    </Svg>
  );
}

// ── ⭐ Toast Star (popular badge) ──────────────────────────────────────────────
export function BakeryToastStarEmoji({ size = 16 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path
        d="M20 3 L24 15 L37 13 L28 21 L32 34 L20 27 L8 34 L12 21 L3 13 L16 15 Z"
        fill={B} stroke={S} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
      />
      <Path d="M20 8 L23 17 L33 16 L26 22 L29 31 L20 26 L11 31 L14 22 L7 16 L17 17 Z"
        fill={H} opacity={0.35} stroke="none" />
      <Line x1="16" y1="16" x2="24" y2="14" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.25} />
    </Svg>
  );
}

// ── 🔒 Bread Lock (Plus locked) ────────────────────────────────────────────────
export function BakeryLockEmoji({ size = 18 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Lock body - bread loaf shape */}
      <Rect x="10" y="28" width="40" height="28" rx="8" fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Bread score on body */}
      <Path d="M14 38 Q30 34 46 38" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.3} />
      {/* Shackle - bread arch */}
      <Path d="M18 28 Q18 10 30 10 Q42 10 42 28" fill="none" stroke={S} strokeWidth="4" strokeLinecap="round" />
      <Path d="M18 28 Q18 12 30 12 Q42 12 42 28" fill="none" stroke={B} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
      {/* Keyhole */}
      <Circle cx="30" cy="42" r="6" fill={S} opacity={0.7} />
      <Rect x="28" y="42" width="4" height="6" rx="1" fill={S} opacity={0.7} />
      {/* Texture */}
      <Line x1="14" y1="46" x2="18" y2="42" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.15} />
      <Line x1="42" y1="46" x2="46" y2="42" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.15} />
    </Svg>
  );
}

// ── ⚙️ Bread Gear (settings) ───────────────────────────────────────────────────
export function BakeryGearEmoji({ size = 20 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Gear outer teeth - rough polygon */}
      <Path
        d="M26 4 L34 4 L36 12 Q40 13 44 16 L52 12 L58 18 L54 26 Q56 30 54 34 L58 42 L52 48 L44 44 Q40 47 36 48 L34 56 L26 56 L24 48 Q20 47 16 44 L8 48 L2 42 L6 34 Q4 30 6 26 L2 18 L8 12 L16 16 Q20 13 24 12 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Gear inner circle */}
      <Circle cx="30" cy="30" r="12" fill={C} stroke={S} strokeWidth="2" />
      {/* Bread score on inner */}
      <Path d="M22 30 Q30 26 38 30" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.4} />
      {/* Center dot */}
      <Circle cx="30" cy="30" r="4" fill={S} opacity={0.5} />
      {/* Sketch hatching on gear */}
      <Line x1="12" y1="24" x2="16" y2="20" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.2} />
      <Line x1="44" y1="40" x2="48" y2="36" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.2} />
    </Svg>
  );
}

// ── 🛠 Bread Wrench/Tools (disclaimer) ────────────────────────────────────────
export function BakeryWrenchEmoji({ size = 18 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Wrench handle - baguette shape */}
      <Path
        d="M8 50 Q6 54 10 56 Q14 58 16 54 L44 18 Q46 14 44 10 Q42 6 38 8 Q40 12 38 14 Q36 16 34 14 L16 46 Q12 48 8 50 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Bread scoring on handle */}
      <Line x1="18" y1="44" x2="26" y2="32" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.3} />
      <Line x1="24" y1="38" x2="32" y2="26" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.3} />
      {/* Wrench head */}
      <Path
        d="M40 6 Q50 4 54 14 Q58 24 50 28 L46 24 Q50 20 48 14 Q46 8 40 10 Z"
        fill={H} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Cross bread hatching */}
      <Line x1="42" y1="10" x2="50" y2="18" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.25} />
      <Line x1="46" y1="8" x2="52" y2="16" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.25} />
    </Svg>
  );
}

// ── 🍞 Bread Loaf ─────────────────────────────────────────────────────────────
export function BakeryBreadEmoji({ size = 22 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Loaf body */}
      <Path
        d="M8 38 Q6 22 30 16 Q54 22 52 38 L52 50 Q52 54 30 54 Q8 54 8 50 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Top arch - bread dome */}
      <Path d="M10 38 Q10 20 30 16 Q50 20 50 38" fill={H} stroke={S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Score marks */}
      <Path d="M18 34 Q30 28 42 34" stroke={S} strokeWidth="2" strokeLinecap="round" fill="none" opacity={0.5} />
      <Path d="M20 40 Q30 36 40 40" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.3} />
      {/* Texture hatching */}
      <Line x1="12" y1="44" x2="16" y2="40" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.2} />
      <Line x1="44" y1="44" x2="48" y2="40" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.2} />
      {/* Blush */}
      <Ellipse cx="18" cy="44" rx="5" ry="3" fill={R} opacity={0.5} />
      <Ellipse cx="42" cy="44" rx="5" ry="3" fill={R} opacity={0.5} />
      {/* Shine */}
      <Path d="M20 22 Q26 18 32 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
  );
}

// ── 🪙 Bread Coin ─────────────────────────────────────────────────────────────
export function BakeryCoinEmoji({ size = 20 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Outer coin */}
      <Circle cx="30" cy="30" r="27" fill="#D29649" stroke={S} strokeWidth="2" />
      <Circle cx="30" cy="30" r="23" fill={H} stroke={S} strokeWidth="1.5" />
      {/* Toast face in center */}
      <Rect x="16" y="16" width="28" height="28" rx="7" fill={C} stroke={S} strokeWidth="2" />
      {/* Crust scoring */}
      <Path d="M19 24 Q30 20 41 24" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.4} />
      {/* Toast eyes */}
      <Circle cx="24" cy="29" r="2.5" fill={S} opacity={0.8} />
      <Circle cx="36" cy="29" r="2.5" fill={S} opacity={0.8} />
      {/* Toast smile */}
      <Path d="M22 35 Q30 40 38 35" stroke={S} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity={0.7} />
      {/* Coin shine */}
      <Path d="M14 16 Q20 10 26 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={0.35} />
    </Svg>
  );
}

// ── 🔔 Bread Bell ─────────────────────────────────────────────────────────────
export function BakeryBellEmoji({ size = 20 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path d="M30 12 Q45 13 47 28 L49 44 L11 44 L13 28 Q15 13 30 12 Z"
        fill={H} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M18 30 Q30 26 42 30" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.35} />
      <Rect x="9" y="44" width="42" height="6" rx="3" fill="#C38F72" stroke={S} strokeWidth="2" />
      <Line x1="30" y1="50" x2="30" y2="56" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="30" cy="57" r="3" fill={S} opacity={0.7} />
      <Rect x="27" y="6" width="6" height="7" rx="3" fill="#A46F56" stroke={S} strokeWidth="1.5" />
      <Ellipse cx="21" cy="9" rx="7" ry="4" fill={P} stroke={S} strokeWidth="1.5" strokeLinejoin="round" transform="rotate(-22 21 9)" />
      <Ellipse cx="39" cy="9" rx="7" ry="4" fill={P} stroke={S} strokeWidth="1.5" strokeLinejoin="round" transform="rotate(22 39 9)" />
      <Ellipse cx="30" cy="9" rx="5" ry="3.5" fill="#CC6B7B" stroke={S} strokeWidth="1.5" />
      <Ellipse cx="18" cy="37" rx="5" ry="3" fill={R} opacity={0.5} />
      <Ellipse cx="42" cy="37" rx="5" ry="3" fill={R} opacity={0.5} />
    </Svg>
  );
}

// ── 🔥 Bread Flame ────────────────────────────────────────────────────────────
export function BakeryFlameEmoji({ size = 20 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path d="M30 6 Q37 13 39 21 Q43 17 41 11 Q51 19 49 31 Q49 45 30 54 Q11 45 11 31 Q9 19 19 11 Q17 17 21 21 Q23 13 30 6 Z"
        fill={H} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M30 14 Q36 20 37 28 Q40 23 38 17 Q46 25 44 36 Q43 46 30 50 Q17 46 16 36 Q14 25 22 17 Q20 23 23 28 Q24 20 30 14 Z"
        fill={B} stroke="none" />
      <Path d="M30 22 Q34 27 34 33 Q36 30 35 26 Q40 32 37 38 Q36 44 30 46 Q24 44 23 38 Q20 32 25 26 Q24 30 26 33 Q26 27 30 22 Z"
        fill={C} opacity={0.6} />
      <Ellipse cx="24" cy="36" rx="3" ry="3.5" fill={S} opacity={0.8} />
      <Circle cx="25" cy="35" r="1.2" fill="white" opacity={0.5} />
      <Ellipse cx="36" cy="36" rx="3" ry="3.5" fill={S} opacity={0.8} />
      <Circle cx="37" cy="35" r="1.2" fill="white" opacity={0.5} />
      <Path d="M24 41 Q30 46 36 41" stroke={S} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Ellipse cx="18" cy="40" rx="4" ry="2.5" fill={R} opacity={0.55} />
      <Ellipse cx="42" cy="40" rx="4" ry="2.5" fill={R} opacity={0.55} />
    </Svg>
  );
}

// ── ✓ Bread Check ─────────────────────────────────────────────────────────────
export function BakeryCheckEmoji({ size = 16 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* Checkmark with bread score texture */}
      <Path d="M6 20 L16 30 L34 10" stroke={G2} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M6 20 L16 30 L34 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.4} />
    </Svg>
  );
}

// ── 🍰 Bread Cake slice (for special moments) ─────────────────────────────────
export function BakeryCakeEmoji({ size = 20 }: Sz) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Plate */}
      <Ellipse cx="30" cy="52" rx="24" ry="6" fill="#F7DFC4" stroke={S} strokeWidth="2" />
      {/* Cake body */}
      <Path d="M8 42 L8 30 Q8 28 30 28 Q52 28 52 30 L52 42 Z" fill={B} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Frosting layer */}
      <Path d="M6 30 Q12 24 20 28 Q26 22 30 26 Q34 22 40 28 Q48 24 54 30 L52 30 Q48 26 40 30 Q34 24 30 28 Q26 24 20 30 Q12 26 8 30 Z"
        fill="white" stroke={S} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Candle */}
      <Rect x="28" y="14" width="4" height="14" rx="2" fill="#A6C8B4" stroke={S} strokeWidth="1.5" />
      {/* Flame */}
      <Path d="M30 8 Q33 11 31 15 Q29 11 30 8 Z" fill={H} stroke={S} strokeWidth="1" />
      {/* Stripe on cake */}
      <Line x1="8" y1="36" x2="52" y2="36" stroke={P} strokeWidth="3" strokeLinecap="round" opacity={0.5} />
      {/* Blush */}
      <Ellipse cx="16" cy="38" rx="5" ry="3" fill={R} opacity={0.4} />
      <Ellipse cx="44" cy="38" rx="5" ry="3" fill={R} opacity={0.4} />
    </Svg>
  );
}
