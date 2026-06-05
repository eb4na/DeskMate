import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

const C = BakeryColors;
const SCREEN_BG = require('@/assets/images/home/session-bg.png');
const SQUARE_CARD = require('@/assets/images/home/session-card-square.png');
const LONG_CARD = require('@/assets/images/home/session-card-long.png');
const START_PILL = require('@/assets/images/home/start-session-pill.png');
const BACK_CAT_BTN = require('@/assets/images/home/back-cat-btn.png');
const CUSTOM_CARD = require('@/assets/images/home/custom-timer-card.png');

const CARD_IMG: Record<number, number> = {
  10: require('@/assets/images/cake/dessert-10.png'),
  25: require('@/assets/images/cake/dessert-25.png'),
  50: require('@/assets/images/cake/dessert-50.png'),
  90: require('@/assets/images/cake/dessert-90.png'),
};

export default function SessionPickerScreen() {
  const { width } = useWindowDimensions();
  const { isPlus, subjects, coins } = useApp();
  const { t } = useTranslation();
  const [selected, setSelected] = useState(25);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const contentW = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const cardW = (contentW - Spacing.three) / 2;

  function startSession() {
    router.push({
      pathname: '/subject-picker',
      params: {
        sessionLength: String(selected),
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
      },
    });
  }

  return (
    <ImageBackground source={SCREEN_BG} style={styles.screen} resizeMode="cover">
      <View style={styles.bgOverlay} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable
              style={({ pressed }) => [styles.coinPill, pressed && styles.pressed]}
              onPress={() => router.push('/coin-shop')}>
              <CoinIcon size={22} />
              <Text style={styles.coinText}>{coins}</Text>
              <View style={styles.coinPlus}>
                <Text style={styles.coinPlusText}>+</Text>
              </View>
            </Pressable>
          </View>

          {/* Header — sits over the kitchen scene */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('sessionPicker.title')}</Text>
              <Text style={styles.subtitle}>{t('sessionPicker.subtitle')}</Text>
            </View>
          </View>

          {/* Session length cards */}
          <View style={styles.grid}>
            {SESSION_LENGTHS.map((opt) => {
              const isActive = selected === opt.minutes;
              return (
                <Pressable
                  key={opt.minutes}
                  style={[styles.lenCard, { width: cardW }, isActive && styles.lenCardActive]}
                  onPress={() => setSelected(opt.minutes)}>
                  <ImageBackground source={SQUARE_CARD} style={styles.lenFrame} imageStyle={styles.lenFrameImg} resizeMode="stretch">
                    {isActive && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkIcon}>✓</Text>
                      </View>
                    )}
                    <View style={styles.lenTopRow}>
                      <Image source={CARD_IMG[opt.minutes]} style={styles.lenImg} contentFit="contain" />
                      <View style={styles.lenDivider} />
                      <View style={styles.lenNumWrap}>
                        <Text style={[styles.lenNum, isActive && styles.lenNumActive]}>{opt.minutes}</Text>
                        <Text style={styles.lenMin}>min</Text>
                      </View>
                    </View>
                    <Text style={styles.lenLabel} numberOfLines={1}>{opt.label}</Text>
                  </ImageBackground>
                </Pressable>
              );
            })}
          </View>

          {/* Subject card */}
          <ImageBackground source={LONG_CARD} style={styles.subjectFrame} imageStyle={styles.subjectFrameImg} resizeMode="stretch">
            <Text style={styles.cardHeading}>Subject optional 🍓</Text>
            <View style={styles.chipWrap}>
              {activeSubjects.map((s) => {
                const isActive = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[
                      styles.chip,
                      { borderColor: isActive ? s.color : C.shortbread, backgroundColor: isActive ? s.color + '2E' : C.frosting },
                    ]}
                    onPress={() => setSelectedSubjectId(isActive ? null : s.id)}>
                    <Text style={[styles.chipText, isActive && { color: s.color }]}>
                      {s.emoji ? `${s.emoji} ` : ''}{s.name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.chip, styles.chipAdd]}
                onPress={() => router.push('/manage-subjects')}>
                <Text style={[styles.chipText, { color: C.berry }]}>+ Add</Text>
              </Pressable>
            </View>
          </ImageBackground>

          {/* Custom Duration */}
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/custom-timer', params: { mode: 'focus' } })}>
            <ImageBackground source={CUSTOM_CARD} style={styles.customCard} imageStyle={styles.customCardImg} resizeMode="stretch">
              <View style={styles.customText}>
                <Text style={styles.customTitle}>Custom Duration</Text>
                <Text style={styles.customSub}>Set any time that fits your plan</Text>
              </View>
            </ImageBackground>
          </Pressable>

          {/* Start button */}
          <Pressable
            style={({ pressed }) => [styles.startBtnWrap, pressed && styles.pressed]}
            onPress={startSession}>
            <ImageBackground source={START_PILL} style={styles.startBtn} resizeMode="stretch">
              <Text style={styles.startBtnText}>{t('sessionPicker.startButton', { minutes: selected })}</Text>
            </ImageBackground>
          </Pressable>

          {/* Back */}
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => router.back()}>
            <Image source={BACK_CAT_BTN} style={styles.backBtnImg} contentFit="contain" />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  safe: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,253,250,0.5)' },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.two,
  },

  // Top bar
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: Spacing.one },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.frosting, borderWidth: 1.5, borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill, paddingLeft: 10, paddingRight: 6, paddingVertical: 6,
    ...BakeryShadow,
  },
  coinText: { fontSize: 15, fontWeight: '800', color: C.cocoaDark },
  coinPlus: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: C.jam,
    alignItems: 'center', justifyContent: 'center',
  },
  coinPlusText: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 18 },

  // Header
  header: { alignItems: 'flex-end' },
  headerTextWrap: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,250,243,0.7)',
    borderRadius: BakeryRadii.card,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  title: { fontSize: 28, fontWeight: '800', color: C.cocoaDark, letterSpacing: 0.2 },
  subtitle: { fontSize: 13, color: C.mocha, fontWeight: '700' },

  // Length cards
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  lenCard: {
    borderRadius: 18,
    aspectRatio: 1448 / 940,
  },
  lenCardActive: {
    borderWidth: 2.5,
    borderColor: C.jam,
  },
  lenFrame: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 4,
  },
  lenFrameImg: { borderRadius: 16 },
  checkBadge: {
    position: 'absolute', top: 8, right: 10, zIndex: 2,
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.jam,
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { fontSize: 12, color: '#fff', fontWeight: '800' },
  lenTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lenImg: { width: 44, height: 44 },
  lenDivider: { width: 0, alignSelf: 'stretch', borderLeftWidth: 1.5, borderColor: C.shortbread, borderStyle: 'dashed' },
  lenNumWrap: { flex: 1, alignItems: 'center' },
  lenNum: { fontSize: 30, fontWeight: '800', color: C.cocoaDark, lineHeight: 32 },
  lenNumActive: { color: C.berry },
  lenMin: { fontSize: 12, color: C.mocha, fontWeight: '700', marginTop: -2 },
  lenLabel: { fontSize: 13, fontWeight: '700', color: C.mocha, textAlign: 'center' },

  // Subject notebook frame
  subjectFrame: {
    paddingLeft: 56,
    paddingRight: 20,
    paddingVertical: 18,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  subjectFrameImg: { borderRadius: 16 },

  // Soft card (custom row)
  softCard: {
    backgroundColor: C.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: Spacing.three,
    gap: Spacing.two,
    ...BakeryShadow,
  },
  cardHeading: { fontSize: 14, fontWeight: '800', color: C.cocoaDark },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: BakeryRadii.pill, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6 },
  chipAdd: { borderColor: C.jam, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipText: { fontSize: 13, color: C.mocha, fontWeight: '600' },

  // Custom duration card (framed asset)
  customCard: {
    width: '100%',
    height: 92,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: '15%',
    paddingRight: '18%',
  },
  customCardImg: { borderRadius: 16, resizeMode: 'stretch' },
  customText: { flex: 1, gap: 2 },
  customTitle: { fontSize: 14, fontWeight: '800', color: C.cocoaDark },
  customSub: { fontSize: 10, color: C.mocha, lineHeight: 13 },

  // Start button (framed asset)
  startBtnWrap: { width: '100%' },
  startBtn: {
    width: '100%',
    aspectRatio: 2237 / 491,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3,
    textShadowColor: 'rgba(193,90,110,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  // Back (cat button asset)
  backBtn: { alignSelf: 'center' },
  backBtnImg: { width: 80, height: 60 },

  pressed: { opacity: 0.85 },
});
