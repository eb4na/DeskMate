import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import type { Task, TaskStatus } from '@/context/app-context';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
};

const PRIORITY_EMOJI: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '○',
};

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
          <ThemedText style={styles.priorityEmoji}>{PRIORITY_EMOJI[task.priority]}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.taskMeta}>
          <SubjectBadge subjectId={task.subjectId} />
          {task.dueDate && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
              📅 {task.dueDate}
            </ThemedText>
          )}
          {task.estimatedMinutes && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
              ⏱ {task.estimatedMinutes}m
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
  const { tasks, subjects, updateTask, deleteTask, completeTask, postponeTask } = useApp();
  const [showDone, setShowDone] = useState(false);

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

  const hasAnyTask = tasks.length > 0;

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
                onPress={() => router.push('/manage-subjects')}>
                <ThemedText type="small" themeColor="textSecondary">Subjects</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={() => router.push('/add-task')}>
                <ThemedText style={styles.addBtnText}>+ Task</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>

          {!hasAnyTask && (
            <ThemedView type="backgroundElement" style={styles.welcomeCard}>
              <ThemedText style={styles.welcomeEmoji}>📋</ThemedText>
              <ThemedText type="smallBold" style={styles.welcomeTitle}>
                No tasks yet
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.welcomeText}>
                Add your first task to stay organized. You'll earn 🪙 10 coins for every task you complete!
              </ThemedText>
              <Pressable
                style={({ pressed }) => [styles.addBtn, styles.welcomeAddBtn, pressed && styles.pressed]}
                onPress={() => router.push('/add-task')}>
                <ThemedText style={styles.addBtnText}>Add first task</ThemedText>
              </Pressable>
            </ThemedView>
          )}

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
          {renderSection('Not started', notStarted, hasAnyTask ? undefined : undefined)}

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
  container: { flex: 1 },
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
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  welcomeCard: {
    borderRadius: 20,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
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
    borderRadius: 14,
    padding: Spacing.two,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  taskRowDone: { opacity: 0.55 },
  statusBtn: { paddingTop: 2, paddingHorizontal: 4 },
  statusIcon: { fontSize: 18, lineHeight: 22, color: '#7C6F5A' },
  statusIconDone: { color: '#81C784' },
  taskContent: { flex: 1, gap: 4 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  taskTitle: { flex: 1, fontSize: 15, lineHeight: 20 },
  taskTitleDone: { textDecorationLine: 'line-through' },
  priorityEmoji: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
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
  deleteIcon: { fontSize: 13, color: '#E05C3A' },
  emptyCard: { borderRadius: 14, padding: Spacing.three, alignItems: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  nudgeCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    borderLeftWidth: 3,
    borderLeftColor: '#FFB74D',
  },
  nudgeTitle: { fontSize: 14 },
  nudgeText: { lineHeight: 20, fontSize: 13 },
  nudgeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#7C6F5A20',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  nudgeBtnText: { color: '#7C6F5A', fontWeight: '600' },
});
