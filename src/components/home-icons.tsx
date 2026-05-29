import Svg, { Circle, Ellipse, Path, Rect, Line } from 'react-native-svg';

const S = '#7A5240'; // sketch stroke
const H = '#F0B44A'; // honey
const B = '#F4C976'; // butter
const C = '#FFF0CC'; // cream
const R = '#F6C8C2'; // rose
const P = '#E48A9A'; // pink

// ── Exam Book ────────────────────────────────────────────────────────────────
export function ExamBookIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Back page shadow */}
      <Rect x="15" y="11" width="36" height="44" rx="5" fill="#C38F72" opacity={0.35} />
      {/* Spine */}
      <Path d="M10 8 Q10 6 13 6 L18 6 L18 54 L13 54 Q10 54 10 52 Z"
        fill="#A46F56" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Spine hatching texture */}
      <Line x1="10" y1="18" x2="18" y2="14" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.2} />
      <Line x1="10" y1="28" x2="18" y2="24" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.2} />
      <Line x1="10" y1="38" x2="18" y2="34" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.2} />
      <Line x1="10" y1="48" x2="18" y2="44" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.2} />
      {/* Cover - slightly wobbly rect */}
      <Path d="M16 7 Q16 5 20 5 L48 5 Q52 5 52 8 L52 52 Q52 55 48 55 L20 55 Q16 55 16 52 Z"
        fill="#7A5240" stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Cover inner glow */}
      <Path d="M19 8 L49 8 L49 52 L19 52 Z" fill="#A46F56" opacity={0.3} rx="2" />
      {/* Bread loaf on cover */}
      <Path d="M22 32 Q30 22 38 32 L38 40 Q38 43 30 43 Q22 43 22 40 Z"
        fill={B} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M22 32 Q30 24 38 32" fill={H} stroke={S} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M25 36 Q30 34 35 36" stroke={S} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.5} />
      {/* Bookmark ribbon - slightly tilted */}
      <Path d="M42 6 L47 6 L47 24 L44.5 21 L42 24 Z"
        fill={P} stroke={S} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Page line details */}
      <Line x1="22" y1="46" x2="44" y2="46" stroke={C} strokeWidth="1.5" strokeLinecap="round" opacity={0.4} />
      <Line x1="22" y1="49" x2="38" y2="49" stroke={C} strokeWidth="1.5" strokeLinecap="round" opacity={0.3} />
    </Svg>
  );
}

// ── Exam Calendar ────────────────────────────────────────────────────────────
export function ExamCalendarIcon({ size = 48, day }: { size?: number; day?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Drop shadow */}
      <Rect x="7" y="13" width="50" height="44" rx="9" fill={S} opacity={0.12} />
      {/* Body */}
      <Path d="M5 11 Q5 9 8 9 L52 9 Q55 9 55 12 L55 52 Q55 55 52 55 L8 55 Q5 55 5 52 Z"
        fill={C} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Header */}
      <Path d="M5 12 Q5 9 8 9 L52 9 Q55 9 55 12 L55 28 L5 28 Z"
        fill={H} stroke="none" />
      {/* Header bread score */}
      <Path d="M12 18 Q30 13 48 18" stroke="#D29649" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.45} />
      {/* Spiral left */}
      <Circle cx="17" cy="9" r="4.5" fill="#A46F56" stroke={S} strokeWidth="1.5" />
      <Circle cx="17" cy="9" r="2.5" fill={C} />
      {/* Spiral right */}
      <Circle cx="43" cy="9" r="4.5" fill="#A46F56" stroke={S} strokeWidth="1.5} />
      <Circle cx="43" cy="9" r="2.5" fill={C} />
      {/* Grid lines - slightly imperfect */}
      <Line x1="5" y1="36" x2="55" y2="36" stroke="#F7DFC4" strokeWidth="1.2" />
      <Line x1="5" y1="44" x2="55" y2="44" stroke="#F7DFC4" strokeWidth="1.2" />
      <Line x1="23" y1="28" x2="23" y2="55" stroke="#F7DFC4" strokeWidth="1.2" />
      <Line x1="39" y1="28" x2="39" y2="55" stroke="#F7DFC4" strokeWidth="1.2" />
      {/* Highlight square for current day */}
      {day !== undefined && (
        <Rect x="25" y="30" width="12" height="10" rx="3" fill={H} opacity={0.5} />
      )}
      {/* Day dots */}
      <Circle cx="14" cy="32" r="2" fill="#C38F72" opacity={0.3} />
      <Circle cx="30" cy="32" r="2" fill="#C38F72" opacity={0.3} />
      <Circle cx="46" cy="32" r="2" fill="#C38F72" opacity={0.3} />
      <Circle cx="14" cy="40" r="2" fill="#C38F72" opacity={0.3} />
      <Circle cx="46" cy="40" r="2" fill="#C38F72" opacity={0.3} />
      <Circle cx="14" cy="50" r="2" fill="#C38F72" opacity={0.3} />
      <Circle cx="30" cy="50" r="2" fill="#C38F72" opacity={0.3} />
      <Circle cx="46" cy="50" r="2" fill="#C38F72" opacity={0.3} />
      {/* Sketch texture */}
      <Line x1="8" y1="52" x2="12" y2="48" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.1} />
    </Svg>
  );
}

// ── Reminder Bell ────────────────────────────────────────────────────────────
export function ReminderBellIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Bell body - slightly wobbly */}
      <Path d="M30 13 Q47 14 49 29 L51 45 L9 45 L11 29 Q13 14 30 13 Z"
        fill={H} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Highlight shine */}
      <Path d="M38 17 Q46 22 46 34" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity={0.35} />
      {/* Bread score */}
      <Path d="M17 32 Q30 27 43 32" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.4} />
      {/* Hatching */}
      <Line x1="14" y1="40" x2="18" y2="36" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.18} />
      <Line x1="42" y1="40" x2="46" y2="36" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.18} />
      {/* Rim */}
      <Path d="M7 45 Q7 51 30 51 Q53 51 53 45 L9 45 Z"
        fill="#C38F72" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Clapper */}
      <Line x1="30" y1="51" x2="30" y2="57" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="30" cy="57" r="3.5" fill={S} opacity={0.7} stroke={S} strokeWidth="1" />
      {/* Top knob */}
      <Path d="M27 7 Q27 5 30 5 Q33 5 33 7 L33 13 L27 13 Z"
        fill="#A46F56" stroke={S} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Bow left loop */}
      <Path d="M20 10 Q14 4 18 2 Q22 0 24 6 L21 10 Z"
        fill={P} stroke={S} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Bow right loop */}
      <Path d="M40 10 Q46 4 42 2 Q38 0 36 6 L39 10 Z"
        fill={P} stroke={S} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Bow center */}
      <Ellipse cx="30" cy="10" rx="5" ry="4" fill="#CC6B7B" stroke={S} strokeWidth="1.5" />
      {/* Sound waves - wobbly */}
      <Path d="M53 22 Q58 30 53 38" fill="none" stroke={H} strokeWidth="2.5" strokeLinecap="round" opacity={0.55} />
      <Path d="M7 22 Q2 30 7 38" fill="none" stroke={H} strokeWidth="2.5" strokeLinecap="round" opacity={0.55} />
      {/* Blush */}
      <Ellipse cx="17" cy="38" rx="5.5" ry="3" fill={R} opacity={0.55} />
      <Ellipse cx="43" cy="38" rx="5.5" ry="3" fill={R} opacity={0.55} />
    </Svg>
  );
}
