import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { ReminderEntry } from '@/context/app-context';
import { pickReminderLines } from '@/constants/companion-reminder-lines';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const STUDY_REMINDER_CHANNEL_ID = 'study-reminders';
const WEEKDAY_VALUES = [2, 3, 4, 5, 6];
const ALL_WEEK_VALUES = [1, 2, 3, 4, 5, 6, 7];

type ReminderSyncInput = {
  enabled: boolean;
  time: string;
  extraReminders: ReminderEntry[];
  reminderEmoji?: string;
  // Reminder bodies in the active companion's voice. The primary daily reminder
  // rotates through these across the week.
  reminderLines?: string[];
  // Active companion's display name, used as the notification title.
  companionName?: string;
  // If a task is due soon, this names it and takes priority over the voice line.
  taskLine?: string;
};

function randomLine(lines: string[] | undefined, fallback: string): string {
  if (!lines || lines.length === 0) return fallback;
  return lines[Math.floor(Math.random() * lines.length)];
}

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

async function ensureReminderChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(STUDY_REMINDER_CHANNEL_ID, {
    name: 'Study reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
  });
}

async function ensureNotificationPermission() {
  const settings = await Notifications.getPermissionsAsync();
  const alreadyGranted =
    settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (alreadyGranted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return (
    requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function scheduleDailyReminder(title: string, body: string, time: string) {
  const parsed = parseTime(time);
  if (!parsed) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { kind: 'study-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
      channelId: STUDY_REMINDER_CHANNEL_ID,
    },
  });

  return true;
}

async function scheduleWeekdayReminder(title: string, body: string, time: string) {
  const parsed = parseTime(time);
  if (!parsed) return 0;

  await Promise.all(
    WEEKDAY_VALUES.map((weekday) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          data: { kind: 'study-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: parsed.hour,
          minute: parsed.minute,
          channelId: STUDY_REMINDER_CHANNEL_ID,
        },
      }),
    ),
  );

  return WEEKDAY_VALUES.length;
}

// Schedule the daily reminder as 7 per-weekday notifications, each with a
// different line, so the wording rotates across the week. Returns the count
// scheduled (0 if the time is invalid).
async function scheduleRotatingReminder(title: string, lines: string[], time: string) {
  const parsed = parseTime(time);
  if (!parsed) return 0;

  const bodies = pickReminderLines(lines, ALL_WEEK_VALUES.length);
  await Promise.all(
    ALL_WEEK_VALUES.map((weekday, i) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: bodies[i],
          sound: 'default',
          data: { kind: 'study-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: parsed.hour,
          minute: parsed.minute,
          channelId: STUDY_REMINDER_CHANNEL_ID,
        },
      }),
    ),
  );

  return ALL_WEEK_VALUES.length;
}

// Cancel only the study-reminder notifications, leaving task notifications intact.
async function cancelStudyReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => (n.content.data as { kind?: string } | undefined)?.kind === 'study-reminder')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Schedule a one-time local notification for a task at its notifyAt datetime.
export async function scheduleTaskNotification(task: {
  id: string;
  title: string;
  notifyAt: string | null;
}): Promise<string | null> {
  if (!task.notifyAt) return null;
  const when = new Date(task.notifyAt);
  if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;

  await ensureReminderChannel();
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task reminder',
      body: task.title,
      sound: 'default',
      data: { kind: 'task', taskId: task.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: STUDY_REMINDER_CHANNEL_ID,
    },
  });
}

export async function cancelTaskNotification(notifId: string | null) {
  if (!notifId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    // already fired or removed
  }
}

// Fired `delaySeconds` (default ~1s) after the app is backgrounded mid-study-session:
// nudges the player to come back (the session auto-stops if they don't return within a
// minute). A longer delay is used when the user stepped out on purpose — e.g. opening
// the Spotify app. Returns the notification id so it can be cancelled on a quick return.
export async function sendComeBackNudge(
  title: string,
  body: string,
  delaySeconds = 1,
): Promise<string | null> {
  try {
    await ensureReminderChannel();
    const granted = await ensureNotificationPermission();
    if (!granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { kind: 'come-back' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, delaySeconds),
        repeats: false,
        channelId: STUDY_REMINDER_CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

// How far BEFORE a break ends its nudge fires. Short breaks lead by half instead,
// so the notification can never land at/after the break has already resumed.
export const BREAK_NUDGE_LEAD_SECONDS = 30;

/** Seconds from now to fire a break-ending nudge for a break with `breakSeconds` left. */
export function breakNudgeDelay(breakSeconds: number): number {
  const lead = Math.min(BREAK_NUDGE_LEAD_SECONDS, Math.floor(breakSeconds / 2));
  return Math.max(1, breakSeconds - lead);
}

// Nudges the player to come back as the break is about to end. SCHEDULED WHEN THE
// BREAK STARTS, so it fires whether or not the app is open — iOS suspends JS in the
// background, so an in-app timer can't be relied on to tell them the break is over.
// Returns the id so it can be cancelled if the break is ended early.
export async function sendBreakEndingNudge(
  title: string,
  body: string,
  delaySeconds: number,
): Promise<string | null> {
  try {
    await ensureReminderChannel();
    const granted = await ensureNotificationPermission();
    if (!granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { kind: 'break-ending' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, delaySeconds),
        repeats: false,
        channelId: STUDY_REMINDER_CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelComeBackNudge(notifId: string | null) {
  if (!notifId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    // already fired or removed
  }
}

// Ask for notification permission on an explicit user opt-in (e.g. switching the
// exam reminder toggle on). The background syncs never prompt — this is the only
// exam-reminder path that may show the system permission dialog.
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureReminderChannel();
  return ensureNotificationPermission();
}

const EXAM_REMINDER_KIND = 'exam-reminder';
// 2 notifications per exam × this many soonest exams stays far under iOS's silent
// 64-pending cap, leaving room for task/study/streak reminders.
const EXAM_REMINDER_MAX_EXAMS = 15;

export type ExamReminderInput = {
  id: string;
  name: string;
  dateISO: string; // YYYY-MM-DD
  time?: string; // HH:MM, optional (legacy exams may lack it)
  reminderEnabled: boolean;
};

export type ExamReminderKind = 'dayBefore' | 'sixHoursBefore';

// When the two reminders for an exam should fire (nulls = don't schedule).
// - dayBefore: 24h before the exam start; if the exam has no real start time
//   (missing or midnight), 9:00 AM the previous day instead — a midnight
//   notification would land while everyone sleeps.
// - sixHoursBefore: 6h before the start, ONLY when a real (non-midnight) time is
//   set; "6 hours before midnight" is meaningless and collides with dayBefore.
// Past moments are returned as null so edits close to the exam degrade gracefully.
export function examReminderTimes(
  exam: { dateISO: string; time?: string },
  now: number,
): { dayBefore: Date | null; sixHoursBefore: Date | null } {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(exam.dateISO.trim());
  if (!dateMatch) return { dayBefore: null, sixHoursBefore: null };
  const [y, mo, d] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const parsed = exam.time ? parseTime(exam.time) : null;
  const hasRealTime = !!parsed && !(parsed.hour === 0 && parsed.minute === 0);

  let dayBefore: Date;
  let sixHoursBefore: Date | null = null;
  if (hasRealTime) {
    const start = new Date(y, mo - 1, d, parsed.hour, parsed.minute, 0, 0);
    dayBefore = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    sixHoursBefore = new Date(start.getTime() - 6 * 60 * 60 * 1000);
  } else {
    dayBefore = new Date(y, mo - 1, d - 1, 9, 0, 0, 0);
  }

  return {
    dayBefore: dayBefore.getTime() > now ? dayBefore : null,
    sixHoursBefore: sixHoursBefore && sixHoursBefore.getTime() > now ? sixHoursBefore : null,
  };
}

async function cancelExamReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => (n.content.data as { kind?: string } | undefined)?.kind === EXAM_REMINDER_KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Exam reminders: for every countdown with its reminder toggle ON, schedule a
// day-before and (when the exam has a real start time) a 6-hours-before local
// notification. Same cancel-everything-and-reschedule model as the streak nudges,
// so calling on launch / foreground / any exam change keeps the pending set exact
// (edits move the reminders, deletions clear them). Never *requests* permission —
// add-exam prompts when the toggle is switched on.
export async function syncExamReminders(opts: {
  exams: ExamReminderInput[];
  makeContent: (exam: ExamReminderInput, kind: ExamReminderKind) => { title: string; body: string };
}): Promise<void> {
  await ensureReminderChannel();
  await cancelExamReminders();

  const enabled = opts.exams
    .filter((e) => e.reminderEnabled)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .slice(0, EXAM_REMINDER_MAX_EXAMS);
  if (enabled.length === 0) return;
  if (!(await hasNotificationPermission())) return;

  const now = Date.now();
  for (const exam of enabled) {
    const times = examReminderTimes(exam, now);
    for (const kind of ['dayBefore', 'sixHoursBefore'] as const) {
      const when = kind === 'dayBefore' ? times.dayBefore : times.sixHoursBefore;
      if (!when) continue;
      const { title, body } = opts.makeContent(exam, kind);
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          data: { kind: EXAM_REMINDER_KIND, examId: exam.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: STUDY_REMINDER_CHANNEL_ID,
        },
      });
      if (__DEV__) console.log(`[exam-reminders] ${exam.name} ${kind} → ${when.toString()}`);
    }
  }
}

const STREAK_REMINDER_KIND = 'streak-reminder';
// How many upcoming days to pre-schedule streak nudges for. Kept small on purpose:
// iOS silently caps at 64 pending notifications and drops the overflow, so we must
// not crowd out task/study reminders. 3 days (×2 = 6 nudges) covers the realistic
// window — if someone ignores 3 days of nudges, the streak is already gone.
const STREAK_REMINDER_DAYS_AHEAD = 3;
// Two nudges per un-opened day, spaced far apart but both before midnight (when the
// streak day rolls over). Device-local hours: early afternoon + late evening.
const STREAK_REMINDER_HOURS = [13, 21] as const;

// Read-only permission check — NEVER requests. A re-engagement nudge must not trigger
// a permission prompt; it piggybacks on permission already granted for tasks/reminders.
async function hasNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function cancelStreakReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => (n.content.data as { kind?: string } | undefined)?.kind === STREAK_REMINDER_KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Streak-protection nudges: if the player doesn't OPEN the app on a given day, fire up
// to 2 reminders that day so they come back before their streak resets at midnight.
// Call on every launch + foreground — it cancels all pending streak nudges and
// reschedules for the NEXT few days only (never today, since opening the app means
// they've shown up today). So a nudge only ever fires on a day with no app open, which
// is exactly "the user hasn't logged in yet". `enabled` is false when there's no streak
// to protect (or onboarding isn't done); we still cancel so a stale set gets cleared.
export async function syncStreakReminders(opts: {
  enabled: boolean;
  title: string;
  afternoonBody: string;
  eveningBody: string;
}): Promise<void> {
  await ensureReminderChannel();
  await cancelStreakReminders();

  if (!opts.enabled) return;
  if (!(await hasNotificationPermission())) return;

  const now = Date.now();
  for (let day = 1; day <= STREAK_REMINDER_DAYS_AHEAD; day += 1) {
    for (const hour of STREAK_REMINDER_HOURS) {
      const when = new Date();
      when.setDate(when.getDate() + day);
      when.setHours(hour, 0, 0, 0);
      if (when.getTime() <= now) continue; // defensive — all should be future
      await Notifications.scheduleNotificationAsync({
        content: {
          title: opts.title,
          body: hour >= 18 ? opts.eveningBody : opts.afternoonBody,
          sound: 'default',
          data: { kind: STREAK_REMINDER_KIND },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: STUDY_REMINDER_CHANNEL_ID,
        },
      });
    }
  }
}

export async function syncStudyReminders({
  enabled,
  time,
  extraReminders,
  reminderEmoji,
  reminderLines,
  companionName,
  taskLine,
}: ReminderSyncInput) {
  await ensureReminderChannel();
  await cancelStudyReminders();

  const needsAnyReminder = enabled || extraReminders.length > 0;
  if (!needsAnyReminder) {
    return { granted: true, scheduledCount: 0 };
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    return { granted: false, scheduledCount: 0 };
  }

  let scheduledCount = 0;
  // Title reads like the equipped companion is messaging you (e.g. " Tira").
  const baseTitle = `${reminderEmoji ?? ''} ${companionName ?? 'Study time'}`.trim();
  const fallbackBody = 'Your study seat is ready.';

  if (enabled) {
    if (taskLine) {
      // A task is coming up — name it directly.
      const scheduled = await scheduleDailyReminder(baseTitle, taskLine, time);
      if (scheduled) scheduledCount += 1;
    } else if (reminderLines && reminderLines.length > 0) {
      // Otherwise rotate a different companion line across the week.
      scheduledCount += await scheduleRotatingReminder(baseTitle, reminderLines, time);
    } else {
      const scheduled = await scheduleDailyReminder(baseTitle, fallbackBody, time);
      if (scheduled) scheduledCount += 1;
    }
  }

  for (const reminder of extraReminders) {
    const title = baseTitle;
    // Custom label wins; otherwise the upcoming task; otherwise the companion's voice.
    const body = reminder.label?.trim() || taskLine || randomLine(reminderLines, fallbackBody);

    if (reminder.weekdaysOnly) {
      scheduledCount += await scheduleWeekdayReminder(title, body, reminder.time);
    } else {
      const scheduled = await scheduleDailyReminder(title, body, reminder.time);
      if (scheduled) {
        scheduledCount += 1;
      }
    }
  }

  return { granted: true, scheduledCount };
}
