// Aggregation behind the Progress tab's subject time tracker.
//
// Kept pure and date-injected (callers pass `today`/`weekMonday` rather than
// letting this module read the clock) so the range maths is testable and so it
// goes through the account's timezone the same way the streak engine does —
// never a local `new Date()`. See [[memobun-date-basis]].
//
// All four ranges are CALENDAR-based, not trailing windows. That is load-bearing
// rather than cosmetic: `subjectMonthly` is bucketed by calendar month, so a
// trailing-365-day "year" could not be derived from it at all.

export const PROGRESS_RANGES = ['week', 'month', 'year', 'all'] as const;
export type ProgressRange = (typeof PROGRESS_RANGES)[number];

export type SessionLike = { dateISO: string; minutes: number; subjectName: string | null };
export type SubjectEntry = { name: string; minutes: number };

/** The bucket an untagged session is counted under. Matches `addSubjectTime`. */
export const UNTAGGED_KEY = 'General Study';

/** How many real slices the ring draws before the tail is merged into "Other". */
export const RING_SLICE_LIMIT = 5;

type Sources = {
  sessionHistory: SessionLike[];
  /** Lifetime minutes per subject. Never trimmed — the source for `all`. */
  subjectTimeMap: Record<string, number>;
  /** "YYYY-MM" → subject → minutes. The only honest source for `year`. */
  subjectMonthly: Record<string, Record<string, number>>;
  /** Today in the account's timezone (YYYY-MM-DD). */
  today: string;
  /** Monday of the current calendar week in the account's timezone. */
  weekMonday: string;
};

/**
 * Inclusive earliest `dateISO` a raw record needs to fall inside `range`, or
 * null when the range isn't record-backed (year/all read rollups instead).
 */
export function rangeStartISO(range: ProgressRange, today: string, weekMonday: string): string | null {
  if (range === 'week') return weekMonday;
  if (range === 'month') return `${today.slice(0, 7)}-01`;
  return null;
}

function addInto(target: Record<string, number>, name: string, minutes: number) {
  if (minutes <= 0) return;
  target[name] = (target[name] ?? 0) + minutes;
}

/**
 * Minutes per subject for the range, sorted descending then by name so equal
 * totals keep a stable order between renders.
 */
export function subjectTotalsForRange(range: ProgressRange, s: Sources): SubjectEntry[] {
  const totals: Record<string, number> = {};

  if (range === 'all') {
    for (const [name, minutes] of Object.entries(s.subjectTimeMap)) addInto(totals, name, minutes);
  } else if (range === 'year') {
    const yearPrefix = s.today.slice(0, 4);
    for (const [monthKey, perSubject] of Object.entries(s.subjectMonthly)) {
      if (monthKey.slice(0, 4) !== yearPrefix) continue;
      for (const [name, minutes] of Object.entries(perSubject)) addInto(totals, name, minutes);
    }
  } else {
    const start = rangeStartISO(range, s.today, s.weekMonday);
    for (const rec of s.sessionHistory) {
      if (start && rec.dateISO < start) continue;
      addInto(totals, rec.subjectName ?? UNTAGGED_KEY, rec.minutes);
    }
  }

  return Object.entries(totals)
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

export function totalMinutesOf(entries: SubjectEntry[]): number {
  return entries.reduce((sum, e) => sum + e.minutes, 0);
}

/**
 * What the ring draws: the biggest `RING_SLICE_LIMIT` subjects, with everything
 * else merged into one trailing "Other" slice. A donut past ~5 slices reads as
 * confetti; the list underneath is never truncated, so nothing is hidden.
 *
 * The tail merges only when it would save a slice — a 6th subject on its own
 * becomes "Other" with one member, which is worse than just drawing it, so that
 * case draws the subject instead.
 */
export function ringSlices(entries: SubjectEntry[]): { entries: SubjectEntry[]; otherMinutes: number } {
  if (entries.length <= RING_SLICE_LIMIT + 1) return { entries, otherMinutes: 0 };
  const head = entries.slice(0, RING_SLICE_LIMIT);
  const otherMinutes = totalMinutesOf(entries.slice(RING_SLICE_LIMIT));
  return { entries: head, otherMinutes };
}

export type RangeInsight =
  | { kind: 'none' }
  | { kind: 'records'; avgMinutes: number; bestDayISO: string; bestDayMinutes: number }
  | { kind: 'month'; bestMonthKey: string; bestMonthMinutes: number };

/**
 * The line under the ring. What it can say depends on where the range's numbers
 * came from: the rollups store minutes but no session count and no per-day
 * detail, so an "average session" for year/all would be an invented number.
 * It reports less rather than guessing.
 */
export function insightForRange(range: ProgressRange, s: Sources): RangeInsight {
  if (range === 'all') return { kind: 'none' };

  if (range === 'year') {
    const yearPrefix = s.today.slice(0, 4);
    let bestMonthKey = '';
    let bestMonthMinutes = 0;
    for (const [monthKey, perSubject] of Object.entries(s.subjectMonthly)) {
      if (monthKey.slice(0, 4) !== yearPrefix) continue;
      const minutes = Object.values(perSubject).reduce((a, b) => a + b, 0);
      if (minutes > bestMonthMinutes) {
        bestMonthMinutes = minutes;
        bestMonthKey = monthKey;
      }
    }
    return bestMonthMinutes > 0 ? { kind: 'month', bestMonthKey, bestMonthMinutes } : { kind: 'none' };
  }

  const start = rangeStartISO(range, s.today, s.weekMonday);
  const inRange = s.sessionHistory.filter((r) => !start || r.dateISO >= start);
  if (inRange.length === 0) return { kind: 'none' };

  const perDay: Record<string, number> = {};
  for (const rec of inRange) perDay[rec.dateISO] = (perDay[rec.dateISO] ?? 0) + rec.minutes;

  let bestDayISO = '';
  let bestDayMinutes = 0;
  for (const [iso, minutes] of Object.entries(perDay)) {
    if (minutes > bestDayMinutes) {
      bestDayMinutes = minutes;
      bestDayISO = iso;
    }
  }

  const total = inRange.reduce((sum, r) => sum + r.minutes, 0);
  return {
    kind: 'records',
    avgMinutes: Math.round(total / inRange.length),
    bestDayISO,
    bestDayMinutes,
  };
}

/** "YYYY-MM" bucket key for a `YYYY-MM-DD` date. */
export function monthKeyOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}
