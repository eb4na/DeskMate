import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { BakeryColors, BakeryRadii, BakeryShadow } from '@/constants/theme';

// A hand-drawn "paper" card for the notebook theme: a pastel fill with a warm ink
// sketch stroke and a soft offset shadow. Two looks from the references:
//   • solid  — tinted card, clean ink outline (IMG_1988 countdown cards)
//   • dashed — cream "sticker" card with a dashed rounded border (IMG_1989)
//   • none   — fill + shadow only, no border
//
// The dashed border is drawn with SVG (measured via onLayout) because RN's
// `borderStyle:'dashed'` renders as solid once `borderRadius` is set on iOS.

export type PaperCardProps = ViewProps & {
  /** Card fill colour. Defaults to a soft cream. */
  fill?: string;
  /** Border treatment. */
  border?: 'solid' | 'dashed' | 'none';
  /** Sketch stroke colour. */
  borderColor?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Corner radius. */
  radius?: number;
  /** Drop the soft offset shadow. */
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PaperCard({
  fill = BakeryColors.frosting,
  border = 'solid',
  borderColor = BakeryColors.ink,
  strokeWidth = 2,
  radius = BakeryRadii.card,
  flat = false,
  style,
  children,
  ...rest
}: PaperCardProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dashed = border === 'dashed';

  const onLayout = dashed
    ? (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }
    : undefined;

  return (
    <View
      {...rest}
      onLayout={onLayout}
      style={[
        {
          backgroundColor: fill,
          borderRadius: radius,
          // Solid borders use the native border; the dashed variant paints its own
          // SVG stroke on top of a borderless card.
          borderWidth: border === 'solid' ? strokeWidth : 0,
          borderColor,
        },
        !flat && BakeryShadow,
        style,
      ]}>
      {children}
      {dashed && size.w > 0 && (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={size.w}
          height={size.h}>
          <Rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.w - strokeWidth}
            height={size.h - strokeWidth}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={borderColor}
            strokeWidth={strokeWidth}
            strokeDasharray={[7, 6]}
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}
