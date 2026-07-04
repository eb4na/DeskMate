/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Dimensions, Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#57392C',
    background: '#FFF8F1',
    backgroundElement: '#FFFDF9',
    backgroundSelected: '#F9E8D7',
    textSecondary: '#9C7D68',
  },
  dark: {
    text: '#FFF5EE',
    background: '#2E211C',
    backgroundElement: '#4A342C',
    backgroundSelected: '#64453A',
    textSecondary: '#D8BAA7',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const BakeryColors = {
  cocoa: '#7A5240',
  cocoaDark: '#5D3C2E',
  frosting: '#FFF8F1',
  cream: '#FFF0E3',
  shortbread: '#F7DFC4',
  butter: '#F4C976',
  honey: '#F6C96B',
  // Default pink for primary action buttons (popups, home, shop, auth). Was honey
  // (yellow); swapped app-wide. Tweak this one value to restyle every such button.
  buttonPink: '#E48A9A',
  jam: '#E48A9A',
  berry: '#CC6B7B',
  mint: '#F2C6D1',
  rose: '#F6C8C2',
  latte: '#D5B29A',
  border: '#C38F72',
  mocha: '#A46F56',
  success: '#D87E96',
  danger: '#D97B6C',
  shadow: 'rgba(132, 87, 63, 0.16)',
  glass: 'rgba(255, 252, 247, 0.9)',
  darkGlass: 'rgba(78, 53, 40, 0.76)',
} as const;

export const BakeryRadii = {
  pill: 999,
  card: 22,
  panel: 28,
  button: 18,
  chip: 14,
} as const;

export const BakeryShadow = Platform.select({
  ios: {
    shadowColor: BakeryColors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: {
    elevation: 6,
  },
  default: {
    shadowColor: BakeryColors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  web: {
    boxShadow: `0 12px 24px ${BakeryColors.shadow}`,
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Lace pill area in custom tab bar (`app-tabs.tsx`). Bow sits slightly below. */
export const TabBarHeight = Platform.select({ ios: 186, android: 192 }) ?? 186;
export const TabBarBowHeight = 46;
export const TabBarBowWidth = 114;
/** Nudge entire bar onto the physical bottom edge (small negative). */
export const TabBarBottomOffset = Platform.select({ ios: -16, android: -12 }) ?? -16;
export const TabBarTotalHeight = TabBarHeight + TabBarBowHeight;
export const BottomTabInset = TabBarTotalHeight + 6 + Math.abs(TabBarBottomOffset);
// Clearance for tab screens: the floating menu bar's top sits ~144px from the
// screen bottom, so reserve just above it (not the whole bar's tall lace area).
export const BottomTabClearance = 152;
export const MaxContentWidth = 800;

// Every popup/dialog card should occupy at least 40% of the screen width, so they
// don't look tiny on big tablets. Add `minWidth: MIN_POPUP_WIDTH` to a popup card's
// style; it's a no-op on phones (40% of a phone width is well below the cards'
// existing maxWidth). Portrait-locked, so this once-captured value is stable.
//
// IMPORTANT: cap it below the popup cards' maxWidth (the smallest is 320). On a big
// tablet 40% of the width (~410pt) would EXCEED maxWidth, and a card with
// minWidth > maxWidth is a degenerate Yoga constraint: the card resolves to the
// larger minWidth but its `alignSelf: 'stretch'` children get sized against the
// smaller maxWidth basis and left-anchored — so buttons render narrow and shoved to
// the left (visible only on tablets). Keeping min <= max avoids that entirely.
export const MIN_POPUP_WIDTH = Math.min(Math.round(Dimensions.get('window').width * 0.4), 300);

// A popup/dialog card's `maxWidth` should grow on tablets so it doesn't look lost on a
// big screen. Many popups build their StyleSheet INSIDE the component and already scale
// width by the tablet `scale` from useTabletScale (`maxWidth: 340 * s`). But the static-
// styled popups (global showPopup host, invite, reward/confirm modals) build their
// StyleSheet at MODULE scope and can't read that hook — so they were stuck at the phone
// width (320–360) and looked tiny on iPad. `popupMaxWidth(base)` applies the SAME tablet
// multiplier at module scope so those cards match the hook-scaled ones exactly.
//
// The multiplier mirrors useTabletScale (hooks/use-tablet-scale): proportional to the
// screen's shortest side, anchored so the 11" Pro (834pt) reproduces 1.3×, clamped
// 1.1–1.7. Tablet class matches useIsTablet (shortest side ≥ 600pt). Portrait-locked and
// computed once, same basis as MIN_POPUP_WIDTH. Phone = base unchanged (scale is 1).
const _popupShortest = Math.min(Dimensions.get('window').width, Dimensions.get('window').height);
export const POPUP_SCALE = _popupShortest >= 600 ? Math.min(1.7, Math.max(1.1, _popupShortest / 642)) : 1;
export function popupMaxWidth(base: number): number {
  return Math.round(base * POPUP_SCALE);
}
