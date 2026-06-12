import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BakeryHeartEmoji } from '@/components/bakery-emoji';
import { CoinIcon } from '@/components/coin-icon';
import { Companion } from '@/components/companion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { AFTER_SESSION_MOODS, BREAK_LENGTHS, DAILY_EARN_CAP } from '@/constants/placeholder-data';
import { getCompanionLine } from '@/constants/companion-lines';
import { showLoadingScreen } from '@/lib/loading-signal';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

const BUN_FINISHED = require('@/assets/images/bun/bun-finished.png');

// Per-recipe finishing badge — the companion enjoying the baked recipe, shown on
// the completion screen and the food gallery once that recipe has been baked.
const FINISH_IMG: Record<string, number> = {
  'strawberry-shortcake': require('@/assets/images/cake/strawberry-badge.png'),
  'sakura-mochi': require('@/assets/images/cake/sakura-badge.png'),
  pudding: require('@/assets/images/cake/pudding-finished.png'),
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

type Stage = 'reward' | 'break';

// Whole days between an ISO date (YYYY-MM-DD) and today, ignoring time of day.
function daysFromToday(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = new Date(dateISO);
  past.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - past.getTime()) / 86400000);
}

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
  const { sessionLength, subject, coinsEarned, taskId, taskTitle } = useLocalSearchParams<{
    sessionLength: string;
    subject: string;
    coinsEarned: string;
    taskId?: string;
    taskTitle?: string;
  }>();

  const {
    recordSession,
    addMoodEntry,
    updateStreak,
    addSubjectTime,
    addCoins,
    completeTask,
    isPlus,
    savedBreakPresets,
    selectedFoodId,
    markFoodMade,
    earnedToday,
    streak,
    streakFreezes,
  } = useApp();
  const { t } = useTranslation();
  const credited = useRef(false);
  const moodSaved = useRef(false);
  const moodRing = useRef(new Animated.Value(0)).current;
  const [stage, setStage] = useState<Stage>('reward');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [streakBonus, setStreakBonus] = useState(0);
  const [isComeback, setIsComeback] = useState(false);
  const [taskAnswered, setTaskAnswered] = useState(false);
  const [taskDone, setTaskDone] = useState(false);
  const sessionEndLine = useMemo(() => getCompanionLine('sessionEnd'), []);

  const earned = parseInt(coinsEarned ?? '0', 10);
  const minutes = parseInt(sessionLength ?? '25', 10);
  const subjectName = subject && subject.length > 0 ? subject : null;

  // Coins actually credited after the daily cap (snapshot earnedToday before crediting).
  const earnedTodayAtMount = useRef(earnedToday).current;
  const actualEarned = Math.min(earned, Math.max(0, DAILY_EARN_CAP - earnedTodayAtMount));

  // Break game is offered only for longer sessions: floor(minutes / 12) > 1.
  const breakUnits = Math.floor(minutes / 12);
  const showBreakGame = breakUnits > 1;

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

  useEffect(() => {
    if (credited.current) return;
    credited.current = true;
    addCoins(earned);
    recordSession(minutes);
    addSubjectTime(subjectName, minutes);
    if (selectedFoodId) markFoodMade(selectedFoodId);

    const commit = (rescueWithFreeze: boolean) => {
      const { bonus, isComeback: comeback, rescued } = updateStreak(
        rescueWithFreeze ? { rescueWithFreeze: true } : undefined,
      );
      setStreakBonus(bonus);
      setIsComeback(comeback);
      if (rescued) {
        // streakFreezes is the pre-spend value here (state update is still pending).
        Alert.alert(
          t('progress.streakProtected'),
          t('sessionComplete.freezeUsedMsg', { count: Math.max(0, streakFreezes - 1) }),
        );
      }
    };

    // Streak lapsed 1–3 days ago and the user has a freeze available → ask whether
    // to spend one to keep the streak (otherwise it resets to day 1).
    const last = streak.lastStudyDate;
    const gap = last ? daysFromToday(last) : 0;
    const canRescue = gap >= 2 && gap <= 4 && isPlus && streakFreezes > 0;

    if (canRescue) {
      Alert.alert(
        t('sessionComplete.rescueStreakQ'),
        t('sessionComplete.rescueStreakMsg', { count: streak.currentStreak }),
        [
          { text: t('sessionComplete.letItReset'), style: 'cancel', onPress: () => commit(false) },
          { text: t('progress.useFreeze'), onPress: () => commit(true) },
        ],
      );
    } else {
      commit(false);
    }
  }, []);

  const handleMoodSelect = (value: string) => {
    setSelectedMood(value);
    // Pink circle sweep around the chosen mood.
    moodRing.setValue(0);
    Animated.spring(moodRing, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }).start();
  };

  // Persist the chosen mood (once) and continue to the break offer.
  const commitMoodAndContinue = () => {
    if (selectedMood && !moodSaved.current) {
      const opt = AFTER_SESSION_MOODS.find((m) => m.value === selectedMood);
      if (opt) {
        moodSaved.current = true;
        addMoodEntry({
          value: opt.value,
          label: opt.label,
          type: 'after',
          sessionMinutes: minutes,
          timestamp: new Date().toISOString(),
        });
      }
    }
    if (showBreakGame) {
      setStage('break');
    } else {
      goHome();
    }
  };

  const handleTaskComplete = () => {
    if (taskId) {
      completeTask(taskId);
      setTaskDone(true);
    }
    setTaskAnswered(true);
  };

  const handleTaskSkip = () => {
    setTaskAnswered(true);
  };

  const goHome = () => {
    // Re-show the loading screen as a transition back from studying.
    showLoadingScreen();
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/');
  };
  const startBreak = (breakMins: number) =>
    router.replace({
      pathname: '/break-game',
      params: { breakMinutes: String(breakMins), fromSession: '1' },
    });
  const openCustomBreak = () =>
    router.push({ pathname: '/custom-timer', params: { mode: 'break' } });
  const breakOptions = Array.from(
    new Set([...BREAK_LENGTHS, ...(isPlus ? savedBreakPresets.map((preset) => preset.minutes) : [])]),
  ).sort((a, b) => a - b);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {stage === 'reward' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.receiptScroll}>
            {/* Circular badge — the companion enjoying the baked recipe (or the
                default Bun-with-cake art). */}
            <View style={styles.badgeCircle}>
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
              {actualEarned < earned && (
                <Text style={styles.capNote}>{t('sessionComplete.dailyCapReached', { cap: DAILY_EARN_CAP })}</Text>
              )}
              {streakBonus > 0 && (
                <ReceiptRow
                  label={isComeback ? t('sessionComplete.welcomeBackBonus') : t('sessionComplete.streakBonusLabel')}
                  value={`+${streakBonus}`}
                  valueIcon={<CoinIcon size={16} />}
                />
              )}
            </View>

            <View style={styles.heartDivider}><BakeryHeartEmoji size={16} /></View>

            {/* Mood picker inline at the bottom of the receipt */}
            <Text style={styles.moodPrompt}>{t('sessionComplete.moodPrompt')}</Text>
            <View style={styles.moodRow}>
              {AFTER_SESSION_MOODS.map((opt) => {
                const isSelected = selectedMood === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={styles.moodOption}
                    onPress={() => handleMoodSelect(opt.value)}>
                    <View style={styles.moodCircle}>
                      <Image source={opt.image} style={styles.moodFace} contentFit="contain" />
                      {isSelected && (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.moodRing,
                            {
                              opacity: moodRing,
                              transform: [
                                {
                                  scale: moodRing.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1.4, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      )}
                    </View>
                    <Text style={[styles.moodLabel, isSelected && styles.moodLabelActive]} numberOfLines={1}>
                      {t(`moods.${opt.value}`, { defaultValue: opt.label })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
              onPress={commitMoodAndContinue}>
              <Text style={styles.doneBtnText}>{t('common.done')}</Text>
            </Pressable>
          </ScrollView>
        )}

        {stage === 'break' && (
          <>
            <Companion pose="break" size="full" />

            <ThemedView style={styles.breakBlock}>
              <ThemedText type="subtitle" style={styles.breakTitle}>
                {t('sessionComplete.takeABreak')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('sessionComplete.youEarnedIt')}
              </ThemedText>
              <ThemedView style={styles.breakButtons}>
                {breakOptions.map((len) => (
                  <Pressable
                    key={len}
                    style={({ pressed }) => [styles.breakBtn, pressed && styles.btnPressed]}
                    onPress={() => startBreak(len)}>
                    <ThemedText type="smallBold">{len} {t('sessionComplete.min')}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
              {isPlus ? (
                <>
                  {savedBreakPresets.length > 0 && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.breakHint}>
                      {t('sessionComplete.savedPresetsIncluded')}
                    </ThemedText>
                  )}
                  <Pressable onPress={openCustomBreak} style={styles.customBreakLink}>
                    <ThemedText type="linkPrimary">{t('sessionComplete.customBreak')}</ThemedText>
                  </Pressable>
                </>
              ) : null}
            </ThemedView>

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={goHome}>
              <ThemedText type="smallBold" style={styles.primaryBtnText}>
                {t('sessionComplete.backToHome')}
              </ThemedText>
            </Pressable>
          </>
        )}
      </SafeAreaView>
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
  moodPrompt: {
    fontSize: 14,
    fontWeight: '700',
    color: FP.brown,
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  moodOption: { alignItems: 'center', gap: 4, width: 64 },
  moodCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: FP.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodFace: { width: 46, height: 46 },
  moodRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: FP.pink,
  },
  moodLabel: { fontSize: 10, color: FP.muted, fontWeight: '500', textAlign: 'center' },
  moodLabelActive: { color: FP.pink, fontWeight: '800' },

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
    backgroundColor: BakeryColors.honey,
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
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    ...BakeryShadow,
  },
  btnPressed: { opacity: 0.85 },
  primaryBtnText: { color: BakeryColors.cocoaDark, fontSize: 16 },
  moodBlock: { alignItems: 'center', gap: Spacing.three },
  moodTitle: { fontSize: 24, lineHeight: 30 },
  moodGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  moodBtn: {
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: BakeryRadii.card,
    gap: 4,
    minWidth: 76,
    backgroundColor: BakeryColors.glass,
  },
  moodEmoji: { fontSize: 32, lineHeight: 40 },
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
  customBreakLink: { paddingVertical: Spacing.one },
});
