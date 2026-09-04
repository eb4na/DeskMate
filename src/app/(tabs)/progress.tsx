import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FitText } from '@/components/fit-text';
import { SubjectRing, type RingSlice } from '@/components/subject-ring';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NotebookBackground } from '@/components/notebook-background';
import { todayISO, useApp, weekMondayISO } from '@/context/app-context';
import { ACHIEVEMENTS } from '@/constants/quests';
import { RECIPE_IDS } from '@/constants/recipes';
import { SUBJECT_COLORS } from '@/constants/placeholder-data';
import { useAuth } from '@/context/auth-context';
import i18n, { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { formatDuration, formatMinutesShort } from '@/lib/format-duration';
import {
  PROGRESS_RANGES,
  insightForRange,
  ringSlices,
  subjectTotalsForRange,
  totalMinutesOf,
  type ProgressRange,
} from '@/lib/progress-ranges';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabClearance,
  MaxContentWidth,
  PastelCards,
  Spacing,
} from '@/constants/theme';

const STREAK_FIRE_ICON = require('@/assets/images/home/streak-fire-icon.png');

const RANGE_LABEL_KEY: Record<ProgressRange, string> = {
  week: 'progress.rangeWeek',
  month: 'progress.rangeMonth',
  year: 'progress.rangeYear',
  all: 'progress.rangeAll',
};

const RANGE_CAPTION_KEY: Record<ProgressRange, string> = {
  week: 'progress.capThisWeek',
  month: 'progress.capThisMonth',
  year: 'progress.capThisYear',
  all: 'progress.capAllTime',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(i18n.language || 'en-US', { month: 'short', day: 'numeric' });
}

/** "2026-09" → a localized month name. Day 15 dodges any timezone edge. */
function formatMonth(monthKey: string): string {
  return new Date(`${monthKey}-15T00:00:00`).toLocaleDateString(i18n.language || 'en-US', {
    month: 'long',
  });
}

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  // Boost so the whole Progress screen reads bigger on tablet. It multiplies the
  // proportional scale, so everything stays the SAME fraction of the screen on every
  // device (11" look, uniformly scaled). Phones are byte-identical (scale === 1).
  const PROGRESS_BOOST = 1.2;
  const ps = scale > 1 ? scale * PROGRESS_BOOST : scale;
  const styles = useMemo(() => makeStyles(ps, contentWidth), [ps, contentWidth]);
  const { isGuest, user, signOut } = useAuth();
  const {
    sessionsCompleted,
    totalMinutes,
    streak,
    subjects,
    sessionHistory,
    subjectTimeMap,
    subjectMonthly,
    claimedAchievements,
    lifetimeTasksCompleted,
    lifetimeFriendSessions,
    madeFoods,
  } = useApp();

  const [range, setRange] = useState<ProgressRange>('week');

  // ── The tracker ──────────────────────────────────────────────────────────
  const today = todayISO();
  const weekMonday = weekMondayISO();

  const { entries, total, slices, otherMinutes, insight } = useMemo(() => {
    const sources = { sessionHistory, subjectTimeMap, subjectMonthly: subjectMonthly ?? {}, today, weekMonday };
    const all = subjectTotalsForRange(range, sources);
    const ring = ringSlices(all);
    return {
      entries: all,
      total: totalMinutesOf(all),
      slices: ring.entries,
      otherMinutes: ring.otherMinutes,
      insight: insightForRange(range, sources),
    };
  }, [range, sessionHistory, subjectTimeMap, subjectMonthly, today, weekMonday]);

  // A subject's own colour when it still exists; otherwise a stable colour drawn
  // from the palette by name, so a deleted subject's history keeps one colour
  // instead of flickering between renders.
  const colorFor = (name: string): string => {
    const subject = subjects.find((s) => s.name === name);
    if (subject?.color) return subject.color;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
  };

  const ringData: RingSlice[] = slices.map((e) => ({
    name: e.name,
    minutes: e.minutes,
    color: colorFor(e.name),
  }));

  // ── Achievements (count + whether anything is ready to claim) ─────────────
  const achievementStat = (key: string): number =>
    key === 'longestStreak'
      ? streak.longestStreak
      : key === 'sessionsCompleted'
        ? sessionsCompleted
        : key === 'totalMinutes'
          ? totalMinutes
          : key === 'lifetimeTasksCompleted'
            ? lifetimeTasksCompleted
            : key === 'lifetimeFriendSessions'
              ? lifetimeFriendSessions
              : key === 'recipesMade'
                ? RECIPE_IDS.filter((id) => madeFoods.includes(id)).length
                : 0;

  const achievementClaimable = ACHIEVEMENTS.some(
    (a) => !claimedAchievements.includes(a.id) && achievementStat(a.statKey) >= a.goal,
  );

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
    <ThemedView type="transparent" style={styles.container}>
      <NotebookBackground />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
        <SafeAreaView style={styles.safeArea}>

          {/* ── Header: title + the streak, demoted to a chip ──────────────
              Home already shows the streak prominently, so the old full-width
              cupcake card said it twice. Tapping opens the streak detail, which
              is where the freeze lives now. */}
          <ThemedView type="transparent" style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {t('progress.title')}
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.streakChip, pressed && styles.pressed]}
              onPress={() => router.push('/streak-detail')}
              hitSlop={8}>
              <Image source={STREAK_FIRE_ICON} style={styles.streakChipIcon} contentFit="contain" />
              <ThemedText type="smallBold" style={styles.streakChipText}>
                {streak.currentStreak} {t('home.dayStreak')}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {/* ── Range pills ────────────────────────────────────────────────
              All four are open to everyone: week/month come from raw records,
              year from the monthly rollup, all-time from subjectTimeMap. */}
          <ThemedView type="transparent" style={styles.ranges}>
            {PROGRESS_RANGES.map((r) => {
              const active = r === range;
              return (
                <Pressable
                  key={r}
                  style={({ pressed }) => [styles.rangePill, active && styles.rangePillOn, pressed && styles.pressed]}
                  onPress={() => setRange(r)}>
                  <FitText
                    type="smallBold"
                    numberOfLines={1}
                    style={[styles.rangeText, active && styles.rangeTextOn]}>
                    {t(RANGE_LABEL_KEY[r])}
                  </FitText>
                </Pressable>
              );
            })}
          </ThemedView>

          {/* ── The ring ───────────────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.ringCard}>
            {range === 'week' && (
              <Pressable
                style={({ pressed }) => [styles.reportLinkRow, pressed && styles.pressed]}
                onPress={() => router.push('/weekly-report')}
                hitSlop={6}>
                <ThemedText type="small" style={styles.reportLink}>
                  {t('progress.fullReport')}
                </ThemedText>
              </Pressable>
            )}

            <SubjectRing
              slices={ringData}
              otherMinutes={otherMinutes}
              size={168 * ps}>
              <ThemedText style={styles.ringTotal}>{formatMinutesShort(total, t)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.ringCaption}>
                {t(RANGE_CAPTION_KEY[range])}
              </ThemedText>
            </SubjectRing>

            {/* What this line can say depends on where the range's numbers came
                from — the rollups carry minutes but no session count, so an
                average for year/all would be invented. It reports less instead. */}
            {insight.kind === 'records' && (
              <ThemedView type="transparent" style={styles.insightRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('progress.avgSession')} <ThemedText type="smallBold">{formatMinutesShort(insight.avgMinutes, t)}</ThemedText>
                </ThemedText>
                <View style={styles.insightDot} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('progress.bestDay', { date: formatDate(insight.bestDayISO) })} <ThemedText type="smallBold">{formatMinutesShort(insight.bestDayMinutes, t)}</ThemedText>
                </ThemedText>
              </ThemedView>
            )}
            {insight.kind === 'month' && (
              <ThemedView type="transparent" style={styles.insightRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('progress.bestMonth')} <ThemedText type="smallBold">{formatMonth(insight.bestMonthKey)}</ThemedText>
                  {'  '}
                  <ThemedText type="smallBold">{formatMinutesShort(insight.bestMonthMinutes, t)}</ThemedText>
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* ── Where it went ──────────────────────────────────────────────── */}
          <ThemedView type="transparent" style={styles.listSection}>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              {t('progress.timeBySubject')}
            </ThemedText>

            {entries.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('progress.tagSessionsHint')}
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={styles.listCard}>
                {/* The list is never truncated, even when the ring merged a tail
                    into "Other" — the ring is for shape, this is for numbers. */}
                {entries.map((e) => {
                  const pct = total > 0 ? Math.round((e.minutes / total) * 100) : 0;
                  return (
                    <ThemedView key={e.name} type="transparent" style={styles.rankRow}>
                      <View style={[styles.rankDot, { backgroundColor: colorFor(e.name) }]} />
                      <FitText type="smallBold" numberOfLines={1} style={styles.rankName}>
                        {localizeSubjectName(e.name, t)}
                      </FitText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.rankPct}>
                        {pct}%
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.rankMin}>
                        {formatDuration(e.minutes, t)}
                      </ThemedText>
                    </ThemedView>
                  );
                })}

                <Pressable
                  style={({ pressed }) => [styles.manageRow, pressed && styles.pressed]}
                  onPress={() => router.push('/manage-subjects')}>
                  <ThemedText type="small" style={styles.reportLink}>
                    {t('settings.manageSubjects')}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            )}
          </ThemedView>

          {/* ── Achievements ───────────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [styles.achRow, pressed && styles.pressed]}
            onPress={() => router.push('/achievements')}>
            <ThemedText type="smallBold">{t('achievements.title')}</ThemedText>
            {achievementClaimable && <View style={styles.claimDot} />}
            <ThemedText type="small" themeColor="textSecondary" style={styles.achCount}>
              {claimedAchievements.length} / {ACHIEVEMENTS.length}
            </ThemedText>
            <ThemedText type="small" style={styles.chevron}>›</ThemedText>
          </Pressable>

          {/* ── Account ────────────────────────────────────────────────────── */}
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

        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1 },
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
    gap: Spacing.three * s,
  },
  pressed: { opacity: 0.85 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two * s },
  title: { fontSize: 28 * s, lineHeight: 34 * s },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5 * s,
    backgroundColor: BakeryColors.paper,
    borderWidth: 1.5,
    borderColor: PastelCards.honey.border,
    borderRadius: BakeryRadii.chip * s,
    paddingVertical: 5 * s,
    paddingHorizontal: 10 * s,
  },
  streakChipIcon: { width: 16 * s, height: 16 * s },
  streakChipText: { color: BakeryColors.cocoa },

  // ── Range pills ───────────────────────────────────────────────────────────
  ranges: {
    flexDirection: 'row',
    backgroundColor: BakeryColors.cream,
    borderRadius: BakeryRadii.chip * s,
    padding: 3 * s,
    gap: 2 * s,
  },
  rangePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7 * s,
    borderRadius: BakeryRadii.chip * s,
  },
  rangePillOn: { backgroundColor: BakeryColors.buttonPink },
  rangeText: { color: BakeryColors.mocha },
  rangeTextOn: { color: '#FFFFFF' },

  // ── Ring card ─────────────────────────────────────────────────────────────
  ringCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    alignItems: 'center',
    gap: Spacing.two * s,
    borderWidth: 1.5,
    borderColor: PastelCards.blush.border,
    ...BakeryShadow,
  },
  reportLinkRow: { alignSelf: 'flex-end' },
  reportLink: { color: BakeryColors.berry, fontWeight: '700' },
  ringTotal: {
    fontSize: 26 * s,
    lineHeight: 30 * s,
    fontWeight: '800',
    color: BakeryColors.berry,
  },
  ringCaption: { marginTop: 1 * s },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6 * s,
  },
  insightDot: {
    width: 3 * s,
    height: 3 * s,
    borderRadius: 2 * s,
    backgroundColor: BakeryColors.latte,
  },

  // ── Ranked list ───────────────────────────────────────────────────────────
  listSection: { gap: Spacing.two * s },
  sectionLabel: { marginLeft: 2 * s },
  listCard: {
    borderRadius: BakeryRadii.card * s,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: Spacing.one * s,
    borderWidth: 1.5,
    borderColor: PastelCards.honey.border,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    paddingVertical: 9 * s,
  },
  rankDot: { width: 10 * s, height: 10 * s, borderRadius: 5 * s },
  rankName: { flex: 1 },
  rankPct: { minWidth: 34 * s, textAlign: 'right' },
  rankMin: { minWidth: 62 * s, textAlign: 'right', color: BakeryColors.cocoa },
  manageRow: { alignItems: 'flex-end', paddingVertical: 8 * s },

  emptyCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.four * s,
    borderWidth: 1.5,
    borderColor: PastelCards.honey.border,
  },
  emptyText: { textAlign: 'center' },

  // ── Achievements ──────────────────────────────────────────────────────────
  achRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: PastelCards.honey.fill,
    borderWidth: 1.5,
    borderColor: PastelCards.honey.border,
    borderRadius: BakeryRadii.card * s,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: Spacing.three * s,
    ...BakeryShadow,
  },
  achCount: { marginLeft: 'auto' },
  claimDot: {
    width: 8 * s,
    height: 8 * s,
    borderRadius: 4 * s,
    backgroundColor: BakeryColors.buttonPink,
  },
  chevron: { color: BakeryColors.latte, fontWeight: '800' },

  // ── Account ───────────────────────────────────────────────────────────────
  accountCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: PastelCards.coral.fill,
    borderWidth: 1.5,
    borderColor: PastelCards.coral.border,
    ...BakeryShadow,
  },
  accountInfo: { flex: 1, gap: 2 * s },
  signOutBtn: {
    borderRadius: BakeryRadii.chip * s,
    paddingHorizontal: Spacing.two * s,
    paddingVertical: 6 * s,
    backgroundColor: BakeryColors.paper,
    borderWidth: 1.5,
    borderColor: PastelCards.coral.border,
  },
  signOutText: { color: BakeryColors.berry },
});
