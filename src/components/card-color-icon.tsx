import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { CARD_COLORS } from '@/constants/card-colors';

type Props = { size?: number };

/**
 * Code-drawn icon for the "Custom profile card color" Plus perk. Depicts the
 * profile card itself (faceless — per the no-faces-on-UI-icons rule) with a
 * tinted header strip and a little palette of colour swatches, so it reads as
 * "recolour your card" rather than the friends art it replaces.
 */
export function CardColorIcon({ size = 40 }: Props) {
  const cream = '#FFFDF8';
  const outline = '#EFB7C4';
  const bar = '#E7DED0'; // muted "text line" bars on the card
  // Swatch palette pulled from the real card-colour options.
  const swatches = [
    CARD_COLORS.pink.strip,
    CARD_COLORS.mint.strip,
    CARD_COLORS.sky.strip,
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Card body — slightly tilted for a playful sticker feel */}
      <G rotation={-6} origin="23, 22">
        <Rect x={9} y={7} width={28} height={32} rx={6} fill={cream} stroke={outline} strokeWidth={2} />
        {/* Tinted header strip (the colour being customised) — rounded top only */}
        <Path
          d="M11 13 Q11 9 15 9 H31 Q35 9 35 13 V16 H11 Z"
          fill={CARD_COLORS.pink.strip}
        />
        {/* Faceless avatar disc straddling the strip */}
        <Circle cx={23} cy={16} r={5} fill={cream} stroke={outline} strokeWidth={1.6} />
        {/* Name / detail bars */}
        <Rect x={15} y={25} width={16} height={2.6} rx={1.3} fill={bar} />
        <Rect x={17} y={30} width={12} height={2.6} rx={1.3} fill={bar} />
      </G>

      {/* Colour palette tucked into the corner — the "pick a colour" cue */}
      <G>
        <Circle cx={36} cy={34} r={6.2} fill={cream} stroke={outline} strokeWidth={1.6} />
        <Circle cx={33.4} cy={32.4} r={1.9} fill={swatches[0]} />
        <Circle cx={38.4} cy={32.2} r={1.9} fill={swatches[1]} />
        <Circle cx={36} cy={36.4} r={1.9} fill={swatches[2]} />
      </G>
    </Svg>
  );
}
