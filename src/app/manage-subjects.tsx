import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, type LayoutChangeEvent } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import Svg, { Circle, Path } from 'react-native-svg';

import { ColorWheelPicker, hslToHex } from '@/components/color-wheel-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GripIcon, RemoveIcon } from '@/components/subject-icons';
import { useApp, MAX_SUBJECTS } from '@/context/app-context';
import { containsProfanity } from '@/lib/profanity';
import { localizeSubjectName } from '@/lib/subject-utils';
import { SUBJECT_COLORS } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Fonts, MaxContentWidth, MIN_POPUP_WIDTH, popupMaxWidth, Spacing } from '@/constants/theme';
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

// Caveat covers Latin only. CJK and Hangul use a rounded native face instead so
// they read soft/handwritten-adjacent without rendering oversized or broken.
const NON_LATIN = /[\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;
const isHandwritten = (text: string) => !NON_LATIN.test(text);
const roundedCjkFont = Platform.select({
  ios: 'Hiragino Maru Gothic ProN',
  android: 'sans-serif-rounded',
  default: undefined,
});

function normalizeHexInput(value: string): string | null {
  const raw = value.trim().replace(/^#/, '');
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    return `#${raw.split('').map((c) => c + c).join('')}`.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

// One animated style per row, always applied.
//
// The first version swapped between an animated style (while dragging) and a plain
// one (otherwise). That leaves the row permanently lifted: removing a
// useAnimatedStyle from a view does NOT reset the props Reanimated already wrote to
// it natively, so the scale and shadow survived the drop. Giving every row its own
// style that simply evaluates to zero when idle avoids the whole problem — and a
// component is the only way to call the hook per row, since hooks cannot live
// inside the .map().
function DraggableRow({
  dragging,
  dragY,
  shift,
  onLayout,
  children,
}: {
  dragging: boolean;
  dragY: SharedValue<number>;
  shift: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: dragging ? dragY.value : withSpring(shift, { damping: 20, stiffness: 200 }) },
        { scale: withSpring(dragging ? 1.03 : 1, { damping: 20, stiffness: 200 }) },
      ],
      zIndex: dragging ? 20 : 0,
    }),
    [dragging, shift],
  );
  return (
    <Animated.View onLayout={onLayout} style={[style, dragging && styles.rowLifted]}>
      {children}
    </Animated.View>
  );
}

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
  // Explicitly <string>: SUBJECT_COLORS is `as const`, so inferring from element 0
  // types the state as the literal '#64B5F6' and no other colour can be set.
  const [hexDraft, setHexDraft] = useState<string>(SUBJECT_COLORS[0]);
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
    setHexDraft(hex.toUpperCase());
    if (wheelFor === 'new') setSelectedColor(hex);
    else if (wheelFor) recolorSubject(wheelFor, hex);
  };
  const openWheel = (target: string | 'new') => {
    const value = target === 'new'
      ? selectedColor
      : subjects.find((s) => s.id === target)?.color ?? SUBJECT_COLORS[0];
    setHexDraft(value.toUpperCase());
    setWheelFor(target);
  };
  const handleHexChange = (text: string) => {
    if (text.length === 0) {
      setHexDraft('');
      return;
    }
    const withHash = text.startsWith('#') ? text : `#${text}`;
    const display = withHash.slice(0, 7).toUpperCase();
    setHexDraft(display);
    const normalized = normalizeHexInput(display);
    if (normalized) applyWheel(normalized);
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

  // ── Drag to reorder ────────────────────────────────────────────────────────
  // Replaces the old up/down arrows. The gesture lives on the grip handle ONLY:
  // the list sits inside a ScrollView, and a pan on the whole row would fight the
  // scroll for the same finger.
  //
  // Row height is measured rather than hardcoded so it survives tablet scaling and
  // the larger type sizes; until the first row reports, dragging is a no-op.
  const [rowH, setRowH] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  // How many slots the lifted row has travelled. Kept in React state (not just a
  // shared value) because the OTHER rows need to re-render to open the gap.
  const [dragOffset, setDragOffset] = useState(0);

  const dropAt = (id: string, slots: number) => {
    setDragId(null);
    setDragOffset(0);
    if (!slots) return;
    const sorted = [...activeSubjects];
    const from = sorted.findIndex((sub) => sub.id === id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(sorted.length - 1, from + slots));
    if (to === from) return;
    const [moved] = sorted.splice(from, 1);
    sorted.splice(to, 0, moved);
    reorderSubjects(sorted.map((sub) => sub.id));
  };

  // One shared value for the whole list rather than one per row: only ever a single
  // row is lifted, so the other rows only need a static offset, which React can hand
  // them. useAnimatedStyle is a hook and cannot live inside the .map().
  const dragY = useSharedValue(0);
  const lastSlots = useSharedValue(0);

  // Where a NON-dragged row sits while the lifted one passes it — one row-height out
  // of the way, so the gap follows the finger instead of appearing only on drop.
  const shiftFor = (idx: number) => {
    if (!dragId || !rowH || !dragOffset) return 0;
    const from = activeSubjects.findIndex((sub) => sub.id === dragId);
    if (from < 0 || idx === from) return 0;
    const to = Math.max(0, Math.min(activeSubjects.length - 1, from + dragOffset));
    if (from < to && idx > from && idx <= to) return -rowH;
    if (from > to && idx < from && idx >= to) return rowH;
    return 0;
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
    // Wrapped HERE rather than at the app root. Nothing else in the app uses
    // react-native-gesture-handler, so a root-level wrapper would change touch
    // handling everywhere for one screen's benefit — and this screen is presented
    // as a NATIVE modal, which iOS puts in its own view hierarchy that a root
    // wrapper does not reach into. Without this the drag throws outright.
    <GestureHandlerRootView style={styles.container}>
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

          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>{t('manageSubjects.title')}</ThemedText>
            <ThemedText style={styles.headerMeta}>
              {activeSubjects.length}/{subjectLimit}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.subjectPanel}>

            {activeSubjects.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('manageSubjects.noSubjectsBelow')}
                </ThemedText>
              </ThemedView>
            )}

            {activeSubjects.map((sub, idx) => {
              // Pan on the HANDLE only. The list is inside a ScrollView, so a pan on
              // the whole row would compete with the scroll for the same finger.
              const pan = Gesture.Pan()
                .onStart(() => {
                  lastSlots.value = 0;
                  runOnJS(setDragId)(sub.id);
                })
                .onUpdate((e) => {
                  dragY.value = e.translationY;
                  if (!rowH) return;
                  const slots = Math.round(e.translationY / rowH);
                  // Only cross into JS when the target slot actually changes —
                  // per-frame setState here drops the drag to single figures.
                  if (slots !== lastSlots.value) {
                    lastSlots.value = slots;
                    runOnJS(setDragOffset)(slots);
                  }
                })
                .onFinalize(() => {
                  const slots = lastSlots.value;
                  dragY.value = 0;
                  lastSlots.value = 0;
                  runOnJS(dropAt)(sub.id, slots);
                });
              const dragging = dragId === sub.id;
              return (
              <DraggableRow
                key={sub.id}
                dragging={dragging}
                dragY={dragY}
                shift={shiftFor(idx)}
                onLayout={idx === 0 ? (e) => setRowH(e.nativeEvent.layout.height + Spacing.two) : undefined}>
              <ThemedView style={styles.subjectCard}>
                <GestureDetector gesture={pan}>
                  <ThemedView style={styles.dragHandle}>
                    <GripIcon />
                  </ThemedView>
                </GestureDetector>
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
                    <Pressable onPress={() => openWheel(sub.id)} hitSlop={10} style={styles.subjectColorButton}>
                      <ThemedView style={[styles.subjectColorDot, { backgroundColor: sub.color }]} />
                    </Pressable>
                    <Pressable onPress={() => handleRenameStart(sub.id, sub.name)} hitSlop={6} style={styles.subjectNamePressable}>
                      <ThemedView style={[styles.subjectNameChip, { backgroundColor: sub.color + '33' }]}>
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
                  </ThemedView>
                )}

                <ThemedView style={styles.subjectActions}>
                  <Pressable style={styles.iconBtn} onPress={() => handleDelete(sub.id, sub.name)}>
                    <RemoveIcon />
                  </Pressable>
                </ThemedView>
              </ThemedView>
              </DraggableRow>
              );
            })}
          </ThemedView>

            {nameHasProfanity && (
              <ThemedText type="small" style={styles.profanityWarn}>
                {t('common.inappropriateLanguage')}
              </ThemedText>
            )}

          <ThemedView style={styles.addPanel}>
            <ThemedView style={styles.addInputRow}>
              <Pressable onPress={() => openWheel('new')} hitSlop={12} style={styles.addColorButton}>
                <ThemedView style={[styles.subjectColorDot, { backgroundColor: selectedColor }]} />
              </Pressable>
              <TextInput
                ref={nameRef}
                style={styles.addInput}
                placeholder={t('manageSubjects.addNewSubject')}
                placeholderTextColor={BakeryColors.latte}
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleAdd}
                maxLength={30}
                returnKeyType="done"
              />
            </ThemedView>

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
                onPress={() => openWheel('new')}
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
          </ThemedView>
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
              <ThemedText style={styles.wheelHexText} numberOfLines={1}>
                {wheelValue.toUpperCase()}
              </ThemedText>
            </ThemedView>
            <TextInput
              value={hexDraft}
              onChangeText={handleHexChange}
              placeholder="#64B5F6"
              placeholderTextColor={BakeryColors.latte}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={styles.hexInput}
            />
            <Pressable
              style={({ pressed }) => [styles.wheelDoneBtn, styles.wheelDoneWide, pressed && styles.pressed]}
              onPress={() => setWheelFor(null)}>
              <ThemedText style={styles.wheelDoneText}>{t('common.done')}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  safeArea: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: BakeryColors.cocoaDark },
  headerMeta: {
    minWidth: 48,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#FFF6E6',
    borderWidth: 1.5,
    borderColor: '#E2C9A6',
    color: BakeryColors.mocha,
    fontSize: 13,
    fontWeight: '900',
  },
  section: { gap: Spacing.two },
  sectionLabel: { fontSize: 13, marginBottom: 2 },
  emptyCard: {
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    backgroundColor: '#FFFBF4',
    borderWidth: 1.5,
    borderColor: '#F0D8B7',
  },
  emptyText: { textAlign: 'center' },
  subjectRow: {
    borderRadius: 14,
    padding: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  subjectInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minWidth: 0 },

  doneTop: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 2 },
  doneTopText: { fontFamily: 'Baloo2', fontSize: 16, color: BakeryColors.buttonPink },

  subjectPanel: {
    gap: Spacing.two,
  },
  paper: {
    backgroundColor: 'transparent',
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
  // Wide enough to grab without a stray press landing on the colour dot beside it.
  dragHandle: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  // The lifted row needs to read as picked UP, not just moved — shadow does that
  // where the 1.03 scale alone is too subtle on a cream-on-cream list.
  rowLifted: {
    shadowColor: '#5E3E2D',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  subjectCard: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 246, 230, 0.94)',
    borderWidth: 1.5,
    borderColor: '#E2C9A6',
    shadowColor: '#8B6B57',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  // The colour tab in the margin — the recolour button, using space the ruled
  // page already leaves empty to the left of the red rule.
  marginTabHit: { width: 24, alignItems: 'center' },
  marginTab: { width: 11, height: 11, borderRadius: 3 },
  subjectColorButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8EF',
    borderWidth: 1.5,
    borderColor: '#F0D8B7',
    flexShrink: 0,
  },
  addColorButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8EF',
    borderWidth: 1.5,
    borderColor: '#F0D8B7',
  },
  subjectColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  // Takes the slack between the name and the actions.
  lineSpacer: { flex: 1, minWidth: 8 },
  // Highlighter swipe behind the name.
  highlight: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  subjectNamePressable: { flex: 1, minWidth: 0 },
  subjectNameChip: {
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  handName: {
    fontFamily: Fonts.rounded,
    fontSize: 15.5,
    fontStyle: 'italic',
    fontWeight: '800',
    color: BakeryColors.cocoaDark,
  },
  blockName: {
    fontFamily: roundedCjkFont,
    fontSize: 14.5,
    fontWeight: '800',
    color: BakeryColors.cocoaDark,
  },
  // Lifetime study time, straight after the name.
  timePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  timePillText: { fontSize: 10.5, fontWeight: '800', color: '#fff' },
  // Fills the rest of the line so tapping the empty paper renames.
  renameHit: { flex: 1, alignSelf: 'stretch', minWidth: 20 },
  // The write-on line: the swipe stretches so the field has somewhere to grow.
  writeSwipe: { flex: 1, marginRight: Spacing.three, paddingVertical: 0 },
  handInput: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '800',
    color: BakeryColors.cocoaDark, paddingVertical: 6, padding: 0,
  },
  blockInput: {
    fontFamily: roundedCjkFont,
    fontSize: 14.5, fontWeight: '800',
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
  wheelChipText: { fontSize: 13, fontWeight: '800', flex: 1, minWidth: 0 },
  wheelHexText: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 251, 244, 0.86)',
    borderWidth: 1,
    borderColor: '#F0D8B7',
    color: BakeryColors.cocoaDark,
    fontSize: 11,
    fontWeight: '900',
  },
  hexInput: {
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    color: BakeryColors.cocoaDark,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
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
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 251, 244, 0.8)',
  },
  inlineInput: { flex: 1, paddingVertical: 8, fontSize: 15 },
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
    gap: Spacing.three,
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
  addPanel: {
    gap: Spacing.three,
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: '#FFFBF4',
    borderWidth: 1.5,
    borderColor: '#F0D8B7',
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    color: BakeryColors.cocoaDark,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    fontSize: 15,
    fontWeight: '800',
  },
  addBtn: {
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
