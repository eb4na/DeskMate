/**
 * Add / Edit task modal.
 * Pass ?taskId=xxx to enter edit mode; omit for create mode.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BakeryBellEmoji } from '@/components/bakery-emoji';
import { DateWheelPicker, getTodayISO } from '@/components/date-wheel-picker';
import { TimeWheelPicker } from '@/components/time-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import type { TaskPriority, TaskStatus } from '@/context/app-context';
import { cancelTaskNotification, scheduleTaskNotification } from '@/lib/notifications';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

const PRIORITY_OPTIONS: { value: TaskPriority; labelKey: string; color: string }[] = [
  { value: 'low', labelKey: 'addTask.prioLow', color: '#CDBFAC' },
  { value: 'medium', labelKey: 'addTask.prioMedium', color: '#F2B33C' },
  { value: 'high', labelKey: 'addTask.prioHigh', color: '#E0584A' },
];

const STATUS_OPTIONS: { value: TaskStatus; labelKey: string }[] = [
  { value: 'not_started', labelKey: 'addTask.statusNotStarted' },
  { value: 'in_progress', labelKey: 'addTask.statusInProgress' },
  { value: 'done', labelKey: 'addTask.statusDone' },
];

// Reminder fires this many minutes before the task's due time.
const REMINDER_OFFSETS = [5, 15, 30];

export default function AddTaskScreen() {
  const { t } = useTranslation();
  const { taskId, date } = useLocalSearchParams<{ taskId?: string; date?: string }>();
  const { tasks, subjects, addTask, updateTask, use24HourTime } = useApp();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const editing = !!taskId;
  const existingTask = editing ? tasks.find((t) => t.id === taskId) : undefined;
  const todayISO = getTodayISO();

  const [title, setTitle] = useState(existingTask?.title ?? '');
  const [subjectId, setSubjectId] = useState<string | null>(existingTask?.subjectId ?? null);
  const [dueDateEnabled, setDueDateEnabled] = useState(existingTask?.dueDate != null || !editing);
  const [dueDate, setDueDate] = useState(existingTask?.dueDate ?? date ?? todayISO);
  const [dueTime, setDueTime] = useState(existingTask?.dueTime ?? '09:00');
  const [priority, setPriority] = useState<TaskPriority>(existingTask?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(existingTask?.status ?? 'not_started');

  // Notification reminder — fires N minutes before the task's due time (or off).
  const deriveOffset = (): number | null => {
    if (!existingTask?.notifyAt) return null;
    if (existingTask.dueDate && existingTask.dueTime) {
      const [h, m] = existingTask.dueTime.split(':').map(Number);
      const due = new Date(`${existingTask.dueDate}T00:00:00`);
      due.setHours(h, m, 0, 0);
      const off = Math.round((due.getTime() - new Date(existingTask.notifyAt).getTime()) / 60000);
      if (REMINDER_OFFSETS.includes(off)) return off;
    }
    return 15;
  };
  const [notifyOffset, setNotifyOffset] = useState<number | null>(deriveOffset());

  useEffect(() => {
    if (editing && !existingTask) {
      router.back();
    }
  }, [editing, existingTask]);

  const activeSubjects = subjects.filter((s) => !s.archived);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('addTask.titleRequired'), t('addTask.enterTaskTitle'));
      return;
    }
    const dueDateValue = dueDateEnabled ? dueDate.trim() || todayISO : null;
    const dueTimeValue = dueDateEnabled ? dueTime : null;

    // Reminder fires `notifyOffset` minutes before the due date+time.
    let notifyAt: string | null = null;
    if (notifyOffset != null && dueDateValue && dueTimeValue) {
      const [h, m] = dueTimeValue.split(':').map(Number);
      const due = new Date(`${dueDateValue}T00:00:00`);
      due.setHours(h, m, 0, 0);
      notifyAt = new Date(due.getTime() - notifyOffset * 60000).toISOString();
    }

    // Cancel any previously scheduled reminder for this task.
    await cancelTaskNotification(existingTask?.notifId ?? null);

    const titleVal = title.trim();
    const id = editing ? taskId! : addTask({
      title: titleVal,
      subjectId,
      dueDate: dueDateValue,
      dueTime: dueTimeValue,
      estimatedMinutes: existingTask?.estimatedMinutes ?? null,
      priority,
      status,
      notifyAt,
    });

    // Schedule the new reminder (if any) and persist its id.
    const notifId = notifyAt ? await scheduleTaskNotification({ id, title: titleVal, notifyAt }) : null;

    if (editing) {
      updateTask(taskId!, { title: titleVal, subjectId, dueDate: dueDateValue, dueTime: dueTimeValue, priority, status, notifyAt, notifId });
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
            {editing ? t('addTask.editTask') : t('addTask.addTaskTitle')}
          </ThemedText>

          {/* Title */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.taskTitleReq')}
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder={t('addTask.titlePlaceholder')}
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
              {t('addTask.subjectOptional')}
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable
                onPress={() => setSubjectId(null)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={subjectId === null ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">{t('addTask.none')}</ThemedText>
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
                    {t('addTask.addSubject')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
          </ThemedView>

          {/* Priority */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.priority')}
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
                    <View style={[styles.priorityDot, { backgroundColor: opt.color }]} />
                    <ThemedText type="small">{t(opt.labelKey)}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          {/* Status (edit mode only) */}
          {editing && (
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                {t('addTask.status')}
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
                      <ThemedText type="small">{t(opt.labelKey)}</ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {/* Due date */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.dueDateOptional')}
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable
                onPress={() => setDueDateEnabled(true)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={dueDateEnabled ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">{t('addTask.pickDate')}</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setDueDateEnabled(false)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={!dueDateEnabled ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">{t('addTask.noDueDate')}</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
            {dueDateEnabled ? (
              <>
                <DateWheelPicker value={dueDate} onChange={setDueDate} />
                <TimeWheelPicker value={dueTime} onChange={setDueTime} use24Hour={use24HourTime} />
              </>
            ) : (
              <ThemedView type="backgroundElement" style={styles.dateHintCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('addTask.noDueDateSelected')}
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Reminder notification — N minutes before the due time */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.reminderOptional')}
            </ThemedText>
            {dueDateEnabled ? (
              <ThemedView style={styles.chipRow}>
                <Pressable onPress={() => setNotifyOffset(null)} style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedView type={notifyOffset == null ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                    <ThemedText type="small">{t('addTask.noReminder')}</ThemedText>
                  </ThemedView>
                </Pressable>
                {REMINDER_OFFSETS.map((off) => (
                  <Pressable key={off} onPress={() => setNotifyOffset(off)} style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedView type={notifyOffset === off ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                      <BakeryBellEmoji size={14} />
                      <ThemedText type="small">{off} min before</ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ThemedView>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Turn on a due date & time to add a reminder.
              </ThemedText>
            )}
          </ThemedView>

          {/* Save */}
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {editing ? t('addTask.saveChanges') : t('addTask.addTaskTitle')}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <ThemedText type="linkPrimary">{t('common.cancel')}</ThemedText>
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
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
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
