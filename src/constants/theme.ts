/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

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
  honey: '#F0B44A',
  jam: '#E48A9A',
  berry: '#CC6B7B',
  mint: '#A6C8B4',
  rose: '#F6C8C2',
  latte: '#D5B29A',
  border: '#C38F72',
  mocha: '#A46F56',
  success: '#84B88E',
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
