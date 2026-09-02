import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { SoundPressable } from '@/components/sound-pressable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateWheelPicker, getTodayISO } from '@/components/date-wheel-picker';
import { TimeWheelPicker } from '@/components/time-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp, MAX_EXAMS } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { requestNotificationPermission } from '@/lib/notifications';
import { localizeSubjectName } from '@/lib/subject-utils';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function isValidDateISO(dateStr: string): boolean {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return true;
}

export default function AddExamScreen() {
  const { t } = useTranslation();
  const { examCountdowns, addExam, updateExam, use24HourTime, subjects } = useApp();
  const activeSubjects = subjects.filter((s) => !s.archived);

  // When opened with ?examId=… we're editing an existing countdown; pre-fill from it.
  const { examId: examIdParam } = useLocalSearchParams<{ examId?: string }>();
  const existing = examIdParam ? examCountdowns.find((e) => e.id === examIdParam) : undefined;
  const editing = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [date, setDate] = useState(existing?.dateISO ?? getTodayISO());
  const [time, setTime] = useState(existing?.time ?? '09:00');
  const [reminderEnabled, setReminderEnabled] = useState(existing?.reminderEnabled ?? false);
  // Inline validation error. This screen is a native modal, so a root showPopup
  // can't present over it (the tap looked dead — "can't add"). Show the reason here.
  const [error, setError] = useState<string | null>(null);
  const colors = useTheme();

  // Editing never adds a row, so the cap can't block a save. The cap is the same
  // for everyone — exam countdowns aren't a Plus perk.
  const canAdd = editing || examCountdowns.length < MAX_EXAMS;

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedDate = date.trim();
    setError(null);

    if (!trimmedName) {
      setError(t('addExam.enterExamName'));
      return;
    }
    if (!isValidDateISO(trimmedDate)) {
      setError(t('addExam.chooseValidDate'));
      return;
    }
    if (!canAdd) {
      // At the cap — say so inline (no paywall; the cap isn't a Plus gate).
      setError(t('addExam.limitReached'));
      return;
    }

    const fields = {
      name: trimmedName,
      subject: subject.trim(),
      dateISO: trimmedDate,
      time,
      reminderEnabled,
    };

    const examId = editing ? existing!.id : addExam(fields);

    if (!examId) {
      // Only happens if the cap was hit between the check above and the write.
      setError(t('addExam.limitReached'));
      return;
    }

    if (editing) updateExam(examId, fields);

    // Reminders are scheduled by app-context's exam sync; the only missing piece
    // is the system permission, which we may only request on explicit opt-in.
    if (reminderEnabled) void requestNotificationPermission();

    router.back();
  };

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: colors.text,
    fontSize: 16,
  };

  // Keyboard spacer — see the Animated.View at the end of the form.
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();
  const kbSpacer = useAnimatedStyle(() => ({
    height: Math.max(keyboard.height.value - insets.bottom, 0),
  }));

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // Tapping a chip/date row while the keyboard is up should work on the FIRST
        // tap, not just dismiss the keyboard.
        keyboardShouldPersistTaps="handled"
        // iOS scrolls the focused field above the keyboard on its own once the
        // scroll view knows the keyboard's inset; the animated spacer at the end
        // of the content gives it somewhere to scroll TO on the last few fields.
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="always">
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
            {t('addExam.hint')}
          </ThemedText>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('addExam.examNameReq')}</ThemedText>
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder={t('addExam.examNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={40}
            returnKeyType="next"
            autoFocus
          />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('addExam.subjectOptional')}</ThemedText>
          <ThemedView style={styles.chipRow}>
            <Pressable onPress={() => setSubject('')} style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedView
                type={subject === '' ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.chip}>
                <ThemedText type="small">{t('addExam.none')}</ThemedText>
              </ThemedView>
            </Pressable>
            {activeSubjects.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSubject(s.name === subject ? '' : s.name)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={subject === s.name ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedView style={[styles.subjectDot, { backgroundColor: s.color }]} />
                  <ThemedText type="small">{localizeSubjectName(s.name, t)}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/manage-subjects')} style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={[styles.chip, styles.addSubjectChip]}>
                <ThemedText type="smallBold" style={styles.addSubjectChipText}>{t('addExam.newSubject')}</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('addExam.examDateReq')}</ThemedText>
          {/* Past dates are allowed for everyone (count-up / keeping a past exam);
              past-due countdowns are no longer erased. */}
          <DateWheelPicker value={date} onChange={setDate} />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('addExam.examTime')}</ThemedText>
          <TimeWheelPicker value={time} onChange={setTime} use24Hour={use24HourTime} />
        </ThemedView>

        {/* Reminder toggle */}
        <ThemedView type="backgroundElement" style={styles.reminderRow}>
          <ThemedView type="transparent" style={styles.reminderInfo}>
            <ThemedText type="smallBold">{t('addExam.reminder')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('addExam.reminderHint')}
            </ThemedText>
          </ThemedView>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ true: '#7C6F5A', false: undefined }}
          />
        </ThemedView>

        {/* At the cap (same for everyone) — a plain notice, not an upsell. */}
        {!editing && examCountdowns.length >= MAX_EXAMS ? (
          <ThemedView type="backgroundElement" style={[styles.upgradeCard, styles.noticeRow]}>
            <ThemedText type="small" style={styles.upgradeText}>
              {t('addExam.limitReached')}
            </ThemedText>
          </ThemedView>
        ) : null}

        <ThemedView style={styles.actions}>
          {error ? <ThemedText type="small" style={styles.errorText}>{error}</ThemedText> : null}
          <SoundPressable
            sound="confirm"
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {editing ? t('addExam.saveChanges') : t('addExam.addCountdown')}
            </ThemedText>
          </SoundPressable>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <ThemedText type="linkPrimary">{t('common.cancel')}</ThemedText>
          </Pressable>
        </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('addExam.countdownsUsed', { count: examCountdowns.length, max: MAX_EXAMS })}
          </ThemedText>
          {/* Grows to exactly the keyboard's height so the last fields can always be
              scrolled clear of it. KeyboardAvoidingView is deliberately NOT used —
              it under-pads inside an iOS card modal, which is what this screen is.
              Same spacer as dm-chat / companion-chat. */}
          <Animated.View style={kbSpacer} />
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  hint: { lineHeight: 22 },
  field: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 12,
  },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  addSubjectChip: { borderWidth: 1, borderColor: '#D9C5B2', borderStyle: 'dashed' },
  addSubjectChipText: { color: '#7A5240' },
  pressed: { opacity: 0.8 },
  reminderRow: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  reminderInfo: { flex: 1, gap: 2 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actions: { gap: Spacing.three, marginTop: Spacing.two },
  saveBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16 },
  errorText: { color: '#C0392B', fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  note: { textAlign: 'center' },
  upgradeCard: {
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.3)',
    borderStyle: 'dashed',
  },
  upgradeText: { color: '#F5A623', textAlign: 'center', lineHeight: 20 },
});
