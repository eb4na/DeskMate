import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getReminderStyleEffect } from '@/constants/shop-effects';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { COIN_REWARDS } from '@/constants/placeholder-data';
import { getAmbienceEmoji, getAmbienceName } from '@/app/ambience-picker';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

const MIN_MINUTES_FOR_COINS = 10;
const DEFAULT_BREAK_MINUTES = 5;

function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateISO);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function formatExamDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCountdownLabel(days: number): string {
  if (days < 0) return 'Past due';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function getSessionSecondsLeft(startedAt: string, durationMinutes: number, nowMs: number): number {
  const endMs = new Date(startedAt).getTime() + durationMinutes * 60000;
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

function getSessionElapsedMinutes(startedAt: string, durationMinutes: number, nowMs: number): number {
  const elapsedMs = Math.max(0, nowMs - new Date(startedAt).getTime());
  return Math.min(durationMinutes, Math.floor(elapsedMs / 60000));
}

function formatTimerLabel(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const HOME_ROOM_IMAGE = require('@/assets/images/sunlit-bedroom-sanctuary-stockcake.webp');
const HOME_CHARACTER_IMAGE = require('@/assets/images/companion/anime_girl_PNG96_cutout.png');

export default function HomeScreen() {
  const {
    coins,
    reminderEnabled,
    reminderTime,
    streak,
    isPlus,
    ambienceId,
    equippedShopItems,
    examCountdowns,
    activeSession,
    clearActiveSession,
  } = useApp();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const handledCompletionId = useRef<string | null>(null);
  const activeSessionId = activeSession?.id ?? null;
  const reminderStyle = getReminderStyleEffect(equippedShopItems);
  const nextUpcomingExam = [...examCountdowns]
    .filter((exam) => daysUntil(exam.dateISO) >= 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0];
  const latestExam = [...examCountdowns].sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
  const featuredExam = nextUpcomingExam ?? latestExam ?? null;
  const examDays = featuredExam ? daysUntil(featuredExam.dateISO) : null;
  const examIsUrgent = examDays !== null && examDays >= 0 && examDays <= 7;
  const examIsPast = examDays !== null && examDays < 0;
  const sessionNowMs = activeSession
    ? Math.max(nowMs, new Date(activeSession.startedAt).getTime())
    : nowMs;
  const sessionSecondsLeft = activeSession
    ? getSessionSecondsLeft(activeSession.startedAt, activeSession.durationMinutes, sessionNowMs)
    : 0;
  const sessionElapsedMinutes = activeSession
    ? getSessionElapsedMinutes(activeSession.startedAt, activeSession.durationMinutes, sessionNowMs)
    : 0;

  useEffect(() => {
    if (!activeSessionId) {
      handledCompletionId.current = null;
      return;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSession || sessionSecondsLeft > 0) return;
    if (handledCompletionId.current === activeSession.id) return;

    handledCompletionId.current = activeSession.id;
    clearActiveSession();
    router.push({
      pathname: '/session-complete',
      params: {
        sessionLength: String(activeSession.durationMinutes),
        subject: activeSession.subjectName ?? '',
        coinsEarned: String(COIN_REWARDS[activeSession.durationMinutes] ?? 15),
        taskId: activeSession.taskId ?? '',
        taskTitle: activeSession.taskTitle ?? '',
      },
    });
  }, [activeSession, clearActiveSession, sessionSecondsLeft]);

  const handleExamPress = () => {
    if (featuredExam) {
      router.push('/progress');
      return;
    }
    router.push('/add-exam');
  };

  const handleStopSession = () => {
    if (!activeSession) return;

    const cancelCoins =
      sessionElapsedMinutes >= MIN_MINUTES_FOR_COINS
        ? Math.floor(
            (sessionElapsedMinutes / activeSession.durationMinutes) *
              (COIN_REWARDS[activeSession.durationMinutes] ?? 15) *
              0.5,
          )
        : 0;
    const message =
      cancelCoins > 0
        ? `You studied ${sessionElapsedMinutes} min and will earn 🪙 ${cancelCoins}.`
        : `Less than ${MIN_MINUTES_FOR_COINS} min studied, so no coins this time.`;

    Alert.alert('Stop session?', message, [
      { text: 'Keep studying', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: () => {
          const endedSession = activeSession;
          clearActiveSession();

          if (cancelCoins > 0) {
            router.push({
              pathname: '/session-complete',
              params: {
                sessionLength: String(sessionElapsedMinutes),
                subject: endedSession.subjectName ?? '',
                coinsEarned: String(cancelCoins),
                taskId: endedSession.taskId ?? '',
                taskTitle: endedSession.taskTitle ?? '',
              },
            });
          }
        },
      },
    ]);
  };

  const handleBreakGame = () => {
    if (!activeSession) return;

    Alert.alert('Open break game?', 'This will end the current session and open a break game.', [
      { text: 'Keep studying', style: 'cancel' },
      {
        text: 'Break game',
        onPress: () => {
          clearActiveSession();
          router.push({
            pathname: '/break-game',
            params: {
              breakMinutes: String(DEFAULT_BREAK_MINUTES),
              fromSession: '1',
            },
          });
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.scene}>
          <Image source={HOME_ROOM_IMAGE} style={styles.roomBackground} contentFit="cover" />
          <View style={styles.roomOverlay} />

          {activeSession ? (
            <View style={styles.focusMode}>
              <View style={styles.focusModeInner}>
                <ThemedView style={styles.focusBadge}>
                  <ThemedText type="smallBold" style={styles.focusBadgeText}>
                    Focus Mode
                  </ThemedText>
                </ThemedView>

                <ThemedView style={styles.focusTimerCard}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.focusMeta}>
                    {activeSession.subjectName ?? 'General Study'}
                    {activeSession.taskTitle ? ` · ${activeSession.taskTitle}` : ''}
                  </ThemedText>
                  <ThemedText style={styles.focusTimerText}>
                    {formatTimerLabel(sessionSecondsLeft)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.focusMeta}>
                    {activeSession.durationMinutes} minute session
                  </ThemedText>
                </ThemedView>

                <View style={styles.focusCharacterArea} pointerEvents="none">
                  <Image
                    source={HOME_CHARACTER_IMAGE}
                    style={styles.focusHeroImage}
                    contentFit="contain"
                    contentPosition="bottom"
                    accessibilityLabel="Home character"
                  />
                </View>

                <View style={styles.focusActions}>
                  <Pressable
                    style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
                    onPress={handleStopSession}>
                    <ThemedText type="smallBold" style={styles.startButtonText}>
                      Stop
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.breakButton, pressed && styles.cardPressed]}
                    onPress={handleBreakGame}>
                    <ThemedText type="smallBold" style={styles.breakButtonText}>
                      Break Game
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.topHud}>
                <View style={styles.statusStack}>
                  <ThemedView style={[styles.statusChip, styles.coinChip]}>
                    <ThemedText type="smallBold" style={styles.coinChipText}>
                      🪙 {coins}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.statusChip}>
                    <ThemedText type="small" style={styles.statusChipText}>
                      🔥 {streak.currentStreak} day streak
                    </ThemedText>
                  </ThemedView>
                </View>

                <View style={styles.topInfoStack}>
                  <View style={styles.metaRow}>
                    <Pressable
                      style={({ pressed }) => [styles.metaCardPressable, pressed && styles.cardPressed]}
                      onPress={handleExamPress}>
                      <ThemedView
                        style={[
                          styles.metaCard,
                          examIsUrgent && styles.metaCardUrgent,
                          examIsPast && styles.metaCardPast,
                        ]}>
                        <ThemedText type="smallBold">Exam</ThemedText>
                        {featuredExam ? (
                          <>
                            <ThemedText style={styles.metaHeadline} numberOfLines={1}>
                              {featuredExam.name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                              {featuredExam.subject ? `${featuredExam.subject} · ` : ''}
                              {formatExamDate(featuredExam.dateISO)}
                            </ThemedText>
                            <ThemedText
                              type="smallBold"
                              style={[
                                styles.metaAccentText,
                                examIsUrgent && styles.metaAccentTextUrgent,
                                examIsPast && styles.metaAccentTextPast,
                              ]}>
                              {examDays === null ? '--' : getCountdownLabel(examDays)}
                            </ThemedText>
                          </>
                        ) : (
                          <>
                            <ThemedText style={styles.metaHeadline}>No exam yet</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              Add a countdown
                            </ThemedText>
                          </>
                        )}
                      </ThemedView>
                    </Pressable>

                    <ThemedView style={styles.metaCard}>
                      <ThemedText type="smallBold">Reminder</ThemedText>
                      <ThemedText style={styles.metaHeadline}>
                        {reminderStyle?.emoji ?? '🔔'} {reminderEnabled ? reminderTime : 'Reminder off'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                        {isPlus
                          ? ambienceId
                            ? `${getAmbienceEmoji(ambienceId)} ${getAmbienceName(ambienceId)}`
                            : 'Pick an ambience'
                          : 'Unlock ambience with Plus'}
                      </ThemedText>
                    </ThemedView>
                  </View>
                </View>
              </View>

              <View style={styles.characterArea} pointerEvents="none">
                <Image
                  source={HOME_CHARACTER_IMAGE}
                  style={styles.heroImage}
                  contentFit="contain"
                  contentPosition="bottom"
                  accessibilityLabel="Home character"
                />
              </View>

              <View style={styles.bottomHud}>
                <Pressable
                  style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/session-picker')}>
                  <ThemedText type="smallBold" style={styles.startButtonText}>
                    Start Session
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#AF949B',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#AF949B',
  },
  scene: {
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.two,
    justifyContent: 'space-between',
    backgroundColor: '#AF949B',
  },
  roomBackground: {
    ...StyleSheet.absoluteFill,
  },
  roomOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(74, 48, 32, 0.03)',
  },
  focusMode: {
    flex: 1,
    zIndex: 2,
  },
  focusModeInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  focusBadge: {
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 249, 241, 0.94)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  focusBadgeText: {
    color: BakeryColors.mocha,
  },
  focusTimerCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BakeryRadii.panel,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  focusMeta: {
    textAlign: 'center',
    lineHeight: 20,
  },
  focusTimerText: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '700',
    letterSpacing: -2,
    color: BakeryColors.cocoaDark,
  },
  focusCharacterArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  focusHeroImage: {
    width: '98%',
    maxWidth: 380,
    height: '100%',
    maxHeight: 440,
  },
  focusActions: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.two,
  },
  topHud: {
    gap: Spacing.two,
    zIndex: 2,
  },
  statusStack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignSelf: 'flex-start',
  },
  topInfoStack: {
    gap: Spacing.two,
    width: '100%',
  },
  statusChip: {
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 249, 241, 0.94)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  coinChip: {
    backgroundColor: 'rgba(255, 236, 199, 0.98)',
  },
  coinChipText: {
    color: BakeryColors.cocoaDark,
  },
  statusChipText: {
    color: BakeryColors.cocoa,
  },
  characterArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    backgroundColor: 'transparent',
  },
  heroImage: {
    width: '96%',
    maxWidth: 372,
    height: '100%',
    maxHeight: 430,
  },
  bottomHud: {
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  cardPressed: { opacity: 0.85 },
  bubbleCard: {
    borderRadius: BakeryRadii.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  bubbleText: {
    textAlign: 'center',
    lineHeight: 20,
    color: BakeryColors.cocoaDark,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  metaCardPressable: {
    flex: 1,
  },
  metaCard: {
    minHeight: 96,
    borderRadius: BakeryRadii.card,
    padding: Spacing.two,
    gap: 4,
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  metaCardUrgent: {
    borderColor: `${BakeryColors.danger}66`,
  },
  metaCardPast: {
    borderColor: '#99999955',
  },
  metaHeadline: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaAccentText: {
    color: BakeryColors.mocha,
  },
  metaAccentTextUrgent: {
    color: BakeryColors.danger,
  },
  metaAccentTextPast: {
    color: '#999',
  },
  startButton: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D29649',
    ...BakeryShadow,
  },
  startButtonPressed: { opacity: 0.85 },
  startButtonText: { color: BakeryColors.cocoaDark, fontSize: 17 },
  breakButton: {
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    ...BakeryShadow,
  },
  breakButtonText: {
    color: BakeryColors.mocha,
    fontSize: 16,
  },
});
