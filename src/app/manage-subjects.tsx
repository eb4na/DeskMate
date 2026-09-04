import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import Svg, { Circle, Path } from 'react-native-svg';

import { ColorWheelPicker, hslToHex } from '@/components/color-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ArrowUpIcon, ArrowDownIcon, RemoveIcon } from '@/components/subject-icons';
import { useApp, MAX_SUBJECTS } from '@/context/app-context';
import { containsProfanity } from '@/lib/profanity';
import { localizeSubjectName } from '@/lib/subject-utils';
import { SUBJECT_COLORS } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, MIN_POPUP_WIDTH, popupMaxWidth, Spacing } from '@/constants/theme';
import { useReportModalTransition } from '@/lib/modal-traffic';

// The 7th swatch: a hue ring that opens the wheel. Drawn rather than an image so
// it tints itself from the same hslToHex the picker emits.
function WheelSwatch({ value, onPress, selected }: { value: string; onPress: () => void; selected: boolean }) {
  const S = 32;
  const R = S / 2 - 2;
  const arcs = Array.from({ length: 12 }, (_, i) => {
    const a0 = (i * 30 - 90) * (Math.PI / 180);
    const a1 = ((i + 1) * 30 - 90) * (Math.PI / 180);
    const p = (a: number) => `${S / 2 + R * Math.cos(a)} ${S / 2 + R * Math.sin(a)}`;
    return { d: `M${S / 2} ${S / 2} L${p(a0)} A${R} ${R} 0 0 1 ${p(a1)} Z`, fill: hslToHex(i * 30, 62, 73) };
  });
  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.colorSwatch, styles.wheelSwatch, selected && styles.colorSwatchSelected]}>
        {/* pointerEvents none so the touch reaches the Pressable above rather than
            being taken by the native SVG view (same guard as study-vinyl's disc). */}
        <Svg width={S} height={S} pointerEvents="none">
          {arcs.map((a, i) => (
            <Path key={i} d={a.d} fill={a.fill} />
          ))}
          {/* When a custom colour is in use, show it in the middle so the swatch
              reads as the current selection rather than a generic button. */}
          {selected && <Circle cx={S / 2} cy={S / 2} r={R * 0.55} fill={value} stroke="#fff" strokeWidth={2} />}
        </Svg>
      </ThemedView>
    </Pressable>
  );
}

// Caveat covers Latin only. CJK and Hangul fall through to the system face, where
// the handwriting size renders far larger and heavier than the script it was tuned
// for — so those names get the app's normal label size instead. Checked per name,
// not per app language, since one list can hold both.
const NON_LATIN = /[\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;
const isHandwritten = (text: string) => !NON_LATIN.test(text);

export default function ManageSubjectsScreen() {
  const { t } = useTranslation();
  const { subjects, addSubject, renameSubject, recolorSubject, deleteSubject, reorderSubjects, subjectTimeMap } = useApp();
  // Same cap for everyone — subjects aren't a Plus perk.
  const subjectLimit = MAX_SUBJECTS;

  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(SUBJECT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  // Local delete confirm — this screen is a native modal, so a root showPopup()
  // renders BEHIND it (see settings.tsx). A local <Modal> shows over the screen.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  // The colour wheel sheet. `wheelFor` is the subject being recoloured, or 'new'
  // when it's the add form's colour. Never open at the same time as the delete
  // confirm, so this screen still only ever presents ONE local modal at a time.
  const nameRef = useRef<TextInput>(null);
  const [wheelFor, setWheelFor] = useState<string | 'new' | null>(null);
  // Lifetime minutes per subject, keyed by NAME (that's how subjectTimeMap is
  // written). Shown on each ruled line so the page says what you've actually done,
  // not just what exists.
  const studiedLabel = (name: string) => {
    const mins = subjectTimeMap?.[name] ?? 0;
    if (!mins) return null;
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
  };
  const wheelValue =
    wheelFor === 'new'
      ? selectedColor
      : subjects.find((s) => s.id === wheelFor)?.color ?? SUBJECT_COLORS[0];
  // What the preview chip is labelled with: the subject being recoloured, or the
  // name being typed into the add form (falling back to its placeholder so the
  // chip is never empty).
  const wheelLabel =
    wheelFor === 'new'
      ? newName.trim() || t('manageSubjects.subjectNamePlaceholder')
      : localizeSubjectName(subjects.find((s) => s.id === wheelFor)?.name ?? '', t);
  const applyWheel = (hex: string) => {
    if (wheelFor === 'new') setSelectedColor(hex);
    else if (wheelFor) recolorSubject(wheelFor, hex);
  };
  useReportModalTransition(deleteTarget !== null || wheelFor !== null);

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
        t('manageSubjects.limitMsgPlus', { max: MAX_SUBJECTS }),
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

  // Cream on the parchment card, not the stock white/grey it used to be.
  const inputStyle = [
    styles.input,
    { color: BakeryColors.cocoaDark, borderColor: BakeryColors.shortbread, backgroundColor: BakeryColors.cream },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
        <SafeAreaView style={styles.safeArea}>
          {/* Flat Done, drawn by us. The native bar button is gone because iOS 26
              wraps it in a glass capsule that reads as a raised chip. */}
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={14}
            style={({ pressed }) => [styles.doneTop, pressed && styles.pressed]}>
            <ThemedText style={styles.doneTopText}>{t('common.done')}</ThemedText>
          </Pressable>

          {/* A page from a study notebook. No heading of its own — the list is the
              screen, and a title here only repeated what got you to it. */}
          <ThemedView style={styles.paper}>

            {activeSubjects.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('manageSubjects.noSubjectsBelow')}
                </ThemedText>
              </ThemedView>
            )}

            {activeSubjects.map((sub, idx) => (
              <ThemedView key={sub.id} style={styles.ruledLine}>
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
                  <ThemedView style={styles.subjectInfo}>
                    {/* Colour lives in the margin, as a page tab. Tapping the NAME has
                        always renamed and people expect that, so the recolour control
                        can't sit on it — the margin is empty space the notebook gives
                        us for free. */}
                    <Pressable onPress={() => setWheelFor(sub.id)} hitSlop={12} style={styles.marginTabHit}>
                      <ThemedView style={[styles.marginTab, { backgroundColor: sub.color }]} />
                    </Pressable>
                    <Pressable onPress={() => handleRenameStart(sub.id, sub.name)} hitSlop={6}>
                      <ThemedView style={[styles.highlight, { backgroundColor: sub.color + '55' }]}>
                        <ThemedText
                          style={isHandwritten(localizeSubjectName(sub.name, t)) ? styles.handName : styles.blockName}
                          numberOfLines={1}>
                          {localizeSubjectName(sub.name, t)}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                    {/* Lifetime study time, from C — the app already tracks it and
                        this screen never showed it. Hidden entirely at zero rather
                        than printing "0h" on every new subject. */}
                    {studiedLabel(sub.name) != null && (
                      <ThemedView style={[styles.timePill, { backgroundColor: sub.color }]}>
                        <ThemedText style={styles.timePillText}>{studiedLabel(sub.name)}</ThemedText>
                      </ThemedView>
                    )}
                    <ThemedView style={styles.lineSpacer} />
                  </ThemedView>
                )}

                {/* The arrow slots are always rendered — hidden, not removed, at the
                    ends of the list. Dropping them made every row a different width
                    and the column of actions read as ragged. */}
                <ThemedView style={styles.subjectActions}>
                  <Pressable
                    style={styles.iconBtn}
                    disabled={idx === 0}
                    onPress={() => handleMoveUp(sub.id)}>
                    <ThemedView style={idx === 0 && styles.iconHidden}>
                      <ArrowUpIcon />
                    </ThemedView>
                  </Pressable>
                  <Pressable
                    style={styles.iconBtn}
                    disabled={idx === activeSubjects.length - 1}
                    onPress={() => handleMoveDown(sub.id)}>
                    <ThemedView style={idx === activeSubjects.length - 1 && styles.iconHidden}>
                      <ArrowDownIcon />
                    </ThemedView>
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => handleDelete(sub.id, sub.name)}>
                    <RemoveIcon />
                  </Pressable>
                </ThemedView>
              </ThemedView>
            ))}
            {/* You write the new subject on the page's next line, in the same hand
                as the others — no separate field below. The swatch shows the colour
                it'll be saved with, so the line previews the finished entry. */}
            <ThemedView style={styles.ruledLine}>
              <ThemedView style={styles.subjectInfo}>
                <Pressable onPress={() => setWheelFor('new')} hitSlop={12} style={styles.marginTabHit}>
                  <ThemedView style={[styles.marginTab, { backgroundColor: selectedColor }]} />
                </Pressable>
                {/* The swipe only appears once there's something to highlight —
                    an empty one read as a big coloured block. */}
                <ThemedView
                  style={[
                    styles.highlight,
                    styles.writeSwipe,
                    newName.trim().length > 0 && { backgroundColor: selectedColor + '55' },
                  ]}>
                  <TextInput
                    ref={nameRef}
                    style={isHandwritten(newName) ? styles.handInput : styles.blockInput}
                    placeholder={t('manageSubjects.addNewSubject')}
                    placeholderTextColor={BakeryColors.latte}
                    value={newName}
                    onChangeText={setNewName}
                    onSubmitEditing={handleAdd}
                    maxLength={30}
                    returnKeyType="done"
                  />
                </ThemedView>
              </ThemedView>
            </ThemedView>
            {/* The margin rule goes LAST, on top. Drawn first it was hidden behind
                every row — ThemedView paints an opaque background by default, so
                only the final row (which has none) ever showed it. */}
            <ThemedView style={styles.marginRule} pointerEvents="none" />
          </ThemedView>

            {nameHasProfanity && (
              <ThemedText type="small" style={styles.profanityWarn}>
                {t('common.inappropriateLanguage')}
              </ThemedText>
            )}

            {/* Colour: six presets, then the wheel for anything else. */}
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
              <WheelSwatch
                value={selectedColor}
                onPress={() => setWheelFor('new')}
                selected={!(SUBJECT_COLORS as readonly string[]).includes(selectedColor)}
              />
            </ThemedView>

            <Pressable
              style={({ pressed }) => [styles.addBtn, (!newName.trim() || nameHasProfanity || activeSubjects.length >= subjectLimit) && styles.addBtnDisabled, pressed && styles.pressed]}
              onPress={handleAdd}
              disabled={!newName.trim() || nameHasProfanity || activeSubjects.length >= subjectLimit}>
              <ThemedText type="smallBold" style={styles.addBtnText}>
                {activeSubjects.length >= subjectLimit ? t('manageSubjects.limitReachedN', { limit: subjectLimit }) : t('manageSubjects.addSubjectBtn')}
              </ThemedText>
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

      {/* Colour wheel — same local-modal shape as the delete confirm above, and
          the two are mutually exclusive so only one ever presents. Writes live on
          every drag (recolorSubject / setSelectedColor); Done just dismisses. */}
      <Modal visible={wheelFor !== null} transparent animationType="fade" onRequestClose={() => setWheelFor(null)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setWheelFor(null)}>
          <Pressable style={styles.wheelCard} onPress={(e) => e.stopPropagation?.()}>
            <ColorWheelPicker value={wheelValue} onChange={applyWheel} brightness />
            {/* A real calendar chip rather than a floating swatch: these colours are
                chosen to be told apart ON a chip, and they run low-contrast as chip
                text, so showing the actual thing lets a bad pick be caught here. Same
                construction as task-calendar's chip — `color + '2E'` fill, name in the
                colour itself — which is why the hex must stay 7 characters. */}
            <ThemedView style={[styles.wheelChip, { backgroundColor: wheelValue + '2E' }]}>
              <ThemedView style={[styles.wheelChipDot, { backgroundColor: wheelValue }]} />
              <ThemedText style={[styles.wheelChipText, { color: wheelValue }]} numberOfLines={1}>
                {wheelLabel}
              </ThemedText>
            </ThemedView>
            <Pressable
              style={({ pressed }) => [styles.wheelDoneBtn, styles.wheelDoneWide, pressed && styles.pressed]}
              onPress={() => setWheelFor(null)}>
              <ThemedText style={styles.wheelDoneText}>{t('common.done')}</ThemedText>
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

  doneTop: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 2 },
  doneTopText: { fontFamily: 'Baloo2', fontSize: 16, color: BakeryColors.buttonPink },

  // ── The notebook page ────────────────────────────────────────────────────
  // Ruled paper: each line draws its own bottom rule, which is simpler and
  // sharper than a repeating background and keeps the rules locked to the rows.
  paper: {
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    overflow: 'hidden',
    paddingVertical: 2,
  },
  // The red margin rule down the left, behind every line.
  marginRule: {
    position: 'absolute', top: 0, bottom: 0, left: 38, width: 1.5,
    backgroundColor: 'rgba(214,120,140,0.38)',
  },
  ruledLine: {
    backgroundColor: 'transparent',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(195,143,114,0.24)',
  },
  // The colour tab in the margin — the recolour button, using space the ruled
  // page already leaves empty to the left of the red rule.
  marginTabHit: { width: 24, alignItems: 'center' },
  marginTab: { width: 11, height: 11, borderRadius: 3 },
  // Takes the slack between the name and the actions.
  lineSpacer: { flex: 1, minWidth: 8 },
  // Highlighter swipe behind the name.
  highlight: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  handName: {
    fontFamily: 'Caveat', fontSize: 23, lineHeight: 28, color: BakeryColors.cocoaDark,
  },
  // The non-Latin counterpart: system face at a normal label size.
  blockName: { fontSize: 16, lineHeight: 22, fontWeight: '800', color: BakeryColors.cocoaDark },
  // Lifetime study time, straight after the name.
  timePill: { marginLeft: Spacing.two, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  timePillText: { fontSize: 10.5, fontWeight: '800', color: '#fff' },
  // Fills the rest of the line so tapping the empty paper renames.
  renameHit: { flex: 1, alignSelf: 'stretch', minWidth: 20 },
  // The write-on line: the swipe stretches so the field has somewhere to grow.
  writeSwipe: { flex: 1, marginRight: Spacing.three, paddingVertical: 0 },
  handInput: {
    fontFamily: 'Caveat', fontSize: 23, lineHeight: 28,
    color: BakeryColors.cocoaDark, paddingVertical: 6, padding: 0,
  },
  blockInput: {
    fontSize: 16, lineHeight: 22, fontWeight: '800',
    color: BakeryColors.cocoaDark, paddingVertical: 9, padding: 0,
  },
  // A ringed swatch, sized like a control rather than a status dot.
  colorSwatchBtn: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: BakeryColors.frosting,
  },
  // Keeps the arrow's slot so rows don't change width at the list's ends.
  iconHidden: { opacity: 0 },
  subjectInfoText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  wheelSwatch: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', overflow: 'hidden' },
  wheelCard: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: popupMaxWidth(360),
    backgroundColor: BakeryColors.frosting, borderRadius: BakeryRadii.panel,
    borderWidth: 2, borderColor: BakeryColors.border,
    padding: Spacing.four, alignItems: 'center', gap: Spacing.three, ...BakeryShadow,
  },
  // Mirrors the calendar chip the colour will actually appear on.
  wheelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch',
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, overflow: 'hidden',
  },
  wheelChipDot: { width: 9, height: 9, borderRadius: 5 },
  wheelChipText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  // The app's primary pink, and a normal label size — this used to borrow the
  // delete button's style, which is red and deliberately loud.
  wheelDoneBtn: {
    backgroundColor: BakeryColors.buttonPink, borderRadius: BakeryRadii.button,
    paddingVertical: 10, paddingHorizontal: Spacing.five, alignItems: 'center',
  },
  wheelDoneText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  wheelDoneWide: { alignSelf: 'stretch' },
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
    justifyContent: 'space-between',
    marginVertical: Spacing.three,
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
    // Was a taupe #7C6F5A, the one primary button in the app that wasn't pink.
    backgroundColor: BakeryColors.buttonPink,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#FFF' },
  profanityWarn: { color: '#C2536B', fontWeight: '700', marginTop: 2 },
  pressed: { opacity: 0.8 },
  // A real (quiet) button rather than a floating text link — it's the way off
  // this screen, so it should look pressable.
  doneBtn: {
    alignSelf: 'center', alignItems: 'center', marginTop: Spacing.four,
    paddingVertical: 10, paddingHorizontal: Spacing.six,
    borderRadius: BakeryRadii.button, borderWidth: 2,
    borderColor: BakeryColors.buttonPink, backgroundColor: BakeryColors.frosting,
  },
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
