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

import { DateWheelPicker, getTodayISO, formatDateLabel } from '@/components/date-wheel-picker';
import { TimeWheelPicker, formatTimeLabel } from '@/components/time-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp, MAX_TASKS } from '@/context/app-context';
import type { Task } from '@/context/app-context';
import { containsProfanity } from '@/lib/profanity';
import { cancelTaskNotification, scheduleTaskNotification } from '@/lib/notifications';
import { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

// Reminder fires this many minutes before the task's due time.
const REMINDER_OFFSETS = [5, 15, 30, 60, 180, 1440];

// Anchor time for reminders on "Anytime" tasks (no specific due time). The offset
// chips ("1 day before" etc.) count back from this time on the due date, so an
// all-day task can still carry a reminder.
const DEFAULT_REMINDER_TIME = '09:00';

// Chip label for a reminder offset, picking the right unit (min / hr / day) so
// "60 min before" reads as "1 hr before" and "1440 min before" as "1 day before".
function reminderLabel(off: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (off < 60) return t('addTask.minBefore', { n: off });
  if (off < 1440) return t('addTask.hrBefore', { n: off / 60 });
  return t('addTask.dayBefore', { n: off / 1440 });
}

// Default due time for a NEW task: one hour after the most recently added task
// that had a due time, so adding tasks back-to-back auto-stacks them an hour
// apart. Falls back to 9:00 AM when no prior timed task exists. The hour wraps at
// midnight (23:xx → 00:xx); minutes are kept. Editing keeps the task's saved time.
function nextDefaultDueTime(tasks: Task[]): string {
  const lastTimed = tasks.reduce<Task | undefined>(
    (latest, t) => (t.dueTime && (!latest || t.createdAt > latest.createdAt) ? t : latest),
    undefined,
  );
  if (!lastTimed?.dueTime) return '09:00';
  const [h, m] = lastTimed.dueTime.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
  const [description, setDescription] = useState(existingTask?.description ?? '');
  const [subjectId, setSubjectId] = useState<string | null>(existingTask?.subjectId ?? null);
  // The task's day comes from the tapped calendar cell (`date` param), the task's
  // saved date when editing, or today for a bare "＋ Add" — there's no in-form date
  // picker anymore. You choose the day by tapping a calendar cell.
  const targetDate = existingTask?.dueDate?.slice(0, 10) ?? date ?? todayISO;
  // "Due that day?" — Yes = a real deadline (drives the calendar red dot); No = the
  // task just sits on that day. Legacy dated tasks (isDeadline undefined) → Yes.
  const [isDeadline, setIsDeadline] = useState(existingTask?.isDeadline ?? true);
  // A due time is optional — dated tasks default to "All day" (no time).
  const [dueTimeEnabled, setDueTimeEnabled] = useState(editing ? existingTask?.dueTime != null : false);
  const [dueTime, setDueTime] = useState(existingTask?.dueTime ?? (editing ? '09:00' : nextDefaultDueTime(tasks)));
  // Weekdays (0=Sun … 6=Sat) the task repeats on. Empty = no repeat.
  const [repeatDays, setRepeatDays] = useState<number[]>(existingTask?.repeatDays ?? []);
  const toggleRepeatDay = (d: number) =>
    setRepeatDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  // Optional end date for the repeat ("repeat until …"). Off = repeats with no end.
  const [repeatUntilEnabled, setRepeatUntilEnabled] = useState(existingTask?.repeatUntil != null);
  const [repeatUntil, setRepeatUntil] = useState(existingTask?.repeatUntil ?? existingTask?.dueDate ?? todayISO);

  // Notification reminder — fires N minutes before the task's due time (or off).
  const deriveOffset = (): number | null => {
    if (!existingTask?.notifyAt) return null;
    if (existingTask.dueDate) {
      // Anytime tasks anchor the reminder to DEFAULT_REMINDER_TIME on the due date.
      const anchor = existingTask.dueTime ?? DEFAULT_REMINDER_TIME;
      const [h, m] = anchor.split(':').map(Number);
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
  const titleHasProfanity = containsProfanity(title);

  const handleSave = async () => {
    if (!title.trim()) {
      showPopup(t('addTask.titleRequired'), t('addTask.enterTaskTitle'));
      return;
    }
    // Flag bad words: block the save (task titles aren't masked elsewhere).
    if (containsProfanity(title.trim())) {
      showPopup(t('common.inappropriateLanguage'));
      return;
    }
    const dueDateValue = targetDate;
    const dueTimeValue = dueTimeEnabled ? dueTime : null;

    // Reminder fires `notifyOffset` minutes before the due date+time. Anytime tasks
    // (no due time) anchor the reminder to DEFAULT_REMINDER_TIME on the due date.
    let notifyAt: string | null = null;
    if (notifyOffset != null && dueDateValue) {
      const [h, m] = (dueTimeValue ?? DEFAULT_REMINDER_TIME).split(':').map(Number);
      const due = new Date(`${dueDateValue}T00:00:00`);
      due.setHours(h, m, 0, 0);
      notifyAt = new Date(due.getTime() - notifyOffset * 60000).toISOString();
      // A reminder in the past can't be scheduled (the OS silently drops it). This is
      // easy to hit with an Anytime task added later than the 9 AM anchor — so warn
      // instead of saving a reminder that never fires.
      if (new Date(notifyAt).getTime() <= Date.now()) {
        showPopup(t('addTask.reminderPastTitle'), t('addTask.reminderPastMsg'));
        return;
      }
    }

    // Cancel any previously scheduled reminder for this task.
    await cancelTaskNotification(existingTask?.notifId ?? null);

    // Repeats roll the task's day forward each matching weekday.
    const repeatDaysValue = repeatDays.length ? repeatDays : undefined;
    const repeatUntilValue = repeatDaysValue && repeatUntilEnabled ? repeatUntil.trim() || undefined : undefined;

    const titleVal = title.trim();
    const descriptionVal = description.trim() || undefined;
    const id = editing ? taskId! : addTask({
      title: titleVal,
      description: descriptionVal,
      subjectId,
      dueDate: dueDateValue,
      isDeadline,
      dueTime: dueTimeValue,
      estimatedMinutes: existingTask?.estimatedMinutes ?? null,
      priority: existingTask?.priority ?? 'medium',
      status: 'not_started',
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
      // Status isn't edited here — it's driven only by the checkmark on the task
      // list — so we leave the existing status untouched on save.
      updateTask(taskId!, { title: titleVal, description: descriptionVal, subjectId, dueDate: dueDateValue, isDeadline, dueTime: dueTimeValue, notifyAt, notifId, repeatDays: repeatDaysValue, repeatUntil: repeatUntilValue });
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
            {titleHasProfanity && (
              <ThemedText type="small" style={styles.profanityWarn}>
                {t('common.inappropriateLanguage')}
              </ThemedText>
            )}
          </ThemedView>

          {/* Description */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.descriptionOptional')}
            </ThemedText>
            <TextInput
              style={[...inputStyle, styles.descriptionInput]}
              placeholder={t('addTask.descriptionPlaceholder')}
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              textAlignVertical="top"
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
                    <ThemedText type="small">{localizeSubjectName(s.name, t)}</ThemedText>
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

          {/* Due? — the day itself is set by the tapped calendar cell; here you
              only choose whether it's a real deadline (Yes, drives the red dot) or
              just sits on that day (No). */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.dueThatDay')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateLabel(targetDate)}
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable
                onPress={() => setIsDeadline(true)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={isDeadline ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">{t('common.yes')}</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setIsDeadline(false)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={!isDeadline ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">{t('common.no')}</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
          </ThemedView>

          {/* Time — optional time of day on that date (default "Anytime"). */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.timeLabel')}
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable
                onPress={() => setDueTimeEnabled(true)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={dueTimeEnabled ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  {/* Show the picked time on the chip so the selected time is
                      obvious at a glance (not hidden until you scroll a wheel). */}
                  <ThemedText type="small">
                    {dueTimeEnabled ? formatTimeLabel(dueTime, use24HourTime) : t('addTask.pickTime')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setDueTimeEnabled(false)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={!dueTimeEnabled ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">{t('calendar.anytime')}</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
            {dueTimeEnabled && (
              <TimeWheelPicker value={dueTime} onChange={setDueTime} use24Hour={use24HourTime} />
            )}
          </ThemedView>

          {/* Repeat — choose which weekdays the task repeats on */}
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

          {/* Reminder notification — N minutes before the due time */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              {t('addTask.reminderOptional')}
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable onPress={() => setNotifyOffset(null)} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView type={notifyOffset == null ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                  <ThemedText type="small">{t('addTask.noReminder')}</ThemedText>
                </ThemedView>
              </Pressable>
              {REMINDER_OFFSETS.map((off) => (
                <Pressable key={off} onPress={() => setNotifyOffset(off)} style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedView type={notifyOffset === off ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                    <ThemedText type="small">{reminderLabel(off, t)}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
            {/* Anytime tasks have no due time, so the reminder counts back from a
                fixed time of day — tell the user when it fires. */}
            {!dueTimeEnabled && notifyOffset != null && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('addTask.reminderAnytimeHint', { time: formatTimeLabel(DEFAULT_REMINDER_TIME, use24HourTime) })}
              </ThemedText>
            )}
          </ThemedView>

          {/* Save */}
          <SoundPressable
            sound="confirm"
            disabled={titleHasProfanity}
            style={({ pressed }) => [styles.saveBtn, titleHasProfanity && styles.pressed, pressed && styles.pressed]}
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
  descriptionInput: { minHeight: 88 },
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
    backgroundColor: BakeryColors.buttonPink,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  saveBtnText: { color: BakeryColors.cocoaDark, fontSize: 15, fontWeight: '800' },
  profanityWarn: { color: '#C2536B', fontWeight: '700', marginTop: 2 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
});
