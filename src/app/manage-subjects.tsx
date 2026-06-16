import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ArrowUpIcon, ArrowDownIcon, RemoveIcon } from '@/components/subject-icons';
import { useApp, MAX_SUBJECTS_FREE, MAX_SUBJECTS_PLUS } from '@/context/app-context';
import { SUBJECT_COLORS } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function ManageSubjectsScreen() {
  const { t } = useTranslation();
  const { subjects, addSubject, renameSubject, deleteSubject, reorderSubjects, isPlus } =
    useApp();
  const subjectLimit = isPlus ? MAX_SUBJECTS_PLUS : MAX_SUBJECTS_FREE;
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(SUBJECT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const activeSubjects = subjects
    .filter((s) => !s.archived)
    .sort((a, b) => a.order - b.order);

  const nextColor = (): string => {
    const used = subjects.map((s) => s.color);
    return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[activeSubjects.length % SUBJECT_COLORS.length];
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const added = addSubject(newName.trim(), selectedColor, newEmoji.trim());
    if (!added) {
      showPopup(
        t('manageSubjects.subjectLimitReached'),
        isPlus
          ? t('manageSubjects.limitMsgPlus', { max: MAX_SUBJECTS_PLUS })
          : t('manageSubjects.limitMsgFree', { free: MAX_SUBJECTS_FREE, plus: MAX_SUBJECTS_PLUS }),
      );
      return;
    }
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

  const handleDelete = (id: string, name: string) => {
    showPopup(t('manageSubjects.deleteSubjectQ'), t('manageSubjects.deleteMsg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteSubject(id) },
    ]);
  };

  const inputStyle = [
    styles.input,
    { color: isDark ? '#fff' : '#000', borderColor: isDark ? '#444' : '#DDD', backgroundColor: isDark ? '#1A1A1A' : '#FAFAFA' },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            {t('manageSubjects.title')}
          </ThemedText>

          {/* Active subjects list */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              {t('manageSubjects.yourSubjects', { count: activeSubjects.length, limit: subjectLimit })}
            </ThemedText>

            {activeSubjects.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('manageSubjects.noSubjectsBelow')}
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
                    maxLength={30}
                    autoFocus
                  />
                ) : (
                  <Pressable style={styles.subjectInfo} onPress={() => handleRenameStart(sub.id, sub.name)}>
                    <ThemedView style={[styles.colorDot, { backgroundColor: sub.color }]} />
                    {sub.emoji ? <ThemedText style={styles.subjectEmoji}>{sub.emoji}</ThemedText> : null}
                    <ThemedText style={styles.subjectName}>{sub.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.editHint}>
                      {t('manageSubjects.tapToRename')}
                    </ThemedText>
                  </Pressable>
                )}

                <ThemedView style={styles.subjectActions}>
                  {/* Reorder */}
                  {idx > 0 && (
                    <Pressable style={styles.iconBtn} onPress={() => handleMoveUp(sub.id)}>
                      <ArrowUpIcon />
                    </Pressable>
                  )}
                  {idx < activeSubjects.length - 1 && (
                    <Pressable style={styles.iconBtn} onPress={() => handleMoveDown(sub.id)}>
                      <ArrowDownIcon />
                    </Pressable>
                  )}
                  <Pressable style={styles.iconBtn} onPress={() => handleDelete(sub.id, sub.name)}>
                    <RemoveIcon />
                  </Pressable>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Add new subject */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              {t('manageSubjects.addNewSubject')}
            </ThemedText>

            <TextInput
              style={inputStyle}
              placeholder={t('manageSubjects.subjectNamePlaceholder')}
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={newName}
              onChangeText={setNewName}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

            <TextInput
              style={inputStyle}
              placeholder={t('manageSubjects.emojiPlaceholder')}
              placeholderTextColor={isDark ? '#666' : '#AAA'}
              value={newEmoji}
              onChangeText={setNewEmoji}
              maxLength={2}
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
              style={({ pressed }) => [styles.addBtn, (!newName.trim() || activeSubjects.length >= subjectLimit) && styles.addBtnDisabled, pressed && styles.pressed]}
              onPress={handleAdd}
              disabled={!newName.trim() || activeSubjects.length >= subjectLimit}>
              <ThemedText type="smallBold" style={styles.addBtnText}>
                {activeSubjects.length >= subjectLimit ? t('manageSubjects.limitReachedN', { limit: subjectLimit }) : t('manageSubjects.addSubjectBtn')}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.doneBtn}
            hitSlop={12}>
            <ThemedText type="linkPrimary" style={{ color: '#F7A7B8' }}>{t('common.done')}</ThemedText>
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
  inlineInput: { flex: 1, paddingVertical: 6, fontSize: 14 },
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
