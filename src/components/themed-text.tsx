import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { BakeryColors, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

export type ThemedTextType =
  | 'default'
  | 'title'
  | 'small'
  | 'smallBold'
  | 'subtitle'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

// Type presets, as plain style objects so we can read + scale their numbers. These
// hold a FIXED (phone) font size; on tablet we multiply fontSize + lineHeight by the
// shared tablet `scale` below. (Previously these presets were never scaled, so any
// `<ThemedText type="small">` stayed phone-tiny on an iPad — dwarfed by the scaled
// chrome around it, most visibly on the big 13".)
const PRESETS: Record<ThemedTextType, TextStyle> = {
  default: { fontSize: 16, lineHeight: 24, fontWeight: 500, fontFamily: Fonts.rounded },
  title: { fontSize: 48, lineHeight: 52, fontWeight: 600, fontFamily: Fonts.rounded },
  small: { fontSize: 14, lineHeight: 20, fontWeight: 500, fontFamily: Fonts.rounded },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: 700, fontFamily: Fonts.rounded },
  subtitle: { fontSize: 32, lineHeight: 44, fontWeight: 600, fontFamily: Fonts.rounded },
  link: { fontSize: 14, lineHeight: 30, fontFamily: Fonts.rounded },
  linkPrimary: { fontSize: 14, lineHeight: 30, color: BakeryColors.mocha, fontFamily: Fonts.rounded },
  code: { fontSize: 12, fontFamily: Fonts.mono, fontWeight: Platform.select({ android: 700 }) ?? 500 },
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  // Tablet font scaling: 1 on phones (presets untouched), the tuned multiplier on
  // iPad. Scaling the preset here is what makes preset body text grow with the rest
  // of the tablet layout instead of staying at fixed phone size.
  const { scale } = useTabletScale();

  const preset = PRESETS[type];
  const scaledPreset: TextStyle =
    scale === 1
      ? preset
      : {
          ...preset,
          fontSize: (preset.fontSize ?? 16) * scale,
          ...(preset.lineHeight != null ? { lineHeight: preset.lineHeight * scale } : {}),
        };

  // When a caller overrides fontSize but not lineHeight, derive a proportional
  // lineHeight so scaled-up text can never clip against a preset's fixed lineHeight
  // (which caused top/bottom-cut glyphs). Texts that don't override fontSize keep the
  // (now tablet-scaled) preset lineHeight; explicit lineHeights are respected.
  const flat = StyleSheet.flatten(style) as { fontSize?: number; lineHeight?: number } | undefined;
  const autoLineHeight =
    flat && typeof flat.fontSize === 'number' && flat.lineHeight == null
      ? { lineHeight: Math.round(flat.fontSize * 1.35) }
      : // Symmetric case: caller pins a lineHeight but NOT a fontSize, so the font
        // comes from the (tablet-scaled) preset while the lineHeight stays at its
        // phone value — on a big tablet the grown glyphs then clip top/bottom against
        // the fixed line box. Scale the caller's lineHeight by the same factor so the
        // line box grows with the text. (Phones: scale===1, so this is a no-op.)
        scale !== 1 && flat && typeof flat.lineHeight === 'number' && flat.fontSize == null
        ? { lineHeight: Math.round(flat.lineHeight * scale) }
        : null;

  return (
    <Text
      // Preset first, then the caller's `style`: an explicit `fontSize` (e.g. a
      // screen's own `N * s`) therefore still wins → no double-scaling.
      style={[{ color: theme[themeColor ?? 'text'] }, scaledPreset, style, autoLineHeight]}
      {...rest}
    />
  );
}
