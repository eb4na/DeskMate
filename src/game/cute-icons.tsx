// Hand-drawn cute SVG game pieces (no emoji, no image assets) shared by the
// Connect 4, Tic-Tac-Toe and Memory break games.
import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';

const FACE = '#6B4A3A';
const BLUSH = '#F7A7B8';

function Face({ y = 16 }: { y?: number }) {
  return (
    <G>
      <Circle cx={12} cy={y} r={1.7} fill={FACE} />
      <Circle cx={20} cy={y} r={1.7} fill={FACE} />
      <Path d={`M13.4 ${y + 3.4} Q16 ${y + 5.6} 18.6 ${y + 3.4}`} stroke={FACE} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <Circle cx={8.6} cy={y + 2.6} r={1.9} fill={BLUSH} opacity={0.7} />
      <Circle cx={23.4} cy={y + 2.6} r={1.9} fill={BLUSH} opacity={0.7} />
    </G>
  );
}

/** A round disc with a kawaii face — Connect 4 token. */
export function CuteDisc({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={15} fill={color} />
      <Ellipse cx={11} cy={9.5} rx={4.2} ry={2.8} fill="#FFFFFF" opacity={0.35} />
      <Face />
    </Svg>
  );
}

/** Pink heart with a face — Tic-Tac-Toe player 1. */
export function HeartToken({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M16 27 C5 19 4 11 9 8 C13 5.5 16 9 16 11 C16 9 19 5.5 23 8 C28 11 27 19 16 27 Z"
        fill="#F286A0"
      />
      <Face y={15} />
    </Svg>
  );
}

/** Yellow star with a face — Tic-Tac-Toe player 2. */
export function StarToken({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Polygon
        points="16,3 20,12 30,12.5 22,19 25,29 16,23 7,29 10,19 2,12.5 12,12"
        fill="#F2B33C"
        stroke="#E0A02A"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <Face y={16} />
    </Svg>
  );
}

// ── Memory match icons — 8 distinct cute shapes ──────────────────────────────
function Heart({ c }: { c: string }) {
  return <Path d="M16 27 C5 19 4 11 9 8 C13 5.5 16 9 16 11 C16 9 19 5.5 23 8 C28 11 27 19 16 27 Z" fill={c} />;
}
function Star({ c }: { c: string }) {
  return <Polygon points="16,3 20,12 30,12.5 22,19 25,29 16,23 7,29 10,19 2,12.5 12,12" fill={c} />;
}
function Flower({ c }: { c: string }) {
  return (
    <G>
      {[0, 72, 144, 216, 288].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Circle key={a} cx={16 + 7 * Math.sin(r)} cy={16 - 7 * Math.cos(r)} r={5} fill={c} />;
      })}
      <Circle cx={16} cy={16} r={4} fill="#FFF3C4" />
    </G>
  );
}
function Strawberry({ c }: { c: string }) {
  return (
    <G>
      <Path d="M16 7 C9 7 7 12 7 16 C7 23 13 28 16 28 C19 28 25 23 25 16 C25 12 23 7 16 7 Z" fill={c} />
      <Path d="M11 8 L16 12 L21 8 C19 6 13 6 11 8 Z" fill="#8BCF8B" />
      <Circle cx={12} cy={16} r={1} fill="#FFF3C4" />
      <Circle cx={19} cy={15} r={1} fill="#FFF3C4" />
      <Circle cx={15} cy={21} r={1} fill="#FFF3C4" />
    </G>
  );
}
function Cherry({ c }: { c: string }) {
  return (
    <G>
      <Path d="M14 8 C20 9 24 6 25 5" stroke="#8BCF8B" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M16 8 C12 13 9 14 11 9" stroke="#8BCF8B" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Circle cx={11} cy={21} r={6} fill={c} />
      <Circle cx={21} cy={20} r={6} fill={c} />
    </G>
  );
}
function Moon({ c }: { c: string }) {
  return <Path d="M22 6 A11 11 0 1 0 22 26 A8.5 8.5 0 1 1 22 6 Z" fill={c} />;
}
function Drop({ c }: { c: string }) {
  return <Path d="M16 4 C16 4 7 16 7 21 A9 9 0 0 0 25 21 C25 16 16 4 16 4 Z" fill={c} />;
}
function Diamond({ c }: { c: string }) {
  return <Polygon points="16,4 28,16 16,28 4,16" fill={c} />;
}

export const MEMORY_ICON_COUNT = 8;
const MEMORY_COLORS = ['#F286A0', '#F2B33C', '#F4A8C0', '#E05C3A', '#CC6B7B', '#F4C976', '#7FCFC4', '#B9A7E0'];

export function MemoryIcon({ index, size }: { index: number; size: number }) {
  const c = MEMORY_COLORS[index % MEMORY_COLORS.length];
  const shapes = [Heart, Star, Flower, Strawberry, Cherry, Moon, Drop, Diamond];
  const Shape = shapes[index % shapes.length];
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Shape c={c} />
    </Svg>
  );
}
