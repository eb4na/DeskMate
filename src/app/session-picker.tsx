import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { playTick } from '@/lib/sounds';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { DevKnobs } from '@/components/dev-knobs';
import { PlusIcon } from '@/components/plus-icon';
import { LockBadge } from '@/components/lock-badge';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { useIsTablet } from '@/hooks/use-device-class';
import { useApp } from '@/context/app-context';
import { newRoomId } from '@/lib/game-net';
import { useStudyRoom } from '@/lib/use-study-room';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { navigateWithLoading, companionPrefetchUri, STUDY_ASSETS } from '@/lib/preload-nav';
import { SESSION_LENGTHS, autoBreakMinutes, coinsForMinutes } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

const C = BakeryColors;
const SCREEN_BG = require('@/assets/images/home/session-bg.png');

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
  const isTablet = useIsTablet();
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('sessionpicker', PICKER_ELEMENTS);
  const { subjects, coins, isPlus, activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins } = useApp();
  const studyRoom = useStudyRoom();
  const { t } = useTranslation();
  const [selected, setSelected] = useState(30);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('single');

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  // Single-player break: 5 min for sessions under an hour, 10 min for an hour or more.
  const breakForSelected = autoBreakMinutes(selected);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  function startSolo() {
    router.push({
      pathname: '/subject-picker',
      params: {
        sessionLength: String(selected),
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
      },
    });
  }

  function startMultiplayer() {
    studyRoom.joinRoom(newRoomId(), true);
    // Warm my own (possibly remote) companion avatar so it doesn't pop into the
    // lobby roster / study room once it loads.
    const meImg = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins).imageSource;
    navigateWithLoading(
      () => router.push({ pathname: '/study-lobby', params: { minutes: String(selected) } }),
      { assets: STUDY_ASSETS, prefetch: [companionPrefetchUri(meImg)] },
    );
  }

  const onStart = () => (mode === 'single' ? startSolo() : startMultiplayer());

  return (
    <ImageBackground source={SCREEN_BG} style={styles.screen} resizeMode="cover">
      <View style={styles.bgOverlay} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Top bar — slim: just back + coin pill; the title lives in the menu header */}
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.one }]}>
          <Pressable style={({ pressed }) => [styles.iconBtn, tw('back'), pressed && styles.pressed]} onPress={goBack} hitSlop={8}>
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <View style={styles.topSpacer} />
          <Pressable style={({ pressed }) => [styles.coinPill, tw('coinPill'), pressed && styles.pressed]} onPress={() => router.push('/coin-shop')}>
            <CoinIcon size={18} />
            <Text style={styles.coinText}>{coins}</Text>
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
                    onPress={() => { playTick(); setSelected(opt.minutes); }}>
                    <Image source={CARD_IMG[opt.minutes]} style={[styles.menuIcon, isTablet && styles.menuIconTablet]} contentFit="contain" />
                    <View style={styles.menuBody}>
                      <View style={styles.menuTopLine}>
                        <Text style={[styles.menuName, isTablet && styles.menuNameTablet, isActive && styles.menuNameActive]} numberOfLines={1}>
                          {t(`sessionPicker.len_${opt.minutes}`)}
                        </Text>
                        <View style={styles.menuLeader} />
                        <CoinIcon size={isTablet ? 18 : 14} />
                        <Text style={[styles.menuPrice, isTablet && styles.menuPriceTablet]}>+{coinsForMinutes(opt.minutes)}</Text>
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
                    {isActive && (
                      <View style={[styles.checkBadge, isTablet && styles.checkBadgeTablet]}>
                        <Text style={[styles.checkIcon, isTablet && styles.checkIconTablet]}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                  {i < SESSION_LENGTHS.length - 1 && <View style={styles.menuDivider} />}
                </View>
              );
            })}

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
                    <Text style={[styles.chipText, isTablet && styles.chipTextTablet, isActive && { color: s.color }]}>
                      {s.emoji ? `${s.emoji} ` : ''}{s.name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable style={[styles.chip, isTablet && styles.chipTablet, styles.chipAdd]} onPress={() => router.push('/manage-subjects')}>
                <Text style={[styles.chipText, isTablet && styles.chipTextTablet, { color: C.berry }]}>{t('common.addChip')}</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.sectionRule} />

            {/* Custom duration — a Plus feature, as a final menu row. Free users see
                a lock and are sent to the paywall instead of the timer. */}
            <Pressable
              style={({ pressed }) => [styles.menuRow, isTablet && styles.menuRowTablet, pressed && styles.pressed]}
              onPress={() =>
                isPlus
                  ? router.push({ pathname: '/custom-timer', params: { mode: 'focus' } })
                  : router.push('/plus-upgrade')
              }>
              <View style={[styles.customIconWrap, isTablet && styles.customIconWrapTablet]}>
                <PlusIcon size={isTablet ? 42 : 32} />
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
                <LockBadge size={isTablet ? 38 : 30} />
              )}
            </Pressable>
          </View>

          {/* Start — break info reads as a quiet caption above the one CTA */}
          <View style={styles.startBlock}>
            {mode === 'single' ? (
              <Text style={styles.breakInfoText}>
                {breakForSelected > 0
                  ? t('sessionPicker.breakInfoSingle', { min: breakForSelected })
                  : t('sessionPicker.breakInfoNone')}
              </Text>
            ) : (
              <Text style={styles.breakInfoText}>{t('sessionPicker.breakInfoMulti')}</Text>
            )}
            <SoundPressable sound="confirm" style={({ pressed }) => [styles.startBtn, tw('startBtn'), pressed && styles.pressed]} onPress={onStart}>
              <Text style={styles.startBtnText}>{t('customTimer.startSession')}  →</Text>
            </SoundPressable>
          </View>
        </ScrollView>
      </SafeAreaView>
      <DevKnobs screen="sessionpicker" knobs={twKnobs} onChange={twChange} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  safe: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  // Heavier cream wash so the strawberry art reads as a soft tint, not clutter.
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,248,241,0.62)' },
  scroll: { paddingBottom: Spacing.five, gap: Spacing.three },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.one, paddingBottom: Spacing.two, gap: Spacing.two },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { fontSize: 22, fontWeight: '800', color: C.cocoaDark, marginTop: -2 },
  topSpacer: { flex: 1 },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill, paddingHorizontal: 9, paddingVertical: 6,
  },
  coinText: { fontSize: 13, fontWeight: '800', color: C.cocoaDark },

  // One shared surface for the menu paper.
  card: {
    backgroundColor: C.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    ...SOFT_SHADOW,
  },

  // The bakery "menu" paper
  menuCard: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  menuHeader: {
    alignItems: 'center', gap: 2,
    paddingBottom: Spacing.two, marginBottom: Spacing.one,
    borderBottomWidth: 1.5, borderBottomColor: C.shortbread, borderStyle: 'dashed',
  },
  menuTitle: { fontFamily: Fonts.serif, fontSize: 22, fontWeight: '800', color: C.cocoaDark, letterSpacing: 0.5 },
  menuSubtitle: { fontSize: 12, color: C.mocha, fontWeight: '600' },

  // In-menu section heading ("CHOOSE DURATION" / "SUBJECT")
  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.latte, letterSpacing: 1, marginTop: Spacing.one, marginBottom: 2 },
  // Dashed rule between menu sections
  sectionRule: { borderBottomWidth: 1.5, borderBottomColor: C.shortbread, borderStyle: 'dashed', marginVertical: Spacing.two },

  // Menu line-item (duration / custom)
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, paddingHorizontal: 4, borderRadius: BakeryRadii.chip },
  menuRowActive: { backgroundColor: 'rgba(228,138,154,0.12)' },
  menuIcon: { width: 54, height: 54 },
  menuBody: { flex: 1, gap: 3 },
  menuTopLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  menuName: { fontSize: 15.5, fontWeight: '800', color: C.cocoaDark },
  menuNameActive: { color: C.berry },
  menuLeader: { flex: 1, marginHorizontal: 4, marginBottom: 4, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: C.latte },
  menuPrice: { fontSize: 15, fontWeight: '800', color: '#C98A2B' },
  menuSubLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  menuCoinText: { fontSize: 12.5, color: C.mocha, fontWeight: '600' },
  breakChip: {
    backgroundColor: `${C.honey}2E`, borderRadius: BakeryRadii.chip,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  breakChipText: { fontSize: 10.5, fontWeight: '700', color: C.mocha },
  menuDivider: { height: 1, backgroundColor: `${C.shortbread}99` },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.jam,
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { fontSize: 12, color: '#fff', fontWeight: '900' },

  customIconWrap: { width: 54, alignItems: 'center', justifyContent: 'center' },

  // Subject chips
  chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 8, paddingVertical: 2 },
  chip: { borderRadius: BakeryRadii.pill, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 8 },
  chipAdd: { borderColor: C.jam, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipText: { fontSize: 13.5, color: C.mocha, fontWeight: '700' },

  customPill: {
    backgroundColor: C.cream, borderRadius: BakeryRadii.pill,
    borderWidth: 1.5, borderColor: C.shortbread,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  customPillText: { fontSize: 13, fontWeight: '800', color: C.cocoaDark },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: 4,
  },
  modeSeg: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: BakeryRadii.pill },
  modeSegActive: { backgroundColor: C.jam },
  modeText: { fontSize: 14, fontWeight: '800', color: C.mocha },
  modeTextActive: { color: '#fff' },

  // Start block — quiet caption + the single CTA
  startBlock: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  breakInfoText: { fontSize: 12, color: C.mocha, fontWeight: '600', textAlign: 'center' },
  startBtn: {
    alignSelf: 'stretch',
    backgroundColor: C.berry,
    borderRadius: BakeryRadii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    ...SOFT_SHADOW,
  },
  startBtnText: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

  pressed: { opacity: 0.85 },

  // ── Tablet: bigger menu paper + line-items, chips and custom row ──
  menuCardTablet: { paddingHorizontal: Spacing.five, paddingVertical: Spacing.four },
  menuTitleTablet: { fontSize: 32 },
  menuSubtitleTablet: { fontSize: 16 },
  sectionLabelTablet: { fontSize: 14, letterSpacing: 1.2, marginTop: Spacing.two },
  menuRowTablet: { paddingVertical: Spacing.three, gap: Spacing.three },
  menuIconTablet: { width: 82, height: 82 },
  menuNameTablet: { fontSize: 21 },
  menuPriceTablet: { fontSize: 20 },
  menuCoinTextTablet: { fontSize: 16 },
  breakChipTablet: { paddingHorizontal: 10, paddingVertical: 4 },
  breakChipTextTablet: { fontSize: 14 },
  checkBadgeTablet: { width: 30, height: 30, borderRadius: 15 },
  checkIconTablet: { fontSize: 16 },
  customIconWrapTablet: { width: 82 },
  chipTablet: { paddingHorizontal: 18, paddingVertical: 12 },
  chipTextTablet: { fontSize: 18 },
  customPillTablet: { paddingHorizontal: 16, paddingVertical: 10 },
  customPillTextTablet: { fontSize: 17 },
});
