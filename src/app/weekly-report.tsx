import { useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { PlusGateCard } from '@/components/plus-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import i18n, { useTranslation } from '@/i18n';
import { coinsForMinutes } from '@/constants/placeholder-data';
import { Spacing } from '@/constants/theme';

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateRange(): string {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString(i18n.language || 'en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function WeeklyReportScreen() {
  const { t } = useTranslation();
  const { sessionHistory, tasks, moodEntries, streak, subjects, isPlus } = useApp();
  // Tablet: scale every size by ONE shared factor so all text (preset-based AND
  // explicitly-sized) grows together and stays uniform — no more "some huge, some tiny."
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStartISO = sevenDaysAgo.toISOString().split('T')[0];

  const weekSessions = sessionHistory.filter((r) => r.dateISO >= weekStartISO);
  const weekMinutes = weekSessions.reduce((s, r) => s + r.minutes, 0);
  const weekSessionCount = weekSessions.length;
  const weekDays = new Set(weekSessions.map((r) => r.dateISO)).size;

  const weekTasks = tasks.filter(
    (task) => task.completedAt && task.completedAt.split('T')[0] >= weekStartISO,
  );

  const weekMoods = moodEntries.filter(
    (m) => m.timestamp >= sevenDaysAgo.toISOString(),
  );

  // Subject breakdown
  const weekSubjectMap: Record<string, number> = {};
  for (const r of weekSessions) {
    const key = r.subjectName ?? 'General Study';
    weekSubjectMap[key] = (weekSubjectMap[key] ?? 0) + r.minutes;
  }
  const subjectEntries = Object.entries(weekSubjectMap).sort((a, b) => b[1] - a[1]);
  const topSubject = subjectEntries[0];

  // Estimated coins — 1 coin per minute studied (matches the earn rule).
  const estimatedCoins = weekSessions.reduce((sum, r) => sum + coinsForMinutes(r.minutes), 0);

  // Mood improvement
  const weekAfterMoods = weekMoods.filter((m) => m.type === 'after');
  const POSITIVE = new Set(['proud', 'better', 'relieved']);
  const positiveCount = weekAfterMoods.filter((m) => POSITIVE.has(m.value)).length;
  const moodPct =
    weekAfterMoods.length >= 3
      ? Math.round((positiveCount / weekAfterMoods.length) * 100)
      : null;

  // Summary sentence
  const hasSummary = weekMinutes > 0 || weekSessionCount > 0 || weekTasks.length > 0 || weekDays > 0;
  const summaryText = hasSummary
    ? t('weeklyReport.summaryFull', {
        time: weekMinutes > 0 ? formatMinutes(weekMinutes) : '0m',
        sessions: weekSessionCount,
        tasks: weekTasks.length,
        days: weekDays,
      }) +
      (topSubject ? t('weeklyReport.topSubjectClause', { subject: topSubject[0] }) : '') +
      (estimatedCoins > 0 ? t('weeklyReport.coinsClause', { coins: estimatedCoins }) : '')
    : null;

  // Suggested goal
  let suggestedGoal = '';
  if (weekSessionCount === 0)
    suggestedGoal = t('weeklyReport.goal0');
  else if (weekSessionCount < 3)
    suggestedGoal = t('weeklyReport.goalFew', { count: weekSessionCount });
  else if (weekSessionCount < 7)
    suggestedGoal = t('weeklyReport.goalMid', { count: weekSessionCount, next: weekSessionCount + 1 });
  else
    suggestedGoal = t('weeklyReport.goalHigh', { count: weekSessionCount });

  const stats = [
    { label: t('weeklyReport.statSessions'), value: String(weekSessionCount), emoji: '' },
    { label: t('weeklyReport.statStudyTime'), value: weekMinutes > 0 ? formatMinutes(weekMinutes) : '—', emoji: '' },
    { label: t('weeklyReport.statDaysShowedUp'), value: String(weekDays), emoji: '' },
    { label: t('weeklyReport.statTasksDone'), value: String(weekTasks.length), emoji: '' },
    { label: t('weeklyReport.statStreakNow'), value: `${streak.currentStreak}d`, emoji: '' },
    { label: t('weeklyReport.statEstCoins'), value: estimatedCoins > 0 ? String(estimatedCoins) : '—', coinIcon: true },
  ];

  const hasData = weekSessionCount > 0 || weekTasks.length > 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {t('screens.weeklyReport')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateRange()}
            </ThemedText>
          </ThemedView>

          {/* Summary card */}
          <ThemedView type="backgroundElement" style={styles.summaryCard}>
            <ThemedText style={styles.summaryEmoji}></ThemedText>
            {summaryText ? (
              <ThemedText style={styles.summaryText}>{summaryText}</ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.summaryText}>
                {t('weeklyReport.noSessionsYet')}
              </ThemedText>
            )}
          </ThemedView>

          {/* Stats grid */}
          <ThemedView style={styles.statsGrid}>
            {stats.map((s) => (
              <ThemedView key={s.label} type="backgroundElement" style={styles.statCard}>
                {'coinIcon' in s && s.coinIcon ? (
                  <CoinIcon size={Math.round(48 * scale)} style={styles.statCoinIcon} />
                ) : (
                  <ThemedText style={styles.statEmoji}>{'emoji' in s ? s.emoji : ''}</ThemedText>
                )}
                <ThemedText style={styles.statValue}>{s.value}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                  {s.label}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Subject breakdown */}
          {subjectEntries.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>{t('weeklyReport.subjectBreakdown')}</ThemedText>
              <ThemedView style={styles.subjectList}>
                {subjectEntries.map(([name, minutes]) => {
                  const subject = subjects.find((s) => s.name === name);
                  const pct = weekMinutes > 0 ? (minutes / weekMinutes) * 100 : 0;
                  const barColor = subject?.color ?? '#7C6F5A';
                  return (
                    <ThemedView key={name} type="backgroundElement" style={styles.subjectRow}>
                      <ThemedView type="transparent" style={styles.subjectMeta}>
                        <ThemedView style={[styles.subjectDot, { backgroundColor: barColor }]} />
                        <ThemedText type="small" style={styles.subjectName}>
                          {name}
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.subjectTime}>
                          {formatMinutes(minutes)}
                        </ThemedText>
                      </ThemedView>
                      <ThemedView style={styles.subjectBar}>
                        <ThemedView
                          style={[
                            styles.subjectBarFill,
                            { width: `${pct}%`, backgroundColor: barColor + 'AA' },
                          ]}
                        />
                      </ThemedView>
                    </ThemedView>
                  );
                })}
              </ThemedView>
            </ThemedView>
          )}

          {/* Mood insight */}
          {moodPct !== null && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>{t('weeklyReport.moodInsight')}</ThemedText>
              <ThemedView type="backgroundElement" style={styles.moodInsightCard}>
                <ThemedText style={styles.moodInsightEmoji}></ThemedText>
                <ThemedText type="small" style={styles.moodInsightText}>
                  {t('weeklyReport.moodInsightText', { pct: moodPct })}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          )}

          {/* Suggested goal */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>{t('weeklyReport.goalNextWeek')}</ThemedText>
            <ThemedView type="backgroundElement" style={styles.goalCard}>
              <ThemedText style={styles.goalEmoji}></ThemedText>
              <ThemedText type="small" style={styles.goalText}>
                {suggestedGoal}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* ── Plus advanced report sections ───────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {t('weeklyReport.advancedInsights')}
              {!isPlus && <ThemedText style={styles.plusTag}> — Plus</ThemedText>}
            </ThemedText>
            {isPlus ? (
              <>
                <ThemedView type="backgroundElement" style={styles.advancedCard}>
                  <ThemedText style={styles.advancedEmoji}></ThemedText>
                  <ThemedView type="transparent" style={styles.advancedText}>
                    <ThemedText type="smallBold">{t('weeklyReport.bestStudyHours')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('weeklyReport.bestStudyHoursPlus')}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
                <ThemedView type="backgroundElement" style={styles.advancedCard}>
                  <ThemedText style={styles.advancedEmoji}></ThemedText>
                  <ThemedView type="transparent" style={styles.advancedText}>
                    <ThemedText type="smallBold">{t('weeklyReport.avoidanceInsights')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('weeklyReport.avoidancePlus')}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
                <ThemedView type="backgroundElement" style={styles.advancedCard}>
                  <ThemedText style={styles.advancedEmoji}></ThemedText>
                  <ThemedView type="transparent" style={styles.advancedText}>
                    <ThemedText type="smallBold">{t('weeklyReport.monthlyOverview')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('weeklyReport.monthlyPlus')}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </>
            ) : (
              <>
                <PlusGateCard
                  emoji=""
                  title={t('weeklyReport.bestStudyHours')}
                  description={t('weeklyReport.bestStudyHoursDesc')}
                />
                <PlusGateCard
                  emoji=""
                  title={t('weeklyReport.avoidanceInsights')}
                  description={t('weeklyReport.avoidanceDesc')}
                />
                <PlusGateCard
                  emoji=""
                  title={t('weeklyReport.monthlyReport')}
                  description={t('weeklyReport.monthlyDesc')}
                />
              </>
            )}
          </ThemedView>

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText type="linkPrimary">{t('weeklyReport.backToProgress')}</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

// `s` = the shared tablet scale (1 on phone). Every font/spacing/size literal is
// multiplied by it so the screen scales as one piece and text stays uniform — and
// it scales by the SAME factor ThemedText scales its presets, so preset-based text
// (e.g. the advanced-insight rows) and explicitly-sized text agree on tablet.
const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    paddingHorizontal: Spacing.four * s,
    paddingTop: Spacing.four * s,
    paddingBottom: 40 * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four * s,
  },
  header: { gap: 4 * s },
  title: { fontSize: 26 * s, lineHeight: 32 * s },
  summaryCard: {
    borderRadius: 20 * s,
    padding: Spacing.four * s,
    gap: Spacing.two * s,
    alignItems: 'center',
  },
  summaryEmoji: { fontSize: 40 * s, lineHeight: 48 * s },
  // Explicit size (was the ThemedText default 16, which read oversized vs the rest);
  // matches the body text so the screen's text stays uniform.
  summaryText: { textAlign: 'center', fontSize: 14 * s, lineHeight: 21 * s },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two * s,
  },
  statCard: {
    width: '30.5%',
    borderRadius: 14 * s,
    padding: Spacing.two * s,
    alignItems: 'center',
    gap: 2 * s,
  },
  statEmoji: { fontSize: 20 * s, lineHeight: 26 * s },
  statCoinIcon: { marginBottom: 2 * s },
  statValue: { fontSize: 20 * s, fontWeight: '700', lineHeight: 26 * s },
  statLabel: { textAlign: 'center', fontSize: 12 * s },
  section: { gap: Spacing.two * s },
  sectionTitle: { fontSize: 17 * s, fontWeight: '800' },
  subjectList: { gap: Spacing.two * s },
  subjectRow: { borderRadius: 12 * s, padding: Spacing.two * s, gap: 6 * s },
  subjectMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 * s },
  subjectDot: { width: 10 * s, height: 10 * s, borderRadius: 5 * s },
  subjectName: { flex: 1, fontSize: 13 * s },
  subjectTime: { fontSize: 13 * s },
  subjectBar: {
    height: 4 * s,
    borderRadius: 2 * s,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  subjectBarFill: { height: '100%', borderRadius: 2 * s },
  moodInsightCard: {
    borderRadius: 16 * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
  },
  moodInsightEmoji: { fontSize: 28 * s, lineHeight: 34 * s },
  moodInsightText: { flex: 1, fontSize: 13 * s, lineHeight: 20 * s },
  goalCard: {
    borderRadius: 16 * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two * s,
  },
  goalEmoji: { fontSize: 22 * s, lineHeight: 28 * s },
  goalText: { flex: 1, fontSize: 13 * s, lineHeight: 20 * s },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.two * s },
  plusTag: { color: '#F5A623', fontSize: 12 * s, fontWeight: '400' },
  advancedCard: {
    borderRadius: 14 * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two * s,
  },
  advancedEmoji: { fontSize: 24 * s, lineHeight: 30 * s, width: 32 * s },
  advancedText: { flex: 1, gap: 2 * s },
});
