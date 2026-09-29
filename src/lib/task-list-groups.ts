import type { Task } from '@/context/app-context';
import { isTaskDoneOn, openOccurrencesFrom } from '@/lib/task-recurrence';

// Grouping for the To-Do List view. Kept out of the component (and free of React)
// so the "which pile does this task belong in?" rule can be read and tested on its
// own — the same split task-recurrence.ts already uses for the calendar's date math.

export type TaskGroupKey = 'overdue' | 'today' | 'week' | 'later' | 'anytime';

/** One line in the list. A repeating task is one task on many days, so a row has to
 *  name the DAY it stands for — that's what the tick then crosses off. Undated tasks
 *  carry '' (they have no occurrence; their completion is the task's own status). */
export type TaskListRow = { task: Task; occurrenceISO: string };
export type TaskListGroup = { key: TaskGroupKey; rows: TaskListRow[] };

/** Shift a YYYY-MM-DD string by whole days via UTC calendar math (DST-safe) — the
 *  same trick the calendar's week strip uses. */
function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * 86400000).toISOString().slice(0, 10);
}

/** How far ahead "this week" reaches, today included. */
const WEEK_AHEAD_DAYS = 7;
/** Most finished tasks the Done section keeps. It's a receipt, not an archive. */
const MAX_DONE_ROWS = 25;

const GROUP_ORDER: TaskGroupKey[] = ['overdue', 'today', 'week', 'later', 'anytime'];

/** Key identifying one row, for `keep` below. */
export function rowKey(taskId: string, occurrenceISO: string): string {
  return `${taskId}:${occurrenceISO}`;
}

/**
 * Every task still open, in the pile it belongs to, soonest first.
 *
 * A repeating task appears ONCE, as its next occurrence still open — never as a
 * backlog of every day it was missed, which is what a daily repeat left alone for a
 * month would otherwise produce. Undated tasks, which no other surface in the app
 * can show at all, land in `anytime`.
 *
 * `keep` holds rows (by rowKey) that were ticked WHILE YOU WERE LOOKING at them.
 * They stay in place, crossed out, instead of disappearing from under the finger
 * that just tapped them — the list settles the next time it's opened. Everything
 * else about them is normal: they're done, and they don't show twice.
 *
 * Empty groups are dropped, so the caller renders whatever comes back in order.
 */
export function groupTasksForList(
  tasks: Task[],
  todayISO: string,
  keep: ReadonlySet<string> = new Set(),
): TaskListGroup[] {
  const weekEnd = addDaysISO(todayISO, WEEK_AHEAD_DAYS);
  const buckets: Record<TaskGroupKey, TaskListRow[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    anytime: [],
  };

  for (const task of tasks) {
    if (!task.dueDate) {
      // Undated: open until its status says otherwise.
      if (task.status !== 'done' || keep.has(rowKey(task.id, ''))) {
        buckets.anytime.push({ task, occurrenceISO: '' });
      }
      continue;
    }

    if (task.repeatDays?.length) {
      // A repeat just ticked holds the day you ticked, not the day it rolls to —
      // otherwise the row would appear to jump forward a week as you tap it.
      const held = (task.completedDates ?? []).find((d) => keep.has(rowKey(task.id, d)));
      const next = held ?? openOccurrencesFrom(task, todayISO)[0];
      if (!next) continue; // series finished, or everything in range already ticked
      buckets[next <= weekEnd ? (next === todayISO ? 'today' : 'week') : 'later'].push({
        task,
        occurrenceISO: next,
      });
      continue;
    }

    const due = task.dueDate.slice(0, 10);
    if (isTaskDoneOn(task, due) && !keep.has(rowKey(task.id, due))) continue;
    const key: TaskGroupKey =
      due < todayISO ? 'overdue' : due === todayISO ? 'today' : due <= weekEnd ? 'week' : 'later';
    buckets[key].push({ task, occurrenceISO: due });
  }

  for (const key of GROUP_ORDER) {
    buckets[key].sort(
      (a, b) =>
        a.occurrenceISO.localeCompare(b.occurrenceISO) ||
        (a.task.dueTime ?? '99:99').localeCompare(b.task.dueTime ?? '99:99') ||
        a.task.title.localeCompare(b.task.title),
    );
  }

  return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({ key, rows: buckets[key] }));
}

/**
 * What to show under "Done": one-off tasks that are finished, plus repeating tasks
 * whose TODAY occurrence is ticked — a repeat crossed off this morning belongs on
 * today's receipt, even though the series itself is never "done".
 *
 * Most recent first, capped at MAX_DONE_ROWS.
 */
export function doneRowsForList(
  tasks: Task[],
  todayISO: string,
  keep: ReadonlySet<string> = new Set(),
): TaskListRow[] {
  const rows: { row: TaskListRow; at: string }[] = [];
  for (const task of tasks) {
    if (task.repeatDays?.length) {
      if (isTaskDoneOn(task, todayISO) && !keep.has(rowKey(task.id, todayISO))) {
        rows.push({ row: { task, occurrenceISO: todayISO }, at: task.lastActivityAt ?? todayISO });
      }
      continue;
    }
    if (task.status === 'done' && !keep.has(rowKey(task.id, task.dueDate?.slice(0, 10) ?? ''))) {
      rows.push({
        row: { task, occurrenceISO: task.dueDate?.slice(0, 10) ?? '' },
        at: task.completedAt ?? task.lastActivityAt ?? '',
      });
    }
  }
  return rows
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_DONE_ROWS)
    .map((r) => r.row);
}
