import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { type AdvancedExamFields } from '@/context/app-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

function isValidFutureDate(dateStr: string): boolean {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d > new Date();
}

const CONFIDENCE_LABELS: Record<number, string> = {
  1: '😰 Very low',
  2: '😟 Low',
  3: '😐 Okay',
  4: '😊 Confident',
  5: '🚀 Very confident',
};

export default function AddExamScreen() {
  const { examCountdowns, addExam, isPlus, updateAdvancedExam } = useApp();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  // Plus advanced fields
  const [topics, setTopics] = useState('');
  const [targetHours, setTargetHours] = useState('');
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const canAdd = isPlus || examCountdowns.length < 3;

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedDate = date.trim();

    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter an exam name.');
      return;
    }
    if (!isValidFutureDate(trimmedDate)) {
      Alert.alert('Invalid date', 'Please enter a valid future date in YYYY-MM-DD format.');
      return;
    }
    if (!canAdd) {
      Alert.alert(
        'Limit reached',
        'Free users can track up to 3 exams. Upgrade to Plus for unlimited exam countdowns.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Plus features', onPress: () => router.push('/plus-upgrade') },
        ],
      );
      return;
    }

    const examId = addExam({
      name: trimmedName,
      subject: subject.trim(),
      dateISO: trimmedDate,
      reminderEnabled,
    });

    if (!examId) {
      Alert.alert(
        'Limit reached',
        'You can track up to 3 exams on the free tier. Upgrade to Plus for unlimited exams.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Plus features', onPress: () => router.push('/plus-upgrade') },
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
          Track an upcoming exam with a countdown.
          {isPlus && ' Plus: unlimited exams + advanced planning fields.'}
        </ThemedText>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">Exam name *</ThemedText>
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Physics Final"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="next"
            autoFocus
          />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">Subject (optional)</ThemedText>
          <TextInput
            style={inputStyle}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Physics"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="next"
          />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">Exam date *</ThemedText>
          <TextInput
            style={inputStyle}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Example: 2026-12-15
          </ThemedText>
        </ThemedView>

        {/* Reminder toggle */}
        <ThemedView type="backgroundElement" style={styles.reminderRow}>
          <ThemedView style={styles.reminderInfo}>
            <ThemedText type="smallBold">Reminder</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Get a nudge when this exam is close
            </ThemedText>
          </ThemedView>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ true: '#7C6F5A', false: undefined }}
          />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.noticeCard}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
            🛠 Push notifications will be wired to the device in a future update.
          </ThemedText>
        </ThemedView>

        {/* Plus advanced fields */}
        {isPlus ? (
          <ThemedView style={styles.advancedSection}>
            <Pressable
              onPress={() => setShowAdvanced((v) => !v)}
              style={styles.advancedToggle}>
              <ThemedText type="smallBold">Advanced planning (Plus)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {showAdvanced ? 'Hide ▲' : 'Show ▼'}
              </ThemedText>
            </Pressable>

            {showAdvanced && (
              <ThemedView style={styles.advancedFields}>
                <ThemedView style={styles.field}>
                  <ThemedText type="smallBold">Topics to cover</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={topics}
                    onChangeText={setTopics}
                    placeholder="e.g. Thermodynamics, Waves, Optics"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                  />
                </ThemedView>

                <ThemedView style={styles.field}>
                  <ThemedText type="smallBold">Target study hours</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={targetHours}
                    onChangeText={setTargetHours}
                    placeholder="e.g. 20"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                  />
                </ThemedView>

                <ThemedView style={styles.field}>
                  <ThemedText type="smallBold">Confidence level</ThemedText>
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
                    {CONFIDENCE_LABELS[confidence]}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        ) : examCountdowns.length >= 3 ? (
          <Pressable onPress={() => router.push('/plus-upgrade')}>
            <ThemedView type="backgroundElement" style={styles.upgradeCard}>
              <ThemedText type="small" style={styles.upgradeText}>
                🔒 Upgrade to Plus for unlimited exam countdowns and advanced planning
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        <ThemedView style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              Add countdown
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {isPlus
            ? `${examCountdowns.length} exam${examCountdowns.length !== 1 ? 's' : ''} tracked ✨ Plus — unlimited`
            : `${examCountdowns.length}/3 exam countdowns used`}
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
  reminderRow: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  reminderInfo: { flex: 1, gap: 2 },
  noticeCard: { borderRadius: 12, padding: Spacing.three },
  noticeText: { textAlign: 'center', lineHeight: 20 },
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
