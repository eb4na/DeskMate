import { useEffect, useMemo, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { playTick } from '@/lib/sounds';
import { BakeryColors, BakeryRadii, BakeryShadow } from '@/constants/theme';

const C = BakeryColors;

const BASE_ITEM_H = 40;
const LOOP_REPEAT = 7; // copies stacked to fake an endless (wrapping) wheel
const LOOP_CENTER = Math.floor(LOOP_REPEAT / 2);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const HR_VALUES = range(0, 5);
const MIN_VALUES = range(0, 59); // 0–59 so a clean hour (e.g. 60m) shows :00, not a blank.

// A flick-scrollable wheel column — snaps to whole values. When `loop` is set, the
// values wrap (scrolling past the last lands on the first). `scale` grows the row
// height + text so the wheel matches the surrounding tablet-scaled layout; the snap
// math is all derived from the scaled ITEM_H, so it stays consistent.
export function WheelColumn({
  values, value, unit, onChange, loop = false, scale = 1,
}: { values: number[]; value: number; unit: string; onChange: (v: number) => void; loop?: boolean; scale?: number }) {
  const ITEM_H = Math.round(BASE_ITEM_H * scale);
  const styles = useMemo(() => makeWheelStyles(scale, ITEM_H), [scale, ITEM_H]);
  const ref = useRef<ScrollView>(null);
  const len = values.length;
  const data = loop ? Array.from({ length: len * LOOP_REPEAT }, (_, i) => values[i % len]) : values;
  const mid = loop ? LOOP_CENTER * len : 0;
  const base = Math.max(0, values.indexOf(value));
  const idx = mid + base;
  const draggingRef = useRef(false);
  const lastTickIdxRef = useRef(idx);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!draggingRef.current) return;
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    if (i !== lastTickIdxRef.current) {
      lastTickIdxRef.current = i;
      playTick();
    }
  };
  const commit = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    draggingRef.current = false;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    const v = data[i];
    if (v !== value) onChange(v);
    if (loop) {
      const target = mid + (i % len);
      if (target !== i) ref.current?.scrollTo({ y: target * ITEM_H, animated: false });
    }
  };
  useEffect(() => {
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
  }, [idx, ITEM_H]);
  return (
    <View style={styles.wheel}>
      <View style={styles.wheelHighlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        style={{ height: ITEM_H * 3 }}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        contentOffset={{ x: 0, y: idx * ITEM_H }}
        scrollEventThrottle={16}
        onScrollBeginDrag={(e) => {
          draggingRef.current = true;
          lastTickIdxRef.current = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
        }}
        onScroll={onScroll}
        onMomentumScrollEnd={commit}
        onScrollEndDrag={commit}>
        {data.map((v, i) => (
          <View key={i} style={styles.wheelItem}>
            <Text style={[styles.wheelNum, v === value && styles.wheelNumActive]}>{String(v).padStart(2, '0')}</Text>
          </View>
        ))}
      </ScrollView>
      <Text style={styles.wheelUnit}>{unit}</Text>
    </View>
  );
}

// The whole "focus duration" control: hr + min wheels in a card, plus optional
// quick-pick chips. Works off a single total-minutes value so callers don't juggle
// hr/min. `onChange` is always handed a value clamped to [min, max].
export function DurationWheel({
  minutes, onChange, picks, scale = 1, min = 5, max = 300,
}: { minutes: number; onChange: (m: number) => void; picks?: number[]; scale?: number; min?: number; max?: number }) {
  const styles = useMemo(() => makeCardStyles(scale), [scale]);
  const clamp = (m: number) => Math.max(min, Math.min(max, m));
  const hr = Math.floor(minutes / 60);
  const mn = minutes % 60;
  return (
    <>
      <View style={styles.durCard}>
        <WheelColumn values={HR_VALUES} value={hr} unit="hr" scale={scale} onChange={(h) => onChange(clamp(h * 60 + mn))} />
        <View style={styles.durDivider} />
        <WheelColumn values={MIN_VALUES} value={mn} unit="min" loop scale={scale} onChange={(m) => onChange(clamp(hr * 60 + m))} />
      </View>
      {picks && picks.length > 0 && (
        <View style={styles.pickRow}>
          {picks.map((m) => (
            <Pressable key={m} onPress={() => { playTick(); onChange(clamp(m)); }} style={[styles.pick, minutes === m && styles.pickActive]}>
              <Text style={[styles.pickText, minutes === m && styles.pickTextActive]}>{m}m</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const makeWheelStyles = (s: number, ITEM_H: number) => StyleSheet.create({
  wheel: { alignItems: 'center', minWidth: 96 * s },
  wheelHighlight: {
    position: 'absolute', top: ITEM_H, height: ITEM_H, left: 6 * s, right: 6 * s,
    borderRadius: 12 * s, backgroundColor: 'rgba(195,143,114,0.12)',
  },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelNum: { fontSize: 24 * s, fontWeight: '800', color: C.latte, lineHeight: 28 * s },
  wheelNumActive: { fontSize: 32 * s, fontWeight: '900', color: C.berry, lineHeight: 34 * s },
  wheelUnit: { fontSize: 12 * s, fontWeight: '700', color: C.mocha, marginTop: 2 * s },
});

const makeCardStyles = (s: number) => StyleSheet.create({
  durCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: BakeryRadii.card,
    borderWidth: 1.5, borderColor: 'rgba(195,143,114,0.18)',
    paddingVertical: 16 * s, marginTop: 4 * s, ...BakeryShadow,
  },
  durDivider: { width: 1.5, height: 96 * s, backgroundColor: C.shortbread, marginHorizontal: 24 * s },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 * s, marginTop: 8 * s, justifyContent: 'center' },
  pick: {
    borderRadius: BakeryRadii.pill, borderWidth: 1.5, borderColor: C.shortbread,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16 * s, paddingVertical: 8 * s,
  },
  pickActive: { backgroundColor: C.jam, borderColor: C.jam },
  pickText: { fontSize: 13 * s, fontWeight: '800', color: C.mocha },
  pickTextActive: { color: '#fff' },
});
