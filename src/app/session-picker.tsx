import { Image } from 'expo-image';
import { router } from 'expo-router';
import { setPendingDragSession } from '@/lib/drag-session';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { playPaper } from '@/lib/sounds';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { DevKnobs } from '@/components/dev-knobs';
import { PlusIcon } from '@/components/plus-icon';
import { LockBadge } from '@/components/lock-badge';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useApp } from '@/context/app-context';
import { newRoomId } from '@/lib/game-net';
import { useStudyRoom } from '@/lib/use-study-room';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { navigateWithLoading, companionPrefetchUri, STUDY_ASSETS } from '@/lib/preload-nav';
import { SESSION_LENGTHS, autoBreakMinutes, coinsForMinutes, formatCoins, PLUS_STUDY_COIN_MULTIPLIER } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { BakeryColors, BakeryRadii, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { CheckBox } from '@/components/check-menu';

const C = BakeryColors;
const SCREEN_BG = require('@/assets/images/home/session-bg-cakes.png');

// One soft, consistent shadow shared by every card so the screen reads calm
// instead of having each block carry its own heavy drop shadow.
const SOFT_SHADOW = {
  shadowColor: 'rgba(132,87,63,0.18)',
  shadowOpacity: 1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

const CARD_IMG: Record<number, number> = {
  15: require('@/assets/images/cake/dessert-10.png'),
  30: require('@/assets/images/cake/dessert-25.png'),
  60: require('@/assets/images/cake/dessert-50.png'),
  90: require('@/assets/images/cake/dessert-90.png'),
};

type Mode = 'single' | 'multi';

const PICKER_ELEMENTS = [
  { name: 'back', label: 'Back btn' },
  { name: 'coinPill', label: 'Coin pill' },
  { name: 'startBtn', label: 'Start btn' },
];

export default function SessionPickerScreen() {
  const insets = useSafeAreaInsets();
  // Proportional tablet scaling: `scale` is anchored so the 11" Pro reproduces the
  // tuned 1.3×. `grow` re-bases that against the 11" the tablet styles were authored
  // at, so grow=1 on the 11" (zero regression) and ~1.23 on the 13" — everything
  // (incl. the mode toggle / Start button / top bar, which have no tablet variant)
  // grows together so nothing reads small on a bigger iPad.
  const { isTablet, scale } = useTabletScale();
  // Clamp to ≥1: smaller tablets (mini) keep the 11"-tuned look rather than shrinking
  // base styles below phone size; only bigger iPads (13") grow past it.
  const grow = isTablet ? Math.max(1, scale / 1.3) : 1;
  const styles = useMemo(() => makeStyles(grow), [grow]);
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('sessionpicker', PICKER_ELEMENTS);
  const { subjects, coins, isPlus, activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins } = useApp();
  const studyRoom = useStudyRoom();
  const { t } = useTranslation();
  // Nothing is pre-picked: the menu opens with every box empty so the first
  // checkmark you see is one you put there. Start stays disabled until then.
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('single');

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  // Single-player break: the automatic one (5 min under an hour, 15 min for an
  // hour or more). Saved presets live on the Custom Timer screen now, and they
  // carry no break of their own.
  const breakForSelected = selected == null ? 0 : autoBreakMinutes(selected);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  function startSolo() {
    if (selected == null) return;
    const subjectName = selectedSubjectId
      ? subjects.find((s) => s.id === selectedSubjectId && !s.archived)?.name ?? null
      : null;
    setPendingDragSession({
      durationMinutes: selected,
      subjectName,
      taskId: null,
      taskTitle: null,
    });
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }

  function startMultiplayer() {
    studyRoom.joinRoom(newRoomId(), true);
    // Warm my own (possibly remote) companion avatar so it doesn't pop into the
    // lobby roster / study room once it loads.
    const meImg = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins).imageSource;
    navigateWithLoading(
      () =>
        router.push({
          pathname: '/study-lobby',
          // Nothing ticked is fine here — in multiplayer every player sets their own
          // length in the lobby, so this is only the lobby's starting value.
          params: { minutes: String(selected ?? 30) },
        }),
      { assets: STUDY_ASSETS, prefetch: [companionPrefetchUri(meImg)] },
    );
  }

  const onStart = () => (mode === 'single' ? startSolo() : startMultiplayer());

  return (
    <View style={styles.screen}>
      <Image source={SCREEN_BG} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" />
      <View style={styles.bgOverlay} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Top bar — slim: just back + coin pill; the title lives in the menu header */}
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.one }]}>
          <Pressable style={({ pressed }) => [styles.iconBtn, isTablet && styles.iconBtnTablet, tw('back'), pressed && styles.pressed]} onPress={goBack} hitSlop={8}>
            <Text style={[styles.backChevron, isTablet && styles.backChevronTablet]}>‹</Text>
          </Pressable>
          <View style={styles.topSpacer} />
          <Pressable style={({ pressed }) => [styles.coinPill, tw('coinPill'), pressed && styles.pressed]} onPress={() => router.push('/coin-shop')}>
            <CoinIcon size={Math.round(18 * grow)} />
            <Text style={styles.coinText}>{formatCoins(coins)}</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Mode — drives the whole flow, so it sits up top */}
          <View style={styles.modeToggle}>
            <Pressable style={[styles.modeSeg, mode === 'single' && styles.modeSegActive]} onPress={() => setMode('single')}>
              <Text style={[styles.modeText, mode === 'single' && styles.modeTextActive]}>{t('sessionPicker.singlePlayer')}</Text>
            </Pressable>
            <Pressable style={[styles.modeSeg, mode === 'multi' && styles.modeSegActive]} onPress={() => setMode('multi')}>
              <Text style={[styles.modeText, mode === 'multi' && styles.modeTextActive]}>{t('sessionPicker.multiplayer')}</Text>
            </Pressable>
          </View>

          {/* Multiplayer caveat — only solo sessions bake a recipe, so multiplayer
              never earns recipe badges. Shown as soon as Multiplayer is picked so
              nobody finds out after a session. */}
          {mode === 'multi' && (
            <View style={styles.multiWarn}>
              <Text style={styles.multiWarnText}>{t('sessionPicker.multiNoRecipeWarn')}</Text>
            </View>
          )}

          {/* One parchment "menu" — durations, subjects and custom all on one paper */}
          <View style={[styles.card, styles.menuCard, isTablet && styles.menuCardTablet]}>
            {/* Menu header */}
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, isTablet && styles.menuTitleTablet]}>{t('sessionPicker.title')}</Text>
              <Text style={[styles.menuSubtitle, isTablet && styles.menuSubtitleTablet]}>{t('sessionPicker.subtitle')}</Text>
            </View>

            {/* Focus time — each duration is a menu line-item */}
            <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>{t('sessionPicker.chooseDuration')}</Text>
            {SESSION_LENGTHS.map((opt, i) => {
              const isActive = selected === opt.minutes;
              const brk = autoBreakMinutes(opt.minutes);
              return (
                <View key={opt.minutes}>
                  <Pressable
                    style={({ pressed }) => [styles.menuRow, isTablet && styles.menuRowTablet, isActive && styles.menuRowActive, pressed && styles.pressed]}
                    onPress={() => { playPaper(); setSelected(opt.minutes); }}>
                    <Image source={CARD_IMG[opt.minutes]} style={[styles.menuIcon, isTablet && styles.menuIconTablet]} contentFit="contain" />
                    <View style={styles.menuBody}>
                      <View style={styles.menuTopLine}>
                        <Text style={[styles.menuName, isTablet && styles.menuNameTablet, isActive && styles.menuNameActive]} numberOfLines={1}>
                          {t(`sessionPicker.len_${opt.minutes}`)}
                        </Text>
                        <View style={styles.menuLeader} />
                        <CoinIcon size={isTablet ? Math.round(18 * grow) : 14} />
                        <Text style={[styles.menuPrice, isTablet && styles.menuPriceTablet]}>+{coinsForMinutes(opt.minutes) * (isPlus ? PLUS_STUDY_COIN_MULTIPLIER : 1)}</Text>
                      </View>
                      <View style={styles.menuSubLine}>
                        <Text style={[styles.menuCoinText, isTablet && styles.menuCoinTextTablet]}>{opt.minutes} {t('customTimer.min')}</Text>
                        {brk > 0 && (
                          <View style={[styles.breakChip, isTablet && styles.breakChipTablet]}>
                            <Text style={[styles.breakChipText, isTablet && styles.breakChipTextTablet]}>{t('sessionPicker.menuBreak', { min: brk })}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {/* Every option shows a box; it fills with a check when picked. */}
                    <CheckBox checked={isActive} size={isTablet ? Math.round(28 * grow) : 24} color={C.buttonPink} />
                  </Pressable>
                  {i < SESSION_LENGTHS.length - 1 && <View style={styles.menuDivider} />}
                </View>
              );
            })}

            {/* Saved presets no longer live here — they're pills on the Custom
                Timer screen (session-length only), where they're added/managed. */}

            <View style={styles.sectionRule} />

            {/* Subject — chips read as a little "add-ons" line on the menu */}
            <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>{t('sessionPicker.subjectHeader')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {activeSubjects.map((s) => {
                const isActive = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[
                      styles.chip,
                      isTablet && styles.chipTablet,
                      { borderColor: isActive ? s.color : C.shortbread, backgroundColor: isActive ? s.color + '2E' : 'rgba(255,255,255,0.6)' },
                    ]}
                    onPress={() => setSelectedSubjectId(isActive ? null : s.id)}>
                    <View style={styles.chipInner}>
                      {isActive && <CheckBox checked size={isTablet ? Math.round(18 * grow) : 15} color={s.color} />}
                      <Text style={[styles.chipText, isTablet && styles.chipTextTablet, isActive && { color: s.color }]}>
                        {s.emoji ? `${s.emoji} ` : ''}{localizeSubjectName(s.name, t)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable style={[styles.chip, isTablet && styles.chipTablet, styles.chipAdd]} onPress={() => router.push('/manage-subjects')}>
                <Text style={[styles.chipText, isTablet && styles.chipTextTablet, { color: C.berry }]}>{t('common.addChip')}</Text>
              </Pressable>
            </ScrollView>

            {/* Custom duration — a Plus feature, as a final menu row. Free users see
                a lock and are sent to the paywall instead of the timer. Hidden in
                multiplayer: there each player sets their own length in the lobby. */}
            {mode === 'single' && (
              <>
                <View style={styles.sectionRule} />
                <Pressable
                  style={({ pressed }) => [styles.menuRow, isTablet && styles.menuRowTablet, pressed && styles.pressed]}
                  onPress={() =>
                    isPlus
                      ? router.push('/custom-timer')
                      : router.push('/plus-upgrade')
                  }>
                  <View style={[styles.customIconWrap, isTablet && styles.customIconWrapTablet]}>
                    <PlusIcon size={isTablet ? Math.round(42 * grow) : 32} />
                  </View>
                  <View style={styles.menuBody}>
                    <Text style={[styles.menuName, isTablet && styles.menuNameTablet]}>{t('sessionPicker.customTitle')}</Text>
                    <Text style={[styles.menuCoinText, isTablet && styles.menuCoinTextTablet]}>{t('sessionPicker.customSub')}</Text>
                  </View>
                  {isPlus ? (
                    <View style={[styles.customPill, isTablet && styles.customPillTablet]}>
                      <Text style={[styles.customPillText, isTablet && styles.customPillTextTablet]}>{t('sessionPicker.customSet')}</Text>
                    </View>
                  ) : (
                    <LockBadge size={isTablet ? Math.round(38 * grow) : 30} />
                  )}
                </Pressable>
              </>
            )}
          </View>

          {/* Start — break info reads as a quiet caption above the one CTA */}
          <View style={styles.startBlock}>
            {/* Caption stays mounted even with nothing picked (blank rather than
                claiming "no break") so the Start button doesn't hop on first tap. */}
            <Text style={styles.breakInfoText}>
              {mode !== 'single'
                ? t('sessionPicker.breakInfoMulti')
                : selected == null
                  ? ' '
                  : breakForSelected > 0
                    ? t('sessionPicker.breakInfoSingle', { min: breakForSelected })
                    : t('sessionPicker.breakInfoNone')}
            </Text>
            {/* Solo: the ticked duration IS the session, so Start waits for a pick.
                Multiplayer sets length in the lobby, so it never blocks here. */}
            <SoundPressable
              sound="confirm"
              disabled={mode === 'single' && selected == null}
              style={({ pressed }) => [styles.startBtn, tw('startBtn'), mode === 'single' && selected == null && styles.startBtnDisabled, pressed && styles.pressed]}
              onPress={onStart}>
              <Text style={styles.startBtnText}>{t('customTimer.startSession')}  →</Text>
            </SoundPressable>
          </View>
        </ScrollView>
      </SafeAreaView>
      <DevKnobs screen="sessionpicker" knobs={twKnobs} onChange={twChange} />
    </View>
  );
}

// `g` = the per-device grow factor (1 on phone AND the 11" reference, ~1.23 on the
// 13"). Every size/spacing/font literal is multiplied by it so the whole screen
// scales as one piece — the 11" reproduces its tuned look exactly (g=1), bigger
// tablets grow proportionally. Non-size props (color/opacity/flex) are left alone.
const makeStyles = (g: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  safe: { flex: 1, paddingHorizontal: Spacing.four * g, maxWidth: MaxContentWidth * g, width: '100%', alignSelf: 'center' },
  // Heavier cream wash so the strawberry art reads as a soft tint, not clutter.
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,248,241,0.28)' },
  scroll: { paddingBottom: Spacing.five * g, gap: Spacing.three * g },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.one * g, paddingBottom: Spacing.two * g, gap: Spacing.two * g },
  iconBtn: {
    width: 38 * g, height: 38 * g, borderRadius: 19 * g,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    alignItems: 'center', justifyContent: 'center',
  },
  // On iPad the 38px circle reads tiny next to the coin pill — give it a bigger,
  // more tappable target (borderWidth grows too so it doesn't look thin).
  iconBtnTablet: { width: 50 * g, height: 50 * g, borderRadius: 25 * g, borderWidth: 2 },
  backChevron: { fontSize: 22 * g, fontWeight: '800', color: C.cocoaDark, marginTop: -2 * g },
  backChevronTablet: { fontSize: 30 * g, marginTop: -3 * g },
  topSpacer: { flex: 1 },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5 * g,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill, paddingHorizontal: 9 * g, paddingVertical: 6 * g,
  },
  coinText: { fontSize: 13 * g, fontWeight: '800', color: C.cocoaDark },

  // One shared surface for the menu paper.
  card: {
    backgroundColor: C.frosting,
    borderRadius: BakeryRadii.card * g,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    ...SOFT_SHADOW,
  },

  // The bakery "menu" paper
  menuCard: { paddingHorizontal: Spacing.three * g, paddingVertical: Spacing.two * g },
  menuHeader: {
    alignItems: 'center', gap: 2 * g,
    paddingBottom: Spacing.two * g, marginBottom: Spacing.one * g,
    borderBottomWidth: 1.5, borderBottomColor: C.shortbread, borderStyle: 'dashed',
  },
  menuTitle: { fontFamily: Fonts.serif, fontSize: 22 * g, fontWeight: '800', color: C.cocoaDark, letterSpacing: 0.5 },
  menuSubtitle: { fontSize: 12 * g, color: C.mocha, fontWeight: '600' },

  // In-menu section heading ("CHOOSE DURATION" / "SUBJECT")
  sectionLabel: { fontSize: 11 * g, fontWeight: '800', color: C.latte, letterSpacing: 1, marginTop: Spacing.one * g, marginBottom: 2 * g },
  // Dashed rule between menu sections
  sectionRule: { borderBottomWidth: 1.5, borderBottomColor: C.shortbread, borderStyle: 'dashed', marginVertical: Spacing.two * g },

  // Menu line-item (duration / custom)
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * g, paddingVertical: Spacing.two * g, paddingHorizontal: 4 * g, borderRadius: BakeryRadii.chip * g },
  menuRowActive: { backgroundColor: 'rgba(228,138,154,0.12)' },
  menuIcon: { width: 54 * g, height: 54 * g },
  menuBody: { flex: 1, gap: 3 * g },
  menuTopLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 * g },
  menuName: { fontSize: 15.5 * g, fontWeight: '800', color: C.cocoaDark },
  menuNameActive: { color: C.berry },
  menuLeader: { flex: 1, marginHorizontal: 4 * g, marginBottom: 4 * g, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: C.latte },
  menuPrice: { fontSize: 15 * g, fontWeight: '800', color: '#C98A2B' },
  menuSubLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one * g },
  menuCoinText: { fontSize: 12.5 * g, color: C.mocha, fontWeight: '600' },
  breakChip: {
    backgroundColor: `${C.honey}2E`, borderRadius: BakeryRadii.chip * g,
    paddingHorizontal: 7 * g, paddingVertical: 2 * g,
  },
  breakChipText: { fontSize: 10.5 * g, fontWeight: '700', color: C.mocha },
  menuDivider: { height: 1, backgroundColor: `${C.shortbread}99` },
  checkBadge: {
    width: 22 * g, height: 22 * g, borderRadius: 11 * g, backgroundColor: C.jam,
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { fontSize: 12 * g, color: '#fff', fontWeight: '900' },

  presetDelete: {
    width: 26 * g, height: 26 * g, borderRadius: 13 * g, marginLeft: 4 * g,
    alignItems: 'center', justifyContent: 'center', backgroundColor: `${C.shortbread}80`,
  },
  presetDeleteText: { fontSize: 12 * g, color: C.mocha, fontWeight: '800', lineHeight: 14 * g },

  customIconWrap: { width: 54 * g, alignItems: 'center', justifyContent: 'center' },

  // Subject chips
  chipRow: { flexDirection: 'row', gap: 8 * g, alignItems: 'center', paddingRight: 8 * g, paddingVertical: 2 * g },
  chip: { borderRadius: BakeryRadii.pill, borderWidth: 1.5, paddingHorizontal: 13 * g, paddingVertical: 8 * g },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 * g },
  chipAdd: { borderColor: C.jam, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipText: { fontSize: 13.5 * g, color: C.mocha, fontWeight: '700' },

  customPill: {
    backgroundColor: C.cream, borderRadius: BakeryRadii.pill,
    borderWidth: 1.5, borderColor: C.shortbread,
    paddingHorizontal: 12 * g, paddingVertical: 7 * g,
  },
  customPillText: { fontSize: 13 * g, fontWeight: '800', color: C.cocoaDark },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: 4 * g,
  },
  modeSeg: { flex: 1, paddingVertical: 11 * g, alignItems: 'center', borderRadius: BakeryRadii.pill },
  modeSegActive: { backgroundColor: C.jam },
  modeText: { fontSize: 14 * g, fontWeight: '800', color: C.mocha },
  modeTextActive: { color: '#fff' },
  // Multiplayer "no recipe badges" notice, right under the toggle.
  multiWarn: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    paddingVertical: 8 * g,
    paddingHorizontal: 12 * g,
    marginTop: Spacing.one * g,
  },
  multiWarnText: { fontSize: 12.5 * g, fontWeight: '700', color: C.mocha, textAlign: 'center', lineHeight: 17 * g },

  // Start block — quiet caption + the single CTA
  startBlock: { alignItems: 'center', gap: Spacing.two * g, marginTop: Spacing.one * g },
  breakInfoText: { fontSize: 12 * g, color: C.mocha, fontWeight: '600', textAlign: 'center' },
  startBtn: {
    alignSelf: 'stretch',
    backgroundColor: C.berry,
    borderRadius: BakeryRadii.pill,
    paddingVertical: 16 * g,
    alignItems: 'center',
    ...SOFT_SHADOW,
  },
  // Greyed until a duration is picked (nothing is selected by default).
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { fontSize: 17 * g, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

  pressed: { opacity: 0.85 },

  // ── Tablet: bigger menu paper + line-items, chips and custom row ──
  menuCardTablet: { paddingHorizontal: Spacing.five * g, paddingVertical: Spacing.four * g },
  menuTitleTablet: { fontSize: 32 * g },
  menuSubtitleTablet: { fontSize: 16 * g },
  sectionLabelTablet: { fontSize: 14 * g, letterSpacing: 1.2, marginTop: Spacing.two * g },
  menuRowTablet: { paddingVertical: Spacing.three * g, gap: Spacing.three * g },
  menuIconTablet: { width: 82 * g, height: 82 * g },
  menuNameTablet: { fontSize: 21 * g },
  menuPriceTablet: { fontSize: 20 * g },
  menuCoinTextTablet: { fontSize: 16 * g },
  breakChipTablet: { paddingHorizontal: 10 * g, paddingVertical: 4 * g },
  breakChipTextTablet: { fontSize: 14 * g },
  checkBadgeTablet: { width: 30 * g, height: 30 * g, borderRadius: 15 * g },
  checkIconTablet: { fontSize: 16 * g },
  customIconWrapTablet: { width: 82 * g },
  chipTablet: { paddingHorizontal: 18 * g, paddingVertical: 12 * g },
  chipTextTablet: { fontSize: 18 * g },
  customPillTablet: { paddingHorizontal: 16 * g, paddingVertical: 10 * g },
  customPillTextTablet: { fontSize: 17 * g },
});
