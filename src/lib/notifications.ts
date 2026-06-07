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
  // Reminder bodies in the active companion's voice (flavored by their skin).
  // The primary daily reminder rotates through these across the week.
  reminderLines?: string[];
  // Active companion's display name, used as the notification title.
  companionName?: string;
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
      title: '🔔 Task reminder',
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

export async function syncStudyReminders({
  enabled,
  time,
  extraReminders,
  reminderEmoji,
  reminderLines,
  companionName,
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
  // Title reads like the equipped companion is messaging you (e.g. "🌙 Tira").
  const baseTitle = `${reminderEmoji ?? '🔔'} ${companionName ?? 'Study time'}`;
  const fallbackBody = 'Your study seat is ready.';

  if (enabled) {
    if (reminderLines && reminderLines.length > 0) {
      // Rotate a different line across the week.
      scheduledCount += await scheduleRotatingReminder(baseTitle, reminderLines, time);
    } else {
      const scheduled = await scheduleDailyReminder(baseTitle, fallbackBody, time);
      if (scheduled) scheduledCount += 1;
    }
  }

  for (const reminder of extraReminders) {
    const title = `${reminderEmoji ?? '🔔'} ${reminder.label}`;
    const body = randomLine(reminderLines, fallbackBody);

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
