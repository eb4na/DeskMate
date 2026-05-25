import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import type { Task } from '@/context/app-context';
import { BEFORE_SESSION_MOODS } from '@/constants/placeholder-data';
import type { BeforeMoodValue } from '@/constants/placeholder-data';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Step = 'subject' | 'task';

export default function SubjectPickerScreen() {
  const { sessionLength } = useLocalSearchParams<{ sessionLength: string }>();
  const { subjects, tasks, addMoodEntry, incrementSkipSubjectCount, resetSkipSubjectCount, skipSubjectCount } =
    useApp();

  const [step, setStep] = useState<Step>('subject');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<BeforeMoodValue | null>(null);

  const activeSubjects = subjects
    .filter((s) => !s.archived)
    .sort((a, b) => a.order - b.order);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;

  // Tasks for the selected subject that are not done
  const subjectTasks: Task[] = selectedSubjectId
    ? tasks.filter((t) => t.subjectId === selectedSubjectId && t.status !== 'done')
    : [];

  const recordMoodAndNavigate = (subjectName: string | null, taskId: string | null, taskTitle: string | null) => {
    if (selectedMood) {
      const moodOption = BEFORE_SESSION_MOODS.find((m) => m.value === selectedMood);
      if (moodOption) {
        addMoodEntry({
          value: selectedMood,
          label: moodOption.label,
          type: 'before',
          sessionMinutes: parseInt(sessionLength ?? '25', 10),
          timestamp: new Date().toISOString(),
        });
      }
    }

    router.replace({
      pathname: '/session',
      params: {
        sessionLength: sessionLength ?? '25',
        subject: subjectName ?? '',
        taskId: taskId ?? '',
        taskTitle: taskTitle ?? '',
      },
    });
  };

  const handleSkipSubject = () => {
    incrementSkipSubjectCount();
    recordMoodAndNavigate(null, null, null);
  };

  const handleStartWithSubject = () => {
    if (!selectedSubjectId) {
      handleSkipSubject();
      return;
    }
    if (subjectTasks.length > 0) {
      setStep('task');
    } else {
      resetSkipSubjectCount();
      recordMoodAndNavigate(selectedSubject?.name ?? null, null, null);
    }
  };

  const handleStartWithTask = () => {
    const task = tasks.find((t) => t.id === selectedTaskId) ?? null;
    resetSkipSubjectCount();
    recordMoodAndNavigate(selectedSubject?.name ?? null, task?.id ?? null, task?.title ?? null);
  };

  const handleSkipTask = () => {
    resetSkipSubjectCount();
    recordMoodAndNavigate(selectedSubject?.name ?? null, null, null);
  };

  if (step === 'task') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView>
          <SafeAreaView style={styles.safeArea}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sessionHint}>
              {sessionLength ? `${sessionLength} minute session` : 'Study session'} ·{' '}
              <ThemedText type="small" style={{ color: selectedSubject?.color }}>
                {selectedSubject?.name}
              </ThemedText>
            </ThemedText>

            <ThemedView style={styles.section}>
              <ThemedText type="default" style={styles.prompt}>
                Pick a task (optional)
              </ThemedText>
              <ThemedView style={styles.list}>
                {subjectTasks.map((t) => {
                  const isSelected = selectedTaskId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setSelectedTaskId(isSelected ? null : t.id)}>
                      <ThemedView
                        type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.taskRow}>
                        <ThemedText style={styles.taskStatusIcon}>
                          {t.status === 'in_progress' ? '◑' : '○'}
                        </ThemedText>
                        <ThemedText type="default" style={styles.taskTitle} numberOfLines={2}>
                          {t.title}
                        </ThemedText>
                        {isSelected && <ThemedText>✓</ThemedText>}
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                onPress={handleStartWithTask}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {selectedTaskId ? 'Start session' : 'Start without task'}
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleSkipTask} style={styles.skipButton}>
                <ThemedText type="linkPrimary">Skip for now</ThemedText>
              </Pressable>
            </ThemedView>
          </SafeAreaView>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sessionHint}>
            {sessionLength ? `${sessionLength} minute session` : 'Study session'}
          </ThemedText>

          {/* Skip nudge (after 3 skips) */}
          {skipSubjectCount >= 3 && (
            <ThemedView type="backgroundElement" style={styles.nudgeCard}>
              <ThemedText style={styles.nudgeEmoji}>💡</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.nudgeText}>
                Want to add subjects so your progress reports look better?
              </ThemedText>
              <Pressable onPress={() => router.push('/manage-subjects')} style={styles.nudgeLink}>
                <ThemedText type="linkPrimary" style={styles.nudgeLinkText}>
                  Manage subjects →
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {/* Subject selection */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="default" style={styles.prompt}>
                Pick a subject (optional)
              </ThemedText>
              <Pressable onPress={() => router.push('/manage-subjects')}>
                <ThemedText type="small" themeColor="textSecondary">
                  Manage →
                </ThemedText>
              </Pressable>
            </ThemedView>

            {activeSubjects.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptySubjects}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No subjects yet.{' '}
                </ThemedText>
                <Pressable onPress={() => router.push('/manage-subjects')}>
                  <ThemedText type="linkPrimary" style={styles.emptyLink}>Add one →</ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <ThemedView style={styles.list}>
                {activeSubjects.map((s) => {
                  const isSelected = selectedSubjectId === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedSubjectId(isSelected ? null : s.id)}>
                      <ThemedView
                        type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.subjectRow}>
                        <ThemedView style={[styles.colorDot, { backgroundColor: s.color }]} />
                        {s.emoji ? (
                          <ThemedText style={styles.subjectEmoji}>{s.emoji}</ThemedText>
                        ) : null}
                        <ThemedText type="default" style={styles.subjectName}>
                          {s.name}
                        </ThemedText>
                        {isSelected && (
                          <ThemedText type="small" style={{ color: s.color }}>✓</ThemedText>
                        )}
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>
            )}
          </ThemedView>

          {/* Before-session mood */}
          <ThemedView style={styles.section}>
            <ThemedText type="default" style={styles.prompt}>
              How are you feeling? (optional)
            </ThemedText>
            <ThemedView style={styles.moodGrid}>
              {BEFORE_SESSION_MOODS.map((mood) => {
                const isSelected = selectedMood === mood.value;
                return (
                  <Pressable
                    key={mood.value}
                    style={({ pressed }) => [pressed && styles.buttonPressed]}
                    onPress={() => setSelectedMood(isSelected ? null : mood.value)}>
                    <ThemedView
                      type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.moodBtn}>
                      <ThemedText style={styles.moodEmoji}>{mood.emoji}</ThemedText>
                      <ThemedText type="small">{mood.label}</ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </ThemedView>
          </ThemedView>

          {/* Actions */}
          <ThemedView style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={handleStartWithSubject}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {selectedSubjectId ? `Study ${selectedSubject?.name}` : 'Start Session'}
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleSkipSubject} style={styles.skipButton}>
              <ThemedText type="linkPrimary">Skip subject for now</ThemedText>
            </Pressable>
          </ThemedView>
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
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 12,
    gap: 4,
    minWidth: 76,
  },
  moodEmoji: { fontSize: 28, lineHeight: 36 },
  buttonPressed: { opacity: 0.85 },
  actions: { gap: Spacing.two, paddingTop: Spacing.two },
  primaryButton: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF' },
  skipButton: { alignItems: 'center', paddingVertical: Spacing.two },
});
