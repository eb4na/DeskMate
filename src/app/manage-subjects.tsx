import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { SUBJECT_COLORS } from '@/constants/placeholder-data';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function ManageSubjectsScreen() {
  const { subjects, addSubject, renameSubject, archiveSubject, deleteSubject, reorderSubjects } =
    useApp();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(SUBJECT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const activeSubjects = subjects
    .filter((s) => !s.archived)
    .sort((a, b) => a.order - b.order);
  const archivedSubjects = subjects.filter((s) => s.archived);

  const nextColor = (): string => {
    const used = subjects.map((s) => s.color);
    return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[activeSubjects.length % SUBJECT_COLORS.length];
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addSubject(newName.trim(), selectedColor, newEmoji.trim());
    setNewName('');
    setNewEmoji('');
    setSelectedColor(nextColor());
  };

  const handleRenameStart = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleRenameCommit = () => {
    if (editingId && editName.trim()) {
      renameSubject(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleMoveUp = (id: string) => {
    const sorted = [...activeSubjects];
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
    reorderSubjects(sorted.map((s) => s.id));
  };

  const handleMoveDown = (id: string) => {
    const sorted = [...activeSubjects];
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
    reorderSubjects(sorted.map((s) => s.id));
  };

  const handleArchive = (id: string, name: string) => {
    Alert.alert('Archive subject?', `"${name}" will be hidden from pickers but your study time is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () => archiveSubject(id) },
    ]);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete subject?', `"${name}" will be removed. Tasks linked to it won't be deleted but will lose the subject tag.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSubject(id) },
    ]);
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
            Subjects
          </ThemedText>

          {/* Active subjects list */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Your subjects
            </ThemedText>

            {activeSubjects.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No subjects yet. Add one below!
                </ThemedText>
              </ThemedView>
            )}

            {activeSubjects.map((sub, idx) => (
              <ThemedView key={sub.id} type="backgroundElement" style={styles.subjectRow}>
                {editingId === sub.id ? (
                  <TextInput
                    style={[inputStyle, styles.inlineInput]}
                    value={editName}
                    onChangeText={setEditName}
                    onBlur={handleRenameCommit}
                    onSubmitEditing={handleRenameCommit}
                    autoFocus
                  />
                ) : (
                  <Pressable style={styles.subjectInfo} onPress={() => handleRenameStart(sub.id, sub.name)}>
                    <ThemedView style={[styles.colorDot, { backgroundColor: sub.color }]} />
                    {sub.emoji ? <ThemedText style={styles.subjectEmoji}>{sub.emoji}</ThemedText> : null}
                    <ThemedText style={styles.subjectName}>{sub.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.editHint}>
                      tap to rename
                    </ThemedText>
                  </Pressable>
                )}

                <ThemedView style={styles.subjectActions}>
                  {/* Reorder */}
                  {idx > 0 && (
                    <Pressable style={styles.iconBtn} onPress={() => handleMoveUp(sub.id)}>
                      <ThemedText style={styles.iconBtnText}>↑</ThemedText>
                    </Pressable>
                  )}
                  {idx < activeSubjects.length - 1 && (
                    <Pressable style={styles.iconBtn} onPress={() => handleMoveDown(sub.id)}>
                      <ThemedText style={styles.iconBtnText}>↓</ThemedText>
                    </Pressable>
                  )}
                  <Pressable style={styles.iconBtn} onPress={() => handleArchive(sub.id, sub.name)}>
                    <ThemedText style={styles.iconBtnText}>📦</ThemedText>
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => handleDelete(sub.id, sub.name)}>
                    <ThemedText style={[styles.iconBtnText, styles.deleteText]}>✕</ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Add new subject */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Add new subject
            </ThemedText>

            <TextInput
              style={inputStyle}
              placeholder="Subject name"
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={newName}
              onChangeText={setNewName}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

            <TextInput
              style={inputStyle}
              placeholder="Emoji (optional, e.g. 📐)"
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={newEmoji}
              onChangeText={setNewEmoji}
            />

            {/* Color picker */}
            <ThemedView style={styles.colorGrid}>
              {SUBJECT_COLORS.map((color) => (
                <Pressable key={color} onPress={() => setSelectedColor(color)}>
                  <ThemedView
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorSwatchSelected,
                    ]}
                  />
                </Pressable>
              ))}
            </ThemedView>

            <Pressable
              style={({ pressed }) => [styles.addBtn, !newName.trim() && styles.addBtnDisabled, pressed && styles.pressed]}
              onPress={handleAdd}
              disabled={!newName.trim()}>
              <ThemedText type="smallBold" style={styles.addBtnText}>
                + Add subject
              </ThemedText>
            </Pressable>
          </ThemedView>

          {/* Archived subjects */}
          {archivedSubjects.length > 0 && (
            <ThemedView style={styles.section}>
              <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.archivedToggle}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {showArchived ? '▾' : '▸'} Archived ({archivedSubjects.length})
                </ThemedText>
              </Pressable>

              {showArchived &&
                archivedSubjects.map((sub) => (
                  <ThemedView key={sub.id} type="backgroundElement" style={styles.archivedRow}>
                    <ThemedView style={[styles.colorDot, { backgroundColor: sub.color, opacity: 0.5 }]} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.subjectName}>
                      {sub.name}
                    </ThemedText>
                    <Pressable style={styles.iconBtn} onPress={() => deleteSubject(sub.id)}>
                      <ThemedText style={[styles.iconBtnText, styles.deleteText]}>✕</ThemedText>
                    </Pressable>
                  </ThemedView>
                ))}
            </ThemedView>
          )}

          <Pressable onPress={() => router.back()} style={styles.doneBtn}>
            <ThemedText type="linkPrimary">Done</ThemedText>
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
  section: { gap: Spacing.two },
  sectionLabel: { fontSize: 13, marginBottom: 2 },
  emptyCard: { borderRadius: 14, padding: Spacing.three, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  subjectRow: {
    borderRadius: 14,
    padding: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  subjectInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  subjectEmoji: { fontSize: 16, lineHeight: 20 },
  subjectName: { flex: 1 },
  editHint: { fontSize: 11 },
  subjectActions: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 14 },
  deleteText: { color: '#E05C3A' },
  inlineInput: { flex: 1, paddingVertical: 6, fontSize: 14 },
  archivedRow: {
    borderRadius: 12,
    padding: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  archivedToggle: { paddingVertical: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#7C6F5A',
  },
  addBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#FFF' },
  pressed: { opacity: 0.8 },
  doneBtn: { alignItems: 'center', paddingVertical: Spacing.two },
});
