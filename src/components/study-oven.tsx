import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

// Cloud body = a solid core (covers behind the door/window) plus puffy bumps that
// make the silhouette read as a cloud. Drawn in two layers: a slightly larger
// peach backing, then the cream fill inset by BORDER, so peach peeks out as a
// clean outline around the whole union.
const BORDER = 10;
// Puffy bumps around the core. `cy` near the top edge → top puffs; mid `cy` →
// side puffs. Tuned to stay inside the 1032×838 viewBox so nothing clips.
const BUMPS = [
  { cx: 250, cy: 185, r: 135 },
  { cx: 440, cy: 160, r: 150 },
  { cx: 610, cy: 160, r: 150 },
  { cx: 800, cy: 185, r: 135 },
  { cx: 150, cy: 430, r: 150 },
  { cx: 882, cy: 430, r: 150 },
];
// Core rounded rect (peach backing); the cream core is this inset by BORDER. Sized
// to fully cover behind the door (x66–966, y178–782) and window.
const CORE = { x: 44, y: 150, w: 944, h: 664, rx: 140 };

/**
 * A cozy cloud-shaped bakery oven behind the study timer. Puffy cream cloud body
 * with two control knobs and a little preheat light up top, then a salmon door
 * with a handle and a cream window. The window is sized/placed so the timer text
 * overlay (left/right 11%, top 30%, bottom 12% of the wrapper) always lands
 * cleanly on it. Palette: cream #F7E4D1 / peach #E6C0A2 / salmon #F2A29B.
 */
export function StudyOven({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 1032 838" preserveAspectRatio="xMidYMid meet">
        {/* Cloud body — peach outline layer (core + bumps) */}
        <Rect x={CORE.x} y={CORE.y} width={CORE.w} height={CORE.h} rx={CORE.rx} fill="#E6C0A2" />
        {BUMPS.map((b) => (
          <Circle key={`o${b.cx}-${b.cy}`} cx={b.cx} cy={b.cy} r={b.r} fill="#E6C0A2" />
        ))}
        {/* Cloud body — cream fill, inset by BORDER so the peach reads as an outline */}
        <Rect
          x={CORE.x + BORDER}
          y={CORE.y + BORDER}
          width={CORE.w - BORDER * 2}
          height={CORE.h - BORDER * 2}
          rx={CORE.rx - BORDER}
          fill="#F7E4D1"
        />
        {BUMPS.map((b) => (
          <Circle key={`f${b.cx}-${b.cy}`} cx={b.cx} cy={b.cy} r={b.r - BORDER} fill="#F7E4D1" />
        ))}

        {/* Control knobs (with pointer ticks) — sit on the top puffs */}
        <Rect x={236} y={58} width={9} height={30} rx={4.5} fill="#FBEFE0" />
        <Circle cx={240} cy={104} r={50} fill="#F2A29B" stroke="#E58F88" strokeWidth={6} />
        <Circle cx={240} cy={104} r={22} fill="#FBEFE0" />
        <Circle cx={240} cy={104} r={8} fill="#E58F88" />
        <Rect x={787} y={58} width={9} height={30} rx={4.5} fill="#FBEFE0" />
        <Circle cx={792} cy={104} r={50} fill="#F2A29B" stroke="#E58F88" strokeWidth={6} />
        <Circle cx={792} cy={104} r={22} fill="#FBEFE0" />
        <Circle cx={792} cy={104} r={8} fill="#E58F88" />
        {/* Preheat light */}
        <Circle cx={516} cy={104} r={20} fill="#F4C77A" stroke="#E3A94F" strokeWidth={5} />
        <Circle cx={509} cy={97} r={6} fill="#FFF3DA" />

        {/* Door */}
        <Rect x={66} y={178} width={900} height={604} rx={62} fill="#F2A29B" />
        <Rect x={80} y={192} width={872} height={576} rx={54} fill="none" stroke="#F7B8B0" strokeWidth={4} />
        {/* Door handle */}
        <Rect x={300} y={198} width={432} height={26} rx={13} fill="#FBEFE0" stroke="#E6C0A2" strokeWidth={3} />

        {/* Window (timer sits here) */}
        <Rect x={108} y={238} width={816} height={516} rx={46} fill="#FCF6E4" stroke="#F6D8C0" strokeWidth={9} />
        <Rect x={128} y={258} width={776} height={476} rx={36} fill="none" stroke="#F0E0C4" strokeWidth={5} />
        {/* Glass gloss */}
        <Rect x={150} y={270} width={256} height={56} rx={28} fill="#FFFFFF" opacity={0.4} />
      </Svg>
    </View>
  );
}
