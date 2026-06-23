import { StyleSheet, type TextStyle } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';

export type FitTextProps = ThemedTextProps & {
  /** Max lines before the text shrinks to fit (default 2). */
  numberOfLines?: number;
  /** Smallest fraction of the base font size it may shrink to (default 0.5). */
  minScale?: number;
};

/**
 * Text that ALWAYS fits its box: it auto-shrinks to fit instead of truncating with an
 * ellipsis, so names/labels never cut off — on a phone or a big tablet. Use it for any
 * name/label that lives in a fixed-size card or row.
 *
 * Why this needs to be a component (the "once and for all" part): React Native's
 * `adjustsFontSizeToFit` silently fails whenever the style also sets a fixed
 * `lineHeight` — the font shrinks but the line box stays put, so the glyphs clip and
 * the text truncates. That bites hardest on tablet, where the font is scaled up but a
 * hard-coded phone `lineHeight` is not. FitText strips any fixed `lineHeight` (letting
 * ThemedText derive one proportional to the font) and then auto-shrinks within
 * `numberOfLines`, which is the one combination that reliably fits the full string.
 */
export function FitText({ numberOfLines = 2, minScale = 0.5, style, ...rest }: FitTextProps) {
  // Drop any fixed lineHeight so the line box scales with the (shrinking) font.
  const { lineHeight: _stripped, ...noLineHeight } = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  return (
    <ThemedText
      {...rest}
      style={noLineHeight}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit
      minimumFontScale={minScale}
    />
  );
}
