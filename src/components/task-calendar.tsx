import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { useApp } from '@/context/app-context';
import type { Task } from '@/context/app-context';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

const C = BakeryColors;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
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
  return fromISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function shortWeekday(iso: string) {
  return fromISO(iso).toLocaleDateString('en-US', { weekday: 'short' });
}
function formatTime(notifyAt: string | null) {
  if (!notifyAt) return null;
  const d = new Date(notifyAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── shared task preview card ────────────────────────────────────────────────
function TaskPreviewCard({ task }: { task: Task }) {
  const { subjects, updateTask } = useApp();
  const subject = task.subjectId ? subjects.find((s) => s.id === task.subjectId) : null;
  const done = task.status === 'done';
  const time = formatTime(task.notifyAt);

  return (
    <Pressable
      style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/add-task', params: { taskId: task.id } })}>
      {/* completion checkbox */}
      <Pressable
        hitSlop={8}
        onPress={() => updateTask(task.id, { status: done ? 'not_started' : 'done' })}
        style={[styles.checkbox, done && styles.checkboxDone]}>
        {done && <Text style={styles.checkboxTick}>✓</Text>}
      </Pressable>

      <Text style={styles.taskIcon}>{task.notifyAt ? '🔔' : '🧁'}</Text>

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
          {time && <Text style={styles.taskMetaText}>🔔 {time}</Text>}
          {task.estimatedMinutes ? <Text style={styles.taskMetaText}>⏱ {task.estimatedMinutes}m</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── month grid ──────────────────────────────────────────────────────────────
function CalendarMonthCard({
  monthOffset,
  setMonthOffset,
  selected,
  setSelected,
  cellW,
  onSearch,
}: {
  monthOffset: number;
  setMonthOffset: (next: number) => void;
  selected: string;
  setSelected: (iso: string) => void;
  cellW: number;
  onSearch: () => void;
}) {
  const { tasks, subjects, dayNotes } = useApp();
  const today = todayISO();

  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const subjectColor = (id: string | null) => (id ? subjects.find((s) => s.id === id)?.color : null) ?? C.jam;

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.dueDate && t.status !== 'done') (map[t.dueDate.slice(0, 10)] ??= []).push(t);
    }
    return map;
  }, [tasks]);

  // Navigate a month and keep a sensible selected day.
  const goMonth = (delta: number) => {
    const next = monthOffset + delta;
    const nv = new Date(base.getFullYear(), base.getMonth() + next, 1);
    if (nv.getFullYear() === base.getFullYear() && nv.getMonth() === base.getMonth()) {
      setSelected(today);
    } else {
      setSelected(toISO(nv.getFullYear(), nv.getMonth(), 1));
    }
    setMonthOffset(next);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

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
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.weekday, { width: cellW }]}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={{ width: cellW, height: cellW }} />;
          const iso = toISO(year, month, d);
          const isToday = iso === today;
          const isSelected = iso === selected;
          const dayTasks = tasksByDay[iso] ?? [];
          const hasNote = !!dayNotes[iso];
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(iso)}
              style={[styles.dayCell, { width: cellW, height: cellW }]}>
              <View
                style={[
                  styles.dayInner,
                  isToday && styles.dayToday,
                  isSelected && styles.daySelected,
                ]}>
                <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{d}</Text>
                <View style={styles.dotRow}>
                  {dayTasks.slice(0, 3).map((t, di) => (
                    <View
                      key={t.id + di}
                      style={[
                        styles.dot,
                        { backgroundColor: isSelected ? '#fff' : subjectColor(t.subjectId) },
                      ]}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <Text style={[styles.dotMore, isSelected && { color: '#fff' }]}>+</Text>
                  )}
                  {hasNote && dayTasks.length === 0 && (
                    <View style={[styles.dot, { backgroundColor: isSelected ? '#fff' : C.latte }]} />
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── selected-day preview + note ─────────────────────────────────────────────
function SelectedDayPreview({ iso }: { iso: string }) {
  const { tasks, dayNotes, setDayNote } = useApp();
  const [note, setNote] = useState(dayNotes[iso] ?? '');
  const [savedNote, setSavedNote] = useState(false);

  const dayTasks = tasks.filter((t) => t.dueDate?.slice(0, 10) === iso);

  return (
    <View style={styles.previewWrap}>
      <Text style={styles.previewDate}>{longLabel(iso)}</Text>

      {dayTasks.length > 0 ? (
        <View style={styles.previewList}>
          {dayTasks.map((t) => (
            <TaskPreviewCard key={t.id} task={t} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🧁</Text>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptyText}>Add your first task to stay organized.</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/add-task', params: { date: iso } })}>
            <Text style={styles.addBtnText}>+ Add task</Text>
          </Pressable>
        </View>
      )}

      {/* Day note */}
      <View style={styles.noteBlock}>
        <Text style={styles.noteLabel}>📝 Note for this day</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={(v) => { setNote(v); setSavedNote(false); }}
          placeholder="Jot something down…"
          placeholderTextColor={C.mocha}
          multiline
        />
        <Pressable
          style={({ pressed }) => [styles.noteSaveBtn, pressed && styles.pressed]}
          onPress={() => { setDayNote(iso, note); setSavedNote(true); }}>
          <Text style={styles.noteSaveText}>{savedNote ? '✓ Saved' : 'Save note'}</Text>
        </Pressable>
      </View>
    </View>
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
        <Text style={styles.monthLabel}>Search & preview</Text>
        <View style={styles.arrowBtn} />
      </View>

      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder="Search tasks…"
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
          <Text style={styles.searchEmpty}>No tasks match “{query.trim()}”.</Text>
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
                {fromISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
        <Text style={styles.searchEmpty}>No upcoming tasks. Add one to see it here. 🧁</Text>
      )}
    </View>
  );
}

// ─── root ────────────────────────────────────────────────────────────────────
export function TaskCalendar() {
  const { width } = useWindowDimensions();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string>(todayISO());
  const [searchMode, setSearchMode] = useState(false);

  const gridW = Math.min(width, MaxContentWidth) - SCREEN_PAD * 2 - CARD_PAD * 2;
  const cellW = Math.floor(gridW / 7);

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>🍰 Calendar</Text>
        <Pressable
          style={({ pressed }) => [styles.searchBtn, searchMode && styles.searchBtnActive, pressed && styles.pressed]}
          onPress={() => setSearchMode((v) => !v)}
          hitSlop={8}>
          <Text style={styles.searchIcon}>🔍</Text>
        </Pressable>
      </View>

      {searchMode ? (
        <HorizontalPreview onClose={() => setSearchMode(false)} />
      ) : (
        <>
          <CalendarMonthCard
            monthOffset={monthOffset}
            setMonthOffset={setMonthOffset}
            selected={selected}
            setSelected={setSelected}
            cellW={cellW}
            onSearch={() => setSearchMode(true)}
          />
          <SelectedDayPreview key={selected} iso={selected} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  searchIcon: { fontSize: 16 },

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

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dayCell: { alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayInner: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    gap: 2,
  },
  dayToday: { backgroundColor: C.rose },
  daySelected: { backgroundColor: C.jam },
  dayNum: { fontSize: 14, color: C.cocoaDark, fontWeight: '600' },
  dayNumSelected: { color: '#fff', fontWeight: '800' },
  dotRow: { flexDirection: 'row', gap: 2, alignItems: 'center', height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotMore: { fontSize: 10, lineHeight: 10, color: C.berry, fontWeight: '800' },

  // Selected day preview
  previewWrap: { gap: Spacing.two },
  previewDate: { fontSize: 15, fontWeight: '800', color: C.cocoaDark, paddingLeft: 2 },
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
  taskIcon: { fontSize: 20 },
  taskCardBody: { flex: 1, gap: 3 },
  taskTitle: { fontSize: 15, fontWeight: '700', color: C.cocoaDark, lineHeight: 19 },
  taskTitleDone: { textDecorationLine: 'line-through', color: C.mocha },
  taskMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  subjectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  subjectDot: { width: 6, height: 6, borderRadius: 3 },
  subjectText: { fontSize: 11, fontWeight: '700' },
  taskMetaText: { fontSize: 12, color: C.mocha, fontWeight: '500' },

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
});
