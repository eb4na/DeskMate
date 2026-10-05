import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { CountdownShape } from '@/components/countdown-shapes';
import { BakeryColors as C } from '@/constants/theme';

// The Tasks tab's planner-page look, shared by the month calendar, the week-ahead
// day cards, the day popup and the To-Do list so they read as pages of one planner.

/** Warm planner paper. */
export const PAPER = '#FFFBF3';
/** Washi-tape pink, and the green that marks today everywhere on the Tasks tab. */
export const TAPE_PINK = '#F4B6C2';
export const TODAY_GREEN = '#BDE5C4';

/**
 * Faint dot grid filling its parent, plus optional binder rings along the top edge
 * and a strip of washi tape. Absolutely placed and untouchable, so it never shifts
 * the content it sits under. Put it FIRST inside a card whose background is PAPER.
 */
export function PlannerPaper({ radius, rings = false, tape = false }: { radius: number; rings?: boolean; tape?: boolean }) {
  return (
    <>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="plannerDots" width={16} height={16} patternUnits="userSpaceOnUse">
              <Circle cx={8} cy={8} r={1.1} fill="#EADBC8" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#plannerDots)" />
        </Svg>
      </View>
      {rings && (
        <View style={styles.rings} pointerEvents="none">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.ring} />
          ))}
        </View>
      )}
      {tape && (
        <View style={styles.tape} pointerEvents="none">
          {[0, 1, 2].map((i) => (
            <CountdownShape key={i} shape="heart" color="#FFFFFF" size={12} />
          ))}
        </View>
      )}
    </>
  );
}

/**
 * A heading written on a strip of washi tape — the day label on a planner card.
 * Fixed slight tilt; `color` tints the tape (green for today).
 */
export function TapeLabel({ children, color = TAPE_PINK, style }: { children: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tapeLabel, { backgroundColor: color }, style]}>
      <Text style={styles.tapeLabelText} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rings: { position: 'absolute', top: -9, left: 26, flexDirection: 'row', gap: 16 },
  ring: { width: 10, height: 20, borderRadius: 5, backgroundColor: '#D9C3AA', borderWidth: 2, borderColor: PAPER },
  tape: {
    position: 'absolute', top: -8, right: 20, width: 76, height: 20,
    backgroundColor: TAPE_PINK, opacity: 0.9, transform: [{ rotate: '5deg' }],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  tapeLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    opacity: 0.95,
    transform: [{ rotate: '-1.5deg' }],
  },
  tapeLabelText: { fontSize: 15, fontWeight: '900', color: C.cocoaDark },
});
