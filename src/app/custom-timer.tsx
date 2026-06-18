import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ImageBackground, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { playTick } from '@/lib/sounds';
import { showPopup } from '@/lib/popup';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

const C = BakeryColors;
const SCREEN_BG = require('@/assets/images/home/session-bg.png');

const FOCUS_PICKS = [15, 25, 45, 60, 90];
const BREAK_PICKS = [5, 10, 15, 20, 30];

type TimerMode = 'focus' | 'break';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const HR_VALUES = range(0, 5);
const MIN_VALUES = range(1, 59); // 1-minute steps, never 0
const ITEM_H = 40;
const LOOP_REPEAT = 7; // copies stacked to fake an endless (wrapping) wheel
const LOOP_CENTER = Math.floor(LOOP_REPEAT / 2);

// A flick-scrollable wheel column — snaps to whole values (no 5-min jumps).
// When `loop` is set, the values wrap: scrolling past the last lands on the first (59 → 1).
function WheelColumn({ values, value, unit, onChange, loop = false }: { values: number[]; value: number; unit: string; onChange: (v: number) => void; loop?: boolean }) {
  const ref = useRef<ScrollView>(null);
  const len = values.length;
  // For a looping wheel we stack the values many times and keep the user parked
  // in the middle copy, recentering after each scroll so they never hit an edge.
  const data = loop ? Array.from({ length: len * LOOP_REPEAT }, (_, i) => values[i % len]) : values;
  const mid = loop ? LOOP_CENTER * len : 0;
  const base = Math.max(0, values.indexOf(value));
  const idx = mid + base;
  // Click once per number that rolls past, but only while the user is actually
  // dragging — programmatic scrolls (quick-picks, loop recenter) must stay silent
  // so they don't machine-gun the tick.
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
    // Stop ticking before the loop recenter below scrolls us back to the middle.
    draggingRef.current = false;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    const v = data[i];
    if (v !== value) onChange(v);
    if (loop) {
      // Snap back to the middle copy (same number, no visible jump) so we keep room to scroll.
      const target = mid + (i % len);
      if (target !== i) ref.current?.scrollTo({ y: target * ITEM_H, animated: false });
    }
  };
  // Keep the wheel aligned when the value is set elsewhere (e.g. quick picks).
  useEffect(() => {
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
  }, [idx]);
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

export default function CustomTimerScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: TimerMode }>();
  const isBreakMode = mode === 'break';
  const { subjects, saveTimerPreset, isPlus, coins } = useApp();

  const [focusHr, setFocusHr] = useState(0);
  const [focusMin, setFocusMin] = useState(isBreakMode ? 10 : 45);
  const [breakHr, setBreakHr] = useState(0);
  const [breakMin, setBreakMin] = useState(10);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [savePreset, setSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const focusMins = focusHr * 60 + focusMin;
  const breakMins = breakHr * 60 + breakMin;
  // Back should return to the session (timer) screen, not all the way home.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(isBreakMode ? '/' : '/session-picker');
  };

  // Custom timer is a Plus feature — guard the screen itself so no path (deep
  // link, back-stack) can reach it without Plus; send free users to the paywall.
  useEffect(() => {
    if (!isPlus) router.replace('/plus-upgrade');
  }, [isPlus]);

  const setFocusTotal = (m: number) => { setFocusHr(Math.floor(m / 60)); setFocusMin(m % 60); };
  const setBreakTotal = (m: number) => { setBreakHr(Math.floor(m / 60)); setBreakMin(m % 60); };

  const handleStart = () => {
    const mins = focusMins;
    if (mins < 1 || mins > 300) { showPopup(t('customTimer.between1And300')); return; }
    if (isBreakMode) {
      router.replace({ pathname: '/break-game', params: { breakMinutes: String(mins), fromSession: '1' } });
      return;
    }
    if (savePreset && isPlus) saveTimerPreset({ label: presetName.trim() || `${mins} ${t('customTimer.min')}`, minutes: mins });
    router.push({
      pathname: '/subject-picker',
      params: {
        sessionLength: String(mins),
        ...(breakMins > 0 ? { breakMinutes: String(breakMins) } : {}),
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
      },
    });
  };

  return (
    <ImageBackground source={SCREEN_BG} style={styles.screen} resizeMode="cover">
      <View style={styles.bgOverlay} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.one }]}>
          <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} onPress={goBack} hitSlop={8}>
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{t('customTimer.title')}</Text>
            <Text style={styles.subtitle}>{t('customTimer.subtitle')}</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.coinPill, pressed && styles.pressed]} onPress={() => router.push('/coin-shop')}>
            <CoinIcon size={18} />
            <Text style={styles.coinText}>{coins}</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Focus (or break) duration */}
          <Text style={styles.sectionLabel}>{t(isBreakMode ? 'customTimer.breakDuration' : 'customTimer.focusDuration')}</Text>
          <View style={styles.durCard}>
            <WheelColumn values={HR_VALUES} value={focusHr} unit="hr" onChange={setFocusHr} />
            <View style={styles.durDivider} />
            <WheelColumn values={MIN_VALUES} value={focusMin} unit="min" onChange={setFocusMin} loop />
          </View>
          <View style={styles.pickRow}>
            {(isBreakMode ? BREAK_PICKS : FOCUS_PICKS).map((m) => (
              <Pressable key={m} onPress={() => { playTick(); setFocusTotal(m); }} style={[styles.pick, focusMins === m && styles.pickActive]}>
                <Text style={[styles.pickText, focusMins === m && styles.pickTextActive]}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          {!isBreakMode && (
            <>
              {/* Break duration */}
              <Text style={styles.sectionLabel}>{t('customTimer.breakDuration')}</Text>
              <Text style={styles.sectionSub}>{t('customTimer.optionalBreak')}</Text>
              <View style={styles.durCard}>
                <WheelColumn values={HR_VALUES} value={breakHr} unit="hr" onChange={setBreakHr} />
                <View style={styles.durDivider} />
                <WheelColumn values={MIN_VALUES} value={breakMin} unit="min" onChange={setBreakMin} loop />
              </View>
              <View style={styles.pickRow}>
                {BREAK_PICKS.map((m) => (
                  <Pressable key={m} onPress={() => { playTick(); setBreakTotal(m); }} style={[styles.pick, breakMins === m && styles.pickActive]}>
                    <Text style={[styles.pickText, breakMins === m && styles.pickTextActive]}>{m}m</Text>
                  </Pressable>
                ))}
              </View>

              {/* Subject */}
              <Text style={styles.sectionLabel}>{t('customTimer.subjectHeader')}</Text>
              <View style={styles.softCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {activeSubjects.map((s) => {
                    const isActive = selectedSubjectId === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.chip, { borderColor: isActive ? s.color : C.shortbread, backgroundColor: isActive ? s.color + '2E' : '#fff' }]}
                        onPress={() => setSelectedSubjectId(isActive ? null : s.id)}>
                        <Text style={[styles.chipText, isActive && { color: s.color }]}>{s.emoji ? `${s.emoji} ` : ''}{s.name}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => router.push('/manage-subjects')}>
                    <Text style={[styles.chipText, { color: C.berry }]}>{t('common.addChip')}</Text>
                  </Pressable>
                </ScrollView>
              </View>

              {/* Save as preset */}
              <View style={styles.presetCard}>
                <View style={styles.presetTop}>
                  <View style={styles.presetTextWrap}>
                    <Text style={styles.presetTitle}>{t('customTimer.savePresetTitle')}</Text>
                    <Text style={styles.presetSub}>{t('customTimer.savePresetSub')}</Text>
                  </View>
                  <Switch
                    value={savePreset}
                    onValueChange={setSavePreset}
                    trackColor={{ false: C.shortbread, true: C.jam }}
                    thumbColor="#fff"
                  />
                </View>
                {savePreset && (
                  <TextInput
                    style={styles.presetInput}
                    value={presetName}
                    onChangeText={setPresetName}
                    placeholder={t('customTimer.presetNamePlaceholder')}
                    placeholderTextColor={C.latte}
                    returnKeyType="done"
                  />
                )}
              </View>
            </>
          )}

          {/* Start */}
          <SoundPressable sound="confirm" style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]} onPress={handleStart}>
            <Text style={styles.startBtnText}>{t('customTimer.startSession')}  →</Text>
          </SoundPressable>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  safe: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,252,247,0.4)' },
  scroll: { paddingBottom: Spacing.four, gap: Spacing.one },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.two, gap: Spacing.two },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { fontSize: 22, fontWeight: '800', color: C.cocoaDark, marginTop: -2 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: C.cocoaDark, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, color: C.mocha, fontWeight: '600' },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill, paddingHorizontal: 9, paddingVertical: 6,
  },
  coinText: { fontSize: 13, fontWeight: '800', color: C.cocoaDark },

  // Section labels
  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.latte, letterSpacing: 1, marginTop: Spacing.two },
  sectionSub: { fontSize: 11, color: C.mocha, marginTop: -2 },

  // Duration card with steppers
  durCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: BakeryRadii.card,
    borderWidth: 1.5, borderColor: 'rgba(195,143,114,0.18)',
    paddingVertical: Spacing.three, marginTop: 4, ...BakeryShadow,
  },
  durDivider: { width: 1.5, height: 96, backgroundColor: C.shortbread, marginHorizontal: Spacing.four },
  // Scroll wheel
  wheel: { alignItems: 'center', minWidth: 96 },
  wheelHighlight: {
    position: 'absolute', top: ITEM_H, height: ITEM_H, left: 6, right: 6,
    borderRadius: 12, backgroundColor: 'rgba(195,143,114,0.12)',
  },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelNum: { fontSize: 24, fontWeight: '800', color: C.latte, lineHeight: 28 },
  wheelNumActive: { fontSize: 32, fontWeight: '900', color: C.berry, lineHeight: 34 },
  wheelUnit: { fontSize: 12, fontWeight: '700', color: C.mocha, marginTop: 2 },

  // Quick picks
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' },
  pick: {
    borderRadius: BakeryRadii.pill, borderWidth: 1.5, borderColor: C.shortbread,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8,
  },
  pickActive: { backgroundColor: C.jam, borderColor: C.jam },
  pickText: { fontSize: 13, fontWeight: '800', color: C.mocha },
  pickTextActive: { color: '#fff' },

  // Subject card
  softCard: {
    backgroundColor: '#fff', borderRadius: BakeryRadii.card,
    borderWidth: 1.5, borderColor: 'rgba(195,143,114,0.18)',
    paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, marginTop: 4, ...BakeryShadow,
  },
  chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 8 },
  chip: { borderRadius: BakeryRadii.pill, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 8 },
  chipAdd: { borderColor: C.jam, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipText: { fontSize: 13.5, color: C.mocha, fontWeight: '700' },

  // Save as preset
  presetCard: {
    backgroundColor: '#fff', borderRadius: BakeryRadii.card,
    borderWidth: 1.5, borderColor: 'rgba(195,143,114,0.18)',
    padding: Spacing.three, marginTop: 4, gap: Spacing.two, ...BakeryShadow,
  },
  presetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presetTextWrap: { flex: 1 },
  presetTitle: { fontSize: 12, fontWeight: '800', color: C.cocoaDark, letterSpacing: 0.5 },
  presetSub: { fontSize: 11.5, color: C.mocha, marginTop: 1 },
  presetInput: {
    borderWidth: 1.5, borderColor: C.shortbread, borderRadius: BakeryRadii.button,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.cocoaDark, backgroundColor: C.frosting,
  },

  // Start
  startBtn: {
    backgroundColor: '#F2A9BC', borderRadius: BakeryRadii.pill,
    paddingVertical: 16, alignItems: 'center', marginTop: Spacing.three, ...BakeryShadow,
  },
  startBtnText: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },

  pressed: { opacity: 0.85 },
});
