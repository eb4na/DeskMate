import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BakeryBellEmoji, BakeryLockEmoji, BakeryStarEmoji } from '@/components/bakery-emoji';
import { TaskCalendar } from '@/components/task-calendar';
import { formatTimeLabel } from '@/components/time-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import type { Task, TaskStatus } from '@/context/app-context';
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
  // Parse as local midnight so the day count doesn't shift in zones behind UTC.
  const target = new Date(`${dateISO}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
};

const PRIORITY_COLOR: Record<string, string> = {
  high: '#E0584A',
  medium: '#F2B33C',
  low: '#CDBFAC',
};

function formatDueDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_ICON: Record<TaskStatus, string> = {
  not_started: '○',
  in_progress: '◑',
  done: '●',
};

function SubjectBadge({ subjectId }: { subjectId: string | null }) {
  const { subjects } = useApp();
  if (!subjectId) return null;
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) return null;
  return (
    <ThemedView style={[styles.badge, { backgroundColor: subject.color + '30' }]}>
      <ThemedView style={[styles.badgeDot, { backgroundColor: subject.color }]} />
      <ThemedText style={[styles.badgeText, { color: subject.color }]}>{subject.name}</ThemedText>
    </ThemedView>
  );
}

function TaskRow({ task, onToggle, onEdit, onDelete, onPostpone }: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPostpone: () => void;
}) {
  const { use24HourTime } = useApp();
  const isDone = task.status === 'done';

  return (
    <ThemedView type="backgroundElement" style={[styles.taskRow, isDone && styles.taskRowDone]}>
      {/* Status toggle */}
      <Pressable style={styles.statusBtn} onPress={onToggle}>
        <ThemedText style={[styles.statusIcon, isDone && styles.statusIconDone]}>
          {STATUS_ICON[task.status]}
        </ThemedText>
      </Pressable>

      {/* Content */}
      <Pressable style={styles.taskContent} onPress={onEdit}>
        <ThemedView style={styles.taskTitleRow}>
          <ThemedText
            style={[styles.taskTitle, isDone && styles.taskTitleDone]}
            numberOfLines={2}>
            {task.title}
          </ThemedText>
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[task.priority] }]} />
        </ThemedView>

        <ThemedView style={styles.taskMeta}>
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
        </ThemedView>
      </Pressable>

      {/* Actions */}
      <ThemedView style={styles.taskActions}>
        {!isDone && (
          <Pressable style={styles.actionBtn} onPress={onPostpone}>
            <ThemedText type="small" themeColor="textSecondary">↷</ThemedText>
          </Pressable>
        )}
        <Pressable style={styles.actionBtn} onPress={onDelete}>
          <ThemedText style={styles.deleteIcon}>✕</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

export default function TasksScreen() {
  const {
    tasks,
    subjects,
    updateTask,
    deleteTask,
    completeTask,
    postponeTask,
    examCountdowns,
    removeExam,
    isPlus,
  } = useApp();
  const [showDone, setShowDone] = useState(false);

  const canAddExam = isPlus || examCountdowns.length < 3;
  const examLimitText = isPlus ? `${examCountdowns.length} exams` : `${examCountdowns.length}/3`;

  const notStarted = tasks.filter((t) => t.status === 'not_started');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');
  const done = tasks.filter((t) => t.status === 'done');

  // Avoidance tracker: tasks with postponeCount >= 1, not done, sorted by count desc
  const needsAttention = tasks
    .filter((t) => t.status !== 'done' && t.postponeCount >= 1)
    .sort((a, b) => b.postponeCount - a.postponeCount)
    .slice(0, 3);

  const handleToggle = (task: Task) => {
    if (task.status === 'in_progress') {
      completeTask(task.id);
    } else {
      updateTask(task.id, { status: STATUS_CYCLE[task.status] });
    }
  };

  const handleDelete = (task: Task) => {
    Alert.alert('Delete task?', `"${task.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTask(task.id) },
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
                onPostpone={() => postponeTask(task.id)}
              />
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Tasks
            </ThemedText>
            <ThemedView style={styles.headerActions}>
              <Pressable
                style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
                onPress={() => router.push(canAddExam ? '/add-exam' : '/plus-upgrade')}>
                <ThemedText type="small" themeColor="textSecondary">+ Exam</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={() => router.push('/add-task')}>
                <ThemedText style={styles.addBtnText}>+ Task</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>

          {/* Calendar with day notes + task peek */}
          <TaskCalendar />

          {/* ── Exam countdowns ───────────────────────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.examHeader}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Exam Countdowns
              </ThemedText>
              <View style={styles.examLimitRow}>
                <ThemedText type="small" themeColor="textSecondary">{examLimitText}</ThemedText>
                {isPlus && (
                  <>
                    <BakeryStarEmoji size={12} />
                    <ThemedText style={styles.plusBadge}>Plus</ThemedText>
                  </>
                )}
              </View>
            </ThemedView>

            {examCountdowns.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.examEmptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No exams added yet.{isPlus ? ' Unlimited exams with Plus.' : ' Track up to 3 at a time.'}
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
                  <ThemedView style={styles.examInfo}>
                    <View style={styles.examNameRow}>
                      {isToday && <BakeryStarEmoji size={14} />}
                      <ThemedText type="smallBold">{exam.name}</ThemedText>
                    </View>
                    <View style={styles.examSubRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {exam.subject ? `${exam.subject} · ` : ''}{exam.dateISO}
                      </ThemedText>
                      {exam.reminderEnabled && <BakeryBellEmoji size={11} />}
                    </View>
                  </ThemedView>
                  <ThemedView style={styles.examRight}>
                    <ThemedText
                      style={[
                        styles.examDays,
                        isUrgent && styles.examDaysUrgent,
                        isPast && styles.examDaysPast,
                      ]}>
                      {isPast ? 'Past' : isToday ? 'Today' : `${days}d`}
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
                style={({ pressed }) => [styles.addExamBtn, pressed && styles.pressed]}
                onPress={() => router.push('/add-exam')}>
                <ThemedText type="small" style={styles.addExamText}>
                  + Add exam countdown
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/plus-upgrade')}>
                <ThemedView type="backgroundElement" style={styles.upgradeExamCard}>
                  <BakeryLockEmoji size={14} />
                  <ThemedText type="small" style={styles.upgradeExamText}>
                    Unlimited exam countdowns — upgrade to Plus
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          </ThemedView>


          {/* Needs attention (avoidance tracker) */}
          {needsAttention.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Needs attention
              </ThemedText>
              {needsAttention.map((task) => {
                const subjectName = task.subjectId
                  ? subjects.find((s) => s.id === task.subjectId)?.name
                  : null;
                const nudge = subjectName
                  ? `${subjectName} has been sitting here for a while. Want to try just 10 minutes?`
                  : `This task has been waiting. Want to give it just 10 minutes today?`;
                return (
                  <ThemedView key={task.id} type="backgroundElement" style={styles.nudgeCard}>
                    <ThemedText type="smallBold" style={styles.nudgeTitle} numberOfLines={1}>
                      {task.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.nudgeText}>
                      {nudge}
                    </ThemedText>
                    <Pressable
                      style={({ pressed }) => [styles.nudgeBtn, pressed && styles.pressed]}
                      onPress={() => router.push('/')}>
                      <ThemedText type="small" style={styles.nudgeBtnText}>
                        Start a session →
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                );
              })}
            </ThemedView>
          )}

          {/* Task sections */}
          {renderSection('In progress', inProgress)}
          {renderSection('Not started', notStarted)}

          {/* Done section (collapsible) */}
          {done.length > 0 && (
            <ThemedView style={styles.section}>
              <Pressable onPress={() => setShowDone((v) => !v)} style={styles.doneToggle}>
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  {showDone ? '▾' : '▸'} Done ({done.length})
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
                      onPostpone={() => postponeTask(task.id)}
                    />
                  ))}
                </ThemedView>
              )}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, lineHeight: 34 },
  headerActions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  manageBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  addBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E0A33C',
    ...BakeryShadow,
  },
  addBtnText: { color: BakeryColors.cocoaDark, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  welcomeCard: {
    borderRadius: BakeryRadii.panel,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  welcomeEmoji: { fontSize: 48, lineHeight: 56 },
  welcomeTitle: { fontSize: 18 },
  welcomeText: { textAlign: 'center', lineHeight: 20 },
  welcomeAddBtn: { marginTop: Spacing.two },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  doneToggle: {},
  taskList: { gap: Spacing.two },
  taskRow: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BakeryColors.shortbread,
    backgroundColor: BakeryColors.glass,
  },
  taskRowDone: { opacity: 0.55 },
  statusBtn: { paddingHorizontal: 2 },
  statusIcon: { fontSize: 20, lineHeight: 24, color: BakeryColors.mocha },
  statusIconDone: { color: BakeryColors.success },
  taskContent: { flex: 1, gap: 5 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  taskTitleDone: { textDecorationLine: 'line-through' },
  priorityDot: { width: 9, height: 9, borderRadius: 5 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  metaText: { fontSize: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  taskActions: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  actionBtn: { padding: 6 },
  deleteIcon: { fontSize: 13, color: BakeryColors.danger },
  emptyCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  nudgeCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    gap: Spacing.two,
    borderLeftWidth: 3,
    borderLeftColor: BakeryColors.honey,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  nudgeTitle: { fontSize: 14 },
  nudgeText: { lineHeight: 20, fontSize: 13 },
  nudgeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: BakeryColors.cream,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  nudgeBtnText: { color: BakeryColors.mocha, fontWeight: '700' },

  // Exam countdowns
  examHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examLimitRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  examSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  plusBadge: { color: BakeryColors.berry, fontSize: 11 },
  examEmptyCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.four,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  examCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
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
  addExamText: { color: BakeryColors.mocha },
  upgradeExamCard: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: `${BakeryColors.honey}55`,
    borderStyle: 'dashed',
    backgroundColor: BakeryColors.cream,
  },
  upgradeExamText: { color: BakeryColors.mocha },
});
