/**
 * Add / Edit task modal.
 * Pass ?taskId=xxx to enter edit mode; omit for create mode.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useColorScheme } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateWheelPicker, getTodayISO } from '@/components/date-wheel-picker';
import { TimeWheelPicker } from '@/components/time-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp, MAX_TASKS } from '@/context/app-context';
import type { TaskStatus } from '@/context/app-context';
import { cancelTaskNotification, scheduleTaskNotification } from '@/lib/notifications';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

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
  // A due time is optional — dated tasks default to "All day" (no time).
  const [dueTimeEnabled, setDueTimeEnabled] = useState(editing ? existingTask?.dueTime != null : false);
  const [dueTime, setDueTime] = useState(existingTask?.dueTime ?? '09:00');
  const [status, setStatus] = useState<TaskStatus>(existingTask?.status ?? 'not_started');
  // Weekdays (0=Sun … 6=Sat) the task repeats on. Empty = no repeat.
  const [repeatDays, setRepeatDays] = useState<number[]>(existingTask?.repeatDays ?? []);
  const toggleRepeatDay = (d: number) =>
    setRepeatDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  // Optional end date for the repeat ("repeat until …"). Off = repeats with no end.
  const [repeatUntilEnabled, setRepeatUntilEnabled] = useState(existingTask?.repeatUntil != null);
  const [repeatUntil, setRepeatUntil] = useState(existingTask?.repeatUntil ?? existingTask?.dueDate ?? date ?? todayISO);

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
      showPopup(t('addTask.titleRequired'), t('addTask.enterTaskTitle'));
      return;
    }
    const dueDateValue = dueDateEnabled ? dueDate.trim() || todayISO : null;
    const dueTimeValue = dueDateEnabled && dueTimeEnabled ? dueTime : null;

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

    // Repeats only make sense with a due date to roll forward.
    const repeatDaysValue = dueDateEnabled && repeatDays.length ? repeatDays : undefined;
    const repeatUntilValue = repeatDaysValue && repeatUntilEnabled ? repeatUntil.trim() || undefined : undefined;

    const titleVal = title.trim();
    const id = editing ? taskId! : addTask({
      title: titleVal,
      subjectId,
      dueDate: dueDateValue,
      dueTime: dueTimeValue,
      estimatedMinutes: existingTask?.estimatedMinutes ?? null,
      priority: existingTask?.priority ?? 'medium',
      status,
      notifyAt,
      repeatDays: repeatDaysValue,
      repeatUntil: repeatUntilValue,
    });

    // addTask returns '' when the task cap is reached.
    if (!editing && !id) {
      showPopup(t('addTask.limitReached'), t('addTask.limitMsg', { count: MAX_TASKS }));
      return;
    }

    // Schedule the new reminder (if any) and persist its id.
    const notifId = notifyAt ? await scheduleTaskNotification({ id, title: titleVal, notifyAt }) : null;

    if (editing) {
      updateTask(taskId!, { title: titleVal, subjectId, dueDate: dueDateValue, dueTime: dueTimeValue, status, notifyAt, notifId, repeatDays: repeatDaysValue, repeatUntil: repeatUntilValue });
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
              maxLength={80}
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
                <ThemedView style={styles.chipRow}>
                  <Pressable
                    onPress={() => setDueTimeEnabled(true)}
                    style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedView
                      type={dueTimeEnabled ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.chip}>
                      <ThemedText type="small">{t('addTask.pickTime')}</ThemedText>
                    </ThemedView>
                  </Pressable>
                  <Pressable
                    onPress={() => setDueTimeEnabled(false)}
                    style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedView
                      type={!dueTimeEnabled ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.chip}>
                      <ThemedText type="small">{t('addTask.noTime')}</ThemedText>
                    </ThemedView>
                  </Pressable>
                </ThemedView>
                {dueTimeEnabled && (
                  <TimeWheelPicker value={dueTime} onChange={setDueTime} use24Hour={use24HourTime} />
                )}
              </>
            ) : (
              <ThemedView type="backgroundElement" style={styles.dateHintCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('addTask.noDueDateSelected')}
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Repeat — choose which weekdays the task repeats on (needs a due date) */}
          {dueDateEnabled && (
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                {t('addTask.repeatOn')}
              </ThemedText>
              <View style={styles.weekdayRow}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const on = repeatDays.includes(d);
                  return (
                    <Pressable key={d} onPress={() => toggleRepeatDay(d)} style={({ pressed }) => [pressed && styles.pressed]}>
                      <ThemedView type={on ? 'backgroundSelected' : 'backgroundElement'} style={styles.weekdayChip}>
                        <ThemedText type="smallBold">{t(`calendar.wd_${d}`)}</ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>
              {repeatDays.length > 0 && (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('addTask.repeatHint')}
                  </ThemedText>
                  <ThemedView style={styles.chipRow}>
                    <Pressable onPress={() => setRepeatUntilEnabled(false)} style={({ pressed }) => [pressed && styles.pressed]}>
                      <ThemedView type={!repeatUntilEnabled ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                        <ThemedText type="small">{t('addTask.repeatNoEnd')}</ThemedText>
                      </ThemedView>
                    </Pressable>
                    <Pressable onPress={() => setRepeatUntilEnabled(true)} style={({ pressed }) => [pressed && styles.pressed]}>
                      <ThemedView type={repeatUntilEnabled ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                        <ThemedText type="small">{t('addTask.repeatUntil')}</ThemedText>
                      </ThemedView>
                    </Pressable>
                  </ThemedView>
                  {repeatUntilEnabled && <DateWheelPicker value={repeatUntil} onChange={setRepeatUntil} />}
                </>
              )}
            </ThemedView>
          )}

          {/* Reminder notification — N minutes before the due time */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.reminderOptional')}
            </ThemedText>
            {dueDateEnabled && dueTimeEnabled ? (
              <ThemedView style={styles.chipRow}>
                <Pressable onPress={() => setNotifyOffset(null)} style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedView type={notifyOffset == null ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                    <ThemedText type="small">{t('addTask.noReminder')}</ThemedText>
                  </ThemedView>
                </Pressable>
                {REMINDER_OFFSETS.map((off) => (
                  <Pressable key={off} onPress={() => setNotifyOffset(off)} style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedView type={notifyOffset === off ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
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
          <SoundPressable
            sound="confirm"
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {editing ? t('addTask.saveChanges') : t('addTask.addTaskTitle')}
            </ThemedText>
          </SoundPressable>

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
  weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekdayChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
