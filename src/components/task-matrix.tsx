import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { BakeryCheckEmoji } from '@/components/bakery-emoji';
import { FitText } from '@/components/fit-text';
import { PaperCard } from '@/components/paper-card';
import { BakeryColors as C, BakeryRadii, PastelCards, Spacing } from '@/constants/theme';
import { useApp, taskQuadrant, type Task, type TaskQuadrant } from '@/context/app-context';
import i18n from '@/i18n';
import { useTabletScale } from '@/hooks/use-tablet-scale';

// ─── date helpers ────────────────────────────────────────────────────────────
// Deliberately LOCAL, mirroring task-calendar.tsx rather than importing todayISO
// from app-context: that one resolves in the account's captured timezone, while the
// calendar sitting directly above this grid does plain local date math. Mixing the
// two would let the calendar highlight one "today" while the matrix showed another
// across a midnight/timezone boundary.
function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayISO() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
}
/** Shift a YYYY-MM-DD string by whole days via UTC calendar math (DST-safe). */
function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * 86400000).toISOString().split('T')[0];
}
function longLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(i18n.language || 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Rows shown per quadrant before collapsing into a "+N more" line. */
const MAX_ROWS = 5;

// The 2x2 in reading order: the two "important" quadrants on top.
const QUADRANTS: { key: TaskQuadrant; labelKey: string; tint: { fill: string; border: string } }[] = [
  { key: 'urgentImportant', labelKey: 'tasks.quadUrgentImportant', tint: PastelCards.rose },
  { key: 'important', labelKey: 'tasks.quadImportant', tint: PastelCards.peach },
  { key: 'urgent', labelKey: 'tasks.quadUrgent', tint: PastelCards.apricot },
  { key: 'neither', labelKey: 'tasks.quadNeither', tint: PastelCards.honey },
];

/** One task line: tick + title. Deliberately lighter than TaskPreviewCard, which
 *  renders a full bordered card and leaves ~110pt for a title in a phone column. */
function MatrixRow({ task, s }: { task: Task; s: number }) {
  const { subjects, updateTask } = useApp();
  const subject = task.subjectId ? subjects.find((sub) => sub.id === task.subjectId) : null;
  const done = task.status === 'done';
  return (
    <Pressable
      style={({ pressed }) => [styles.row, s !== 1 && { gap: Spacing.two * s }, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/add-task', params: { taskId: task.id } })}>
      <Pressable
        hitSlop={8}
        onPress={() => updateTask(task.id, { status: done ? 'not_started' : 'done' })}
        style={[
          styles.tick,
          s !== 1 && { width: 20 * s, height: 20 * s, borderRadius: 10 * s },
          done && styles.tickDone,
        ]}>
        {done && <BakeryCheckEmoji size={11 * s} />}
      </Pressable>
      {subject && (
        <View
          style={[
            styles.subjectDot,
            s !== 1 && { width: 6 * s, height: 6 * s, borderRadius: 3 * s },
            { backgroundColor: subject.color },
          ]}
        />
      )}
      <FitText style={[styles.rowTitle, s !== 1 && { fontSize: 13 * s }]} numberOfLines={1}>
        {task.title}
      </FitText>
    </Pressable>
  );
}

/**
 * Eisenhower matrix for a single day, sitting under the month calendar on the Tasks
 * screen. It owns its own date (starting today) and its own ‹ › arrows — tapping a
 * day in the calendar above opens that day's popup and deliberately does NOT move
 * this grid.
 */
export function TaskMatrix() {
  const { tasks } = useApp();
  const { isTablet, scale } = useTabletScale();
  const s = isTablet ? scale : 1;
  const [dayISO, setDayISO] = useState(todayISO());

  const buckets = useMemo(() => {
    // Plain dueDate equality, matching the day popup. Repeating tasks are NOT
    // expanded onto future days: these rows carry a live checkbox, and ticking an
    // expanded occurrence would mark the single underlying task done everywhere.
    const open = tasks.filter((t) => t.status !== 'done' && t.dueDate?.slice(0, 10) === dayISO);
    const sorted = [...open].sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'));
    const map = {} as Record<TaskQuadrant, Task[]>;
    for (const q of QUADRANTS) map[q.key] = [];
    for (const t of sorted) map[taskQuadrant(t)].push(t);
    return map;
  }, [tasks, dayISO]);

  const total = QUADRANTS.reduce((n, q) => n + buckets[q.key].length, 0);

  return (
    <View style={styles.root}>
      {/* ‹ date › — this grid's own day control, independent of the calendar above */}
      <View style={styles.header}>
        <Pressable onPress={() => setDayISO((d) => addDaysISO(d, -1))} hitSlop={10} style={styles.arrowBtn}>
          <Text style={[styles.arrow, s !== 1 && { fontSize: 26 * s }]}>‹</Text>
        </Pressable>
        <Text style={[styles.dayLabel, s !== 1 && { fontSize: 15 * s }]} numberOfLines={1}>
          {longLabel(dayISO)}
        </Text>
        <Pressable onPress={() => setDayISO((d) => addDaysISO(d, 1))} hitSlop={10} style={styles.arrowBtn}>
          <Text style={[styles.arrow, s !== 1 && { fontSize: 26 * s }]}>›</Text>
        </Pressable>
      </View>

      {/* Two rows of two. flex:1 keeps the pair equal width AND equal height. */}
      {[0, 2].map((start) => (
        <View key={start} style={[styles.gridRow, s !== 1 && { gap: Spacing.two * s }]}>
          {QUADRANTS.slice(start, start + 2).map((q) => {
            const items = buckets[q.key];
            const shown = items.slice(0, MAX_ROWS);
            const extra = items.length - shown.length;
            return (
              <PaperCard
                key={q.key}
                flat
                fill={q.tint.fill}
                borderColor={q.tint.border}
                radius={BakeryRadii.card * s}
                strokeWidth={1.5}
                style={[styles.quadrant, s !== 1 && { padding: Spacing.two * s, gap: 4 * s, minHeight: 96 * s }]}>
                <Text style={[styles.quadrantTitle, s !== 1 && { fontSize: 11.5 * s }]} numberOfLines={1}>
                  {i18n.t(q.labelKey)}
                </Text>
                {shown.map((t) => (
                  <MatrixRow key={t.id} task={t} s={s} />
                ))}
                {extra > 0 && (
                  <Text style={[styles.more, s !== 1 && { fontSize: 11 * s }]}>
                    {i18n.t('tasks.matrixMore', { count: extra })}
                  </Text>
                )}
              </PaperCard>
            );
          })}
        </View>
      ))}

      {total === 0 && (
        <Text style={[styles.emptyDay, s !== 1 && { fontSize: 12.5 * s }]}>{i18n.t('tasks.matrixEmptyDay')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  arrowBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 26, color: C.jam, fontWeight: '800' },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: C.cocoaDark },
  // 2x2 on every device — the 2x2 IS the Eisenhower semantic, so it never reflows
  // to a single column. The content column is capped (800 phone / 1100 tablet).
  gridRow: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.two },
  quadrant: { flex: 1, padding: Spacing.two, gap: 4, minHeight: 96 },
  quadrantTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: C.mocha,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: C.cocoaDark },
  tick: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.jam, alignItems: 'center', justifyContent: 'center' },
  tickDone: { backgroundColor: C.success, borderColor: C.success },
  subjectDot: { width: 6, height: 6, borderRadius: 3 },
  more: { fontSize: 11, color: C.latte, fontWeight: '700' },
  emptyDay: { fontSize: 12.5, color: C.latte, fontWeight: '600', textAlign: 'center', paddingTop: Spacing.one },
  pressed: { opacity: 0.6 },
});
