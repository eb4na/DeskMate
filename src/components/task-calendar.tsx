import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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

import { CountdownShape, COUNTDOWN_SHAPES, DAY_SHAPES, EXAM_SHAPE, NO_SHAPE, DEFAULT_COUNTDOWN_SHAPE } from '@/components/countdown-shapes';

// Label ink for a filled subject chip. Subject colours span pale yellows to mid
// purples, so neither white nor brown works on all of them — measure the WCAG
// contrast of both against the fill and keep the better one, rather than guessing
// from a lightness threshold (a mid blue like #64B5F6 fools a naive threshold:
// it reads "light enough for white" while brown is actually twice the contrast).
function inkOn(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const chan = (i: number) => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * chan(0) + 0.7152 * chan(1) + 0.0722 * chan(2);
  const vsWhite = 1.05 / (L + 0.05);
  const vsBrown = (L + 0.05) / (0.0648 + 0.05); // 0.0648 = luminance of cocoaDark
  return vsWhite >= vsBrown ? '#FFFFFF' : BakeryColors.cocoaDark;
}

import {
  BakeryCakeEmoji,
  BakeryCalendarEmoji,
  BakeryCheckEmoji,
} from '@/components/bakery-emoji';
import { useApp } from '@/context/app-context';
import type { ExamCountdown, Task } from '@/context/app-context';
import i18n from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { formatMinutesShort } from '@/lib/format-duration';
import { formatTimeLabel } from '@/components/time-wheel-picker';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, PastelCards, Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { MODAL_SETTLE_MS, useReportModalTransition } from '@/lib/modal-traffic';


const C = BakeryColors;
const weekdayLetters = () => [0, 1, 2, 3, 4, 5, 6].map((i) => i18n.t(`calendar.wd_${i}`));
const SCREEN_PAD = Spacing.four;
const CARD_PAD = 14;

// The calendar card's own background — chips blend toward THIS, not white, so an
// opaque chip sits invisibly on the grid.
const CARD_BG = '#FEF8F1';

// Opaque tint: `hex` mixed `t` of the way toward the card background (t=1 → the
// background itself). Chips must stay OPAQUE — an exam day paints a big watermark
// shape behind them, and an alpha fill would let that bleed through the label.
function tint(hex: string, t: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const to = CARD_BG.replace('#', '');
  const mix = (i: number) => {
    const a = parseInt(full.slice(i * 2, i * 2 + 2), 16);
    const b = parseInt(to.slice(i * 2, i * 2 + 2), 16);
    return Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  };
  return `#${mix(0)}${mix(1)}${mix(2)}`;
}

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
// The time shown on a task card: its own due time when it has one, otherwise the
// moment a hand-picked reminder fires. (It used to read notifyAt only, which shows
// nothing for a task on automatic reminders — those carry no notifyAt.)
function formatTime(task: Pick<Task, 'dueTime' | 'notifyAt'>, use24Hour: boolean) {
  const d = new Date();
  if (task.dueTime) {
    const parsed = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(task.dueTime.trim());
    if (!parsed) return null;
    d.setHours(Number(parsed[1]), Number(parsed[2]), 0, 0);
  } else {
    if (!task.notifyAt) return null;
    const at = new Date(task.notifyAt);
    if (isNaN(at.getTime())) return null;
    d.setTime(at.getTime());
  }
  return d.toLocaleTimeString(i18n.language || 'en-US', { hour: 'numeric', minute: '2-digit', hour12: !use24Hour });
}

// ─── one place decides what lands on a day ───────────────────────────────────
// The month grid used to expand `repeatDays` while the day popup and the strip
// below matched on the raw dueDate, so a repeating task could show in the grid and
// then open an empty day. Every caller goes through this predicate now.
function taskFallsOn(t: Task, iso: string) {
  if (!t.dueDate) return false;
  const start = t.dueDate.slice(0, 10);
  if (t.repeatDays?.length) {
    if (iso < start) return false;
    if (t.repeatUntil && iso > t.repeatUntil) return false;
    return t.repeatDays.includes(fromISO(iso).getDay());
  }
  return start === iso;
}
function tasksOnDay(tasks: Task[], iso: string, includeDone: boolean) {
  return tasks.filter((t) => (includeDone || t.status !== 'done') && taskFallsOn(t, iso));
}

function clampN(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── shared task preview card ────────────────────────────────────────────────
// `onNavigate` (set only when this card lives INSIDE the day modal) routes the
// edit tap through the modal's dismiss-then-navigate path so add-task never
// presents on top of the still-open native modal (which wedges iOS).
function TaskPreviewCard({ task, onNavigate }: { task: Task; onNavigate?: (go: () => void) => void }) {
  const { subjects, updateTask, use24HourTime } = useApp();
  // The day popup grows on tablet, so its content rows must grow with it.
  const { isTablet, scale } = useTabletScale();
  const c = isTablet ? scale : 1;
  const subject = task.subjectId ? subjects.find((s) => s.id === task.subjectId) : null;
  const done = task.status === 'done';
  const time = formatTime(task, use24HourTime);

  return (
    <Pressable
      style={({ pressed }) => [styles.taskCard, c !== 1 && { padding: Spacing.two * c, gap: Spacing.two * c, borderRadius: BakeryRadii.card * c }, pressed && styles.pressed]}
      onPress={() => {
        const go = () => router.push({ pathname: '/add-task', params: { taskId: task.id } });
        onNavigate ? onNavigate(go) : go();
      }}>
      {/* completion checkbox */}
      <Pressable
        hitSlop={8}
        onPress={() => updateTask(task.id, { status: done ? 'not_started' : 'done' })}
        style={[styles.checkbox, c !== 1 && { width: 24 * c, height: 24 * c, borderRadius: 12 * c }, done && styles.checkboxDone]}>
        {done && <BakeryCheckEmoji size={13 * c} />}
      </Pressable>

      <View style={styles.taskCardBody}>
        <Text style={[styles.taskTitle, c !== 1 && { fontSize: 15 * c, lineHeight: 19 * c }, done && styles.taskTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.taskMetaRow}>
          {subject && (
            <View style={[styles.subjectBadge, c !== 1 && { paddingHorizontal: 8 * c, paddingVertical: 2 * c, borderRadius: 8 * c, gap: 4 * c }, { backgroundColor: subject.color + '2E' }]}>
              <View style={[styles.subjectDot, c !== 1 && { width: 6 * c, height: 6 * c, borderRadius: 3 * c }, { backgroundColor: subject.color }]} />
              <Text style={[styles.subjectText, c !== 1 && { fontSize: 11 * c }, { color: subject.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {localizeSubjectName(subject.name, (k) => i18n.t(k))}
              </Text>
            </View>
          )}
          {time && <Text style={[styles.taskMetaText, c !== 1 && { fontSize: 12 * c }]}>{time}</Text>}
          {task.estimatedMinutes ? <Text style={styles.taskMetaText}>{formatMinutesShort(task.estimatedMinutes, (k, o) => i18n.t(k, o))}</Text> : null}
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
  cardPad,
  isTablet,
  scale = 1,
}: {
  monthOffset: number;
  setMonthOffset: (next: number) => void;
  onPickDate: (iso: string) => void;
  cellW: number;
  cardPad: number;
  isTablet: boolean;
  // Proportional tablet scale (1 on phone). Scales the card chrome (arrows, month
  // label, padding) so the whole calendar grows at the same ratio as the grid.
  scale?: number;
}) {
  const { tasks, subjects, dayNotes, dayShapes, daySubjects, examCountdowns } = useApp();
  const today = todayISO();

  // Every countdown on a day, closest-to-now first. Each renders as its own chip,
  // so a day with two exams shows both — the old cell could only draw one shape and
  // demoted the second to a corner dot.
  const examsByDay = useMemo(() => {
    const now = Date.now();
    const at = (e: ExamCountdown) =>
      new Date(`${e.dateISO.slice(0, 10)}T${e.time ?? '00:00'}:00`).getTime();
    const map: Record<string, ExamCountdown[]> = {};
    for (const e of examCountdowns) (map[e.dateISO.slice(0, 10)] ??= []).push(e);
    for (const day of Object.keys(map)) {
      map[day].sort((a, b) => Math.abs(at(a) - now) - Math.abs(at(b) - now));
    }
    return map;
  }, [examCountdowns]);
  const examColor = (e: ExamCountdown) =>
    (e.subject ? subjects.find((s) => s.name === e.subject)?.color : null) ?? '#F4A8C0';

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
      // Done tasks stay in the grid (struck through) — only undated ones can't
      // be placed on a day.
      if (!t.dueDate) continue;
      if (t.repeatDays?.length) {
        // A repeating task shows on every matching weekday from its start date
        // through its end date (repeatUntil), expanded across the visible month.
        // Only repeating tasks pay for the day loop — this stays one pass over
        // `tasks`, not a filter per cell.
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = toISO(year, month, d);
          if (taskFallsOn(t, iso)) (map[iso] ??= []).push(t);
        }
      } else {
        (map[t.dueDate.slice(0, 10)] ??= []).push(t);
      }
    }
    // Open tasks lead each day: a cell only shows `slots` chips, and a finished
    // task must never be the reason an open one is hidden behind "+N".
    for (const iso of Object.keys(map)) {
      map[iso].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
    }
    return map;
  }, [tasks, year, month, daysInMonth]);

  const goMonth = (delta: number) => setMonthOffset(monthOffset + delta);

  // ── cell metrics: ratios of cellW, never fixed pixels ─────────────────────
  // cellW is already derived from the device's screen width (and, on tablet, from
  // the scaled content column), so it IS the screen-size ratio — a small phone, a
  // big phone and an iPad each get type proportional to their own display. Nothing
  // here multiplies by `scale` as well; that would double-count on tablet. The
  // upper clamps exist because tablet cells grow faster than tablet type should.
  const CHIP_FONT = clampN(Math.round(cellW * 0.2), 8, 15);
  const CHIP_H = Math.round(CHIP_FONT * 1.3);
  const CHIP_GAP = Math.max(1, Math.round(cellW * 0.03));
  const CHIP_PAD_H = Math.max(2, Math.round(cellW * 0.05));
  const OVERFLOW_FT = Math.max(8, Math.round(CHIP_FONT * 0.85));
  const DAYNUM_FT = clampN(Math.round(cellW * 0.26), 11, 20);
  const DAYNUM_H = Math.round(DAYNUM_FT * 1.25);
  const PAD_V = Math.max(2, Math.round(cellW * 0.035));
  // The day's shape, drawn behind the date. dayCell CLIPS (overflow:hidden) and the
  // date row sits PAD_V from the cell's top, so the mark's ink can only reach
  // DAYNUM_H/2 + PAD_V above the row's centre before it gets cut off. The ink spans
  // ~62% of the SVG box (the shapes' Bézier CONTROL points sit near the edge of the
  // 24x24 viewBox and a curve never reaches its control point), so divide by that
  // to turn the room available into a box size. Whichever is smaller wins.
  // The corner mark — the day's ONLY marked-state signal now, so it carries a
  // little more weight than a pure accent would, while still staying clear of
  // the date's size so the two read as separate things.
  const CORNER_MARK = clampN(Math.round(cellW * 0.30), 12, 20);
  // The star inside an exam chip — bounded by the chip's own height so it can
  // never push the row taller than the text it sits beside.
  const CHIP_STAR = clampN(Math.round(CHIP_H * 0.86), 7, 14);
  const DOT = Math.max(5, Math.round(cellW * 0.13));

  // Cells stay SQUARE — the calendar keeps the footprint it always had; the chips
  // fill the room the centred day number used to waste. So the chip count is
  // whatever a square cell holds, and the "+N" rides on the day-number row rather
  // than costing a whole chip's worth of height.
  const cellH = cellW;
  const rowH = CHIP_H + CHIP_GAP; // each chip carries its own marginTop
  const inner = cellH - DAYNUM_H - PAD_V * 2;
  const slots = clampN(Math.floor(inner / rowH), 1, isTablet ? 6 : 3);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad the final row with trailing blanks so the last days stay under the
  // correct weekday (otherwise `justifyContent: center` centers a short row).
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View
      style={[
        styles.card,
        // Phone: break out of the screen's 24pt side padding and shrink the card's
        // own padding, so the seven cells get the width their chips need
        // (44pt → 52pt on a 390pt phone). Tablet keeps the tuned padding.
        !isTablet && { marginHorizontal: -PHONE_BREAKOUT, padding: cardPad },
        scale !== 1 && { width: cellW * 7 + 2 * CARD_PAD * scale, alignSelf: 'center', padding: CARD_PAD * scale, gap: Spacing.two * scale },
      ]}>
      <View style={[styles.cardHeader, scale !== 1 && { width: cellW * 7, alignSelf: 'center' }]}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={10} style={styles.arrowBtn}>
          <Text style={[styles.arrow, scale !== 1 && { fontSize: 26 * scale }]}>‹</Text>
        </Pressable>
        <Text style={[styles.monthLabel, scale !== 1 && { fontSize: 16 * scale }]}>{monthLabel}</Text>
        <Pressable onPress={() => goMonth(1)} hitSlop={10} style={styles.arrowBtn}>
          <Text style={[styles.arrow, scale !== 1 && { fontSize: 26 * scale }]}>›</Text>
        </Pressable>
      </View>

      <View style={[styles.weekRow, { width: cellW * 7 }]}>
        {weekdayLetters().map((w, i) => (
          <Text key={i} style={[styles.weekday, { width: cellW, fontSize: Math.round(cellW * 0.26) }]}>{w}</Text>
        ))}
      </View>

      <View style={[styles.grid, { width: cellW * 7 + 2 }]}>
        {cells.map((d, i) => {
          // Internal gridlines only — skip the top edge on row 0 and the left
          // edge on column 0 so the rounded frame border is the sole perimeter.
          const cellBorder = {
            borderTopWidth: i >= 7 ? 1 : 0,
            borderLeftWidth: i % 7 !== 0 ? 1 : 0,
          };
          if (d === null) return <View key={i} style={[styles.dayCell, cellBorder, { width: cellW, height: cellH }]} />;
          const iso = toISO(year, month, d);
          const isToday = iso === today;
          const dayTasks = tasksByDay[iso] ?? [];
          const dayExams = examsByDay[iso] ?? [];
          // The date itself turns red when this day carries an unfinished deadline
          // (isDeadline !== false; legacy dated tasks count). tasksByDay now keeps
          // done tasks for the struck-through chips, so this has to skip them.
          const hasDeadline = dayTasks.some((t) => t.status !== 'done' && t.isDeadline !== false);
          const hasNote = !!dayNotes[iso];
          // Exams lead the stack (they're the day's fixed points), then open tasks.
          const chips = [
            ...dayExams.map((e) => ({ key: `e${e.id}`, label: e.name, color: examColor(e), isExam: true, done: false })),
            ...dayTasks.map((t) => ({ key: `t${t.id}`, label: t.title, color: subjectColor(t.subjectId), isExam: false, done: t.status === 'done' })),
          ];
          // A day can be marked with a big shape filling the whole cell as a
          // translucent watermark — the date and previews paint on top of it. ANY
          // day can have one, picked from the day popup, not just exam days: the
          // per-day pick (dayShapes) wins, and an exam's own `shape` is the
          // fallback so exam days that were never picked keep their mark.
          // Being a background layer, it costs no chip slot.
          const dayExam = dayExams.length ? dayExams[0] : null;
          // An exam day is marked with a star by DEFAULT, but the player can pick
          // something else for it — an explicit choice always wins. A day with no
          // exam and no pick carries no mark at all.
          const picked = dayShapes[iso];
          const markShape = picked === NO_SHAPE ? null : (picked ?? (dayExam ? EXAM_SHAPE : null));
          // Tint follows the same precedence: the subject picked for this day wins,
          // then the exam's subject, then the day's first task's, then a soft
          // default so a bare mark still reads.
          const markColor = daySubjects[iso]
            ? subjectColor(daySubjects[iso])
            : dayExam
              ? examColor(dayExam)
              : dayTasks.length
                ? subjectColor(dayTasks[0].subjectId)
                : '#F4A8C0';
          const shown = Math.min(chips.length, slots);
          const overflow = chips.length - shown;
          return (
            <Pressable
              key={i}
              onPress={() => onPickDate(iso)}
              style={[
                styles.dayCell,
                cellBorder,
                { width: cellW, height: cellH, padding: PAD_V },
              ]}>
              {/* The day's mark, in the corner opposite the date so the two can
                  never collide — which is what made the old behind-the-number
                  version read as ragged. The cell itself stays untinted, so a
                  heavily-marked month doesn't turn patchy. */}
              {markShape && (
                <View style={[styles.cornerMark, { top: PAD_V, right: PAD_V }]} pointerEvents="none">
                  <CountdownShape shape={markShape} color={markColor} size={CORNER_MARK} />
                </View>
              )}
              {/* The date leads the row and the "+N" closes it, so the overflow
                  count costs no vertical room in a square cell. */}
              <View style={[styles.dayNumRow, { height: DAYNUM_H }]}>
                <View
                  style={[
                    styles.dayNumBadge,
                    { minWidth: DAYNUM_H, height: DAYNUM_H, borderRadius: DAYNUM_H / 2 },
                  ]}>
                  <Text
                    style={[
                      styles.dayNum,
                      { fontSize: DAYNUM_FT },
                      isToday && styles.dayNumToday,
                      // Red LAST so a deadline still reads on today's bold date.
                      hasDeadline && styles.dayNumDeadline,
                    ]}>
                    {d}
                  </Text>
                </View>
                {hasNote && (
                  <View
                    style={[styles.noteDot, { width: DOT * 0.66, height: DOT * 0.66, borderRadius: DOT * 0.33 }]}
                    pointerEvents="none"
                  />
                )}
                {/* Bare numeral on purpose — a translated "5 more" ("他5件", "+5 más")
                    does not fit ~40pt, and this needs no key in all seven locales.
                    Floated right so it can't push the date off-centre. */}
                {overflow > 0 && (
                  <Text
                    style={[
                      styles.overflowText,
                      styles.overflowFloat,
                      // Step left past the corner mark when the day has one —
                      // they both want the top-right otherwise.
                      { fontSize: OVERFLOW_FT, right: markShape ? CORNER_MARK + 2 : 0 },
                    ]}>{`+${overflow}`}</Text>
                )}
              </View>

              {chips.slice(0, shown).map((c) => (
                <View
                  key={c.key}
                  style={[
                    styles.chip,
                    c.isExam && [styles.chipExam, { borderColor: c.color }],
                    {
                      height: CHIP_H,
                      borderRadius: Math.max(2, Math.round(CHIP_H * 0.25)),
                      paddingHorizontal: CHIP_PAD_H,
                      marginTop: CHIP_GAP,
                      gap: Math.max(1, Math.round(CHIP_PAD_H * 0.6)),
                      // Opaque, not translucent: matches the old alpha look but
                      // hides the exam watermark behind it. Finished tasks fade
                      // further back, so the day still reads as "what's left".
                      backgroundColor: tint(c.color, c.done ? 0.91 : 0.82),
                    },
                  ]}>
                  {/* Exam chips lead with a star, so an exam is identifiable inside
                      the cell as well as by the day's corner mark — the outline alone
                      was easy to miss at chip size. */}
                  {c.isExam && <CountdownShape shape={EXAM_SHAPE} color={c.color} size={CHIP_STAR} />}
                  {/* Deliberately truncated, not shrunk-to-fit: a month cell is a
                      glance, and the day popup carries the full title. */}
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.chipText,
                      { fontSize: CHIP_FONT, lineHeight: Math.round(CHIP_FONT * 1.2), color: c.color },
                      c.done && styles.chipTextDone,
                    ]}>
                    {c.label}
                  </Text>
                </View>
              ))}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── selected-day preview + note ─────────────────────────────────────────────
// ─── compact horizontal slider of upcoming tasks ─────────────────────────────
// ─── shared exam preview card ────────────────────────────────────────────────
function ExamPreviewCard({ exam, onNavigate }: { exam: ExamCountdown; onNavigate?: (go: () => void) => void }) {
  const { subjects, use24HourTime } = useApp();
  const subject = exam.subject ? subjects.find((s) => s.name === exam.subject) : null;
  const color = subject?.color ?? '#F4A8C0';
  const time = exam.time ? formatTime({ dueTime: exam.time, notifyAt: null }, use24HourTime) : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
      onPress={() => {
        const go = () => router.push({ pathname: '/add-exam', params: { examId: exam.id } });
        onNavigate ? onNavigate(go) : go();
      }}>
      <View style={styles.taskIcon}>
        <CountdownShape shape={exam.shape} color={color} size={22} />
      </View>
      <View style={styles.taskCardBody}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {exam.name}
        </Text>
        <View style={styles.taskMetaRow}>
          {subject && (
            <View style={[styles.subjectBadge, { backgroundColor: color + '2E' }]}>
              <View style={[styles.subjectDot, { backgroundColor: color }]} />
              <Text style={[styles.subjectText, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {localizeSubjectName(exam.subject, (k) => i18n.t(k))}
              </Text>
            </View>
          )}
          {time && <Text style={styles.taskMetaText}>{time}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

// ─── tapped-day tasks modal ──────────────────────────────────────────────────
function DayTasksModal({ iso, onClose }: { iso: string | null; onClose: () => void }) {
  const { tasks, examCountdowns, use24HourTime, subjects, dayShapes, setDayShape, daySubjects, setDaySubject } = useApp();
  const { height: winH } = useWindowDimensions();
  // The popup is a fixed phone-sized card, which reads tiny on a big tablet —
  // scale its padding, type and controls with the rest of the screen.
  const { isTablet, scale: tScale } = useTabletScale();
  const ms = isTablet ? tScale : 1;
  useReportModalTransition(!!iso);
  // Opening add/edit (a modal SCREEN) while this native modal is still presented —
  // or mid-dismiss — wedges iOS (present-over-present), leaving the calendar frozen
  // to taps. So close this modal FIRST and run the queued navigation only once it's
  // fully gone: the Modal's onDismiss (iOS) fires it; a settle-window timeout is the
  // fallback for Android (no onDismiss) and transparent-modal edge cases. Guarded by
  // clearing the ref so the two triggers can't double-navigate.
  const pendingNav = useRef<(() => void) | null>(null);
  const runPendingNav = () => {
    const go = pendingNav.current;
    pendingNav.current = null;
    go?.();
  };
  const navigateAfterClose = (go: () => void) => {
    pendingNav.current = go;
    onClose();
    setTimeout(runPendingNav, MODAL_SETTLE_MS);
  };
  // Same derivation the grid uses, so a repeating task's cell chip always opens a
  // day that actually lists it. `true` keeps completed tasks visible here.
  const dayTasks = iso ? tasksOnDay(tasks, iso, true) : [];
  const dayExams = iso ? examCountdowns.filter((e) => e.dateISO.slice(0, 10) === iso) : [];

  // Time-blocking agenda: tasks with a time laid out in chronological order (each
  // with its time in a left gutter), then the untimed ones grouped under "Anytime".
  const timedTasks = dayTasks
    .filter((t) => t.dueTime)
    .sort((a, b) => (a.dueTime ?? '').localeCompare(b.dueTime ?? ''));
  const untimedTasks = dayTasks.filter((t) => !t.dueTime);

  return (
    <Modal visible={!!iso} transparent animationType="fade" onRequestClose={onClose} onDismiss={runPendingNav}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalCard, ms !== 1 && { padding: Spacing.four * ms, gap: Spacing.three * ms, maxWidth: 720, width: '100%', alignSelf: 'center' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalDate, ms !== 1 && { fontSize: 16 * ms }]}>{iso ? longLabel(iso) : ''}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.modalClose, ms !== 1 && { width: 30 * ms, height: 30 * ms, borderRadius: 15 * ms }]}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          {(dayExams.length > 0 || dayTasks.length > 0) && (
            // Bound the agenda to ~half the screen so a packed day scrolls inside the
            // card (scroll bar = "what's next" slider) instead of overflowing it and
            // pushing the Add-task button off screen.
            <ScrollView
              style={{ maxHeight: winH * 0.5 }}
              contentContainerStyle={styles.previewList}
              showsVerticalScrollIndicator
              bounces={false}>
              {dayExams.map((e) => (
                <ExamPreviewCard key={e.id} exam={e} onNavigate={navigateAfterClose} />
              ))}
              {/* Timed tasks — chronological, with a time gutter on the left. */}
              {timedTasks.map((t) => (
                <View key={t.id} style={styles.agendaRow}>
                  <Text style={styles.agendaTime}>{formatTimeLabel(t.dueTime!, use24HourTime)}</Text>
                  <View style={styles.agendaCard}>
                    <TaskPreviewCard task={t} onNavigate={navigateAfterClose} />
                  </View>
                </View>
              ))}
              {/* Untimed tasks — grouped under an "Anytime" heading. When there are
                  also timed tasks, indent this group by the time-gutter width so its
                  cards line up (same width) with the timed cards above. */}
              {untimedTasks.length > 0 && (
                <View style={[styles.agendaUntimed, timedTasks.length > 0 && styles.agendaUntimedIndent]}>
                  {timedTasks.length > 0 && (
                    <Text style={styles.agendaAnytimeLabel}>{i18n.t('calendar.anytime')}</Text>
                  )}
                  {untimedTasks.map((t) => (
                    <TaskPreviewCard key={t.id} task={t} onNavigate={navigateAfterClose} />
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {/* Shape for this day, offered on EVERY day. An exam day already shows a
              star by default, and picking here OVERRIDES it. The star itself is only
              on the menu for exam days — it's the exam's own mark, so a plain day
              can't borrow it. Tapping the active shape clears the override: an exam
              day falls back to its star, any other day loses its mark entirely. */}
          {iso && (
            <>
              <View style={styles.shapeRow}>
                <Text style={[styles.shapeRowLabel, ms !== 1 && { fontSize: 13 * ms }]}>
                  {i18n.t('addExam.shape')}
                </Text>
                <View style={styles.shapeRowBtns}>
                  {/* "No shape" is stored as an explicit value, not by deleting the
                      entry: on an exam day, deleting would fall back to the star, so
                      there'd be no way to say "I want this day bare". */}
                  {(() => {
                    const none = dayShapes[iso] === NO_SHAPE;
                    return (
                      <Pressable
                        onPress={() => setDayShape(iso, none ? null : NO_SHAPE)}
                        style={({ pressed }) => [
                          styles.shapeBtn,
                          none && { borderColor: C.mocha, backgroundColor: C.mocha + '1F' },
                          pressed && styles.pressed,
                        ]}>
                        <Svg width={22} height={22} viewBox="0 0 24 24">
                          <Circle cx="12" cy="12" r="8.4" fill="none" stroke={C.latte} strokeWidth={1.8} strokeDasharray="3 2.6" />
                          <Path d="M7.4 16.6 16.6 7.4" stroke={C.latte} strokeWidth={1.8} strokeLinecap="round" />
                        </Svg>
                      </Pressable>
                    );
                  })()}
                  {(dayExams.length > 0 ? COUNTDOWN_SHAPES : DAY_SHAPES).map((sh) => {
                    const picked = daySubjects[iso];
                    const examSub = dayExams.length
                      ? subjects.find((sub) => sub.name === dayExams[0].subject)?.color
                      : null;
                    const color =
                      (picked ? subjects.find((sub) => sub.id === picked)?.color : null) ?? examSub ?? '#F4A8C0';
                    // Mirrors the grid: an explicit pick wins, else the exam's star.
                    const current =
                      dayShapes[iso] === NO_SHAPE ? null : (dayShapes[iso] ?? (dayExams.length ? EXAM_SHAPE : null));
                    const active = current === sh;
                    return (
                      <Pressable
                        key={sh}
                        onPress={() => setDayShape(iso, active ? null : sh)}
                        style={({ pressed }) => [
                          styles.shapeBtn,
                          active && { borderColor: color, backgroundColor: color + '1F' },
                          pressed && styles.pressed,
                        ]}>
                        <CountdownShape shape={sh} color={color} size={22} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Colour for that shape, chosen as a SUBJECT rather than a raw colour
                  so it stays in step if the subject is later recoloured. */}
              {dayShapes[iso] !== NO_SHAPE && (dayShapes[iso] || dayExams.length > 0) && subjects.filter((sub) => !sub.archived).length > 0 && (
                <View style={styles.shapeRow}>
                  <Text style={[styles.shapeRowLabel, ms !== 1 && { fontSize: 13 * ms }]}>
                    {i18n.t('addTask.subject')}
                  </Text>
                  <View style={styles.shapeRowBtns}>
                    {subjects.filter((sub) => !sub.archived).map((sub) => {
                      const active = daySubjects[iso] === sub.id;
                      return (
                        <Pressable
                          key={sub.id}
                          onPress={() => setDaySubject(iso, active ? null : sub.id)}
                          style={({ pressed }) => [
                            styles.dayColorBtn,
                            { backgroundColor: sub.color },
                            active && styles.dayColorBtnActive,
                            pressed && styles.pressed,
                          ]}>
                          <Text style={[styles.dayColorBtnText, { color: inkOn(sub.color) }]} numberOfLines={1}>
                            {localizeSubjectName(sub.name, i18n.t)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          <Pressable
            style={({ pressed }) => [styles.modalAddBtn, ms !== 1 && { paddingVertical: Spacing.three * ms }, pressed && styles.pressed]}
            onPress={() => {
              const day = iso;
              navigateAfterClose(() => router.push({ pathname: '/add-task', params: day ? { date: day } : {} }));
            }}>
            <Text style={[styles.modalAddText, ms !== 1 && { fontSize: 14 * ms }]}>{i18n.t('calendar.addTaskForDay')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── horizontal / search preview (replaces the rotated modal) ────────────────
function HorizontalPreview({ onClose }: { onClose: () => void }) {
  const { tasks, subjects } = useApp();
  const [query, setQuery] = useState('');

  // Today's open tasks only — deliberately not "today onward". The card is a
  // glance at what's due right now, so a run of future days scrolling off the
  // edge buries the one day that matters. Kept as a grouped [iso, tasks] pair so
  // the renderer below stays the same shape; it just never holds more than today.
  const upcoming = useMemo(() => {
    const today = todayISO();
    const todays = tasks.filter(
      (t) => t.dueDate && t.status !== 'done' && t.dueDate.slice(0, 10) === today,
    );
    return todays.length ? ([[today, todays]] as [string, Task[]][]) : [];
  }, [tasks]);

  // Keyword search across everything a task carries as text — title, its notes,
  // and the subject's name — so "phy" finds a task filed under phy132 even when the
  // word isn't in the title. Done tasks are searchable too: you often want to find
  // something you already finished.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const nameOf = (id: string | null) =>
      (id ? subjects.find((sub) => sub.id === id)?.name ?? '' : '').toLowerCase();
    return tasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      nameOf(t.subjectId).includes(q),
    );
  }, [query, tasks, subjects]);

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
/** Cards under the calendar listing what is due on the selected day. */
function DueDayStrip({ iso }: { iso: string }) {
  const { tasks, examCountdowns, subjects } = useApp();
  const dayTasks = useMemo(() => tasksOnDay(tasks, iso, true), [tasks, iso]);
  const dayExams = useMemo(
    () => examCountdowns.filter((e) => e.dateISO.slice(0, 10) === iso),
    [examCountdowns, iso],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.monthLabel}>{longLabel(iso)}</Text>
      {dayTasks.length || dayExams.length ? (
        <View style={styles.previewList}>
          {/* Exams carry the star here too. In this list a task shows a checkbox
              and a subject chip while an exam showed only its name, so the two
              were indistinguishable — the star is the same mark the grid uses. */}
          {dayExams.map((e) => {
            const color = (e.subject ? subjects.find((s) => s.name === e.subject)?.color : null) ?? '#F4A8C0';
            return (
              <View key={e.id} style={[styles.searchResult, styles.examResult]}>
                <CountdownShape shape={EXAM_SHAPE} color={color} size={16} />
                <Text style={styles.searchResultDate}>{e.name}</Text>
              </View>
            );
          })}
          {dayTasks.map((t) => (
            <TaskPreviewCard key={t.id} task={t} />
          ))}
        </View>
      ) : (
        <Text style={styles.searchEmpty}>{i18n.t('calendar.nothingDueDay')}</Text>
      )}
    </View>
  );
}

// Phone-only: how far the calendar card escapes the screen's side padding, and the
// padding it keeps once out there. Every pt reclaimed here becomes cell width, which
// is what makes a task chip legible at all.
const PHONE_BREAKOUT = 20;
const PHONE_CARD_PAD = 6;

export function TaskCalendar({ searchMode = false, onCloseSearch }: { searchMode?: boolean; onCloseSearch?: () => void }) {
  const { width } = useWindowDimensions();
  const [monthOffset, setMonthOffset] = useState(0);
  const [modalDate, setModalDate] = useState<string | null>(null);
  // The strip under the calendar follows the last day you tapped, starting today.
  // Kept separate from modalDate so closing the popup doesn't blank the strip.
  const [selectedDay, setSelectedDay] = useState(() => todayISO());

  // The calendar spans the full centered content column on tablet. CALENDAR_FILL is
  // the fraction of the column the calendar card spans — dial it to taste. Cell size
  // drives the
  // day-number/weekday fonts below (cellW * ratio), so they follow automatically.
  // Phones keep the responsive fill behaviour (scale === 1).
  const { isTablet, scale, contentWidth } = useTabletScale();
  const CALENDAR_FILL = 1; // calendar spans the full content column
  const colInner = Math.min(width, contentWidth) - 2 * (SCREEN_PAD * scale); // matches the screen's scaled side padding
  const cardPad = isTablet ? CARD_PAD * scale : PHONE_CARD_PAD;
  const gridW = isTablet
    ? colInner * CALENDAR_FILL - 2 * CARD_PAD * scale
    : Math.min(width, MaxContentWidth) - (SCREEN_PAD - PHONE_BREAKOUT) * 2 - PHONE_CARD_PAD * 2;
  const cellW = Math.floor(gridW / 7);

  return (
    <View style={styles.root}>
      {searchMode ? (
        <HorizontalPreview onClose={() => onCloseSearch?.()} />
      ) : (
        <>
          <CalendarMonthCard
            monthOffset={monthOffset}
            setMonthOffset={setMonthOffset}
            onPickDate={(iso) => {
              setSelectedDay(iso);
              setModalDate(iso);
            }}
            cellW={cellW}
            cardPad={cardPad}
            isTablet={isTablet}
            scale={isTablet ? scale : 1}
          />
          <DueDayStrip iso={selectedDay} />
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
    // Calendar: a very light, faintly orange warm cream.
    backgroundColor: '#FEF8F1',
    borderRadius: BakeryRadii.panel,
    borderWidth: 1.5,
    borderColor: '#F2E1CC',
    padding: CARD_PAD,
    gap: Spacing.two,
    ...BakeryShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrowBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 26, color: C.jam, fontWeight: '800' },
  monthLabel: { fontSize: 16, fontWeight: '800', color: C.cocoaDark },

  weekRow: { flexDirection: 'row', justifyContent: 'center', alignSelf: 'center' },
  weekday: { textAlign: 'center', fontSize: 12, color: C.mocha, fontWeight: '700' },

  // Pin the grid to exactly 7 cells wide and center it so the cell borders form a
  // symmetric box and stay aligned under the weekday header (full-width + center
  // left the frame's left/bottom edges detached from the centered cells).
  // The frame is one rounded bordered box; cells only draw the INTERNAL
  // gridlines (borderTop/borderLeft, skipped on the first row/column) so the
  // outer corners stay clean and circular with nothing cut off.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: C.latte,
    borderRadius: BakeryRadii.button,
    overflow: 'hidden',
  },
  // A day cell is now a top-aligned column: day number, then a stack of task
  // chips, then the "+N" overflow line. Sizes all arrive inline as ratios of cellW.
  dayCell: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    borderColor: C.latte,
    overflow: 'hidden',
  },
  // The date leads from the top-left; the dots ride beside it. The "+N" overflow
  // still floats right, but clears the corner mark that now lives there.
  dayNumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 2, alignSelf: 'stretch' },
  dayNumBadge: { alignItems: 'center', justifyContent: 'center' },
  dayNum: { color: C.cocoaDark, fontWeight: '600' },
  dayNumToday: { fontWeight: '800' },
  // A deadline recolours the date rather than adding a dot beside it: the cell is
  // ~40pt wide and the dot was competing with the number for that row.
  dayNumDeadline: { color: '#E5484D', fontWeight: '800' },
  // The note marker still sits INLINE beside the day number — the cell's corners
  // belong to the chips and the day mark.
  noteDot: { backgroundColor: C.mocha },
  // Task preview chip: subject-tinted, title only. No time — at ~52pt of cell width
  // a time string consumes the whole chip and leaves nothing of the title.
  chip: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  // Exams are outlined so they read as the day's fixed points, not another task.
  chipExam: { borderWidth: 1 },
  // The exam's day mark: a big translucent shape filling the cell, painted behind
  // the date and the previews (first child = bottom of the stack).
  cornerMark: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  // Exam rows in the day preview: star first, then the name.
  examResult: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // "Shape for this day" row in the day popup (exam days only).
  shapeRow: { gap: Spacing.two },
  shapeRowLabel: { fontSize: 13, fontWeight: '700', color: C.cocoaDark },
  shapeRowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Subject swatches for the day-shape colour: a filled rectangle carrying the
  // subject's own name, so you pick by subject rather than by guessing a colour.
  dayColorBtn: {
    paddingHorizontal: Spacing.three, paddingVertical: 7, borderRadius: 10,
    borderWidth: 2, borderColor: 'transparent', maxWidth: 140,
  },
  dayColorBtnActive: { borderColor: C.cocoaDark },
  dayColorBtnText: { fontSize: 13, fontWeight: '800' },
  shapeBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF8',
  },
  chipText: { fontWeight: '700', flexShrink: 1 },
  // Same treatment the day-detail card gives a finished task.
  chipTextDone: { textDecorationLine: 'line-through', color: C.mocha },
  overflowText: { color: C.mocha, fontWeight: '800' },
  overflowFloat: { position: 'absolute', right: 0 },

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
  // Time-blocking agenda: a fixed left gutter shows each task's time next to its card.
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  agendaTime: { width: 62, fontSize: 12.5, fontWeight: '800', color: C.jam, textAlign: 'right' },
  agendaCard: { flex: 1 },
  agendaUntimed: { gap: Spacing.two, marginTop: Spacing.one },
  // Match the time-gutter (agendaTime width 62 + agendaRow gap) so untimed cards
  // sit at the same left edge — and therefore the same width — as the timed cards.
  agendaUntimedIndent: { marginLeft: 62 + Spacing.two },
  agendaAnytimeLabel: { fontSize: 12, fontWeight: '800', color: C.mocha, marginLeft: 2 },

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
    backgroundColor: C.buttonPink,
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

  // Tapped-day modal
  modalRoot: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
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
    backgroundColor: C.buttonPink,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    ...BakeryShadow,
  },
  modalAddText: { color: C.cocoaDark, fontSize: 14, fontWeight: '800' },
});
