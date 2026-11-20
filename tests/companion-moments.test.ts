import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMoment, followUpFor } from '../src/lib/companion-moments.ts';
import type { MomentInput } from '../src/lib/companion-moments.ts';

const today = '2026-11-19';

function baseInput(over: Partial<MomentInput> = {}): MomentInput {
  return {
    today,
    nowMinutes: 600,
    momentsSeen: [],
    momentDayCount: { dateISO: '', count: 0 },
    pendingFollowUp: null,
    profileBirthday: '',
    exams: [],
    lastStudyDate: null,
    currentStreak: 0,
    firstStudyDate: '',
    lastSession: null,
    tasks: [],
    sessionsCompleted: 0,
    totalMinutes: 0,
    subjects: [],
    sessionHistory: [],
    awayNoteId: null,
    ...over,
  };
}

const examTomorrow = { id: 'e1', name: 'Biology midterm', dateISO: '2026-11-20' };

test('empty input returns null', () => {
  assert.equal(pickMoment(baseInput()), null);
});

test('daily cap of 2', () => {
  const m = pickMoment(
    baseInput({ exams: [examTomorrow], momentDayCount: { dateISO: today, count: 2 } }),
  );
  assert.equal(m, null);
});

test('seen ids are skipped', () => {
  const m = pickMoment(baseInput({ exams: [examTomorrow], momentsSeen: ['exam_tomorrow:e1'] }));
  assert.equal(m, null);
});

test('exam tomorrow asks ready/nervous', () => {
  const m = pickMoment(baseInput({ exams: [examTomorrow] }))!;
  assert.equal(m.kind, 'exam_tomorrow');
  assert.deepEqual(m.replies, ['ready', 'nervous']);
  assert.equal(m.vars.exam, 'Biology midterm');
});

test('exam after its start time is aftermath, not exam_today', () => {
  const m = pickMoment(
    baseInput({ exams: [{ id: 'e1', name: 'Bio', dateISO: today, time: '09:00' }], nowMinutes: 600 }),
  )!;
  assert.equal(m.kind, 'exam_after');
});

test('exam today before start', () => {
  const m = pickMoment(
    baseInput({ exams: [{ id: 'e1', name: 'Bio', dateISO: today, time: '09:00' }], nowMinutes: 480 }),
  )!;
  assert.equal(m.kind, 'exam_today');
});

test('followup outranks everything', () => {
  const m = pickMoment(
    baseInput({
      exams: [examTomorrow],
      pendingFollowUp: { id: 'followup:x', kind: 'exam_rough', dueISO: today, vars: { exam: 'Bio' } },
    }),
  )!;
  assert.equal(m.kind, 'followup');
  assert.equal(m.id, 'followup:x');
});

test('rough exam schedules next-day follow-up', () => {
  const after = pickMoment(
    baseInput({ exams: [{ id: 'e1', name: 'Bio', dateISO: '2026-11-18' }] }),
  )!;
  assert.equal(after.kind, 'exam_after');
  assert.equal(followUpFor(after, 'rough', today)!.dueISO, '2026-11-20');
  assert.equal(followUpFor(after, 'great', today), null);
});

test('follow-up carries no persona', () => {
  const after = pickMoment(
    baseInput({ exams: [{ id: 'e1', name: 'Bio', dateISO: '2026-11-18' }] }),
  )!;
  assert.deepEqual(Object.keys(followUpFor(after, 'rough', today)!), ['id', 'kind', 'dueISO', 'vars']);
});

test('away note beats anniversary but not welcome back', () => {
  const a = pickMoment(baseInput({ awayNoteId: 'n1', firstStudyDate: '2026-10-20' }))!;
  assert.equal(a.kind, 'away_note');
  assert.equal(a.noteId, 'n1');
  const b = pickMoment(baseInput({ awayNoteId: 'n1', lastStudyDate: '2026-11-14' }))!;
  assert.equal(b.kind, 'welcome_back');
});

test('streak milestone fires once per streak', () => {
  const m = pickMoment(baseInput({ currentStreak: 7, lastStudyDate: today }))!;
  assert.equal(m.kind, 'streak');
  assert.equal(m.id, 'streak:7:2026-11-13');
});

test('existing player gets no stale milestones', () => {
  const m = pickMoment(
    baseInput({ sessionsCompleted: 400, totalMinutes: 30000, currentStreak: 45, lastStudyDate: today }),
  );
  assert.equal(m, null);
});

test('late night uses session end hour', () => {
  const m = pickMoment(baseInput({ lastSession: { dateISO: today, endHour: 1 } }))!;
  assert.equal(m.kind, 'late_night');
  assert.deepEqual(m.replies, ['fine', 'tired']);
});

test('deadline met within 2 days only', () => {
  const task = {
    id: 't1', title: 'Chem worksheet', isDeadline: true, dueDate: today,
    status: 'done', completedDateISO: today,
  };
  const m = pickMoment(baseInput({ tasks: [task] }))!;
  assert.equal(m.kind, 'deadline_met');
  assert.equal(m.vars.task, 'Chem worksheet');
  assert.equal(
    pickMoment(baseInput({ tasks: [{ ...task, dueDate: '2026-11-14', completedDateISO: '2026-11-14' }] })),
    null,
  );
  assert.equal(pickMoment(baseInput({ tasks: [{ ...task, repeatDays: [1, 3] }] })), null);
});

test('quiet subject ignores archived', () => {
  const sessionHistory = [
    { dateISO: '2026-10-01', subjectName: 'History' },
    { dateISO: '2026-10-10', subjectName: 'History' },
    { dateISO: '2026-11-07', subjectName: 'History' },
  ];
  assert.equal(
    pickMoment(baseInput({ subjects: [{ name: 'History', archived: true }], sessionHistory })),
    null,
  );
  const m = pickMoment(baseInput({ subjects: [{ name: 'History', archived: false }], sessionHistory }))!;
  assert.equal(m.kind, 'quiet_subject');
  assert.equal(m.vars.subject, 'History');
});

// ── Final-review regressions ──────────────────────────────────────────────────

test('welcome back uses the visit before today, not the post-claim study date', () => {
  // Claiming the daily reward stamps streak.lastStudyDate = today before any moment
  // runs, so welcome_back must read the previous visit captured at open time.
  const m = pickMoment(baseInput({ lastStudyDate: today, previousVisitDate: '2026-11-14', currentStreak: 1 }));
  assert.ok(m);
  assert.equal(m.kind, 'welcome_back');
  assert.equal(m.id, 'back:2026-11-14');
  assert.equal(pickMoment(baseInput({ lastStudyDate: today, previousVisitDate: '2026-11-18', currentStreak: 1 })), null);
});

test('streak milestone does not repeat after a free grace day', () => {
  // 7 days in a row reached on 11-13 (id start 11-07), said. Skip 11-14 (grace),
  // study 11-15: the streak is 8 and the derived start shifts to 11-08.
  const m = pickMoment(
    baseInput({
      today: '2026-11-15',
      lastStudyDate: '2026-11-15',
      currentStreak: 8,
      momentsSeen: ['streak:7:2026-11-07'],
    }),
  );
  assert.equal(m, null);
});

test('one quiet subject retires every other quiet subject', () => {
  const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}`;
  const subjects = ['Chem', 'Bio', 'History', 'Math'].map((name) => ({ name, archived: false }));
  const sessionHistory = subjects.flatMap((s, i) => [
    { dateISO: day(1), subjectName: s.name },
    { dateISO: day(2), subjectName: s.name },
    ...(i === 0 ? [{ dateISO: day(1), subjectName: s.name }] : []),
  ]);
  const m = pickMoment(baseInput({ subjects, sessionHistory }));
  assert.ok(m);
  assert.equal(m.kind, 'quiet_subject');
  assert.equal(m.vars.subject, 'Chem');
  assert.deepEqual(
    [...(m.retire ?? [])].sort(),
    ['quiet:Bio:2026-11-02', 'quiet:History:2026-11-02', 'quiet:Math:2026-11-02'],
  );
  const next = pickMoment(baseInput({ subjects, sessionHistory, momentsSeen: [m.id, ...(m.retire ?? [])] }));
  assert.equal(next, null);
});
