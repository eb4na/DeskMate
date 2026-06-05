import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { BEFORE_SESSION_MOODS } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { setPendingDragSession } from '@/lib/drag-session';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Step = 'subject' | 'mood';

export default function SubjectPickerScreen() {
  const insets = useSafeAreaInsets();
  const { sessionLength, subjectId } = useLocalSearchParams<{ sessionLength: string; subjectId?: string }>();
  const { subjects } = useApp();

  const { t } = useTranslation();

  // Subject was already chosen on the session screen — this screen is mood only.
  const preSelectedSubject = subjectId
    ? subjects.find((s) => s.id === subjectId && !s.archived) ?? null
    : null;
  const pendingSubjectName = preSelectedSubject ? preSelectedSubject.name : null;

  const startSession = (
    moodValue: string | null,
    moodLabel: string | null,
  ) => {
    setPendingDragSession({
      durationMinutes: parseInt(sessionLength ?? '25', 10),
      subjectName: pendingSubjectName,
      taskId: null,
      taskTitle: null,
      moodValue,
      moodLabel,
    });
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  const handleMoodSelect = (value: string, label: string) => {
    startSession(value, label);
  };

  const handleSkipMood = () => {
    startSession(null, null);
  };

  return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sessionHint}>
              {sessionLength ? t('subjectPicker.session', { length: sessionLength }) : t('session.focusTime')}
            </ThemedText>

            <ThemedView style={styles.section}>
              <ThemedText type="default" style={styles.prompt}>
                {t('subjectPicker.moodTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('subjectPicker.moodSubtitle')}
              </ThemedText>
              <ThemedView style={styles.moodGrid}>
                {BEFORE_SESSION_MOODS.map((m) => (
                  <Pressable
                    key={m.value}
                    style={({ pressed }) => [styles.moodBtn, pressed && styles.buttonPressed]}
                    onPress={() => handleMoodSelect(m.value, m.label)}>
                    <ThemedView type="backgroundElement" style={styles.moodBtnInner}>
                      <Image source={m.image} style={styles.moodFace} contentFit="contain" />
                      <ThemedText type="small">{m.label}</ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ThemedView>
            </ThemedView>
          </SafeAreaView>
        </ScrollView>
        <ThemedView style={[styles.actions, { paddingBottom: insets.bottom + Spacing.two }]}>
          <Pressable onPress={handleSkipMood} style={styles.skipButton}>
            <ThemedText type="linkPrimary">{t('subjectPicker.skipMood')}</ThemedText>
          </Pressable>
        </ThemedView>
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
  sessionHint: { textAlign: 'center' },
  nudgeCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB74D',
  },
  nudgeEmoji: { fontSize: 24, lineHeight: 30 },
  nudgeText: { textAlign: 'center', lineHeight: 20 },
  nudgeLink: { paddingTop: 2 },
  nudgeLinkText: { fontSize: 13 },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prompt: { fontWeight: '600' },
  list: { gap: Spacing.two },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  subjectEmoji: { fontSize: 16, lineHeight: 20 },
  subjectName: { flex: 1 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
  },
  taskStatusIcon: { fontSize: 16, lineHeight: 20, color: '#7C6F5A' },
  taskTitle: { flex: 1 },
  emptySubjects: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center' },
  emptyLink: { fontSize: 14 },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  moodBtn: {
    width: '30%',
    flexGrow: 1,
  },
  moodBtnInner: {
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 12,
    gap: 4,
  },
  moodEmoji: { fontSize: 28, lineHeight: 36 },
  moodFace: { width: 48, height: 48 },
  buttonPressed: { opacity: 0.85 },
  actions: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  primaryButton: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF' },
  skipButton: { alignItems: 'center', paddingVertical: Spacing.two },
});
