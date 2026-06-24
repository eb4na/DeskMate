import { Image, type ImageStyle } from 'expo-image';
import { formatCoins } from '@/constants/placeholder-data';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import i18n from '@/i18n';

export const COIN_ICON = require('@/assets/images/home/coin-icon.png');

type CoinIconProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function CoinIcon({ size = 32, style }: CoinIconProps) {
  return (
    <Image
      source={COIN_ICON}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel={i18n.t('a11y.focusCoin')}
    />
  );
}

type CoinAmountProps = {
  amount: number | string;
  size?: number;
  prefix?: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  gap?: number;
};

/** Inline coin icon + amount (e.g. shop prices, earn tips). */
export function CoinAmount({
  amount,
  size = 28,
  prefix = '',
  textStyle,
  style,
  gap = 4,
}: CoinAmountProps) {
  return (
    <View style={[styles.row, { gap }, style]}>
      <CoinIcon size={size} />
      <ThemedText style={textStyle}>
        {prefix}
        {formatCoins(amount)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
