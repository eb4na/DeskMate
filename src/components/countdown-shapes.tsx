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
        // (circle r5.4 centred at 12,14). Nudged down 1.2 from where it sat, so its
        // tip no longer crowds the top of the box.
        <Path
          d="M12 3.8 C9.2 8.8 6.6 11.5 6.6 14 a5.4 5.4 0 1 0 10.8 0 C17.4 11.5 14.8 8.8 12 3.8 Z"
          fill={fill}
        />
      )}
    </Svg>
  );
}
