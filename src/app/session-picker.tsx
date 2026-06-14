import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { PlusIcon } from '@/components/plus-icon';
import { LockBadge } from '@/components/lock-badge';
import { useApp } from '@/context/app-context';
import { newRoomId } from '@/lib/game-net';
import { useStudyRoom } from '@/lib/use-study-room';
import { SESSION_LENGTHS, autoBreakMinutes, coinsForMinutes } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

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

export default function SessionPickerScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { subjects, coins, isPlus } = useApp();
  const studyRoom = useStudyRoom();
  const { t } = useTranslation();
  const [selected, setSelected] = useState(30);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('single');

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const contentW = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const cardW = (contentW - Spacing.two) / 2;
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
    router.push('/study-lobby');
  }

  const onStart = () => (mode === 'single' ? startSolo() : startMultiplayer());

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
            <Text style={styles.title}>{t('sessionPicker.title')}</Text>
            <Text style={styles.subtitle}>{t('sessionPicker.subtitle')}</Text>
          </View>
          <View style={styles.topRight}>
            <Pressable style={({ pressed }) => [styles.coinPill, pressed && styles.pressed]} onPress={() => router.push('/coin-shop')}>
              <CoinIcon size={18} />
              <Text style={styles.coinText}>{coins}</Text>
            </Pressable>
          </View>
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

          {/* Duration cards */}
          <Text style={styles.sectionLabel}>{t('sessionPicker.chooseDuration')}</Text>
          <View style={styles.grid}>
            {SESSION_LENGTHS.map((opt) => {
              const isActive = selected === opt.minutes;
              return (
                <Pressable
                  key={opt.minutes}
                  style={[styles.card, styles.lenCard, { width: cardW }, isActive && styles.lenCardActive]}
                  onPress={() => setSelected(opt.minutes)}>
                  {isActive && (
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkIcon}>✓</Text>
                    </View>
                  )}
                  <View style={styles.lenTopRow}>
                    <Image source={CARD_IMG[opt.minutes]} style={styles.lenImg} contentFit="contain" />
                    <View style={styles.lenNumWrap}>
                      <Text style={[styles.lenNum, isActive && styles.lenNumActive]}>{opt.minutes}</Text>
                      <Text style={styles.lenMin}>{t('customTimer.min')}</Text>
                    </View>
                  </View>
                  <Text style={styles.lenLabel} numberOfLines={1}>{t(`sessionPicker.len_${opt.minutes}`)}</Text>
                  <View style={styles.lenReward}>
                    <CoinIcon size={14} />
                    <Text style={styles.lenRewardText}>+{coinsForMinutes(opt.minutes)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Subject */}
          <Text style={styles.sectionLabel}>{t('sessionPicker.subjectHeader')}</Text>
          <View style={[styles.card, styles.softCard]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {activeSubjects.map((s) => {
                const isActive = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[
                      styles.chip,
                      { borderColor: isActive ? s.color : C.shortbread, backgroundColor: isActive ? s.color + '2E' : '#fff' },
                    ]}
                    onPress={() => setSelectedSubjectId(isActive ? null : s.id)}>
                    <Text style={[styles.chipText, isActive && { color: s.color }]}>
                      {s.emoji ? `${s.emoji} ` : ''}{s.name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => router.push('/manage-subjects')}>
                <Text style={[styles.chipText, { color: C.berry }]}>{t('common.addChip')}</Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* Custom duration — a Plus feature. Free users see a lock and are sent
              to the paywall instead of the timer. */}
          <Pressable
            style={({ pressed }) => [styles.card, styles.customRow, pressed && styles.pressed]}
            onPress={() =>
              isPlus
                ? router.push({ pathname: '/custom-timer', params: { mode: 'focus' } })
                : router.push('/plus-upgrade')
            }>
            <PlusIcon size={34} />
            <View style={styles.customTextWrap}>
              <Text style={styles.customTitle}>{t('sessionPicker.customTitle')}</Text>
              <Text style={styles.customSub}>{t('sessionPicker.customSub')}</Text>
            </View>
            {isPlus ? (
              <View style={styles.customPill}>
                <Text style={styles.customPillText}>{t('sessionPicker.customSet')}</Text>
              </View>
            ) : (
              <LockBadge size={30} />
            )}
          </Pressable>

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
            <Pressable style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]} onPress={onStart}>
              <Text style={styles.startBtnText}>{t('customTimer.startSession')}  →</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
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
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: C.cocoaDark, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, color: C.mocha, fontWeight: '600' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill, paddingHorizontal: 9, paddingVertical: 6,
  },
  coinText: { fontSize: 13, fontWeight: '800', color: C.cocoaDark },

  // Section labels
  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.latte, letterSpacing: 1, marginBottom: -Spacing.one },

  // One shared surface — every card/row uses this for a consistent, calm weight.
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: BakeryRadii.card,
    borderWidth: 1,
    borderColor: 'rgba(195,143,114,0.14)',
    ...SOFT_SHADOW,
  },

  // Duration cards
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  lenCard: { padding: 14, gap: 4 },
  lenCardActive: { borderWidth: 2, borderColor: C.jam, backgroundColor: 'rgba(228,138,154,0.10)' },
  checkBadge: {
    position: 'absolute', top: 10, right: 12, zIndex: 2,
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.jam,
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { fontSize: 12, color: '#fff', fontWeight: '900' },
  lenTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lenImg: { width: 46, height: 46 },
  lenNumWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  lenNum: { fontSize: 30, fontWeight: '900', color: C.cocoaDark, lineHeight: 32 },
  lenNumActive: { color: C.berry },
  lenMin: { fontSize: 12, color: C.mocha, fontWeight: '700' },
  lenLabel: { fontSize: 14, fontWeight: '700', color: C.mocha, marginTop: 2 },
  lenReward: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    backgroundColor: C.honey + '2E', borderRadius: BakeryRadii.pill,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  lenRewardText: { fontSize: 12, fontWeight: '800', color: '#C98A2B' },

  // Soft card (subject chips)
  softCard: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 8 },
  chip: { borderRadius: BakeryRadii.pill, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 8 },
  chipAdd: { borderColor: C.jam, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipText: { fontSize: 13.5, color: C.mocha, fontWeight: '700' },

  // Custom duration row
  customRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    padding: Spacing.three,
  },
  customTextWrap: { flex: 1 },
  customTitle: { fontSize: 14.5, fontWeight: '800', color: C.cocoaDark },
  customSub: { fontSize: 11.5, color: C.mocha, marginTop: 1 },
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
});
