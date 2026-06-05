/**
 * Add / Edit task modal.
 * Pass ?taskId=xxx to enter edit mode; omit for create mode.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateWheelPicker, getTodayISO } from '@/components/date-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import type { TaskPriority, TaskStatus } from '@/context/app-context';
import { cancelTaskNotification, scheduleTaskNotification } from '@/lib/notifications';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

function isValidTime(v: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v.trim());
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; emoji: string }[] = [
  { value: 'low', label: 'Low', emoji: '○' },
  { value: 'medium', label: 'Medium', emoji: '🟡' },
  { value: 'high', label: 'High', emoji: '🔴' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export default function AddTaskScreen() {
  const { taskId, date } = useLocalSearchParams<{ taskId?: string; date?: string }>();
  const { tasks, subjects, addTask, updateTask } = useApp();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const editing = !!taskId;
  const existingTask = editing ? tasks.find((t) => t.id === taskId) : undefined;
  const todayISO = getTodayISO();

  const [title, setTitle] = useState(existingTask?.title ?? '');
  const [subjectId, setSubjectId] = useState<string | null>(existingTask?.subjectId ?? null);
  const [dueDateEnabled, setDueDateEnabled] = useState(existingTask?.dueDate != null || !editing);
  const [dueDate, setDueDate] = useState(existingTask?.dueDate ?? date ?? todayISO);
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    existingTask?.estimatedMinutes ? String(existingTask.estimatedMinutes) : '',
  );
  const [priority, setPriority] = useState<TaskPriority>(existingTask?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(existingTask?.status ?? 'not_started');

  // Notification reminder
  const existingNotify = existingTask?.notifyAt ? new Date(existingTask.notifyAt) : null;
  const [notifyEnabled, setNotifyEnabled] = useState(!!existingTask?.notifyAt);
  const [notifyDate, setNotifyDate] = useState(
    existingNotify ? existingTask!.notifyAt!.slice(0, 10) : todayISO,
  );
  const [notifyTime, setNotifyTime] = useState(
    existingNotify
      ? `${String(existingNotify.getHours()).padStart(2, '0')}:${String(existingNotify.getMinutes()).padStart(2, '0')}`
      : '09:00',
  );

  useEffect(() => {
    if (editing && !existingTask) {
      router.back();
    }
  }, [editing, existingTask]);

  const activeSubjects = subjects.filter((s) => !s.archived);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    if (notifyEnabled && !isValidTime(notifyTime)) {
      Alert.alert('Invalid time', 'Enter the reminder time as HH:MM (24-hour).');
      return;
    }

    const estimatedNum = estimatedMinutes.trim()
      ? parseInt(estimatedMinutes.trim(), 10)
      : null;

    const dueDateValue = dueDateEnabled ? dueDate.trim() || todayISO : null;

    // Build the notifyAt ISO from the picked date + time.
    let notifyAt: string | null = null;
    if (notifyEnabled) {
      const [h, m] = notifyTime.split(':').map(Number);
      const dt = new Date(`${notifyDate}T00:00:00`);
      dt.setHours(h, m, 0, 0);
      notifyAt = dt.toISOString();
    }

    // Cancel any previously scheduled reminder for this task.
    await cancelTaskNotification(existingTask?.notifId ?? null);

    const titleVal = title.trim();
    const id = editing ? taskId! : addTask({
      title: titleVal,
      subjectId,
      dueDate: dueDateValue,
      estimatedMinutes: estimatedNum,
      priority,
      status,
      notifyAt,
    });

    // Schedule the new reminder (if any) and persist its id.
    const notifId = notifyAt ? await scheduleTaskNotification({ id, title: titleVal, notifyAt }) : null;

    if (editing) {
      updateTask(taskId!, { title: titleVal, subjectId, dueDate: dueDateValue, estimatedMinutes: estimatedNum, priority, status, notifyAt, notifId });
    } else if (notifId) {
      updateTask(id, { notifId });
    }

    router.back();
  };

  const inputStyle = [
    styles.input,
    { color: BakeryColors.cocoaDark, borderColor: BakeryColors.border, backgroundColor: BakeryColors.cream },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            {editing ? 'Edit task' : 'Add task'}
          </ThemedText>

          {/* Title */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Task title *
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="What do you need to do?"
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={title}
              onChangeText={setTitle}
              autoFocus={!editing}
              returnKeyType="next"
            />
          </ThemedView>

          {/* Subject */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Subject (optional)
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable
                onPress={() => setSubjectId(null)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={subjectId === null ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">None</ThemedText>
                </ThemedView>
              </Pressable>
              {activeSubjects.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSubjectId(s.id === subjectId ? null : s.id)}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedView
                    type={subjectId === s.id ? 'backgroundSelected' : 'backgroundElement'}
                    style={styles.chip}>
                    <ThemedView style={[styles.subjectDot, { backgroundColor: s.color }]} />
                    <ThemedText type="small">{s.name}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
              <Pressable
                onPress={() => router.push('/manage-subjects')}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView type="backgroundElement" style={[styles.chip, styles.addSubjectChip]}>
                  <ThemedText type="smallBold" style={styles.addSubjectChipText}>
                    + Add subject
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
          </ThemedView>

          {/* Priority */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Priority
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              {PRIORITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setPriority(opt.value)}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedView
                    type={priority === opt.value ? 'backgroundSelected' : 'backgroundElement'}
                    style={styles.chip}>
                    <ThemedText style={styles.chipEmoji}>{opt.emoji}</ThemedText>
                    <ThemedText type="small">{opt.label}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          {/* Status (edit mode only) */}
          {editing && (
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Status
              </ThemedText>
              <ThemedView style={styles.chipRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setStatus(opt.value)}
                    style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedView
                      type={status === opt.value ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.chip}>
                      <ThemedText type="small">{opt.label}</ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {/* Due date */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Due date (optional)
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable
                onPress={() => setDueDateEnabled(true)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={dueDateEnabled ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">Pick date</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setDueDateEnabled(false)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={!dueDateEnabled ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">No due date</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
            {dueDateEnabled ? (
              <DateWheelPicker value={dueDate} onChange={setDueDate} />
            ) : (
              <ThemedView type="backgroundElement" style={styles.dateHintCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  No due date selected.
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Reminder notification */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Reminder (optional)
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable onPress={() => setNotifyEnabled(true)} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView type={notifyEnabled ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                  <ThemedText type="small">🔔 Notify me</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable onPress={() => setNotifyEnabled(false)} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView type={!notifyEnabled ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                  <ThemedText type="small">No reminder</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
            {notifyEnabled && (
              <>
                <DateWheelPicker value={notifyDate} onChange={setNotifyDate} />
                <ThemedView style={styles.timeRow}>
                  <ThemedText type="small" themeColor="textSecondary">Time</ThemedText>
                  <TextInput
                    style={[inputStyle, styles.timeInput]}
                    value={notifyTime}
                    onChangeText={setNotifyTime}
                    placeholder="09:00"
                    placeholderTextColor={isDark ? '#666' : '#AAA'}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </ThemedView>
              </>
            )}
          </ThemedView>

          {/* Estimated time */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Estimated time (minutes, optional)
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g. 30"
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              keyboardType="numeric"
            />
          </ThemedView>

          {/* Save */}
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {editing ? 'Save changes' : 'Add task'}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  title: { fontSize: 24, lineHeight: 30 },
  fieldGroup: { gap: Spacing.two },
  label: { fontSize: 13 },
  input: {
    borderWidth: 1.5,
    borderRadius: BakeryRadii.button,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dateHintCard: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  chipEmoji: { fontSize: 14, lineHeight: 18 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  timeInput: { flex: 1 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  addSubjectChip: {
    borderWidth: 1,
    borderColor: '#D9C5B2',
    borderStyle: 'dashed',
  },
  addSubjectChipText: {
    color: '#7A5240',
  },
  pressed: { opacity: 0.8 },
  saveBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  saveBtnText: { color: BakeryColors.cocoaDark, fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
});
