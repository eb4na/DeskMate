import { useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';

import { CoinIcon } from '@/components/coin-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { STREAK_RESCUE_MAX_GAP, accountDateOf, daysBetween, todayISO, useApp, weekStartISO } from '@/context/app-context';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import i18n, { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { formatDuration } from '@/lib/format-duration';
import { coinsForMinutes, dailyEarnCap, PLUS_STUDY_COIN_MULTIPLIER } from '@/constants/placeholder-data';
import { Spacing } from '@/constants/theme';

// The header range must describe the SAME window the stats are computed over —
// both come from weekStartISO()/todayISO() (account timezone), so the dates shown
// are exactly the days counted. Parsed as local midnight so the label doesn't
// shift a day in zones behind UTC.
function formatDateRange(startISO: string, endISO: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language || 'en-US', { month: 'short', day: 'numeric' });
  return `${fmt(startISO)} – ${fmt(endISO)}`;
}

// Pie chart geometry. Kept in step with the Progress tab's SubjectRing so the two
// readings of the same data look like siblings.
const PIE_SIZE = 180;
const PIE_RADIUS = PIE_SIZE / 2;
const GENERAL_PIE_COLOR = '#B8A98C';
const FALLBACK_PIE_COLOR = '#7C6F5A';

// SVG arc path for a pie slice spanning [startAngle, endAngle] (degrees, clockwise
// from 12 o'clock), centered on the pie with radius PIE_RADIUS.
function slicePath(startAngle: number, endAngle: number): string {
  const polar = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: PIE_RADIUS + PIE_RADIUS * Math.cos(rad), y: PIE_RADIUS + PIE_RADIUS * Math.sin(rad) };
  };
  const start = polar(endAngle);
  const end = polar(startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${PIE_RADIUS} ${PIE_RADIUS} L ${start.x} ${start.y} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function WeeklyReportScreen() {
  const { t } = useTranslation();
  const { sessionHistory, tasks, streak, subjects, isPlus } = useApp();
  // Tablet: scale every size by ONE shared factor so all text (preset-based AND
  // explicitly-sized) grows together and stays uniform — no more "some huge, some tiny."
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);

  // Window: today + the 6 days before it, on the ACCOUNT's timezone calendar —
  // the same basis session records are stamped with (addSubjectTime → todayISO).
  // The old math built the boundary from `new Date().toISOString()`, i.e. the UTC
  // date, which drops or adds a whole day of history for most of the day in any
  // zone behind UTC, and spanned 8 days rather than 7.
  const weekStart = weekStartISO();
  const today = todayISO();

  const weekSessions = sessionHistory.filter((r) => r.dateISO >= weekStart);
  const weekMinutes = weekSessions.reduce((s, r) => s + r.minutes, 0);
  const weekSessionCount = weekSessions.length;
  const weekDays = new Set(weekSessions.map((r) => r.dateISO)).size;

  // completedAt is a UTC timestamp, so it must be converted to the account's
  // calendar date before it can be compared with the window (an 8pm New York
  // finish is already "tomorrow" in UTC).
  // Known gap: a repeating task's rollover clears completedAt, so completed
  // recurrences don't count here.
  const weekTasks = tasks.filter(
    (task) => task.completedAt && accountDateOf(task.completedAt) >= weekStart,
  );

  // Subject breakdown
  const weekSubjectMap: Record<string, number> = {};
  for (const r of weekSessions) {
    const key = r.subjectName ?? 'General Study';
    weekSubjectMap[key] = (weekSubjectMap[key] ?? 0) + r.minutes;
  }
  const subjectEntries = Object.entries(weekSubjectMap).sort((a, b) => b[1] - a[1]);
  const topSubject = subjectEntries[0];

  // Pie slices for the week's subject split — colors match the legend rows below.
  const pieArcs = useMemo(() => {
    let cursor = 0;
    return subjectEntries.map(([name, minutes]) => {
      const color =
        name === 'General Study'
          ? GENERAL_PIE_COLOR
          : subjects.find((s) => s.name === name)?.color ?? FALLBACK_PIE_COLOR;
      const sweep = weekMinutes > 0 ? (minutes / weekMinutes) * 360 : 0;
      const arc = { name, color, start: cursor, end: cursor + sweep };
      cursor += sweep;
      return arc;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekSubjectMap, weekMinutes, subjects]);

  // Estimated coins from studying. Applied PER DAY, because the two rules that
  // actually move this number are per-day: Plus doubles the study payout, and the
  // daily earn cap clamps it. Still an estimate — a session ended early records
  // its minutes but pays 0 coins, and the cap is shared with other coin sources.
  const estimatedCoins = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const r of weekSessions) byDay[r.dateISO] = (byDay[r.dateISO] ?? 0) + r.minutes;
    return Object.values(byDay).reduce(
      (sum, mins) => sum + Math.min(coinsForMinutes(mins) * (isPlus ? PLUS_STUDY_COIN_MULTIPLIER : 1), dailyEarnCap(isPlus)),
      0,
    );
  }, [weekSessions, isPlus]);

  // Summary sentence
  const hasSummary = weekMinutes > 0 || weekSessionCount > 0 || weekTasks.length > 0 || weekDays > 0;
  const summaryText = hasSummary
    ? t('weeklyReport.summaryFull', {
        time: formatDuration(weekMinutes, t),
        sessions: weekSessionCount,
        tasks: weekTasks.length,
        days: weekDays,
      }) +
      (topSubject ? t('weeklyReport.topSubjectClause', { subject: localizeSubjectName(topSubject[0], t) }) : '') +
      (estimatedCoins > 0 ? t('weeklyReport.coinsClause', { coins: estimatedCoins }) : '')
    : null;

  // Streak shown here must match the Progress tab: once the gap passes the rescue
  // window the streak is gone and Progress already displays 0 for it. Reading
  // currentStreak raw made the two screens disagree (Progress "0", report "6d") until
  // the next study day reset it. Shares the engine's constant so they stay in step.
  const missedDays = streak.lastStudyDate ? daysBetween(streak.lastStudyDate, today) : 0;
  const displayStreak = missedDays > STREAK_RESCUE_MAX_GAP ? 0 : streak.currentStreak;

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
    { label: t('weeklyReport.statStudyTime'), value: weekMinutes > 0 ? formatDuration(weekMinutes, t) : '—', emoji: '' },
    { label: t('weeklyReport.statDaysShowedUp'), value: String(weekDays), emoji: '' },
    { label: t('weeklyReport.statTasksDone'), value: String(weekTasks.length), emoji: '' },
    { label: t('weeklyReport.statStreakNow'), value: `${displayStreak}d`, emoji: '' },
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
              {formatDateRange(weekStart, today)}
            </ThemedText>
          </ThemedView>

          {/* Summary card */}
          <ThemedView type="backgroundElement" style={styles.summaryCard}>
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
                  <CoinIcon size={Math.round(24 * scale)} style={styles.statCoinIcon} />
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
              {weekMinutes > 0 && (
                <View style={styles.pieWrap}>
                  <Svg width={PIE_SIZE * scale} height={PIE_SIZE * scale} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
                    <G>
                      {pieArcs.length === 1 ? (
                        // Single subject: a full disc (an arc command can't draw 360°).
                        <Path
                          d={`M ${PIE_RADIUS} ${PIE_RADIUS} m -${PIE_RADIUS} 0 a ${PIE_RADIUS} ${PIE_RADIUS} 0 1 0 ${PIE_SIZE} 0 a ${PIE_RADIUS} ${PIE_RADIUS} 0 1 0 -${PIE_SIZE} 0`}
                          fill={pieArcs[0].color}
                        />
                      ) : (
                        pieArcs.map((a) => <Path key={a.name} d={slicePath(a.start, a.end)} fill={a.color} />)
                      )}
                    </G>
                  </Svg>
                </View>
              )}
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
                          {localizeSubjectName(name, t)}
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.subjectTime}>
                          {formatDuration(minutes, t)}
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
  pieWrap: { alignItems: 'center', paddingVertical: Spacing.two * s },
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
});
