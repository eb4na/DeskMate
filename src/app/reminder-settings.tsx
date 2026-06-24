import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, useColorScheme } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlusGateCard } from '@/components/plus-gate';
import { TimeWheelPicker, formatTimeLabel } from '@/components/time-wheel-picker';
import { getReminderStyleEffect } from '@/constants/shop-effects';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { type ReminderEntry } from '@/context/app-context';
import i18n, { useTranslation } from '@/i18n';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { syncStudyReminders } from '@/lib/notifications';
import {
  getCompanionReminderEmoji,
  getCompanionReminderLine,
  getCompanionReminderPool,
} from '@/constants/companion-reminder-lines';
import { localizeCompanionName, resolveActiveCompanion } from '@/lib/companion-utils';
import { type Task } from '@/context/app-context';

function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim());
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const MAX_EXTRA_REMINDERS = 4;
// How far ahead a task counts as "coming up" for the reminder body.
const UPCOMING_TASK_DAYS = 3;

function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateISO}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// The soonest unfinished task due within UPCOMING_TASK_DAYS, as a reminder line.
// Returns null when nothing is coming up (caller falls back to the companion line).
function buildUpcomingTaskLine(tasks: Task[]): string | null {
  const upcoming = tasks
    .filter((t) => t.status !== 'done' && t.dueDate)
    .map((t) => ({ t, days: daysUntil(t.dueDate as string) }))
    .filter(({ days }) => days >= 0 && days <= UPCOMING_TASK_DAYS)
    .sort((a, b) => a.days - b.days)[0];
  if (!upcoming) return null;
  const when = upcoming.days === 0
    ? i18n.t('reminder.when_today')
    : upcoming.days === 1
      ? i18n.t('reminder.when_tomorrow')
      : i18n.t('reminder.when_inDays', { days: upcoming.days });
  return i18n.t('reminder.taskDueLine', { title: upcoming.t.title, when });
}

export default function ReminderSettingsScreen() {
  const { t } = useTranslation();
  const {
    reminderEnabled,
    reminderTime,
    setReminder,
    isPlus,
    multipleReminders,
    setMultipleReminders,
    equippedShopItems,
    use24HourTime,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    tasks,
  } = useApp();
  const [enabled, setEnabled] = useState(reminderEnabled);
  const [time, setTime] = useState(reminderTime);
  // Plus extra reminders editing state
  const [reminders, setReminders] = useState<ReminderEntry[]>(multipleReminders);
  const [newTime, setNewTime] = useState('09:00');
  const [newLabel, setNewLabel] = useState('');
  const [newWeekdays, setNewWeekdays] = useState(false);
  const [saving, setSaving] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const reminderStyle = getReminderStyleEffect(equippedShopItems);

  // Reminder text comes from whoever is equipped — one voice per character,
  // regardless of outfit. The Chirp/Bells style only affects the sound.
  const voice = (() => {
    const resolved = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots);
    const companionKey =
      resolved.type === 'starter' ? 'bun' : resolved.type === 'shop' ? resolved.id : null;
    const emoji =
      resolved.type === 'slot'
        ? resolved.slot.emoji || ''
        : getCompanionReminderEmoji(companionKey);
    return { companionKey, name: localizeCompanionName(resolved.name, t), emoji };
  })();
  const reminderPool = getCompanionReminderPool(voice.companionKey);
  // Stable sample line for the screen (so it doesn't reshuffle on every render).
  const [previewLine] = useState(() => getCompanionReminderLine(voice.companionKey));
  // If a task is due within the next few days, the reminder names it instead.
  const taskLine = buildUpcomingTaskLine(tasks);

  const handleSave = async () => {
    if (enabled && !isValidTime(time)) return;

    setSaving(true);
    const trimmedTime = time.trim();
    const nextReminders = isPlus ? reminders : [];

    setReminder(enabled, trimmedTime);
    if (isPlus) {
      setMultipleReminders(reminders);
    }

    const syncResult = await syncStudyReminders({
      enabled,
      time: trimmedTime,
      extraReminders: nextReminders,
      reminderEmoji: voice.emoji,
      reminderLines: reminderPool,
      companionName: voice.name,
      taskLine: taskLine ?? undefined,
    });

    setSaving(false);

    if (!syncResult.granted) {
      showPopup(
        t('reminder.notifsOff'),
        t('reminder.notifsOffMsg'),
      );
    }

    router.back();
  };

  const handleAddReminder = () => {
    if (!isValidTime(newTime)) {
      showPopup(t('reminder.invalidTime'), t('reminder.enterHHMM'));
      return;
    }
    if (reminders.length >= MAX_EXTRA_REMINDERS) {
      showPopup(t('reminder.limit'), t('reminder.limitMsg', { max: MAX_EXTRA_REMINDERS }));
      return;
    }
    setReminders((prev) => [
      ...prev,
      {
        id: uid(),
        time: newTime.trim(),
        // Blank = let the companion (or upcoming task) supply the words.
        label: newLabel.trim(),
        weekdaysOnly: newWeekdays,
      },
    ]);
    setNewTime('');
    setNewLabel('');
    setNewWeekdays(false);
  };

  const handleRemoveReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: colors.text,
    fontSize: 20,
    textAlign: 'center' as const,
    letterSpacing: 4,
    opacity: enabled ? 1 : 0.4,
  };

  const smallInputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 15,
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          {/* Companion quote — a live sample of the next reminder. Shows the
              upcoming task when one's due soon, otherwise the equipped companion's line. */}
          <ThemedView type="backgroundElement" style={styles.quoteCard}>
            <ThemedText style={styles.quoteEmoji}>{voice.emoji}</ThemedText>
            <ThemedText type="default" style={styles.quoteText}>
              {taskLine ?? `"${previewLine}"`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              — {voice.name}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.noticeCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              {t('reminder.writtenBy', { name: voice.name })}
              {reminderStyle ? t('reminder.soundSet', { preview: reminderStyle.preview }) : ''}
            </ThemedText>
          </ThemedView>

          {/* Daily reminder toggle */}
          <ThemedView type="backgroundElement" style={styles.toggleRow}>
            <ThemedView type="transparent" style={styles.toggleInfo}>
              <ThemedText type="smallBold">{t('reminder.dailyReminder')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('reminder.dailyReminderHint')}
              </ThemedText>
            </ThemedView>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: '#7C6F5A', false: undefined }}
            />
          </ThemedView>

          {/* Time picker */}
          <ThemedView style={[styles.field, !enabled && styles.disabledField]}>
            <ThemedText type="smallBold">{t('reminder.reminderTime')}</ThemedText>
            <TimeWheelPicker value={time} onChange={setTime} use24Hour={use24HourTime} />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.noticeCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              {t('reminder.localNotice')}
            </ThemedText>
          </ThemedView>

          {/* Multiple reminders — Plus */}
          {isPlus ? (
            <ThemedView style={styles.section}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">
                  {t('reminder.extraReminders')}
                  <ThemedText style={styles.plusTag}>  Plus</ThemedText>
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {reminders.length}/{MAX_EXTRA_REMINDERS}
                </ThemedText>
              </ThemedView>

              {reminders.map((r) => (
                <ThemedView key={r.id} type="backgroundElement" style={styles.reminderRow}>
                  <ThemedView type="transparent" style={styles.reminderInfo}>
                    <ThemedText type="smallBold">{formatTimeLabel(r.time, use24HourTime)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {r.label?.trim() ? r.label : t('reminder.companionVoice', { name: voice.name })}
                      {r.weekdaysOnly ? t('reminder.weekdaysOnlySuffix') : ''}
                    </ThemedText>
                  </ThemedView>
                  <Pressable
                    onPress={() => handleRemoveReminder(r.id)}
                    style={styles.reminderDelete}>
                    <ThemedText type="small" themeColor="textSecondary">
                      ✕
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ))}

              {reminders.length < MAX_EXTRA_REMINDERS && (
                <ThemedView type="backgroundElement" style={styles.addReminderCard}>
                  <ThemedText type="smallBold" style={styles.addReminderTitle}>
                    {t('reminder.addReminder')}
                  </ThemedText>
                  <TimeWheelPicker value={newTime} onChange={setNewTime} use24Hour={use24HourTime} />
                  <TextInput
                    style={[smallInputStyle, styles.labelInput]}
                    value={newLabel}
                    onChangeText={setNewLabel}
                    placeholder={previewLine}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <ThemedView type="transparent" style={styles.weekdaysRow}>
                    <Switch
                      value={newWeekdays}
                      onValueChange={setNewWeekdays}
                      trackColor={{ true: '#7C6F5A', false: undefined }}
                    />
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('reminder.weekdaysOnly')}
                    </ThemedText>
                  </ThemedView>
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                    onPress={handleAddReminder}>
                    <ThemedText type="smallBold" style={styles.addBtnText}>
                      {t('common.add')}
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              )}
            </ThemedView>
          ) : (
            <PlusGateCard
              emoji=""
              title={t('reminder.multipleReminders')}
              description={t('reminder.multipleRemindersDesc')}
            />
          )}

          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={handleSave}
            disabled={saving}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {saving ? t('reminder.saving') : t('common.save')}
            </ThemedText>
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
  quoteCard: {
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  quoteEmoji: { fontSize: 32, lineHeight: 40 },
  quoteText: { textAlign: 'center', fontStyle: 'italic', lineHeight: 24 },
  toggleRow: {
    borderRadius: 16,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  toggleInfo: { flex: 1, gap: 2 },
  field: { gap: Spacing.two },
  disabledField: { opacity: 0.4 },
  error: { color: '#E05C3A', textAlign: 'center' },
  noticeCard: { borderRadius: 14, padding: Spacing.three },
  noticeText: { textAlign: 'center', lineHeight: 20 },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plusTag: { color: '#F5A623', fontSize: 12 },
  reminderRow: {
    borderRadius: 12,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reminderInfo: { flex: 1, gap: 2 },
  reminderDelete: { padding: Spacing.two },
  addReminderCard: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  addReminderTitle: { fontSize: 14 },
  addRow: { flexDirection: 'row', gap: Spacing.two },
  timeInput: { width: 80 },
  labelInput: { flex: 1 },
  weekdaysRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 10,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  addBtnText: { color: '#FFF', fontSize: 14 },
  pressed: { opacity: 0.85 },
  saveBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16 },
});
