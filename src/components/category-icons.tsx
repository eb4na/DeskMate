import Svg, { Circle, Ellipse, Path, Rect, Line } from 'react-native-svg';

const S = '#7A5240';
const H = '#F0B44A';
const B = '#F4C976';
const C = '#FFF0CC';
const R = '#F6C8C2';
const P = '#E48A9A';
const M = '#A6C8B4';

// Decoration → sketchy bread cottage
export function DecoIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Chimney */}
      <Rect x="38" y="15" width="6" height="13" rx="2" fill="#A46F56" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Smoke puffs */}
      <Circle cx="41" cy="12" r="3.5" fill={C} stroke={S} strokeWidth="1.5} opacity={0.7} />
      <Circle cx="43" cy="8" r="2.5" fill={C} stroke={S} strokeWidth="1.2} opacity={0.45} />
      {/* Roof - bread loaf arch, wobbly */}
      <Path d="M7 31 Q6 12 30 11 Q54 12 53 31 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Roof highlight/score */}
      <Path d="M14 28 Q30 18 46 28" stroke={S} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity={0.45} />
      <Path d="M18 24 Q30 16 42 24" stroke={S} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.25} />
      {/* Roof texture hatching */}
      <Line x1="10" y1="28" x2="13" y2="24" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.18} />
      <Line x1="47" y1="28" x2="50" y2="24" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.18} />
      {/* House body */}
      <Path d="M11 31 Q11 29 14 29 L46 29 Q49 29 49 31 L49 54 Q49 57 46 57 L14 57 Q11 57 11 54 Z"
        fill={C} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Left window */}
      <Rect x="14" y="34" width="10" height="9" rx="3" fill={B} stroke={S} strokeWidth="1.8" />
      <Line x1="19" y1="34" x2="19" y2="43" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.5} />
      <Line x1="14" y1="38.5" x2="24" y2="38.5" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.5} />
      {/* Door */}
      <Path d="M26 43 Q26 38 30 38 Q34 38 34 43 L34 57 L26 57 Z"
        fill="#C38F72" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="32" cy="47" r="1.5" fill={H} />
      {/* Right window */}
      <Rect x="36" y="34" width="10" height="9" rx="3" fill={B} stroke={S} strokeWidth="1.8" />
      <Line x1="41" y1="34" x2="41" y2="43" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.5} />
      <Line x1="36" y1="38.5" x2="46" y2="38.5" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.5} />
      {/* Ground shadow */}
      <Ellipse cx="30" cy="57" rx="22" ry="3" fill={S} opacity={0.1} />
    </Svg>
  );
}

// Outfit → sketchy dress on hanger
export function OutfitIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Hanger hook */}
      <Path d="M30 7 Q35 7 35 12 Q35 17 30 17 Q19 17 11 27"
        fill="none" stroke={S} strokeWidth="3" strokeLinecap="round" />
      <Path d="M30 17 Q41 17 49 27"
        fill="none" stroke={S} strokeWidth="3" strokeLinecap="round" />
      {/* Hanger bar */}
      <Path d="M11 27 Q30 24 49 27" fill="none" stroke={S} strokeWidth="3" strokeLinecap="round" />
      {/* Left sleeve */}
      <Path d="M11 27 L5 42 Q5 44 9 45 L17 43 L19 31 Z"
        fill={B} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M12 28 L8 38" stroke={H} strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.4} />
      {/* Right sleeve */}
      <Path d="M49 27 L55 42 Q55 44 51 45 L43 43 L41 31 Z"
        fill={B} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M48 28 L52 38" stroke={H} strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.4} />
      {/* Dress body */}
      <Path d="M19 31 L14 57 L46 57 L41 31 Z"
        fill={B} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Dress texture hatching */}
      <Line x1="20" y1="40" x2="24" y2="36" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.18} />
      <Line x1="36" y1="40" x2="40" y2="36" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.18} />
      {/* Collar V */}
      <Path d="M22 31 L30 46 L38 31"
        fill={C} stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Belt/sash */}
      <Path d="M14 44 Q14 42 18 42 L42 42 Q46 42 46 44 L46 50 Q46 52 42 52 L18 52 Q14 52 14 50 Z"
        fill={P} stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Bow on belt */}
      <Path d="M23 46 Q27 42 30 46 Q33 42 37 46 Q33 50 30 46 Q27 50 23 46 Z"
        fill="#CC6B7B" stroke={S} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Blush on dress */}
      <Ellipse cx="19" cy="52" rx="4" ry="2.5" fill={R} opacity={0.5} />
    </Svg>
  );
}

// Theme → sketchy art palette
export function ThemeIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Palette body - irregular blob shape */}
      <Path d="M9 33 Q7 12 30 9 Q51 9 53 28 Q56 44 40 49 Q34 52 32 45 Q30 38 22 41 Q9 44 9 33 Z"
        fill={C} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Palette texture */}
      <Line x1="12" y1="38" x2="16" y2="34" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.15} />
      <Line x1="44" y1="14" x2="48" y2="18" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.15} />
      {/* Thumb hole */}
      <Ellipse cx="38" cy="43" rx="7" ry="6" fill="#FFF8F1" stroke={S} strokeWidth="2" />
      {/* Paint dabs - slightly irregular circles */}
      <Circle cx="18" cy="18" r="7" fill={H} stroke={S} strokeWidth="2" />
      <Circle cx="18" cy="18" r="7" fill={B} opacity={0.4} />
      <Circle cx="18" cy="18" r="3" fill="white" opacity={0.3} />
      <Circle cx="31" cy="13" r="7" fill={P} stroke={S} strokeWidth="2" />
      <Circle cx="31" cy="13" r="3" fill="white" opacity={0.3} />
      <Circle cx="43" cy="20" r="7" fill={M} stroke={S} strokeWidth="2" />
      <Circle cx="43" cy="20" r="3" fill="white" opacity={0.3} />
      <Circle cx="46" cy="33" r="7" fill={B} stroke={S} strokeWidth="2} />
      <Circle cx="46" cy="33" r="3" fill="white" opacity={0.3} />
      {/* Paintbrush - wobbly handle */}
      <Path d="M4 54 Q6 50 10 48 L34 26 Q36 24 38 25 L36 29 L12 50 Z"
        fill="#A46F56" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Brush tip */}
      <Path d="M34 26 Q38 22 42 26 Q40 30 36 30 Q34 28 34 26 Z"
        fill={B} stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Ferrule */}
      <Rect x="32" y="25" width="6" height="3" rx="1" fill={S} opacity={0.6} transform="rotate(-45 32 25)" />
    </Svg>
  );
}

// Pose → sketchy sparkle wand
export function PoseIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Wand stick - slightly curved */}
      <Path d="M13 51 Q24 38 38 22"
        fill="none" stroke={S} strokeWidth="4" strokeLinecap="round" />
      <Path d="M14 50 Q25 37 39 21"
        fill="none" stroke="#C38F72" strokeWidth="2" strokeLinecap="round" opacity={0.5} />
      {/* Star on wand tip - wobbly */}
      <Path d="M38 6 L40.5 14 L49 14 L42 19 L45 27 L38 22 L31 27 L34 19 L27 14 L35.5 14 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      <Path d="M38 9 L40 15 L47 15 L41 19 L44 25 L38 22 L32 25 L35 19 L29 15 L36 15 Z"
        fill={H} opacity={0.5} stroke="none" />
      {/* Sketch texture on star */}
      <Line x1="34" y1="14" x2="38" y2="10" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.25} />
      {/* Sparkle cross 1 */}
      <Line x1="52" y1="13" x2="52" y2="23" stroke={H} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="47" y1="18" x2="57" y2="18" stroke={H} strokeWidth="2.5" strokeLinecap="round" />
      {/* Sparkle cross 2 */}
      <Line x1="7" y1="42" x2="7" y2="49" stroke={P} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3.5" y1="45.5" x2="10.5" y2="45.5" stroke={P} strokeWidth="2" strokeLinecap="round" />
      {/* Sparkle dots */}
      <Circle cx="53" cy="36" r="3.5" fill={H} stroke={S} strokeWidth="1.5" />
      <Circle cx="53" cy="36" r="1.5" fill="white" opacity={0.5} />
      <Circle cx="20" cy="14" r="3" fill={P} stroke={S} strokeWidth="1.5" />
      <Circle cx="48" cy="48" r="2.5" fill={M} stroke={S} strokeWidth="1.2" />
      <Circle cx="10" cy="28" r="2" fill={B} stroke={S} strokeWidth="1.2" />
      {/* Ribbon on wand bottom */}
      <Path d="M13 51 Q16 47 20 51 Q16 55 13 51 Z"
        fill={P} stroke={S} strokeWidth="1.5" strokeLinejoin="round" />
    </Svg>
  );
}

// Game → sketchy bread controller
export function GameIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Controller body - bread loaf shape */}
      <Path d="M7 30 Q6 18 20 16 L40 16 Q54 18 53 30 Q55 44 46 49 Q40 53 32 51 Q26 53 20 51 Q9 47 7 30 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Top arch highlight */}
      <Path d="M11 28 Q11 18 22 17 L38 17 Q49 18 49 28"
        fill={H} opacity={0.3} stroke="none" />
      {/* Bread score texture */}
      <Path d="M14 28 Q30 24 46 28" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.35} />
      {/* Hatching */}
      <Line x1="10" y1="36" x2="14" y2="32" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.18} />
      <Line x1="46" y1="36" x2="50" y2="32" stroke={S} strokeWidth="0.9" strokeLinecap="round" opacity={0.18} />
      {/* D-pad */}
      <Rect x="13" y="27" width="7" height="4" rx="1.5" fill={S} opacity={0.6} />
      <Rect x="15" y="24" width="4" height="7" rx="1.5" fill={S} opacity={0.6} />
      <Circle cx="17" cy="29.5" r="2.5" fill="#C38F72" stroke={S} strokeWidth="1" />
      {/* Buttons - slightly offset circles */}
      <Circle cx="42" cy="25" r="5" fill={P} stroke={S} strokeWidth="2" />
      <Circle cx="42" cy="25" r="2.5" fill="#CC6B7B" opacity={0.5} />
      <Circle cx="47" cy="32" r="5" fill={M} stroke={S} strokeWidth="2} />
      <Circle cx="47" cy="32" r="2.5" fill="#84A89C" opacity={0.5} />
      <Circle cx="37" cy="32" r="5" fill={H} stroke={S} strokeWidth="2" />
      <Circle cx="37" cy="32" r="2.5" fill="#D29649" opacity={0.5} />
      <Circle cx="42" cy="39" r="5" fill={C} stroke={S} strokeWidth="2" />
      <Circle cx="42" cy="39" r="2.5" fill="#E8D8A0" opacity={0.5} />
      {/* Center bread logo */}
      <Ellipse cx="28" cy="32" rx="6" ry="6" fill={C} stroke={S} strokeWidth="1.8" />
      <Path d="M24 32 Q28 29 32 32" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.6} />
      {/* Grips */}
      <Ellipse cx="19" cy="47" rx="9" ry="6" fill={H} stroke={S} strokeWidth="2} />
      <Ellipse cx="41" cy="47" rx="9" ry="6" fill={H} stroke={S} strokeWidth="2" />
      {/* Blush on grips */}
      <Ellipse cx="19" cy="47" rx="5" ry="3" fill={R} opacity={0.5} />
      <Ellipse cx="41" cy="47" rx="5" ry="3" fill={R} opacity={0.5} />
    </Svg>
  );
}

// Reminder → sketchy bread bell
export function ReminderIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Bell body */}
      <Path d="M30 13 Q47 14 49 29 L51 45 L9 45 L11 29 Q13 14 30 13 Z"
        fill={H} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Shine */}
      <Path d="M38 17 Q46 22 46 34" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity={0.35} />
      {/* Bread score */}
      <Path d="M17 32 Q30 27 43 32" stroke={S} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity={0.45} />
      {/* Texture */}
      <Line x1="13" y1="40" x2="17" y2="36" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.18} />
      <Line x1="43" y1="40" x2="47" y2="36" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.18} />
      {/* Rim */}
      <Path d="M7 45 Q8 52 30 52 Q52 52 53 45 Z"
        fill="#C38F72" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Clapper */}
      <Line x1="30" y1="52" x2="30" y2="58" stroke={S} strokeWidth="3" strokeLinecap="round" />
      <Circle cx="30" cy="58" r="3.5" fill={S} opacity={0.7} />
      {/* Top knob */}
      <Path d="M27 7 Q27 4 30 4 Q33 4 33 7 L33 13 L27 13 Z"
        fill="#A46F56" stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Bow */}
      <Path d="M20 10 Q13 3 18 1 Q23 -1 25 7 L21 10 Z"
        fill={P} stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      <Path d="M40 10 Q47 3 42 1 Q37 -1 35 7 L39 10 Z"
        fill={P} stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      <Ellipse cx="30" cy="10" rx="5.5" ry="4" fill="#CC6B7B" stroke={S} strokeWidth="1.8" />
      {/* Sound waves */}
      <Path d="M53 22 Q58 30 53 38" fill="none" stroke={H} strokeWidth="2.5" strokeLinecap="round" opacity={0.6} />
      <Path d="M57 18 Q64 30 57 42" fill="none" stroke={H} strokeWidth="1.8" strokeLinecap="round" opacity={0.3} />
      <Path d="M7 22 Q2 30 7 38" fill="none" stroke={H} strokeWidth="2.5" strokeLinecap="round" opacity={0.6} />
      <Path d="M3 18 Q-4 30 3 42" fill="none" stroke={H} strokeWidth="1.8" strokeLinecap="round" opacity={0.3} />
      {/* Blush */}
      <Ellipse cx="17" cy="38" rx="6" ry="3.5" fill={R} opacity={0.55} />
      <Ellipse cx="43" cy="38" rx="6" ry="3.5" fill={R} opacity={0.55} />
    </Svg>
  );
}
