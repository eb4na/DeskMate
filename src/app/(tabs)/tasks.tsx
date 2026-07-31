import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FitText } from '@/components/fit-text';
import { NotebookBackground } from '@/components/notebook-background';
import { TaskCalendar } from '@/components/task-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp, MAX_EXAMS } from '@/context/app-context';

import { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { BakeryColors, BakeryRadii, BakeryShadow, BottomTabClearance, MaxContentWidth, PastelCards, Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

export default function TasksScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { tasks, subjects, examCountdowns } = useApp();

  // Exam countdowns aren't a Plus perk — one cap for everyone.
  const canAddExam = examCountdowns.length < MAX_EXAMS;

  // Avoidance tracker: tasks with postponeCount >= 1, not done, sorted by count desc
  const needsAttention = tasks
    .filter((t) => t.status !== 'done' && t.postponeCount >= 1)
    .sort((a, b) => b.postponeCount - a.postponeCount)
    .slice(0, 3);

  return (
    <View style={styles.root}>
      <NotebookBackground />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <ThemedView type="transparent" style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {t('tasks.title')}
            </ThemedText>
            <ThemedView type="transparent" style={styles.headerActions}>
              <SoundPressable
                style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
                onPress={() => router.push(canAddExam ? '/add-exam' : '/plus-upgrade')}>
                <ThemedText themeColor="textSecondary" style={styles.manageBtnText}>{t('tasks.addExamShort')}</ThemedText>
              </SoundPressable>
              <SoundPressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={() => router.push('/add-task')}>
                <ThemedText style={styles.addBtnText}>{t('tasks.addTaskShort')}</ThemedText>
              </SoundPressable>
            </ThemedView>
          </ThemedView>

          {/* Calendar with day notes + task peek */}
          <TaskCalendar />

          {/* Needs attention (avoidance tracker) */}
          {needsAttention.length > 0 && (
            <ThemedView type="transparent" style={styles.section}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                {t('tasks.needsAttention')}
              </ThemedText>
              {needsAttention.map((task) => {
                const subjectName = task.subjectId
                  ? subjects.find((s) => s.id === task.subjectId)?.name
                  : null;
                const nudge = subjectName
                  ? t('tasks.nudgeSubject', { subject: localizeSubjectName(subjectName, t) })
                  : t('tasks.nudgeGeneric');
                return (
                  <ThemedView key={task.id} type="backgroundElement" style={styles.nudgeCard}>
                    <FitText type="smallBold" style={styles.nudgeTitle} numberOfLines={1}>
                      {task.title}
                    </FitText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.nudgeText}>
                      {nudge}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
          )}

        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const makeStyles = (s: number, contentWidth: number) => {
  // Tablet-only boost so the task cards read large/prominent next to the calendar.
  // It multiplies the proportional scale, so it stays the SAME fraction of the
  // screen on every device (11" look, uniformly scaled). Phones are byte-identical
  // (s === 1 → cardS === 1). Dial CARD_BOOST to taste.
  const CARD_BOOST = 1.3;
  const cardS = s > 1 ? s * CARD_BOOST : s;
  return StyleSheet.create({
  root: { flex: 1 },
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28 * s, lineHeight: 34 * s },
  headerActions: { flexDirection: 'row', gap: Spacing.two * s, alignItems: 'center' },
  manageBtn: {
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 8 * s,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  // Exam-button text: scaled to match the Task button's text (was a fixed 14px via
  // type="small", which left the Exam button smaller than Task on tablets).
  manageBtnText: { fontSize: 14 * s, fontWeight: '700' },
  addBtn: {
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 8 * s,
    borderWidth: 1.5,
    borderColor: '#E0A33C',
    ...BakeryShadow,
  },
  addBtnText: { color: '#fff', fontSize: 14 * s, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  welcomeCard: {
    borderRadius: BakeryRadii.panel * s,
    padding: Spacing.five * s,
    alignItems: 'center',
    gap: Spacing.two * s,
    marginTop: Spacing.two * s,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  welcomeEmoji: { fontSize: 48 * s, lineHeight: 56 * s },
  welcomeTitle: { fontSize: 18 * s },
  welcomeText: { textAlign: 'center', lineHeight: 20 * s },
  welcomeAddBtn: { marginTop: Spacing.two * s },
  section: { gap: Spacing.two * s },
  sectionTitle: { fontSize: 13 * s, textTransform: 'uppercase', letterSpacing: 1.2, color: BakeryColors.mocha, fontWeight: '800' },
  doneToggle: { marginBottom: Spacing.one * s },
  taskList: {},
  // ‹ 1 / N › pager footer
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.four * s, paddingVertical: Spacing.two * s },
  pagerBtn: {
    width: 34 * s,
    height: 34 * s,
    borderRadius: 17 * s,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerArrow: { fontSize: 20 * s, lineHeight: 22 * s, fontWeight: '800', color: BakeryColors.mocha },
  pagerLabel: { fontSize: 13 * s, minWidth: 46 * s, textAlign: 'center' },
  // Task cards use cardS (slightly larger on tablet) so they balance the calendar.
  // Ledger line inside a parchment MenuCard (study-notes checklist look).
  taskRow: {
    paddingVertical: Spacing.two * cardS,
    paddingHorizontal: 2 * cardS,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * cardS,
    borderBottomWidth: 1,
    borderBottomColor: `${BakeryColors.shortbread}99`,
    backgroundColor: 'transparent',
  },
  taskRowDone: { opacity: 0.55 },
  taskMain: { flex: 1, gap: 5 * cardS },
  taskContent: { gap: 5 * cardS },
  descPreview: {
    borderLeftWidth: 2,
    borderLeftColor: `${BakeryColors.shortbread}CC`,
    paddingLeft: 7 * cardS,
    paddingVertical: 1 * cardS,
  },
  descPreviewText: { fontSize: 12.5 * cardS, lineHeight: 17 * cardS, fontStyle: 'italic' },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 * cardS },
  taskTitle: { flex: 1, fontSize: 15 * cardS, lineHeight: 20 * cardS, fontWeight: '600' },
  taskTitleDone: { textDecorationLine: 'line-through' },
  // Finished / not-finished dot at the end of the title row.
  statusDot: { width: 18 * cardS, height: 18 * cardS, borderRadius: 9 * cardS, borderWidth: 2 },
  statusDotTodo: { backgroundColor: 'transparent', borderColor: BakeryColors.latte },
  statusDotDone: { backgroundColor: BakeryColors.success, borderColor: BakeryColors.success },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 * cardS, alignItems: 'center' },
  metaText: { fontSize: 12 * cardS },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4 * cardS,
    paddingHorizontal: 8 * cardS,
    paddingVertical: 2 * cardS,
    borderRadius: 8 * cardS,
  },
  badgeDot: { width: 6 * cardS, height: 6 * cardS, borderRadius: 3 * cardS },
  badgeText: { fontSize: 11 * cardS, fontWeight: '600' },
  taskActions: { flexDirection: 'row', gap: 0, alignItems: 'center' },
  actionBtn: { padding: 4 * cardS, alignItems: 'center', justifyContent: 'center' },
  trashBtn: { transform: [{ translateY: -0.5 * s }] },
  emptyCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 * s },
  nudgeCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    gap: Spacing.two * s,
    borderLeftWidth: 3,
    borderLeftColor: BakeryColors.honey,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  nudgeTitle: { fontSize: 14 * s },
  nudgeText: { lineHeight: 20 * s, fontSize: 13 * s },
  nudgeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: BakeryColors.cream,
    borderRadius: BakeryRadii.chip * s,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 6 * s,
  },
  nudgeBtnText: { color: BakeryColors.mocha, fontWeight: '700' },

  // Exam countdowns
  examHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examLimitRow: { flexDirection: 'row', alignItems: 'center', gap: 4 * s },
  examNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 * s },
  examSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5 * s, flexWrap: 'wrap' },
  examEmptyCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.four * s,
    alignItems: 'center',
    backgroundColor: PastelCards.peach.fill,
    borderWidth: 1.5,
    borderColor: PastelCards.peach.border,
  },
  examCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three * s,
    backgroundColor: PastelCards.peach.fill,
    borderWidth: 1.5,
    borderColor: PastelCards.peach.border,
  },
  examInfo: { flex: 1, gap: 2 * cardS },
  // Exam name + date match the task-card title/meta sizes (cardS) so all the text
  // under the calendar is consistent — not a tiny name next to a giant countdown.
  examName: { fontSize: 15 * cardS, lineHeight: 20 * cardS, fontWeight: '700' },
  examMeta: { fontSize: 12 * cardS, lineHeight: 16 * cardS },
  examRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  // Countdown only slightly larger than the exam name (16 vs 15) so "Past"/"10d"
  // no longer dwarfs the title.
  examDays: { fontSize: 16 * cardS, fontWeight: '800', color: BakeryColors.mocha },
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
  addExamText: { color: BakeryColors.mocha },
  upgradeExamCard: {
    borderRadius: 12 * s,
    paddingVertical: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6 * s,
    borderWidth: 1.5,
    borderColor: `${BakeryColors.honey}55`,
    borderStyle: 'dashed',
    backgroundColor: BakeryColors.cream,
  },
  upgradeExamText: { color: BakeryColors.mocha },
  });
};
