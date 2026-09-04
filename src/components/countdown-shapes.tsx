import Svg, { Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

import { BakeryColors } from '@/constants/theme';

// Decorative shapes drawn on a calendar day. Icon-only (no strings) so the picker
// needs no translations. Keys persist on ExamCountdown.shape / dayShapes.
export const COUNTDOWN_SHAPES = ['star', 'heart', 'tear', 'circle'] as const;
export type CountdownShapeKey = (typeof COUNTDOWN_SHAPES)[number];

// The STAR is reserved for exam days — an exam day is marked with one automatically
// and can't be changed, so a plain day must not be able to borrow it. Anything that
// lets a player pick a day's shape offers this list instead.
export const DAY_SHAPES = COUNTDOWN_SHAPES.filter((s) => s !== 'star');
export const EXAM_SHAPE: CountdownShapeKey = 'star';

// Stored in dayShapes to mean "this day is deliberately BARE". Needed as a real
// value rather than an absent key: on an exam day an absent key falls back to the
// star, so deleting can't express "no mark". Never a renderable shape.
export const NO_SHAPE = 'none';

export const DEFAULT_COUNTDOWN_SHAPE: CountdownShapeKey = 'star';

type Props = { shape?: string; size?: number; color?: ColorValue };

const c = (color: ColorValue) => color as string;

// One filled shape, tinted by `color`. Falls back to the default shape for
// unknown/legacy keys.
export function CountdownShape({ shape, size = 18, color = BakeryColors.jam }: Props) {
  const fill = c(color);
  const key = (COUNTDOWN_SHAPES as readonly string[]).includes(shape ?? '')
    ? (shape as CountdownShapeKey)
    : DEFAULT_COUNTDOWN_SHAPE;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {key === 'star' && (
        // Bubbly star: each point is a rounded bulge (quadratic curves arcing out
        // past the tip), with a soft waist between them — a puffy sticker look.
        <Path
          d="M8.9 7.8 Q12 1 15.1 7.8 Q22.5 8.6 17 13.6 Q18.5 20.9 12 17.2 Q5.5 20.9 7 13.6 Q1.5 8.6 8.9 7.8 Z"
          fill={fill}
          strokeLinejoin="round"
        />
      )}
      {key === 'heart' && (
        // Bubbly heart: full, puffy top lobes and a ROUNDED bottom (the two sides meet
        // with a horizontal tangent, so it's a soft round instead of a sharp point).
        // Sized a touch smaller and sat slightly lower in the 24×24 box.
        <Path
          d="M12 19.8 C13.3 19.8 14.6 18.7 16 17.3 C18 15.3 19.5 13 19.5 10.2 C19.5 7 17.6 5.2 15.3 5.2 C13.7 5.2 12.5 6.2 12 7.6 C11.5 6.2 10.3 5.2 8.7 5.2 C6.4 5.2 4.5 7 4.5 10.2 C4.5 13 6 15.3 8 17.3 C9.4 18.7 10.7 19.8 12 19.8 Z"
          fill={fill}
          strokeLinejoin="round"
        />
      )}
      {key === 'circle' && (
        // Plain round dot. r7 rather than r8.4: a full circle reads heavier than the
        // other shapes at the same radius, since they all taper, so it needs to be
        // smaller to carry the same visual weight.
        <Path d="M12 5 a7 7 0 1 0 0.01 0 Z" fill={fill} />
      )}
      {key === 'tear' && (
        // Symmetric classic water-drop: a sharp top point tapering into a round bulb
        // (circle r6.1 centred at 12,14.3). Scaled about the shape's OWN centre
        // (12, 11.65) rather than the viewBox's, so it grows in place instead of
        // drifting as it changes size. Wider than before, since a drop is naturally
        // narrower than the heart and circle and read small beside them.
        <Path
          d="M12 2.8 C8.9 8.5 5.9 11.5 5.9 14.3 a6.1 6.1 0 1 0 12.2 0 C18.1 11.5 15.1 8.5 12 2.8 Z"
          fill={fill}
        />
      )}
    </Svg>
  );
}
