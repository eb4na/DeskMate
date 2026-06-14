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

// For a repeating task being completed, compute its next occurrence's due date
// and (if it had a reminder) the shifted reminder time. Returns null when the
// task doesn't repeat or has no due date to roll forward.
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
