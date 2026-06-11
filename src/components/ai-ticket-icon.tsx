import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

import { useTranslation } from '@/i18n';

export const AI_TICKET_ICON = require('@/assets/images/home/ai-ticket-icon.png');

type AiTicketIconProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Matches the asset’s natural diagonal tilt. */
const DIAGONAL_ROTATE = '-18deg';

export function AiTicketIcon({ size = 72, style }: AiTicketIconProps) {
  const { t } = useTranslation();
  return (
    <Image
      source={AI_TICKET_ICON}
      style={[{ width: size, height: size, transform: [{ rotate: DIAGONAL_ROTATE }] }, style]}
      contentFit="contain"
      accessibilityLabel={t('a11y.aiTicket')}
    />
  );
}
