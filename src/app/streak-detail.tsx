// The streak, its "at risk / lost" states, and the Streak Freeze — moved off the
// Progress tab when that tab became the subject time tracker. Home already shows
// the streak, so a full-width card on Progress said it twice; it lives behind the
// header chip now.
//
// A centred rectangle popup, not an iOS swipe-down sheet, per the founder's
// standing preference. Structure mirrors achievements.tsx: the backdrop is a
// SIBLING behind the card, never a Pressable wrapping it — a Pressable ancestor
// swallows the pan and the ScrollView stops scrolling.

import { useMemo } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StreakFreezeIcon } from '@/components/streak-freeze-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  STREAK_RESCUE_MAX_GAP,
  STREAK_RESCUE_MIN_GAP,
  daysBetween,
  todayISO,
  useApp,
} from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { showPopup } from '@/lib/popup';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  PastelCards,
  Spacing,
  popupMaxWidth,
} from '@/constants/theme';

const STREAK_FIRE_ICON = require('@/assets/images/home/streak-fire-icon.png');

// Days since a study date, measured the way the streak engine does (daysBetween +
// todayISO), so this screen's "at risk / lost" banner agrees with the actual
// streak transition rather than drifting from it.
function daysSince(dateISO: string): number {
  return daysBetween(dateISO, todayISO());
}

export default function StreakDetailScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const ps = scale;
  const styles = useMemo(() => makeStyles(ps), [ps]);
  const { streak, streakFreezes, useStreakFreeze: applyStreakFreeze } = useApp();

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const missed = streak.lastStudyDate ? daysSince(streak.lastStudyDate) : 0;
  const streakRescuable =
    missed >= STREAK_RESCUE_MIN_GAP && missed <= STREAK_RESCUE_MAX_GAP && streak.currentStreak > 0;
  const streakLost =
    missed > STREAK_RESCUE_MAX_GAP || (missed >= STREAK_RESCUE_MIN_GAP && streak.currentStreak <= 0);
  const freezeDaysLeft = STREAK_RESCUE_MAX_GAP - missed + 1;
  const displayStreak = streakLost ? 0 : streak.currentStreak;

  const confirmFreeze = () => {
    showPopup(t('progress.useFreezeQ'), t('progress.useFreezeMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('progress.useFreeze'),
        onPress: () => {
          const used = applyStreakFreeze();
          if (used) showPopup(t('progress.streakProtected'), t('progress.streakSafe'));
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={dismiss} />

      <View style={styles.card}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}>

          <ThemedView type="transparent" style={styles.streakBlock}>
            <Image
              source={STREAK_FIRE_ICON}
              style={styles.streakFireIcon}
              contentFit="contain"
              accessibilityLabel=""
            />
            <ThemedText style={[styles.streakNumber, streakRescuable && styles.streakNumberPaused]}>
              {displayStreak}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {streakRescuable ? t('progress.previousStreak') : t('home.dayStreak')}
            </ThemedText>
            {streakRescuable && (
              <ThemedText type="small" style={styles.streakAtRisk}>
                {t('progress.streakAtRisk')}
              </ThemedText>
            )}
            {streakLost && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('progress.streakLost')}
              </ThemedText>
            )}
            {streak.longestStreak > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('progress.best', { count: streak.longestStreak })}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView type="transparent" style={styles.freezeCard}>
            <ThemedView type="transparent" style={styles.freezeRow}>
              <StreakFreezeIcon size={52 * ps} />
              <ThemedView type="transparent" style={styles.freezeInfo}>
                <ThemedText type="smallBold">{t('progress.streakFreeze')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('progress.freezesRemaining', { count: streakFreezes })}
                </ThemedText>
              </ThemedView>
              {streakRescuable && streakFreezes > 0 && (
                <Pressable
                  style={({ pressed }) => [styles.freezeBtn, pressed && styles.pressed]}
                  onPress={confirmFreeze}>
                  <ThemedText style={styles.freezeBtnText}>{t('progress.use')}</ThemedText>
                </Pressable>
              )}
            </ThemedView>
            {streakRescuable && streakFreezes > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('progress.freezeDaysLeft', { count: freezeDaysLeft })}
              </ThemedText>
            )}
            {streakRescuable && streakFreezes <= 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('progress.noFreezesLeft')}
              </ThemedText>
            )}
          </ThemedView>
        </ScrollView>

        <Pressable
          onPress={dismiss}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
          <ThemedText style={styles.doneText}>{t('common.done')}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (s: number) => StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  // Negative insets so the dim covers the full screen while the root's padding
  // still holds the card off the edges.
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -Spacing.four,
    right: -Spacing.four,
    backgroundColor: 'rgba(59, 42, 33, 0.35)',
  },
  card: {
    width: '100%',
    maxWidth: popupMaxWidth(360),
    maxHeight: '82%',
    backgroundColor: PastelCards.honey.fill,
    borderRadius: BakeryRadii.panel,
    borderWidth: 1.5,
    borderColor: PastelCards.honey.border,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    alignItems: 'center',
    ...BakeryShadow,
  },
  scroll: { flexShrink: 1, alignSelf: 'stretch' },
  scrollBody: { alignItems: 'center', gap: Spacing.three * s, paddingBottom: 2 * s },

  streakBlock: { alignItems: 'center', gap: 2 * s, paddingTop: Spacing.two * s },
  streakFireIcon: { width: 64 * s, height: 64 * s },
  streakNumber: {
    fontSize: 46 * s,
    lineHeight: 54 * s,
    fontWeight: '900',
    color: BakeryColors.butter,
  },
  streakNumberPaused: { color: BakeryColors.latte },
  streakAtRisk: { color: BakeryColors.berry, fontWeight: '700', textAlign: 'center' },

  freezeCard: {
    alignSelf: 'stretch',
    backgroundColor: BakeryColors.paper,
    borderRadius: BakeryRadii.card * s,
    borderWidth: 1.5,
    borderColor: PastelCards.blush.border,
    padding: Spacing.three * s,
    gap: Spacing.two * s,
  },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  freezeInfo: { flex: 1, gap: 2 * s },
  freezeBtn: {
    borderRadius: BakeryRadii.chip * s,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 8 * s,
    backgroundColor: BakeryColors.buttonPink,
  },
  freezeBtnText: { color: '#FFFFFF', fontWeight: '800' },

  doneBtn: {
    marginTop: Spacing.three * s,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: BakeryRadii.button * s,
    paddingVertical: 12 * s,
    backgroundColor: BakeryColors.buttonPink,
  },
  doneText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 * s },
  pressed: { opacity: 0.85 },
});
