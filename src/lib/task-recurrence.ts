import type { Task } from '@/context/app-context';

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// The next date matching one of `days` (0=Sun … 6=Sat), starting strictly after
// `fromISO`. Returns null if `days` is empty.
export function nextWeekdayAfter(fromISO: string, days: number[]): string | null {
  if (!days.length) return null;
  const base = new Date(`${fromISO}T00:00:00`);
  if (isNaN(base.getTime())) return null;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (days.includes(d.getDay())) return toISO(d);
  }
  return null;
}

/** The moment a dated item stops counting as "upcoming": its own due/start time
 *  when one is set, otherwise the END of that day — a date-only task or exam
 *  stays upcoming all day and only drops off at midnight. Unparseable dates are
 *  treated as always-upcoming so bad data can't silently hide an item.
 *  Shared by the Home cards and the reminder line (exams use it too), so every
 *  "upcoming" surface expires an item at the same instant. */
export function upcomingUntilMs(dateISO: string, time?: string | null): number {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  const parsed = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((time ?? '').trim());
  const [h, m] = parsed ? [Number(parsed[1]), Number(parsed[2])] : [0, 0];
  // Missing — or legacy midnight, which means "no time set" — runs to day's end.
  if (h === 0 && m === 0) d.setHours(23, 59, 59, 999);
  else d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** Does `task` land on `iso`? A repeating task lands on every selected weekday
 *  from its due date (the series start) through `repeatUntil`; a one-off task only
 *  on its own due date. Every surface that places a task on a day goes through
 *  this, so the month grid, the day popup, the week strip and the Home card can't
 *  disagree about which days a series covers. */
export function taskFallsOn(
  t: Pick<Task, 'dueDate' | 'repeatDays' | 'repeatUntil'>,
  iso: string,
): boolean {
  if (!t.dueDate) return false;
  const start = t.dueDate.slice(0, 10);
  if (t.repeatDays?.length) {
    if (iso < start) return false;
    if (t.repeatUntil && iso > t.repeatUntil) return false;
    return t.repeatDays.includes(new Date(`${iso}T00:00:00`).getDay());
  }
  return start === iso;
}

/** Is the occurrence ON `iso` crossed out?
 *
 *  A repeating task is a SERIES, so completion has to be per-date: `completedDates`
 *  holds the days already ticked off. It deliberately does NOT read `status` —
 *  ticking Monday's occurrence once used to set the series' single status to 'done',
 *  which struck the task out on every past and future day at once.
 *
 *  A one-off task has exactly one occurrence, so its `status` is the answer. */
export function isTaskDoneOn(
  t: Pick<Task, 'repeatDays' | 'completedDates' | 'status'>,
  iso: string,
): boolean {
  if (t.repeatDays?.length) return !!t.completedDates?.includes(iso.slice(0, 10));
  return t.status === 'done';
}

/** How many days ahead `openOccurrencesFrom` will look. Bounded on purpose: a repeat
 *  with no end date has infinitely many occurrences, and every caller only ever
 *  wants the next one or two. Four weeks covers any weekday pattern even when the
 *  nearer occurrences have already been ticked off. */
const OCCURRENCE_SCAN_DAYS = 28;

/** The task's occurrence dates from `fromISO` (inclusive) onward, soonest first.
 *  Only occurrences still open (not crossed out) are returned — the callers that
 *  ask "what's next?" never mean an occurrence already dealt with. Empty when the
 *  series has ended, or when everything in the scan window is done. */
export function openOccurrencesFrom(
  t: Pick<Task, 'dueDate' | 'repeatDays' | 'repeatUntil' | 'completedDates' | 'status'>,
  fromISO: string,
): string[] {
  if (!t.dueDate) return [];
  const start = t.dueDate.slice(0, 10);
  if (!t.repeatDays?.length) {
    // One-off: its own day, if that day hasn't passed and it isn't ticked off.
    return start >= fromISO && t.status !== 'done' ? [start] : [];
  }
  const base = start > fromISO ? start : fromISO;
  const out: string[] = [];
  const d = new Date(`${base}T00:00:00`);
  if (isNaN(d.getTime())) return [];
  for (let i = 0; i < OCCURRENCE_SCAN_DAYS; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    const iso = toISO(day);
    if (t.repeatUntil && iso > t.repeatUntil) break;
    if (taskFallsOn(t, iso) && !isTaskDoneOn(t, iso)) out.push(iso);
  }
  return out;
}

// For a repeating task being completed, compute its next occurrence's due date
// and (if it had a reminder) the shifted reminder time. Returns null when the
// task doesn't repeat or has no due date to roll forward.
//
// NOT how completion works any more: rolling `dueDate` forward moves the series'
// START date, and every calendar surface expands a series FROM that date — so the
// occurrences already behind it would drop out of the grid. Ticking one occurrence
// records its date instead (isTaskDoneOn / toggleTaskOccurrence). Kept because it's
// still on the context's API surface.
export function computeTaskRollover(
  task: Pick<Task, 'repeatDays' | 'dueDate' | 'dueTime' | 'notifyAt' | 'repeatUntil'>,
): { dueDate: string; notifyAt: string | null } | null {
  if (!task.repeatDays?.length || !task.dueDate) return null;
  const nextDue = nextWeekdayAfter(task.dueDate, task.repeatDays);
  if (!nextDue) return null;
  // Stop repeating once the next occurrence would fall past the end date.
  if (task.repeatUntil && nextDue > task.repeatUntil) return null;

  let notifyAt: string | null = null;
  if (task.notifyAt && task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number);
    const oldDue = new Date(`${task.dueDate}T00:00:00`);
    oldDue.setHours(h, m, 0, 0);
    const offsetMs = oldDue.getTime() - new Date(task.notifyAt).getTime();
    const newDue = new Date(`${nextDue}T00:00:00`);
    newDue.setHours(h, m, 0, 0);
    notifyAt = new Date(newDue.getTime() - offsetMs).toISOString();
  }
  return { dueDate: nextDue, notifyAt };
}
