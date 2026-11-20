/**
 * Shared "soft café" look (approved 2026-11-19/20) used by the Start Baking menu
 * (session-picker) and the Custom Recipe card (custom-timer): cake-coloured
 * palette, faint honey gingham, cream drip, sprinkle section labels, the per-
 * dessert pastel table, and the biscuit-stick slider that replaces scrollbars.
 */
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Fonts } from '@/constants/theme';

export const CAFE = {
  bg: '#FFF7EE',
  gingham: 'rgba(226,178,120,0.10)',
  paper: '#FFFCF8',
  line: '#EEDFCF',
  header: '#FBEBD5',
  ink: '#4F3632',
  inkSoft: '#6E5044',
  title: '#5B3A30',
  label: '#6A4A3E',
  box: '#CDB4A2',
  offText: '#7A5A4C',
} as const;

export type DessertTheme = {
  /** Round plate behind the dessert picture. */
  plate: string;
  /** Row fill when picked. */
  soft: string;
  /** Row outline when picked. */
  ring: string;
  /** Name text (a dark shade of the dessert, readable on cream). */
  ink: string;
  /** Dotted leader to the price. */
  leader: string;
  /** Check-mark colour. */
  tick: string;
  /** Mode-switch pill (picked side) + its text. */
  pill: string;
  pillText: string;
  /** Start button + its text. */
  btn: string;
  btnText: string;
  /** Biscuit-stick slider coating. */
  coat: string;
};

// Peach shortcake · strawberry cat mochi · honey bear pancake · cocoa layer cake.
export const DESSERT: Record<number, DessertTheme> = {
  15: { plate: '#FEE6DA', soft: '#FFF3EC', ring: '#F5CBB6', ink: '#9E4A32', leader: '#F2C9B6', tick: '#E2875F', pill: '#FBD9C8', pillText: '#6E3320', btn: '#D9784F', btnText: '#FFFFFF', coat: '#F0A27F' },
  30: { plate: '#FCE0E6', soft: '#FFF2F5', ring: '#F3BFCB', ink: '#A33A55', leader: '#F2C2CD', tick: '#E0758A', pill: '#F8CED7', pillText: '#5B2A36', btn: '#DD6F85', btnText: '#FFFFFF', coat: '#EE97A8' },
  60: { plate: '#FDF0C6', soft: '#FFFAEA', ring: '#EFD794', ink: '#7A560E', leader: '#EEDB9F', tick: '#D9A030', pill: '#FBE6A6', pillText: '#5A3E10', btn: '#F2C14E', btnText: '#4F3410', coat: '#EBB43C' },
  90: { plate: '#F2E3D8', soft: '#FBF4EF', ring: '#DEC4B2', ink: '#6A4238', leader: '#E2CCBD', tick: '#9C6B55', pill: '#EBD8CA', pillText: '#4F3028', btn: '#8C5E4A', btnText: '#FFFFFF', coat: '#B98A72' },
};
export const DEFAULT_DESSERT_MIN = 30;

/** The dessert palette a free length belongs to (nearest of the four bakes). */
export function dessertForMinutes(min: number): DessertTheme {
  if (min <= 20) return DESSERT[15];
  if (min <= 45) return DESSERT[30];
  if (min <= 75) return DESSERT[60];
  return DESSERT[90];
}

/** Little "sprinkles" either side of section titles — one per dessert colour. */
export const SPRINKLES = ['#F2B49A', '#EFA3B3', '#F2C65C', '#C9A48C'];
export const SPRINKLES_REV = [...SPRINKLES].reverse();

export const CAFE_SOFT_SHADOW = {
  shadowColor: 'rgb(150,110,80)',
  shadowOpacity: 0.12,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

/** Faint honey gingham behind a whole screen (two crossing translucent bands). */
export function Gingham() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="cafeGingham" width={26} height={26} patternUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={13} height={26} fill={CAFE.gingham} />
          <Rect x={0} y={0} width={26} height={13} fill={CAFE.gingham} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#cafeGingham)" />
    </Svg>
  );
}

/** Soft cream drip hanging under a card header. */
export function Drip({ color, height }: { color: string; height: number }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 370 12" preserveAspectRatio="none">
      <Path
        d="M0 0 H370 V3 C362 3 360 9 352 9 C344 9 344 4 334 4 C322 4 322 11 310 11 C298 11 298 4 286 4 C276 4 274 8 264 8 C254 8 254 3 242 3 C230 3 230 10 218 10 C206 10 206 4 194 4 C184 4 182 7 172 7 C162 7 162 3 150 3 C138 3 138 11 126 11 C114 11 114 4 102 4 C92 4 90 8 80 8 C70 8 70 3 58 3 C46 3 46 9 34 9 C22 9 22 4 12 4 C6 4 4 5 0 5 Z"
        fill={color}
      />
    </Svg>
  );
}

/** Section title flanked by two sprinkles each side. */
export function SprinkleLabel({ text, dots = SPRINKLES, g = 1 }: { text: string; dots?: string[]; g?: number }) {
  const dot = { width: 5 * g, height: 5 * g, borderRadius: 3 * g };
  return (
    <View style={[labelStyles.row, { gap: 5 * g, marginTop: 4 * g, marginBottom: 6 * g }]}>
      <View style={[dot, { backgroundColor: dots[0] }]} />
      <View style={[dot, { backgroundColor: dots[1] }]} />
      <Text style={[labelStyles.text, { fontSize: 11.5 * g, letterSpacing: 2.2 * g, marginHorizontal: 5 * g }]} numberOfLines={1}>{text}</Text>
      <View style={[dot, { backgroundColor: dots[2] }]} />
      <View style={[dot, { backgroundColor: dots[3] }]} />
    </View>
  );
}

const labelStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Fonts.rounded, fontWeight: '900', color: CAFE.label, flexShrink: 1, textAlign: 'center' },
});

/**
 * Biscuit-stick slider state for a horizontal ScrollView: spread the returned
 * handlers onto the ScrollView, pass `view` to <BiscuitStick>. The coated part
 * is the visible share of the row and slides as it scrolls.
 */
export function useBiscuitStick() {
  const dims = useRef({ w: 0, content: 0, x: 0 });
  const [view, setView] = useState({ pos: 0, ratio: 1 });
  const sync = () => {
    const { w, content, x } = dims.current;
    if (!w || !content) return;
    const max = content - w;
    setView({ pos: max > 0 ? Math.min(1, Math.max(0, x / max)) : 0, ratio: Math.min(1, w / content) });
  };
  return {
    view,
    scrollProps: {
      scrollEventThrottle: 16,
      onLayout: (e: LayoutChangeEvent) => { dims.current.w = e.nativeEvent.layout.width; sync(); },
      onContentSizeChange: (w: number) => { dims.current.content = w; sync(); },
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => { dims.current.x = e.nativeEvent.contentOffset.x; sync(); },
    },
  };
}

/** The food-shaped slider itself (hidden when nothing overflows). */
export function BiscuitStick({ view, track, coat, g = 1 }: { view: { pos: number; ratio: number }; track: string; coat: string; g?: number }) {
  if (view.ratio >= 0.995) return null;
  return (
    <View style={{ height: 8 * g, width: '62%', alignSelf: 'center', marginTop: 9 * g }} pointerEvents="none">
      <View style={{ position: 'absolute', top: 1 * g, left: 0, right: 0, height: 6 * g, borderRadius: 3 * g, backgroundColor: track }} />
      <View
        style={{
          position: 'absolute', top: 0, height: 8 * g, borderRadius: 4 * g, backgroundColor: coat,
          width: `${view.ratio * 100}%`, left: `${view.pos * (1 - view.ratio) * 100}%`,
        }}
      />
    </View>
  );
}
