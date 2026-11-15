// Import a syllabus → exams + due-dated tasks. Three ways in: upload a PDF, a
// photo (camera or library), or paste the text. All reading happens ON the phone
// (PDFKit / Vision via modules/syllabus-reader, plus the rule-based parser in
// lib/syllabus-parse) — no AI, no network, no cost. The student always reviews
// the list before anything is added, because a rule-based reader will misread
// some lines.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { CheckBox } from '@/components/check-menu';
import { DateWheelPicker, formatDateLabel, getTodayISO } from '@/components/date-wheel-picker';
import { SoundPressable } from '@/components/sound-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BakeryColors as C, BakeryRadii, BakeryShadow, PastelCards, popupMaxWidth, Spacing } from '@/constants/theme';
import { MAX_EXAMS, MAX_TASKS, useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';
import { showPopup } from '@/lib/popup';
import { localizeSubjectName } from '@/lib/subject-utils';
import { parseSyllabus, type SyllabusItem, type SyllabusKind } from '@/lib/syllabus-parse';
import { canReadFiles, pickPdfText, pickPhotoText } from '@/lib/syllabus-reader';
import { BackButton } from '@/components/back-button';

type Row = SyllabusItem & { checked: boolean };

/** Does this region write 3/4 as 3 April? (Most of the world; not the US.) */
function regionIsDayFirst(): boolean {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric' }).formatToParts(new Date(2026, 10, 25));
    return parts.findIndex((p) => p.type === 'day') < parts.findIndex((p) => p.type === 'month');
  } catch {
    return false;
  }
}

function SourceIcon({ kind }: { kind: 'pdf' | 'camera' | 'photo' | 'paste' }) {
  const s = C.cocoaDark;
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      {kind === 'pdf' && (
        <>
          <Path d="M6 2.8h8l4.2 4.2V21.2H6z" stroke={s} strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M14 2.8V7h4.2" stroke={s} strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M8.8 12h6.4M8.8 15.2h6.4M8.8 18.2h4" stroke={C.buttonPink} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )}
      {kind === 'camera' && (
        <>
          <Path d="M3 8.2h4l1.6-2.4h6.8L17 8.2h4V19H3z" stroke={s} strokeWidth={1.8} strokeLinejoin="round" />
          <Circle cx="12" cy="13.4" r="3.4" stroke={C.buttonPink} strokeWidth={1.8} />
        </>
      )}
      {kind === 'photo' && (
        <>
          <Rect x="3" y="4.5" width="18" height="15" rx="2.5" stroke={s} strokeWidth={1.8} />
          <Circle cx="8.5" cy="9.5" r="1.7" fill={C.buttonPink} />
          <Path d="M3.5 17.5l5.2-4.6 3.6 3.1 3.2-2.6 4.8 4" stroke={s} strokeWidth={1.8} strokeLinejoin="round" />
        </>
      )}
      {kind === 'paste' && (
        <>
          <Rect x="5" y="4" width="14" height="17" rx="2.2" stroke={s} strokeWidth={1.8} />
          <Rect x="8.6" y="2.6" width="6.8" height="3.4" rx="1.2" fill={C.buttonPink} />
          <Path d="M8.5 11h7M8.5 14.4h7M8.5 17.6h4.4" stroke={s} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

export default function ImportSyllabusScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { subjects, tasks, examCountdowns, addExam, addTask } = useApp();
  const activeSubjects = subjects.filter((s) => !s.archived);
  const filesOk = useMemo(() => canReadFiles(), []);

  const [mode, setMode] = useState<'choose' | 'paste' | 'review'>('choose');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [openDateKey, setOpenDateKey] = useState<string | null>(null);

  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();
  // Lift the centred card above the keyboard (paste box) by padding the root.
  const kbLift = useAnimatedStyle(() => ({ paddingBottom: Math.max(keyboard.height.value - insets.bottom, 0) }));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: colors.text,
    fontSize: 15,
  };

  // Turn text into review rows, dropping anything already in the planner (same
  // title + date) so importing the same syllabus twice doesn't double up.
  const review = (text: string) => {
    const items = parseSyllabus(text, { todayISO: getTodayISO(), dayFirst: regionIsDayFirst() });
    const have = new Set([
      ...tasks.map((x) => `${(x.dueDate ?? '').slice(0, 10)}|${x.title.trim().toLowerCase()}`),
      ...examCountdowns.map((x) => `${x.dateISO.slice(0, 10)}|${x.name.trim().toLowerCase()}`),
    ]);
    const fresh = items.filter((i) => !have.has(`${i.dateISO}|${i.title.trim().toLowerCase()}`));
    setRows(fresh.map((i) => ({ ...i, checked: i.confident })));
    setOpenDateKey(null);
    setError(null);
    setMode('review');
  };

  const readFrom = async (source: 'pdf' | 'camera' | 'library') => {
    setError(null);
    setBusy(true);
    try {
      const text = source === 'pdf' ? await pickPdfText() : await pickPhotoText(source);
      if (text === null) return; // cancelled
      if (!text.trim()) {
        setError(t('syllabus.readFailed'));
        return;
      }
      review(text);
    } catch (e) {
      setError((e as Error)?.message === 'camera-denied' ? t('syllabus.cameraDenied') : t('syllabus.readFailed'));
    } finally {
      setBusy(false);
    }
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const chosen = rows.filter((r) => r.checked && r.title.trim());

  const addAll = () => {
    const subjectName = subjectId ? subjects.find((s) => s.id === subjectId)?.name ?? '' : '';
    let added = 0;
    let examsSkipped = 0;
    let examCount = examCountdowns.length;
    let taskCount = tasks.length;
    for (const r of chosen) {
      const title = r.title.trim();
      if (r.kind === 'exam') {
        if (examCount >= MAX_EXAMS) { examsSkipped++; continue; }
        const id = addExam({ name: title.slice(0, 40), subject: subjectName, dateISO: r.dateISO, time: r.time ?? undefined, reminderEnabled: true });
        if (id) { added++; examCount++; } else examsSkipped++;
      } else {
        if (taskCount >= MAX_TASKS) continue;
        const id = addTask({
          title: title.slice(0, 80),
          description: undefined,
          subjectId,
          dueDate: r.dateISO,
          isDeadline: true,
          dueTime: r.time,
          estimatedMinutes: null,
          priority: 'medium',
          status: 'not_started',
          notifyAt: null,
          reminderMode: 'auto',
          repeatDays: undefined,
          repeatUntil: undefined,
        });
        if (id) { added++; taskCount++; }
      }
    }
    router.back();
    const msg = [t('syllabus.addedMsg', { count: added })];
    if (examsSkipped) msg.push(t('syllabus.examsSkipped', { count: examsSkipped }));
    showPopup(t('syllabus.addedTitle'), msg.join('\n\n'));
  };

  const sources: { key: 'pdf' | 'camera' | 'library' | 'paste'; icon: 'pdf' | 'camera' | 'photo' | 'paste'; label: string; needsFiles: boolean }[] = [
    { key: 'pdf', icon: 'pdf', label: t('syllabus.uploadPdf'), needsFiles: true },
    { key: 'camera', icon: 'camera', label: t('syllabus.takePhoto'), needsFiles: true },
    { key: 'library', icon: 'photo', label: t('syllabus.choosePhoto'), needsFiles: true },
    { key: 'paste', icon: 'paste', label: t('syllabus.pasteText'), needsFiles: false },
  ];

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top + Spacing.three }, kbLift]}>
      {/* Backdrop is a SIBLING behind the card (a Pressable wrapping it would eat
          the ScrollView's pan). Tapping it closes — except mid-review, where a
          stray tap would throw away the list. */}
      <Pressable style={styles.backdrop} onPress={mode === 'review' ? undefined : close} />
      <View style={styles.card}>
        <ThemedText type="smallBold" style={styles.cardTitle}>{t('screens.importSyllabus')}</ThemedText>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
          {mode !== 'review' && (
            <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
              {t('syllabus.intro')}
            </ThemedText>
          )}

          {mode === 'choose' && (
            <>
              <View style={styles.sourceGrid}>
                {sources.map((s) => {
                  const disabled = busy || (s.needsFiles && !filesOk);
                  return (
                    <SoundPressable
                      key={s.key}
                      disabled={disabled}
                      onPress={() => (s.key === 'paste' ? setMode('paste') : readFrom(s.key))}
                      style={({ pressed }) => [styles.sourceCard, disabled && styles.disabled, pressed && styles.pressed]}>
                      <SourceIcon kind={s.icon} />
                      <ThemedText type="smallBold" style={styles.sourceLabel}>{s.label}</ThemedText>
                    </SoundPressable>
                  );
                })}
              </View>
              {!filesOk && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {t('syllabus.needsUpdate')}
                </ThemedText>
              )}
              {busy && (
                <View style={styles.busyRow}>
                  <ActivityIndicator color={C.buttonPink} />
                  <ThemedText type="small" themeColor="textSecondary">{t('syllabus.reading')}</ThemedText>
                </View>
              )}
            </>
          )}

          {mode === 'paste' && (
            <ThemedView style={styles.field}>
              <ThemedText type="smallBold">{t('syllabus.pasteHint')}</ThemedText>
              <TextInput
                style={[inputStyle, styles.pasteBox]}
                value={pasted}
                onChangeText={setPasted}
                placeholder={t('syllabus.pastePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
                autoFocus
              />
              <SoundPressable
                disabled={!pasted.trim()}
                onPress={() => review(pasted)}
                style={({ pressed }) => [styles.primaryBtn, !pasted.trim() && styles.disabled, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.primaryBtnText}>{t('syllabus.findDates')}</ThemedText>
              </SoundPressable>
              <BackButton label={t('common.back')} variant="outline" onPress={() => setMode('choose')} />
            </ThemedView>
          )}

          {mode === 'review' && (
            <>
              <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
                {rows.length ? t('syllabus.found', { count: rows.length }) : t('syllabus.noneFound')}
              </ThemedText>

              {rows.length > 0 && activeSubjects.length > 0 && (
                <ThemedView style={styles.field}>
                  <ThemedText type="smallBold">{t('syllabus.subjectForAll')}</ThemedText>
                  <View style={styles.chipRow}>
                    <Pressable onPress={() => setSubjectId(null)}>
                      <ThemedView type={subjectId === null ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                        <ThemedText type="small">{t('addExam.none')}</ThemedText>
                      </ThemedView>
                    </Pressable>
                    {activeSubjects.map((s) => (
                      <Pressable key={s.id} onPress={() => setSubjectId(s.id === subjectId ? null : s.id)}>
                        <ThemedView type={subjectId === s.id ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                          <View style={[styles.subjectDot, { backgroundColor: s.color }]} />
                          <ThemedText type="small">{localizeSubjectName(s.name, t)}</ThemedText>
                        </ThemedView>
                      </Pressable>
                    ))}
                  </View>
                </ThemedView>
              )}

              {rows.map((r) => (
                <ThemedView key={r.key} type="backgroundElement" style={[styles.row, !r.checked && styles.rowOff]}>
                  <View style={styles.rowTop}>
                    <Pressable hitSlop={8} onPress={() => update(r.key, { checked: !r.checked })}>
                      <CheckBox checked={r.checked} size={24} color={C.buttonPink} />
                    </Pressable>
                    <TextInput
                      style={[inputStyle, styles.titleInput]}
                      value={r.title}
                      onChangeText={(v) => update(r.key, { title: v, checked: true })}
                      maxLength={80}
                    />
                  </View>
                  <View style={styles.rowMeta}>
                    {(['exam', 'task'] as SyllabusKind[]).map((k) => (
                      <Pressable key={k} onPress={() => update(r.key, { kind: k })}>
                        <View style={[styles.kindChip, r.kind === k && styles.kindChipOn]}>
                          <ThemedText type="small" style={[styles.kindText, r.kind === k && styles.kindTextOn]}>
                            {k === 'exam' ? t('syllabus.exam') : t('syllabus.task')}
                          </ThemedText>
                        </View>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => setOpenDateKey(openDateKey === r.key ? null : r.key)}>
                      <View style={[styles.dateChip, openDateKey === r.key && styles.kindChipOn]}>
                        <ThemedText type="smallBold" style={[styles.kindText, openDateKey === r.key && styles.kindTextOn]}>
                          {formatDateLabel(r.dateISO)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </View>
                  {openDateKey === r.key && (
                    <DateWheelPicker value={r.dateISO} onChange={(v) => update(r.key, { dateISO: v })} />
                  )}
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.source}>
                    {r.source}
                  </ThemedText>
                </ThemedView>
              ))}

              {chosen.length > 0 && (
                <SoundPressable
                  sound="confirm"
                  onPress={addAll}
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.primaryBtnText}>
                    {t('syllabus.addCount', { count: chosen.length })}
                  </ThemedText>
                </SoundPressable>
              )}
              <Pressable onPress={() => { setRows([]); setMode('choose'); }} style={styles.linkBtn}>
                <ThemedText type="linkPrimary">{t('syllabus.startOver')}</ThemedText>
              </Pressable>
            </>
          )}

          {error && <ThemedText type="small" style={styles.errorText}>{error}</ThemedText>}

      </ScrollView>
        <Pressable onPress={close} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.cancelText}>{t('common.cancel')}</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -Spacing.four,
    right: -Spacing.four,
    backgroundColor: 'rgba(59, 42, 33, 0.35)',
  },
  card: {
    width: '100%',
    maxWidth: popupMaxWidth(380),
    maxHeight: '86%',
    backgroundColor: C.paper,
    borderRadius: BakeryRadii.panel,
    borderWidth: 1.5,
    borderColor: PastelCards.blush.border,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    ...BakeryShadow,
  },
  cardTitle: { fontSize: 18, color: C.cocoaDark, textAlign: 'center', marginBottom: Spacing.two },
  scroll: { flexShrink: 1, alignSelf: 'stretch' },
  body: { gap: Spacing.three, paddingBottom: Spacing.two },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two + 2 },
  cancelText: { color: C.mocha },
  hint: { lineHeight: 22 },
  center: { textAlign: 'center', lineHeight: 20 },
  field: { gap: Spacing.two },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  sourceCard: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.two,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F2C7CF',
    backgroundColor: '#FFF8F6',
  },
  sourceLabel: { color: C.cocoaDark, textAlign: 'center' },
  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  pasteBox: { minHeight: 200, maxHeight: 360 },
  primaryBtn: {
    backgroundColor: C.buttonPink,
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16 },
  linkBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.three, paddingVertical: 8, borderRadius: 12 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  row: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  rowOff: { opacity: 0.55 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  titleInput: { flex: 1 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, paddingLeft: 32 },
  kindChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1.2, borderColor: '#E6D3C3' },
  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1.2, borderColor: C.buttonPink },
  kindChipOn: { backgroundColor: C.buttonPink, borderColor: C.buttonPink },
  kindText: { color: C.cocoaDark },
  kindTextOn: { color: '#FFFFFF' },
  source: { paddingLeft: 32, fontStyle: 'italic' },
  errorText: { color: '#C0392B', fontWeight: '700', textAlign: 'center' },
});
