/**
 * Add / Edit task modal.
 * Pass ?taskId=xxx to enter edit mode; omit for create mode.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import type { TaskPriority, TaskStatus } from '@/context/app-context';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; emoji: string }[] = [
  { value: 'low', label: 'Low', emoji: '○' },
  { value: 'medium', label: 'Medium', emoji: '🟡' },
  { value: 'high', label: 'High', emoji: '🔴' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export default function AddTaskScreen() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { tasks, subjects, addTask, updateTask } = useApp();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const editing = !!taskId;
  const existingTask = editing ? tasks.find((t) => t.id === taskId) : undefined;

  const [title, setTitle] = useState(existingTask?.title ?? '');
  const [subjectId, setSubjectId] = useState<string | null>(existingTask?.subjectId ?? null);
  const [dueDate, setDueDate] = useState(existingTask?.dueDate ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    existingTask?.estimatedMinutes ? String(existingTask.estimatedMinutes) : '',
  );
  const [priority, setPriority] = useState<TaskPriority>(existingTask?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(existingTask?.status ?? 'not_started');

  useEffect(() => {
    if (editing && !existingTask) {
      router.back();
    }
  }, [editing, existingTask]);

  const activeSubjects = subjects.filter((s) => !s.archived);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }

    const estimatedNum = estimatedMinutes.trim()
      ? parseInt(estimatedMinutes.trim(), 10)
      : null;

    const dueDateValue = dueDate.trim() || null;

    if (editing) {
      updateTask(taskId!, { title: title.trim(), subjectId, dueDate: dueDateValue, estimatedMinutes: estimatedNum, priority, status });
    } else {
      addTask({
        title: title.trim(),
        subjectId,
        dueDate: dueDateValue,
        estimatedMinutes: estimatedNum,
        priority,
        status,
      });
    }

    router.back();
  };

  const inputStyle = [
    styles.input,
    { color: isDark ? '#fff' : '#000', borderColor: isDark ? '#444' : '#DDD', backgroundColor: isDark ? '#1A1A1A' : '#FAFAFA' },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            {editing ? 'Edit task' : 'Add task'}
          </ThemedText>

          {/* Title */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Task title *
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="What do you need to do?"
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
              Subject (optional)
            </ThemedText>
            <ThemedView style={styles.chipRow}>
              <Pressable
                onPress={() => setSubjectId(null)}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedView
                  type={subjectId === null ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">None</ThemedText>
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
            </ThemedView>
          </ThemedView>

          {/* Priority */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Priority
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
                    <ThemedText style={styles.chipEmoji}>{opt.emoji}</ThemedText>
                    <ThemedText type="small">{opt.label}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          {/* Status (edit mode only) */}
          {editing && (
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Status
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
                      <ThemedText type="small">{opt.label}</ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {/* Due date */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Due date (optional)
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={dueDate}
              onChangeText={setDueDate}
              keyboardType="numbers-and-punctuation"
            />
          </ThemedView>

          {/* Estimated time */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.label}>
              Estimated time (minutes, optional)
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g. 30"
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              keyboardType="numeric"
            />
          </ThemedView>

          {/* Save */}
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveBtnText}>
              {editing ? 'Save changes' : 'Add task'}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
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
    borderRadius: 12,
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
  chipEmoji: { fontSize: 14, lineHeight: 18 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  pressed: { opacity: 0.8 },
  saveBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  saveBtnText: { color: '#FFF', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
});
