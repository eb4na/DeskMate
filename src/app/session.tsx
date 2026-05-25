import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Companion } from '@/components/companion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { COIN_REWARDS } from '@/constants/placeholder-data';
import { getCompanionLine } from '@/constants/companion-lines';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const MAX_PAUSES = 2;
const MIN_MINUTES_FOR_COINS = 10;

export default function SessionScreen() {
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
      const earned = COIN_REWARDS[minutes] ?? 15;
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
      Alert.alert('No pauses left', 'You can only pause twice per session. Keep going!');
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
      const fullCoins = COIN_REWARDS[minutes] ?? 15;
      // Prorated at 50% to discourage gaming
      cancelCoins = Math.floor((minutesElapsed / minutes) * fullCoins * 0.5);
    }

    const coinMsg =
      cancelCoins > 0
        ? `You studied ${minutesElapsed} min and will earn 🪙 ${cancelCoins}.`
        : `Less than ${MIN_MINUTES_FOR_COINS} min studied — no coins this time.`;

    Alert.alert('End session early?', coinMsg, [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'End session',
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
            router.replace('/');
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
          {subject && subject.length > 0 ? subject : 'General Study'}
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
              ? `Paused · ${MAX_PAUSES - pausesUsed} pause${MAX_PAUSES - pausesUsed !== 1 ? 's' : ''} left`
              : 'Focus time'}
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
              {isPaused ? 'Resume' : 'Pause'}
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleCancel} style={styles.cancelBtn}>
            <ThemedText type="small" themeColor="textSecondary">
              End session
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  timerBlock: { alignItems: 'center', gap: Spacing.two },
  timerText: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 80,
    letterSpacing: -2,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  progressFill: { height: 6, backgroundColor: '#7C6F5A', borderRadius: 3 },
  controls: { gap: Spacing.three, alignItems: 'center' },
  pauseBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: 48,
  },
  btnPressed: { opacity: 0.85 },
  pauseBtnText: { color: '#FFFFFF', fontSize: 16 },
  cancelBtn: { paddingVertical: Spacing.two },
});
