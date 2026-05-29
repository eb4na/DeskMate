import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { Companion } from '@/components/companion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { AFTER_SESSION_MOODS, BREAK_LENGTHS } from '@/constants/placeholder-data';
import { getCompanionLine } from '@/constants/companion-lines';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

type Stage = 'reward' | 'mood' | 'break';

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
  } = useApp();
  const credited = useRef(false);
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

  useEffect(() => {
    if (!credited.current) {
      credited.current = true;
      addCoins(earned);
      recordSession(minutes);
      addSubjectTime(subjectName, minutes);
      const { bonus, isComeback: comeback } = updateStreak();
      setStreakBonus(bonus);
      setIsComeback(comeback);
    }
  }, []);

  const handleMoodSelect = (value: string, label: string) => {
    setSelectedMood(value);
    addMoodEntry({
      value,
      label,
      type: 'after',
      sessionMinutes: minutes,
      timestamp: new Date().toISOString(),
    });
    setStage('break');
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
          <>
            <Companion pose="proud" size="full" />

            <ThemedView style={styles.rewardBlock}>
              <ThemedText type="subtitle" style={styles.rewardTitle}>
                Session complete!
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {subjectName ?? 'General Study'} · {minutes} min
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.bubbleCard}>
                <ThemedText type="small" style={styles.bubbleText}>{sessionEndLine}</ThemedText>
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.coinRow}>
                <CoinIcon size={56} />
                <ThemedText style={styles.coinAmount}>+{earned}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Focus Coins
                </ThemedText>
              </ThemedView>

              {taskDone && (
                <ThemedView type="backgroundElement" style={styles.bonusRow}>
                  <ThemedText style={styles.bonusEmoji}>✅</ThemedText>
                  <ThemedView>
                    <ThemedText type="smallBold">Task done!</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Marked complete</ThemedText>
                  </ThemedView>
                </ThemedView>
              )}

              {streakBonus > 0 && (
                <ThemedView type="backgroundElement" style={styles.bonusRow}>
                  <ThemedText style={styles.bonusEmoji}>{isComeback ? '💪' : '🔥'}</ThemedText>
                  <ThemedView>
                    <ThemedText type="smallBold">
                      {isComeback ? 'Welcome back!' : 'Streak bonus!'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      +{streakBonus} bonus coins
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              )}

              {/* Task completion prompt */}
              {taskTitle && taskTitle.length > 0 && !taskAnswered && (
                <ThemedView type="backgroundElement" style={styles.taskPromptCard}>
                  <ThemedText type="smallBold" style={styles.taskPromptTitle}>
                    Did you finish this task?
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.taskPromptName}>
                    {taskTitle}
                  </ThemedText>
                  <ThemedView style={styles.taskPromptBtns}>
                    <Pressable
                      style={({ pressed }) => [styles.taskYesBtn, pressed && styles.btnPressed]}
                      onPress={handleTaskComplete}>
                      <ThemedText type="smallBold" style={styles.taskYesBtnText}>
                        ✓ Yes, finished
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.taskNoBtn, pressed && styles.btnPressed]}
                      onPress={handleTaskSkip}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Not yet
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={() => setStage('mood')}>
              <ThemedText type="smallBold" style={styles.primaryBtnText}>
                Continue
              </ThemedText>
            </Pressable>
          </>
        )}

        {stage === 'mood' && (
          <>
            <Companion pose="cheering" size="full" />

            <ThemedView style={styles.moodBlock}>
              <ThemedText type="subtitle" style={styles.moodTitle}>
                How do you feel?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                After studying
              </ThemedText>
              <ThemedView style={styles.moodGrid}>
                {AFTER_SESSION_MOODS.map((opt) => {
                  const isSelected = selectedMood === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={({ pressed }) => [pressed && styles.btnPressed]}
                      onPress={() => handleMoodSelect(opt.value, opt.label)}>
                      <ThemedView
                        type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.moodBtn}>
                        <ThemedText style={styles.moodEmoji}>{opt.emoji}</ThemedText>
                        <ThemedText type="small">{opt.label}</ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>
            </ThemedView>

            <Pressable onPress={() => setStage('break')} style={styles.skipBtn}>
              <ThemedText type="linkPrimary">Skip for now</ThemedText>
            </Pressable>
          </>
        )}

        {stage === 'break' && (
          <>
            <Companion pose="break" size="full" />

            <ThemedView style={styles.breakBlock}>
              <ThemedText type="subtitle" style={styles.breakTitle}>
                Take a break?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You earned it. Relax for a bit.
              </ThemedText>
              <ThemedView style={styles.breakButtons}>
                {breakOptions.map((len) => (
                  <Pressable
                    key={len}
                    style={({ pressed }) => [styles.breakBtn, pressed && styles.btnPressed]}
                    onPress={() => startBreak(len)}>
                    <ThemedText type="smallBold">{len} min</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
              {isPlus ? (
                <>
                  {savedBreakPresets.length > 0 && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.breakHint}>
                      Saved break presets are included above.
                    </ThemedText>
                  )}
                  <Pressable onPress={openCustomBreak} style={styles.customBreakLink}>
                    <ThemedText type="linkPrimary">Custom break →</ThemedText>
                  </Pressable>
                </>
              ) : null}
            </ThemedView>

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={goHome}>
              <ThemedText type="smallBold" style={styles.primaryBtnText}>
                Back to home
              </ThemedText>
            </Pressable>
          </>
        )}
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
    gap: Spacing.four,
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
