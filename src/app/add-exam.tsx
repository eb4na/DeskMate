import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BakeryWrenchEmoji } from '@/components/bakery-emoji';
import { LockBadge } from '@/components/lock-badge';
import { CountdownShape, COUNTDOWN_SHAPES, DEFAULT_COUNTDOWN_SHAPE, type CountdownShapeKey } from '@/components/countdown-shapes';
import { DateWheelPicker, getTodayISO } from '@/components/date-wheel-picker';
import { TimeWheelPicker } from '@/components/time-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { type AdvancedExamFields } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

function isValidDateISO(dateStr: string): boolean {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return true;
}

const CONFIDENCE_LABEL_KEYS: Record<number, string> = {
  1: 'addExam.conf1',
  2: 'addExam.conf2',
  3: 'addExam.conf3',
  4: 'addExam.conf4',
  5: 'addExam.conf5',
};

export default function AddExamScreen() {
  const { t } = useTranslation();
  const { examCountdowns, addExam, isPlus, updateAdvancedExam, use24HourTime, subjects } = useApp();
  const activeSubjects = subjects.filter((s) => !s.archived);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [time, setTime] = useState('09:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [shape, setShape] = useState<CountdownShapeKey>(DEFAULT_COUNTDOWN_SHAPE);
  // Plus advanced fields
  const [topics, setTopics] = useState('');
  const [targetHours, setTargetHours] = useState('');
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const canAdd = isPlus || examCountdowns.length < 2;

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedDate = date.trim();

    if (!trimmedName) {
      Alert.alert(t('addExam.missingName'), t('addExam.enterExamName'));
      return;
    }
    if (!isValidDateISO(trimmedDate)) {
      Alert.alert(t('addExam.invalidDate'), t('addExam.chooseValidDate'));
      return;
    }
    if (!canAdd) {
      Alert.alert(
        t('addExam.limitReached'),
        t('addExam.limitMsgFree'),
        [
          { text: t('addExam.notNow'), style: 'cancel' },
          { text: t('addExam.seePlusFeatures'), onPress: () => router.push('/plus-upgrade') },
        ],
      );
      return;
    }

    const examId = addExam({
      name: trimmedName,
      subject: subject.trim(),
      dateISO: trimmedDate,
      time,
      reminderEnabled,
      shape,
    });

    if (!examId) {
      Alert.alert(
        t('addExam.limitReached'),
        t('addExam.limitMsgTier'),
        [
          { text: t('addExam.notNow'), style: 'cancel' },
          { text: t('addExam.seePlusFeatures'), onPress: () => router.push('/plus-upgrade') },
        ],
      );
      return;
    }

    if (isPlus && (topics.trim() || targetHours || confidence !== 3)) {
      const advanced: AdvancedExamFields = {
        topics: topics.trim(),
        targetHours: targetHours ? parseInt(targetHours, 10) : null,
        confidenceLevel: confidence,
      };
      updateAdvancedExam(examId, advanced);
    }

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

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
            {t('addExam.hint')}
            {isPlus && t('addExam.hintPlus')}
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
                  <ThemedText type="small">{s.name}</ThemedText>
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
          <ThemedText type="smallBold">{t('addExam.shape')}</ThemedText>
          <ThemedView style={styles.chipRow}>
            {COUNTDOWN_SHAPES.map((sh) => (
              <Pressable
                key={sh}
                onPress={() => setShape(sh)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={shape === sh ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.shapeBtn}>
                  <CountdownShape shape={sh} size={26} />
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('addExam.examDateReq')}</ThemedText>
          <DateWheelPicker value={date} onChange={setDate} minimumDateISO={getTodayISO()} />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('addExam.examTime')}</ThemedText>
          <TimeWheelPicker value={time} onChange={setTime} use24Hour={use24HourTime} />
        </ThemedView>

        {/* Reminder toggle */}
        <ThemedView type="backgroundElement" style={styles.reminderRow}>
          <ThemedView style={styles.reminderInfo}>
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

        <ThemedView type="backgroundElement" style={[styles.noticeCard, styles.noticeRow]}>
          <BakeryWrenchEmoji size={16} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
            {t('addExam.pushNotice')}
          </ThemedText>
        </ThemedView>

        {/* Plus advanced fields */}
        {isPlus ? (
          <ThemedView style={styles.advancedSection}>
            <Pressable
              onPress={() => setShowAdvanced((v) => !v)}
              style={styles.advancedToggle}>
              <ThemedText type="smallBold">{t('addExam.advancedPlanning')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {showAdvanced ? t('addExam.hide') : t('addExam.show')}
              </ThemedText>
            </Pressable>

            {showAdvanced && (
              <ThemedView style={styles.advancedFields}>
                <ThemedView style={styles.field}>
                  <ThemedText type="smallBold">{t('addExam.topicsToCover')}</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={topics}
                    onChangeText={setTopics}
                    placeholder={t('addExam.topicsPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    maxLength={200}
                    multiline
                  />
                </ThemedView>

                <ThemedView style={styles.field}>
                  <ThemedText type="smallBold">{t('addExam.targetHours')}</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={targetHours}
                    onChangeText={setTargetHours}
                    placeholder={t('addExam.targetHoursPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </ThemedView>

                <ThemedView style={styles.field}>
                  <ThemedText type="smallBold">{t('addExam.confidenceLevel')}</ThemedText>
                  <ThemedView style={styles.confidenceRow}>
                    {([1, 2, 3, 4, 5] as const).map((level) => (
                      <Pressable
                        key={level}
                        onPress={() => setConfidence(level)}
                        style={[
                          styles.confidenceBtn,
                          confidence === level && styles.confidenceBtnActive,
                        ]}>
                        <ThemedText style={styles.confidenceNum}>{level}</ThemedText>
                      </Pressable>
                    ))}
                  </ThemedView>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(CONFIDENCE_LABEL_KEYS[confidence])}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        ) : examCountdowns.length >= 3 ? (
          <Pressable onPress={() => router.push('/plus-upgrade')}>
            <ThemedView type="backgroundElement" style={[styles.upgradeCard, styles.noticeRow]}>
              <LockBadge size={16} />
              <ThemedText type="small" style={styles.upgradeText}>
                {t('addExam.upgradeUnlimited')}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        <ThemedView style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {t('addExam.addCountdown')}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <ThemedText type="linkPrimary">{t('common.cancel')}</ThemedText>
          </Pressable>
        </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {isPlus
              ? t('addExam.examsTrackedPlus', { count: examCountdowns.length })
              : t('addExam.countdownsUsed', { count: examCountdowns.length })}
          </ThemedText>
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
  shapeBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  noticeCard: { borderRadius: 12, padding: Spacing.three },
  noticeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noticeText: { textAlign: 'center', lineHeight: 20, flexShrink: 1 },
  actions: { gap: Spacing.three, marginTop: Spacing.two },
  saveBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  note: { textAlign: 'center' },
  advancedSection: { gap: Spacing.two },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  advancedFields: { gap: Spacing.three },
  confidenceRow: { flexDirection: 'row', gap: Spacing.two },
  confidenceBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  confidenceBtnActive: { borderColor: '#7C6F5A', backgroundColor: 'rgba(124,111,90,0.1)' },
  confidenceNum: { fontSize: 18, fontWeight: '700' },
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
