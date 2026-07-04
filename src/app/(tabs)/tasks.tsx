import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { BakeryBellEmoji } from '@/components/bakery-emoji';
import { CountdownShape } from '@/components/countdown-shapes';
import { LockBadge } from '@/components/lock-badge';
import { TaskCalendar } from '@/components/task-calendar';
import { formatTimeLabel } from '@/components/time-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp, FREE_EXAM_LIMIT } from '@/context/app-context';
import type { Task } from '@/context/app-context';
import { computeTaskRollover } from '@/lib/task-recurrence';
import { cancelTaskNotification, scheduleTaskNotification } from '@/lib/notifications';
import i18n, { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabClearance,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse as local midnight so the day count doesn't shift in zones behind UTC.
  const target = new Date(`${dateISO}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDueDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(i18n.language || 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function SubjectBadge({ subjectId }: { subjectId: string | null }) {
  const { subjects } = useApp();
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  if (!subjectId) return null;
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) return null;
  return (
    <ThemedView style={[styles.badge, { backgroundColor: subject.color + '30' }]}>
      <ThemedView style={[styles.badgeDot, { backgroundColor: subject.color }]} />
      <ThemedText style={[styles.badgeText, { color: subject.color }]}>{localizeSubjectName(subject.name, t)}</ThemedText>
    </ThemedView>
  );
}

// Simple pastel-red trash can for the delete action — lid, handle, and a clean
// tapered body. Deliberately minimal (no ribs/details) so it reads at icon size.
const TRASH_PASTEL = '#E89B9B';
function TrashIcon({ size = 16, color = TRASH_PASTEL }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {/* handle */}
      <Path d="M9.2 2.2 h5.6 a1 1 0 0 1 1 1 V4.4 H8.2 V3.2 a1 1 0 0 1 1 -1 Z" />
      {/* lid */}
      <Path d="M4 4.4 h16 a1.1 1.1 0 0 1 0 2.2 H4 a1.1 1.1 0 0 1 0 -2.2 Z" />
      {/* body (filled) */}
      <Path d="M5.8 7.6 h12.4 l-0.9 11.7 A2.2 2.2 0 0 1 15.1 21.4 H8.9 A2.2 2.2 0 0 1 6.7 19.3 Z" />
    </Svg>
  );
}

function TaskRow({ task, onToggle, onEdit, onDelete }: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { use24HourTime } = useApp();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  // Match the cardS boost used for the task-card styles (see makeStyles / CARD_BOOST).
  const cardScale = scale > 1 ? scale * 1.3 : scale;
  const isDone = task.status === 'done';

  return (
    <ThemedView type="backgroundElement" style={[styles.taskRow, isDone && styles.taskRowDone]}>
      {/* Content */}
      <Pressable style={styles.taskContent} onPress={onEdit}>
        <View style={styles.taskTitleRow}>
          <ThemedText
            style={[styles.taskTitle, isDone && styles.taskTitleDone]}
            numberOfLines={2}>
            {task.title}
          </ThemedText>
        </View>

        <View style={styles.taskMeta}>
          <SubjectBadge subjectId={task.subjectId} />
          {task.dueDate && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
              {formatDueDate(task.dueDate)}{task.dueTime ? ` · ${formatTimeLabel(task.dueTime, use24HourTime)}` : ''}
            </ThemedText>
          )}
          {task.estimatedMinutes && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
              {task.estimatedMinutes}m
            </ThemedText>
          )}
          {task.postponeCount > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
              ↷ {task.postponeCount}×
            </ThemedText>
          )}
          {task.repeatDays && task.repeatDays.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
              ↻ {[...task.repeatDays].sort((a, b) => a - b).map((d) => i18n.t(`calendar.wd_${d}`)).join('')}
            </ThemedText>
          )}
        </View>
      </Pressable>

      {/* Actions — completion toggle + delete, matched size, side by side. */}
      <View style={styles.taskActions}>
        {/* Finished / not-finished toggle. Plays the confirm sound only when
            completing a task (not when un-completing one). */}
        <SoundPressable
          sound={isDone ? 'none' : 'confirm'}
          style={styles.actionBtn}
          onPress={onToggle}
          hitSlop={8}>
          <View style={[styles.statusDot, isDone ? styles.statusDotDone : styles.statusDotTodo]} />
        </SoundPressable>
        <Pressable style={[styles.actionBtn, styles.trashBtn]} onPress={onDelete} hitSlop={8}>
          <TrashIcon size={18 * cardScale} />
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function TasksScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  // Same card boost as the task/exam card content (see makeStyles / CARD_BOOST), for
  // the inline icons that can't read it from the stylesheet.
  const cardScale = scale > 1 ? scale * 1.3 : scale;
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const {
    tasks,
    subjects,
    updateTask,
    deleteTask,
    completeTask,
    examCountdowns,
    removeExam,
    isPlus,
  } = useApp();
  const [showDone, setShowDone] = useState(false);

  const canAddExam = isPlus || examCountdowns.length < FREE_EXAM_LIMIT;
  const examLimitText = isPlus ? t('tasks.examsCount', { count: examCountdowns.length }) : `${examCountdowns.length}/${FREE_EXAM_LIMIT}`;

  const todo = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  // Avoidance tracker: tasks with postponeCount >= 1, not done, sorted by count desc
  const needsAttention = tasks
    .filter((t) => t.status !== 'done' && t.postponeCount >= 1)
    .sort((a, b) => b.postponeCount - a.postponeCount)
    .slice(0, 3);

  const handleToggle = async (task: Task) => {
    if (task.status !== 'done') {
      // Mark finished. A repeating task rolls its due date forward instead of
      // finishing, so reschedule its reminder to the next occurrence.
      const rollover = task.repeatDays?.length ? computeTaskRollover(task) : null;
      completeTask(task.id);
      if (rollover) {
        await cancelTaskNotification(task.notifId);
        if (rollover.notifyAt) {
          const notifId = await scheduleTaskNotification({ id: task.id, title: task.title, notifyAt: rollover.notifyAt });
          updateTask(task.id, { notifId: notifId ?? null });
        }
      }
    } else {
      // Mark not finished again.
      updateTask(task.id, { status: 'not_started' });
    }
  };

  const handleDelete = (task: Task) => {
    showPopup(t('tasks.deleteTask'), t('tasks.deleteTaskMsg', { title: task.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteTask(task.id) },
    ]);
  };

  const renderSection = (title: string, items: Task[], emptyMsg?: string) => {
    if (items.length === 0 && !emptyMsg) return null;
    return (
      <ThemedView style={styles.section}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        {items.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {emptyMsg}
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView style={styles.taskList}>
            {items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => handleToggle(task)}
                onEdit={() => router.push({ pathname: '/add-task', params: { taskId: task.id } })}
                onDelete={() => handleDelete(task)}
              />
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {t('tasks.title')}
            </ThemedText>
            <ThemedView style={styles.headerActions}>
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
            <ThemedView style={styles.section}>
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
                    <ThemedText type="smallBold" style={styles.nudgeTitle} numberOfLines={1}>
                      {task.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.nudgeText}>
                      {nudge}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
          )}

          {/* Task sections */}
          {renderSection(t('tasks.notStarted'), todo)}

          {/* Done section (collapsible) */}
          {done.length > 0 && (
            <ThemedView style={styles.section}>
              <Pressable onPress={() => setShowDone((v) => !v)} style={styles.doneToggle}>
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  {showDone ? '▾' : '▸'} {t('tasks.doneCount', { count: done.length })}
                </ThemedText>
              </Pressable>
              {showDone && (
                <ThemedView style={styles.taskList}>
                  {done.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task)}
                      onEdit={() => router.push({ pathname: '/add-task', params: { taskId: task.id } })}
                      onDelete={() => handleDelete(task)}
                    />
                  ))}
                </ThemedView>
              )}
            </ThemedView>
          )}

          {/* ── Exam countdowns (below the task list) ─────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.examHeader}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                {t('tasks.examCountdowns')}
              </ThemedText>
              <View style={styles.examLimitRow}>
                <ThemedText type="small" themeColor="textSecondary">{examLimitText}</ThemedText>
              </View>
            </ThemedView>

            {examCountdowns.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.examEmptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('tasks.noExamsYet')}{isPlus ? t('tasks.unlimitedWithPlus') : t('tasks.trackUpTo3')}
                </ThemedText>
              </ThemedView>
            )}

            {examCountdowns.map((exam) => {
              const days = daysUntil(exam.dateISO);
              const isUrgent = days >= 0 && days <= 7;
              const isPast = days < 0;
              const isToday = days === 0;
              return (
                <ThemedView key={exam.id} type="backgroundElement" style={styles.examCard}>
                  <Pressable
                    style={({ pressed }) => [styles.examInfo, pressed && styles.pressed]}
                    onPress={() => router.push({ pathname: '/add-exam', params: { examId: exam.id } })}>
                    <View style={styles.examNameRow}>
                      <CountdownShape shape={exam.shape} size={16 * cardScale} />
                      <ThemedText type="smallBold" style={styles.examName}>{exam.name}</ThemedText>
                    </View>
                    <View style={styles.examSubRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.examMeta}>
                        {exam.subject ? `${localizeSubjectName(exam.subject, t)} · ` : ''}{exam.dateISO}
                      </ThemedText>
                      {exam.reminderEnabled && <BakeryBellEmoji size={11 * cardScale} />}
                    </View>
                  </Pressable>
                  <View style={styles.examRight}>
                    <ThemedText
                      style={[
                        styles.examDays,
                        isUrgent && styles.examDaysUrgent,
                        isPast && styles.examDaysPast,
                      ]}>
                      {isPast ? t('tasks.past') : isToday ? t('tasks.today') : `${days}d`}
                    </ThemedText>
                    <Pressable onPress={() => removeExam(exam.id)} style={styles.removeBtn} hitSlop={8}>
                      <TrashIcon size={16 * cardScale} />
                    </Pressable>
                  </View>
                </ThemedView>
              );
            })}

            {canAddExam ? (
              <Pressable
                style={({ pressed }) => [styles.addExamBtn, pressed && styles.pressed]}
                onPress={() => router.push('/add-exam')}>
                <ThemedText type="small" style={styles.addExamText}>
                  {t('tasks.addExamCountdown')}
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/plus-upgrade')}>
                <ThemedView type="backgroundElement" style={styles.upgradeExamCard}>
                  <LockBadge size={16 * scale} />
                  <ThemedText type="small" style={styles.upgradeExamText}>
                    {t('tasks.unlimitedUpgrade')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          </ThemedView>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
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
  sectionTitle: { fontSize: 13 * s, textTransform: 'uppercase', letterSpacing: 0.5 },
  doneToggle: {},
  taskList: { gap: Spacing.two * s },
  // Task cards use cardS (slightly larger on tablet) so they balance the calendar.
  taskRow: {
    borderRadius: BakeryRadii.card * cardS,
    padding: Spacing.three * cardS,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * cardS,
    borderWidth: 1,
    borderColor: BakeryColors.shortbread,
    backgroundColor: BakeryColors.glass,
  },
  taskRowDone: { opacity: 0.55 },
  taskContent: { flex: 1, gap: 5 * cardS },
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
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
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
