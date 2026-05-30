import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

export const STREAK_FREEZE_ICON = require('@/assets/images/home/streak-freeze-icon.png');

type StreakFreezeIconProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function StreakFreezeIcon({ size = 72, style }: StreakFreezeIconProps) {
  return (
    <Image
      source={STREAK_FREEZE_ICON}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel="Streak freeze"
    />
  );
}
