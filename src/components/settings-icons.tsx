import Svg, { Circle, Ellipse, Path, Rect, Line } from 'react-native-svg';

// Shared sketchy bakery palette
const S = '#7A5240'; // sketch stroke
const H = '#F0B44A'; // honey
const B = '#F4C976'; // butter
const C = '#FFF0CC'; // cream
const R = '#F6C8C2'; // rose
const M = '#A6C8B4'; // mint

type IconProps = { size?: number };

// ── 👤 Account → Baker's chef hat ─────────────────────────────────────────────
export function BakerHatIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* band */}
      <Path d="M14 30 L34 30 L33 40 Q33 42 31 42 L17 42 Q15 42 15 40 Z"
        fill={C} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* puffy top */}
      <Path d="M14 32 Q6 32 6 24 Q6 18 12 17 Q12 9 20 10 Q24 5 30 9 Q38 8 38 16 Q44 18 43 25 Q43 32 34 32 Z"
        fill="#FFFDF7" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* band stitch */}
      <Path d="M16 35 Q24 37 32 35" stroke={S} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.4} />
      {/* fold hints */}
      <Path d="M17 30 Q17 23 19 19" stroke={S} strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.22} />
      <Path d="M31 30 Q31 23 29 19" stroke={S} strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.22} />
    </Svg>
  );
}

// ── 🚪 Sign out → Door with exit arrow ────────────────────────────────────────
export function DoorOutIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* door frame */}
      <Rect x="6" y="8" width="20" height="34" rx="3" fill={B} stroke={S} strokeWidth="2" />
      {/* inner panel */}
      <Rect x="9" y="11" width="14" height="28" rx="2" fill={H} stroke={S} strokeWidth="1.2" opacity={0.6} />
      {/* knob */}
      <Circle cx="20" cy="25" r="2" fill={S} />
      {/* exit arrow */}
      <Line x1="29" y1="25" x2="43" y2="25" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M38 20 L43 25 L38 30" stroke={S} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// ── ✨ Plus → Sparkle star ─────────────────────────────────────────────────────
export function SparkleStarIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M22 5 Q24 18 37 20 Q24 22 22 35 Q20 22 7 20 Q20 18 22 5 Z"
        fill={H} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M37 29 Q38 34 43 35 Q38 36 37 41 Q36 36 31 35 Q36 34 37 29 Z"
        fill={B} stroke={S} strokeWidth="1.2" strokeLinejoin="round" />
      <Circle cx="18" cy="15" r="1.6" fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
}

// ── 🧪 Test toggle → Measuring cup ────────────────────────────────────────────
export function MeasuringCupIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* cup body */}
      <Path d="M14 14 L34 14 L31 40 Q31 42 28 42 L20 42 Q17 42 17 40 Z"
        fill={C} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* batter */}
      <Path d="M16 26 L32 26 L30.5 39 Q30.5 41 28 41 L20 41 Q17.5 41 17.5 39 Z" fill={H} />
      {/* measure ticks */}
      <Line x1="28" y1="20" x2="32" y2="20" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.5} />
      <Line x1="29" y1="24" x2="32" y2="24" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.5} />
      {/* spout */}
      <Path d="M14 16 Q10 16 10 19" stroke={S} strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* handle */}
      <Path d="M34 18 Q40 20 38 28" stroke={S} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Circle cx="22" cy="31" r="1.5" fill="#FFFFFF" opacity={0.6} />
    </Svg>
  );
}

// ── 🐾 Companion → Bear paw ───────────────────────────────────────────────────
export function PawIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* main pad */}
      <Path d="M24 24 Q34 24 34 33 Q34 40 24 40 Q14 40 14 33 Q14 24 24 24 Z"
        fill={B} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* toes */}
      <Ellipse cx="15" cy="20" rx="3.5" ry="4.5" fill={B} stroke={S} strokeWidth="1.8" />
      <Ellipse cx="21" cy="15" rx="3.5" ry="4.8" fill={B} stroke={S} strokeWidth="1.8" />
      <Ellipse cx="28" cy="15" rx="3.5" ry="4.8" fill={B} stroke={S} strokeWidth="1.8" />
      <Ellipse cx="34" cy="20" rx="3.5" ry="4.5" fill={B} stroke={S} strokeWidth="1.8" />
      {/* pad heart */}
      <Ellipse cx="24" cy="32" rx="4" ry="3.5" fill={R} opacity={0.7} />
    </Svg>
  );
}

// ── ⏱️ Timer → Kitchen timer ──────────────────────────────────────────────────
export function KitchenTimerIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* body */}
      <Circle cx="24" cy="28" r="14" fill={H} stroke={S} strokeWidth="2.2" />
      {/* face */}
      <Circle cx="24" cy="28" r="9.5" fill={C} stroke={S} strokeWidth="1.5" />
      {/* hands */}
      <Line x1="24" y1="28" x2="24" y2="21" stroke={S} strokeWidth="2" strokeLinecap="round" />
      <Line x1="24" y1="28" x2="29" y2="30" stroke={S} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="24" cy="28" r="1.6" fill={S} />
      {/* top knob */}
      <Rect x="21" y="9" width="6" height="5" rx="2" fill="#A46F56" stroke={S} strokeWidth="1.5" />
      {/* ticks */}
      <Line x1="24" y1="19" x2="24" y2="20.5" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.5} />
      <Line x1="33" y1="28" x2="31.5" y2="28" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

// ── 📚 Subjects → Stack of recipe books ───────────────────────────────────────
export function RecipeBooksIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="9" y="30" width="30" height="9" rx="2" fill={H} stroke={S} strokeWidth="2" transform="rotate(-3 24 34)" />
      <Rect x="10" y="21" width="28" height="9" rx="2" fill={M} stroke={S} strokeWidth="2" transform="rotate(2 24 25)" />
      <Rect x="12" y="12" width="24" height="9" rx="2" fill={R} stroke={S} strokeWidth="2" transform="rotate(-2 24 16)" />
      <Line x1="15" y1="33" x2="15" y2="37" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.4} />
      <Line x1="16" y1="24" x2="16" y2="28" stroke={S} strokeWidth="1.2" strokeLinecap="round" opacity={0.4} />
    </Svg>
  );
}

// ── 🎵 Ambience → Music note ──────────────────────────────────────────────────
export function MusicNoteIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Line x1="20" y1="12" x2="20" y2="33" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="34" y1="9" x2="34" y2="29" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M20 12 L34 9 L34 14 L20 17 Z" fill={S} />
      <Ellipse cx="16" cy="33" rx="5" ry="4" fill={H} stroke={S} strokeWidth="2" transform="rotate(-18 16 33)" />
      <Ellipse cx="30" cy="29" rx="5" ry="4" fill={H} stroke={S} strokeWidth="2" transform="rotate(-18 30 29)" />
    </Svg>
  );
}

// ── 🔔 Reminder → Bell ────────────────────────────────────────────────────────
export function BellIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 8 Q35 9 36 22 L37 32 L11 32 L12 22 Q13 9 24 8 Z"
        fill={H} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M9 32 Q9 36 24 36 Q39 36 39 32 Z" fill="#C38F72" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="24" cy="39" r="2.5" fill={S} />
      <Path d="M22 6 Q22 4 24 4 Q26 4 26 6 L26 8 L22 8 Z" fill="#A46F56" stroke={S} strokeWidth="1.5" />
      <Path d="M16 18 Q15 24 16 28" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
  );
}

// ── ⚙️ Reminder settings → Gear ───────────────────────────────────────────────
export function GearIcon({ size = 32 }: IconProps) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {teeth.map((a) => (
        <Rect key={a} x="21.5" y="6" width="5" height="8" rx="1.5" fill={H} stroke={S} strokeWidth="1.5" transform={`rotate(${a} 24 24)`} />
      ))}
      <Circle cx="24" cy="24" r="12" fill={H} stroke={S} strokeWidth="2" />
      <Circle cx="24" cy="24" r="5" fill={C} stroke={S} strokeWidth="2" />
    </Svg>
  );
}

// ── 📊 Progress → Bar chart ───────────────────────────────────────────────────
export function ChartIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M10 10 L10 38 L40 38" stroke={S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x="15" y="26" width="6" height="12" rx="2" fill={M} stroke={S} strokeWidth="1.5" />
      <Rect x="24" y="20" width="6" height="18" rx="2" fill={H} stroke={S} strokeWidth="1.5" />
      <Rect x="33" y="14" width="6" height="24" rx="2" fill={R} stroke={S} strokeWidth="1.5" />
    </Svg>
  );
}

// ── 💬 Feedback → Chat bubble ─────────────────────────────────────────────────
export function ChatBubbleIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M9 12 Q9 9 12 9 L36 9 Q39 9 39 12 L39 28 Q39 31 36 31 L20 31 L13 38 L14 31 L12 31 Q9 31 9 28 Z"
        fill={H} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="18" cy="20" r="2" fill={S} />
      <Circle cx="24" cy="20" r="2" fill={S} />
      <Circle cx="30" cy="20" r="2" fill={S} />
    </Svg>
  );
}

// ── ℹ️ Version → Info badge ────────────────────────────────────────────────────
export function InfoIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="24" cy="24" r="15" fill={B} stroke={S} strokeWidth="2" />
      <Circle cx="24" cy="16" r="2.2" fill={S} />
      <Line x1="24" y1="22" x2="24" y2="32" stroke={S} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}
