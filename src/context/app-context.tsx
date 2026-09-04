import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import i18n, { detectDeviceLanguage } from '@/i18n';
import { capCoins, COINS_PER_MINUTE, DAILY_EARN_CAP, dailyEarnCap, MAX_FRIENDS, PLUS_STUDY_COIN_MULTIPLIER, STATIC_SUBJECTS } from '@/constants/placeholder-data';
import { SHOP_ITEMS, type ShopCategory } from '@/constants/shop-data';
import { dailyRewardCoins } from '@/constants/login-rewards';
import { getAchievement } from '@/constants/quests';
import { useAuth } from '@/context/auth-context';
import { getAppStateScope, loadScopedAppState, saveScopedAppState, isGuestUpgradePending, clearGuestUpgradePending, loadGuestState } from '@/lib/app-state-repository';
import { probeCloudState, pushCloudState, pushCloudStateDebounced, flushCloudState } from '@/lib/cloud-sync';
import { showPopup } from '@/lib/popup';
import { getEffectiveBunSkinId, getEffectiveCompanionSkins } from '@/lib/companion-utils';
import { maskProfanity } from '@/lib/profanity';
import { playCoin, playFinishDing } from '@/lib/sounds';
import { track } from '@/lib/analytics';
import { AD_REWARD_COINS, DAILY_AD_LIMIT } from '@/lib/ads';
import { loadBlockedCodes, blockUserRemote, unblockUserRemote } from '@/lib/moderation';
import { syncExamReminders, syncStreakReminders, syncTaskReminders, taskReminderMode } from '@/lib/notifications';
import type { TaskReminderInput, TaskReminderMode, TaskReminderTier } from '@/lib/notifications';
import { computeTaskRollover } from '@/lib/task-recurrence';
import { uploadProfile } from '@/lib/profile-sync';
import { claimMailRemote } from '@/lib/mail';
import { companionLevelInfo } from '@/lib/companion-level';
import { monthKeyOf } from '@/lib/progress-ranges';
import { uploadStudyDay } from '@/lib/study-buddy';
import { HANJI_COMPANION_ID, recipeBadgeKey, badgesFromMadeFoods, hasAllCharacterBadges, RECIPE_IDS, RECIPE_BADGES, starterRecipe } from '@/constants/recipes';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChatTurn = { role: 'user' | 'assistant'; content: string; at?: number };

export type ExamCountdown = {
  id: string;
  name: string;
  subject: string;
  dateISO: string;
  /** Time of day the exam starts, as "HH:MM" (24-hour). Optional for legacy data. */
  time?: string;
  reminderEnabled: boolean;
  /**
   * Decorative shape marking the exam's day in the calendar grid ('star' | 'heart'
   * | 'tear'), drawn under that day's task previews in the subject's colour. Picked
   * from the day popup, not the exam form. Undefined = the default star.
   */
  shape?: string;
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
};

export type Subject = {
  id: string;
  name: string;
  color: string;
  emoji: string;
  archived: boolean;
  order: number;
};

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'not_started' | 'in_progress' | 'done';

export type Task = {
  id: string;
  title: string;
  /** Optional free-text description / notes for the task. */
  description?: string;
  subjectId: string | null;
  dueDate: string | null;
  /**
   * True = the task is a deadline "due" on its dueDate (drives the calendar red
   * dot). False = the task just sits on that day but isn't a hard deadline.
   * Undefined = legacy task; treated as a deadline when it has a dueDate.
   */
  isDeadline?: boolean;
  /** Optional time of day the task is due, as "HH:MM" (24-hour). */
  dueTime: string | null;
  estimatedMinutes: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  postponeCount: number;
  lastActivityAt: string | null;
  /** The moment a `custom` reminder fires. Unused by `auto`/`off` tasks. */
  notifyAt: string | null;
  /**
   * Legacy: id of the one notification a task used to schedule for itself. Task
   * reminders are now derived from the task list by syncTaskReminders(), so this
   * is no longer written — it stays on the type so old persisted tasks parse.
   */
  notifId: string | null;
  /**
   * How this task notifies. `auto` (the default for new tasks) = 09:00 the day
   * before, plus 1 hour and 10 minutes before the due time when one is set.
   * `custom` = a single reminder at `notifyAt`. `off` = none.
   * Undefined = a task saved before this existed: it means whatever the old
   * single-reminder model meant, i.e. `custom` when it has a notifyAt else `off`
   * (see taskReminderMode) — so upgrading never silently adds notifications.
   */
  reminderMode?: TaskReminderMode;
  /** Weekdays (0=Sun … 6=Sat) the task repeats on. Empty/undefined = no repeat. */
  repeatDays?: number[];
  /** Last date (ISO "YYYY-MM-DD") the repeat rolls to. Undefined = no end. */
  repeatUntil?: string;
};

export type SessionRecord = {
  dateISO: string;
  minutes: number;
  subjectName: string | null;
};

export type ActiveSession = {
  id: string;
  durationMinutes: number;
  subjectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  startedAt: string;
  isMultiplayer?: boolean;
  /** Custom break length (minutes); falls back to floor(duration/12) when unset. */
  breakMinutes?: number;
  /** True when this session began via the post-break auto-start (no human pick).
   *  Used to cap auto-start to ONE in a row — see the next-session picker. */
  autoStarted?: boolean;
  /** Solo "lock in": leaving the app for a minute ends this session, and finishing
   *  it pays double. Opt-in per session; never set in multiplayer. */
  lockedIn?: boolean;
  /** True when this block is a "Continue studying" continuation of the same run
   *  (see the session-checkpoint flow). A continued block keeps accumulating into
   *  `sessionRun`; a fresh (non-continued) start resets the run accumulator. */
  continuedRun?: boolean;
};

// A solo study "run" = one or more back-to-back blocks joined by "Continue
// studying" at the checkpoint. Each finished block credits itself immediately
// (see finishStudyBlock); this accumulator is pure display for the checkpoint and
// the final (Rest) receipt so no interim receipt is shown between blocks.
export type SessionRun = {
  /** Cumulative study minutes across the run's blocks (excludes breaks). */
  minutes: number;
  /** Cumulative coins actually credited (after the daily cap) — for the receipt. */
  coins: number;
  subjectName: string | null;
  /** Streak bonus awarded during the run (nonzero only on the first block/day). */
  streakBonus: number;
  isComeback: boolean;
};

// ─── Wave 4 types ─────────────────────────────────────────────────────────────

// Presets are session-length ONLY — a preset never stores a break (breaks are
// picked fresh each session, or fall back to the auto break).
export type TimerPreset = {
  id: string;
  label: string;
  minutes: number;
};

export type Friend = {
  code: string;
  name: string;
  addedAt: string;
  // Synced from the friend's cloud profile (when available).
  displayName?: string;
  companionId?: string;
  skinId?: string;
  backgroundId?: string;
  description?: string;
  birthday?: string;
  currentStreak?: number;
  longestStreak?: number;
  totalMinutes?: number;
  avatarFrame?: string;
  cardColor?: string;
};

// Short, shareable friend code. A–Z + 2–9, with ambiguous chars (I/O/0/1) removed.
function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Saved presets are capped: newest first. Once at the cap the UI makes the user
// pick one to replace (see custom-timer) rather than silently dropping the oldest.
export const MAX_TIMER_PRESETS = 6;

export type DefaultCompanionId = 'girl' | 'dude';
export type ActiveCompanionId = `starter:${DefaultCompanionId}` | string;

// Profile-picture framing: zoom + normalized pan offsets applied as an avatar transform.
export type PfpFocus = { scale: number; x: number; y: number };

// Default avatar framing — a gentle zoom onto the face (image top).
export const DEFAULT_PFP_FOCUS: PfpFocus = { scale: 1.4, x: 0, y: 0 };

export type CompanionSlot = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  isGenerated: boolean;
  imageUri: string | null;
  imagePath: string | null;
  prompt: string | null;
  personality?: string;
  pfp?: PfpFocus;
};

export type ReminderEntry = {
  id: string;
  time: string;
  label: string;
  weekdaysOnly: boolean;
};

export type EquipableShopCategory = Exclude<ShopCategory, 'game'>;
export type EquippedShopItems = Record<EquipableShopCategory, string | null>;

// ─── Seed subjects from Wave 1 static data ───────────────────────────────────

const INITIAL_SUBJECTS: Subject[] = STATIC_SUBJECTS.map((s, i) => ({
  id: String(i + 1),
  name: s.name,
  color: s.color,
  emoji: '',
  archived: false,
  order: i,
}));

// Notification copy per task-reminder tier. Written out in full (not built from a
// template) so grepping an i18n key finds its use.
const TASK_REMINDER_COPY: Record<TaskReminderTier, { title: string; body: string }> = {
  dayBefore: { title: 'notifications.taskTomorrowTitle', body: 'notifications.taskTomorrowBody' },
  hourBefore: { title: 'notifications.taskHourTitle', body: 'notifications.taskHourBody' },
  tenMinBefore: { title: 'notifications.taskTenMinTitle', body: 'notifications.taskTenMinBody' },
  custom: { title: 'notifications.taskCustomTitle', body: 'notifications.taskCustomBody' },
};

// ─── Persisted state shape ────────────────────────────────────────────────────

type PersistedState = {
  // Wave 1
  coins: number;
  sessionsCompleted: number;
  totalMinutes: number;
  examCountdowns: ExamCountdown[];
  reminderEnabled: boolean;
  reminderTime: string;
  // Per-category notification kill switches (Settings › Reminders). Each one only
  // turns notifications OFF — a category still needs its own reason to fire (a task
  // with a reminder, an exam with its toggle on, an unbroken streak).
  notifTasks: boolean;
  notifStreak: boolean;
  notifExams: boolean;
  use24HourTime: boolean;
  soundEffectsEnabled: boolean;
  vinylColor: string;
  // "Spotify background" study mode: replace the room background with a solid colour +
  // a large album-cover vinyl while studying. Colour is the user's pick.
  spotifyBgEnabled: boolean;
  spotifyBgColor: 'black' | 'white';
  streak: StreakData;
  earnedToday: number;
  earnedDate: string;
  // Rewarded-video coins: how many ads the player has watched-for-coins today, and
  // the todayISO it was last reset on. Capped at DAILY_AD_LIMIT/day; payout bypasses
  // DAILY_EARN_CAP (the per-day ad limit *is* its cap).
  adRewardCount: number;
  adRewardDate: string;
  // Daily login reward (separate from the study streak above): consecutive days
  // the player opened the app and claimed the coin bonus, + the last claimed day.
  loginStreak: number;
  loginRewardDate: string;
  // Birthday gift: the calendar year (account timezone) the +1000-coin birthday
  // reward was last claimed. 0 = never. Gates the reward to once per year.
  birthdayRewardYear: number;
  // Wave 2
  subjects: Subject[];
  tasks: Task[];
  ownedShopItems: string[];
  equippedShopItems: EquippedShopItems;
  subjectTimeMap: Record<string, number>;
  /** Per-month, per-subject minutes: "YYYY-MM" -> subject -> minutes. Never
   *  trimmed, unlike sessionHistory — it is the only honest source for the
   *  Progress tab's Year range once raw records age out. Tiny: roughly six
   *  subjects x twelve months of numbers per year. */
  subjectMonthly: Record<string, Record<string, number>>;
  skipSubjectCount: number;
  sessionHistory: SessionRecord[];
  // Minutes studied with each companion (companionId → minutes). Drives the per-
  // companion bond level shown in the gallery. No rewards attached.
  companionMinutes: Record<string, number>;
  // Daily ceiling on bond minutes earned, mirroring the coin earn cap so levels can't
  // be ground out in one day. `companionBondDate` is the todayISO it was last reset on.
  companionBondToday: number;
  companionBondDate: string;
  // Tiny daily bond from petting the companion on the home screen (separate small cap
  // so tapping is flavour, not a grind). `petBondDate` is the todayISO of last reset.
  petBondToday: number;
  petBondDate: string;
  // Wave 4
  isPlus: boolean;
  plusPlan: 'monthly' | 'annual' | null; // billing period; null = not subscribed
  plusUntil: string;                     // ISO expiry — Plus lapses past this date
  streakFreezes: number;
  streakFreezeResetMonth: string;
  // todayISO of the day the on-open streak-rescue prompt was last resolved/dismissed,
  // so it only shows once per calendar day.
  streakRescueDismissedDate: string;
  savedTimerPresets: TimerPreset[];
  ambienceId: string | null;
  defaultCompanionId: DefaultCompanionId;
  activeCompanionId: ActiveCompanionId;
  // The free companion the player picked on first launch (one of STARTER_CHOICES'
  // active ids). Source of truth for "which of the five is owned for free"; the
  // other four are bought in the shop. `starterChosen` gates the picker.
  starterCompanionId: ActiveCompanionId;
  starterChosen: boolean;
  companionSlots: CompanionSlot[];
  bunSkinId: string;
  companionSkins: Record<string, string>;
  equippedBackgroundRoomId: string;
  equippedDeskRoomId: string;
  aiTickets: number;
  aiTicketsResetMonth: string;
  purchasedAiTickets: number;
  // Plus "room tickets": 1/month (on the purchase day-of-month) redeemable for any
  // single background OR desk. Kept on lapse; new ones only accrue while Plus.
  exchangeTickets: number;
  exchangeTicketAnchorDay: number;   // 1–31 day Plus was bought; 0 = unset
  exchangeTicketLastGrantISO: string; // account-tz YYYY-MM-DD of the last grant
  exchangeTicketPending: number;      // granted but not yet shown in the popup
  chatMessages: number;
  chatFreeUsedToday: number;
  chatFreeDate: string;
  chatThread: ChatTurn[];
  purchasedCoins: number;
  multipleReminders: ReminderEntry[];

  // Food / baking
  selectedFoodId: string;
  // One-time guard: an early build of the starter-chooser auto-switched the home
  // desk to the chosen character's recipe, leaving accounts stuck on the wrong
  // desk ingredients. We reset selectedFoodId to the default once, then flip this
  // so a player's later Bakery Menu choices are never overridden.
  deskFoodReset?: boolean;
  madeFoods: string[];
  // Companion badge keys the player has baked with (any recipe while that
  // companion was active). Collecting all five → unlocks Hanji.
  bakedWith: string[];
  // Set true the moment all character badges are collected (grants Hanji); the
  // home screen shows a one-time unlock popup, then clears it.
  hanjiUnlockPending: boolean;

  // Calendar day notes (dateISO → note text)
  dayNotes: Record<string, string>;

  // Calendar day shapes (dateISO → 'star' | 'heart' | 'tear'). The decorative mark
  // drawn as a watermark behind that day's cell. Set per DAY, so an ordinary day
  // with no exam can carry one too — an exam's own `shape` is only the fallback.
  dayShapes: Record<string, string>;

  // Calendar day shape COLOURS (dateISO → subject id). The subject whose colour
  // tints that day's shape. Stored as a subject id, not a colour, so recolouring
  // the subject recolours every day marked with it.
  daySubjects: Record<string, string>;

  // Friends
  friendCode: string;
  friends: Friend[];

  // Profile card (shareable ID card)
  profileDisplayName: string;
  profileDescription: string;
  profileBirthday: string; // YYYY-MM-DD or ''
  // Profile birthday changes are limited: after the initial set, the player may
  // correct it up to BIRTHDAY_CHANGE_LIMIT times. This counts the changes used.
  profileBirthdayChangeCount: number;
  // Legacy pre-counter flag ("change-once" era); migrated to the counter in
  // normalizePersistedState and never written again.
  profileBirthdayChanged?: boolean;
  profileBackgroundId: string; // room id used as the card backdrop
  profileCardColor: string; // pastel key for the card outline + friend-code strip (Plus)
  profileCompanionId: string; // chosen character for the card ('' = use active)
  profileSkinId: string; // chosen outfit/skin for that character
  profileAvatarFrame: string; // 'gold' while Plus (auto gold crown frame), else 'none'

  // Cake Kitchen mini-game best scores + chosen character
  cakeBestRush: number;
  cakeBestLine: number;
  cakeCharacter: string;

  // 2048 break-game best score
  game2048Best: number;

  // Broadcast mail the player has already claimed (mail row ids).
  claimedMailIds: string[];
  // Broadcast mail the player has opened (mail row ids). Opening = read, which
  // clears the mail notification dot even when the reward isn't claimed yet.
  readMailIds: string[];

  // i18n
  language: string;
  languageSelected: boolean;

  // Legal: whether the user accepted the Privacy Policy + Terms of Service.
  legalAccepted: boolean;
  // Whether the first-launch home tutorial (coachmark tour) has been shown.
  tutorialSeen: boolean;
  // Whether the user tapped the "Follow on Instagram" reward (one-time +100 coins).
  instagramFollowClaimed: boolean;
  // LEGACY. The consent gate used to capture a date of birth here for the age
  // check; it no longer collects one (App Review 5.1.1(v)) and normalizePersisted-
  // State clears any value left on older installs. Nothing reads it — kept only so
  // the field keeps a known shape while old blobs are being purged.
  birthday: string | null;

  // IANA timezone captured once on first load and kept for the account's lifetime.
  // The streak "day" rolls at 12am in this zone. Never re-extracted after first set.
  timezone: string;

  // Achievements: lifetime tallies not otherwise tracked, + which achievements have
  // been claimed (one-time). sessionsCompleted/totalMinutes/streak.longestStreak
  // already exist and back the rest.
  lifetimeTasksCompleted: number;
  lifetimeFriendSessions: number;
  claimedAchievements: string[];
};

// How many companion chat messages one AI generation ticket converts into.
export const CHAT_MESSAGES_PER_TICKET = 250;

// Free companion chat messages a Plus member gets each day (no ticket needed).
export const PLUS_DAILY_CHAT = 40;

// Most recent companion chat messages kept in local history.
export const CHAT_HISTORY_CAP = 50;

// Maximum active subjects. NOT a Plus perk — every account gets the same cap
// (mirrors MAX_EXAMS / MAX_TASKS). It's a sanity bound, not a paywall: far more
// than anyone tracks at once, and small enough that the pickers/charts stay cheap.
export const MAX_SUBJECTS = 50;

const DEFAULTS: PersistedState = {
  // New accounts start with a coin gift.
  coins: 1000,
  sessionsCompleted: 0,
  totalMinutes: 0,
  examCountdowns: [],
  reminderEnabled: false,
  reminderTime: '20:00',
  notifTasks: true,
  notifStreak: true,
  notifExams: true,
  use24HourTime: false,
  soundEffectsEnabled: true,
  vinylColor: '#3B3340',
  spotifyBgEnabled: false,
  spotifyBgColor: 'black',
  streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: null },
  earnedToday: 0,
  earnedDate: '',
  adRewardCount: 0,
  adRewardDate: '',
  loginStreak: 0,
  loginRewardDate: '',
  birthdayRewardYear: 0,
  subjects: INITIAL_SUBJECTS,
  tasks: [],
  ownedShopItems: [],
  equippedShopItems: {
    companion: null,
    outfits: null,
    background: null,
    desk: null,
    recipe: null,
    sound: null,
    reminder: null,
    decoration: null,
    outfit: null,
    theme: null,
    pose: null,
  },
  subjectTimeMap: {},
  subjectMonthly: {},
  skipSubjectCount: 0,
  sessionHistory: [],
  companionMinutes: {},
  companionBondToday: 0,
  companionBondDate: '',
  petBondToday: 0,
  petBondDate: '',
  // Wave 4
  isPlus: false,
  plusPlan: null,
  plusUntil: '',
  streakFreezes: 0,
  streakFreezeResetMonth: '',
  streakRescueDismissedDate: '',
  savedTimerPresets: [],
  ambienceId: null,
  defaultCompanionId: 'girl',
  activeCompanionId: 'starter:girl',
  starterCompanionId: 'starter:girl',
  starterChosen: false,
  companionSlots: [],
  bunSkinId: 'classic',
  companionSkins: {},
  equippedBackgroundRoomId: 'cozy',
  equippedDeskRoomId: 'cozy',
  aiTickets: 0,
  aiTicketsResetMonth: '',
  purchasedAiTickets: 0,
  exchangeTickets: 0,
  exchangeTicketAnchorDay: 0,
  exchangeTicketLastGrantISO: '',
  exchangeTicketPending: 0,
  chatMessages: 0,
  chatFreeUsedToday: 0,
  chatFreeDate: '',
  chatThread: [],
  purchasedCoins: 0,
  multipleReminders: [],
  selectedFoodId: 'strawberry-shortcake',
  deskFoodReset: true,
  madeFoods: [],
  bakedWith: [],
  hanjiUnlockPending: false,
  dayNotes: {},
  dayShapes: {},
  daySubjects: {},
  friendCode: '',
  friends: [],
  profileDisplayName: '',
  profileDescription: '',
  profileBirthday: '',
  profileBirthdayChangeCount: 0,
  profileBackgroundId: 'cozy',
  profileCardColor: 'pink',
  profileCompanionId: '',
  profileSkinId: 'classic',
  profileAvatarFrame: 'none',
  cakeBestRush: 0,
  cakeBestLine: 0,
  cakeCharacter: 'bun',
  game2048Best: 0,
  claimedMailIds: [],
  readMailIds: [],
  language: 'en',
  languageSelected: false,
  legalAccepted: false,
  tutorialSeen: false,
  instagramFollowClaimed: false,
  birthday: null,
  timezone: '',
  lifetimeTasksCompleted: 0,
  lifetimeFriendSessions: 0,
  claimedAchievements: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The user's "day" is anchored to a timezone captured ONCE per account (on first
// load — see normalizePersistedState), then persisted and reused forever; we never
// re-extract it, so travelling/changing devices won't shift their streak day. Until
// that stored value is applied we fall back to the current device timezone. All day
// math (todayISO/yesterdayISO/daysBetween) flows through here so the streak engine
// and its UI agree on when midnight (12am) is.
let activeTimezone: string | null = null;

export function setActiveTimezone(tz: string | null | undefined): void {
  activeTimezone = tz || null;
}

function detectDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Calendar date (YYYY-MM-DD) of `date` as seen in `tz` (device tz when null).
function dateInTimeZone(date: Date, tz: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export function todayISO(): string {
  return dateInTimeZone(new Date(), activeTimezone);
}

// Shift a YYYY-MM-DD string by whole days via pure UTC calendar math (DST-safe).
function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * 86400000).toISOString().split('T')[0];
}

function yesterdayISO(): string {
  return addDaysISO(todayISO(), -1);
}

/** The account-timezone calendar date `n` days before today (n=0 → today). */
export function daysAgoISO(n: number): string {
  return addDaysISO(todayISO(), -n);
}

/** First day of the rolling 7-day report window (today + the 6 days before it).
 *  Stats screens share this so "this week" means the same thing everywhere. */
export function weekStartISO(): string {
  return daysAgoISO(6);
}

/** Calendar date (YYYY-MM-DD) an ISO *timestamp* falls on in the account's
 *  timezone. Timestamps like Task.completedAt are stored in UTC, so slicing the
 *  string would bucket an 8pm New York finish into the NEXT day. */
export function accountDateOf(timestamp: string): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp.slice(0, 10);
  return dateInTimeZone(d, activeTimezone);
}

/** Monday of the current week, in the account's timezone (pure string math, so
 *  it can't slip a day the way local-Date → toISOString() does). */
export function weekMondayISO(): string {
  const today = todayISO();
  // Weekday of `today` via UTC (the ISO string is timezone-free by construction).
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun … 6=Sat
  return addDaysISO(today, -(dow === 0 ? 6 : dow - 1));
}

// Days in a given month (m is 1–12). Day 0 of next month = last day of this one.
function daysInMonth(y: number, m1to12: number): number {
  return new Date(y, m1to12, 0).getDate();
}

// How many monthly room-ticket grants are due since `lastGrantISO` up to `today`
// (both account-tz YYYY-MM-DD). One grant per monthly anniversary of the purchase
// day-of-month (`anchorDay`), clamped to the last day for short months (e.g. a 31st
// anchor pays Feb 28/29). Returns the count owed + the new last-grant date. Catches
// up multiple months if the app wasn't opened. Lexicographic compare on
// YYYY-MM-DD is correct since all parts are zero-padded.
export function exchangeTicketsDue(
  anchorDay: number,
  lastGrantISO: string,
  today: string,
): { granted: number; lastISO: string } {
  if (!anchorDay || !lastGrantISO) return { granted: 0, lastISO: lastGrantISO };
  const pad = (n: number) => String(n).padStart(2, '0');
  let [y, m] = lastGrantISO.slice(0, 10).split('-').map(Number);
  let granted = 0;
  let lastISO = lastGrantISO.slice(0, 10);
  // Cap iterations so a corrupt/old date can never spin forever.
  for (let i = 0; i < 600; i++) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const ann = `${y}-${pad(m)}-${pad(Math.min(anchorDay, daysInMonth(y, m)))}`;
    if (ann <= today) { granted += 1; lastISO = ann; } else break;
  }
  return { granted, lastISO };
}

const MAX_COMPANION_SLOTS = 3;
// Exam countdowns are NOT a Plus perk — every account gets the same cap, and
// past-due countdowns are kept (never auto-erased) for everyone. The cap is a
// sanity bound, not a paywall: far more than anyone tracks at once, and small
// enough that the list/calendar stay cheap to render. Exported so the UI gates
// read from one source.
export const MAX_EXAMS = 50;
// Total tasks a user can keep at once.
export const MAX_TASKS = 1000;
const STREAK_MAX = 200; // study-day streak caps here

// How long a lapsed streak stays rescuable, measured as the gap since lastStudyDate
// (daysBetween, account timezone). gap 1 = studied yesterday, still alive and needing no
// rescue; gap 2 = one missed day, the FIRST day the rescue is offered; gap 31 = 30 missed
// days, the LAST day it's offered. So the player gets exactly 30 days to come back and
// spend a freeze. Every gate — the engine, the on-open prompt, the session-complete
// prompt, the Progress banner — reads these, so they can never drift apart again.
export const STREAK_RESCUE_MIN_GAP = 2;
export const STREAK_RESCUE_MAX_GAP = 31;
export const STREAK_RESCUE_DAYS = STREAK_RESCUE_MAX_GAP - STREAK_RESCUE_MIN_GAP + 1; // 30

// Whole-day difference between two YYYY-MM-DD strings via pure UTC calendar math
// (timezone/DST independent). Single source of truth for streak day-counting — the
// engine AND its UI (progress banner, rescue prompt, freeze button) all measure
// "days since last study" through this + todayISO() so they always agree.
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = b.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// Pure streak transition for a study completion on `today`. `changed` is false when
// the day already counts (so callers can leave state untouched and award no bonus).
// `next` is both the new streak number and the coin bonus for the day. When `rescue`
// is set and the gap is within the freeze window (STREAK_RESCUE_DAYS days to act,
// counting from the first missed day), the streak is bridged and continued (consuming a
// freeze) instead of resetting.
function nextStreakState(
  st: StreakData,
  today: string,
  rescue = false,
): { changed: boolean; next: number; isComeback: boolean; useFreeze: boolean } {
  if (!st.lastStudyDate) return { changed: true, next: 1, isComeback: false, useFreeze: false };
  const diff = daysBetween(st.lastStudyDate, today);
  if (diff === 0) return { changed: false, next: st.currentStreak, isComeback: false, useFreeze: false };
  if (diff === 1) {
    return { changed: true, next: Math.min(STREAK_MAX, st.currentStreak + 1), isComeback: false, useFreeze: false };
  }
  if (rescue && diff <= STREAK_RESCUE_MAX_GAP) {
    // Bridge the missed days with a freeze and continue the streak.
    return { changed: true, next: Math.min(STREAK_MAX, st.currentStreak + 1), isComeback: false, useFreeze: true };
  }
  // Missed too long (or no rescue) → streak resets; today is day 1 of a fresh streak.
  return { changed: true, next: 1, isComeback: true, useFreeze: false };
}

// True when a lapsed streak can STILL be rescued: the gap since last activity is inside
// the freeze window (STREAK_RESCUE_DAYS days to act, counting from the first missed day).
// A streak already given up via declineStreakRescue has currentStreak 0 and is NOT
// rescuable — that guard is what stops a declined prompt reappearing tomorrow, since the
// dismissed-date stamp alone only suppresses it for the day.
// Rescue is possible for ANY user here — they can
// use an owned freeze OR buy one on the spot (freezes are no longer Plus-only to use),
// so this depends only on the gap, not on Plus or current inventory. The login reward
// + home streak display consult it so neither shows nor commits a reset for a streak
// the rescue prompt can still save — without it, claiming the daily reward (or the
// login flow advancing the streak) before rescuing would silently kill the streak.
export function streakRescueAvailable(
  s: { streak: StreakData },
  today: string,
): boolean {
  const last = s.streak.lastStudyDate;
  if (!last) return false;
  if (s.streak.currentStreak <= 0) return false;
  const gap = daysBetween(last, today);
  return gap >= STREAK_RESCUE_MIN_GAP && gap <= STREAK_RESCUE_MAX_GAP;
}

// The streak is rescuable AND today's on-open rescue prompt hasn't been resolved yet.
// This is the "hold" gate: while pending, the streak display is held at its current
// value, the login reward neither previews nor commits a reset, and the Home prompt
// shows. Once the player decides (picks "Let it reset", or uses/buys a freeze), the
// dismissed date is stamped to today → pending goes false → the streak reverts to its
// normal projection (a decline resets it on the next claim/study; a rescue continues it).
export function streakRescuePending(
  s: { streak: StreakData; streakRescueDismissedDate: string },
  today: string,
): boolean {
  return streakRescueAvailable(s, today) && s.streakRescueDismissedDate !== today;
}

// Pure daily-login-reward transition. Single source of truth shared by the popup
// (to preview today's reward) and claimLoginReward (to commit it) so the displayed
// day/coins can never drift from what gets awarded. `available` is false once the
// reward has already been claimed today. A gap of more than one day resets the
// cycle to day 1.
// The daily reward is tied to the streak: `day` is *today's* streak day — what the
// streak becomes counting today, since showing up keeps the streak alive just like
// studying does. `coins` is the actual payout: the day's base value (day N = N coins,
// capped at 200), DOUBLED for Plus members. `baseCoins` is the undoubled value (what
// free users see and what the upsell promises to 2x). `available` is false once it
// has already been claimed today.
export type LoginReward = { available: boolean; day: number; coins: number; baseCoins: number };
export function nextLoginReward(
  s: { loginRewardDate: string; streak: StreakData; isPlus: boolean; streakFreezes: number; streakRescueDismissedDate?: string },
  today: string,
): LoginReward {
  // While the on-open rescue prompt is still pending, claiming the login reward must
  // NOT reset the streak — preview (and later award) the preserved current streak day
  // instead of the day-1 projection, leaving the decision to the rescue prompt. Once
  // it's resolved (dismissedDate stamped), fall back to the normal projection so a
  // declined streak resets on claim (matches claimLoginReward).
  const pending = streakRescuePending({ streak: s.streak, streakRescueDismissedDate: s.streakRescueDismissedDate ?? '' }, today);
  const day = pending ? s.streak.currentStreak : nextStreakState(s.streak, today).next;
  const baseCoins = dailyRewardCoins(day);
  return { available: s.loginRewardDate !== today, day, baseCoins, coins: s.isPlus ? baseCoins * 2 : baseCoins };
}

// Birthday gift: a flat coin bonus granted once on the player's birthday each year.
export const BIRTHDAY_REWARD_COINS = 1000;

// How many times the profile birthday may be changed after its initial set.
export const BIRTHDAY_CHANGE_LIMIT = 2;

// True when `today` (account-timezone ISO) falls on the player's profile birthday.
// profileBirthday is stored with an arbitrary year (the picker hides the year), so
// only the month + day (MM-DD) are compared. An unset birthday never matches.
export function isBirthdayToday(profileBirthday: string, today: string): boolean {
  if (!profileBirthday || profileBirthday.length < 10) return false;
  return profileBirthday.slice(5, 10) === today.slice(5, 10);
}

// True when the birthday reward is claimable: it's the player's birthday today and
// the reward hasn't already been claimed this calendar year.
export function birthdayRewardAvailable(
  s: { profileBirthday: string; birthdayRewardYear: number },
  today: string,
): boolean {
  return isBirthdayToday(s.profileBirthday, today) && s.birthdayRewardYear !== Number(today.slice(0, 4));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getShopItem(itemId: string) {
  return SHOP_ITEMS.find((item) => item.id === itemId) ?? null;
}

function normalizePersistedState(saved?: Partial<PersistedState> | null): PersistedState {
  if (!saved) {
    // Brand-new user: capture device language + timezone once, now.
    return {
      ...DEFAULTS,
      friendCode: generateFriendCode(),
      language: detectDeviceLanguage(),
      timezone: detectDeviceTimezone(),
    };
  }

  const month = new Date().toISOString().slice(0, 7);
  const merged = { ...saved };

  // Disco ("Spotify background") mode never persists across launches — every app start
  // (and therefore every study session) begins in the normal desk view; the player
  // opts into disco during the session. Their colour choice is kept for next time.
  merged.spotifyBgEnabled = false;

  // Plus lapses at the end of its billing period — monthly subscriptions end after
  // a month, annual after a year (plusUntil is set accordingly on subscribe). Owned
  // Plus perks are kept; only the membership + its monthly allotments stop.
  if (merged.isPlus && !merged.plusUntil) {
    // Migrate pre-expiry Plus members: treat them as monthly, ending a month out.
    const until = new Date();
    until.setMonth(until.getMonth() + 1);
    merged.plusPlan = merged.plusPlan ?? 'monthly';
    merged.plusUntil = until.toISOString();
  }
  if (merged.isPlus && merged.plusUntil && new Date(merged.plusUntil).getTime() <= Date.now()) {
    merged.isPlus = false;
    merged.plusPlan = null;
  }
  // Plus members automatically get the gold crown avatar frame; everyone else has
  // none. It's not equippable — it just mirrors Plus status (and is published so
  // friends see it on your card). This also migrates anyone off the old equippable
  // frame ids ('crown'/'catEars'/'dessert').
  merged.profileAvatarFrame = merged.isPlus ? 'gold' : 'none';

  // Birthday edits used to be a change-once boolean; it's now a counter capped at
  // BIRTHDAY_CHANGE_LIMIT. Players who burned their old single change get credited
  // 1 used change, so they gain one more under the raised limit.
  // The consent gate used to capture a real date of birth here. It is no longer
  // collected (App Review 5.1.1(v)) and was never read by anything, so drop any
  // value left on existing installs — clearing it here also clears the
  // user_state.data mirror on the next save.
  if (merged.birthday) merged.birthday = null;
  if (merged.profileBirthdayChangeCount === undefined) {
    merged.profileBirthdayChangeCount = merged.profileBirthdayChanged ? 1 : 0;
  }
  delete merged.profileBirthdayChanged;

  // Only Plus members get the monthly allotment of free streak freezes.
  if (merged.isPlus && (!merged.streakFreezeResetMonth || merged.streakFreezeResetMonth < month)) {
    merged.streakFreezes = 3;
    merged.streakFreezeResetMonth = month;
  }

  if (merged.isPlus && (!merged.aiTicketsResetMonth || merged.aiTicketsResetMonth < month)) {
    merged.aiTickets = 3;
    merged.aiTicketsResetMonth = month;
  }

  // Plus room tickets. A fresh purchase sets the first ticket + anchor in setIsPlus;
  // every later ticket comes from the monthly-anniversary catch-up below.
  //
  // A Plus member with no anchor yet (subscribed before this feature, or a state copy
  // written by an older build) only gets the anchor INITIALISED here — deliberately
  // no ticket and no popup. This runs on every state load, so granting here handed out
  // a room ticket on login whenever the anchor was missing, which is not a renewal.
  // Anchoring silently means their next ticket arrives on the monthly anniversary,
  // which is the only cadence tickets are supposed to follow.
  if (merged.isPlus) {
    // exchangeTicketLastGrantISO is the SOURCE OF TRUTH for "has a ticket ever been
    // paid, and when"; exchangeTicketAnchorDay is only a cache of its day-of-month.
    // Rebuild the anchor from the grant record when it's missing, so a state copy
    // that lost the anchor — an older schema, or a cloud blob written before the
    // field existed — can't read as "never granted" and pay out a second time.
    // Crucially this does NOT overwrite lastGrantISO: stamping it with today (as
    // this used to) destroyed a real grant date and pushed the next ticket out by
    // up to a full month.
    if (!merged.exchangeTicketAnchorDay) {
      const recorded = Number((merged.exchangeTicketLastGrantISO ?? '').slice(8, 10));
      if (recorded >= 1 && recorded <= 31) merged.exchangeTicketAnchorDay = recorded;
    }
    if (!merged.exchangeTicketAnchorDay) {
      // No anchor and no grant on record → subscribed before this feature existed.
      // Anchor silently: no ticket and no popup, because this isn't a renewal.
      const t0 = todayISO();
      merged.exchangeTicketAnchorDay = Number(t0.slice(8, 10));
      merged.exchangeTicketLastGrantISO = t0;
    } else {
      // Grant any monthly-anniversary tickets owed since the last grant.
      const due = exchangeTicketsDue(
        merged.exchangeTicketAnchorDay,
        merged.exchangeTicketLastGrantISO ?? '',
        todayISO(),
      );
      if (due.granted > 0) {
        merged.exchangeTickets = (merged.exchangeTickets ?? 0) + due.granted;
        merged.exchangeTicketPending = (merged.exchangeTicketPending ?? 0) + due.granted;
        merged.exchangeTicketLastGrantISO = due.lastISO;
      }
    }
  }

  // Plus exclusive: ensure Plus members own the Berry Princess Bun skin and the
  // Strawberry Palace room (covers players who had Plus before these became perks).
  for (const plusGrant of ['outfit_bun_strawberry', 'bg_strawberry_palace', 'desk_strawberry']) {
    if (merged.isPlus && !(merged.ownedShopItems ?? []).includes(plusGrant)) {
      merged.ownedShopItems = [...(merged.ownedShopItems ?? []), plusGrant];
    }
  }

  // Plus perk: all study/ambience sounds are free WHILE subscribed — but we do NOT
  // bake them into ownedShopItems (that would keep them forever even after Plus
  // lapses). Access is gated at use-time as `isPlus || ownedShopItems.includes(id)`,
  // so Plus members get every sound for free, anything bought with coins is kept
  // forever, and unbought sounds re-lock the moment Plus ends.

  // One-time desk fix: an early starter-chooser auto-switched the home desk to the
  // chosen character's recipe, leaving accounts stuck on the wrong ingredients.
  // Reset the selected desk food to the default strawberry shortcake once, then
  // mark it done so later Bakery Menu choices are respected.
  if (!merged.deskFoodReset) {
    merged.selectedFoodId = 'strawberry-shortcake';
    merged.deskFoodReset = true;
  }

  // Badge progress is derived from the recipes actually made. Recompute it here so
  // any save corrupted by the old equipped-companion logic self-heals (e.g. a badge
  // credited for the wrong character drops off).
  merged.bakedWith = badgesFromMadeFoods(merged.madeFoods ?? []);

  // Badge reward: grant Hanji once the player has earned all five character badges
  // (covers anyone who reached that before this check existed). The home screen
  // shows the one-time unlock popup off `hanjiUnlockPending`.
  if (hasAllCharacterBadges(merged.bakedWith ?? []) && !(merged.ownedShopItems ?? []).includes(HANJI_COMPANION_ID)) {
    merged.ownedShopItems = [...(merged.ownedShopItems ?? []), HANJI_COMPANION_ID];
    merged.hanjiUnlockPending = true;
  }

  merged.equippedShopItems = {
    ...DEFAULTS.equippedShopItems,
    ...(merged.equippedShopItems ?? {}),
  };

  merged.companionSlots = (merged.companionSlots ?? []).map((slot) => {
    const normalizedSlot = slot as Partial<CompanionSlot>;
    return {
      ...normalizedSlot,
      imagePath: normalizedSlot.imagePath ?? null,
      imageUri: normalizedSlot.imageUri ?? null,
      prompt: normalizedSlot.prompt ?? null,
    } as CompanionSlot;
  });

  const activeCompanionId = merged.activeCompanionId ?? `starter:${merged.defaultCompanionId ?? DEFAULTS.defaultCompanionId}`;
  const activeCompanionExists =
    activeCompanionId === 'starter:girl' ||
    activeCompanionId === 'starter:dude' ||
    (activeCompanionId.startsWith('shop:') && (merged.ownedShopItems ?? []).includes(activeCompanionId.slice(5))) ||
    merged.companionSlots.some((slot) => slot.id === activeCompanionId);
  // Fall back to the player's free starter (not always Bun — a non-Bun starter
  // doesn't own Bun) when the saved active id is gone/invalid.
  merged.activeCompanionId = activeCompanionExists
    ? activeCompanionId
    : merged.starterCompanionId ?? `starter:${merged.defaultCompanionId ?? DEFAULTS.defaultCompanionId}`;

  // Starter picker: existing players (saved before this feature) keep Bun and skip
  // the picker — anyone who already passed the legal gate is grandfathered in.
  // Brand-new accounts/guests (legalAccepted not yet true) get starterChosen=false
  // so the picker runs once after consent.
  if (merged.starterChosen === undefined) merged.starterChosen = !!merged.legalAccepted;
  // Existing users (already past the legal gate) shouldn't suddenly get the new
  // first-launch tutorial; only brand-new accounts see it after onboarding.
  if (merged.tutorialSeen === undefined) merged.tutorialSeen = !!merged.legalAccepted;
  if (!merged.starterCompanionId) merged.starterCompanionId = 'starter:girl';

  // Retroactively grant the recipe tied to the player's chosen starter, so anyone
  // who picked a starter BEFORE this perk existed still owns that character's
  // signature recipe (new picks get it in chooseStarter). Bun's recipe is free
  // (recipeItem null → no-op). Ownership-gated, so it never re-adds.
  if (merged.starterChosen) {
    const starterCid = merged.starterCompanionId === 'starter:girl' ? '' : merged.starterCompanionId;
    const sr = starterRecipe(starterCid);
    if (sr?.recipeItem && !(merged.ownedShopItems ?? []).includes(sr.recipeItem)) {
      merged.ownedShopItems = [...(merged.ownedShopItems ?? []), sr.recipeItem];
    }
  }

  // Give every user a stable friend code the first time.
  if (!merged.friendCode) merged.friendCode = generateFriendCode();

  // Capture the account's timezone exactly once (first load after this feature
  // shipped, or brand-new accounts above). Once stored it's never re-extracted, so
  // the streak day boundary stays put even if the user later changes timezone.
  if (!merged.timezone) merged.timezone = detectDeviceTimezone();

  // Users from before the language feature have no saved language — fall back to
  // their device language rather than forcing English.
  // Deduplicate friends by code — duplicates can creep in via cloud sync merges.
  if (merged.friends) {
    const seen = new Set<string>();
    merged.friends = merged.friends.filter((f: { code: string }) => {
      if (seen.has(f.code)) return false;
      seen.add(f.code);
      return true;
    });
  }
  return { ...DEFAULTS, ...merged, language: merged.language ?? detectDeviceLanguage() };
}

// ─── Context type ─────────────────────────────────────────────────────────────

type AppContextType = {
  loaded: boolean;

  // Wave 1 state
  coins: number;
  sessionsCompleted: number;
  totalMinutes: number;
  examCountdowns: ExamCountdown[];
  reminderEnabled: boolean;
  reminderTime: string;
  notifTasks: boolean;
  notifStreak: boolean;
  notifExams: boolean;
  setNotifTasks: (value: boolean) => void;
  setNotifStreak: (value: boolean) => void;
  setNotifExams: (value: boolean) => void;
  use24HourTime: boolean;
  soundEffectsEnabled: boolean;
  vinylColor: string;
  // "Spotify background" study mode: replace the room background with a solid colour +
  // a large album-cover vinyl while studying. Colour is the user's pick.
  spotifyBgEnabled: boolean;
  spotifyBgColor: 'black' | 'white';
  streak: StreakData;
  todayStreakDay: number;
  earnedToday: number;
  // Rewarded-video ads watched-for-coins today (rolled to today, reads 0 on a new day).
  adRewardCount: number;
  loginStreak: number;
  loginRewardDate: string;

  // Achievements — lifetime tallies + which one-time milestones have been claimed.
  lifetimeTasksCompleted: number;
  lifetimeFriendSessions: number;
  claimedAchievements: string[];
  // Bump the friend-session tally (backs the Social achievements); called on a
  // multiplayer finish.
  recordFriendSession: () => void;
  claimAchievement: (id: string) => void;

  // Wave 2 state
  subjects: Subject[];
  tasks: Task[];
  ownedShopItems: string[];
  equippedShopItems: EquippedShopItems;
  subjectTimeMap: Record<string, number>;
  /** Per-month, per-subject minutes: "YYYY-MM" -> subject -> minutes. Never
   *  trimmed, unlike sessionHistory — it is the only honest source for the
   *  Progress tab's Year range once raw records age out. Tiny: roughly six
   *  subjects x twelve months of numbers per year. */
  subjectMonthly: Record<string, Record<string, number>>;
  skipSubjectCount: number;
  sessionHistory: SessionRecord[];
  companionMinutes: Record<string, number>;
  activeSession: ActiveSession | null;
  /** Accumulator for the current solo run (checkpoint + Rest receipt display). */
  sessionRun: SessionRun | null;

  // Wave 4 state
  isPlus: boolean;
  plusPlan: 'monthly' | 'annual' | null;
  plusUntil: string;
  streakFreezes: number;
  // True when the streak lapsed inside the rescue window and today's on-open prompt hasn't
  // been resolved yet — drives the Home StreakRescueModal and gates the daily reward.
  streakRescuePending: boolean;
  streakRescueDismissedDate: string;
  savedTimerPresets: TimerPreset[];
  ambienceId: string | null;
  defaultCompanionId: DefaultCompanionId;
  activeCompanionId: ActiveCompanionId;
  // The free companion the player picked on first launch (one of STARTER_CHOICES'
  // active ids). Source of truth for "which of the five is owned for free"; the
  // other four are bought in the shop. `starterChosen` gates the picker.
  starterCompanionId: ActiveCompanionId;
  starterChosen: boolean;
  companionSlots: CompanionSlot[];
  bunSkinId: string;
  companionSkins: Record<string, string>;
  equippedBackgroundRoomId: string;
  equippedDeskRoomId: string;
  aiTickets: number;
  purchasedAiTickets: number;
  exchangeTickets: number;
  exchangeTicketPending: number;
  chatMessages: number;
  dailyChatRemaining: number;
  chatThread: ChatTurn[];
  purchasedCoins: number;
  multipleReminders: ReminderEntry[];
  language: string;
  languageSelected: boolean;
  legalAccepted: boolean;
  tutorialSeen: boolean;
  instagramFollowClaimed: boolean;
  birthday: string | null;
  selectedFoodId: string;
  madeFoods: string[];
  bakedWith: string[];
  setSelectedFood: (id: string) => void;
  markFoodMade: (id: string) => void;
  hanjiUnlockPending: boolean;
  clearHanjiUnlock: () => void;
  devUnlockHanji: () => void;
  recipeBadgePending: string | null;
  clearRecipeBadge: () => void;
  // Shop SKU of a just-obtained companion → drives the one-shot "character
  // obtained" celebration. Transient (not persisted); cleared on dismiss.
  characterObtainedPending: string | null;
  clearCharacterObtained: () => void;
  // A companion whose bond level just increased (from studying) → drives the
  // one-shot Home level-up celebration. Transient (not persisted); cleared on dismiss.
  bondLevelUp: { companionId: string; level: number } | null;
  clearBondLevelUp: () => void;
  /** DEV-only: fire the bond level-up celebration for the active companion at its next level. */
  previewBondLevelUp: () => void;
  /** DEV-only: fake a 1-day streak lapse (+1 freeze) so the "Use streak freeze" rescue prompt shows on Home. */
  devLapseStreak: (daysAgo?: number) => void;
  /** DEV-only: max out the account — own the whole shop catalog, all recipes/badges
   *  (incl. Hanji), 9,999,999 coins, high bond with every companion, Plus active. */
  devMaxOutAccount: () => void;
  // True once this account's saved state has been *reliably* loaded (local/cloud) —
  // distinct from `loaded`, which also flips true when a load fails and saving is
  // paused. Guards the abandoned-onboarding reset from acting on default fallbacks.
  persistedStateReady: boolean;
  // Onboarding bail-out: wipe the half-finished account (local + cloud) back to a
  // fresh state so a later re-login restarts onboarding from scratch.
  resetAccountForAbandonedOnboarding: () => Promise<void>;
  resetGameData: () => void;
  dayNotes: Record<string, string>;
  setDayNote: (date: string, note: string) => void;
  dayShapes: Record<string, string>;
  /** Set (or clear, with null) the decorative shape drawn on a calendar day. */
  setDayShape: (date: string, shape: string | null) => void;
  daySubjects: Record<string, string>;
  /** Set (or clear, with null) the subject whose colour tints a day's shape. */
  setDaySubject: (date: string, subjectId: string | null) => void;
  friendCode: string;
  // Last error from syncing my public profile card to the cloud (null = synced OK).
  // Surfaced on the Friends screen so "my code can't be found" stops being silent:
  // if this is set, my `profiles` row never landed and friends can't add me.
  lastProfileSyncError: string | null;
  friends: Friend[];
  addFriend: (code: string) => { ok: boolean; error?: string };
  removeFriend: (code: string) => void;
  // Moderation: codes this account has blocked, and block/unblock actions. Blocked
  // friends are filtered out of `friends`.
  blockedCodes: string[];
  blockUser: (code: string) => void;
  unblockUser: (code: string) => void;
  setFriendProfile: (code: string, data: Partial<Friend>) => void;
  // Unread DM counts by friend code, with setters used by the chat + inbox listener.
  dmUnread: Record<string, number>;
  setDmUnreadCounts: (counts: Record<string, number>) => void;
  bumpDmUnread: (code: string) => void;
  clearDmUnread: (code: string) => void;
  profileDisplayName: string;
  profileDescription: string;
  profileBirthday: string;
  profileBirthdayChangeCount: number;
  profileBackgroundId: string;
  profileCardColor: string;
  profileCompanionId: string;
  profileSkinId: string;
  profileAvatarFrame: string;
  updateProfile: (patch: Partial<{
    displayName: string;
    description: string;
    birthday: string;
    birthdayChangeUsed: boolean;
    backgroundId: string;
    cardColor: string;
    companionId: string;
    skinId: string;
    avatarFrame: string;
  }>) => void;
  cakeBestRush: number;
  cakeBestLine: number;
  cakeCharacter: string;
  setCakeCharacter: (id: string) => void;
  recordCakeBest: (mode: 'rush' | 'line', score: number) => void;
  game2048Best: number;
  recordGame2048Best: (score: number) => void;
  claimedMailIds: string[];
  claimMail: (mail: { id: string; coins: number; itemId: string | null }) => Promise<boolean>;
  readMailIds: string[];
  markMailRead: (id: string) => void;
  setLanguage: (lang: string) => void;
  chooseLoginLanguage: (lang: string) => void;
  markLanguageSelected: () => void;
  markLegalAccepted: () => void;
  markTutorialSeen: () => void;
  replayTutorial: () => void;
  claimInstagramFollow: () => void;

  // Wave 1 actions
  addCoins: (amount: number) => void;
  // Grant the coins for one watched rewarded ad. Returns true if granted, false if
  // the daily limit (DAILY_AD_LIMIT) is already reached. Coins bypass DAILY_EARN_CAP.
  claimAdReward: () => boolean;
  claimLoginReward: () => void;
  // Birthday gift (+1000 coins, once per year on the player's birthday).
  birthdayRewardYear: number;
  claimBirthdayReward: () => void;
  recordSession: (minutes: number) => void;
  petCompanion: () => void;
  addExam: (exam: Omit<ExamCountdown, 'id'>) => string | null;
  removeExam: (id: string) => void;
  updateExam: (id: string, patch: Partial<Omit<ExamCountdown, 'id'>>) => void;
  setReminder: (enabled: boolean, time: string) => void;
  setUse24HourTime: (value: boolean) => void;
  setSoundEffectsEnabled: (value: boolean) => void;
  setVinylColor: (value: string) => void;
  setSpotifyBgEnabled: (value: boolean) => void;
  setSpotifyBgColor: (value: 'black' | 'white') => void;
  updateStreak: (opts?: { rescueWithFreeze?: boolean }) => {
    bonus: number;
    isComeback: boolean;
    rescued: boolean;
  };

  // Wave 2 subject actions
  addSubject: (name: string, color: string, emoji?: string) => boolean;
  renameSubject: (id: string, name: string) => void;
  /** Change an existing subject's colour. The value is a #RRGGBB hex — several
   *  render sites append an alpha suffix to it (`color + '2E'`), so the 7-char
   *  form is load-bearing. */
  recolorSubject: (id: string, color: string) => void;
  archiveSubject: (id: string) => void;
  deleteSubject: (id: string) => void;
  reorderSubjects: (orderedIds: string[]) => void;

  // Wave 2 task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'postponeCount' | 'lastActivityAt' | 'notifId'>) => string;
  updateTask: (id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'subjectId' | 'dueDate' | 'isDeadline' | 'dueTime' | 'estimatedMinutes' | 'priority' | 'status' | 'notifyAt' | 'reminderMode' | 'repeatDays' | 'repeatUntil'>>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  postponeTask: (id: string) => void;

  // Wave 2 subject-time + session-history
  addSubjectTime: (subjectName: string | null, minutes: number) => void;
  startActiveSession: (session: {
    durationMinutes: number;
    subjectName: string | null;
    taskId: string | null;
    taskTitle: string | null;
    /** Shared start instant for synced multiplayer study rooms (defaults to now). */
    startedAt?: string;
    /** Marks the session as a multiplayer study-room session. */
    isMultiplayer?: boolean;
    /** Custom break length (minutes) for the single-player break. */
    breakMinutes?: number;
    /** True when auto-started by the post-break next-session countdown. */
    autoStarted?: boolean;
    lockedIn?: boolean;
    /** True when this block continues the same run (keeps the run accumulator). */
    continuedRun?: boolean;
  }) => string; // returns the new session's id
  clearActiveSession: () => void;
  /** Credit one finished solo study block (coins/streak/bond/subject) immediately
   *  and accumulate it into `sessionRun`. `coins` is the pre-cap amount. */
  finishStudyBlock: (block: { minutes: number; coins: number; subjectName: string | null }) => void;
  /** Reset the run accumulator (on Rest/Done or an early stop). */
  clearSessionRun: () => void;
  /** Pushes the active session's start forward by `seconds` (pause-for-break). */
  shiftSessionStart: (seconds: number) => void;
  /** Set the active session's subject in place (no new session id) — used when a
   *  solo/MP player picks their subject after the session has already started. */
  setActiveSessionSubject: (subjectName: string | null) => void;
  /** Flag the active session as multiplayer (e.g. a solo session promoted to a room
   *  when the studier invites a friend in), so completion credits "with friend". */
  markSessionMultiplayer: () => void;

  // Wave 2 skip nudge
  incrementSkipSubjectCount: () => void;
  resetSkipSubjectCount: () => void;

  // Wave 2 shop
  purchaseShopItem: (itemId: string, price: number) => boolean;
  redeemTicketForItem: (itemId: string) => boolean;
  clearExchangeTicketPending: () => void;
  equipShopItem: (itemId: string) => boolean;

  // Wave 4 actions
  setIsPlus: (value: boolean, plan?: 'monthly' | 'annual', untilOverride?: string, announce?: boolean) => void;
  useStreakFreeze: () => boolean;
  // Bridge the streak after buying a freeze on the spot (net-zero inventory).
  rescueStreakByPurchase: () => boolean;
  // Mark today's on-open rescue prompt handled so it doesn't reshow.
  dismissStreakRescue: () => void;
  declineStreakRescue: () => void;
  saveTimerPreset: (preset: Omit<TimerPreset, 'id'>) => void;
  deleteTimerPreset: (id: string) => void;
  setAmbience: (id: string | null) => void;
  setDefaultCompanion: (id: DefaultCompanionId) => void;
  setActiveCompanion: (id: ActiveCompanionId) => void;
  /** First-launch starter pick: grant `activeId` free, set it active, and mark
   * the picker done. `activeId` must be one of STARTER_CHOICES' active ids. */
  chooseStarter: (activeId: ActiveCompanionId) => void;
  setBunSkin: (skinId: string) => void;
  setCompanionSkin: (companionId: string, skinId: string) => void;
  setEquippedBackground: (roomId: string) => void;
  setEquippedDesk: (roomId: string) => void;
  /** Equip a bought sound (or null to turn it off). */
  setEquippedSound: (soundId: string | null) => void;
  saveCompanionSlot: (slot: Omit<CompanionSlot, 'id'>) => string | null;
  deleteCompanionSlot: (id: string) => void;
  setCompanionPfp: (id: string, pfp: PfpFocus) => void;
  consumeAiTicket: () => boolean;
  restoreAiTicket: () => void;
  purchaseAiTickets: (amount: number) => void;
  exchangeTicketForChat: () => boolean;
  consumeChatMessage: () => boolean;
  setChatThread: (turns: ChatTurn[]) => void;
  addPurchasedCoins: (amount: number) => void;
  addStreakFreeze: (count?: number) => void;
  setMultipleReminders: (reminders: ReminderEntry[]) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { initialized: authInitialized, session } = useAuth();
  const [s, setS] = useState<PersistedState>(DEFAULTS);
  // Always-current mirror of `s` so actions that must return a synchronous result
  // (e.g. claimAdReward's grant/deny) can read the latest state without waiting for
  // a setS to flush.
  const sRef = useRef(s);
  sRef.current = s;
  // A language explicitly picked on the LOGIN screen, held until the next account
  // load consumes it. It lets that pick win even over an account that already has a
  // saved language (and become that account's preference). Cleared by any other
  // language change (Settings/first-launch prompt) so a stale pick can't leak.
  const pendingLoginLangRef = useRef<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sessionRun, setSessionRun] = useState<SessionRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  // Unread DM counts keyed by the sender's friend code. In-memory only — it's
  // derived from the server (fetched on focus, bumped by live inbox pings).
  const [dmUnread, setDmUnreadState] = useState<Record<string, number>>({});
  // Recipe id whose badge was just earned — drives the transient home progress
  // popup. In-memory only (auto-dismisses after a few seconds).
  const [recipeBadgePending, setRecipeBadgePending] = useState<string | null>(null);
  const [characterObtainedPending, setCharacterObtainedPending] = useState<string | null>(null);
  const [bondLevelUp, setBondLevelUp] = useState<{ companionId: string; level: number } | null>(null);
  // Last profile-card upload error (null once a sync succeeds). Drives the Friends-screen
  // "your code can't be found" diagnostic — a failed upload means no `profiles` row, so
  // friends searching this code get "user doesn't exist".
  const [lastProfileSyncError, setLastProfileSyncError] = useState<string | null>(null);
  // Friend codes this account has blocked (loaded from Supabase per account). Blocked
  // codes are filtered out of the friends list, incoming requests and DMs.
  const [blockedCodes, setBlockedCodes] = useState<string[]>([]);
  // Key the persistence scope on the *stable* identity (user id, or guest) — NOT
  // the session object. Supabase (autoRefreshToken) hands back a brand-new session
  // object on every token refresh; memoizing on the object would re-run the loader
  // each refresh, abort the active study session, and reload state from disk —
  // silently dropping progress. Keying on the id makes the scope stable for the
  // lifetime of a login.
  const scopeIdentity = session?.user.id ?? 'guest';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on the stable identity, not the session object
  const appStateScope = useMemo(() => getAppStateScope(session), [scopeIdentity]);

  useEffect(() => {
    if (!authInitialized) return;

    let mounted = true;
    setLoaded(false);
    setLoadedScopeKey(null);
    setActiveSession(null);

    (async () => {
      // 1) Local copy (may throw on corruption — handled below).
      let saved: Partial<PersistedState> | null = null;
      let localFailed = false;
      try {
        saved = await loadScopedAppState<Partial<PersistedState>>(appStateScope);
      } catch {
        localFailed = true;
      }

      // 2) For signed-in users, reconcile with the cloud copy (newer wins).
      if (appStateScope.kind === 'user') {
        const probe = await probeCloudState(appStateScope.userId);
        const cloud = probe.ok ? probe.cloud : null;

        // Guest → account upgrade: migrate the guest's progress into a freshly
        // created account so connecting Google never wipes their stuff. We only
        // seed from the guest copy when the cloud is CONFIRMED empty (a brand-new
        // account) — never on a failed fetch, which would risk clobbering a real
        // account's data with the guest's.
        if (await isGuestUpgradePending()) {
          if (!probe.ok || (!cloud && !saved && localFailed)) {
            // Cloud unreachable, or local read failed on an apparently-empty
            // account → too ambiguous to migrate safely. Pause saving and KEEP
            // the flag so a later (online, clean) load can still migrate.
            return;
          } else if (!cloud && !saved) {
            // Confirmed brand-new account → adopt the guest's saved progress.
            try {
              const guestState = await loadGuestState<Partial<PersistedState>>();
              if (guestState) {
                saved = guestState;
                localFailed = false;
              }
            } catch {
              // Couldn't read guest data — leave the flag set to retry next load.
              return;
            }
            await clearGuestUpgradePending();
          } else {
            // Account already has local/cloud data → not a fresh upgrade target.
            await clearGuestUpgradePending();
          }
        }

        const localAt = (saved as { updatedAt?: number } | null)?.updatedAt ?? 0;
        if (cloud && (cloud.updatedAt >= localAt || localFailed)) {
          saved = cloud.data as Partial<PersistedState>;
          localFailed = false; // recovered from the cloud
        } else if (saved) {
          // Local is newer (or the cloud has nothing yet) → seed the cloud now.
          pushCloudStateDebounced(appStateScope.userId, saved as Record<string, unknown>, 0);
        }

        // Empty local AND cloud unreachable (probe failed, not confirmed-empty): we
        // can't tell a brand-new account from an existing one whose cloud is just down.
        // Falling through would normalize(null) → a FRESH account with a NEW friend
        // code, then the next push would clobber the real cloud blob (last-write-wins),
        // wiping progress and breaking the user's friend code (friends searching the old
        // code get "user doesn't exist"). Pause saving; a later online load restores it.
        if (!saved && !probe.ok) {
          console.warn('[persist] cloud unreachable on empty local load; saving paused to protect existing account');
          return; // .finally still flips `loaded` true; loadedScopeKey stays unset → no save
        }
      }

      if (!mounted) return;

      // Couldn't read local AND no usable cloud copy → leave saving disabled
      // (loadedScopeKey unset) so we never overwrite recoverable data.
      if (localFailed && !saved) {
        console.warn('[persist] could not load saved state; saving paused to protect existing data');
        return;
      }

      const normalized = normalizePersistedState(saved);
      // A language picked on the LOGIN screen wins for whichever account is being
      // entered — even one that already has a saved language — and becomes that
      // account's preference. Without this, signing in would snap the whole app back
      // to the account's stored (or the device's) language and lose the pick.
      if (pendingLoginLangRef.current) {
        normalized.language = pendingLoginLangRef.current;
        normalized.languageSelected = true;
        pendingLoginLangRef.current = null;
      } else if (sRef.current.languageSelected && !normalized.languageSelected) {
        // No fresh login pick, but the current session chose a language (e.g. the
        // first-launch prompt) and this is a brand-new account with none of its own
        // — carry it in rather than resetting to the device default. Established
        // accounts and first-launch device detection are untouched.
        normalized.language = sRef.current.language;
        normalized.languageSelected = true;
      }
      setS(normalized);
      // Anchor all day math to this account's stored timezone before any streak action.
      setActiveTimezone(normalized.timezone);
      if (normalized.language) i18n.changeLanguage(normalized.language);
      // Marking the scope loaded is what lets the save effect run.
      setLoadedScopeKey(appStateScope.storageKey);
    })()
      .catch(() => {
        if (mounted) console.warn('[persist] load error; saving paused');
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [appStateScope, authInitialized]);

  useEffect(() => {
    if (!loaded || loadedScopeKey !== appStateScope.storageKey) return;
    // Stamp the save time so local & cloud copies can be compared on next login.
    const stamped = { ...s, updatedAt: Date.now() };
    saveScopedAppState(appStateScope, stamped);
    // Signed-in users also mirror to the cloud (debounced) so progress follows
    // the account to any device.
    if (appStateScope.kind === 'user') {
      pushCloudStateDebounced(appStateScope.userId, stamped as Record<string, unknown>);
    }
  }, [appStateScope, loaded, loadedScopeKey, s]);

  // Push any pending debounced cloud save the instant the app leaves the
  // foreground. The save above mirrors to the cloud on a 1.5s debounce, but a
  // "last action before closing" — most often saving a custom-timer preset —
  // writes to local storage immediately while its cloud push is still pending,
  // and iOS can suspend/kill the process before the timer fires. Local keeps
  // the change (and wins on the same device), but a login on another device or
  // after a reinstall would restore the stale cloud copy and drop it. Flushing
  // on background closes that gap so presets follow the account everywhere.
  //
  // The cleanup flushes for the SAME reason on the other exit route: signing out
  // (or switching accounts) changes the scope without ever backgrounding the app,
  // and auth-context's signOut doesn't flush. Anything written in the last 1.5s —
  // a monthly room ticket being the expensive case — would otherwise stay only on
  // this device, and the next login would restore the older cloud copy over it.
  useEffect(() => {
    if (appStateScope.kind !== 'user') return;
    const userId = appStateScope.userId;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushCloudState(userId);
    });
    return () => {
      sub.remove();
      void flushCloudState(userId);
    };
  }, [appStateScope]);

  // Streak-protection nudges: if the player doesn't OPEN the app on a given day, send
  // up to 2 spaced-out reminders that day to come back before their streak resets at
  // midnight. Resynced on launch AND every foreground — each open reschedules for the
  // next few days only (never today, since opening = they've shown up), so a nudge
  // only ever fires on a day with no app open. Gated on having a streak to protect +
  // finished onboarding; read through a ref so foregrounds use the latest state/lang
  // without re-subscribing. Permission is never *requested* here (see notifications.ts).
  //
  // Foregrounding alone isn't enough to cover a day that rolls over WHILE the app is
  // open: a late-night session (which holds a wake-lock) crosses midnight with no
  // 'active' transition, so yesterday's "tomorrow 1pm" nudge would fire at the user
  // while they're sitting in the app. So we also re-arm a timer for the next local
  // midnight and resync there. The timer only has to cover the app-stayed-awake case —
  // if iOS suspended the process across midnight the timer won't fire, but then the
  // user must foreground the app to see anything, and that foreground resyncs anyway.
  const streakNudgeEnabledRef = useRef(false);
  streakNudgeEnabledRef.current =
    loaded &&
    (s.notifStreak ?? true) &&
    (s.legalAccepted ?? false) &&
    (s.starterChosen ?? false) &&
    s.streak.currentStreak > 0;
  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    const sync = () => {
      void syncStreakReminders({
        enabled: streakNudgeEnabledRef.current,
        title: i18n.t('notifications.streakTitle'),
        afternoonBody: i18n.t('notifications.streakAfternoonBody'),
        eveningBody: i18n.t('notifications.streakEveningBody'),
      });
      armMidnightResync();
    };

    // Measured from a fresh `now` each time, so an 11pm open resyncs in an hour.
    const armMidnightResync = () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 5, 0); // 5s past midnight, so the new day has begun
      midnightTimer = setTimeout(sync, Math.max(1000, nextMidnight.getTime() - Date.now()));
    };

    if (loaded) sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      sub.remove();
      if (midnightTimer) clearTimeout(midnightTimer);
    };
    // s.notifStreak is a dep, not just a ref read: the Settings switch has to cancel
    // the pending nudges the moment it's flipped, and the ref alone never re-runs this.
  }, [loaded, s.notifStreak]);

  // Exam reminders: a day-before + (when the exam has a start time) 6-hours-before
  // local notification for every countdown whose reminder toggle is on. Resynced on
  // launch, foreground, and any exam change — add/edit/delete all reschedule the
  // exact pending set. Like the streak nudges, this never *requests* permission;
  // add-exam prompts when the toggle is switched on.
  useEffect(() => {
    const sync = () =>
      void syncExamReminders({
        enabled: s.notifExams ?? true,
        exams: s.examCountdowns,
        makeContent: (exam, kind) => ({
          title: i18n.t(kind === 'dayBefore' ? 'notifications.examTomorrowTitle' : 'notifications.examSoonTitle'),
          body: i18n.t(kind === 'dayBefore' ? 'notifications.examTomorrowBody' : 'notifications.examSoonBody', {
            name: exam.name,
          }),
        }),
      });
    if (loaded) sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [loaded, s.examCountdowns, s.notifExams]);

  // Task reminders: 09:00 the day before each unfinished task, plus 1-hour and
  // 10-minute warnings when it has a due time ("auto"), or the single hand-picked
  // moment when the player chose one ("custom"). Same cancel-everything-and-reschedule
  // model as the exam reminders, so completing / editing / deleting a task (and a
  // repeat rolling forward) all correct the pending set on the spot.
  //
  // Keyed on a compact signature instead of `s.tasks`, because tasks change far more
  // often than exams do — a postpone, a checkmark on an undated task or a title mask
  // shouldn't reschedule everything. The syncs are chained rather than fired in
  // parallel: each one cancels every pending task notification first, so two
  // overlapping runs would let the later cancel wipe the earlier one's fresh set.
  const taskReminderInputs = useMemo<TaskReminderInput[]>(
    () =>
      s.tasks
        .filter((t) => t.status !== 'done')
        .map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          dueTime: t.dueTime,
          notifyAt: t.notifyAt,
          reminderMode: taskReminderMode(t),
        }))
        .filter((t) => t.reminderMode !== 'off'),
    [s.tasks],
  );
  const taskReminderSig = taskReminderInputs
    .map((t) => `${t.id}|${t.title}|${t.dueDate}|${t.dueTime}|${t.notifyAt}|${t.reminderMode}`)
    .join('~');
  const taskSyncChain = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const enabled = s.notifTasks ?? true;
    const sync = () => {
      taskSyncChain.current = taskSyncChain.current
        .then(() =>
          syncTaskReminders({
            enabled,
            tasks: taskReminderInputs,
            makeContent: (task, tier) => ({
              title: i18n.t(TASK_REMINDER_COPY[tier].title),
              body: i18n.t(TASK_REMINDER_COPY[tier].body, { title: task.title }),
            }),
          }),
        )
        .catch(() => {});
    };
    if (loaded) sync();
    // Foreground resync catches the day rolling over while the app was suspended,
    // and re-arms anything iOS dropped.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
    // taskReminderInputs is captured, not a dep: the effect re-runs on every
    // signature change, and a task edit that leaves the signature identical (a
    // postpone count, a completed undated task) can't change what gets scheduled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, taskReminderSig, s.notifTasks]);

  // Past-due countdowns are KEPT for everyone (they used to auto-erase for free
  // users, which was the old Plus/free split). Nothing deletes an exam but the
  // player — the list shows it as "Past" until they remove it.

  // Publish my public profile (name + current character + stats) to the cloud so
  // friends always see the character I'm actually using — even if I never open the
  // Profile-card screen. The shared character is my profile-card pick when I've set
  // one, otherwise my currently-equipped companion ('' companionId = the starter Bun).
  useEffect(() => {
    if (!loaded || !session?.user.id || !s.friendCode) return;
    const isShop = s.activeCompanionId.startsWith('shop:');
    const equippedCompanionId = isShop ? s.activeCompanionId : '';
    const equippedSkinId = isShop ? (s.companionSkins[s.activeCompanionId] ?? 'classic') : s.bunSkinId;
    const companionId = s.profileCompanionId || equippedCompanionId;
    const skinId = s.profileCompanionId ? s.profileSkinId : equippedSkinId;
    const userId = session.user.id;
    // Top "chef" level = highest companion bond level across all companions (min 1).
    const topChefLevel = Object.values(s.companionMinutes ?? {}).reduce(
      (max, mins) => Math.max(max, companionLevelInfo(mins).level),
      1,
    );
    const payload = {
      friendCode: s.friendCode,
      displayName: s.profileDisplayName,
      description: s.profileDescription,
      birthday: s.profileBirthday,
      companionId,
      skinId,
      backgroundId: s.profileBackgroundId,
      avatarFrame: s.profileAvatarFrame,
      cardColor: s.profileCardColor,
      currentStreak: s.streak.currentStreak,
      longestStreak: s.streak.longestStreak,
      totalMinutes: s.totalMinutes,
      topChefLevel,
    };

    // A failed/skipped upload used to be a silent console.warn — so a user whose
    // profile never landed was simply un-findable with no signal. Now we retry a few
    // times (transient network/RLS blips self-heal) and record the last error so the
    // Friends screen can warn "your code can't be found yet".
    let cancelled = false;
    const syncWithRetry = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt)); // backoff
        if (cancelled) return;
        const res = await uploadProfile(userId, payload);
        if (cancelled) return;
        if (res.ok) {
          setLastProfileSyncError(null);
          return;
        }
        // 23505 = unique_violation. profiles.friend_code is the only other unique
        // constraint, so a colliding code generated by another account would brick
        // discoverability forever. Regenerate my code (re-triggers this effect) and stop.
        if (res.code === '23505') {
          setS((prev) => ({ ...prev, friendCode: generateFriendCode() }));
          return;
        }
        if (attempt === 2) setLastProfileSyncError(res.error); // give up → surface it
      }
    };
    const timer = setTimeout(() => { void syncWithRetry(); }, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [
    loaded, session?.user.id, s.friendCode,
    s.profileDisplayName, s.profileDescription, s.profileBirthday, s.profileBackgroundId,
    s.profileAvatarFrame, s.profileCardColor,
    s.profileCompanionId, s.profileSkinId, s.activeCompanionId, s.bunSkinId, s.companionSkins,
    s.streak.currentStreak, s.streak.longestStreak, s.totalMinutes, s.companionMinutes,
  ]);

  // Mirror the streak's last-study date to the server so a Study Buddy's daily
  // check-in can read "studied today". lastStudyDate is already account-timezone
  // ISO (set by updateStreak via todayISO), so this is the canonical signal.
  useEffect(() => {
    if (!loaded || !session?.user.id || !s.streak.lastStudyDate) return;
    const userId = session.user.id;
    const date = s.streak.lastStudyDate;
    const tz = s.timezone;
    const timer = setTimeout(() => {
      uploadStudyDay(userId, date, tz);
    }, 800);
    return () => clearTimeout(timer);
  }, [loaded, session?.user.id, s.streak.lastStudyDate, s.timezone]);

  // ─── Wave 1 actions ──────────────────────────────────────────────────────

  // Play the coin chime whenever the balance changes from a user action (earning
  // or spending). Every coin mutation flows through `s.coins`, so watching it here
  // covers all of them from one place. Skip the first observation after load and any
  // pre-load change so hydration / cloud-reconcile (which settle before `loaded`)
  // stay silent — runtime deltas are local actions. Respects the SFX setting via playCoin.
  const prevCoinsRef = useRef<number | null>(null);
  useEffect(() => {
    // Reset the baseline whenever state is (re)loading — e.g. an account switch or
    // onboarding wipe cycles `loaded` false→true and swaps in a different balance,
    // which must not be heard as an earn/spend.
    if (!loaded) { prevCoinsRef.current = null; return; }
    const prev = prevCoinsRef.current;
    prevCoinsRef.current = s.coins;
    if (prev != null && s.coins !== prev) playCoin();
  }, [s.coins, loaded]);

  const addCoins = (amount: number) => {
    setS((prev) => {
      const today = todayISO();
      const isNewDay = prev.earnedDate !== today;
      const basedToday = isNewDay ? 0 : prev.earnedToday;
      // Plus members have a higher daily study-earn ceiling (see dailyEarnCap).
      const remaining = Math.max(0, dailyEarnCap(prev.isPlus) - basedToday);
      const actualAdd = Math.min(amount, remaining);
      return {
        ...prev,
        coins: capCoins(prev.coins + actualAdd),
        earnedToday: basedToday + actualAdd,
        earnedDate: today,
      };
    });
  };

  // Grant the coins for one watched rewarded ad. Caller must only invoke this after
  // a real ad reward fired (or the __DEV__ mock). Guarded server-of-truth on the
  // DAILY_AD_LIMIT/day cap (reset at the account-timezone midnight); payout bypasses
  // DAILY_EARN_CAP because the per-day ad count is itself the cap. Returns false if
  // the limit is already reached so the UI can show "come back tomorrow".
  const claimAdReward = (): boolean => {
    const today = todayISO();
    const prev = sRef.current;
    const based = prev.adRewardDate === today ? prev.adRewardCount : 0;
    if (based >= DAILY_AD_LIMIT) return false;
    setS((cur) => {
      const t0 = todayISO();
      const b = cur.adRewardDate === t0 ? cur.adRewardCount : 0;
      if (b >= DAILY_AD_LIMIT) return cur;
      return {
        ...cur,
        coins: capCoins(cur.coins + AD_REWARD_COINS),
        adRewardCount: b + 1,
        adRewardDate: t0,
      };
    });
    return true;
  };

  // Claim today's daily login reward. No-op if already claimed today. Coins are
  // added directly (not through the daily earn cap, like the study-streak bonus).
  const claimLoginReward = () => {
    const today = todayISO();
    setS((prev) => {
      if (prev.loginRewardDate === today) return prev;
      // Showing up counts as a streak day too: advance the streak once/day, sharing
      // the `lastStudyDate` gate with study sessions so the two can't both bump it.
      const r = nextStreakState(prev.streak, today);
      const countedToday = prev.streak.lastStudyDate === today;
      // But if the on-open rescue prompt is still pending, DON'T let the login reward
      // reset the streak — leave it untouched so the prompt can save it. Pay out the
      // preserved streak day; the streak isn't advanced today. Once the prompt is
      // resolved (dismissed/rescued), this goes false and a declined streak resets here.
      const rescuePending = streakRescuePending(prev, today);
      const streak = countedToday || rescuePending
        ? prev.streak
        : {
            currentStreak: r.next,
            longestStreak: Math.max(prev.streak.longestStreak, r.next),
            lastStudyDate: today,
          };
      const day = rescuePending ? prev.streak.currentStreak : r.next;
      // Plus members earn double the daily reward (matches the streak bonus + the
      // "Get 2x with Plus" upsell on the daily-reward popup).
      const payout = prev.isPlus ? dailyRewardCoins(day) * 2 : dailyRewardCoins(day);
      return {
        ...prev,
        streak,
        coins: capCoins(prev.coins + payout),
        loginRewardDate: today,
      };
    });
  };

  // Claim the birthday gift: +1000 coins (added directly, outside the daily earn
  // cap, like the login reward). The once-a-year gate (birthdayRewardYear) is only
  // burned when it's genuinely the player's birthday, so the home-screen test button
  // can preview the popup on any day without consuming the real birthday reward.
  const claimBirthdayReward = () => {
    const today = todayISO();
    setS((prev) => {
      const realBirthday = isBirthdayToday(prev.profileBirthday, today);
      const year = Number(today.slice(0, 4));
      // On the real birthday, don't pay twice in one year.
      if (realBirthday && prev.birthdayRewardYear === year) return prev;
      return {
        ...prev,
        coins: capCoins(prev.coins + BIRTHDAY_REWARD_COINS),
        birthdayRewardYear: realBirthday ? year : prev.birthdayRewardYear,
      };
    });
  };

  const recordSession = (minutes: number) => {
    // Detect a bond level-up for the active companion so Home can celebrate it. The
    // context value is rebuilt every render (not memoized), so this `s` closure is
    // current; the actual credit below uses `prev` unchanged. Same cap math as below.
    {
      const id = s.activeCompanionId;
      const bondToday = s.companionBondDate === todayISO() ? s.companionBondToday : 0;
      const credited = Math.max(0, Math.min(minutes, Math.floor(DAILY_EARN_CAP / COINS_PER_MINUTE) - bondToday));
      if (credited > 0) {
        const prevMins = s.companionMinutes?.[id] ?? 0;
        const oldLevel = companionLevelInfo(prevMins).level;
        const newLevel = companionLevelInfo(prevMins + credited).level;
        if (newLevel > oldLevel) setBondLevelUp({ companionId: id, level: newLevel });
      }
    }
    setS((prev) => {
      const today = todayISO();
      const bondToday = prev.companionBondDate === today ? prev.companionBondToday : 0;
      // Daily bond ceiling: 250 minutes (the FREE coin cap ÷ coins-per-minute), so
      // levels can't be ground out in a single day. Deliberately NOT raised for Plus
      // along with dailyEarnCap — faster companion levelling isn't a Plus perk, and
      // pacing bond the same for everyone keeps the gallery honest.
      const dailyBondCap = Math.floor(DAILY_EARN_CAP / COINS_PER_MINUTE);
      const credited = Math.max(0, Math.min(minutes, dailyBondCap - bondToday));
      const id = prev.activeCompanionId;
      return {
        ...prev,
        sessionsCompleted: prev.sessionsCompleted + 1,
        totalMinutes: prev.totalMinutes + minutes,
        // Credit (capped) time toward the companion studied with (bond level). This is
        // the single minutes funnel for solo (full + early) and multiplayer finish, so
        // each session counts exactly once.
        companionMinutes: {
          ...prev.companionMinutes,
          [id]: (prev.companionMinutes?.[id] ?? 0) + credited,
        },
        companionBondToday: bondToday + credited,
        companionBondDate: today,
      };
    });
  };

  // Petting the companion on the home screen: a tiny daily-capped bond nudge toward the
  // active companion's level (flavour, not a grind). Each tap ≈ a 10-minute study
  // session's bond, and only 3 taps/day count (3 × PET_BOND = PET_DAILY_CAP).
  const petCompanion = () =>
    setS((prev) => {
      const today = todayISO();
      const petToday = prev.petBondDate === today ? prev.petBondToday : 0;
      const PET_BOND = 10;      // one tap ≈ a 10-minute study session's bond
      const PET_DAILY_CAP = 30; // 3 taps/day
      const credited = Math.max(0, Math.min(PET_BOND, PET_DAILY_CAP - petToday));
      if (credited === 0) return prev; // already at today's pet cap
      const id = prev.activeCompanionId;
      return {
        ...prev,
        companionMinutes: {
          ...prev.companionMinutes,
          [id]: (prev.companionMinutes?.[id] ?? 0) + credited,
        },
        petBondToday: petToday + credited,
        petBondDate: today,
      };
    });

  // Count one finished multiplayer study block toward the Social achievements
  // (lifetimeFriendSessions). Called only from the real MP-finish funnel.
  const recordFriendSession = () =>
    setS((prev) => ({ ...prev, lifetimeFriendSessions: prev.lifetimeFriendSessions + 1 }));

  // Claim a one-time achievement's bonus coins. Guards: its lifetime goal is met and
  // it hasn't been claimed before. Coins bypass DAILY_EARN_CAP.
  const claimAchievement = (id: string) =>
    setS((prev) => {
      if (prev.claimedAchievements.includes(id)) return prev;
      const def = getAchievement(id);
      if (!def) return prev;
      const value =
        def.statKey === 'longestStreak' ? prev.streak.longestStreak : (prev as any)[def.statKey];
      if (value < def.goal) return prev;
      return {
        ...prev,
        coins: capCoins(prev.coins + def.reward),
        claimedAchievements: [...prev.claimedAchievements, id],
      };
    });

  const addExam = (exam: Omit<ExamCountdown, 'id'>): string | null => {
    const newId = uid();
    let added = false;
    setS((prev) => {
      if (prev.examCountdowns.length >= MAX_EXAMS) return prev;
      added = true;
      // Mask profanity in the user-entered name/subject (parity with subjects + DMs).
      const safeExam = { ...exam, name: maskProfanity(exam.name), subject: maskProfanity(exam.subject) };
      return {
        ...prev,
        examCountdowns: [...prev.examCountdowns, { ...safeExam, id: newId }],
      };
    });
    return added ? newId : null;
  };

  const removeExam = (id: string) =>
    setS((prev) => ({
      ...prev,
      examCountdowns: prev.examCountdowns.filter((e) => e.id !== id),
    }));

  // Edit an existing countdown in place (no cap check — count is unchanged).
  const updateExam = (id: string, patch: Partial<Omit<ExamCountdown, 'id'>>) => {
    const safePatch = {
      ...patch,
      ...(patch.name !== undefined ? { name: maskProfanity(patch.name) } : {}),
      ...(patch.subject !== undefined ? { subject: maskProfanity(patch.subject) } : {}),
    };
    setS((prev) => ({
      ...prev,
      examCountdowns: prev.examCountdowns.map((e) => (e.id === id ? { ...e, ...safePatch } : e)),
    }));
  };

  const setReminder = (enabled: boolean, time: string) =>
    setS((prev) => ({ ...prev, reminderEnabled: enabled, reminderTime: time }));

  const setNotifTasks = (value: boolean) => setS((prev) => ({ ...prev, notifTasks: value }));
  const setNotifStreak = (value: boolean) => setS((prev) => ({ ...prev, notifStreak: value }));
  const setNotifExams = (value: boolean) => setS((prev) => ({ ...prev, notifExams: value }));

  const setUse24HourTime = (value: boolean) =>
    setS((prev) => ({ ...prev, use24HourTime: value }));

  const setSoundEffectsEnabled = (value: boolean) =>
    setS((prev) => ({ ...prev, soundEffectsEnabled: value }));
  const setVinylColor = (value: string) =>
    setS((prev) => ({ ...prev, vinylColor: value }));
  const setSpotifyBgEnabled = (value: boolean) =>
    setS((prev) => ({ ...prev, spotifyBgEnabled: value }));
  const setSpotifyBgColor = (value: 'black' | 'white') =>
    setS((prev) => ({ ...prev, spotifyBgColor: value }));

  const updateProfile = (patch: Partial<{
    displayName: string;
    description: string;
    birthday: string;
    birthdayChangeUsed: boolean;
    backgroundId: string;
    cardColor: string;
    companionId: string;
    skinId: string;
    avatarFrame: string;
  }>) =>
    setS((prev) => ({
      ...prev,
      ...(patch.displayName !== undefined ? { profileDisplayName: maskProfanity(patch.displayName) } : {}),
      ...(patch.description !== undefined ? { profileDescription: maskProfanity(patch.description) } : {}),
      ...(patch.birthday !== undefined ? { profileBirthday: patch.birthday } : {}),
      ...(patch.birthdayChangeUsed
        ? { profileBirthdayChangeCount: Math.min((prev.profileBirthdayChangeCount ?? 0) + 1, BIRTHDAY_CHANGE_LIMIT) }
        : {}),
      ...(patch.backgroundId !== undefined ? { profileBackgroundId: patch.backgroundId } : {}),
      ...(patch.cardColor !== undefined ? { profileCardColor: patch.cardColor } : {}),
      ...(patch.companionId !== undefined ? { profileCompanionId: patch.companionId } : {}),
      ...(patch.skinId !== undefined ? { profileSkinId: patch.skinId } : {}),
      ...(patch.avatarFrame !== undefined ? { profileAvatarFrame: patch.avatarFrame } : {}),
    }));

  // Streak counts STUDY days only (called from session-complete). Each study day
  // rewards coins equal to the new streak number (1, 2, 3, … up to 200). Missing a
  // day resets the streak — today becomes day 1 again.
  // Pass `rescueWithFreeze` when the user opted to spend a freeze to keep a streak
  // that lapsed inside the rescue window (the session-complete "keep your streak?" prompt).
  const updateStreak = (
    opts?: { rescueWithFreeze?: boolean },
  ): { bonus: number; isComeback: boolean; rescued: boolean } => {
    const today = todayISO();
    // Freezes are usable by anyone who owns one (not Plus-gated) — Plus only affects
    // the free monthly allotment, not the ability to spend a freeze you have/bought.
    const canRescue = !!opts?.rescueWithFreeze && s.streakFreezes > 0;
    // Compute synchronously from current state for the return value (the setS
    // updater below runs later, so reading its result there would be too late).
    const result = nextStreakState(s.streak, today, canRescue);

    if (result.changed) {
      setS((prev) => {
        // Recompute against `prev` to stay correct under React batching.
        const prevCanRescue = !!opts?.rescueWithFreeze && prev.streakFreezes > 0;
        const r = nextStreakState(prev.streak, today, prevCanRescue);
        if (!r.changed) return prev;
        return {
          ...prev,
          streak: {
            currentStreak: r.next,
            longestStreak: Math.max(prev.streak.longestStreak, r.next),
            lastStudyDate: today,
          },
          // Award `next` coins once per day (intentionally not daily-capped).
          // Plus members earn double the streak bonus.
          coins: capCoins(prev.coins + (prev.isPlus ? r.next * 2 : r.next)),
          // A rescued streak consumes one freeze.
          streakFreezes: r.useFreeze ? prev.streakFreezes - 1 : prev.streakFreezes,
        };
      });
    }

    return {
      bonus: result.changed ? (s.isPlus ? result.next * 2 : result.next) : 0,
      isComeback: result.isComeback,
      rescued: result.useFreeze,
    };
  };

  // ─── Wave 2 subject actions ───────────────────────────────────────────────

  const addSubject = (rawName: string, color: string, emoji = ''): boolean => {
    const name = maskProfanity(rawName);
    if (s.subjects.filter((sub) => !sub.archived).length >= MAX_SUBJECTS) return false;
    setS((prev) => {
      const activeCount = prev.subjects.filter((sub) => !sub.archived).length;
      if (activeCount >= MAX_SUBJECTS) return prev;
      return {
        ...prev,
        subjects: [
          ...prev.subjects,
          { id: uid(), name, color, emoji, archived: false, order: prev.subjects.length },
        ],
      };
    });
    return true;
  };

  const renameSubject = (id: string, name: string) =>
    setS((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === id ? { ...s, name: maskProfanity(name) } : s)),
    }));

  const recolorSubject = (id: string, color: string) =>
    setS((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === id ? { ...s, color } : s)),
    }));

  const archiveSubject = (id: string) =>
    setS((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === id ? { ...s, archived: true } : s)),
    }));

  const deleteSubject = (id: string) =>
    setS((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
      tasks: prev.tasks.map((t) => (t.subjectId === id ? { ...t, subjectId: null } : t)),
    }));

  const reorderSubjects = (orderedIds: string[]) =>
    setS((prev) => ({
      ...prev,
      subjects: orderedIds
        .map((id, i) => {
          const found = prev.subjects.find((s) => s.id === id);
          return found ? { ...found, order: i } : null;
        })
        .filter(Boolean) as Subject[],
    }));

  // ─── Wave 2 task actions ──────────────────────────────────────────────────

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'postponeCount' | 'lastActivityAt' | 'notifId'>) => {
    // At the cap, don't add — return '' so the caller can show a limit message.
    if (s.tasks.length >= MAX_TASKS) return '';
    const id = uid();
    setS((prev) => {
      if (prev.tasks.length >= MAX_TASKS) return prev;
      return {
        ...prev,
        tasks: [
          {
            ...task,
            // Mask profanity in the title + description (parity with subjects + DMs).
            title: maskProfanity(task.title),
            description: task.description ? maskProfanity(task.description) : undefined,
            id,
            createdAt: new Date().toISOString(),
            completedAt: null,
            postponeCount: 0,
            lastActivityAt: null,
            notifId: null,
          },
          ...prev.tasks,
        ],
      };
    });
    return id;
  };

  const updateTask = (id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'subjectId' | 'dueDate' | 'isDeadline' | 'dueTime' | 'estimatedMinutes' | 'priority' | 'status' | 'notifyAt' | 'reminderMode' | 'repeatDays' | 'repeatUntil'>>) => {
    const safePatch = {
      ...patch,
      ...(patch.title !== undefined ? { title: maskProfanity(patch.title) } : {}),
      ...(patch.description !== undefined ? { description: patch.description ? maskProfanity(patch.description) : undefined } : {}),
    };
    setS((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, ...safePatch, lastActivityAt: new Date().toISOString() } : t,
      ),
    }));
  };

  const deleteTask = (id: string) =>
    setS((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));

  const completeTask = (id: string) => {
    const now = new Date().toISOString();

    setS((prev) => {
      const task = prev.tasks.find((t) => t.id === id);
      if (!task || task.status === 'done') return prev;

      // Both a one-off completion AND a repeating task's roll-forward count as a
      // completion toward the task achievements (repeating tasks never reach 'done',
      // so deriving the count from the task list would miss them).
      const taskBump = { lifetimeTasksCompleted: prev.lifetimeTasksCompleted + 1 };

      // Repeating task: instead of marking done, roll its due date forward to the
      // next selected weekday and reset it to not-started so it recurs.
      const rollover = computeTaskRollover(task);
      if (rollover) {
        return {
          ...prev,
          ...taskBump,
          tasks: prev.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'not_started' as TaskStatus,
                  dueDate: rollover.dueDate,
                  notifyAt: rollover.notifyAt,
                  notifId: null,
                  completedAt: null,
                  lastActivityAt: now,
                  postponeCount: 0,
                }
              : t,
          ),
        };
      }

      return {
        ...prev,
        ...taskBump,
        tasks: prev.tasks.map((t) =>
          t.id === id
            ? { ...t, status: 'done' as TaskStatus, completedAt: now, lastActivityAt: now }
            : t,
        ),
      };
    });
  };

  const postponeTask = (id: string) =>
    setS((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, postponeCount: t.postponeCount + 1, lastActivityAt: new Date().toISOString() } : t,
      ),
    }));

  // ─── Wave 2 subject-time ──────────────────────────────────────────────────

  const addSubjectTime = (subjectName: string | null, minutes: number) => {
    const key = subjectName ?? 'General Study';
    const dateISO = todayISO();
    const record: SessionRecord = { dateISO, minutes, subjectName };
    const monthKey = monthKeyOf(dateISO);
    setS((prev) => ({
      ...prev,
      subjectTimeMap: {
        ...prev.subjectTimeMap,
        [key]: (prev.subjectTimeMap[key] ?? 0) + minutes,
      },
      // Same minutes, bucketed by calendar month. subjectTimeMap can't answer
      // "this year" (no dates) and sessionHistory won't reach back far enough
      // once the cap bites, so the Progress tab's Year range reads this.
      subjectMonthly: {
        ...prev.subjectMonthly,
        [monthKey]: {
          ...(prev.subjectMonthly[monthKey] ?? {}),
          [key]: (prev.subjectMonthly[monthKey]?.[key] ?? 0) + minutes,
        },
      },
      // 5000, not 1000: at three sessions a day 1000 records is only about
      // eleven months, so the Month range would start under-reporting before
      // the Year range did. The monthly rollup covers everything older.
      sessionHistory: [record, ...prev.sessionHistory].slice(0, 5000),
    }));
  };

  const startActiveSession = ({
    durationMinutes,
    subjectName,
    taskId,
    taskTitle,
    startedAt,
    isMultiplayer,
    breakMinutes,
    autoStarted,
    lockedIn,
    continuedRun,
  }: {
    durationMinutes: number;
    subjectName: string | null;
    taskId: string | null;
    taskTitle: string | null;
    startedAt?: string;
    isMultiplayer?: boolean;
    breakMinutes?: number;
    lockedIn?: boolean;
    autoStarted?: boolean;
    continuedRun?: boolean;
  }) => {
    const sessionId = uid();
    // A fresh (non-continued) session starts a new run — wipe the accumulator so the
    // next Rest receipt only sums this run's blocks. A continued block keeps it.
    if (!continuedRun) setSessionRun(null);
    setActiveSession({
      id: sessionId,
      durationMinutes,
      subjectName,
      taskId,
      taskTitle,
      startedAt: startedAt ?? new Date().toISOString(),
      isMultiplayer,
      breakMinutes,
      autoStarted,
      lockedIn,
      continuedRun,
    });
    return sessionId;
  };

  const clearActiveSession = () => {
    setActiveSession(null);
  };

  const clearSessionRun = () => setSessionRun(null);

  // Credit ONE finished solo study block the instant its timer hits zero, and add it
  // to the run accumulator. This is the crediting that used to live in the
  // session-complete receipt's mount effect — moved here so the checkpoint can show
  // "Continue / Rest" without a receipt while nothing is ever double-credited (the
  // streak/cap/bond calls below are all idempotent-or-cumulative per day) and no
  // study is lost if the app is killed at the checkpoint.
  const finishStudyBlock = ({
    minutes,
    coins: baseCoins,
    subjectName,
  }: {
    minutes: number;
    coins: number;
    subjectName: string | null;
  }) => {
    playFinishDing(); // oven-timer "ding": this block is done
    // Plus perk: double the study payout (the daily earn cap below still applies).
    const coins = s.isPlus ? baseCoins * PLUS_STUDY_COIN_MULTIPLIER : baseCoins;
    // Coins actually credited after the daily cap (snapshot BEFORE addCoins) — the
    // receipt shows the run's real total, matching the old receipt's cap note.
    const actualEarned = Math.min(coins, Math.max(0, dailyEarnCap(s.isPlus) - s.earnedToday));
    addCoins(coins);
    recordSession(minutes);
    addSubjectTime(subjectName, minutes);
    if (s.selectedFoodId) markFoodMade(s.selectedFoodId);
    track('study_session_completed', { minutes, subject: subjectName, coins });

    // Accumulate minutes/coins synchronously; streak bonus is folded in once the
    // streak commits (which may wait on the rescue prompt below).
    setSessionRun((prev) => {
      const base = prev ?? { minutes: 0, coins: 0, subjectName, streakBonus: 0, isComeback: false };
      return {
        ...base,
        minutes: base.minutes + minutes,
        coins: base.coins + actualEarned,
        subjectName: base.subjectName ?? subjectName,
      };
    });

    const commit = (rescueWithFreeze: boolean) => {
      const { bonus, isComeback, rescued } = updateStreak(
        rescueWithFreeze ? { rescueWithFreeze: true } : undefined,
      );
      setSessionRun((prev) =>
        prev ? { ...prev, streakBonus: prev.streakBonus + bonus, isComeback: prev.isComeback || isComeback } : prev,
      );
      if (rescued) {
        showPopup(
          i18n.t('progress.streakProtected'),
          i18n.t('sessionComplete.freezeUsedMsg', { count: Math.max(0, s.streakFreezes - 1) }),
        );
      }
    };

    // Streak lapsed inside the rescue window and the user owns a freeze → ask whether to
    // spend one (same guard the receipt used). Otherwise commit straight through.
    const last = s.streak.lastStudyDate;
    const gap = last ? daysBetween(last, todayISO()) : 0;
    const canRescue = gap >= STREAK_RESCUE_MIN_GAP && gap <= STREAK_RESCUE_MAX_GAP && s.streakFreezes > 0 && streakRescuePending(s, todayISO());
    if (canRescue) {
      showPopup(
        i18n.t('sessionComplete.rescueStreakQ'),
        i18n.t('sessionComplete.rescueStreakMsg', { count: s.streak.currentStreak }),
        [
          { text: i18n.t('sessionComplete.letItReset'), style: 'cancel', onPress: () => commit(false) },
          { text: i18n.t('progress.useFreeze'), onPress: () => commit(true) },
        ],
      );
    } else {
      commit(false);
    }
  };

  // Push the session's start time forward by `seconds` — used to pause the timer
  // during a break (the displayed countdown is frozen meanwhile).
  const shiftSessionStart = (seconds: number) => {
    setActiveSession((prev) =>
      prev ? { ...prev, startedAt: new Date(new Date(prev.startedAt).getTime() + seconds * 1000).toISOString() } : prev,
    );
  };

  const setActiveSessionSubject = (subjectName: string | null) => {
    setActiveSession((prev) => (prev ? { ...prev, subjectName } : prev));
  };

  const markSessionMultiplayer = () => {
    setActiveSession((prev) => (prev && !prev.isMultiplayer ? { ...prev, isMultiplayer: true } : prev));
  };

  // ─── Wave 2 skip nudge ────────────────────────────────────────────────────

  const incrementSkipSubjectCount = () =>
    setS((prev) => ({ ...prev, skipSubjectCount: prev.skipSubjectCount + 1 }));

  const resetSkipSubjectCount = () =>
    setS((prev) => ({ ...prev, skipSubjectCount: 0 }));

  // ─── Wave 4 actions ───────────────────────────────────────────────────────

  const setIsPlus = (value: boolean, plan: 'monthly' | 'annual' = 'monthly', untilOverride?: string, announce = false) => {
    const month = new Date().toISOString().slice(0, 7);
    const today = todayISO();
    // Freezes-granted popup ONLY on a genuine paywall purchase (`announce`). setIsPlus
    // is re-affirmed on every cold launch / entitlement-sync and on a fresh device's
    // login (see _layout.tsx); those read a not-yet-synced streakFreezeResetMonth and
    // used to fire the popup spuriously (e.g. "3 freezes added" every time you logged
    // in from another device). The freezes themselves still refresh monthly & silently
    // via the load-merge grant, so no freeze is lost — only the popup is gated.
    // Decided OUTSIDE the state updater (updaters can run twice in dev, must be pure).
    if (value && announce && (!s.streakFreezeResetMonth || s.streakFreezeResetMonth < month)) {
      showPopup(i18n.t('plus.freezesGrantedTitle'), i18n.t('plus.freezesGrantedMsg'));
    }
    setS((prev) => {
      const updates: Partial<PersistedState> = { isPlus: value };
      // Plus members automatically wear the gold crown avatar frame; it clears when
      // Plus lapses. Not equippable — it just mirrors Plus status.
      updates.profileAvatarFrame = value ? 'gold' : 'none';
      if (value) {
        // Expiry: prefer the real RevenueCat entitlement expiry (untilOverride) so
        // local state matches what the user actually paid for; otherwise fall back to
        // monthly = +1 month, annual = +1 year.
        let until: string;
        if (untilOverride) {
          until = untilOverride;
        } else {
          const d = new Date();
          if (plan === 'annual') d.setFullYear(d.getFullYear() + 1);
          else d.setMonth(d.getMonth() + 1);
          until = d.toISOString();
        }
        updates.plusPlan = plan;
        updates.plusUntil = until;
      } else {
        updates.plusPlan = null;
        updates.plusUntil = '';
        // Plus ended → re-lock sounds: if the equipped study sound was only free via
        // Plus (not actually bought), un-equip it so it stops playing.
        const equippedSound = prev.equippedShopItems?.sound;
        if (equippedSound && !prev.ownedShopItems.includes(equippedSound)) {
          updates.equippedShopItems = { ...prev.equippedShopItems, sound: null };
        }
      }
      if (value && prev.aiTicketsResetMonth !== month) {
        updates.aiTickets = 3;
        updates.aiTicketsResetMonth = month;
      }
      // Grant this month's 3 streak freezes THE MOMENT Plus activates (the
      // load-merge grant only runs on the next app launch, which made a fresh
      // purchase feel like it gave nothing). Idempotent per month, and Math.max
      // never lowers freezes the user separately bought. A confirmation popup
      // shows only when this actually grants (so the launch-time entitlement
      // re-sync can't spam it).
      if (value && (!prev.streakFreezeResetMonth || prev.streakFreezeResetMonth < month)) {
        updates.streakFreezes = Math.max(prev.streakFreezes, 3);
        updates.streakFreezeResetMonth = month;
        // If their streak lapsed and today's rescue prompt was already dismissed
        // (e.g. they had no freeze to use, then went and bought Plus), un-dismiss
        // it so the Home rescue re-offers — the new freezes can save the streak
        // the same day.
        if (streakRescueAvailable({ streak: prev.streak }, today) && prev.streakRescueDismissedDate === today) {
          updates.streakRescueDismissedDate = '';
        }
      }
      // First room ticket the moment they FIRST go Plus, anchoring the monthly cadence
      // to today's day-of-month. Gate on "no anchor yet" (not "!== today"): setIsPlus(true)
      // is re-affirmed on every cold launch / entitlement-sync for already-Plus members
      // (see _layout.tsx), so a per-day guard minted a fresh ticket every single day. All
      // subsequent monthly tickets come solely from the load-merge anniversary check
      // (exchangeTicketsDue), which is day-of-month based and covers monthly renewals and
      // yearly plans alike. Tickets are kept on lapse, so nothing is cleared when value is false.
      // The anchor alone is NOT a safe gate: it can come back missing (a cloud blob
      // written before the grant landed — the push is debounced, so a kill inside
      // that window rolls it back — or an older schema), and every time it did, this
      // minted another "first" ticket. So a recorded grant blocks the payout too, and
      // a lost anchor is simply rebuilt from that record.
      const recordedGrantDay = Number((prev.exchangeTicketLastGrantISO ?? '').slice(8, 10));
      const hasGrantOnRecord = recordedGrantDay >= 1 && recordedGrantDay <= 31;
      if (value && !prev.exchangeTicketAnchorDay && hasGrantOnRecord) {
        updates.exchangeTicketAnchorDay = recordedGrantDay;
      } else if (value && !prev.exchangeTicketAnchorDay) {
        updates.exchangeTicketAnchorDay = Number(today.slice(8, 10));
        updates.exchangeTickets = prev.exchangeTickets + 1;
        updates.exchangeTicketLastGrantISO = today;
        updates.exchangeTicketPending = prev.exchangeTicketPending + 1;
      }
      // Plus exclusive: getting Plus grants the Berry Princess Bun skin, the
      // Strawberry Palace room + desk for free — these are KEPT forever even if Plus
      // later lapses. Study/ambience sounds are NOT granted here: they're free while
      // subscribed (gated as `isPlus || owned` at use-time) but re-lock when Plus
      // ends, so only sounds actually bought with coins stay.
      if (value) {
        const granted = prev.ownedShopItems;
        const toGrant = ['outfit_bun_strawberry', 'bg_strawberry_palace', 'desk_strawberry'].filter((id) => !granted.includes(id));
        if (toGrant.length) updates.ownedShopItems = [...granted, ...toGrant];
      }
      return { ...prev, ...updates };
    });
  };

  // A freeze rescues a streak for STREAK_RESCUE_DAYS days after the first missed day
  // (daysBetween STREAK_RESCUE_MIN_GAP…MAX_GAP). One freeze bridges the whole gap to
  // yesterday — flat cost, however long the gap — so studying today continues the streak.
  const canFreezeGap = (gap: number) =>
    gap >= STREAK_RESCUE_MIN_GAP && gap <= STREAK_RESCUE_MAX_GAP;

  const useStreakFreeze = (): boolean => {
    if (s.streakFreezes <= 0) return false;
    const { lastStudyDate } = s.streak;
    if (!lastStudyDate || !canFreezeGap(daysBetween(lastStudyDate, todayISO()))) return false;

    setS((prev) => {
      if (prev.streakFreezes <= 0) return prev;
      const { lastStudyDate: last } = prev.streak;
      if (!last || !canFreezeGap(daysBetween(last, todayISO()))) return prev;
      return {
        ...prev,
        streakFreezes: prev.streakFreezes - 1,
        // Bridge the whole gap to yesterday; no coins awarded.
        streak: { ...prev.streak, lastStudyDate: yesterdayISO() },
      };
    });
    return true;
  };

  // Rescue the streak after buying a freeze on the spot (the on-open rescue prompt's
  // "Buy a freeze" path). The purchase and the spend cancel out — net-zero inventory —
  // so we bridge the gap directly instead of add-then-consume (which would hit a stale
  // `streakFreezes` read across two setS calls). Window-checked like useStreakFreeze.
  const rescueStreakByPurchase = (): boolean => {
    const { lastStudyDate } = s.streak;
    if (!lastStudyDate || !canFreezeGap(daysBetween(lastStudyDate, todayISO()))) return false;
    setS((prev) => {
      const { lastStudyDate: last } = prev.streak;
      if (!last || !canFreezeGap(daysBetween(last, todayISO()))) return prev;
      return {
        ...prev,
        // Bridge exactly one missed day; freezes unchanged (bought one, spent it).
        streak: { ...prev.streak, lastStudyDate: yesterdayISO() },
        streakRescueDismissedDate: todayISO(),
      };
    });
    return true;
  };

  // Mark the on-open streak-rescue prompt handled for today so it doesn't reshow (used
  // when the player picks "Let it reset", or after a successful use/purchase rescue).
  const dismissStreakRescue = () =>
    setS((prev) => ({ ...prev, streakRescueDismissedDate: todayISO() }));

  // "Let it reset" — the player deliberately gave the streak up. Commit that NOW rather
  // than leaving it to the next login-reward claim, because the dismissed-date stamp only
  // suppresses the prompt for today: over the 30-day rescue window, declining and then
  // quitting before claiming would pop the prompt again tomorrow with the Home chip
  // bouncing N → 1 → N. Zeroing currentStreak is what makes streakRescueAvailable go
  // false for good. lastStudyDate is deliberately left alone (study-buddy sync mirrors
  // it), and longestStreak is untouched so streak achievements keep their record.
  // The value is transient: the daily-reward claim that follows sees the old lastStudyDate
  // at a gap >= 2, so it commits currentStreak 1 and pays day 1 — today still counts as
  // day 1 of a fresh streak, exactly as before this window change.
  const declineStreakRescue = () =>
    setS((prev) => ({
      ...prev,
      streak: { ...prev.streak, currentStreak: 0 },
      streakRescueDismissedDate: todayISO(),
    }));

  // Newest preset goes to the front; the list is a fixed-size queue, so the
  // oldest (last) preset is dropped once the cap is reached.
  const saveTimerPreset = (preset: Omit<TimerPreset, 'id'>) =>
    setS((prev) => ({
      ...prev,
      savedTimerPresets: [{ ...preset, label: maskProfanity(preset.label), id: uid() }, ...prev.savedTimerPresets].slice(0, MAX_TIMER_PRESETS),
    }));

  const deleteTimerPreset = (id: string) =>
    setS((prev) => ({
      ...prev,
      savedTimerPresets: prev.savedTimerPresets.filter((p) => p.id !== id),
    }));

  const setAmbience = (id: string | null) =>
    setS((prev) => ({ ...prev, ambienceId: id }));

  const setDefaultCompanion = (id: DefaultCompanionId) =>
    setS((prev) => ({ ...prev, defaultCompanionId: id, activeCompanionId: `starter:${id}` }));

  const setBunSkin = (skinId: string) => setS((prev) => ({ ...prev, bunSkinId: skinId }));

  const setCompanionSkin = (companionId: string, skinId: string) =>
    setS((prev) => ({ ...prev, companionSkins: { ...prev.companionSkins, [companionId]: skinId } }));

  const setEquippedBackground = (roomId: string) => setS((prev) => ({ ...prev, equippedBackgroundRoomId: roomId }));
  const setEquippedDesk = (roomId: string) => setS((prev) => ({ ...prev, equippedDeskRoomId: roomId }));
  const setEquippedSound = (soundId: string | null) =>
    setS((prev) => ({ ...prev, equippedShopItems: { ...prev.equippedShopItems, sound: soundId } }));

  const setActiveCompanion = (id: ActiveCompanionId) =>
    setS((prev) => {
      if (id === 'starter:girl' || id === 'starter:dude') {
        return { ...prev, activeCompanionId: id, defaultCompanionId: id === 'starter:girl' ? 'girl' : 'dude' };
      }

      // Purchased shop companion (id form `shop:<itemId>`).
      if (id.startsWith('shop:')) {
        return prev.ownedShopItems.includes(id.slice(5)) ? { ...prev, activeCompanionId: id } : prev;
      }

      if (!prev.companionSlots.some((slot) => slot.id === id && slot.imageUri)) {
        return prev;
      }

      return { ...prev, activeCompanionId: id };
    });

  // First-launch starter pick. Grant the chosen companion's SKU (so it's owned
  // like any bought companion — `setActiveCompanion` and the shop both gate on
  // ownedShopItems), record it as the free starter, set it active, and close the
  // picker. Bun keeps its `starter:girl` active id; the others use `shop:<sku>`.
  const chooseStarter = (activeId: ActiveCompanionId) => {
    const shopItemId = activeId === 'starter:girl' ? 'companion_bun' : activeId.slice(5);
    // Grant the recipe that matches the character the player picked AND make it
    // their starting desk recipe, so a new player begins on the bake that goes
    // with their character (Bun → the free strawberry shortcake). This only runs
    // when the player actively picks a starter, so — unlike the old migration that
    // caused the "stuck on the wrong desk" bug — it never overrides an existing
    // player's later Bakery Menu choices. `deskFoodReset: true` keeps the one-time
    // reset migration from clobbering this chosen starting recipe on the next load.
    const rec = starterRecipe(activeId === 'starter:girl' ? '' : activeId);
    const startingFoodId = rec?.recipeId ?? 'strawberry-shortcake';
    setS((prev) => {
      const grants = [shopItemId, rec?.recipeItem].filter(
        (id): id is string => !!id && !prev.ownedShopItems.includes(id),
      );
      return {
        ...prev,
        starterCompanionId: activeId,
        starterChosen: true,
        activeCompanionId: activeId,
        defaultCompanionId: 'girl',
        selectedFoodId: startingFoodId,
        deskFoodReset: true,
        ownedShopItems: grants.length ? [...prev.ownedShopItems, ...grants] : prev.ownedShopItems,
      };
    });
    // Celebrate the first companion the same way as a shop purchase.
    setCharacterObtainedPending(shopItemId);
  };

  const saveCompanionSlot = (slot: Omit<CompanionSlot, 'id'>): string | null => {
    const slotId = uid();
    let saved = false;
    setS((prev) => {
      if (!prev.isPlus || prev.companionSlots.length >= MAX_COMPANION_SLOTS) return prev;
      saved = true;
      return {
        ...prev,
        companionSlots: [...prev.companionSlots, { ...slot, id: slotId }],
      };
    });
    return saved ? slotId : null;
  };

  const deleteCompanionSlot = (id: string) =>
    setS((prev) => ({
      ...prev,
      companionSlots: prev.companionSlots.filter((c) => c.id !== id),
      // Deleting the active slot drops back to the free starter (which may not be
      // Bun), never to a Bun the player doesn't own.
      activeCompanionId:
        prev.activeCompanionId === id ? prev.starterCompanionId : prev.activeCompanionId,
    }));

  // Save the per-companion profile-picture framing (zoom + pan).
  const setCompanionPfp = (id: string, pfp: PfpFocus) =>
    setS((prev) => ({
      ...prev,
      companionSlots: prev.companionSlots.map((c) => (c.id === id ? { ...c, pfp } : c)),
    }));

  const consumeAiTicket = (): boolean => {
    if (!s.isPlus || s.aiTickets + s.purchasedAiTickets <= 0) return false;
    setS((prev) => {
      if (!prev.isPlus || prev.aiTickets + prev.purchasedAiTickets <= 0) return prev;
      // Spend the monthly free tickets first, then dip into purchased ones.
      return prev.aiTickets > 0
        ? { ...prev, aiTickets: prev.aiTickets - 1 }
        : { ...prev, purchasedAiTickets: prev.purchasedAiTickets - 1 };
    });
    return true;
  };

  const restoreAiTicket = () =>
    setS((prev) =>
      // Refund into the free pool up to the monthly cap, overflow into purchased.
      prev.aiTickets < 3
        ? { ...prev, aiTickets: prev.aiTickets + 1 }
        : { ...prev, purchasedAiTickets: prev.purchasedAiTickets + 1 },
    );

  const purchaseAiTickets = (amount: number) =>
    setS((prev) => ({
      ...prev,
      purchasedAiTickets: prev.purchasedAiTickets + amount,
    }));

  // Spend one AI generation ticket to top up the companion chat balance.
  const exchangeTicketForChat = (): boolean => {
    if (!s.isPlus || s.aiTickets + s.purchasedAiTickets <= 0) return false;
    setS((prev) => {
      if (!prev.isPlus || prev.aiTickets + prev.purchasedAiTickets <= 0) return prev;
      // Spend free tickets before purchased ones, mirroring consumeAiTicket.
      const ticketUpdate =
        prev.aiTickets > 0
          ? { aiTickets: prev.aiTickets - 1 }
          : { purchasedAiTickets: prev.purchasedAiTickets - 1 };
      return {
        ...prev,
        ...ticketUpdate,
        chatMessages: prev.chatMessages + CHAT_MESSAGES_PER_TICKET,
      };
    });
    return true;
  };

  const consumeChatMessage = (): boolean => {
    const today = todayISO();
    const freeUsed = s.isPlus && s.chatFreeDate === today ? s.chatFreeUsedToday : 0;
    const freeRemaining = s.isPlus ? Math.max(0, PLUS_DAILY_CHAT - freeUsed) : 0;
    if (freeRemaining + s.chatMessages <= 0) return false;
    setS((prev) => {
      const prevFreeUsed = prev.isPlus && prev.chatFreeDate === today ? prev.chatFreeUsedToday : 0;
      const prevFreeRemaining = prev.isPlus ? Math.max(0, PLUS_DAILY_CHAT - prevFreeUsed) : 0;
      if (prevFreeRemaining + prev.chatMessages <= 0) return prev;
      // Spend the free daily Plus allowance first, then the ticket-bought balance.
      if (prevFreeRemaining > 0) {
        return { ...prev, chatFreeUsedToday: prevFreeUsed + 1, chatFreeDate: today };
      }
      return { ...prev, chatMessages: prev.chatMessages - 1 };
    });
    return true;
  };

  // Persist the companion chat thread (capped) so it survives app restarts.
  const setChatThread = (turns: ChatTurn[]) =>
    setS((prev) => ({ ...prev, chatThread: turns.slice(-CHAT_HISTORY_CAP) }));

  const addPurchasedCoins = (amount: number) =>
    setS((prev) => ({
      ...prev,
      coins: capCoins(prev.coins + amount),
      purchasedCoins: prev.purchasedCoins + amount,
    }));

  // Buy streak freezes (shop, real-money mock purchase). Plus members also get a
  // free monthly allotment; everyone else only has the ones they buy here.
  const addStreakFreeze = (count = 1) =>
    setS((prev) => ({ ...prev, streakFreezes: prev.streakFreezes + count }));

  const setSelectedFood = (id: string) =>
    setS((prev) => ({ ...prev, selectedFoodId: id }));

  const markFoodMade = (id: string) => {
    // The badge is credited to the character the *recipe* belongs to (each of the
    // five badge recipes maps to one character), NOT the equipped companion.
    // badgeKey: '' = Bun, or a shop companion id; null if `id` isn't a badge recipe.
    const badgeKey = recipeBadgeKey(id);
    const isNewBadge = badgeKey != null && !s.bakedWith.includes(badgeKey);
    setS((prev) => {
      const madeFoods = prev.madeFoods.includes(id) ? prev.madeFoods : [...prev.madeFoods, id];
      // Badge progress is always derived from the recipes actually made.
      const bakedWith = badgesFromMadeFoods(madeFoods);
      // Baking with the final character grants Hanji and flags the home popup.
      const unlockHanji = hasAllCharacterBadges(bakedWith) && !prev.ownedShopItems.includes(HANJI_COMPANION_ID);
      return {
        ...prev,
        madeFoods,
        bakedWith,
        ...(unlockHanji
          ? {
              ownedShopItems: [...prev.ownedShopItems, HANJI_COMPANION_ID],
              hanjiUnlockPending: true,
            }
          : {}),
      };
    });
    // Every new badge shows the progress popup (keyed by the recipe just made),
    // including the 5th — its popup reads 5/5 with every character collected. The
    // Hanji unlock modal is gated on `recipeBadgePending` being clear, so it only
    // appears once the player dismisses this final progress popup.
    if (isNewBadge) setRecipeBadgePending(id);
  };

  const clearHanjiUnlock = () => setS((prev) => ({ ...prev, hanjiUnlockPending: false }));
  // TEST: replay the FULL final-badge flow in one tap — mark every recipe as made
  // (which derives all five character badges), grant every recipe SKU, actually
  // grant Hanji, and arm the one-time unlock celebration. Also arms the 5/5
  // recipe-badge progress popup (as if the last badge was just earned): it shows
  // FIRST, and the Hanji modal — gated on recipeBadgePending being clear — appears
  // once that popup is dismissed, exactly like the real "bake the last recipe" path.
  const devUnlockHanji = () => {
    setRecipeBadgePending(RECIPE_IDS[RECIPE_IDS.length - 1]);
    setS((prev) => {
      const madeFoods = Array.from(new Set([...prev.madeFoods, ...RECIPE_IDS]));
      const recipeSkus = RECIPE_BADGES.map((b) => b.recipeItem).filter((x): x is string => !!x);
      const ownedShopItems = Array.from(
        new Set([...prev.ownedShopItems, ...recipeSkus, HANJI_COMPANION_ID]),
      );
      return {
        ...prev,
        madeFoods,
        bakedWith: badgesFromMadeFoods(madeFoods),
        ownedShopItems,
        hanjiUnlockPending: true,
      };
    });
  };
  const clearRecipeBadge = () => setRecipeBadgePending(null);
  const clearCharacterObtained = () => setCharacterObtainedPending(null);
  const clearBondLevelUp = () => setBondLevelUp(null);

  // DEV-only preview: celebrate the active companion advancing to its NEXT level,
  // without actually crediting minutes. Lets us eyeball the modal on demand.
  const previewBondLevelUp = () => {
    const id = s.activeCompanionId;
    const mins = s.companionMinutes?.[id] ?? 0;
    setBondLevelUp({ companionId: id, level: companionLevelInfo(mins).level + 1 });
  };

  // DEV-only: simulate a streak that lapsed one full day (gap = 2, the freeze window)
  // and hand the player a freeze, so the on-open "Use streak freeze" rescue prompt fires
  // next time Home renders. Lets us verify the rescue flow without waiting 2 real days.
  // `daysAgo` is the gap to fake (daysBetween lastStudyDate → today), so the caller can
  // land on any point of the rescue window: MIN_GAP = the first offered day, MAX_GAP = the
  // last, MAX_GAP + 1 = just expired. Defaults to the first offered day.
  const devLapseStreak = (daysAgo: number = STREAK_RESCUE_MIN_GAP) => {
    setS((prev) => ({
      ...prev,
      streak: {
        ...prev.streak,
        currentStreak: Math.max(1, prev.streak.currentStreak),
        lastStudyDate: addDaysISO(todayISO(), -Math.max(1, Math.round(daysAgo))),
      },
      streakFreezes: Math.max(1, prev.streakFreezes),
      streakRescueDismissedDate: '', // un-dismiss so the prompt is pending again today
    }));
  };

  // TEST: one-tap "everything" account — owns the entire shop catalog (companions,
  // outfits, backgrounds, desks, sounds, recipe packs), marks every recipe baked
  // (which derives all character badges, so Hanji's unlock condition is also met),
  // grants 9,999,999 coins, a high bond level with every companion, and activates
  // Plus through the normal grant path (freezes/tickets/gold frame follow along).
  // Purely additive: never downgrades anything the account already has.
  const devMaxOutAccount = () => {
    setRecipeBadgePending(null);
    setS((prev) => {
      const madeFoods = Array.from(new Set([...prev.madeFoods, ...RECIPE_IDS]));
      const ownedShopItems = Array.from(
        new Set([...prev.ownedShopItems, ...SHOP_ITEMS.map((item) => item.id)]),
      );
      // ~10,000 bond minutes ≈ level 30 — deep into the curve for every companion.
      const companionMinutes = { ...prev.companionMinutes };
      const bondIds = [
        prev.starterCompanionId,
        ...SHOP_ITEMS.filter((item) => item.category === 'companion').map((item) => `shop:${item.id}`),
      ];
      for (const id of bondIds) {
        companionMinutes[id] = Math.max(companionMinutes[id] ?? 0, 10_000);
      }
      return {
        ...prev,
        coins: Math.max(prev.coins, 9_999_999),
        ownedShopItems,
        madeFoods,
        bakedWith: badgesFromMadeFoods(madeFoods),
        companionMinutes,
      };
    });
    setIsPlus(true, 'annual');
  };

  // TEST/PLACEHOLDER: wipe game progress + purchases WITHOUT erasing the account.
  // The user stays signed in (legal/birthday kept) but is dropped back to the
  // STARTER CHOOSER to re-pick their free companion. Everything owned/equipped —
  // companions, backgrounds, desks, outfits, skins, recipes/badges — resets to the
  // brand-new defaults, which leave only Bun (starter:girl, classic skin) and the
  // Cozy room. Grants 1,000,000 coins. Keeps identity (friend code + friends),
  // language, consent (legal + birthday), and the captured timezone intact.
  const resetGameData = () => {
    setActiveSession(null);
    setRecipeBadgePending(null);
    setS((prev) => ({
      ...DEFAULTS,
      // Identity + completed onboarding — keep so the account isn't erased and the
      // login/onboarding gates stay closed.
      friendCode: prev.friendCode,
      friends: prev.friends,
      language: prev.language,
      languageSelected: prev.languageSelected,
      timezone: prev.timezone,
      // Re-verify age on reset: consent is NOT kept, so the Privacy Policy + Terms
      // + 13+ age confirmation runs again. These fall back to DEFAULTS —
      // legalAccepted:false, birthday/profileBirthday cleared,
      // profileBirthdayChangeCount:0. The profile birthday is no longer seeded from
      // onboarding: it is optional and the player adds it in Settings.
      // Profile text identity (display name/bio) is part of the account.
      profileDisplayName: prev.profileDisplayName,
      profileDescription: prev.profileDescription,
      // Drop back to the starter chooser so the reset re-runs the "pick your free
      // companion" step (DEFAULTS already reset starterCompanionId/activeCompanionId).
      starterChosen: false,
      // The reset re-runs the whole new-account flow (legal gate, starter chooser,
      // day-1 reward), so replay the first-launch coachmark tour with it —
      // tutorialSeen falls back to DEFAULTS (false) and Home shows the tour after
      // the day-1 login reward is claimed.
      coins: 1_000_000,
    }));
  };

  // Only the saved state is reliable once the loaded scope key matches the active
  // scope (the same gate the save effect uses); on a failed load it stays unset.
  const persistedStateReady = loaded && loadedScopeKey === appStateScope.storageKey;

  // Called when the player quits mid-onboarding (privacy / birthday / buddy picker)
  // and relaunches: overwrite this account's saved state — local AND cloud — back to
  // a brand-new state so re-logging in starts the whole onboarding flow over. The
  // caller signs out afterwards, which drops them on the login screen.
  const resetAccountForAbandonedOnboarding = async () => {
    const fresh: PersistedState = {
      ...DEFAULTS,
      // Keep only the device's chosen language so the UI doesn't flip locales.
      language: s.language,
      languageSelected: s.languageSelected,
    };
    const stamped = { ...fresh, updatedAt: Date.now() } as Record<string, unknown>;
    // Overwrite the SAVED copies only — don't mutate the live in-memory state. The
    // caller signs out immediately after, which swaps the scope and reloads fresh;
    // resetting `s` here would only flash the onboarding gate before login appears.
    try {
      await saveScopedAppState(appStateScope, stamped);
    } catch {}
    if (appStateScope.kind === 'user') {
      try {
        await pushCloudState(appStateScope.userId, stamped);
      } catch {}
    }
  };

  // TEST: grant every recipe badge except the croissant, plus all recipe shop
  // items, so the final "bake the last recipe → unlock Hanji" flow can be tested
  // by baking just the croissant.

  const setDayNote = (date: string, note: string) =>
    setS((prev) => {
      const next = { ...prev.dayNotes };
      if (note.trim()) next[date] = note;
      else delete next[date];
      return { ...prev, dayNotes: next };
    });

  const setDayShape = (date: string, shape: string | null) =>
    setS((prev) => {
      const next = { ...prev.dayShapes };
      if (shape) next[date] = shape;
      else delete next[date];
      return { ...prev, dayShapes: next };
    });

  const setDaySubject = (date: string, subjectId: string | null) =>
    setS((prev) => {
      const next = { ...prev.daySubjects };
      if (subjectId) next[date] = subjectId;
      else delete next[date];
      return { ...prev, daySubjects: next };
    });

  const addFriend = (rawCode: string): { ok: boolean; error?: string } => {
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return { ok: false, error: 'Friend codes are 6 letters/numbers.' };
    if (code === s.friendCode) return { ok: false, error: "That's your own code!" };
    if (s.friends.some((f) => f.code === code)) return { ok: false, error: 'Already friends with this code.' };
    if (s.friends.length >= MAX_FRIENDS) return { ok: false, error: `You can have up to ${MAX_FRIENDS} friends.` };
    setS((prev) => ({
      ...prev,
      friends: [{ code, name: `Friend ${code}`, addedAt: new Date().toISOString() }, ...prev.friends],
    }));
    return { ok: true };
  };

  const removeFriend = (code: string) =>
    setS((prev) => ({ ...prev, friends: prev.friends.filter((f) => f.code !== code) }));

  // Block: drop the friendship, hide them everywhere (friends/requests/DMs are
  // filtered by `blockedCodes`), and persist the block to Supabase. Optimistic.
  const blockUser = (code: string) => {
    setBlockedCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setS((prev) => ({ ...prev, friends: prev.friends.filter((f) => f.code !== code) }));
    blockUserRemote(code);
  };
  const unblockUser = (code: string) => {
    setBlockedCodes((prev) => prev.filter((c) => c !== code));
    unblockUserRemote(code);
  };
  // Load this account's block list once its state scope (user id) is established.
  useEffect(() => {
    if (!loadedScopeKey) { setBlockedCodes([]); return; }
    loadBlockedCodes().then(setBlockedCodes);
  }, [loadedScopeKey]);

  const setFriendProfile = (code: string, data: Partial<Friend>) =>
    setS((prev) => ({
      ...prev,
      friends: prev.friends.map((f) => (f.code === code ? { ...f, ...data } : f)),
    }));

  // ─── Direct-message unread counts (in-memory, by friend code) ─────────────
  const setDmUnreadCounts = (counts: Record<string, number>) => setDmUnreadState(counts);
  const bumpDmUnread = (code: string) =>
    setDmUnreadState((prev) => ({ ...prev, [code]: (prev[code] ?? 0) + 1 }));
  const clearDmUnread = (code: string) =>
    setDmUnreadState((prev) => {
      if (!prev[code]) return prev;
      const next = { ...prev };
      delete next[code];
      return next;
    });

  const setCakeCharacter = (id: string) => setS((prev) => ({ ...prev, cakeCharacter: id }));

  const recordCakeBest = (mode: 'rush' | 'line', score: number) =>
    setS((prev) =>
      mode === 'rush'
        ? { ...prev, cakeBestRush: Math.max(prev.cakeBestRush, score) }
        : { ...prev, cakeBestLine: Math.max(prev.cakeBestLine, score) },
    );

  const recordGame2048Best = (score: number) =>
    setS((prev) => ({ ...prev, game2048Best: Math.max(prev.game2048Best, score) }));

  // Claim a broadcast mail's reward once: grant coins (uncapped, like the login
  // reward) + unlock its item if any, and remember it so it can't be claimed twice.
  // The server (claim_mail RPC) is the authority on whether it was already claimed —
  // we grant the reward only when it reports a NEW claim, so editing local state to
  // replay a claim is a no-op.
  // Returns true if the mail should now show as claimed (granted or already claimed),
  // false if the attempt failed and should be retryable.
  const claimMail = async (mail: { id: string; coins: number; itemId: string | null }): Promise<boolean> => {
    const result = await claimMailRemote(mail.id, mail.itemId);
    if (result === 'error') {
      // Offline / RPC failure: leave it UNCLAIMED so the reward isn't forfeited.
      return false;
    }
    if (result === 'already') {
      // Already claimed elsewhere: reflect claimed state, grant nothing.
      setS((prev) =>
        prev.claimedMailIds.includes(mail.id)
          ? prev
          : { ...prev, claimedMailIds: [...prev.claimedMailIds, mail.id] },
      );
      return true;
    }
    // 'new' — grant the reward exactly once.
    setS((prev) => {
      if (prev.claimedMailIds.includes(mail.id)) return prev;
      const grantItem = !!mail.itemId && !prev.ownedShopItems.includes(mail.itemId);
      return {
        ...prev,
        coins: capCoins(prev.coins + (mail.coins || 0)),
        ownedShopItems: grantItem ? [...prev.ownedShopItems, mail.itemId as string] : prev.ownedShopItems,
        claimedMailIds: [...prev.claimedMailIds, mail.id],
      };
    });
    return true;
  };

  // Mark a mail opened (read). Idempotent — no-op if already read. Clears the mail
  // notification dot for that mail even if its reward is left unclaimed.
  const markMailRead = (id: string) =>
    setS((prev) => (prev.readMailIds.includes(id) ? prev : { ...prev, readMailIds: [...prev.readMailIds, id] }));

  const setMultipleReminders = (reminders: ReminderEntry[]) =>
    setS((prev) => ({ ...prev, multipleReminders: reminders }));

  const setLanguage = (lang: string) => {
    // An explicit Settings/first-launch change is authoritative for the current
    // account — cancel any not-yet-consumed login-screen pick.
    pendingLoginLangRef.current = null;
    i18n.changeLanguage(lang);
    setS((prev) => ({ ...prev, language: lang }));
  };

  // The login screen's language pick: apply it live AND remember it so the account
  // the user then signs into adopts it (see the load effect), overriding any saved
  // language. markLanguageSelected is folded in so the first-launch prompt won't fire.
  const chooseLoginLanguage = (lang: string) => {
    pendingLoginLangRef.current = lang;
    i18n.changeLanguage(lang);
    setS((prev) => ({ ...prev, language: lang, languageSelected: true }));
  };

  const markLanguageSelected = () =>
    setS((prev) => ({ ...prev, languageSelected: true }));

  const markLegalAccepted = () =>
    setS((prev) => ({ ...prev, legalAccepted: true }));

  const markTutorialSeen = () =>
    setS((prev) => ({ ...prev, tutorialSeen: true }));

  // Re-arm the first-launch tutorial (used by the "Replay tutorial" Settings row);
  // the home screen shows it again on next focus while tutorialSeen is false.
  const replayTutorial = () =>
    setS((prev) => ({ ...prev, tutorialSeen: false }));

  // One-time +100 coins for tapping the Instagram follow button. Granted directly
  // (bypasses the daily earn cap, like the login reward); no-op once claimed.
  const claimInstagramFollow = () =>
    setS((prev) =>
      prev.instagramFollowClaimed
        ? prev
        : { ...prev, instagramFollowClaimed: true, coins: capCoins(prev.coins + 100) },
    );

  // ─── Wave 2 shop ─────────────────────────────────────────────────────────

  const purchaseShopItem = (itemId: string, price: number): boolean => {
    const item = getShopItem(itemId);
    if (!item || s.ownedShopItems.includes(itemId) || s.coins < price) return false;
    // Plus-exclusive and all-recipe-reward items are granted, never bought with
    // coins — refuse to sell them no matter what price a caller passes.
    if (item.plusOnly || item.requiresAllRecipes) return false;
    setS((prev) => {
      if (prev.ownedShopItems.includes(itemId) || prev.coins < price) return prev;

      // Buying only marks an item owned — the player equips it separately.
      return {
        ...prev,
        coins: prev.coins - price,
        ownedShopItems: [...prev.ownedShopItems, itemId],
      };
    });
    // Only companions get the "character obtained" celebration (not outfits/desks/etc.).
    if (item.category === 'companion') setCharacterObtainedPending(itemId);
    return true;
  };

  // Redeem one Plus room ticket for a single background OR desk (no coins). Guards:
  // must own a ticket, item must exist, be a background/desk, and not already owned.
  const redeemTicketForItem = (itemId: string): boolean => {
    const item = getShopItem(itemId);
    if (!item || s.exchangeTickets <= 0) return false;
    if (item.category !== 'background' && item.category !== 'desk') return false;
    if (s.ownedShopItems.includes(itemId)) return false;
    setS((prev) => {
      if (prev.exchangeTickets <= 0 || prev.ownedShopItems.includes(itemId)) return prev;
      return {
        ...prev,
        exchangeTickets: prev.exchangeTickets - 1,
        ownedShopItems: [...prev.ownedShopItems, itemId],
      };
    });
    return true;
  };

  const clearExchangeTicketPending = () => setS((prev) => ({ ...prev, exchangeTicketPending: 0 }));

  const equipShopItem = (itemId: string): boolean => {
    const item = getShopItem(itemId);
    if (!item || item.category === 'game' || !s.ownedShopItems.includes(itemId)) return false;

    setS((prev) => {
      if (!prev.ownedShopItems.includes(itemId)) return prev;
      return {
        ...prev,
        equippedShopItems: {
          ...prev.equippedShopItems,
          [item.category]: itemId,
        },
      };
    });

    return true;
  };

  return (
    <AppContext.Provider
      value={{
        loaded,
        coins: s.coins,
        sessionsCompleted: s.sessionsCompleted,
        totalMinutes: s.totalMinutes,
        examCountdowns: s.examCountdowns,
        reminderEnabled: s.reminderEnabled,
        reminderTime: s.reminderTime,
        notifTasks: s.notifTasks ?? true,
        notifStreak: s.notifStreak ?? true,
        notifExams: s.notifExams ?? true,
        setNotifTasks,
        setNotifStreak,
        setNotifExams,
        use24HourTime: s.use24HourTime,
        soundEffectsEnabled: s.soundEffectsEnabled,
        vinylColor: s.vinylColor,
        spotifyBgEnabled: s.spotifyBgEnabled ?? false,
        spotifyBgColor: s.spotifyBgColor ?? 'black',
        streak: s.streak,
        // Today's streak day = what the streak counts *as of today* (the login day),
        // even before the user has claimed/studied. So a fresh login shows day 1, a
        // continued one shows N+1, and a lapsed one shows 1 — the chip never sits at
        // a stale number while you're looking at it.
        todayStreakDay: streakRescuePending(s, todayISO()) ? s.streak.currentStreak : nextStreakState(s.streak, todayISO()).next,
        earnedToday: s.earnedDate === todayISO() ? s.earnedToday : 0,
        adRewardCount: s.adRewardDate === todayISO() ? s.adRewardCount : 0,
        loginStreak: s.loginStreak,
        loginRewardDate: s.loginRewardDate,
        lifetimeTasksCompleted: s.lifetimeTasksCompleted,
        lifetimeFriendSessions: s.lifetimeFriendSessions,
        claimedAchievements: s.claimedAchievements,
        recordFriendSession,
        claimAchievement,
        birthdayRewardYear: s.birthdayRewardYear ?? 0,
        subjects: s.subjects,
        tasks: s.tasks,
        ownedShopItems: s.ownedShopItems,
        equippedShopItems: s.equippedShopItems,
        subjectTimeMap: s.subjectTimeMap,
        subjectMonthly: s.subjectMonthly ?? {},
        skipSubjectCount: s.skipSubjectCount,
        sessionHistory: s.sessionHistory,
        companionMinutes: s.companionMinutes ?? {},
        activeSession,
        sessionRun,
        addCoins,
        claimAdReward,
        claimLoginReward,
        claimBirthdayReward,
        recordSession,
        petCompanion,
        addExam,
        removeExam,
        updateExam,
        setReminder,
        setUse24HourTime,
        setSoundEffectsEnabled,
        setVinylColor,
        setSpotifyBgEnabled,
        setSpotifyBgColor,
        updateStreak,
        addSubject,
        renameSubject,
        recolorSubject,
        archiveSubject,
        deleteSubject,
        reorderSubjects,
        addTask,
        updateTask,
        deleteTask,
        completeTask,
        postponeTask,
        addSubjectTime,
        startActiveSession,
        clearActiveSession,
        finishStudyBlock,
        clearSessionRun,
        shiftSessionStart,
        setActiveSessionSubject,
        markSessionMultiplayer,
        incrementSkipSubjectCount,
        resetSkipSubjectCount,
        purchaseShopItem,
        redeemTicketForItem,
        clearExchangeTicketPending,
        equipShopItem,
        // Wave 4
        isPlus: s.isPlus,
        plusPlan: s.plusPlan,
        plusUntil: s.plusUntil,
        streakFreezes: s.streakFreezes,
        streakRescuePending: streakRescuePending(s, todayISO()),
        streakRescueDismissedDate: s.streakRescueDismissedDate,
        savedTimerPresets: s.savedTimerPresets,
        ambienceId: s.ambienceId,
        defaultCompanionId: s.defaultCompanionId,
        activeCompanionId: s.activeCompanionId,
        starterCompanionId: s.starterCompanionId ?? 'starter:girl',
        starterChosen: s.starterChosen ?? false,
        companionSlots: s.companionSlots,
        bunSkinId: getEffectiveBunSkinId(s.bunSkinId, s.ownedShopItems),
        companionSkins: getEffectiveCompanionSkins(s.companionSkins, s.ownedShopItems),
        equippedBackgroundRoomId: s.equippedBackgroundRoomId ?? 'cozy',
        equippedDeskRoomId: s.equippedDeskRoomId ?? 'cozy',
        aiTickets: s.aiTickets,
        purchasedAiTickets: s.purchasedAiTickets,
        exchangeTickets: s.exchangeTickets,
        exchangeTicketPending: s.exchangeTicketPending,
        chatMessages: s.chatMessages,
        dailyChatRemaining: s.isPlus
          ? Math.max(0, PLUS_DAILY_CHAT - (s.chatFreeDate === todayISO() ? s.chatFreeUsedToday : 0))
          : 0,
        chatThread: s.chatThread,
        purchasedCoins: s.purchasedCoins,
        multipleReminders: s.multipleReminders,
        selectedFoodId: s.selectedFoodId ?? 'strawberry-shortcake',
        madeFoods: s.madeFoods ?? [],
        bakedWith: s.bakedWith ?? [],
        setSelectedFood,
        markFoodMade,
        hanjiUnlockPending: s.hanjiUnlockPending ?? false,
        clearHanjiUnlock,
        devUnlockHanji,
        recipeBadgePending,
        clearRecipeBadge,
        characterObtainedPending,
        clearCharacterObtained,
        bondLevelUp,
        clearBondLevelUp,
        previewBondLevelUp,
        devLapseStreak,
        devMaxOutAccount,
        persistedStateReady,
        resetAccountForAbandonedOnboarding,
        resetGameData,
        dayNotes: s.dayNotes ?? {},
        setDayNote,
        dayShapes: s.dayShapes ?? {},
        setDayShape,
        daySubjects: s.daySubjects ?? {},
        setDaySubject,
        friendCode: s.friendCode,
        lastProfileSyncError,
        friends: (s.friends ?? []).filter((f) => !blockedCodes.includes(f.code)),
        addFriend,
        removeFriend,
        blockedCodes,
        blockUser,
        unblockUser,
        setFriendProfile,
        dmUnread,
        setDmUnreadCounts,
        bumpDmUnread,
        clearDmUnread,
        profileDisplayName: s.profileDisplayName ?? '',
        profileDescription: s.profileDescription ?? '',
        profileBirthday: s.profileBirthday ?? '',
        profileBirthdayChangeCount: s.profileBirthdayChangeCount ?? 0,
        profileBackgroundId: s.profileBackgroundId ?? 'cozy',
        profileCardColor: s.profileCardColor ?? 'pink',
        profileCompanionId: s.profileCompanionId ?? '',
        profileSkinId: s.profileSkinId ?? 'classic',
        profileAvatarFrame: s.profileAvatarFrame ?? 'none',
        updateProfile,
        cakeBestRush: s.cakeBestRush ?? 0,
        cakeBestLine: s.cakeBestLine ?? 0,
        cakeCharacter: s.cakeCharacter ?? 'bun',
        setCakeCharacter,
        recordCakeBest,
        game2048Best: s.game2048Best ?? 0,
        recordGame2048Best,
        // Use the module-level DEFAULTS array (not a fresh `[]`) so the reference is
        // stable across renders — consumers list claimedMailIds in effect deps, and a
        // new array each render would re-run those effects in a loop (froze Home).
        claimedMailIds: s.claimedMailIds ?? DEFAULTS.claimedMailIds,
        claimMail,
        readMailIds: s.readMailIds ?? DEFAULTS.readMailIds,
        markMailRead,
        setIsPlus,
        useStreakFreeze,
        rescueStreakByPurchase,
        dismissStreakRescue,
        declineStreakRescue,
        saveTimerPreset,
        deleteTimerPreset,
        setAmbience,
        setDefaultCompanion,
        setActiveCompanion,
        chooseStarter,
        setBunSkin,
        setCompanionSkin,
        setEquippedBackground,
        setEquippedDesk,
        setEquippedSound,
        saveCompanionSlot,
        deleteCompanionSlot,
        setCompanionPfp,
        consumeAiTicket,
        restoreAiTicket,
        purchaseAiTickets,
        exchangeTicketForChat,
        consumeChatMessage,
        setChatThread,
        addPurchasedCoins,
        addStreakFreeze,
        setMultipleReminders,
        language: s.language ?? 'en',
        languageSelected: s.languageSelected ?? false,
        legalAccepted: s.legalAccepted ?? false,
        tutorialSeen: s.tutorialSeen ?? false,
        instagramFollowClaimed: s.instagramFollowClaimed ?? false,
        birthday: s.birthday ?? null,
        setLanguage,
        chooseLoginLanguage,
        markLanguageSelected,
        markLegalAccepted,
        markTutorialSeen,
        replayTutorial,
        claimInstagramFollow,
      }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
