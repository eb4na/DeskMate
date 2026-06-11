import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

import { useTranslation } from '@/i18n';

export const STREAK_FREEZE_ICON = require('@/assets/images/home/streak-freeze-icon.png');

type StreakFreezeIconProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function StreakFreezeIcon({ size = 72, style }: StreakFreezeIconProps) {
  const { t } = useTranslation();
  return (
    <Image
      source={STREAK_FREEZE_ICON}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel={t('a11y.streakFreeze')}
    />
  );
}
