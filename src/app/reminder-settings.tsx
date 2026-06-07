import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlusGateCard } from '@/components/plus-gate';
import { TimeWheelPicker, formatTimeLabel } from '@/components/time-wheel-picker';
import { getReminderStyleEffect } from '@/constants/shop-effects';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { type ReminderEntry } from '@/context/app-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { syncStudyReminders } from '@/lib/notifications';
import {
  getCompanionReminderLine,
  getCompanionReminderPool,
} from '@/constants/companion-reminder-lines';
import {
  BUN_SKINS,
  getCompanionSkins,
  getEffectiveBunSkinId,
  getEffectiveCompanionSkins,
  resolveActiveCompanion,
} from '@/lib/companion-utils';

function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim());
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const MAX_EXTRA_REMINDERS = 4;

export default function ReminderSettingsScreen() {
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
    bunSkinId,
    companionSkins,
    ownedShopItems,
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

  // Reminder text comes from whoever is equipped: the active companion + the
  // skin they're currently wearing. The Chirp/Bells style only affects the
  // notification sound, so it doesn't drive the words.
  const voice = (() => {
    const resolved = resolveActiveCompanion(
      activeCompanionId,
      defaultCompanionId,
      companionSlots,
      bunSkinId,
      companionSkins,
    );
    if (resolved.type === 'starter') {
      const skinId = getEffectiveBunSkinId(bunSkinId, ownedShopItems);
      const emoji = BUN_SKINS.find((s) => s.id === skinId)?.emoji ?? '🍓';
      return { companionKey: 'bun', skinId, name: resolved.name, emoji };
    }
    if (resolved.type === 'shop') {
      const skinId = getEffectiveCompanionSkins(companionSkins, ownedShopItems)[activeCompanionId] ?? 'classic';
      const emoji = getCompanionSkins(activeCompanionId).find((s) => s.id === skinId)?.emoji ?? '🔔';
      return { companionKey: resolved.id, skinId, name: resolved.name, emoji };
    }
    // Custom AI slot — no skins; fall back to the generic pool.
    return { companionKey: null, skinId: null, name: resolved.name, emoji: resolved.slot.emoji || '🔔' };
  })();
  const reminderPool = getCompanionReminderPool(voice.companionKey, voice.skinId);
  const previewLine = getCompanionReminderLine(voice.companionKey, voice.skinId);

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
    });

    setSaving(false);

    if (!syncResult.granted) {
      Alert.alert(
        'Notifications are off',
        'Your reminder settings were saved, but this device has not granted notification permission yet.',
      );
    }

    router.back();
  };

  const handleAddReminder = () => {
    if (!isValidTime(newTime)) {
      Alert.alert('Invalid time', 'Please enter HH:MM format.');
      return;
    }
    if (reminders.length >= MAX_EXTRA_REMINDERS) {
      Alert.alert('Limit', `You can add up to ${MAX_EXTRA_REMINDERS} extra reminders.`);
      return;
    }
    setReminders((prev) => [
      ...prev,
      {
        id: uid(),
        time: newTime.trim(),
        label: newLabel.trim() || 'Study time',
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
          {/* Companion quote — a live sample in the equipped companion's voice + outfit */}
          <ThemedView type="backgroundElement" style={styles.quoteCard}>
            <ThemedText style={styles.quoteEmoji}>{voice.emoji}</ThemedText>
            <ThemedText type="default" style={styles.quoteText}>
              {`"${previewLine}"`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              — {voice.name}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.noticeCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              Reminders are written by your active companion and the outfit they’re wearing — change
              it anytime in the Companion Bakery.
              {reminderStyle ? ` ${reminderStyle.preview} sets the sound.` : ''}
            </ThemedText>
          </ThemedView>

          {/* Daily reminder toggle */}
          <ThemedView type="backgroundElement" style={styles.toggleRow}>
            <ThemedView style={styles.toggleInfo}>
              <ThemedText type="smallBold">Daily reminder</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Get a nudge to study each day
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
            <ThemedText type="smallBold">Reminder time</ThemedText>
            <TimeWheelPicker value={time} onChange={setTime} use24Hour={use24HourTime} />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.noticeCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              Local study reminders can now be scheduled on this device. Keep notifications enabled
              if you want the nudges to appear.
            </ThemedText>
          </ThemedView>

          {/* Multiple reminders — Plus */}
          {isPlus ? (
            <ThemedView style={styles.section}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">
                  Extra reminders
                  <ThemedText style={styles.plusTag}> ✨ Plus</ThemedText>
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {reminders.length}/{MAX_EXTRA_REMINDERS}
                </ThemedText>
              </ThemedView>

              {reminders.map((r) => (
                <ThemedView key={r.id} type="backgroundElement" style={styles.reminderRow}>
                  <ThemedView style={styles.reminderInfo}>
                    <ThemedText type="smallBold">{formatTimeLabel(r.time, use24HourTime)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {r.label}
                      {r.weekdaysOnly ? ' · Weekdays only' : ''}
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
                    + Add reminder
                  </ThemedText>
                  <TimeWheelPicker value={newTime} onChange={setNewTime} use24Hour={use24HourTime} />
                  <TextInput
                    style={[smallInputStyle, styles.labelInput]}
                    value={newLabel}
                    onChangeText={setNewLabel}
                    placeholder="Label (optional)"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <ThemedView style={styles.weekdaysRow}>
                    <Switch
                      value={newWeekdays}
                      onValueChange={setNewWeekdays}
                      trackColor={{ true: '#7C6F5A', false: undefined }}
                    />
                    <ThemedText type="small" themeColor="textSecondary">
                      Weekdays only
                    </ThemedText>
                  </ThemedView>
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                    onPress={handleAddReminder}>
                    <ThemedText type="smallBold" style={styles.addBtnText}>
                      Add
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              )}
            </ThemedView>
          ) : (
            <PlusGateCard
              emoji="🔔"
              title="Multiple reminders"
              description="Set different reminders for weekdays vs weekends, or add a morning planning reminder."
            />
          )}

          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={handleSave}
            disabled={saving}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Save'}
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
