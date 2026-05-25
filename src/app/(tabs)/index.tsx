import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Companion } from '@/components/companion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { DAILY_SESSIONS_GOAL, TODAY_GOAL } from '@/constants/placeholder-data';
import { getHomeGreeting } from '@/constants/companion-lines';
import { getAmbienceName, getAmbienceEmoji } from '@/app/ambience-picker';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const {
    coins,
    sessionsCompleted,
    reminderEnabled,
    reminderTime,
    streak,
    isPlus,
    ambienceId,
    defaultCompanionId,
    setDefaultCompanion,
  } = useApp();
  const companionLine = getHomeGreeting({
    lastStudyDate: streak.lastStudyDate,
    currentStreak: streak.currentStreak,
  });
  const goalProgress = Math.min(sessionsCompleted, DAILY_SESSIONS_GOAL);
  const goalPct = Math.round((goalProgress / DAILY_SESSIONS_GOAL) * 100);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle" style={styles.greeting}>
            Good study day 👋
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.coinBadge}>
            <ThemedText type="smallBold">🪙 {coins}</ThemedText>
          </ThemedView>
        </ThemedView>

        {/* 1 — Companion in room */}
        <Companion pose="idle" size="full" />

        <ThemedView style={styles.companionSwitchRow}>
          {[
            { id: 'girl' as const, label: 'Girl' },
            { id: 'dude' as const, label: 'Dude' },
          ].map((option) => (
            <Pressable
              key={option.id}
              style={({ pressed }) => [pressed && styles.companionSwitchPressed]}
              onPress={() => setDefaultCompanion(option.id)}>
              <ThemedView
                type={defaultCompanionId === option.id ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.companionSwitchChip}>
                <ThemedText type="small" style={defaultCompanionId === option.id ? styles.companionSwitchTextActive : undefined}>
                  {option.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </ThemedView>

        {/* Companion speech bubble */}
        <ThemedView type="backgroundElement" style={styles.bubbleCard}>
          <ThemedText type="small" style={styles.bubbleText}>{companionLine}</ThemedText>
        </ThemedView>

        {/* 2 — Today's goal */}
        <ThemedView type="backgroundElement" style={styles.goalCard}>
          <ThemedView style={styles.goalHeader}>
            <ThemedText type="smallBold">Today&apos;s goal</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {goalProgress}/{DAILY_SESSIONS_GOAL}
            </ThemedText>
          </ThemedView>
          <ThemedText type="default" style={styles.goalText}>
            {TODAY_GOAL}
          </ThemedText>
          <ThemedView style={styles.progressBarTrack}>
            <ThemedView
              style={[styles.progressBarFill, { width: `${goalPct}%` as unknown as number }]}
            />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {goalPct}% complete
          </ThemedText>
        </ThemedView>

        {/* 3 — Start Session CTA */}
        <Pressable
          style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
          onPress={() => router.push('/session-picker')}>
          <ThemedText type="smallBold" style={styles.startButtonText}>
            Start Session
          </ThemedText>
        </Pressable>

        {/* Reminder shortcut */}
        <Pressable style={styles.reminderRow} onPress={() => router.push('/reminder-settings')}>
          <ThemedText type="small" themeColor="textSecondary">
            🔔 {reminderEnabled ? `Reminder set for ${reminderTime}` : 'Set a daily reminder'}
          </ThemedText>
        </Pressable>

        {/* Ambience shortcut — shows active ambience for Plus, or locked hint */}
        {isPlus ? (
          <Pressable style={styles.reminderRow} onPress={() => router.push('/ambience-picker')}>
            <ThemedText type="small" themeColor="textSecondary">
              {ambienceId
                ? `${getAmbienceEmoji(ambienceId)} Ambience: ${getAmbienceName(ambienceId)}`
                : '🎵 Set study ambience'}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable style={styles.reminderRow} onPress={() => router.push('/plus-upgrade')}>
            <ThemedText type="small" themeColor="textSecondary">
              🎵 Ambience sounds — unlock with Plus
            </ThemedText>
          </Pressable>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 22, lineHeight: 28 },
  coinBadge: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 20 },
  goalCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalText: { lineHeight: 22 },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: 6, backgroundColor: '#7C6F5A', borderRadius: 3 },
  startButton: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  startButtonPressed: { opacity: 0.85 },
  startButtonText: { color: '#FFFFFF', fontSize: 16 },
  reminderRow: { alignItems: 'center', paddingVertical: Spacing.two },
  bubbleCard: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    alignItems: 'center',
  },
  companionSwitchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  companionSwitchChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  companionSwitchPressed: { opacity: 0.85 },
  companionSwitchTextActive: { fontWeight: '700' },
  bubbleText: { textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
});
