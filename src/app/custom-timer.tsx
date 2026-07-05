import { router, useLocalSearchParams } from 'expo-router';
import { formatCoins } from '@/constants/placeholder-data';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { playTick } from '@/lib/sounds';
import { showPopup } from '@/lib/popup';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { useApp, MAX_TIMER_PRESETS } from '@/context/app-context';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { formatMinutesShort } from '@/lib/format-duration';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const C = BakeryColors;
const SCREEN_BG = require('@/assets/images/home/session-bg-cakes.png');

const FOCUS_PICKS = [15, 25, 45, 60, 90];
const BREAK_PICKS = [5, 10, 15, 20, 30];

type TimerMode = 'focus' | 'break';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const HR_VALUES = range(0, 5);
const MIN_VALUES = range(1, 59); // 1-minute steps, never 0
const ITEM_H = 58; // taller rows = bigger, more forgiving touch targets (less accidental over-scroll)
const LOOP_REPEAT = 7; // copies stacked to fake an endless (wrapping) wheel
const LOOP_CENTER = Math.floor(LOOP_REPEAT / 2);

// The scroll wheel keeps fixed sizes (so its ITEM_H snap math stays exact), so it
// uses its own static stylesheet rather than the screen's tablet-scaled `makeStyles`.
const wheelStyles = StyleSheet.create({
  wheel: { alignItems: 'center', minWidth: 96 },
  wheelHighlight: {
    position: 'absolute', top: ITEM_H, height: ITEM_H, left: 6, right: 6,
    borderRadius: 12, backgroundColor: 'rgba(195,143,114,0.12)',
  },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelNum: { fontSize: 24, fontWeight: '800', color: C.latte, lineHeight: 28 },
  wheelNumActive: { fontSize: 32, fontWeight: '900', color: C.berry, lineHeight: 34 },
  wheelUnit: { fontSize: 12, fontWeight: '700', color: C.mocha, marginTop: 2 },
});

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
    <View style={wheelStyles.wheel}>
      <View style={wheelStyles.wheelHighlight} pointerEvents="none" />
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
          <View key={i} style={wheelStyles.wheelItem}>
            <Text style={[wheelStyles.wheelNum, v === value && wheelStyles.wheelNumActive]}>{String(v).padStart(2, '0')}</Text>
          </View>
        ))}
      </ScrollView>
      <Text style={wheelStyles.wheelUnit}>{unit}</Text>
    </View>
  );
}

export default function CustomTimerScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Tablet: scale the buttons/chips/cards/text up (the wheel keeps its fixed item
  // height so its scroll-snap math stays exact).
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { mode, from } = useLocalSearchParams<{ mode?: TimerMode; from?: string }>();
  const isBreakMode = mode === 'break';
  // Opened from Settings the screen is a pure preset editor: no session gets
  // started from here, so the Start button and subject picker are hidden and
  // the saved presets are listed for managing/deleting instead.
  const isPresetEditor = from === 'settings';
  const { subjects, saveTimerPreset, deleteTimerPreset, savedTimerPresets, isPlus, coins } = useApp();

  const [focusHr, setFocusHr] = useState(0);
  const [focusMin, setFocusMin] = useState(isBreakMode ? 10 : 45);
  const [breakHr, setBreakHr] = useState(0);
  const [breakMin, setBreakMin] = useState(10);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  // When the user is at the preset cap and asks to save, we can't just drop the
  // oldest — we open this picker so they choose which one the new preset replaces.
  const [showReplace, setShowReplace] = useState(false);

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

  // Navigate into the session. Kept separate from handleStart so both the normal
  // path and the "replace a preset" confirm can reuse it.
  const goToSession = (mins: number) =>
    router.push({
      pathname: '/subject-picker',
      params: {
        sessionLength: String(mins),
        ...(breakMins > 0 ? { breakMinutes: String(breakMins) } : {}),
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
      },
    });

  const savePresetNow = (mins: number) => {
    saveTimerPreset({ label: presetName.trim() || `${mins} ${t('customTimer.min')}`, minutes: mins, breakMinutes: breakMins });
    setPresetName('');
    showPopup(t('customTimer.presetSaved'));
  };

  const handleStart = () => {
    const mins = focusMins;
    if (mins < 1 || mins > 300) { showPopup(t('customTimer.between1And300')); return; }
    if (isBreakMode) {
      router.replace({ pathname: '/break-game', params: { breakMinutes: String(mins), fromSession: '1' } });
      return;
    }
    goToSession(mins);
  };

  // Add the current focus duration to the saved presets (no session start). At the
  // cap we open the replace picker so the user chooses which preset to overwrite.
  const handleAddPreset = () => {
    const mins = focusMins;
    if (mins < 1 || mins > 300) { showPopup(t('customTimer.between1And300')); return; }
    if (savedTimerPresets.length >= MAX_TIMER_PRESETS) { setShowReplace(true); return; }
    savePresetNow(mins);
  };

  // Chosen slot to overwrite: delete it, then save the new preset in its place.
  const replaceWith = (id: string) => {
    deleteTimerPreset(id);
    savePresetNow(focusMins);
    setShowReplace(false);
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
            <Text style={styles.coinText}>{formatCoins(coins)}</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Focus (or break) duration */}
          <Text style={styles.sectionLabel}>{t(isBreakMode ? 'customTimer.breakDuration' : 'customTimer.focusDuration')}</Text>
          <View style={styles.durCard}>
            <WheelColumn values={HR_VALUES} value={focusHr} unit={t('customTimer.hr')} onChange={setFocusHr} />
            <View style={styles.durDivider} />
            <WheelColumn values={MIN_VALUES} value={focusMin} unit={t('customTimer.min')} onChange={setFocusMin} loop />
          </View>
          <View style={styles.pickRow}>
            {(isBreakMode ? BREAK_PICKS : FOCUS_PICKS).map((m) => (
              <Pressable key={m} onPress={() => { playTick(); setFocusTotal(m); }} style={[styles.pick, focusMins === m && styles.pickActive]}>
                <Text style={[styles.pickText, focusMins === m && styles.pickTextActive]}>{formatMinutesShort(m, t)}</Text>
              </Pressable>
            ))}
          </View>

          {!isBreakMode && (
            <>
              {/* Break duration */}
              <Text style={styles.sectionLabel}>{t('customTimer.breakDuration')}</Text>
              <Text style={styles.sectionSub}>{t('customTimer.optionalBreak')}</Text>
              <View style={styles.durCard}>
                <WheelColumn values={HR_VALUES} value={breakHr} unit={t('customTimer.hr')} onChange={setBreakHr} />
                <View style={styles.durDivider} />
                <WheelColumn values={MIN_VALUES} value={breakMin} unit={t('customTimer.min')} onChange={setBreakMin} loop />
              </View>
              <View style={styles.pickRow}>
                {BREAK_PICKS.map((m) => (
                  <Pressable key={m} onPress={() => { playTick(); setBreakTotal(m); }} style={[styles.pick, breakMins === m && styles.pickActive]}>
                    <Text style={[styles.pickText, breakMins === m && styles.pickTextActive]}>{formatMinutesShort(m, t)}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Subject — only when a session can be started from here (a preset
                  doesn't store a subject, so the editor hides the picker). */}
              {!isPresetEditor && (
                <>
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
                            <Text style={[styles.chipText, isActive && { color: s.color }]}>{s.emoji ? `${s.emoji} ` : ''}{localizeSubjectName(s.name, t)}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => router.push('/manage-subjects')}>
                        <Text style={[styles.chipText, { color: C.berry }]}>{t('common.addChip')}</Text>
                      </Pressable>
                    </ScrollView>
                  </View>
                </>
              )}

              {/* Save as preset — add the current duration to your saved presets
                  without starting a session. */}
              <View style={styles.presetCard}>
                <View style={styles.presetTextWrap}>
                  <Text style={styles.presetTitle}>{t('customTimer.savePresetTitle')}</Text>
                  <Text style={styles.presetSub}>{t('customTimer.savePresetSub')}</Text>
                </View>
                <TextInput
                  style={styles.presetInput}
                  value={presetName}
                  onChangeText={setPresetName}
                  placeholder={t('customTimer.presetNamePlaceholder')}
                  placeholderTextColor={C.latte}
                  returnKeyType="done"
                />
                <SoundPressable
                  sound="confirm"
                  style={({ pressed }) => [styles.addPresetBtn, pressed && styles.pressed]}
                  onPress={handleAddPreset}>
                  <Text style={styles.addPresetText}>＋ {t('customTimer.addPreset')}</Text>
                </SoundPressable>
              </View>

              {/* Your saved presets — editor mode only: manage/delete them here. */}
              {isPresetEditor && (
                <>
                  <Text style={styles.sectionLabel}>{t('sessionPicker.presetsHeader')}</Text>
                  {savedTimerPresets.length === 0 ? (
                    <View style={styles.softCard}>
                      <Text style={styles.noPresetsText}>{t('customTimer.noPresets')}</Text>
                    </View>
                  ) : (
                    <View style={styles.presetList}>
                      {savedTimerPresets.map((p) => (
                        <View key={p.id} style={styles.replaceRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.replaceRowName} numberOfLines={1}>{p.label}</Text>
                            <Text style={styles.replaceRowMins}>
                              {p.minutes} {t('customTimer.min')}
                              {p.breakMinutes ? ` · ${t('sessionPicker.menuBreak', { min: p.breakMinutes })}` : ''}
                            </Text>
                          </View>
                          <Pressable
                            hitSlop={10}
                            style={({ pressed }) => [styles.presetDelete, pressed && styles.pressed]}
                            onPress={() => deleteTimerPreset(p.id)}
                            accessibilityLabel={t('common.delete')}>
                            <Text style={styles.presetDeleteText}>✕</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* Start — hidden in the Settings preset editor (nothing to start there). */}
          {!isPresetEditor && (
            <SoundPressable sound="confirm" style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]} onPress={handleStart}>
              <Text style={styles.startBtnText}>{t('customTimer.startSession')}  →</Text>
            </SoundPressable>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Replace-a-preset picker. Rendered as an in-tree overlay (NOT a native
          Modal) so it can't stack on top of another modal and trip the freeze
          guard. Shown only when the user is at the preset cap and hit Start with
          "save as preset" on. */}
      {showReplace && (
        <View style={styles.overlay}>
          <View style={styles.replaceCard}>
            <Text style={styles.replaceTitle}>{t('customTimer.presetLimitTitle')}</Text>
            <Text style={styles.replaceSub}>{t('customTimer.presetLimitSub', { max: MAX_TIMER_PRESETS })}</Text>
            <ScrollView style={styles.replaceList} contentContainerStyle={{ gap: Spacing.two * scale }}>
              {savedTimerPresets.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.replaceRow, pressed && styles.pressed]}
                  onPress={() => replaceWith(p.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.replaceRowName} numberOfLines={1}>{p.label}</Text>
                    <Text style={styles.replaceRowMins}>{p.minutes} {t('customTimer.min')}</Text>
                  </View>
                  <Text style={styles.replaceRowAction}>{t('customTimer.replaceAction')}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={({ pressed }) => [styles.replaceCancel, pressed && styles.pressed]} onPress={() => setShowReplace(false)}>
              <Text style={styles.replaceCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

// `s` = shared tablet scale (1 on phone). Buttons/chips/cards/text × s so they're not
// phone-tiny on iPad; the wheel keeps its fixed ITEM_H so its scroll-snap stays exact.
const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  safe: { flex: 1, paddingHorizontal: Spacing.four * s, maxWidth: contentWidth, width: '100%', alignSelf: 'center' },
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,252,247,0.4)' },
  scroll: { paddingBottom: Spacing.four * s, gap: Spacing.one * s },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.two * s, gap: Spacing.two * s },
  iconBtn: {
    width: 38 * s, height: 38 * s, borderRadius: 19 * s,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { fontSize: 22 * s, fontWeight: '800', color: C.cocoaDark, marginTop: -2 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20 * s, fontWeight: '900', color: C.cocoaDark, letterSpacing: 0.2 },
  subtitle: { fontSize: 12 * s, color: C.mocha, fontWeight: '600' },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5 * s,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill, paddingHorizontal: 9 * s, paddingVertical: 6 * s,
  },
  coinText: { fontSize: 13 * s, fontWeight: '800', color: C.cocoaDark },

  // Section labels
  sectionLabel: { fontSize: 11 * s, fontWeight: '800', color: C.latte, letterSpacing: 1, marginTop: Spacing.two * s },
  sectionSub: { fontSize: 11 * s, color: C.mocha, marginTop: -2 },

  // Duration card with steppers
  durCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: BakeryRadii.card * s,
    borderWidth: 1.5, borderColor: 'rgba(195,143,114,0.18)',
    paddingVertical: Spacing.three * s, marginTop: 4 * s, ...BakeryShadow,
  },
  durDivider: { width: 1.5, height: 96, backgroundColor: C.shortbread, marginHorizontal: Spacing.four * s },
  // (Scroll-wheel styles live in `wheelStyles` — unscaled so its snap math is exact.)

  // Quick picks
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 * s, marginTop: 8 * s, justifyContent: 'center' },
  pick: {
    borderRadius: BakeryRadii.pill, borderWidth: 1.5, borderColor: C.shortbread,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16 * s, paddingVertical: 8 * s,
  },
  pickActive: { backgroundColor: C.jam, borderColor: C.jam },
  pickText: { fontSize: 13 * s, fontWeight: '800', color: C.mocha },
  pickTextActive: { color: '#fff' },

  // Subject card
  softCard: {
    backgroundColor: '#fff', borderRadius: BakeryRadii.card * s,
    borderWidth: 1.5, borderColor: 'rgba(195,143,114,0.18)',
    paddingVertical: Spacing.two * s, paddingHorizontal: Spacing.two * s, marginTop: 4 * s, ...BakeryShadow,
  },
  chipRow: { flexDirection: 'row', gap: 8 * s, alignItems: 'center', paddingRight: 8 * s },
  chip: { borderRadius: BakeryRadii.pill, borderWidth: 1.5, paddingHorizontal: 13 * s, paddingVertical: 8 * s },
  chipAdd: { borderColor: C.jam, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipText: { fontSize: 13.5 * s, color: C.mocha, fontWeight: '700' },

  // Save as preset
  presetCard: {
    backgroundColor: '#fff', borderRadius: BakeryRadii.card * s,
    borderWidth: 1.5, borderColor: 'rgba(195,143,114,0.18)',
    padding: Spacing.three * s, marginTop: 4 * s, gap: Spacing.two * s, ...BakeryShadow,
  },
  presetTextWrap: { flex: 1 },
  presetTitle: { fontSize: 12 * s, fontWeight: '800', color: C.cocoaDark, letterSpacing: 0.5 },
  presetSub: { fontSize: 11.5 * s, color: C.mocha, marginTop: 1 },
  presetInput: {
    borderWidth: 1.5, borderColor: C.shortbread, borderRadius: BakeryRadii.button,
    paddingHorizontal: 12 * s, paddingVertical: 10 * s, fontSize: 14 * s, color: C.cocoaDark, backgroundColor: C.frosting,
  },
  addPresetBtn: {
    borderRadius: BakeryRadii.pill, borderWidth: 1.5, borderColor: C.jam,
    backgroundColor: 'rgba(228,138,154,0.12)', paddingVertical: 11 * s, alignItems: 'center',
  },
  addPresetText: { fontSize: 14 * s, fontWeight: '900', color: C.berry, letterSpacing: 0.2 },

  // Saved-presets list (Settings preset-editor mode)
  presetList: { gap: Spacing.two * s, marginTop: 4 * s },
  noPresetsText: { fontSize: 13 * s, color: C.mocha, fontWeight: '600', textAlign: 'center', paddingVertical: Spacing.two * s },
  presetDelete: {
    width: 26 * s, height: 26 * s, borderRadius: 13 * s, marginLeft: 4 * s,
    alignItems: 'center', justifyContent: 'center', backgroundColor: `${C.shortbread}80`,
  },
  presetDeleteText: { fontSize: 12 * s, color: C.mocha, fontWeight: '800', lineHeight: 14 * s },

  // Start
  startBtn: {
    backgroundColor: '#F2A9BC', borderRadius: BakeryRadii.pill,
    paddingVertical: 16 * s, alignItems: 'center', marginTop: Spacing.three * s, ...BakeryShadow,
  },
  startBtnText: { fontSize: 17 * s, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },

  // Replace-a-preset overlay (in-tree, not a native Modal)
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(74,49,42,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.four * s,
  },
  replaceCard: {
    width: '100%', maxWidth: 420 * s,
    backgroundColor: C.frosting, borderRadius: BakeryRadii.card * s,
    borderWidth: 1.5, borderColor: C.shortbread,
    padding: Spacing.four * s, gap: Spacing.two * s, ...BakeryShadow,
  },
  replaceTitle: { fontSize: 18 * s, fontWeight: '900', color: C.cocoaDark, textAlign: 'center' },
  replaceSub: { fontSize: 13 * s, color: C.mocha, textAlign: 'center', fontWeight: '600', marginBottom: Spacing.one * s },
  replaceList: { maxHeight: 260 * s },
  replaceRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s,
    backgroundColor: '#fff', borderRadius: BakeryRadii.button,
    borderWidth: 1.5, borderColor: C.shortbread,
    paddingHorizontal: 14 * s, paddingVertical: 12 * s,
  },
  replaceRowName: { fontSize: 14.5 * s, fontWeight: '800', color: C.cocoaDark },
  replaceRowMins: { fontSize: 12 * s, fontWeight: '600', color: C.mocha, marginTop: 1 },
  replaceRowAction: { fontSize: 13 * s, fontWeight: '900', color: C.berry },
  replaceCancel: { alignItems: 'center', paddingVertical: 8 * s },
  replaceCancelText: { fontSize: 14 * s, fontWeight: '800', color: C.mocha },

  pressed: { opacity: 0.85 },
});
