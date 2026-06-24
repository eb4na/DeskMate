import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import i18n, { detectDeviceLanguage } from '@/i18n';
import { COINS_PER_MINUTE, DAILY_EARN_CAP, MAX_FRIENDS, STATIC_SUBJECTS } from '@/constants/placeholder-data';
import { SHOP_ITEMS, type ShopCategory } from '@/constants/shop-data';
import { dailyRewardCoins } from '@/constants/login-rewards';
import { dailyGoalIds, getQuest, getAchievement } from '@/constants/quests';
import { useAuth } from '@/context/auth-context';
import { getAppStateScope, loadScopedAppState, saveScopedAppState, isGuestUpgradePending, clearGuestUpgradePending, loadGuestState } from '@/lib/app-state-repository';
import { probeCloudState, pushCloudState, pushCloudStateDebounced } from '@/lib/cloud-sync';
import { getEffectiveBunSkinId, getEffectiveCompanionSkins } from '@/lib/companion-utils';
import { maskProfanity } from '@/lib/profanity';
import { loadBlockedCodes, blockUserRemote, unblockUserRemote } from '@/lib/moderation';
import { syncStreakReminders } from '@/lib/notifications';
import { computeTaskRollover } from '@/lib/task-recurrence';
import { uploadProfile } from '@/lib/profile-sync';
import { uploadStudyDay } from '@/lib/study-buddy';
import { HANJI_COMPANION_ID, recipeBadgeKey, badgesFromMadeFoods, hasAllCharacterBadges, RECIPE_IDS } from '@/constants/recipes';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChatTurn = { role: 'user' | 'assistant'; content: string; at?: number };

export type MoodEntry = {
  id: string;
  value: string;
  label: string;
  type: 'before' | 'after';
  sessionMinutes: number;
  timestamp: string;
};

export type ExamCountdown = {
  id: string;
  name: string;
  subject: string;
  dateISO: string;
  /** Time of day the exam starts, as "HH:MM" (24-hour). Optional for legacy data. */
  time?: string;
  reminderEnabled: boolean;
  /** Decorative shape shown on the countdown (e.g. 'heart', 'tear'). Optional. */
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
  subjectId: string | null;
  dueDate: string | null;
  /** Optional time of day the task is due, as "HH:MM" (24-hour). */
  dueTime: string | null;
  estimatedMinutes: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  postponeCount: number;
  lastActivityAt: string | null;
  notifyAt: string | null;
  notifId: string | null;
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
};

// ─── Wave 4 types ─────────────────────────────────────────────────────────────

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

// Saved presets behave as a fixed-size queue: newest first, oldest dropped.
const MAX_TIMER_PRESETS = 4;

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

export type AdvancedExamFields = {
  topics: string;
  targetHours: number | null;
  confidenceLevel: 1 | 2 | 3 | 4 | 5;
};

// ─── Seed subjects from Wave 1 static data ───────────────────────────────────

const INITIAL_SUBJECTS: Subject[] = STATIC_SUBJECTS.map((s, i) => ({
  id: String(i + 1),
  name: s.name,
  color: s.color,
  emoji: '',
  archived: false,
  order: i,
}));

// ─── Persisted state shape ────────────────────────────────────────────────────

type PersistedState = {
  // Wave 1
  coins: number;
  sessionsCompleted: number;
  totalMinutes: number;
  moodEntries: MoodEntry[];
  examCountdowns: ExamCountdown[];
  reminderEnabled: boolean;
  reminderTime: string;
  use24HourTime: boolean;
  soundEffectsEnabled: boolean;
  vinylColor: string;
  streak: StreakData;
  earnedToday: number;
  earnedDate: string;
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
  savedTimerPresets: TimerPreset[];
  savedBreakPresets: TimerPreset[];
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
  chatMessages: number;
  chatFreeUsedToday: number;
  chatFreeDate: string;
  chatThread: ChatTurn[];
  purchasedCoins: number;
  multipleReminders: ReminderEntry[];
  advancedExamMap: Record<string, AdvancedExamFields>;

  // Food / baking
  selectedFoodId: string;
  madeFoods: string[];
  // Companion badge keys the player has baked with (any recipe while that
  // companion was active). Collecting all five → unlocks Hanji.
  bakedWith: string[];
  // Set true the moment all character badges are collected (grants Hanji); the
  // home screen shows a one-time unlock popup, then clears it.
  hanjiUnlockPending: boolean;

  // Calendar day notes (dateISO → note text)
  dayNotes: Record<string, string>;

  // Friends
  friendCode: string;
  friends: Friend[];

  // Profile card (shareable ID card)
  profileDisplayName: string;
  profileDescription: string;
  profileBirthday: string; // YYYY-MM-DD or ''
  profileBackgroundId: string; // room id used as the card backdrop
  profileCardColor: string; // pastel key for the card outline + friend-code strip (Plus)
  profileCompanionId: string; // chosen character for the card ('' = use active)
  profileSkinId: string; // chosen outfit/skin for that character
  profileAvatarFrame: string; // 'gold' while Plus (auto gold crown frame), else 'none'

  // Cake Kitchen mini-game best scores + chosen character
  cakeBestRush: number;
  cakeBestLine: number;
  cakeCharacter: string;

  // i18n
  language: string;
  languageSelected: boolean;

  // Legal: whether the user accepted the Privacy Policy + Terms of Service.
  legalAccepted: boolean;
  // Whether the first-launch home tutorial (coachmark tour) has been shown.
  tutorialSeen: boolean;
  // Whether the user tapped the "Follow on Instagram" reward (one-time +100 coins).
  instagramFollowClaimed: boolean;
  // Date of birth (ISO YYYY-MM-DD) captured at the consent gate for age check.
  birthday: string | null;

  // IANA timezone captured once on first load and kept for the account's lifetime.
  // The streak "day" rolls at 12am in this zone. Never re-extracted after first set.
  timezone: string;

  // Daily Quests: compact per-day counters (reset at 12am in the account timezone
  // via rolledQuests) the day's three quests are measured against, plus which were
  // claimed today. `day` is the todayISO the counters were last reset on.
  quests: QuestState;
  // Achievements: lifetime tallies not otherwise tracked, + which achievements have
  // been claimed (one-time). sessionsCompleted/totalMinutes/streak.longestStreak
  // already exist and back the rest.
  lifetimeTasksCompleted: number;
  lifetimeFriendSessions: number;
  claimedAchievements: string[];
};

type QuestState = {
  day: string;
  sessionsToday: number;
  minutesToday: number;
  beforeNoonMinutesToday: number;
  friendSessionsToday: number;
  tasksToday: number;
  claimedToday: string[];
};

// How many companion chat messages one AI generation ticket converts into.
export const CHAT_MESSAGES_PER_TICKET = 250;

// Free companion chat messages a Plus member gets each day (no ticket needed).
export const PLUS_DAILY_CHAT = 40;

// Most recent companion chat messages kept in local history.
export const CHAT_HISTORY_CAP = 50;

// Maximum active subjects — free tier vs Plus.
export const MAX_SUBJECTS_FREE = 10;
export const MAX_SUBJECTS_PLUS = 20;

const DEFAULTS: PersistedState = {
  // New accounts start with a coin gift.
  coins: 1000,
  sessionsCompleted: 0,
  totalMinutes: 0,
  moodEntries: [],
  examCountdowns: [],
  reminderEnabled: false,
  reminderTime: '20:00',
  use24HourTime: false,
  soundEffectsEnabled: true,
  vinylColor: '#3B3340',
  streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: null },
  earnedToday: 0,
  earnedDate: '',
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
  savedTimerPresets: [],
  savedBreakPresets: [],
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
  chatMessages: 0,
  chatFreeUsedToday: 0,
  chatFreeDate: '',
  chatThread: [],
  purchasedCoins: 0,
  multipleReminders: [],
  advancedExamMap: {},
  selectedFoodId: 'strawberry-shortcake',
  madeFoods: [],
  bakedWith: [],
  hanjiUnlockPending: false,
  dayNotes: {},
  friendCode: '',
  friends: [],
  profileDisplayName: '',
  profileDescription: '',
  profileBirthday: '',
  profileBackgroundId: 'cozy',
  profileCardColor: 'pink',
  profileCompanionId: '',
  profileSkinId: 'classic',
  profileAvatarFrame: 'none',
  cakeBestRush: 0,
  cakeBestLine: 0,
  cakeCharacter: 'bun',
  language: 'en',
  languageSelected: false,
  legalAccepted: false,
  tutorialSeen: false,
  instagramFollowClaimed: false,
  birthday: null,
  timezone: '',
  quests: {
    day: '',
    sessionsToday: 0,
    minutesToday: 0,
    beforeNoonMinutesToday: 0,
    friendSessionsToday: 0,
    tasksToday: 0,
    claimedToday: [],
  },
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

// Hour-of-day (0–23) of `date` as seen in the account timezone — used for the
// "before noon" quest so it agrees with the account's day boundary (never the raw
// device clock, which would drift for a travelling user). Mirrors dateInTimeZone.
function hourInTimeZone(date: Date, tz: string | null): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const h = parts.find((p) => p.type === 'hour')?.value;
    // Intl may render midnight as '24' in some environments; fold it back to 0.
    const n = h ? parseInt(h, 10) % 24 : date.getHours();
    return Number.isFinite(n) ? n : date.getHours();
  } catch {
    return date.getHours();
  }
}

// Daily quest counters reset at 12am in the account timezone. This pure helper
// returns the quests block as it should read for `today`: untouched if it's still
// the same day, otherwise zeroed with a cleared claim list. Both the mutations and
// the Quests screen call this, so the screen never shows yesterday's progress while
// waiting for the next study/task event to roll it over.
function rolledQuests(quests: QuestState, today: string): QuestState {
  if (quests.day === today) return quests;
  return {
    day: today,
    sessionsToday: 0,
    minutesToday: 0,
    beforeNoonMinutesToday: 0,
    friendSessionsToday: 0,
    tasksToday: 0,
    claimedToday: [],
  };
}

// Shift a YYYY-MM-DD string by whole days via pure UTC calendar math (DST-safe).
function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * 86400000).toISOString().split('T')[0];
}

function yesterdayISO(): string {
  return addDaysISO(todayISO(), -1);
}

const MAX_COMPANION_SLOTS = 3;
// Free tier: up to 3 future exam countdowns; past-due ones auto-erase (below) so
// the cap always means "3 upcoming". Plus gets a high cap (effectively unlimited)
// and keeps past-due countdowns. Exported so the UI gates read from one source.
export const FREE_EXAM_LIMIT = 3;
// Plus users get a high exam cap rather than truly unlimited (mirrors subjects).
const MAX_EXAMS_PLUS = 50;
// Total tasks a user can keep at once.
export const MAX_TASKS = 500;
// Mood journal keeps only the most recent entries so it can't grow forever.
const MAX_MOOD_ENTRIES = 365;
const STREAK_MAX = 200; // study-day streak caps here

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
// is set and the gap is within the 3-day freeze window (2–4 days), the streak is
// bridged and continued (consuming a freeze) instead of resetting.
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
  if (rescue && diff <= 4) {
    // Bridge the missed days with a freeze and continue the streak.
    return { changed: true, next: Math.min(STREAK_MAX, st.currentStreak + 1), isComeback: false, useFreeze: true };
  }
  // Missed too long (or no rescue) → streak resets; today is day 1 of a fresh streak.
  return { changed: true, next: 1, isComeback: true, useFreeze: false };
}

// True when a lapsed streak can STILL be rescued by a freeze: Plus, has ≥1 freeze,
// and the gap since last activity is within the 2–4 day freeze window (mirrors the
// session-complete rescue gate). The login reward + home streak display consult this
// so neither shows nor commits a reset for a streak the freeze prompt can still save
// — without it, claiming the daily reward before studying silently wastes the freeze.
export function streakRescueAvailable(
  s: { isPlus: boolean; streakFreezes: number; streak: StreakData },
  today: string,
): boolean {
  const last = s.streak.lastStudyDate;
  if (!last || !s.isPlus || s.streakFreezes <= 0) return false;
  const gap = daysBetween(last, today);
  return gap >= 2 && gap <= 4;
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
  s: { loginRewardDate: string; streak: StreakData; isPlus: boolean; streakFreezes: number },
  today: string,
): LoginReward {
  // When a freeze could still rescue the streak, claiming the login reward must NOT
  // reset it — preview (and later award) the preserved current streak day instead of
  // the day-1 projection, leaving the rescue decision to the study-session flow.
  const day = streakRescueAvailable(s, today) ? s.streak.currentStreak : nextStreakState(s.streak, today).next;
  const baseCoins = dailyRewardCoins(day);
  return { available: s.loginRewardDate !== today, day, baseCoins, coins: s.isPlus ? baseCoins * 2 : baseCoins };
}

// Birthday gift: a flat coin bonus granted once on the player's birthday each year.
export const BIRTHDAY_REWARD_COINS = 1000;

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

  // Only Plus members get the monthly allotment of free streak freezes.
  if (merged.isPlus && (!merged.streakFreezeResetMonth || merged.streakFreezeResetMonth < month)) {
    merged.streakFreezes = 3;
    merged.streakFreezeResetMonth = month;
  }

  if (merged.isPlus && (!merged.aiTicketsResetMonth || merged.aiTicketsResetMonth < month)) {
    merged.aiTickets = 3;
    merged.aiTicketsResetMonth = month;
  }

  // Plus exclusive: ensure Plus members own the Berry Princess Bun skin and the
  // Strawberry Palace room (covers players who had Plus before these became perks).
  for (const plusGrant of ['outfit_bun_strawberry', 'bg_strawberry_palace', 'desk_strawberry']) {
    if (merged.isPlus && !(merged.ownedShopItems ?? []).includes(plusGrant)) {
      merged.ownedShopItems = [...(merged.ownedShopItems ?? []), plusGrant];
    }
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
  moodEntries: MoodEntry[];
  examCountdowns: ExamCountdown[];
  reminderEnabled: boolean;
  reminderTime: string;
  use24HourTime: boolean;
  soundEffectsEnabled: boolean;
  vinylColor: string;
  streak: StreakData;
  todayStreakDay: number;
  earnedToday: number;
  loginStreak: number;
  loginRewardDate: string;

  // Daily Quests + Achievements. `quests` is always rolled to today (counters read
  // 0 on a new day even before the next event fires).
  quests: QuestState;
  lifetimeTasksCompleted: number;
  lifetimeFriendSessions: number;
  claimedAchievements: string[];
  recordQuestSession: (opts: { minutes: number; withFriend?: boolean }) => void;
  claimQuestReward: (id: string) => void;
  claimAchievement: (id: string) => void;

  // Wave 2 state
  subjects: Subject[];
  tasks: Task[];
  ownedShopItems: string[];
  equippedShopItems: EquippedShopItems;
  subjectTimeMap: Record<string, number>;
  skipSubjectCount: number;
  sessionHistory: SessionRecord[];
  companionMinutes: Record<string, number>;
  activeSession: ActiveSession | null;

  // Wave 4 state
  isPlus: boolean;
  plusPlan: 'monthly' | 'annual' | null;
  plusUntil: string;
  streakFreezes: number;
  savedTimerPresets: TimerPreset[];
  savedBreakPresets: TimerPreset[];
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
  chatMessages: number;
  dailyChatRemaining: number;
  chatThread: ChatTurn[];
  purchasedCoins: number;
  multipleReminders: ReminderEntry[];
  advancedExamMap: Record<string, AdvancedExamFields>;
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
  devTriggerHanjiUnlock: () => void;
  recipeBadgePending: string | null;
  clearRecipeBadge: () => void;
  // Shop SKU of a just-obtained companion → drives the one-shot "character
  // obtained" celebration. Transient (not persisted); cleared on dismiss.
  characterObtainedPending: string | null;
  clearCharacterObtained: () => void;
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
  friendCode: string;
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
  profileBackgroundId: string;
  profileCardColor: string;
  profileCompanionId: string;
  profileSkinId: string;
  profileAvatarFrame: string;
  updateProfile: (patch: Partial<{
    displayName: string;
    description: string;
    birthday: string;
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
  setLanguage: (lang: string) => void;
  markLanguageSelected: () => void;
  markLegalAccepted: () => void;
  markTutorialSeen: () => void;
  replayTutorial: () => void;
  claimInstagramFollow: () => void;
  setBirthday: (iso: string) => void;

  // Wave 1 actions
  addCoins: (amount: number) => void;
  claimLoginReward: () => void;
  // Birthday gift (+1000 coins, once per year on the player's birthday).
  birthdayRewardYear: number;
  claimBirthdayReward: () => void;
  recordSession: (minutes: number) => void;
  petCompanion: () => void;
  addMoodEntry: (entry: Omit<MoodEntry, 'id'>) => void;
  addExam: (exam: Omit<ExamCountdown, 'id'>) => string | null;
  removeExam: (id: string) => void;
  updateExam: (id: string, patch: Partial<Omit<ExamCountdown, 'id'>>) => void;
  setReminder: (enabled: boolean, time: string) => void;
  setUse24HourTime: (value: boolean) => void;
  setSoundEffectsEnabled: (value: boolean) => void;
  setVinylColor: (value: string) => void;
  updateStreak: (opts?: { rescueWithFreeze?: boolean }) => {
    bonus: number;
    isComeback: boolean;
    rescued: boolean;
  };

  // Wave 2 subject actions
  addSubject: (name: string, color: string, emoji?: string) => boolean;
  renameSubject: (id: string, name: string) => void;
  archiveSubject: (id: string) => void;
  deleteSubject: (id: string) => void;
  reorderSubjects: (orderedIds: string[]) => void;

  // Wave 2 task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'postponeCount' | 'lastActivityAt' | 'notifId'>) => string;
  updateTask: (id: string, patch: Partial<Pick<Task, 'title' | 'subjectId' | 'dueDate' | 'dueTime' | 'estimatedMinutes' | 'priority' | 'status' | 'notifyAt' | 'notifId' | 'repeatDays' | 'repeatUntil'>>) => void;
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
  }) => void;
  clearActiveSession: () => void;
  /** Pushes the active session's start forward by `seconds` (pause-for-break). */
  shiftSessionStart: (seconds: number) => void;

  // Wave 2 skip nudge
  incrementSkipSubjectCount: () => void;
  resetSkipSubjectCount: () => void;

  // Wave 2 shop
  purchaseShopItem: (itemId: string, price: number) => boolean;
  equipShopItem: (itemId: string) => boolean;

  // Wave 4 actions
  setIsPlus: (value: boolean, plan?: 'monthly' | 'annual', untilOverride?: string) => void;
  useStreakFreeze: () => boolean;
  saveTimerPreset: (preset: Omit<TimerPreset, 'id'>) => void;
  deleteTimerPreset: (id: string) => void;
  saveBreakPreset: (preset: Omit<TimerPreset, 'id'>) => void;
  deleteBreakPreset: (id: string) => void;
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
  updateAdvancedExam: (examId: string, fields: AdvancedExamFields) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { initialized: authInitialized, session } = useAuth();
  const [s, setS] = useState<PersistedState>(DEFAULTS);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  // Unread DM counts keyed by the sender's friend code. In-memory only — it's
  // derived from the server (fetched on focus, bumped by live inbox pings).
  const [dmUnread, setDmUnreadState] = useState<Record<string, number>>({});
  // Recipe id whose badge was just earned — drives the transient home progress
  // popup. In-memory only (auto-dismisses after a few seconds).
  const [recipeBadgePending, setRecipeBadgePending] = useState<string | null>(null);
  const [characterObtainedPending, setCharacterObtainedPending] = useState<string | null>(null);
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
      }

      if (!mounted) return;

      // Couldn't read local AND no usable cloud copy → leave saving disabled
      // (loadedScopeKey unset) so we never overwrite recoverable data.
      if (localFailed && !saved) {
        console.warn('[persist] could not load saved state; saving paused to protect existing data');
        return;
      }

      const normalized = normalizePersistedState(saved);
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

  // Streak-protection nudges: if the player doesn't OPEN the app on a given day, send
  // up to 2 spaced-out reminders that day to come back before their streak resets at
  // midnight. Resynced on launch AND every foreground — each open reschedules for the
  // next few days only (never today, since opening = they've shown up), so a nudge
  // only ever fires on a day with no app open. Gated on having a streak to protect +
  // finished onboarding; read through a ref so foregrounds use the latest state/lang
  // without re-subscribing. Permission is never *requested* here (see notifications.ts).
  const streakNudgeEnabledRef = useRef(false);
  streakNudgeEnabledRef.current =
    loaded && (s.legalAccepted ?? false) && (s.starterChosen ?? false) && s.streak.currentStreak > 0;
  useEffect(() => {
    const sync = () =>
      void syncStreakReminders({
        enabled: streakNudgeEnabledRef.current,
        title: i18n.t('notifications.streakTitle'),
        afternoonBody: i18n.t('notifications.streakAfternoonBody'),
        eveningBody: i18n.t('notifications.streakEveningBody'),
      });
    if (loaded) sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [loaded]);

  // Free users: past-due exam countdowns auto-erase once the day is over, freeing
  // their slots. Plus users keep every countdown (even when "Past due"). Runs on
  // load and whenever the exam list or Plus status changes.
  useEffect(() => {
    if (!loaded) return;
    setS((prev) => {
      if (prev.isPlus) return prev;
      const today = todayISO();
      const kept = prev.examCountdowns.filter((e) => e.dateISO >= today);
      return kept.length === prev.examCountdowns.length ? prev : { ...prev, examCountdowns: kept };
    });
  }, [loaded, s.isPlus, s.examCountdowns]);

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
    const timer = setTimeout(() => {
      uploadProfile(userId, {
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
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    loaded, session?.user.id, s.friendCode,
    s.profileDisplayName, s.profileDescription, s.profileBirthday, s.profileBackgroundId,
    s.profileAvatarFrame, s.profileCardColor,
    s.profileCompanionId, s.profileSkinId, s.activeCompanionId, s.bunSkinId, s.companionSkins,
    s.streak.currentStreak, s.streak.longestStreak, s.totalMinutes,
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

  const addCoins = (amount: number) => {
    setS((prev) => {
      const today = todayISO();
      const isNewDay = prev.earnedDate !== today;
      const basedToday = isNewDay ? 0 : prev.earnedToday;
      const remaining = Math.max(0, DAILY_EARN_CAP - basedToday);
      const actualAdd = Math.min(amount, remaining);
      return {
        ...prev,
        coins: prev.coins + actualAdd,
        earnedToday: basedToday + actualAdd,
        earnedDate: today,
      };
    });
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
      // But if the streak is still rescuable by a freeze, DON'T let the login reward
      // reset it — leave it untouched so the session-complete freeze prompt can save
      // it. Pay out the preserved streak day; the streak isn't advanced today.
      const rescuePending = streakRescueAvailable(prev, today);
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
        coins: prev.coins + payout,
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
        coins: prev.coins + BIRTHDAY_REWARD_COINS,
        birthdayRewardYear: realBirthday ? year : prev.birthdayRewardYear,
      };
    });
  };

  const recordSession = (minutes: number) =>
    setS((prev) => {
      const today = todayISO();
      const bondToday = prev.companionBondDate === today ? prev.companionBondToday : 0;
      // Daily bond ceiling mirrors the coin earn cap (max coins/day ÷ coins/min), so
      // levels can't be ground out in a single day. DAILY_EARN_CAP=500, /2 → 250 min.
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

  // Petting the companion on the home screen: a tiny daily-capped bond nudge toward the
  // active companion's level (flavour, not a grind — at most a few bond/day).
  const petCompanion = () =>
    setS((prev) => {
      const today = todayISO();
      const petToday = prev.petBondDate === today ? prev.petBondToday : 0;
      const PET_BOND = 1;
      const PET_DAILY_CAP = 5;
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

  // Record a FULLY-COMPLETED study session toward daily quests + achievements.
  // Called only from the two real-completion funnels (solo session-complete and the
  // multiplayer finish), deliberately NOT from recordSession — early-ended sessions
  // go through recordSession too but pay no coins, so they must not advance quests.
  const recordQuestSession = ({ minutes, withFriend }: { minutes: number; withFriend?: boolean }) =>
    setS((prev) => {
      const today = todayISO();
      const q = rolledQuests(prev.quests, today);
      const beforeNoon = hourInTimeZone(new Date(), activeTimezone) < 12;
      return {
        ...prev,
        quests: {
          ...q,
          sessionsToday: q.sessionsToday + 1,
          minutesToday: q.minutesToday + minutes,
          beforeNoonMinutesToday: q.beforeNoonMinutesToday + (beforeNoon ? minutes : 0),
          friendSessionsToday: q.friendSessionsToday + (withFriend ? 1 : 0),
        },
        lifetimeFriendSessions: prev.lifetimeFriendSessions + (withFriend ? 1 : 0),
      };
    });

  // Claim a completed daily quest's bonus coins. Guards: it's one of today's three,
  // its goal is met, and it isn't already claimed today. Coins are added directly
  // (bypassing DAILY_EARN_CAP), like the login/birthday rewards.
  const claimQuestReward = (id: string) =>
    setS((prev) => {
      const today = todayISO();
      const q = rolledQuests(prev.quests, today);
      if (!dailyGoalIds().includes(id) || q.claimedToday.includes(id)) return { ...prev, quests: q };
      const def = getQuest(id);
      if (!def || (q as any)[def.statKey] < def.goal) return { ...prev, quests: q };
      return {
        ...prev,
        coins: prev.coins + def.reward,
        quests: { ...q, claimedToday: [...q.claimedToday, id] },
      };
    });

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
        coins: prev.coins + def.reward,
        claimedAchievements: [...prev.claimedAchievements, id],
      };
    });

  const addMoodEntry = (entry: Omit<MoodEntry, 'id'>) =>
    setS((prev) => ({
      ...prev,
      moodEntries: [{ ...entry, id: uid() }, ...prev.moodEntries].slice(0, MAX_MOOD_ENTRIES),
    }));

  const addExam = (exam: Omit<ExamCountdown, 'id'>): string | null => {
    const newId = uid();
    let added = false;
    setS((prev) => {
      const examCap = prev.isPlus ? MAX_EXAMS_PLUS : FREE_EXAM_LIMIT;
      if (prev.examCountdowns.length >= examCap) return prev;
      added = true;
      return {
        ...prev,
        examCountdowns: [...prev.examCountdowns, { ...exam, id: newId }],
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
  const updateExam = (id: string, patch: Partial<Omit<ExamCountdown, 'id'>>) =>
    setS((prev) => ({
      ...prev,
      examCountdowns: prev.examCountdowns.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const setReminder = (enabled: boolean, time: string) =>
    setS((prev) => ({ ...prev, reminderEnabled: enabled, reminderTime: time }));

  const setUse24HourTime = (value: boolean) =>
    setS((prev) => ({ ...prev, use24HourTime: value }));

  const setSoundEffectsEnabled = (value: boolean) =>
    setS((prev) => ({ ...prev, soundEffectsEnabled: value }));
  const setVinylColor = (value: string) =>
    setS((prev) => ({ ...prev, vinylColor: value }));

  const updateProfile = (patch: Partial<{
    displayName: string;
    description: string;
    birthday: string;
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
  // that lapsed 1–3 days ago (the session-complete "keep your streak?" prompt).
  const updateStreak = (
    opts?: { rescueWithFreeze?: boolean },
  ): { bonus: number; isComeback: boolean; rescued: boolean } => {
    const today = todayISO();
    const canRescue = !!opts?.rescueWithFreeze && s.isPlus && s.streakFreezes > 0;
    // Compute synchronously from current state for the return value (the setS
    // updater below runs later, so reading its result there would be too late).
    const result = nextStreakState(s.streak, today, canRescue);

    if (result.changed) {
      setS((prev) => {
        // Recompute against `prev` to stay correct under React batching.
        const prevCanRescue = !!opts?.rescueWithFreeze && prev.isPlus && prev.streakFreezes > 0;
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
          coins: prev.coins + (prev.isPlus ? r.next * 2 : r.next),
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
    const limit = s.isPlus ? MAX_SUBJECTS_PLUS : MAX_SUBJECTS_FREE;
    if (s.subjects.filter((sub) => !sub.archived).length >= limit) return false;
    setS((prev) => {
      const activeCount = prev.subjects.filter((sub) => !sub.archived).length;
      if (activeCount >= (prev.isPlus ? MAX_SUBJECTS_PLUS : MAX_SUBJECTS_FREE)) return prev;
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

  const updateTask = (id: string, patch: Partial<Pick<Task, 'title' | 'subjectId' | 'dueDate' | 'dueTime' | 'estimatedMinutes' | 'priority' | 'status' | 'notifyAt' | 'notifId' | 'repeatDays' | 'repeatUntil'>>) =>
    setS((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, ...patch, lastActivityAt: new Date().toISOString() } : t,
      ),
    }));

  const deleteTask = (id: string) =>
    setS((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));

  const completeTask = (id: string) => {
    const now = new Date().toISOString();

    setS((prev) => {
      const task = prev.tasks.find((t) => t.id === id);
      if (!task || task.status === 'done') return prev;

      // Both a one-off completion AND a repeating task's roll-forward count as a
      // completion toward quests/achievements (repeating tasks never reach 'done',
      // so deriving the count from the task list would miss them).
      const today = todayISO();
      const q = rolledQuests(prev.quests, today);
      const questBump = {
        quests: { ...q, tasksToday: q.tasksToday + 1 },
        lifetimeTasksCompleted: prev.lifetimeTasksCompleted + 1,
      };

      // Repeating task: instead of marking done, roll its due date forward to the
      // next selected weekday and reset it to not-started so it recurs.
      const rollover = computeTaskRollover(task);
      if (rollover) {
        return {
          ...prev,
          ...questBump,
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
        ...questBump,
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
    const record: SessionRecord = { dateISO: todayISO(), minutes, subjectName };
    setS((prev) => ({
      ...prev,
      subjectTimeMap: {
        ...prev.subjectTimeMap,
        [key]: (prev.subjectTimeMap[key] ?? 0) + minutes,
      },
      sessionHistory: [record, ...prev.sessionHistory].slice(0, 1000),
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
  }: {
    durationMinutes: number;
    subjectName: string | null;
    taskId: string | null;
    taskTitle: string | null;
    startedAt?: string;
    isMultiplayer?: boolean;
    breakMinutes?: number;
  }) => {
    setActiveSession({
      id: uid(),
      durationMinutes,
      subjectName,
      taskId,
      taskTitle,
      startedAt: startedAt ?? new Date().toISOString(),
      isMultiplayer,
      breakMinutes,
    });
  };

  const clearActiveSession = () => {
    setActiveSession(null);
  };

  // Push the session's start time forward by `seconds` — used to pause the timer
  // during a break (the displayed countdown is frozen meanwhile).
  const shiftSessionStart = (seconds: number) => {
    setActiveSession((prev) =>
      prev ? { ...prev, startedAt: new Date(new Date(prev.startedAt).getTime() + seconds * 1000).toISOString() } : prev,
    );
  };

  // ─── Wave 2 skip nudge ────────────────────────────────────────────────────

  const incrementSkipSubjectCount = () =>
    setS((prev) => ({ ...prev, skipSubjectCount: prev.skipSubjectCount + 1 }));

  const resetSkipSubjectCount = () =>
    setS((prev) => ({ ...prev, skipSubjectCount: 0 }));

  // ─── Wave 4 actions ───────────────────────────────────────────────────────

  const setIsPlus = (value: boolean, plan: 'monthly' | 'annual' = 'monthly', untilOverride?: string) => {
    const month = new Date().toISOString().slice(0, 7);
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
      }
      if (value && prev.aiTicketsResetMonth !== month) {
        updates.aiTickets = 3;
        updates.aiTicketsResetMonth = month;
      }
      // Plus exclusive: getting Plus grants the Berry Princess Bun skin and the
      // Strawberry Palace room for free. Both are kept even if Plus later lapses.
      if (value) {
        const granted = prev.ownedShopItems;
        const toGrant = ['outfit_bun_strawberry', 'bg_strawberry_palace', 'desk_strawberry'].filter((id) => !granted.includes(id));
        if (toGrant.length) updates.ownedShopItems = [...granted, ...toGrant];
      }
      return { ...prev, ...updates };
    });
  };

  // A freeze rescues a streak missed for up to 3 days (daysBetween 2–4). One freeze
  // bridges the whole gap to yesterday, so studying today continues the streak.
  const canFreezeGap = (gap: number) => gap >= 2 && gap <= 4;

  const useStreakFreeze = (): boolean => {
    if (!s.isPlus || s.streakFreezes <= 0) return false;
    const { lastStudyDate } = s.streak;
    if (!lastStudyDate || !canFreezeGap(daysBetween(lastStudyDate, todayISO()))) return false;

    setS((prev) => {
      if (!prev.isPlus || prev.streakFreezes <= 0) return prev;
      const { lastStudyDate: last } = prev.streak;
      if (!last || !canFreezeGap(daysBetween(last, todayISO()))) return prev;
      return {
        ...prev,
        streakFreezes: prev.streakFreezes - 1,
        // Bridge exactly one missed day; no coins awarded.
        streak: { ...prev.streak, lastStudyDate: yesterdayISO() },
      };
    });
    return true;
  };

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

  const saveBreakPreset = (preset: Omit<TimerPreset, 'id'>) =>
    setS((prev) => ({
      ...prev,
      savedBreakPresets: [{ ...preset, label: maskProfanity(preset.label), id: uid() }, ...prev.savedBreakPresets].slice(0, MAX_TIMER_PRESETS),
    }));

  const deleteBreakPreset = (id: string) =>
    setS((prev) => ({
      ...prev,
      savedBreakPresets: prev.savedBreakPresets.filter((p) => p.id !== id),
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
    setS((prev) => ({
      ...prev,
      starterCompanionId: activeId,
      starterChosen: true,
      activeCompanionId: activeId,
      defaultCompanionId: 'girl',
      ownedShopItems: prev.ownedShopItems.includes(shopItemId)
        ? prev.ownedShopItems
        : [...prev.ownedShopItems, shopItemId],
    }));
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
      coins: prev.coins + amount,
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
  const devTriggerHanjiUnlock = () => {
    setS((prev) => ({ ...prev, hanjiUnlockPending: true }));
    setRecipeBadgePending('berry-croissant');
  };
  const clearRecipeBadge = () => setRecipeBadgePending(null);
  const clearCharacterObtained = () => setCharacterObtainedPending(null);

  // TEST/PLACEHOLDER: wipe game progress + purchases WITHOUT erasing the account.
  // The user stays signed in and fully onboarded (legal/birthday/starter all kept),
  // so we DON'T drop back into the onboarding flow. Everything owned/equipped —
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
      legalAccepted: prev.legalAccepted,
      birthday: prev.birthday,
      timezone: prev.timezone,
      // Profile text identity (display name/bio/birthday) is part of the account.
      profileDisplayName: prev.profileDisplayName,
      profileDescription: prev.profileDescription,
      profileBirthday: prev.profileBirthday,
      // Already past the starter chooser — don't re-prompt; defaults give them Bun.
      starterChosen: true,
      // Already-onboarded account — don't replay the first-launch coachmark tour.
      tutorialSeen: prev.tutorialSeen,
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

  const setMultipleReminders = (reminders: ReminderEntry[]) =>
    setS((prev) => ({ ...prev, multipleReminders: reminders }));

  const updateAdvancedExam = (examId: string, fields: AdvancedExamFields) =>
    setS((prev) => ({
      ...prev,
      advancedExamMap: { ...prev.advancedExamMap, [examId]: fields },
    }));

  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setS((prev) => ({ ...prev, language: lang }));
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
        : { ...prev, instagramFollowClaimed: true, coins: prev.coins + 100 },
    );

  const setBirthday = (iso: string) =>
    setS((prev) => ({ ...prev, birthday: iso }));

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
        moodEntries: s.moodEntries,
        examCountdowns: s.examCountdowns,
        reminderEnabled: s.reminderEnabled,
        reminderTime: s.reminderTime,
        use24HourTime: s.use24HourTime,
        soundEffectsEnabled: s.soundEffectsEnabled,
        vinylColor: s.vinylColor,
        streak: s.streak,
        // Today's streak day = what the streak counts *as of today* (the login day),
        // even before the user has claimed/studied. So a fresh login shows day 1, a
        // continued one shows N+1, and a lapsed one shows 1 — the chip never sits at
        // a stale number while you're looking at it.
        todayStreakDay: streakRescueAvailable(s, todayISO()) ? s.streak.currentStreak : nextStreakState(s.streak, todayISO()).next,
        earnedToday: s.earnedDate === todayISO() ? s.earnedToday : 0,
        loginStreak: s.loginStreak,
        loginRewardDate: s.loginRewardDate,
        // Always hand the screen today's counters (reset at midnight) so progress
        // never reads stale before the next study/task event rolls it over.
        quests: rolledQuests(s.quests, todayISO()),
        lifetimeTasksCompleted: s.lifetimeTasksCompleted,
        lifetimeFriendSessions: s.lifetimeFriendSessions,
        claimedAchievements: s.claimedAchievements,
        recordQuestSession,
        claimQuestReward,
        claimAchievement,
        birthdayRewardYear: s.birthdayRewardYear ?? 0,
        subjects: s.subjects,
        tasks: s.tasks,
        ownedShopItems: s.ownedShopItems,
        equippedShopItems: s.equippedShopItems,
        subjectTimeMap: s.subjectTimeMap,
        skipSubjectCount: s.skipSubjectCount,
        sessionHistory: s.sessionHistory,
        companionMinutes: s.companionMinutes ?? {},
        activeSession,
        addCoins,
        claimLoginReward,
        claimBirthdayReward,
        recordSession,
        petCompanion,
        addMoodEntry,
        addExam,
        removeExam,
        updateExam,
        setReminder,
        setUse24HourTime,
        setSoundEffectsEnabled,
        setVinylColor,
        updateStreak,
        addSubject,
        renameSubject,
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
        shiftSessionStart,
        incrementSkipSubjectCount,
        resetSkipSubjectCount,
        purchaseShopItem,
        equipShopItem,
        // Wave 4
        isPlus: s.isPlus,
        plusPlan: s.plusPlan,
        plusUntil: s.plusUntil,
        streakFreezes: s.streakFreezes,
        savedTimerPresets: s.savedTimerPresets,
        savedBreakPresets: s.savedBreakPresets,
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
        chatMessages: s.chatMessages,
        dailyChatRemaining: s.isPlus
          ? Math.max(0, PLUS_DAILY_CHAT - (s.chatFreeDate === todayISO() ? s.chatFreeUsedToday : 0))
          : 0,
        chatThread: s.chatThread,
        purchasedCoins: s.purchasedCoins,
        multipleReminders: s.multipleReminders,
        advancedExamMap: s.advancedExamMap,
        selectedFoodId: s.selectedFoodId ?? 'strawberry-shortcake',
        madeFoods: s.madeFoods ?? [],
        bakedWith: s.bakedWith ?? [],
        setSelectedFood,
        markFoodMade,
        hanjiUnlockPending: s.hanjiUnlockPending ?? false,
        clearHanjiUnlock,
        devTriggerHanjiUnlock,
        recipeBadgePending,
        clearRecipeBadge,
        characterObtainedPending,
        clearCharacterObtained,
        persistedStateReady,
        resetAccountForAbandonedOnboarding,
        resetGameData,
        dayNotes: s.dayNotes ?? {},
        setDayNote,
        friendCode: s.friendCode,
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
        setIsPlus,
        useStreakFreeze,
        saveTimerPreset,
        deleteTimerPreset,
        saveBreakPreset,
        deleteBreakPreset,
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
        updateAdvancedExam,
        language: s.language ?? 'en',
        languageSelected: s.languageSelected ?? false,
        legalAccepted: s.legalAccepted ?? false,
        tutorialSeen: s.tutorialSeen ?? false,
        instagramFollowClaimed: s.instagramFollowClaimed ?? false,
        birthday: s.birthday ?? null,
        setLanguage,
        markLanguageSelected,
        markLegalAccepted,
        markTutorialSeen,
        replayTutorial,
        claimInstagramFollow,
        setBirthday,
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
