// Code-drawn (react-native-svg) envelope art for the Mailbox, in the bakery style.
// Two pieces: a closed envelope for the inbox list (title only), and the opened
// flap/lid that sits above the "letter" card in the open-mail view.
import Svg, { Path, Rect } from 'react-native-svg';

const CREAM = '#FFF3E8';
const FLAP = '#FBE6D6';
const EDGE = '#EBB89F';
const SEAL = '#E48A9A';

// A little heart wax-seal, centered at (cx, cy).
function heart(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy + r * 0.7} C ${cx - r * 1.1} ${cy - r * 0.4}, ${cx - r * 0.85} ${cy - r * 1.2}, ${cx} ${cy - r * 0.55} C ${cx + r * 0.85} ${cy - r * 1.2}, ${cx + r * 1.1} ${cy - r * 0.4}, ${cx} ${cy + r * 0.7} Z`;
}

/** Closed envelope (inbox list). `sealed` draws the heart wax-seal (unread). */
export function EnvelopeClosed({ width = 64, sealed = true }: { width?: number; sealed?: boolean }) {
  const h = (width * 66) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 100 66">
      <Rect x={2.5} y={6} width={95} height={57} rx={9} fill={CREAM} stroke={EDGE} strokeWidth={2.5} />
      {/* bottom folds */}
      <Path d="M4 61 L50 33 L96 61" fill="none" stroke={EDGE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* closed top flap */}
      <Path d="M4 9 L50 39 L96 9" fill={FLAP} stroke={EDGE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {sealed && <Path d={heart(50, 30, 8)} fill={SEAL} stroke="#FFFFFF" strokeWidth={1.6} strokeLinejoin="round" />}
    </Svg>
  );
}

/** The opened lid that sits above the letter card in the open-mail view. */
export function EnvelopeOpenTop({ width = 220 }: { width?: number }) {
  const h = (width * 58) / 120;
  return (
    <Svg width={width} height={h} viewBox="0 0 120 58">
      {/* envelope top rim */}
      <Path d="M8 54 L8 50 L112 50 L112 54" fill="none" stroke={EDGE} strokeWidth={3} strokeLinecap="round" />
      {/* opened flap (lid pointing up) */}
      <Path d="M10 51 L60 5 L110 51 Z" fill={FLAP} stroke={EDGE} strokeWidth={3} strokeLinejoin="round" />
      <Path d={heart(60, 26, 8)} fill={SEAL} stroke="#FFFFFF" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
