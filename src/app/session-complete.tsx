import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BakeryHeartEmoji } from '@/components/bakery-emoji';
import { CoinIcon } from '@/components/coin-icon';
import { CompanionLevel } from '@/components/companion-level';
import { DevKnobs } from '@/components/dev-knobs';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { showLoadingScreen } from '@/lib/loading-signal';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

const BUN_FINISHED = require('@/assets/images/bun/bun-finished.png');

// Per-recipe finishing badge — the companion enjoying the baked recipe, shown on
// the completion screen and the food gallery once that recipe has been baked.
const FINISH_IMG: Record<string, number> = {
  'strawberry-shortcake': require('@/assets/images/cake/strawberry-badge.png'),
  'sakura-mochi': require('@/assets/images/cake/sakura-badge.png'),
  pudding: require('@/assets/images/cake/pudding-badge.png'),
  'matcha-crepe': require('@/assets/images/cake/matcha-badge.png'),
  'berry-croissant': require('@/assets/images/cake/croissant-badge.png'),
};

// Patisserie palette for the finished-session card.
const FP = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F4A6B6',
  pinkSoft: '#FBDCE2',
  brown: '#5B3A2E',
  muted: '#9A7B6D',
};


function ReceiptRow({
  label,
  value,
  valueIcon,
}: {
  label: string;
  value: string;
  valueIcon?: React.ReactNode;
}) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <View style={styles.receiptDots} />
      <View style={styles.receiptValueWrap}>
        <Text style={styles.receiptValue}>{value}</Text>
        {valueIcon}
      </View>
    </View>
  );
}

export default function SessionCompleteScreen() {
  const {
    clearSessionRun,
    sessionRun,
    selectedFoodId,
    activeCompanionId,
    companionMinutes,
  } = useApp();
  const { t } = useTranslation();
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('sessioncomplete', [
    { name: 'badge', label: 'Badge' },
    { name: 'doneBtn', label: 'Done btn' },
  ]);

  // Display-only: every block already credited itself (finishStudyBlock). The receipt
  // sums the whole run from the accumulator — the totals across all "Continue
  // studying" blocks since this run began.
  const run = sessionRun ?? { minutes: 0, coins: 0, subjectName: null, streakBonus: 0, isComeback: false };
  const minutes = run.minutes;
  const actualEarned = run.coins;
  const streakBonus = run.streakBonus;
  const isComeback = run.isComeback;

  // Receipt details for the finished-session card (computed once).
  const receipt = useMemo(() => {
    const now = new Date();
    const num = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return {
      sessionNo: `#SESSION-${num}`,
      date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  }, []);

  // Everything (coins/streak/bond) was credited per block in finishStudyBlock —
  // this receipt is pure display. It just releases the run accumulator on the way out
  // (Done → Home) so the next fresh session starts a clean run.
  useEffect(() => {
    return () => clearSessionRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHome = () => {
    showLoadingScreen(undefined, { quick: true });
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.receiptScroll}>
            {/* Circular badge — the companion enjoying the baked recipe (or the
                default Bun-with-cake art). */}
            <View style={[styles.badgeCircle, tw('badge')]}>
              {FINISH_IMG[selectedFoodId ?? ''] ? (
                <Image source={FINISH_IMG[selectedFoodId]} style={styles.badgeImageFill} contentFit="cover" />
              ) : (
                <Image source={BUN_FINISHED} style={styles.badgeImage} contentFit="contain" />
              )}
            </View>

            <Text style={styles.finishedTitle}>{t('sessionComplete.finishedTitle')}</Text>
            <Text style={styles.finishedSubtitle}>{t('sessionComplete.thankYou')}</Text>

            <View style={styles.heartDivider}><BakeryHeartEmoji size={16} /></View>

            {/* Receipt rows */}
            <View style={styles.receiptList}>
              <ReceiptRow label={t('sessionComplete.sessionNumber')} value={receipt.sessionNo} />
              <ReceiptRow label={t('pickers.date')} value={receipt.date} />
              <ReceiptRow label={t('pickers.time')} value={receipt.time} />
              <ReceiptRow label={t('sessionComplete.studyTimeLabel')} value={`${minutes} ${t('sessionComplete.min')}`} />
              <ReceiptRow
                label={t('sessionComplete.coinsEarnedLabel')}
                value={`+${actualEarned}`}
                valueIcon={<CoinIcon size={16} />}
              />
              {streakBonus > 0 && (
                <ReceiptRow
                  label={isComeback ? t('sessionComplete.welcomeBackBonus') : t('sessionComplete.streakBonusLabel')}
                  value={`+${streakBonus}`}
                  valueIcon={<CoinIcon size={16} />}
                />
              )}
            </View>

            {/* Companion bond — level earned by studying with this companion. */}
            <View style={styles.bondBlock}>
              <Text style={styles.bondLabel}>{t('sessionComplete.bondLabel')}</Text>
              <CompanionLevel minutes={companionMinutes?.[activeCompanionId] ?? 0} scale={1.15} />
            </View>

            <View style={styles.heartDivider}><BakeryHeartEmoji size={16} /></View>

            <SoundPressable
              sound="confirm"
              style={({ pressed }) => [styles.doneBtn, tw('doneBtn'), pressed && styles.btnPressed]}
              onPress={goHome}>
              <Text style={styles.doneBtnText}>{t('common.done')}</Text>
            </SoundPressable>
        </ScrollView>
      </SafeAreaView>
      <DevKnobs screen="sessioncomplete" knobs={twKnobs} onChange={twChange} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FP.cream },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },

  // Finished-session receipt design
  receiptScroll: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  badgeCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: FP.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  badgeImage: { width: '92%', height: '92%' },
  badgeImageFill: { width: '100%', height: '100%' },
  finishedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: FP.brown,
    textAlign: 'center',
    letterSpacing: 0.3,
    paddingHorizontal: Spacing.two,
  },
  finishedSubtitle: {
    fontSize: 14,
    color: FP.muted,
    fontWeight: '500',
    textAlign: 'center',
  },
  heartDivider: {
    fontSize: 14,
    color: FP.pink,
    marginVertical: 2,
  },
  receiptList: {
    width: '100%',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  receiptLabel: {
    fontSize: 14,
    color: FP.muted,
    fontWeight: '500',
  },
  receiptDots: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderColor: FP.pinkSoft,
    borderStyle: 'dotted',
    marginBottom: 4,
  },
  receiptValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  receiptValue: {
    fontSize: 14,
    color: FP.brown,
    fontWeight: '700',
  },
  greatJob: {
    fontSize: 14,
    color: FP.muted,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: FP.pink,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    shadowColor: '#D98B9C',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  capNote: {
    fontSize: 11,
    color: FP.muted,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  bondBlock: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 240,
    alignItems: 'center',
    gap: 5,
    marginBottom: Spacing.one,
  },
  bondLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: FP.brown,
    textAlign: 'center',
  },
  rewardBlock: { alignItems: 'center', gap: Spacing.three },
  rewardTitle: { fontSize: 26, lineHeight: 32 },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  coinAmount: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: BakeryColors.honey },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BakeryRadii.card,
    width: '100%',
    backgroundColor: BakeryColors.glass,
  },
  bonusEmoji: { fontSize: 28, lineHeight: 34 },
  taskPromptCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
  },
  taskPromptTitle: { fontSize: 15 },
  taskPromptName: { textAlign: 'center', fontSize: 13 },
  taskPromptBtns: { flexDirection: 'row', gap: Spacing.two, marginTop: 2 },
  taskYesBtn: {
    backgroundColor: BakeryColors.buttonPink,
    borderRadius: BakeryRadii.button,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  taskYesBtnText: { color: BakeryColors.cocoaDark, fontSize: 14 },
  taskNoBtn: {
    borderRadius: BakeryRadii.button,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    backgroundColor: BakeryColors.cream,
  },
  bubbleCard: {
    borderRadius: BakeryRadii.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    width: '100%',
    backgroundColor: BakeryColors.glass,
  },
  bubbleText: { textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  primaryBtn: {
    backgroundColor: BakeryColors.buttonPink,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    ...BakeryShadow,
  },
  btnPressed: { opacity: 0.85 },
  primaryBtnText: { color: BakeryColors.cocoaDark, fontSize: 16 },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  breakBlock: { alignItems: 'center', gap: Spacing.three },
  breakTitle: { fontSize: 24, lineHeight: 30 },
  breakButtons: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  breakHint: { textAlign: 'center' },
  breakBtn: {
    borderRadius: BakeryRadii.card,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    alignItems: 'center',
    backgroundColor: BakeryColors.cream,
  },
});
