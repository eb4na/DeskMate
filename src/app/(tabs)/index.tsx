import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { BakeryGearEmoji } from '@/components/bakery-emoji';
import { getReminderStyleEffect } from '@/constants/shop-effects';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { COIN_REWARDS } from '@/constants/placeholder-data';
import { resolveActiveCompanion } from '@/lib/companion-utils';
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
  return new Date(dateISO).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getExamDay(dateISO: string): number {
  return new Date(dateISO).getDate();
}

function getExamCountdownLabel(days: number): string {
  if (days < 0) return 'Past due';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
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

const HOME_ROOM_IMAGE = require('@/assets/images/home-bedroom.png');
const STREAK_FIRE_ICON = require('@/assets/images/home/streak-fire-icon.png');
const EXAM_BOOK_ICON = require('@/assets/images/home/exam-book-icon.png');
const EXAM_CALENDAR_ICON = require('@/assets/images/home/exam-calendar-icon.png');
const REMINDER_BELL_ICON = require('@/assets/images/home/reminder-bell-icon.png');
const REMINDER_BREAD_ICON = require('@/assets/images/home/reminder-bread-icon.png');

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
    activeCompanionId,
    clearActiveSession,
    companionSlots,
    defaultCompanionId,
  } = useApp();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [didHomeImageFail, setDidHomeImageFail] = useState(false);
  const handledCompletionId = useRef<string | null>(null);
  const activeSessionId = activeSession?.id ?? null;
  const activeCompanion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots);
  const homeCompanionSource =
    didHomeImageFail && activeCompanion.type === 'slot'
      ? resolveActiveCompanion(`starter:${defaultCompanionId}`, defaultCompanionId, companionSlots)
          .imageSource
      : activeCompanion.imageSource;
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
    setDidHomeImageFail(false);
  }, [activeCompanionId]);

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
        ? `You studied ${sessionElapsedMinutes} min and will earn ${cancelCoins} coins.`
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
          <Image
            source={HOME_ROOM_IMAGE}
            style={styles.roomBackground}
            contentFit="cover"
            contentPosition="center"
          />

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
                  <View style={styles.heroImageClip}>
                    <Image
                      source={homeCompanionSource}
                      style={styles.heroImage}
                      contentFit="contain"
                      contentPosition="bottom"
                      onError={() => {
                        if (activeCompanion.type === 'slot') {
                          setDidHomeImageFail(true);
                        }
                      }}
                      accessibilityLabel={`${activeCompanion.name} home character`}
                    />
                  </View>
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
                <View style={styles.statusRow}>
                  <View style={styles.statusChip}>
                    <Image source={STREAK_FIRE_ICON} style={styles.statusStreakIcon} contentFit="contain" accessibilityLabel="" />
                    <ThemedText type="smallBold" style={styles.statusChipText}>
                      {streak.currentStreak} day streak
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => router.push('/coin-shop')}
                    style={({ pressed }) => pressed && styles.cardPressed}
                    accessibilityLabel="Add coins">
                    <View style={[styles.statusChip, styles.coinChip]}>
                      <CoinIcon size={40} />
                      <ThemedText type="smallBold" style={styles.coinChipText}>
                        {coins}
                      </ThemedText>
                      <View style={styles.coinAddBubble}>
                        <ThemedText style={styles.coinAddText}>+</ThemedText>
                      </View>
                    </View>
                  </Pressable>
                </View>

                <View style={styles.metaRow}>
                  <Pressable
                    style={({ pressed }) => [styles.metaCardPressable, pressed && styles.cardPressed]}
                    onPress={handleExamPress}>
                    <View
                      style={[
                        styles.metaCard,
                        examIsUrgent && styles.metaCardUrgent,
                        examIsPast && styles.metaCardPast,
                      ]}>
                      <View style={styles.metaCardHeader}>
                        <View style={styles.examTitleRow}>
                          <Image source={EXAM_BOOK_ICON} style={styles.examBookIcon} contentFit="contain" accessibilityLabel="" />
                          <ThemedText style={styles.metaCardTitle}>Exam</ThemedText>
                        </View>
                      </View>
                      <View style={styles.metaCardContent}>
                        <View style={styles.metaCardTextBlock}>
                          {featuredExam ? (
                            <>
                              <ThemedText style={styles.metaHeadline} numberOfLines={2}>
                                {featuredExam.name}
                              </ThemedText>
                              <ThemedText style={styles.metaSubline}>{formatExamDate(featuredExam.dateISO)}</ThemedText>
                              <ThemedText
                                style={[
                                  styles.metaAccentText,
                                  examIsUrgent && styles.metaAccentTextUrgent,
                                  examIsPast && styles.metaAccentTextPast,
                                ]}>
                                {examDays === null ? '--' : getExamCountdownLabel(examDays)}
                              </ThemedText>
                            </>
                          ) : (
                            <>
                              <ThemedText style={styles.metaHeadline}>No exam yet</ThemedText>
                              <ThemedText style={styles.metaSubline}>Tap to add</ThemedText>
                            </>
                          )}
                        </View>
                        <View style={styles.metaCardArt} pointerEvents="none">
                          <Image source={EXAM_CALENDAR_ICON} style={styles.examCalendarIcon} contentFit="contain" accessibilityLabel="" />
                          {featuredExam ? (
                            <ThemedText style={styles.examCalendarDay}>
                              {getExamDay(featuredExam.dateISO)}
                            </ThemedText>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.metaCardPressable}>
                    <View style={styles.metaCard}>
                      <View style={styles.metaCardHeader}>
                        <View style={styles.reminderTitleRow}>
                          <Image source={REMINDER_BELL_ICON} style={styles.reminderBellIcon} contentFit="contain" accessibilityLabel="" />
                          <ThemedText style={styles.metaCardTitle}>Reminder</ThemedText>
                        </View>
                      </View>
                      <View style={styles.metaCardContent}>
                        <View style={styles.metaCardTextBlock}>
                          <ThemedText style={styles.reminderCopy}>
                            {reminderEnabled
                              ? `Daily ping at ${reminderTime}. ${
                                  isPlus && ambienceId
                                    ? `${getAmbienceEmoji(ambienceId)} ${getAmbienceName(ambienceId)}`
                                    : "You've got this!"
                                }`
                              : "Don't forget to take breaks!\nYou've got this!"}
                          </ThemedText>
                        </View>
                        <View style={styles.metaCardArt} pointerEvents="none">
                          <Image source={REMINDER_BREAD_ICON} style={styles.reminderBreadIcon} contentFit="contain" accessibilityLabel="" />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.settingsButton, pressed && styles.cardPressed]}
                accessibilityLabel="Open settings"
                hitSlop={8}>
                <BakeryGearEmoji size={22} />
              </Pressable>


              <View style={styles.homeCharacterLayer} pointerEvents="none">
                <Image
                  source={homeCompanionSource}
                  style={styles.homeCharacterImage}
                  contentFit="contain"
                  contentPosition="bottom"
                  onError={() => {
                    if (activeCompanion.type === 'slot') {
                      setDidHomeImageFail(true);
                    }
                  }}
                  accessibilityLabel={`${activeCompanion.name} home character`}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.startSessionPressable, pressed && styles.startButtonPressed]}
                onPress={() => router.push('/session-picker')}
                accessibilityLabel="Start session">
                <View style={styles.startSessionBtn}>
                  {/* Baguette crust highlight along the top */}
                  <View style={styles.baguetteHighlight} pointerEvents="none" />
                  {/* Diagonal score cuts like a real baguette */}
                  <View style={styles.scoreRow} pointerEvents="none">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <View key={i} style={styles.scoreMark} />
                    ))}
                  </View>
                  <View style={styles.startSessionInner}>
                    <ThemedText style={styles.startSessionText}>Start Session</ThemedText>
                  </View>
                </View>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const metaCardShadow = {
  shadowColor: '#8B6B57',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDE8DF',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#EDE8DF',
  },
  scene: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    backgroundColor: '#EDE8DF',
  },
  roomBackground: {
    ...StyleSheet.absoluteFill,
  },
  focusMode: {
    flex: 1,
    zIndex: 2,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.two,
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
  focusActions: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.two,
  },
  settingsButton: {
    position: 'absolute',
    top: 196,
    right: Spacing.three,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9F2',
    borderWidth: 1,
    borderColor: '#D9C5B2',
    ...metaCardShadow,
  },
  settingsIcon: { fontSize: 18, lineHeight: 22 },
  topHud: {
    gap: Spacing.two,
    zIndex: 3,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 52,
    overflow: 'hidden',
    borderRadius: BakeryRadii.pill,
    backgroundColor: '#FFF9F2',
    borderWidth: 1,
    borderColor: '#D9C5B2',
    ...metaCardShadow,
  },
  coinChip: {
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  coinChipText: {
    color: BakeryColors.cocoaDark,
  },
  coinAddBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BakeryColors.honey,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D29649',
  },
  coinAddText: {
    color: BakeryColors.cocoaDark,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  statusChipText: {
    fontSize: 13,
    lineHeight: 16,
    color: BakeryColors.cocoaDark,
  },
  heroImageClip: {
    flex: 1,
    width: '96%',
    maxWidth: 372,
    height: 420,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  homeCharacterLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 152,
    bottom: 86,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  homeCharacterImage: {
    width: '135%',
    height: '135%',
    maxWidth: 560,
    transform: [{ translateY: 18 }],
  },
  homeBreadButtonWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    paddingTop: 20,
  },
  homeBreadTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
  },
  homeBreadBump: {
    position: 'absolute',
    top: 0,
    height: 42,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#D29649',
    backgroundColor: '#F6C979',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  homeBreadBumpLeft: {
    left: '5%',
    width: '34%',
  },
  homeBreadBumpCenter: {
    left: '33%',
    width: '34%',
  },
  homeBreadBumpRight: {
    right: '5%',
    width: '34%',
  },
  homeBreadButton: {
    minHeight: 66,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    backgroundColor: BakeryColors.honey,
    borderRadius: 26,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1.5,
    borderColor: '#D29649',
    overflow: 'hidden',
    ...BakeryShadow,
  },
  homeBreadScores: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  homeBreadScore: {
    width: 22,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 248, 241, 0.42)',
  },
  homeBreadScoreLeft: {
    transform: [{ rotate: '-24deg' }],
  },
  homeBreadScoreCenter: {
    transform: [{ rotate: '-12deg' }],
  },
  homeBreadScoreRight: {
    transform: [{ rotate: '16deg' }],
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
    gap: 12,
    alignItems: 'stretch',
    backgroundColor: 'transparent',
  },
  metaCardPressable: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  metaCard: {
    flex: 1,
    width: '100%',
    minHeight: 100,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 4,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#FFF9F2',
    borderWidth: 1,
    borderColor: '#D9C5B2',
    ...metaCardShadow,
  },
  metaCardTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: BakeryColors.cocoaDark,
  },
  metaSubline: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
    color: BakeryColors.mocha,
  },
  metaCardContent: {
    position: 'relative',
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  metaCardTextBlock: {
    paddingRight: 48,
    gap: 2,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  metaCardArt: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  examTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  reminderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  examCalendarDay: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
    color: BakeryColors.cocoaDark,
  },
  metaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  reminderCopy: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
    color: BakeryColors.cocoa,
  },
  metaCardUrgent: {
    shadowColor: BakeryColors.danger,
  },
  metaCardPast: {
    opacity: 0.92,
  },
  metaHeadline: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
    color: BakeryColors.cocoaDark,
  },
  metaAccentText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: '#B87A5A',
  },
  metaAccentTextUrgent: {
    color: '#C45E4A',
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
  startSessionPressable: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: BottomTabInset + 22,
    zIndex: 4,
  },
  startSessionBtn: {
    backgroundColor: '#E6B25C',
    borderRadius: 999,
    paddingVertical: 20,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B07F3C',
    shadowColor: '#8B6B57',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'hidden',
  },
  baguetteHighlight: {
    position: 'absolute',
    top: 5,
    left: 24,
    right: 24,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 247, 230, 0.45)',
  },
  scoreRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    opacity: 0.28,
  },
  scoreMark: {
    width: 6,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#7A5435',
    transform: [{ rotate: '32deg' }],
  },
  startSessionText: {
    fontSize: 18,
    fontWeight: '800',
    color: BakeryColors.cocoaDark,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  startSessionInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  startButtonPressed: { opacity: 0.88 },
  statusStreakIcon: { width: 18, height: 20 },
  examBookIcon: { width: 22, height: 22 },
  reminderBellIcon: { width: 18, height: 18, transform: [{ rotate: '-12deg' }] },
  examCalendarIcon: { width: 44, height: 44 },
  reminderBreadIcon: { width: 44, height: 44, transform: [{ rotate: '-8deg' }] },
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
