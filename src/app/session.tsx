import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Companion } from '@/components/companion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { coinsForMinutes } from '@/constants/placeholder-data';
import { getCompanionLine } from '@/constants/companion-lines';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

const MAX_PAUSES = 2;
const MIN_MINUTES_FOR_COINS = 10;

export default function SessionScreen() {
  const { t } = useTranslation();
  const { sessionLength, subject, taskId, taskTitle } = useLocalSearchParams<{
    sessionLength: string;
    subject?: string;
    taskId?: string;
    taskTitle?: string;
  }>();

  const minutes = parseInt(sessionLength ?? '25', 10);
  const totalSeconds = minutes * 60;

  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [pausesUsed, setPausesUsed] = useState(0);
  const hasCompleted = useRef(false);
  const startLine = useMemo(() => getCompanionLine('sessionStart'), []);

  const returnToTabs = () => {
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/');
  };

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  // Auto-complete when timer hits zero
  useEffect(() => {
    if (secondsLeft === 0 && !hasCompleted.current) {
      hasCompleted.current = true;
      const earned = coinsForMinutes(minutes);
      router.replace({
        pathname: '/session-complete',
        params: {
          sessionLength: String(minutes),
          subject: subject ?? '',
          coinsEarned: String(earned),
          taskId: taskId ?? '',
          taskTitle: taskTitle ?? '',
        },
      });
    }
  }, [secondsLeft, minutes, subject]);

  const handlePause = () => {
    if (!isPaused && pausesUsed >= MAX_PAUSES) {
      Alert.alert(t('session.noPausesLeft'), t('session.noPausesMsg'));
      return;
    }
    if (!isPaused) setPausesUsed((p) => p + 1);
    setIsPaused((p) => !p);
  };

  const handleCancel = () => {
    const secondsElapsed = totalSeconds - secondsLeft;
    const minutesElapsed = Math.floor(secondsElapsed / 60);

    let cancelCoins = 0;
    if (minutesElapsed >= MIN_MINUTES_FOR_COINS) {
      // 1 coin per minute studied (matches every other earn path).
      cancelCoins = coinsForMinutes(minutesElapsed);
    }

    const coinMsg =
      cancelCoins > 0
        ? t('home.studiedEarn', { minutes: minutesElapsed, coins: cancelCoins })
        : t('home.lessThanMin', { min: MIN_MINUTES_FOR_COINS });

    Alert.alert(t('session.endSessionEarlyQ'), coinMsg, [
      { text: t('session.keepGoing'), style: 'cancel' },
      {
        text: t('session.endSession'),
        style: 'destructive',
        onPress: () => {
          hasCompleted.current = true;
          if (cancelCoins > 0) {
            router.replace({
              pathname: '/session-complete',
              params: {
                sessionLength: String(minutesElapsed),
                subject: subject ?? '',
                coinsEarned: String(cancelCoins),
                taskId: taskId ?? '',
                taskTitle: taskTitle ?? '',
              },
            });
          } else {
            returnToTabs();
          }
        },
      },
    ]);
  };

  const displayMinutes = Math.floor(secondsLeft / 60);
  const displaySeconds = secondsLeft % 60;
  const progressPct = totalSeconds > 0 ? (1 - secondsLeft / totalSeconds) * 100 : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Subject / task label + companion line */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.subjectLabel}>
          {subject && subject.length > 0 ? subject : t('home.generalStudy')}
          {taskTitle && taskTitle.length > 0 ? ` · ${taskTitle}` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.companionLine}>
          {startLine}
        </ThemedText>

        {/* Companion in studying pose */}
        <Companion pose={isPaused ? 'idle' : 'studying'} size="full" />

        {/* Large countdown timer */}
        <ThemedView style={styles.timerBlock}>
          <ThemedText style={styles.timerText}>
            {String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {isPaused
              ? t('session.pausedLeft', { count: MAX_PAUSES - pausesUsed })
              : t('session.focusTime')}
          </ThemedText>
          <ThemedView style={styles.progressTrack}>
            <ThemedView
              style={[styles.progressFill, { width: `${progressPct}%` as unknown as number }]}
            />
          </ThemedView>
        </ThemedView>

        {/* Controls */}
        <ThemedView style={styles.controls}>
          <Pressable
            style={({ pressed }) => [styles.pauseBtn, pressed && styles.btnPressed]}
            onPress={handlePause}>
            <ThemedText type="smallBold" style={styles.pauseBtnText}>
              {isPaused ? t('session.resume') : t('session.pause')}
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleCancel} style={styles.cancelBtn}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('session.endSession')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  subjectLabel: { textAlign: 'center' },
  companionLine: { textAlign: 'center', fontStyle: 'italic', fontSize: 12 },
  timerBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.panel,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  timerText: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 80,
    letterSpacing: -2,
    color: BakeryColors.cocoaDark,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: BakeryColors.shortbread,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  progressFill: { height: 6, backgroundColor: BakeryColors.honey, borderRadius: 3 },
  controls: { gap: Spacing.three, alignItems: 'center' },
  pauseBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    paddingHorizontal: 48,
    ...BakeryShadow,
  },
  btnPressed: { opacity: 0.85 },
  pauseBtnText: { color: BakeryColors.cocoaDark, fontSize: 16 },
  cancelBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: BakeryRadii.chip,
    backgroundColor: BakeryColors.cream,
  },
});
