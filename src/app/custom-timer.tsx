import { router, useLocalSearchParams } from 'expo-router';
import { setPendingDragSession } from '@/lib/drag-session';
import { formatCoins } from '@/constants/placeholder-data';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { playTick } from '@/lib/sounds';
import { showPopup } from '@/lib/popup';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

import { CoinIcon } from '@/components/coin-icon';
import { FitText } from '@/components/fit-text';
import {
  BiscuitStick, CAFE, CAFE_SOFT_SHADOW, Drip, Gingham, SPRINKLES, SPRINKLES_REV, SprinkleLabel,
  dessertForMinutes, useBiscuitStick,
} from '@/components/cafe-ui';
import { useApp, MAX_TIMER_PRESETS } from '@/context/app-context';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { formatMinutesShort } from '@/lib/format-duration';
import { Fonts } from '@/constants/theme';

// "Custom Recipe" — the soft-café sibling of the Start Baking menu (2026-11-20).
// Same café base (cream gingham, latte lines, serif title, sprinkle labels, drip,
// biscuit-stick slider) but it reads as a RECIPE CARD, not a menu: a caramel/
// apricot accent (matching its "Custom Bake" card on the Start screen), faint
// ruled index-card lines, the time wheel set in a warm "oven window", length picks
// tinted with the matching dessert, and matcha-green tea-break picks.
const RECIPE = {
  header: '#FDE8CC',
  ink: '#8A5320',
  soft: '#FFF4E6',
  ring: '#F0D3A8',
  window: '#FFF6EA',
  windowLine: '#F2DCBC',
  handle: '#E2B47C',
  highlight: '#FDE3C3',
  rule: 'rgba(214,180,140,0.22)',
  margin: '#F3C1C9',
  track: '#FBE6CC',
  coat: '#E9A55E',
  btn: '#C47A3A',
} as const;
const MATCHA = { bg: '#F3F7EA', line: '#DCE8C8', ink: '#46602A', onBg: '#DDEBC6', onLine: '#7E9E5A' } as const;

const FOCUS_PICKS = [15, 25, 45, 60, 90];
// Breaks are fixed picks everywhere in the app (no custom break lengths): off/5/10/15/30.
const BREAK_PICKS = [0, 5, 10, 15, 30];

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const HR_VALUES = range(0, 5);
const MIN_VALUES = range(0, 59); // Include :00 for whole-hour presets.
const ITEM_H = 44;
const LOOP_REPEAT = 7; // copies stacked to fake an endless (wrapping) wheel
const LOOP_CENTER = Math.floor(LOOP_REPEAT / 2);

// The scroll wheel keeps fixed sizes (so its ITEM_H snap math stays exact), so it
// uses its own static stylesheet rather than the screen's tablet-scaled `makeStyles`.
const wheelStyles = StyleSheet.create({
  wheel: { alignItems: 'center', width: 100 },
  wheelHighlight: {
    position: 'absolute', top: ITEM_H, height: ITEM_H, left: 6, right: 6,
    borderRadius: 12, backgroundColor: RECIPE.highlight,
  },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelNum: { fontFamily: Fonts.rounded, fontSize: 19, fontWeight: '600', color: '#D2BBA8', lineHeight: 26, fontVariant: ['tabular-nums'] },
  wheelNumActive: { fontSize: 30, fontWeight: '800', color: RECIPE.ink, lineHeight: 36 },
  wheelUnit: { fontFamily: Fonts.rounded, fontSize: 12, fontWeight: '800', color: CAFE.inkSoft, marginTop: 6 },
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

/** Faint ruled lines + a pink top rule, like an index recipe card. */
function RecipeCardLines({ g }: { g: number }) {
  const gap = 28 * g;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="recipeRules" width={10} height={gap} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={gap - 0.5} x2={10} y2={gap - 0.5} stroke={RECIPE.rule} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#recipeRules)" />
      <Line x1={0} y1={1} x2="100%" y2={1} stroke={RECIPE.margin} strokeWidth={1.5} />
    </Svg>
  );
}

/** A length pick (quick tile or saved-recipe tag): a little dot in its dessert's
 *  colour; when picked it fills with that dessert's pastel. Module-level so the
 *  subject slider's scroll updates don't remount every pick. */
function LengthPick({ m, label, shape, on, onPick, styles }: {
  m: number; label: string; shape: 'tile' | 'tag'; on: boolean; onPick: (m: number) => void; styles: RecipeStyles;
}) {
  const d = dessertForMinutes(m);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => onPick(m)}
      style={[shape === 'tile' ? styles.tile : styles.tag, on ? { backgroundColor: d.pill, borderColor: d.ring } : null]}>
      <View style={[styles.pickDot, { backgroundColor: on ? d.ink : d.coat }]} />
      <FitText numberOfLines={1} minScale={0.7} style={[styles.pickText, { color: on ? d.pillText : CAFE.inkSoft }]}>{label}</FitText>
    </Pressable>
  );
}

export default function CustomTimerScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Tablet: scale the buttons/chips/cards/text up (the wheel keeps its fixed item
  // height so its scroll-snap math stays exact).
  const { scale, contentWidth } = useTabletScale();
  const g = scale;
  const styles = useMemo(() => makeStyles(g, contentWidth), [g, contentWidth]);
  const { from } = useLocalSearchParams<{ from?: string }>();
  // Opened from Settings the screen is a pure preset editor: no session gets
  // started from here, so the Start button and subject picker are hidden and
  // the saved presets are listed for managing/deleting instead.
  const isPresetEditor = from === 'settings';
  const { subjects, saveTimerPreset, deleteTimerPreset, savedTimerPresets, coins } = useApp();

  const [focusHr, setFocusHr] = useState(0);
  const [focusMin, setFocusMin] = useState(45);
  const [breakMins, setBreakMins] = useState(10);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  // When the user is at the preset cap and asks to save, we can't just drop the
  // oldest — we open this picker so they choose which one the new preset replaces.
  const [showReplace, setShowReplace] = useState(false);
  // Food-shaped slider under the subject tags (no scrollbar), like the Start menu.
  const chipStick = useBiscuitStick();

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const focusMins = focusHr * 60 + focusMin;
  // Back should return to the session (timer) screen, not all the way home.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/session-picker');
  };

  const setFocusTotal = (m: number) => { setFocusHr(Math.floor(m / 60)); setFocusMin(m % 60); };
  const pickLength = (m: number) => { playTick(); setFocusTotal(m); };

  // Navigate into the session. Kept separate from handleStart so both the normal
  // path and the "replace a preset" confirm can reuse it.
  const goToSession = (mins: number) => {
    const subjectName = selectedSubjectId
      ? subjects.find((s) => s.id === selectedSubjectId && !s.archived)?.name ?? null
      : null;
    setPendingDragSession({
      durationMinutes: mins,
      subjectName,
      taskId: null,
      taskTitle: null,
      ...(breakMins > 0 ? { breakMinutes: breakMins } : {}),
    });
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  // Presets are session-length ONLY (no name, no break — breaks are always picked
  // fresh from the fixed quick pills). The label is just the formatted duration.
  const savePresetNow = (mins: number) => {
    saveTimerPreset({ label: formatMinutesShort(mins, t), minutes: mins });
    showPopup(t('customTimer.presetSaved'));
  };

  const handleStart = () => {
    const mins = focusMins;
    if (mins < 1 || mins > 300) { showPopup(t('customTimer.between1And300')); return; }
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
    <View style={styles.screen}>
      <Gingham />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Top bar — back + coin pill (same as the Start menu) */}
        <View style={[styles.topBar, { paddingTop: insets.top + 4 * g }]}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}>
            <Svg width={18 * g} height={18 * g} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5l-7 7 7 7" stroke={CAFE.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={styles.topSpacer} />
          <Pressable style={({ pressed }) => [styles.coinPill, pressed && styles.pressed]} onPress={() => router.push('/coin-shop')}>
            <CoinIcon size={22 * g} />
            <Text style={styles.coinText}>{formatCoins(coins)}</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* The recipe card */}
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.kicker}>{t('sessionPicker.cafeKicker')}</Text>
                <FitText numberOfLines={1} minScale={0.6} style={styles.title}>{t('customTimer.title')}</FitText>
              </View>
              <Drip color={RECIPE.header} height={12 * g} />

              <View style={styles.cardBody}>
                <RecipeCardLines g={g} />

                {/* Oven time — the wheel sits in a warm oven window */}
                <SprinkleLabel text={t('customTimer.focusDuration')} dots={SPRINKLES} g={g} />
                <View style={styles.ovenWindow}>
                  <View style={styles.ovenHandle} />
                  <View style={styles.wheelRow}>
                    <WheelColumn values={HR_VALUES} value={focusHr} unit={t('customTimer.hr')} onChange={setFocusHr} />
                    <Text style={styles.wheelColon}>:</Text>
                    <WheelColumn values={MIN_VALUES} value={focusMin} unit={t('customTimer.min')} onChange={setFocusMin} loop />
                  </View>
                </View>
                <View style={styles.tileRow}>
                  {FOCUS_PICKS.map((m) => <LengthPick key={m} m={m} label={formatMinutesShort(m, t)} shape="tile" on={focusMins === m} onPick={pickLength} styles={styles} />)}
                </View>

                {/* Saved recipes — length-only presets; ＋ saves the dialed time.
                    At the cap the replace picker makes the user choose one to swap. */}
                <SprinkleLabel text={t('sessionPicker.presetsHeader')} dots={SPRINKLES_REV} g={g} />
                <View style={styles.tagRow}>
                  {savedTimerPresets.map((p) => <LengthPick key={p.id} m={p.minutes} label={formatMinutesShort(p.minutes, t)} shape="tag" on={focusMins === p.minutes} onPick={pickLength} styles={styles} />)}
                  <SoundPressable
                    sound="confirm"
                    onPress={handleAddPreset}
                    style={({ pressed }) => [styles.tag, styles.tagAdd, pressed && styles.pressed]}>
                    <Text style={[styles.pickText, styles.tagAddText]}>{t('common.addChip')}</Text>
                  </SoundPressable>
                </View>

                {/* Tea break — fixed matcha picks (no break / 5 / 10 / 15 / 30) */}
                <SprinkleLabel text={t('customTimer.breakDuration')} dots={SPRINKLES} g={g} />
                <View style={styles.tileRow}>
                  {BREAK_PICKS.map((m) => {
                    const on = breakMins === m;
                    return (
                      <Pressable
                        key={m}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => { playTick(); setBreakMins(m); }}
                        style={[styles.teaTile, m === 0 && styles.teaTileWide, on && styles.teaTileOn]}>
                        <FitText numberOfLines={1} minScale={0.65} style={[styles.teaText, on && styles.teaTextOn]}>
                          {m === 0 ? t('customTimer.noBreak') : formatMinutesShort(m, t)}
                        </FitText>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Flavor (subject) — only when a bake can start from here (a preset
                    doesn't store a subject, so the Settings editor hides it). */}
                {!isPresetEditor && (
                  <>
                    <SprinkleLabel text={t('sessionPicker.flavorHeader')} dots={SPRINKLES_REV} g={g} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} {...chipStick.scrollProps}>
                      {activeSubjects.map((s) => {
                        const on = selectedSubjectId === s.id;
                        return (
                          <Pressable
                            key={s.id}
                            style={[styles.chip, { backgroundColor: `${s.color}1F`, borderColor: on ? s.color : `${s.color}1F` }]}
                            onPress={() => setSelectedSubjectId(on ? null : s.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}>
                            <View style={[styles.chipDot, { backgroundColor: s.color }]} />
                            <Text style={styles.chipText}>{s.emoji ? `${s.emoji} ` : ''}{localizeSubjectName(s.name, t)}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => router.push('/manage-subjects')} accessibilityRole="button">
                        <Text style={[styles.chipText, styles.chipAddText]}>{t('common.addChip')}</Text>
                      </Pressable>
                    </ScrollView>
                    <BiscuitStick view={chipStick.view} track={RECIPE.track} coat={RECIPE.coat} g={g} />
                  </>
                )}

                {/* Saved recipes list — Settings editor only: manage/delete them here. */}
                {isPresetEditor && (
                  <View style={styles.editorList}>
                    {savedTimerPresets.length === 0 ? (
                      <Text style={styles.noPresetsText}>{t('customTimer.noPresets')}</Text>
                    ) : (
                      savedTimerPresets.map((p) => {
                        const d = dessertForMinutes(p.minutes);
                        return (
                          <View key={p.id} style={[styles.recipeRow, { backgroundColor: d.soft, borderColor: d.ring }]}>
                            <View style={[styles.recipeRowDot, { backgroundColor: d.coat }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.recipeRowName, { color: d.ink }]} numberOfLines={1}>{p.label}</Text>
                              <Text style={styles.recipeRowMins}>{p.minutes} {t('customTimer.min')}</Text>
                            </View>
                            <Pressable
                              hitSlop={10}
                              style={({ pressed }) => [styles.recipeDelete, pressed && styles.pressed]}
                              onPress={() => deleteTimerPreset(p.id)}
                              accessibilityRole="button"
                              accessibilityLabel={t('common.delete')}>
                              <Svg width={10 * g} height={10 * g} viewBox="0 0 10 10">
                                <Path d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5" stroke={CAFE.inkSoft} strokeWidth={1.8} strokeLinecap="round" />
                              </Svg>
                            </Pressable>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Start — pinned under the card; hidden in the Settings recipe editor. */}
        {!isPresetEditor && (
          <View style={styles.startBlock}>
            <SoundPressable sound="confirm" style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]} onPress={handleStart}>
              <Text style={styles.startBtnText}>{t('customTimer.startSession')}  →</Text>
            </SoundPressable>
          </View>
        )}
      </SafeAreaView>

      {/* Replace-a-recipe picker. Rendered as an in-tree overlay (NOT a native
          Modal) so it can't stack on top of another modal and trip the freeze
          guard. Shown only when the recipe box is full and the user taps ＋. */}
      {showReplace && (
        <View style={styles.overlay}>
          <View style={styles.replaceCard}>
            <Text style={styles.replaceTitle}>{t('customTimer.presetLimitTitle')}</Text>
            <Text style={styles.replaceSub}>{t('customTimer.presetLimitSub', { max: MAX_TIMER_PRESETS })}</Text>
            <ScrollView style={styles.replaceList} contentContainerStyle={{ gap: 8 * g }}>
              {savedTimerPresets.map((p) => {
                const d = dessertForMinutes(p.minutes);
                return (
                  <Pressable
                    key={p.id}
                    style={({ pressed }) => [styles.recipeRow, { backgroundColor: d.soft, borderColor: d.ring }, pressed && styles.pressed]}
                    onPress={() => replaceWith(p.id)}>
                    <View style={[styles.recipeRowDot, { backgroundColor: d.coat }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recipeRowName, { color: d.ink }]} numberOfLines={1}>{p.label}</Text>
                      <Text style={styles.recipeRowMins}>{p.minutes} {t('customTimer.min')}</Text>
                    </View>
                    <Text style={styles.replaceRowAction}>{t('customTimer.replaceAction')}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={({ pressed }) => [styles.replaceCancel, pressed && styles.pressed]} onPress={() => setShowReplace(false)}>
              <Text style={styles.replaceCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// `g` = shared tablet scale (1 on phone). Sizes × g so nothing is phone-tiny on
// iPad; the wheel keeps its fixed ITEM_H so its scroll-snap stays exact.
type RecipeStyles = ReturnType<typeof makeStyles>;

const makeStyles = (g: number, contentWidth: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: CAFE.bg },
  safe: { flex: 1, paddingHorizontal: 16 * g, maxWidth: contentWidth, width: '100%', alignSelf: 'center' },
  scroll: { paddingBottom: 12 * g },

  // Top bar (mirrors the Start menu)
  topBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 * g },
  topSpacer: { flex: 1 },
  iconBtn: {
    width: 44 * g, height: 44 * g, borderRadius: 22 * g,
    backgroundColor: CAFE.paper, borderWidth: 1.5, borderColor: CAFE.line,
    alignItems: 'center', justifyContent: 'center', ...CAFE_SOFT_SHADOW,
  },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7 * g, height: 40 * g,
    paddingLeft: 10 * g, paddingRight: 14 * g, borderRadius: 20 * g,
    backgroundColor: CAFE.paper, borderWidth: 1.5, borderColor: CAFE.line, ...CAFE_SOFT_SHADOW,
  },
  coinText: { fontFamily: Fonts.rounded, fontSize: 16 * g, fontWeight: '800', color: CAFE.ink },

  // Recipe card (shadow on a wrapper: overflow:hidden would clip it on iOS)
  cardShadow: {
    borderRadius: 18 * g, backgroundColor: CAFE.paper,
    shadowColor: 'rgb(150,110,80)', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 3,
  },
  card: { borderRadius: 18 * g, borderWidth: 1.5, borderColor: CAFE.line, backgroundColor: CAFE.paper, overflow: 'hidden' },
  cardHeader: { backgroundColor: RECIPE.header, paddingTop: 12 * g, paddingHorizontal: 14 * g, paddingBottom: 4 * g, alignItems: 'stretch' },
  kicker: { fontFamily: Fonts.rounded, fontSize: 10 * g, fontWeight: '900', letterSpacing: 3 * g, textAlign: 'center', color: RECIPE.ink },
  title: { fontFamily: Fonts.serif, fontSize: 28 * g, fontWeight: '700', color: CAFE.title, textAlign: 'center' },
  cardBody: { paddingHorizontal: 12 * g, paddingTop: 6 * g, paddingBottom: 14 * g },

  // Oven window around the wheel
  ovenWindow: {
    alignSelf: 'stretch', alignItems: 'center',
    backgroundColor: RECIPE.window, borderRadius: 20 * g, borderWidth: 1.5, borderColor: RECIPE.windowLine,
    paddingTop: 6 * g, paddingBottom: 8 * g,
  },
  ovenHandle: { width: '34%', height: 6 * g, borderRadius: 3 * g, backgroundColor: RECIPE.handle, marginBottom: 4 * g, opacity: 0.8 },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  wheelColon: { fontFamily: Fonts.rounded, fontSize: 28, fontWeight: '800', color: RECIPE.ink, marginHorizontal: 10 * g, marginBottom: 22 },

  // Length picks (quick tiles + saved-recipe tags)
  tileRow: { flexDirection: 'row', gap: 6 * g, marginTop: 8 * g, marginBottom: 6 * g },
  tile: {
    flex: 1, minWidth: 0, minHeight: 44 * g, borderRadius: 14 * g, borderWidth: 1.5,
    borderColor: CAFE.line, backgroundColor: CAFE.paper,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 * g, paddingHorizontal: 4 * g,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 * g, marginBottom: 6 * g },
  tag: {
    width: '30%', height: 38 * g, borderRadius: 19 * g, borderWidth: 1.5,
    borderColor: CAFE.line, backgroundColor: CAFE.paper,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 * g, paddingHorizontal: 8 * g,
  },
  tagAdd: { borderStyle: 'dashed', borderColor: '#D9B993', backgroundColor: RECIPE.soft },
  tagAddText: { color: RECIPE.ink },
  pickDot: { width: 7 * g, height: 7 * g, borderRadius: 4 * g },
  pickText: { fontFamily: Fonts.rounded, fontSize: 13.5 * g, fontWeight: '800', flexShrink: 1 },

  // Tea-break picks (matcha)
  teaTile: {
    flex: 1, minWidth: 0, minHeight: 44 * g, borderRadius: 14 * g, borderWidth: 1.5,
    borderColor: MATCHA.line, backgroundColor: MATCHA.bg,
    alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 4 * g,
  },
  teaTileWide: { flex: 1.5 },
  teaTileOn: { backgroundColor: MATCHA.onBg, borderColor: MATCHA.onLine },
  teaText: { fontFamily: Fonts.rounded, fontSize: 13.5 * g, fontWeight: '700', color: MATCHA.ink, textAlign: 'center' },
  teaTextOn: { fontWeight: '900' },

  // Flavor chips
  chipRow: { flexDirection: 'row', gap: 6 * g, alignItems: 'center', paddingRight: 4 * g },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 * g, height: 32 * g, paddingHorizontal: 12 * g, borderRadius: 16 * g, borderWidth: 1.5 },
  chipDot: { width: 8 * g, height: 8 * g, borderRadius: 4 * g },
  chipText: { fontFamily: Fonts.rounded, fontSize: 13.5 * g, fontWeight: '800', color: CAFE.ink },
  chipAdd: { borderStyle: 'dashed', borderColor: '#D9C3B0', backgroundColor: CAFE.paper },
  chipAddText: { color: '#7A5440' },

  // Saved-recipe rows (Settings editor + replace picker)
  editorList: { gap: 8 * g, marginTop: 4 * g },
  noPresetsText: { fontFamily: Fonts.rounded, fontSize: 13 * g, color: CAFE.inkSoft, fontWeight: '700', textAlign: 'center', paddingVertical: 10 * g },
  recipeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10 * g,
    borderRadius: 14 * g, borderWidth: 1.5, paddingHorizontal: 14 * g, paddingVertical: 11 * g,
  },
  recipeRowDot: { width: 10 * g, height: 10 * g, borderRadius: 5 * g },
  recipeRowName: { fontFamily: Fonts.rounded, fontSize: 15 * g, fontWeight: '800' },
  recipeRowMins: { fontFamily: Fonts.rounded, fontSize: 12 * g, fontWeight: '700', color: CAFE.inkSoft, marginTop: 1 },
  recipeDelete: {
    width: 28 * g, height: 28 * g, borderRadius: 14 * g,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)',
  },

  // Start
  startBlock: { paddingTop: 10 * g, paddingBottom: 8 * g },
  startBtn: {
    height: 54 * g, borderRadius: 27 * g, alignItems: 'center', justifyContent: 'center', backgroundColor: RECIPE.btn,
    shadowColor: RECIPE.btn, shadowOpacity: 0.3, shadowRadius: 11, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  startBtnText: { fontFamily: Fonts.rounded, fontSize: 19 * g, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Replace-a-recipe overlay (in-tree, not a native Modal)
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(74,49,42,0.40)',
    alignItems: 'center', justifyContent: 'center', padding: 24 * g,
  },
  replaceCard: {
    width: '100%', maxWidth: 420 * g,
    backgroundColor: CAFE.paper, borderRadius: 20 * g, borderWidth: 1.5, borderColor: CAFE.line,
    padding: 20 * g, gap: 8 * g, ...CAFE_SOFT_SHADOW,
  },
  replaceTitle: { fontFamily: Fonts.serif, fontSize: 20 * g, fontWeight: '700', color: CAFE.title, textAlign: 'center' },
  replaceSub: { fontFamily: Fonts.rounded, fontSize: 13 * g, color: CAFE.inkSoft, textAlign: 'center', fontWeight: '700', marginBottom: 4 * g },
  replaceList: { maxHeight: 260 * g },
  replaceRowAction: { fontFamily: Fonts.rounded, fontSize: 13 * g, fontWeight: '900', color: RECIPE.ink },
  replaceCancel: { alignItems: 'center', paddingVertical: 8 * g },
  replaceCancelText: { fontFamily: Fonts.rounded, fontSize: 14 * g, fontWeight: '800', color: CAFE.inkSoft },

  pressed: { opacity: 0.85 },
});
