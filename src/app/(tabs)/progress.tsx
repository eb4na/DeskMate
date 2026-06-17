import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BakeryCalendarEmoji, BakerySleepEmoji, BakeryTrophyEmoji } from '@/components/bakery-emoji';
import { PlusGateCard } from '@/components/plus-gate';
import { ChartIcon, MusicNoteIcon, PawIcon } from '@/components/settings-icons';
import { StreakFreezeIcon } from '@/components/streak-freeze-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { daysBetween, todayISO, useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import i18n, { useTranslation } from '@/i18n';
import { FREE_HISTORY_MONTHS, historyCutoffISO } from '@/lib/history-window';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { AFTER_SESSION_MOODS, BEFORE_SESSION_MOODS } from '@/constants/placeholder-data';

const MOOD_IMAGE: Record<string, number> = {};
for (const m of [...BEFORE_SESSION_MOODS, ...AFTER_SESSION_MOODS]) {
  if (!(m.value in MOOD_IMAGE)) MOOD_IMAGE[m.value] = m.image;
}
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabClearance,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

const STREAK_FIRE_ICON = require('@/assets/images/home/streak-fire-icon.png');

function getMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(i18n.language || 'en-US', { month: 'short', day: 'numeric' });
}

// Days since a study date, measured the same way the streak engine does
// (daysBetween + todayISO), so the "at risk / lost" banner and freeze button
// agree with the actual streak transition. See app-context daysBetween().
function daysSince(dateISO: string): number {
  return daysBetween(dateISO, todayISO());
}

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { isGuest, user, signOut } = useAuth();
  const {
    sessionsCompleted,
    totalMinutes,
    streak,
    moodEntries,
    subjects,
    sessionHistory,
    isPlus,
    streakFreezes,
    useStreakFreeze: applyStreakFreeze,
  } = useApp();

  // Free accounts only browse the last 3 months of history; Plus sees it all.
  // Lifetime counters (sessionsCompleted/totalMinutes/streak) stay uncapped.
  const cutoff = historyCutoffISO(isPlus);
  const visibleSessions = cutoff ? sessionHistory.filter((r) => r.dateISO >= cutoff) : sessionHistory;
  const visibleMoods = cutoff ? moodEntries.filter((e) => e.timestamp >= cutoff) : moodEntries;
  const hasOlderHistory =
    !!cutoff &&
    (sessionHistory.some((r) => r.dateISO < cutoff) || moodEntries.some((e) => e.timestamp < cutoff));

  const recentMoods = visibleMoods.slice(0, 10);

  // One mood card (before/after). Extracted so before+after rows of the same
  // session can be grouped and joined with a connector line.
  const renderMoodRow = (entry: (typeof recentMoods)[number]) => {
    const dateStr = new Date(entry.timestamp).toLocaleDateString(i18n.language || 'en-US', {
      month: 'short',
      day: 'numeric',
    });
    return (
      <ThemedView key={entry.id} type="backgroundElement" style={styles.moodRow}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.moodType}>
          {entry.type === 'before' ? t('progress.before') : t('progress.after')}
        </ThemedText>
        {MOOD_IMAGE[entry.value] && (
          <Image source={MOOD_IMAGE[entry.value]} style={styles.moodImage} contentFit="contain" />
        )}
        <ThemedText type="smallBold" style={styles.moodLabel}>
          {t(`moods.${entry.value}`, { defaultValue: entry.label })}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.moodMeta}>
          {entry.sessionMinutes}m · {dateStr}
        </ThemedText>
      </ThemedView>
    );
  };

  // ── Streak status ─────────────────────────────────────────────────────────
  // Days since last study: <=1 active, 2–4 broken-but-rescuable (1–3 missed days,
  // a freeze can still save it), >=5 the streak is permanently gone.
  const missed = streak.lastStudyDate ? daysSince(streak.lastStudyDate) : 0;
  const streakRescuable = missed >= 2 && missed <= 4;
  const streakLost = missed >= 5;
  const freezeDaysLeft = 5 - missed; // days remaining to act while rescuable
  const displayStreak = streakLost ? 0 : streak.currentStreak;

  // ── Weekly summary for the "This week" card ───────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStartISO = sevenDaysAgo.toISOString().split('T')[0];
  const weekSessions = visibleSessions.filter((r) => r.dateISO >= weekStartISO);
  const weekMinutes = weekSessions.reduce((s, r) => s + r.minutes, 0);
  const weekDays = new Set(weekSessions.map((r) => r.dateISO)).size;

  // ── Mood insight ──────────────────────────────────────────────────────────
  const afterMoods = visibleMoods.filter((m) => m.type === 'after');
  const POSITIVE = new Set(['proud', 'better', 'relieved']);
  const posCount = afterMoods.filter((m) => POSITIVE.has(m.value)).length;
  const moodInsightPct = afterMoods.length >= 5
    ? Math.round((posCount / afterMoods.length) * 100)
    : null;

  // ── Subject time breakdown ────────────────────────────────────────────────
  // Recomputed from the visible (windowed) history so it stays in step with the
  // 3-month cap — the lifetime subjectTimeMap would otherwise leak older data.
  const subjectTotals: Record<string, number> = {};
  for (const r of visibleSessions) {
    const key = r.subjectName ?? 'General Study';
    subjectTotals[key] = (subjectTotals[key] ?? 0) + r.minutes;
  }
  const subjectEntries = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1]);
  const totalTrackedMinutes = subjectEntries.reduce((sum, [, m]) => sum + m, 0);
  const mostStudied = subjectEntries[0];
  const leastStudied = subjectEntries
    .filter(([name]) => name !== 'General Study' && subjects.some((s) => s.name === name && !s.archived))
    .at(-1);

  // ── Session insights ─────────────────────────────────────────────────────

  const avgMinutes =
    visibleSessions.length > 0
      ? Math.round(visibleSessions.reduce((s, r) => s + r.minutes, 0) / visibleSessions.length)
      : 0;

  const dayMap: Record<string, number> = {};
  for (const rec of visibleSessions) {
    dayMap[rec.dateISO] = (dayMap[rec.dateISO] ?? 0) + rec.minutes;
  }
  const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];

  const mondayISO = getMondayISO();
  const daysThisWeek = new Set(visibleSessions.filter((r) => r.dateISO >= mondayISO).map((r) => r.dateISO)).size;

  const handleSignOut = () => {
    showPopup(isGuest ? t('settings.leaveGuestQ') : t('settings.signOutQ'), isGuest
      ? t('settings.leaveGuestMsg')
      : t('settings.signOutMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: isGuest ? t('settings.leaveGuestMode') : t('settings.signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/login');
          } catch (error) {
            showPopup(
              t('settings.signOutFailed'),
              error instanceof Error ? error.message : t('settings.tryAgain'),
            );
          }
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            {t('progress.title')}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.accountCard}>
            <ThemedView type="transparent" style={styles.accountInfo}>
              <ThemedText type="smallBold">{t('settings.account')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isGuest ? t('settings.guestMode') : user?.email ?? t('settings.signedIn')}
              </ThemedText>
            </ThemedView>
            <Pressable
              style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
              onPress={handleSignOut}>
              <ThemedText type="smallBold" style={styles.signOutText}>
                {isGuest ? t('settings.leaveGuestMode') : t('settings.signOut')}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {/* ── This week summary ────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [styles.weekCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/weekly-report')}>
            <ThemedView type="backgroundElement" style={styles.weekCardInner}>
              <ThemedView type="transparent" style={styles.weekLeft}>
                <ThemedText type="smallBold">{t('progress.thisWeek')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('progress.weekSummary', { sessions: weekSessions.length, minutes: weekMinutes, days: weekDays })}
                </ThemedText>
              </ThemedView>
              <ThemedView type="transparent" style={styles.weekRight}>
                <ThemedText type="small" style={styles.weekReportLink}>
                  {t('progress.fullReport')}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </Pressable>

          {/* ── Streak ────────────────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.streakCard}>
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

          {/* ── Streak Freeze ─────────────────────────────────────────────── */}
          {(
            <ThemedView type="backgroundElement" style={styles.freezeCard}>
              <ThemedView type="transparent" style={styles.freezeRow}>
                <StreakFreezeIcon size={52 * scale} style={styles.freezeIcon} />
                <ThemedView type="transparent" style={styles.freezeInfo}>
                  <ThemedText type="smallBold">{t('progress.streakFreeze')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('progress.freezesRemaining', { count: streakFreezes })}
                  </ThemedText>
                </ThemedView>
                {streakRescuable && streakFreezes > 0 && (
                  <Pressable
                    style={({ pressed }) => [styles.freezeBtn, pressed && styles.pressed]}
                    onPress={() => {
                      showPopup(
                        t('progress.useFreezeQ'),
                        t('progress.useFreezeMsg'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('progress.useFreeze'),
                            onPress: () => {
                              const used = applyStreakFreeze();
                              if (used) showPopup(t('progress.streakProtected'), t('progress.streakSafe'));
                            },
                          },
                        ],
                      );
                    }}>
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
              {/* When the streak is fully lost the streak card already shows the
                  "start fresh" message, so no note is needed here. */}
            </ThemedView>
          )}

          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <ThemedView style={styles.statsRow}>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText style={styles.statValue}>{sessionsCompleted}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                {t('progress.sessions')}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText style={styles.statValue}>{totalMinutes}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                {t('progress.minutesLabel')}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText style={styles.statValue}>{daysThisWeek}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                {t('progress.daysThisWeek')}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* ── Session insights ──────────────────────────────────────────── */}
          {visibleSessions.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">{t('progress.sessionInsights')}</ThemedText>
              <ThemedView style={styles.insightRow}>
                <ThemedView type="backgroundElement" style={styles.insightCard}>
                  <ThemedText style={styles.insightValue}>{avgMinutes}m</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.insightLabel}>
                    {t('progress.avgSession')}
                  </ThemedText>
                </ThemedView>
                {bestDayEntry && (
                  <ThemedView type="backgroundElement" style={styles.insightCard}>
                    <ThemedText style={styles.insightValue}>{bestDayEntry[1]}m</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.insightLabel}>
                      {t('progress.bestDay', { date: formatDate(bestDayEntry[0]) })}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </ThemedView>
          )}

          {/* ── Subject time breakdown ────────────────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">{t('progress.timeBySubject')}</ThemedText>
              <View style={styles.subjectHeaderBtns}>
                <Pressable
                  style={({ pressed }) => [styles.moodChartBtn, pressed && styles.pressed]}
                  onPress={() => router.push('/subject-chart')}>
                  <ChartIcon size={14 * scale} />
                  <ThemedText type="small" themeColor="textSecondary">{t('progress.subjectChartBtn')}</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.manageSubjectsBtn, pressed && styles.pressed]}
                  onPress={() => router.push('/manage-subjects')}>
                  <ThemedText type="small" themeColor="textSecondary">{t('settings.manageSubjects')}</ThemedText>
                </Pressable>
              </View>
            </ThemedView>

            {subjectEntries.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('progress.tagSessionsHint')}
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
                      <ThemedView type="transparent" style={styles.subjectRowTop}>
                        <ThemedView type="transparent" style={styles.subjectLeft}>
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
              <ThemedView type="transparent" style={styles.highlightRow}>
                <View style={styles.highlightItem}>
                  <BakeryTrophyEmoji size={15 * scale} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('progress.mostStudied')}<ThemedText type="smallBold">{mostStudied[0]}</ThemedText>
                  </ThemedText>
                </View>
                {leastStudied && (
                  <View style={styles.highlightItem}>
                    <BakerySleepEmoji size={15 * scale} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('progress.leastStudied')}<ThemedText type="smallBold">{leastStudied[0]}</ThemedText>
                    </ThemedText>
                  </View>
                )}
              </ThemedView>
            )}
          </ThemedView>

          {/* ── Mood tracker ──────────────────────────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">{t('progress.moodTracker')}</ThemedText>
              <Pressable
                style={({ pressed }) => [styles.moodChartBtn, pressed && styles.pressed]}
                onPress={() => router.push('/mood-chart')}>
                <ChartIcon size={14 * scale} />
                <ThemedText type="small" themeColor="textSecondary">{t('progress.moodChartBtn')}</ThemedText>
              </Pressable>
            </ThemedView>
            {recentMoods.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('progress.moodEmptyHint')}
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView style={styles.moodList}>
                {(() => {
                  // Group each session's after+before rows (an 'after' immediately
                  // followed by its 'before') and join them with a connector line.
                  const rows: ReactNode[] = [];
                  for (let i = 0; i < recentMoods.length; i++) {
                    const entry = recentMoods[i];
                    const next = recentMoods[i + 1];
                    const paired =
                      entry.type === 'after' &&
                      next?.type === 'before' &&
                      next.sessionMinutes === entry.sessionMinutes;
                    if (paired) {
                      rows.push(
                        <View key={entry.id} style={styles.moodPair}>
                          {renderMoodRow(entry)}
                          <View style={styles.moodConnector} />
                          {renderMoodRow(next)}
                        </View>,
                      );
                      i++; // consume the paired 'before'
                    } else {
                      rows.push(renderMoodRow(entry));
                    }
                  }
                  return rows;
                })()}
              </ThemedView>
            )}
          </ThemedView>

          {/* ── Mood insight ─────────────────────────────────────────────── */}
          {moodInsightPct !== null && (
            <ThemedView type="backgroundElement" style={styles.moodInsightCard}>
              <ThemedText style={styles.moodInsightEmoji}></ThemedText>
              <ThemedText type="small" style={styles.moodInsightText}>
                {t('progress.moodInsightText', { pct: moodInsightPct })}
              </ThemedText>
            </ThemedView>
          )}

          {/* ── Full-history upsell — only when older data is actually hidden ── */}
          {hasOlderHistory && (
            <PlusGateCard
              emoji=""
              title={t('progress.historyCapTitle')}
              description={t('progress.historyCapDesc', { months: FREE_HISTORY_MONTHS })}
            />
          )}

        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  // Keep the whole scroll above the floating menu bar so it stays fully visible
  // and content never scrolls underneath it.
  scrollBox: { flex: 1, marginBottom: BottomTabClearance },
  safeArea: {
    paddingHorizontal: Spacing.four * s,
    paddingTop: Spacing.four * s,
    paddingBottom: Spacing.four * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four * s,
  },
  title: { fontSize: 28 * s, lineHeight: 34 * s },
  accountCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    ...BakeryShadow,
  },
  accountInfo: { flex: 1, gap: 2 * s },
  signOutBtn: {
    borderRadius: BakeryRadii.chip * s,
    paddingHorizontal: Spacing.two * s,
    paddingVertical: 6 * s,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: BakeryColors.cream,
  },
  signOutText: { color: BakeryColors.mocha },
  streakCard: {
    borderRadius: BakeryRadii.panel * s,
    padding: Spacing.four * s,
    gap: Spacing.one * s,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    ...BakeryShadow,
  },
  streakFireIcon: {
    width: 52 * s,
    height: 58 * s,
  },
  streakNumber: { fontSize: 60 * s, fontWeight: '800', lineHeight: 66 * s, color: BakeryColors.honey },
  streakNumberPaused: { color: BakeryColors.mocha, opacity: 0.6 },
  streakAtRisk: { color: BakeryColors.rose, fontWeight: '700', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: Spacing.two * s },
  statCard: {
    flex: 1,
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.two * s,
    alignItems: 'center',
    gap: 2 * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  statValue: { fontSize: 26 * s, fontWeight: '700', lineHeight: 32 * s },
  statLabel: { textAlign: 'center', fontSize: 11 * s },
  section: { gap: Spacing.two * s },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two * s },
  insightRow: { flexDirection: 'row', gap: Spacing.two * s },
  insightCard: {
    flex: 1,
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    alignItems: 'center',
    gap: 2 * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  insightValue: { fontSize: 24 * s, fontWeight: '700', lineHeight: 30 * s },
  insightLabel: { textAlign: 'center', fontSize: 12 * s },
  manageSubjectsBtn: {
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 6 * s,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  moodChartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 * s,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 6 * s,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  subjectHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  subjectList: { gap: Spacing.two * s },
  subjectRow: { borderRadius: BakeryRadii.card * s, padding: Spacing.two * s, gap: 6 * s, backgroundColor: BakeryColors.glass, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  subjectRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subjectLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 * s },
  subjectDot: { width: 10 * s, height: 10 * s, borderRadius: 5 * s },
  subjectName: { fontSize: 13 * s },
  subjectMinutes: { fontSize: 13 * s },
  subjectBar: { height: 5 * s, borderRadius: 3 * s, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  subjectBarFill: { height: '100%', borderRadius: 3 * s },
  highlightRow: { gap: 4 * s, paddingTop: Spacing.one * s },
  highlightItem: { flexDirection: 'row', alignItems: 'center', gap: 6 * s },
  emptyCard: { borderRadius: BakeryRadii.card * s, padding: Spacing.four * s, alignItems: 'center', backgroundColor: BakeryColors.glass, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  emptyText: { textAlign: 'center', lineHeight: 20 * s },
  moodList: { gap: Spacing.two * s },
  // before+after of one session, joined by a short vertical connector line.
  moodPair: {},
  moodConnector: {
    width: 3 * s,
    height: 12 * s,
    marginLeft: 34 * s,
    borderRadius: 2 * s,
    backgroundColor: BakeryColors.latte,
  },
  moodRow: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  moodType: { width: 40 * s, fontSize: 11 * s },
  moodImage: { width: 30 * s, height: 30 * s },
  moodLabel: { flex: 1 },
  moodMeta: { fontSize: 11 * s },
  examCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  examInfo: { flex: 1, gap: 2 * s },
  examRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  examDays: { fontSize: 22 * s, fontWeight: '700', color: BakeryColors.mocha },
  examDaysUrgent: { color: BakeryColors.danger },
  examDaysPast: { color: '#999' },
  removeBtn: { padding: 4 * s },
  addExamBtn: {
    borderRadius: BakeryRadii.button * s,
    paddingVertical: Spacing.three * s,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    alignItems: 'center',
    borderStyle: 'dashed',
    backgroundColor: BakeryColors.cream,
  },
  addExamBtnPressed: { opacity: 0.7 },
  addExamText: { color: BakeryColors.mocha },
  maxNote: { textAlign: 'center' },
  freezeCard: { borderRadius: BakeryRadii.card * s, padding: Spacing.three * s, gap: Spacing.two * s, backgroundColor: BakeryColors.glass, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  freezeIcon: { width: 52 * s },
  freezeInfo: { flex: 1, gap: 2 * s },
  freezeBtn: {
    backgroundColor: '#6FB7E0',
    borderRadius: BakeryRadii.chip * s,
    paddingHorizontal: Spacing.two * s,
    paddingVertical: 6 * s,
  },
  freezeBtnText: { color: '#FFFFFF', fontSize: 13 * s, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  plusBadge: { color: BakeryColors.berry, fontSize: 11 * s },
  upgradeExamCard: {
    borderRadius: 12 * s,
    paddingVertical: Spacing.three * s,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: `${BakeryColors.honey}55`,
    borderStyle: 'dashed',
    backgroundColor: BakeryColors.cream,
  },
  upgradeExamText: { color: BakeryColors.mocha },
  plusShortcut: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  plusShortcutIcon: { width: 34 * s, alignItems: 'center', justifyContent: 'center' },
  plusShortcutText: { flex: 1, gap: 2 * s },
  arrowLink: { color: BakeryColors.mocha, fontWeight: '700', fontSize: 16 * s },
  weekCard: {},
  weekCardInner: {
    borderRadius: BakeryRadii.card * s,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 12 * s,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  weekLeft: { gap: 2 * s },
  weekRight: {},
  weekReportLink: { color: BakeryColors.mocha, fontWeight: '700' },
  moodInsightCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  moodInsightEmoji: { fontSize: 28 * s, lineHeight: 34 * s },
  moodInsightText: { flex: 1, lineHeight: 20 * s },
});
