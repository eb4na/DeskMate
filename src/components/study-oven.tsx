import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

// A hanging bakery sign that holds the study timer — it reads as "the bakery's
// current baking timer" suspended from the top of the screen, rather than a random
// floating oven. Because it hangs (two ropes to a hook) and has a soft glow, the
// brain accepts it floating over ANY room background (beach, snow, japanese, royal,
// bakery). Drawn entirely with shapes so it scales crisply and is easy to reskin
// later (royal clock, wooden plaque, lantern, hologram) while keeping this layout.
//
// The recessed cream "glass" panel is sized/placed so the timer overlay in
// study-room-view (left/right 17%, top 36%, bottom 18% of the wrapper) always lands
// cleanly inside it. Palette: cream #F7E4D1 / peach #E6C0A2 / salmon #F2A29B /
// rope #B98E5E / glow #F4C77A. ViewBox 1032×838 (matches timerWrap's aspectRatio).

// Two cream vent slits flanking the glow, centered horizontally on 516.
const VENTS = [300, 394, 560, 654]; // left x of each 78-wide slit
// Rope attach eyelets (frame top corners). The ropes themselves are NOT drawn here —
// they're rendered in study-room-view as a full-height overlay so they hang from the
// real top of the screen down to these eyelets (this SVG is only as tall as the sign
// card, so ropes drawn here would dead-end in midair just above the card).
const EYELET = { left: 262, right: 770, y: 196 };
export const EYELET_FRAC = { left: EYELET.left / 1032, right: EYELET.right / 1032, y: EYELET.y / 838 };

export function StudyOven({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 1032 838" preserveAspectRatio="xMidYMid meet">
        {/* ── Soft drop shadow (two offset tints) so the cream sign stays legible
            over bright rooms like snow / beach ── */}
        <Rect x={114} y={204} width={804} height={584} rx={98} fill="#6E4A38" opacity={0.08} />
        <Rect x={117} y={196} width={798} height={584} rx={95} fill="#6E4A38" opacity={0.12} />

        {/* ── Sign body: peach frame + cream enamel inset (oven-style two-layer) ── */}
        <Rect x={120} y={188} width={792} height={584} rx={92} fill="#E6C0A2" />
        <Rect x={134} y={202} width={764} height={556} rx={78} fill="#F7E4D1" />

        {/* Eyelets where the ropes meet the frame */}
        {[EYELET.left, EYELET.right].map((x) => (
          <Circle key={`eye${x}`} cx={x} cy={EYELET.y} r={16} fill="#F7E4D1" stroke="#C9A06E" strokeWidth={6} />
        ))}
        {[EYELET.left, EYELET.right].map((x) => (
          <Circle key={`eyehole${x}`} cx={x} cy={EYELET.y} r={5} fill="#B98E5E" />
        ))}

        {/* Top vent slits */}
        {VENTS.map((x) => (
          <Rect key={`vent${x}`} x={x} y={242} width={78} height={15} rx={7.5} fill="#E0B596" />
        ))}
        {/* Warm "now baking" glow light, centered between the vents */}
        <Circle cx={516} cy={250} r={24} fill="#F7C97A" opacity={0.35} />
        <Circle cx={516} cy={250} r={15} fill="#F4C77A" stroke="#E3A94F" strokeWidth={4} />
        <Circle cx={510} cy={244} r={5} fill="#FFF3DA" />

        {/* ── Recessed glass screen (timer text overlays here) ── */}
        <Rect x={180} y={300} width={672} height={388} rx={54} fill="#FCF6E4" stroke="#F6D8C0" strokeWidth={9} />
        <Rect x={198} y={318} width={636} height={352} rx={40} fill="none" stroke="#F0E0C4" strokeWidth={5} />
        {/* Glass gloss */}
        <Rect x={214} y={330} width={210} height={44} rx={22} fill="#FFFFFF" opacity={0.4} />

        {/* Little appliance handle plate along the bottom of the sign */}
        <Rect x={396} y={714} width={240} height={20} rx={10} fill="#FBEFE0" stroke="#E6C0A2" strokeWidth={3} />
      </Svg>
    </View>
  );
}
