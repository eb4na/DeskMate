import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    if (!credited.current) {
      credited.current = true;
      addCoins(earned);
      recordSession(minutes);
      addSubjectTime(subjectName, minutes);
      if (selectedFoodId) markFoodMade(selectedFoodId);
      const { bonus, isComeback: comeback } = updateStreak();
      setStreakBonus(bonus);
      setIsComeback(comeback);
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
            {/* Circular badge with Bun holding the cake */}
            <View style={styles.badgeCircle}>
              <Image source={BUN_FINISHED} style={styles.badgeImage} contentFit="contain" />
            </View>

            <Text style={styles.finishedTitle}>YOU FINISHED YOUR SESSION!</Text>
            <Text style={styles.finishedSubtitle}>Thank you for studying!</Text>

            <View style={styles.heartDivider}><BakeryHeartEmoji size={16} /></View>

            {/* Receipt rows */}
            <View style={styles.receiptList}>
              <ReceiptRow label="Session Number" value={receipt.sessionNo} />
              <ReceiptRow label="Date" value={receipt.date} />
              <ReceiptRow label="Time" value={receipt.time} />
              <ReceiptRow label="Study Time" value={`${minutes} min`} />
              <ReceiptRow
                label="Coins Earned"
                value={`+${actualEarned}`}
                valueIcon={<CoinIcon size={16} />}
              />
              {actualEarned < earned && (
                <Text style={styles.capNote}>Daily cap reached ({DAILY_EARN_CAP}/day)</Text>
              )}
              {streakBonus > 0 && (
                <ReceiptRow
                  label={isComeback ? 'Welcome Back Bonus' : 'Streak Bonus'}
                  value={`+${streakBonus}`}
                  valueIcon={<CoinIcon size={16} />}
                />
              )}
            </View>

            <View style={styles.heartDivider}><BakeryHeartEmoji size={16} /></View>

            {/* Mood picker inline at the bottom of the receipt */}
            <Text style={styles.moodPrompt}>How do you feel after studying?</Text>
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
              <Text style={styles.doneBtnText}>Done</Text>
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
