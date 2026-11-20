// Pure, React-free engine that picks the one thing the Home companion says on
// open. NO runtime imports: it runs under plain Node in tests.

export type PersonaKey = 'bun' | 'bunny' | 'miel' | 'gray' | 'tira' | 'hanji' | 'cocoa' | 'generic';

export type MomentKind =
  | 'followup'
  | 'birthday'
  | 'exam_today'
  | 'exam_tomorrow'
  | 'exam_after'
  | 'welcome_back'
  | 'away_note'
  | 'anniversary'
  | 'streak'
  | 'late_night'
  | 'early_bird'
  | 'deadline_met'
  | 'milestone_sessions'
  | 'milestone_hours'
  | 'quiet_subject'
  | 'exam_soon';

export type ReplyAnswer = 'ready' | 'nervous' | 'great' | 'okay' | 'rough' | 'fine' | 'tired';

export type MomentVars = Record<string, string | number>;

export type Moment = {
  id: string;
  kind: MomentKind;
  vars: MomentVars;
  replies: ReplyAnswer[];
  noteId?: string;
};

export type PendingFollowUp = {
  id: string;
  kind: 'exam_rough';
  dueISO: string;
  vars: MomentVars;
};

export type MomentInput = {
  today: string;
  /** Minutes since local midnight, account timezone. */
  nowMinutes: number;
  momentsSeen: readonly string[];
  momentDayCount: { dateISO: string; count: number };
  pendingFollowUp: PendingFollowUp | null;
  profileBirthday: string;
  exams: readonly { id: string; name: string; dateISO: string; time?: string }[];
  lastStudyDate: string | null;
  currentStreak: number;
  firstStudyDate: string;
  lastSession: { dateISO: string; endHour?: number } | null;
  tasks: readonly {
    id: string;
    title: string;
    isDeadline?: boolean;
    dueDate: string | null;
    status: string;
    completedDateISO: string | null;
    repeatDays?: number[];
  }[];
  sessionsCompleted: number;
  totalMinutes: number;
  subjects: readonly { name: string; archived: boolean }[];
  sessionHistory: readonly { dateISO: string; subjectName: string | null }[];
  awayNoteId: string | null;
};

const DAY_MS = 86400000;

function utcOf(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return Date.UTC(y, m - 1, d);
}

/** Whole days from a to b (b - a). Same math as app-context `daysBetween`. */
export function diffDaysISO(a: string, b: string): number {
  return Math.round((utcOf(b) - utcOf(a)) / DAY_MS);
}

export function addDaysISO(iso: string, delta: number): string {
  return new Date(utcOf(iso) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Stable non-negative 32-bit hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':');
  return Number(hh) * 60 + Number(mm);
}

function mk(
  id: string,
  kind: MomentKind,
  vars: MomentVars = {},
  replies: ReplyAnswer[] = [],
  noteId?: string,
): Moment {
  const m: Moment = { id, kind, vars, replies };
  if (noteId !== undefined) m.noteId = noteId;
  return m;
}

export function pickMoment(input: MomentInput): Moment | null {
  const { today } = input;
  if (input.momentDayCount.dateISO === today && input.momentDayCount.count >= 2) return null;
  const seen = new Set(input.momentsSeen);
  const ok = (id: string) => !seen.has(id);
  const yesterday = addDaysISO(today, -1);

  // followup
  const pf = input.pendingFollowUp;
  if (pf) {
    const d = diffDaysISO(pf.dueISO, today);
    if (d >= 0 && d <= 2 && ok(pf.id)) return mk(pf.id, 'followup', pf.vars);
  }

  // birthday
  if (input.profileBirthday && input.profileBirthday.slice(5, 10) === today.slice(5, 10)) {
    const id = `birthday:${today.slice(0, 4)}`;
    if (ok(id)) return mk(id, 'birthday');
  }

  // exam_today
  for (const e of input.exams) {
    if (e.dateISO !== today) continue;
    if (e.time && input.nowMinutes >= timeToMinutes(e.time)) continue;
    const id = `exam_today:${e.id}`;
    if (ok(id)) return mk(id, 'exam_today', { exam: e.name });
  }

  // exam_tomorrow
  for (const e of input.exams) {
    if (diffDaysISO(today, e.dateISO) !== 1) continue;
    const id = `exam_tomorrow:${e.id}`;
    if (ok(id)) return mk(id, 'exam_tomorrow', { exam: e.name }, ['ready', 'nervous']);
  }

  // exam_after
  for (const e of input.exams) {
    const passedToday =
      e.dateISO === today && !!e.time && input.nowMinutes >= timeToMinutes(e.time);
    const d = diffDaysISO(e.dateISO, today);
    if (!(passedToday || (d >= 1 && d <= 2))) continue;
    const id = `exam_after:${e.id}`;
    if (ok(id)) return mk(id, 'exam_after', { exam: e.name }, ['great', 'okay', 'rough']);
  }

  // welcome_back
  if (input.lastStudyDate && diffDaysISO(input.lastStudyDate, today) >= 3) {
    const id = `back:${input.lastStudyDate}`;
    if (ok(id)) return mk(id, 'welcome_back');
  }

  // away_note
  if (input.awayNoteId !== null) {
    const id = `away:${input.awayNoteId}`;
    if (ok(id)) return mk(id, 'away_note', {}, [], input.awayNoteId);
  }

  // anniversary
  if (input.firstStudyDate) {
    const d = diffDaysISO(input.firstStudyDate, today);
    for (const n of [7, 30, 100, 365]) {
      if (d >= n && d <= n + 3) {
        const id = `anniv:${n}`;
        if (ok(id)) return mk(id, 'anniversary', { n });
      }
    }
  }

  // streak
  if (input.lastStudyDate && (input.lastStudyDate === today || input.lastStudyDate === yesterday)) {
    let best = 0;
    for (const m of [3, 7, 14, 30, 50, 100]) {
      if (m <= input.currentStreak && input.currentStreak <= m + 2) best = m;
    }
    if (best) {
      const id = `streak:${best}:${addDaysISO(input.lastStudyDate, -(input.currentStreak - 1))}`;
      if (ok(id)) return mk(id, 'streak', { n: best });
    }
  }

  // late_night / early_bird
  const ls = input.lastSession;
  if (ls && (ls.dateISO === today || ls.dateISO === yesterday) && ls.endHour !== undefined) {
    if (ls.endHour >= 0 && ls.endHour <= 4) {
      const id = `late:${ls.dateISO}`;
      if (ok(id)) return mk(id, 'late_night', {}, ['fine', 'tired']);
    } else if (ls.endHour >= 5 && ls.endHour <= 6) {
      const id = `early:${ls.dateISO}`;
      if (ok(id)) return mk(id, 'early_bird');
    }
  }

  // deadline_met
  for (const t of input.tasks) {
    if (t.status !== 'done' || t.isDeadline === false || !t.dueDate) continue;
    if (t.repeatDays && t.repeatDays.length > 0) continue;
    if (!t.completedDateISO) continue;
    if (t.completedDateISO > t.dueDate || t.completedDateISO < yesterday) continue;
    const id = `task:${t.id}`;
    if (ok(id)) return mk(id, 'deadline_met', { task: t.title });
  }

  // milestone_sessions
  for (const n of [10, 50, 100, 250]) {
    if (n <= input.sessionsCompleted && input.sessionsCompleted <= n + 3) {
      const id = `sessions:${n}`;
      if (ok(id)) return mk(id, 'milestone_sessions', { count: n });
    }
  }

  // milestone_hours
  const hours = input.totalMinutes / 60;
  for (const n of [10, 50, 100]) {
    if (n <= hours && hours < n + 2) {
      const id = `hours:${n}`;
      if (ok(id)) return mk(id, 'milestone_hours', { n });
    }
  }

  // quiet_subject: most records wins
  let quiet: { name: string; last: string; count: number } | null = null;
  for (const s of input.subjects) {
    if (s.archived) continue;
    const recs = input.sessionHistory.filter((h) => h.subjectName === s.name);
    if (recs.length < 2) continue;
    const last = recs.reduce((a, h) => (h.dateISO > a ? h.dateISO : a), recs[0].dateISO);
    const ago = diffDaysISO(last, today);
    if (ago < 10 || ago > 45) continue;
    if (!ok(`quiet:${s.name}:${last}`)) continue;
    if (!quiet || recs.length > quiet.count) quiet = { name: s.name, last, count: recs.length };
  }
  if (quiet) return mk(`quiet:${quiet.name}:${quiet.last}`, 'quiet_subject', { subject: quiet.name });

  // exam_soon
  for (const e of input.exams) {
    const d = diffDaysISO(today, e.dateISO);
    if (d < 2 || d > 3) continue;
    const id = `exam_soon:${e.id}`;
    if (ok(id)) return mk(id, 'exam_soon', { exam: e.name, days: d }, ['ready', 'nervous']);
  }

  return null;
}

export function followUpFor(
  moment: Moment,
  answer: ReplyAnswer,
  today: string,
): PendingFollowUp | null {
  if (moment.kind !== 'exam_after' || answer !== 'rough') return null;
  return {
    id: 'followup:' + moment.id,
    kind: 'exam_rough',
    dueISO: addDaysISO(today, 1),
    vars: moment.vars,
  };
}

/** Dev testing: a representative moment of each kind with sample vars. */
export function sampleMoment(kind: MomentKind): Moment {
  const vars: MomentVars = {
    exam: 'Biology midterm',
    days: 3,
    subject: 'History',
    task: 'Chem worksheet',
    count: 10,
    n: 7,
  };
  const replies: Partial<Record<MomentKind, ReplyAnswer[]>> = {
    exam_tomorrow: ['ready', 'nervous'],
    exam_soon: ['ready', 'nervous'],
    exam_after: ['great', 'okay', 'rough'],
    late_night: ['fine', 'tired'],
  };
  return { id: `sample:${kind}`, kind, vars, replies: replies[kind] ?? [] };
}

// ---- Away-life + bond letters ----

export const AWAY_MIN_MS = 8 * 3600 * 1000;
export const BOND_LETTER_MAX_LEVEL = 15;

export function awayNoteDue(i: {
  now: number;
  lastActiveAt: number;
  today: string;
  lastKeepsakeISO: string;
  roll: number;
}): boolean {
  if (i.lastActiveAt === 0) return false;
  if (i.now - i.lastActiveAt < AWAY_MIN_MS) return false;
  if (i.lastKeepsakeISO === i.today) return false;
  if (i.lastKeepsakeISO === '') return true;
  const ago = diffDaysISO(i.lastKeepsakeISO, i.today);
  if (ago >= 2) return true;
  return i.roll < 0.4;
}

/** Deterministic Fisher-Yates driven by hashString (xorshift32 stream). */
export function seededShuffle<T>(xs: readonly T[], seed: string): T[] {
  const out = xs.slice();
  let s = hashString(seed) || 1;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
  for (let k = out.length - 1; k > 0; k--) {
    const j = next() % (k + 1);
    const t = out[k];
    out[k] = out[j];
    out[j] = t;
  }
  return out;
}

export function nextAwayNoteId(i: {
  poolIds: readonly string[];
  given: readonly string[];
  seed: string;
}): string | null {
  const given = new Set(i.given);
  for (const id of seededShuffle(i.poolIds, i.seed)) {
    if (!given.has(id)) return id;
  }
  return null;
}

export type Keepsake = {
  id: string;
  persona: PersonaKey;
  kind: 'note' | 'story' | 'letter';
  contentId: string;
  level?: number;
  dateISO: string;
  seen: boolean;
};

export function missingBondLetters(i: {
  companions: readonly { persona: PersonaKey; level: number }[];
  have: readonly Keepsake[];
  today: string;
}): Keepsake[] {
  const have = new Set(i.have.map((k) => k.id));
  const out: Keepsake[] = [];
  for (const c of i.companions) {
    const top = Math.min(c.level, BOND_LETTER_MAX_LEVEL);
    for (let level = 2; level <= top; level++) {
      const id = `letter:${c.persona}:${level}`;
      if (have.has(id)) continue;
      out.push({
        id,
        persona: c.persona,
        kind: 'letter',
        contentId: String(level),
        level,
        dateISO: i.today,
        seen: false,
      });
    }
  }
  return out;
}
