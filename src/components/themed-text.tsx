import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { BakeryColors, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // When a caller overrides fontSize but not lineHeight, derive a proportional
  // lineHeight so scaled-up text (e.g. tablet sizing) can never clip against a
  // preset's fixed lineHeight (which caused top/bottom-cut glyphs). Texts that don't
  // override fontSize keep their preset lineHeight; explicit lineHeights are respected.
  const flat = StyleSheet.flatten(style) as { fontSize?: number; lineHeight?: number } | undefined;
  const autoLineHeight =
    flat && typeof flat.fontSize === 'number' && flat.lineHeight == null
      ? { lineHeight: Math.round(flat.fontSize * 1.35) }
      : null;

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
        autoLineHeight,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
    fontFamily: Fonts.rounded,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
    fontFamily: Fonts.rounded,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
    fontFamily: Fonts.rounded,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
    fontFamily: Fonts.rounded,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: Fonts.rounded,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: BakeryColors.mocha,
    fontFamily: Fonts.rounded,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
