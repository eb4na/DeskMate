import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ArrowUpIcon, ArrowDownIcon, RemoveIcon } from '@/components/subject-icons';
import { useApp, MAX_SUBJECTS_FREE, MAX_SUBJECTS_PLUS } from '@/context/app-context';
import { containsProfanity } from '@/lib/profanity';
import { localizeSubjectName } from '@/lib/subject-utils';
import { SUBJECT_COLORS } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, MIN_POPUP_WIDTH, popupMaxWidth, Spacing } from '@/constants/theme';
import { useReportModalTransition } from '@/lib/modal-traffic';

export default function ManageSubjectsScreen() {
  const { t } = useTranslation();
  const { subjects, addSubject, renameSubject, deleteSubject, reorderSubjects, isPlus } =
    useApp();
  const subjectLimit = isPlus ? MAX_SUBJECTS_PLUS : MAX_SUBJECTS_FREE;

  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(SUBJECT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  // Local delete confirm — this screen is a native modal, so a root showPopup()
  // renders BEHIND it (see settings.tsx). A local <Modal> shows over the screen.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  useReportModalTransition(deleteTarget !== null);

  const activeSubjects = subjects
    .filter((s) => !s.archived)
    .sort((a, b) => a.order - b.order);

  const nextColor = (): string => {
    const used = subjects.map((s) => s.color);
    return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[activeSubjects.length % SUBJECT_COLORS.length];
  };

  // Flag bad words: block the add/rename and ask the user to fix it (rather than
  // silently masking). The context layer still masks as a defensive net.
  const nameHasProfanity = containsProfanity(newName);

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (containsProfanity(newName.trim())) {
      showPopup(t('common.inappropriateLanguage'));
      return;
    }
    const added = addSubject(newName.trim(), selectedColor);
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
    setSelectedColor(nextColor());
  };

  const handleRenameStart = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleRenameCommit = () => {
    if (editingId && editName.trim()) {
      if (containsProfanity(editName.trim())) {
        // Keep the editor open so they can fix it; don't commit or clear.
        showPopup(t('common.inappropriateLanguage'));
        return;
      }
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

  const handleDelete = (id: string, name: string) => setDeleteTarget({ id, name });

  const confirmDelete = () => {
    if (deleteTarget) deleteSubject(deleteTarget.id);
    setDeleteTarget(null);
  };

  const inputStyle = [
    styles.input,
    { color: '#000', borderColor: '#DDD', backgroundColor: '#FAFAFA' },
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
                    <ThemedText style={styles.subjectName}>{localizeSubjectName(sub.name, t)}</ThemedText>
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
              placeholderTextColor={'#AAA'}
              value={newName}
              onChangeText={setNewName}
              maxLength={30}
              returnKeyType="done"
            />
            {nameHasProfanity && (
              <ThemedText type="small" style={styles.profanityWarn}>
                {t('common.inappropriateLanguage')}
              </ThemedText>
            )}

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
              style={({ pressed }) => [styles.addBtn, (!newName.trim() || nameHasProfanity || activeSubjects.length >= subjectLimit) && styles.addBtnDisabled, pressed && styles.pressed]}
              onPress={handleAdd}
              disabled={!newName.trim() || nameHasProfanity || activeSubjects.length >= subjectLimit}>
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

      {/* Delete confirm — local modal so it shows over this (native modal) screen. */}
      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setDeleteTarget(null)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation?.()}>
            <ThemedText style={styles.confirmTitle}>{t('manageSubjects.deleteSubjectQ')}</ThemedText>
            <ThemedText style={styles.confirmBody}>
              {t('manageSubjects.deleteMsg', { name: deleteTarget?.name ?? '' })}
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.confirmDeleteBtn, pressed && styles.pressed]}
              onPress={confirmDelete}>
              <ThemedText style={styles.confirmDeleteText}>{t('common.delete')}</ThemedText>
            </Pressable>
            <Pressable style={styles.confirmCancel} onPress={() => setDeleteTarget(null)}>
              <ThemedText style={styles.confirmCancelText}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  profanityWarn: { color: '#C2536B', fontWeight: '700', marginTop: 2 },
  pressed: { opacity: 0.8 },
  doneBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(60,40,35,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: popupMaxWidth(360), backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.panel, borderWidth: 2, borderColor: '#E8A0A0',
    padding: Spacing.four, gap: Spacing.two, ...BakeryShadow,
  },
  confirmTitle: { fontSize: 20, fontWeight: '900', color: '#C0392B', textAlign: 'center' },
  confirmBody: { fontSize: 13.5, color: BakeryColors.cocoaDark, lineHeight: 19, textAlign: 'center' },
  confirmDeleteBtn: { paddingVertical: 14, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: '#D0392B', marginTop: Spacing.one },
  confirmDeleteText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  confirmCancel: { alignItems: 'center', paddingVertical: Spacing.one },
  confirmCancelText: { fontSize: 14, fontWeight: '800', color: BakeryColors.mocha },
});
