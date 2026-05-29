import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

export const STREAK_FREEZE_ICON = require('@/assets/images/home/streak-freeze-icon.png');

type StreakFreezeIconProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Slight left tilt — diagonal, not flat sideways. */
const DIAGONAL_ROTATE = '-38deg';

export function StreakFreezeIcon({ size = 72, style }: StreakFreezeIconProps) {
  return (
    <Image
      source={STREAK_FREEZE_ICON}
      style={[{ width: size, height: size, transform: [{ rotate: DIAGONAL_ROTATE }] }, style]}
      contentFit="contain"
      accessibilityLabel="Streak freeze"
    />
  );
}
