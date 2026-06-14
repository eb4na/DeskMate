import Svg, { Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

import { BakeryColors } from '@/constants/theme';

// Pickable decorative shapes for an exam countdown. Icon-only (no strings) so the
// picker needs no translations. Keys persist on ExamCountdown.shape.
export const COUNTDOWN_SHAPES = ['star', 'heart', 'tear'] as const;
export type CountdownShapeKey = (typeof COUNTDOWN_SHAPES)[number];

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
        <Path
          d="M12 2 L14.6 8.9 L22 9.3 L16.2 14 L18.2 21 L12 16.9 L5.8 21 L7.8 14 L2 9.3 L9.4 8.9 Z"
          fill={fill}
        />
      )}
      {key === 'heart' && (
        <Path
          d="M12 21 C12 21 3 13.8 3 8.6 A4.6 4.6 0 0 1 12 6 A4.6 4.6 0 0 1 21 8.6 C21 13.8 12 21 12 21 Z"
          fill={fill}
        />
      )}
      {key === 'tear' && (
        // Symmetric classic water-drop: a sharp top point tapering into a full,
        // round bulb (circle r6 centred at 12,15) — mirror-balanced left/right.
        <Path
          d="M12 2.5 C9 8 6 11 6 15 a6 6 0 1 0 12 0 C18 11 15 8 12 2.5 Z"
          fill={fill}
        />
      )}
    </Svg>
  );
}
