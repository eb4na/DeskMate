import Svg, { Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

import { BakeryColors } from '@/constants/theme';

// Decorative shapes drawn on a calendar day. Icon-only (no strings) so the picker
// needs no translations. Keys persist on ExamCountdown.shape / dayShapes.
export const COUNTDOWN_SHAPES = ['star', 'heart', 'tear', 'circle', 'berry', 'moon', 'flower'] as const;
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

// `sticker`: a white peel-off edge round the shape, like a planner sticker. The
// viewBox gains a margin so the edge isn't clipped.
type Props = { shape?: string; size?: number; color?: ColorValue; sticker?: boolean };

const c = (color: ColorValue) => color as string;

// One filled shape, tinted by `color`. Falls back to the default shape for
// unknown/legacy keys.
export function CountdownShape({ shape, size = 18, color = BakeryColors.jam, sticker = false }: Props) {
  const fill = c(color);
  // Edge props for the main body of each shape (seeds and centres stay bare).
  const edge = sticker ? { stroke: '#FFFFFF', strokeWidth: 2.6, strokeLinejoin: 'round' as const } : {};
  const key = (COUNTDOWN_SHAPES as readonly string[]).includes(shape ?? '')
    ? (shape as CountdownShapeKey)
    : DEFAULT_COUNTDOWN_SHAPE;

  return (
    <Svg width={size} height={size} viewBox={sticker ? '-2 -2 28 28' : '0 0 24 24'}>
      {key === 'star' && (
        // Bubbly star: each point is a rounded bulge (quadratic curves arcing out
        // past the tip), with a soft waist between them — a puffy sticker look.
        <Path
          d="M8.9 7.8 Q12 1 15.1 7.8 Q22.5 8.6 17 13.6 Q18.5 20.9 12 17.2 Q5.5 20.9 7 13.6 Q1.5 8.6 8.9 7.8 Z"
          fill={fill}
          strokeLinejoin="round"
          {...edge}
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
          {...edge}
        />
      )}
      {key === 'circle' && (
        // Plain round dot. r7 rather than r8.4: a full circle reads heavier than the
        // other shapes at the same radius, since they all taper, so it needs to be
        // smaller to carry the same visual weight.
        <Path d="M12 5 a7 7 0 1 0 0.01 0 Z" fill={fill} {...edge} />
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
          {...edge}
        />
      )}
      {key === 'berry' && (
        // Strawberry: the body takes the colour; leaves and seeds stay strawberry-true.
        <>
          <Path d="M12 7.2 C16.6 6.2 20 9.2 19 14 C18.2 18 15 20.8 12 20.8 C9 20.8 5.8 18 5 14 C4 9.2 7.4 6.2 12 7.2 Z" fill={fill} {...edge} />
          <Path d="M8.2 6.4 C9.8 4.4 14.2 4.4 15.8 6.4 C14.4 8.2 9.6 8.2 8.2 6.4 Z" fill="#6DB37F" {...edge} />
          <Path d="M10 11.6 a0.9 0.9 0 1 0 0.01 0 Z M14 12.6 a0.9 0.9 0 1 0 0.01 0 Z M12 15.6 a0.9 0.9 0 1 0 0.01 0 Z M9.4 15 a0.8 0.8 0 1 0 0.01 0 Z M14.8 16 a0.8 0.8 0 1 0 0.01 0 Z" fill="#FFF1C9" />
        </>
      )}
      {key === 'moon' && (
        // Crescent moon (a rest / day-off mark).
        <Path d="M15.2 4 A8.4 8.4 0 1 0 20.4 15.4 A6.8 6.8 0 0 1 15.2 4 Z" fill={fill} {...edge} />
      )}
      {key === 'flower' && (
        // Five round petals round a butter-yellow centre.
        <>
          <Path
            d="M12 4 a3.4 3.4 0 1 1 -0.01 0 Z M16.95 7.6 a3.4 3.4 0 1 1 -0.01 0 Z M15.06 13.4 a3.4 3.4 0 1 1 -0.01 0 Z M8.94 13.4 a3.4 3.4 0 1 1 -0.01 0 Z M7.05 7.6 a3.4 3.4 0 1 1 -0.01 0 Z"
            fill={fill}
            {...edge}
          />
          <Path d="M12 10 a2.6 2.6 0 1 0 0.01 0 Z" fill="#FFE08A" />
        </>
      )}
    </Svg>
  );
}
