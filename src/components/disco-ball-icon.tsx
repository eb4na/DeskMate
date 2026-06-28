import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

type Props = { size?: number };

/**
 * Code-drawn icon for the "Disco mode" Plus perk — a cozy pastel mirror ball
 * hanging from a loop, with faceting curves + a few bright mirror tiles and
 * sparkles. Faceless (per the no-faces-on-UI-icons rule); lavender/pink to match
 * the disco study scene. SVG in the bakery style, not a raster.
 */
export function DiscoBallIcon({ size = 40 }: Props) {
  const base = '#CBB8EC';      // ball body
  const facet = '#A98FD6';     // faceting curves + outline
  const glint = '#F6EFFC';     // bright mirror tiles
  const spark = '#FBC9DD';     // pink sparkles
  const cx = 24;
  const cy = 28;
  const r = 13;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <ClipPath id="discoBall">
          <Circle cx={cx} cy={cy} r={r} />
        </ClipPath>
      </Defs>

      {/* Hanger: string + little loop the ball dangles from */}
      <Line x1={cx} y1={7} x2={cx} y2={15} stroke={facet} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={cx} cy={6} r={2.4} fill="none" stroke={facet} strokeWidth={2} />

      {/* Ball body */}
      <Circle cx={cx} cy={cy} r={r} fill={base} stroke={facet} strokeWidth={2} />

      {/* Faceting — latitude + longitude curves clipped to the ball */}
      <G clipPath="url(#discoBall)" stroke={facet} strokeWidth={1} fill="none" opacity={0.7}>
        {/* longitude */}
        <Line x1={cx} y1={cy - r} x2={cx} y2={cy + r} />
        <Path d="M24 15 Q14 28 24 41" />
        <Path d="M24 15 Q34 28 24 41" />
        {/* latitude */}
        <Line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
        <Path d="M12 23 Q24 19 36 23" />
        <Path d="M12 33 Q24 37 36 33" />
      </G>

      {/* Bright mirror tiles catching the light, clipped to the ball */}
      <G clipPath="url(#discoBall)">
        <Rect x={17.5} y={21.5} width={3.4} height={3.4} rx={0.8} fill={glint} />
        <Rect x={27} y={29.5} width={3.4} height={3.4} rx={0.8} fill={glint} />
        <Rect x={21} y={33} width={3.4} height={3.4} rx={0.8} fill={glint} />
      </G>

      {/* Sparkles thrown off the ball — 4-point stars */}
      <Path d="M39 14 L40 17 L43 18 L40 19 L39 22 L38 19 L35 18 L38 17 Z" fill={spark} />
      <Path d="M10 36 L10.8 38.2 L13 39 L10.8 39.8 L10 42 L9.2 39.8 L7 39 L9.2 38.2 Z" fill={spark} />
    </Svg>
  );
}
