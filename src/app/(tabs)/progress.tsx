import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlusGateCard } from '@/components/plus-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateISO);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysSince(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = new Date(dateISO);
  past.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - past.getTime()) / 86400000);
}

export default function ProgressScreen() {
  const { isGuest, user, signOut } = useAuth();
  const {
    sessionsCompleted,
    totalMinutes,
    examCountdowns,
    removeExam,
    streak,
    moodEntries,
    subjects,
    subjectTimeMap,
    sessionHistory,
    isPlus,
    streakFreezes,
    aiTickets,
    useStreakFreeze: applyStreakFreeze,
  } = useApp();

  const canAddExam = isPlus || examCountdowns.length < 3;
  const examLimitText = isPlus
    ? `${examCountdowns.length} exams`
    : `${examCountdowns.length}/3`;
  const recentMoods = moodEntries.slice(0, 10);

  // ── Weekly summary for the "This week" card ───────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStartISO = sevenDaysAgo.toISOString().split('T')[0];
  const weekSessions = sessionHistory.filter((r) => r.dateISO >= weekStartISO);
  const weekMinutes = weekSessions.reduce((s, r) => s + r.minutes, 0);
  const weekDays = new Set(weekSessions.map((r) => r.dateISO)).size;

  // ── Mood insight ──────────────────────────────────────────────────────────
  const afterMoods = moodEntries.filter((m) => m.type === 'after');
  const POSITIVE = new Set(['proud', 'better', 'relieved']);
  const posCount = afterMoods.filter((m) => POSITIVE.has(m.value)).length;
  const moodInsightPct = afterMoods.length >= 5
    ? Math.round((posCount / afterMoods.length) * 100)
    : null;

  // ── Subject time breakdown ────────────────────────────────────────────────

  const subjectEntries = Object.entries(subjectTimeMap).sort((a, b) => b[1] - a[1]);
  const totalTrackedMinutes = subjectEntries.reduce((sum, [, m]) => sum + m, 0);
  const mostStudied = subjectEntries[0];
  const leastStudied = subjectEntries
    .filter(([name]) => name !== 'General Study' && subjects.some((s) => s.name === name && !s.archived))
    .at(-1);

  // ── Session insights ─────────────────────────────────────────────────────

  const avgMinutes =
    sessionHistory.length > 0
      ? Math.round(sessionHistory.reduce((s, r) => s + r.minutes, 0) / sessionHistory.length)
      : 0;

  const dayMap: Record<string, number> = {};
  for (const rec of sessionHistory) {
    dayMap[rec.dateISO] = (dayMap[rec.dateISO] ?? 0) + rec.minutes;
  }
  const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];

  const mondayISO = getMondayISO();
  const daysThisWeek = new Set(sessionHistory.filter((r) => r.dateISO >= mondayISO).map((r) => r.dateISO)).size;

  const handleSignOut = () => {
    Alert.alert(isGuest ? 'Leave guest mode?' : 'Sign out?', isGuest
      ? 'You can come back to the login screen anytime.'
      : 'You can sign back in anytime with the same account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isGuest ? 'Leave guest mode' : 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/login');
          } catch (error) {
            Alert.alert(
              'Sign-out failed',
              error instanceof Error ? error.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            Progress
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.accountCard}>
            <ThemedView style={styles.accountInfo}>
              <ThemedText type="smallBold">Account</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isGuest ? 'Guest mode' : user?.email ?? 'Signed in'}
              </ThemedText>
            </ThemedView>
            <Pressable
              style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
              onPress={handleSignOut}>
              <ThemedText type="smallBold" style={styles.signOutText}>
                {isGuest ? 'Leave guest mode' : 'Sign out'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {/* ── This week summary ────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [styles.weekCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/weekly-report')}>
            <ThemedView type="backgroundElement" style={styles.weekCardInner}>
              <ThemedView style={styles.weekLeft}>
                <ThemedText type="smallBold">This week</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {weekSessions.length} sessions · {weekMinutes}m · {weekDays} day{weekDays !== 1 ? 's' : ''}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.weekRight}>
                <ThemedText type="small" style={styles.weekReportLink}>
                  Full report →
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </Pressable>

          {/* ── Streak ────────────────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.streakCard}>
            <ThemedText style={styles.streakFire}>🔥</ThemedText>
            <ThemedText style={styles.streakNumber}>{streak.currentStreak}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              day streak
            </ThemedText>
            {streak.longestStreak > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                Best: {streak.longestStreak} days
              </ThemedText>
            )}
          </ThemedView>

          {/* ── Streak Freeze ─────────────────────────────────────────────── */}
          {isPlus ? (
            <ThemedView type="backgroundElement" style={styles.freezeCard}>
              <ThemedView style={styles.freezeRow}>
                <ThemedText style={styles.freezeEmoji}>🧊</ThemedText>
                <ThemedView style={styles.freezeInfo}>
                  <ThemedText type="smallBold">Streak Freeze</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {streakFreezes}/3 freezes remaining this month
                  </ThemedText>
                </ThemedView>
                {streak.lastStudyDate &&
                  daysSince(streak.lastStudyDate) === 2 &&
                  streakFreezes > 0 && (
                  <Pressable
                    style={({ pressed }) => [styles.freezeBtn, pressed && styles.pressed]}
                    onPress={() => {
                      Alert.alert(
                        'Use Streak Freeze?',
                        'This fills in yesterday so your streak can continue when you study today. No coins are awarded.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Use Freeze',
                            onPress: () => {
                              const used = applyStreakFreeze();
                              if (used) Alert.alert('Streak protected! 🧊', 'Your streak is safe.');
                            },
                          },
                        ],
                      );
                    }}>
                    <ThemedText style={styles.freezeBtnText}>Use</ThemedText>
                  </Pressable>
                )}
              </ThemedView>
              {streak.lastStudyDate && daysSince(streak.lastStudyDate) === 2 && streakFreezes <= 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  No freezes left this month. They reset on the 1st.
                </ThemedText>
              )}
              {streak.lastStudyDate && daysSince(streak.lastStudyDate) > 2 && (
                <ThemedText type="small" themeColor="textSecondary">
                  Streak freeze covers one missed day. Complete a session to start a new streak.
                </ThemedText>
              )}
            </ThemedView>
          ) : (
            <PlusGateCard
              emoji="🧊"
              title="Streak Freeze"
              description="3 per month — protect your streak from missed days without earning coins."
            />
          )}

          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <ThemedView style={styles.statsRow}>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText style={styles.statValue}>{sessionsCompleted}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                Sessions
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText style={styles.statValue}>{totalMinutes}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                Minutes
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText style={styles.statValue}>{daysThisWeek}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                Days this week
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* ── Session insights ──────────────────────────────────────────── */}
          {sessionHistory.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Session insights</ThemedText>
              <ThemedView style={styles.insightRow}>
                <ThemedView type="backgroundElement" style={styles.insightCard}>
                  <ThemedText style={styles.insightValue}>{avgMinutes}m</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.insightLabel}>
                    Avg session
                  </ThemedText>
                </ThemedView>
                {bestDayEntry && (
                  <ThemedView type="backgroundElement" style={styles.insightCard}>
                    <ThemedText style={styles.insightValue}>{bestDayEntry[1]}m</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.insightLabel}>
                      Best day {formatDate(bestDayEntry[0])}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </ThemedView>
          )}

          {/* ── Subject time breakdown ────────────────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Time by subject</ThemedText>

            {subjectEntries.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Tag sessions with a subject to see your breakdown here.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView style={styles.subjectList}>
                {subjectEntries.map(([name, minutes]) => {
                  const subject = subjects.find((s) => s.name === name);
                  const pct = totalTrackedMinutes > 0 ? (minutes / totalTrackedMinutes) * 100 : 0;
                  const barColor = subject?.color ?? '#7C6F5A';
                  return (
                    <ThemedView key={name} type="backgroundElement" style={styles.subjectRow}>
                      <ThemedView style={styles.subjectRowTop}>
                        <ThemedView style={styles.subjectLeft}>
                          <ThemedView style={[styles.subjectDot, { backgroundColor: barColor }]} />
                          <ThemedText type="small" style={styles.subjectName}>{name}</ThemedText>
                        </ThemedView>
                        <ThemedText type="smallBold" style={styles.subjectMinutes}>
                          {minutes}m
                        </ThemedText>
                      </ThemedView>
                      <ThemedView style={styles.subjectBar}>
                        <ThemedView
                          style={[styles.subjectBarFill, { width: `${pct}%`, backgroundColor: barColor + 'AA' }]}
                        />
                      </ThemedView>
                    </ThemedView>
                  );
                })}
              </ThemedView>
            )}

            {mostStudied && (
              <ThemedView style={styles.highlightRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  🏆 Most studied: <ThemedText type="smallBold">{mostStudied[0]}</ThemedText>
                </ThemedText>
                {leastStudied && (
                  <ThemedText type="small" themeColor="textSecondary">
                    💤 Least studied: <ThemedText type="smallBold">{leastStudied[0]}</ThemedText>
                  </ThemedText>
                )}
              </ThemedView>
            )}
          </ThemedView>

          {/* ── Mood tracker ──────────────────────────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Mood tracker</ThemedText>
            {recentMoods.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Your mood check-ins will appear here after sessions.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView style={styles.moodList}>
                {recentMoods.map((entry) => {
                  const dateStr = new Date(entry.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  return (
                    <ThemedView key={entry.id} type="backgroundElement" style={styles.moodRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.moodType}>
                        {entry.type === 'before' ? 'Before' : 'After'}
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.moodLabel}>
                        {entry.label}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.moodMeta}>
                        {entry.sessionMinutes}m · {dateStr}
                      </ThemedText>
                    </ThemedView>
                  );
                })}
              </ThemedView>
            )}
          </ThemedView>

          {/* ── Mood insight ─────────────────────────────────────────────── */}
          {moodInsightPct !== null && (
            <ThemedView type="backgroundElement" style={styles.moodInsightCard}>
              <ThemedText style={styles.moodInsightEmoji}>😊</ThemedText>
              <ThemedText type="small" style={styles.moodInsightText}>
                You selected a more positive mood after{' '}
                <ThemedText type="smallBold">{moodInsightPct}%</ThemedText> of logged sessions.
              </ThemedText>
            </ThemedView>
          )}

          {/* ── Exam countdowns ───────────────────────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">Exam Countdowns</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {examLimitText}
                {isPlus && <ThemedText style={styles.plusBadge}> ✨ Plus</ThemedText>}
              </ThemedText>
            </ThemedView>

            {examCountdowns.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No exams added yet.{isPlus ? ' Unlimited exams with Plus.' : ' Track up to 3 at a time.'}
                </ThemedText>
              </ThemedView>
            )}

            {examCountdowns.map((exam) => {
              const days = daysUntil(exam.dateISO);
              const isUrgent = days >= 0 && days <= 7;
              const isPast = days < 0;
              return (
                <ThemedView key={exam.id} type="backgroundElement" style={styles.examCard}>
                  <ThemedView style={styles.examInfo}>
                    <ThemedText type="smallBold">{exam.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {exam.subject ? `${exam.subject} · ` : ''}{exam.dateISO}
                      {exam.reminderEnabled ? ' · 🔔' : ''}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.examRight}>
                    <ThemedText
                      style={[
                        styles.examDays,
                        isUrgent && styles.examDaysUrgent,
                        isPast && styles.examDaysPast,
                      ]}>
                      {isPast ? 'Past' : `${days}d`}
                    </ThemedText>
                    <Pressable onPress={() => removeExam(exam.id)} style={styles.removeBtn}>
                      <ThemedText type="small" themeColor="textSecondary">✕</ThemedText>
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              );
            })}

            {canAddExam ? (
              <Pressable
                style={({ pressed }) => [styles.addExamBtn, pressed && styles.addExamBtnPressed]}
                onPress={() => router.push('/add-exam')}>
                <ThemedText type="small" style={styles.addExamText}>
                  + Add exam countdown
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/plus-upgrade')}>
                <ThemedView type="backgroundElement" style={styles.upgradeExamCard}>
                  <ThemedText type="small" style={styles.upgradeExamText}>
                    🔒 Unlimited exam countdowns — upgrade to Plus
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          </ThemedView>
          {/* ── Plus shortcuts (if Plus) ─────────────────────────────────── */}
          {isPlus && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Plus features</ThemedText>
              <Pressable
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() => router.push('/ambience-picker')}>
                <ThemedView type="backgroundElement" style={styles.plusShortcut}>
                  <ThemedText style={styles.plusShortcutEmoji}>🎵</ThemedText>
                  <ThemedView style={styles.plusShortcutText}>
                    <ThemedText type="smallBold">Ambience Sounds</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Set your focus atmosphere
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="small" style={styles.arrowLink}>→</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() => router.push('/companion-gallery')}>
                <ThemedView type="backgroundElement" style={styles.plusShortcut}>
                  <ThemedText style={styles.plusShortcutEmoji}>🐾</ThemedText>
                  <ThemedView style={styles.plusShortcutText}>
                    <ThemedText type="smallBold">Companion Gallery</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {aiTickets} AI ticket{aiTickets !== 1 ? 's' : ''} remaining
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="small" style={styles.arrowLink}>→</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
          )}

          {/* ── Plus placeholder cards (non-Plus users) ──────────────────── */}
          {!isPlus && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Unlock more</ThemedText>
              <PlusGateCard
                emoji="📈"
                title="Advanced Analytics"
                description="Daily trends, mood-study correlation charts, and deep habit insights."
              />
              <PlusGateCard
                emoji="📆"
                title="Exam Planner+"
                description="Unlimited exam countdowns, smart study schedule suggestions, and deadline alerts."
              />
              <PlusGateCard
                emoji="🎵"
                title="Ambience Sounds"
                description="Lo-fi beats, rain sounds, and focus music to play during study sessions."
              />
              <PlusGateCard
                emoji="🐾"
                title="Companion Gallery"
                description="Free users get the starter girl and dude. Plus adds extra saved companion slots."
              />
            </ThemedView>
          )}

        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  safeArea: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  title: { fontSize: 28, lineHeight: 34 },
  accountCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  accountInfo: { flex: 1, gap: 2 },
  signOutBtn: {
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: BakeryColors.cream,
  },
  signOutText: { color: BakeryColors.mocha },
  streakCard: {
    borderRadius: BakeryRadii.panel,
    padding: Spacing.four,
    gap: Spacing.one,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  streakFire: { fontSize: 40, lineHeight: 48 },
  streakNumber: { fontSize: 56, fontWeight: '700', lineHeight: 64, color: BakeryColors.honey },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  statCard: {
    flex: 1,
    borderRadius: BakeryRadii.card,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 2,
    backgroundColor: BakeryColors.glass,
  },
  statValue: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  statLabel: { textAlign: 'center', fontSize: 11 },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightRow: { flexDirection: 'row', gap: Spacing.two },
  insightCard: {
    flex: 1,
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 2,
    backgroundColor: BakeryColors.glass,
  },
  insightValue: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  insightLabel: { textAlign: 'center', fontSize: 12 },
  subjectList: { gap: Spacing.two },
  subjectRow: { borderRadius: BakeryRadii.card, padding: Spacing.two, gap: 6, backgroundColor: BakeryColors.glass },
  subjectRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subjectLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  subjectName: { fontSize: 13 },
  subjectMinutes: { fontSize: 13 },
  subjectBar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  subjectBarFill: { height: '100%', borderRadius: 3 },
  highlightRow: { gap: 4, paddingTop: Spacing.one },
  emptyCard: { borderRadius: BakeryRadii.card, padding: Spacing.four, alignItems: 'center', backgroundColor: BakeryColors.glass },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  moodList: { gap: Spacing.two },
  moodRow: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
  },
  moodType: { width: 40, fontSize: 11 },
  moodLabel: { flex: 1 },
  moodMeta: { fontSize: 11 },
  examCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BakeryColors.glass,
  },
  examInfo: { flex: 1, gap: 2 },
  examRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  examDays: { fontSize: 22, fontWeight: '700', color: BakeryColors.mocha },
  examDaysUrgent: { color: BakeryColors.danger },
  examDaysPast: { color: '#999' },
  removeBtn: { padding: 4 },
  addExamBtn: {
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    alignItems: 'center',
    borderStyle: 'dashed',
    backgroundColor: BakeryColors.cream,
  },
  addExamBtnPressed: { opacity: 0.7 },
  addExamText: { color: BakeryColors.mocha },
  maxNote: { textAlign: 'center' },
  freezeCard: { borderRadius: BakeryRadii.card, padding: Spacing.three, gap: Spacing.two, backgroundColor: BakeryColors.glass },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  freezeEmoji: { fontSize: 28, lineHeight: 34, width: 36 },
  freezeInfo: { flex: 1, gap: 2 },
  freezeBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  freezeBtnText: { color: BakeryColors.cocoaDark, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  plusBadge: { color: BakeryColors.berry, fontSize: 11 },
  upgradeExamCard: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: `${BakeryColors.honey}55`,
    borderStyle: 'dashed',
    backgroundColor: BakeryColors.cream,
  },
  upgradeExamText: { color: BakeryColors.mocha },
  plusShortcut: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
  },
  plusShortcutEmoji: { fontSize: 26, lineHeight: 32, width: 34 },
  plusShortcutText: { flex: 1, gap: 2 },
  arrowLink: { color: BakeryColors.mocha, fontWeight: '700', fontSize: 16 },
  weekCard: {},
  weekCardInner: {
    borderRadius: BakeryRadii.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BakeryColors.glass,
  },
  weekLeft: { gap: 2 },
  weekRight: {},
  weekReportLink: { color: BakeryColors.mocha, fontWeight: '700' },
  moodInsightCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
  },
  moodInsightEmoji: { fontSize: 28, lineHeight: 34 },
  moodInsightText: { flex: 1, lineHeight: 20 },
});
