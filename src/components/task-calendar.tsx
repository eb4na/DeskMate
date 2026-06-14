import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import Svg, { Circle, Path } from 'react-native-svg';

import { CountdownShape } from '@/components/countdown-shapes';

import {
  BakeryBellEmoji,
  BakeryCakeEmoji,
  BakeryCalendarEmoji,
  BakeryCheckEmoji,
} from '@/components/bakery-emoji';
import { useApp } from '@/context/app-context';
import type { Task } from '@/context/app-context';
import i18n from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';


const C = BakeryColors;
const weekdayLetters = () => [0, 1, 2, 3, 4, 5, 6].map((i) => i18n.t(`calendar.wd_${i}`));
const SCREEN_PAD = Spacing.four;
const CARD_PAD = 14;

// ─── date helpers (no dependency) ────────────────────────────────────────────
function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayISO() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
}
function fromISO(iso: string) {
  return new Date(iso + 'T00:00:00');
}
function longLabel(iso: string) {
  return fromISO(iso).toLocaleDateString(i18n.language || 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function shortWeekday(iso: string) {
  return fromISO(iso).toLocaleDateString(i18n.language || 'en-US', { weekday: 'short' });
}
function formatTime(notifyAt: string | null, use24Hour: boolean) {
  if (!notifyAt) return null;
  const d = new Date(notifyAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(i18n.language || 'en-US', { hour: 'numeric', minute: '2-digit', hour12: !use24Hour });
}

// ─── shared task preview card ────────────────────────────────────────────────
function TaskPreviewCard({ task }: { task: Task }) {
  const { subjects, updateTask, use24HourTime } = useApp();
  const subject = task.subjectId ? subjects.find((s) => s.id === task.subjectId) : null;
  const done = task.status === 'done';
  const time = formatTime(task.notifyAt, use24HourTime);

  return (
    <Pressable
      style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/add-task', params: { taskId: task.id } })}>
      {/* completion checkbox */}
      <Pressable
        hitSlop={8}
        onPress={() => updateTask(task.id, { status: done ? 'not_started' : 'done' })}
        style={[styles.checkbox, done && styles.checkboxDone]}>
        {done && <BakeryCheckEmoji size={13} />}
      </Pressable>

      {task.notifyAt && (
        <View style={styles.taskIcon}>
          <BakeryBellEmoji size={20} />
        </View>
      )}

      <View style={styles.taskCardBody}>
        <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.taskMetaRow}>
          {subject && (
            <View style={[styles.subjectBadge, { backgroundColor: subject.color + '2E' }]}>
              <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
              <Text style={[styles.subjectText, { color: subject.color }]} numberOfLines={1}>
                {subject.name}
              </Text>
            </View>
          )}
          {time && (
            <View style={styles.taskMetaTimeRow}>
              <BakeryBellEmoji size={12} />
              <Text style={styles.taskMetaText}>{time}</Text>
            </View>
          )}
          {task.estimatedMinutes ? <Text style={styles.taskMetaText}>{task.estimatedMinutes}m</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── month grid ──────────────────────────────────────────────────────────────
function CalendarMonthCard({
  monthOffset,
  setMonthOffset,
  onPickDate,
  cellW,
}: {
  monthOffset: number;
  setMonthOffset: (next: number) => void;
  onPickDate: (iso: string) => void;
  cellW: number;
}) {
  const { tasks, subjects, dayNotes, examCountdowns } = useApp();
  const today = todayISO();

  // Map each exam day to its subject colour (falls back to pink) + chosen shape.
  const examByDay = useMemo(() => {
    const map: Record<string, { color: string; shape?: string }> = {};
    for (const e of examCountdowns) {
      const subj = e.subject ? subjects.find((s) => s.name === e.subject) : null;
      map[e.dateISO.slice(0, 10)] = { color: subj?.color ?? '#F4A8C0', shape: e.shape };
    }
    return map;
  }, [examCountdowns, subjects]);

  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = view.toLocaleDateString(i18n.language || 'en-US', { month: 'long', year: 'numeric' });

  const subjectColor = (id: string | null) => (id ? subjects.find((s) => s.id === id)?.color : null) ?? C.jam;

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.status === 'done' || !t.dueDate) continue;
      const start = t.dueDate.slice(0, 10);
      if (t.repeatDays?.length) {
        // A repeating task shows on every matching weekday from its start date
        // through its end date (repeatUntil), expanded across the visible month.
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = toISO(year, month, d);
          if (iso < start) continue;
          if (t.repeatUntil && iso > t.repeatUntil) continue;
          if (t.repeatDays.includes(new Date(`${iso}T00:00:00`).getDay())) {
            (map[iso] ??= []).push(t);
          }
        }
      } else {
        (map[start] ??= []).push(t);
      }
    }
    return map;
  }, [tasks, year, month, daysInMonth]);

  const goMonth = (delta: number) => setMonthOffset(monthOffset + delta);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad the final row with trailing blanks so the last days stay under the
  // correct weekday (otherwise `justifyContent: center` centers a short row).
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={10} style={styles.arrowBtn}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => goMonth(1)} hitSlop={10} style={styles.arrowBtn}>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {weekdayLetters().map((w, i) => (
          <Text key={i} style={[styles.weekday, { width: cellW }]}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={[styles.dayCell, { width: cellW, height: cellW }]} />;
          const iso = toISO(year, month, d);
          const isToday = iso === today;
          const dayTasks = tasksByDay[iso] ?? [];
          const hasNote = !!dayNotes[iso];
          const exam = examByDay[iso];
          const hasExam = !!exam;
          return (
            <Pressable
              key={i}
              onPress={() => onPickDate(iso)}
              style={[styles.dayCell, { width: cellW, height: cellW }]}>
              <View style={[styles.dayInner, isToday && styles.dayToday]}>
                {hasExam && (
                  <View style={styles.examStar} pointerEvents="none">
                    <CountdownShape shape={exam.shape} color={exam.color} size={cellW * 0.92} />
                  </View>
                )}
                <Text style={[styles.dayNum, hasExam && styles.dayNumExam]}>{d}</Text>
                {dayTasks.length > 0 && <Text style={styles.taskCount}>{dayTasks.length}</Text>}
                {hasNote && dayTasks.length === 0 && <View style={styles.noteDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── selected-day preview + note ─────────────────────────────────────────────
// ─── compact horizontal slider of upcoming tasks ─────────────────────────────
function TaskSlider() {
  const { tasks, subjects } = useApp();

  const open = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done')
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
    [tasks],
  );

  if (open.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sliderRow}>
      {open.map((t) => {
        const subject = t.subjectId ? subjects.find((s) => s.id === t.subjectId) : null;
        return (
          <Pressable
            key={t.id}
            style={({ pressed }) => [styles.sliderCard, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/add-task', params: { taskId: t.id } })}>
            <Text style={styles.sliderTitle} numberOfLines={1}>
              {t.title}
            </Text>
            <View style={styles.sliderMeta}>
              {subject && <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />}
              <Text style={styles.sliderMetaText} numberOfLines={1}>
                {t.dueDate ? shortWeekday(t.dueDate.slice(0, 10)) : 'No date'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── tapped-day tasks modal ──────────────────────────────────────────────────
function DayTasksModal({ iso, onClose }: { iso: string | null; onClose: () => void }) {
  const { tasks } = useApp();
  const dayTasks = iso ? tasks.filter((t) => t.dueDate?.slice(0, 10) === iso) : [];

  return (
    <Modal visible={!!iso} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalDate}>{iso ? longLabel(iso) : ''}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          {dayTasks.length > 0 && (
            <View style={styles.previewList}>
              {dayTasks.map((t) => (
                <TaskPreviewCard key={t.id} task={t} />
              ))}
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.modalAddBtn, pressed && styles.pressed]}
            onPress={() => {
              onClose();
              if (iso) router.push({ pathname: '/add-task', params: { date: iso } });
            }}>
            <Text style={styles.modalAddText}>{i18n.t('calendar.addTaskForDay')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── horizontal / search preview (replaces the rotated modal) ────────────────
function HorizontalPreview({ onClose }: { onClose: () => void }) {
  const { tasks } = useApp();
  const [query, setQuery] = useState('');

  // Upcoming days (today onward) that have open tasks, grouped.
  const upcoming = useMemo(() => {
    const map: Record<string, Task[]> = {};
    const today = todayISO();
    for (const t of tasks) {
      if (t.dueDate && t.status !== 'done' && t.dueDate.slice(0, 10) >= today) {
        (map[t.dueDate.slice(0, 10)] ??= []).push(t);
      }
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [query, tasks]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.arrowBtn}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{i18n.t('calendar.searchPreview')}</Text>
        <View style={styles.arrowBtn} />
      </View>

      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder={i18n.t('calendar.searchTasks')}
        placeholderTextColor={C.mocha}
        autoCapitalize="none"
      />

      {query.trim() ? (
        // Filtered results
        matches.length > 0 ? (
          <View style={styles.previewList}>
            {matches.map((t) => (
              <View key={t.id} style={styles.searchResult}>
                {t.dueDate && <Text style={styles.searchResultDate}>{longLabel(t.dueDate.slice(0, 10))}</Text>}
                <TaskPreviewCard task={t} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.searchEmpty}>{i18n.t('calendar.noMatch', { query: query.trim() })}</Text>
        )
      ) : upcoming.length > 0 ? (
        // Horizontal upcoming day cards
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hRow}>
          {upcoming.map(([iso, dayTasks]) => (
            <View key={iso} style={styles.hCard}>
              <Text style={styles.hCardWeekday}>{shortWeekday(iso)}</Text>
              <Text style={styles.hCardDate}>
                {fromISO(iso).toLocaleDateString(i18n.language || 'en-US', { month: 'short', day: 'numeric' })}
              </Text>
              <View style={styles.hCardTasks}>
                {dayTasks.map((t) => (
                  <TaskPreviewCard key={t.id} task={t} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.searchEmpty}>{i18n.t('calendar.noUpcoming')}</Text>
      )}
    </View>
  );
}

// ─── root ────────────────────────────────────────────────────────────────────
export function TaskCalendar() {
  const { width } = useWindowDimensions();
  const [monthOffset, setMonthOffset] = useState(0);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState(false);

  const gridW = Math.min(width, MaxContentWidth) - SCREEN_PAD * 2 - CARD_PAD * 2;
  const cellW = Math.floor(gridW / 7);

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Text style={styles.title}>{i18n.t('calendar.calendar')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.searchBtn, searchMode && styles.searchBtnActive, pressed && styles.pressed]}
          onPress={() => setSearchMode((v) => !v)}
          hitSlop={8}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx="10.5" cy="10.5" r="6.5" stroke={searchMode ? '#FFFFFF' : C.cocoaDark} strokeWidth={2.4} />
            <Path d="M15.6 15.6 L20.5 20.5" stroke={searchMode ? '#FFFFFF' : C.cocoaDark} strokeWidth={2.4} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      {searchMode ? (
        <HorizontalPreview onClose={() => setSearchMode(false)} />
      ) : (
        <>
          <CalendarMonthCard
            monthOffset={monthOffset}
            setMonthOffset={setMonthOffset}
            onPickDate={setModalDate}
            cellW={cellW}
          />
          <TaskSlider />
        </>
      )}

      <DayTasksModal iso={modalDate} onClose={() => setModalDate(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 18, fontWeight: '800', color: C.cocoaDark },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.rose,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.jam,
  },
  searchBtnActive: { backgroundColor: C.jam },
  searchIconImg: { width: 18, height: 18 },

  // Card
  card: {
    backgroundColor: C.glass,
    borderRadius: BakeryRadii.panel,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: CARD_PAD,
    gap: Spacing.two,
    ...BakeryShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrowBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 26, color: C.jam, fontWeight: '800' },
  monthLabel: { fontSize: 16, fontWeight: '800', color: C.cocoaDark },

  weekRow: { flexDirection: 'row', justifyContent: 'center' },
  weekday: { textAlign: 'center', fontSize: 12, color: C.mocha, fontWeight: '700' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.shortbread,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: C.shortbread,
  },
  dayInner: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  dayToday: { backgroundColor: '#FAD4E0' },
  daySelected: { backgroundColor: C.jam },
  examStar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 14, color: C.cocoaDark, fontWeight: '600' },
  dayNumExam: { color: '#fff', fontWeight: '800' },
  dayNumSelected: { color: '#fff', fontWeight: '800' },
  taskCount: { position: 'absolute', bottom: 1, right: 3, fontSize: 9, lineHeight: 10, color: C.mocha, fontWeight: '800' },
  noteDot: { position: 'absolute', bottom: 3, right: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: C.latte },

  // Selected day preview
  previewWrap: { gap: Spacing.two },
  previewDateStrip: {
    alignSelf: 'flex-start',
    backgroundColor: C.cream,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  previewDate: { fontSize: 14, fontWeight: '800', color: C.cocoaDark },
  previewList: { gap: Spacing.two },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: C.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: Spacing.two,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.jam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: C.success, borderColor: C.success },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: '800' },
  taskIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
  taskCardBody: { flex: 1, gap: 3 },
  taskTitle: { fontSize: 15, fontWeight: '700', color: C.cocoaDark, lineHeight: 19 },
  taskTitleDone: { textDecorationLine: 'line-through', color: C.mocha },
  taskMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  subjectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  subjectDot: { width: 6, height: 6, borderRadius: 3 },
  subjectText: { fontSize: 11, fontWeight: '700' },
  taskMetaText: { fontSize: 12, color: C.mocha, fontWeight: '500' },
  taskMetaTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  // Empty state
  emptyCard: {
    backgroundColor: C.glass,
    borderRadius: BakeryRadii.panel,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: Spacing.four,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.cocoaDark },
  emptyText: { fontSize: 13, color: C.mocha, textAlign: 'center' },
  addBtn: {
    marginTop: 6,
    backgroundColor: C.honey,
    borderRadius: BakeryRadii.button,
    paddingHorizontal: Spacing.four,
    paddingVertical: 9,
    ...BakeryShadow,
  },
  addBtnText: { color: C.cocoaDark, fontSize: 14, fontWeight: '800' },

  // Day note
  noteBlock: { gap: 6, marginTop: 2 },
  noteLabel: { fontSize: 13, fontWeight: '700', color: C.cocoa },
  noteInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: BakeryRadii.button,
    padding: 10,
    minHeight: 56,
    color: C.cocoaDark,
    backgroundColor: C.cream,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  noteSaveBtn: {
    alignSelf: 'flex-end',
    backgroundColor: C.jam,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  noteSaveText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Search / horizontal preview
  searchInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: BakeryRadii.button,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: C.cocoaDark,
    backgroundColor: C.cream,
    fontSize: 14,
  },
  hRow: { gap: Spacing.two, paddingVertical: 4, paddingRight: 4 },
  hCard: {
    width: 220,
    backgroundColor: C.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: Spacing.two,
    gap: 6,
  },
  hCardWeekday: { fontSize: 12, color: C.mocha, fontWeight: '700' },
  hCardDate: { fontSize: 16, color: C.cocoaDark, fontWeight: '800' },
  hCardTasks: { gap: 6 },
  searchResult: { gap: 2 },
  searchResultDate: { fontSize: 12, color: C.mocha, fontWeight: '700', paddingLeft: 2 },
  searchEmpty: { fontSize: 13, color: C.mocha, fontStyle: 'italic', paddingVertical: Spacing.three, textAlign: 'center' },

  pressed: { opacity: 0.85 },

  // Compact task slider
  sliderRow: { gap: Spacing.two, paddingVertical: 2, paddingHorizontal: 2 },
  sliderCard: {
    width: 150,
    backgroundColor: C.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 4,
  },
  sliderTitle: { fontSize: 13, fontWeight: '700', color: C.cocoaDark },
  sliderMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sliderMetaText: { fontSize: 11, color: C.mocha, fontWeight: '600', flexShrink: 1 },

  // Tapped-day modal
  modalRoot: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48, 32, 24, 0.35)' },
  modalCard: {
    backgroundColor: C.frosting,
    borderRadius: BakeryRadii.panel,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    padding: Spacing.four,
    gap: Spacing.three,
    ...BakeryShadow,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  modalDate: { flex: 1, fontSize: 16, fontWeight: '800', color: C.cocoaDark },
  modalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.cream,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { fontSize: 14, fontWeight: '800', color: C.cocoaDark },
  modalAddBtn: {
    backgroundColor: C.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    ...BakeryShadow,
  },
  modalAddText: { color: C.cocoaDark, fontSize: 14, fontWeight: '800' },
});
