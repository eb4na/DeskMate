import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n';
import { DAILY_EARN_CAP, STATIC_SUBJECTS } from '@/constants/placeholder-data';
import { SHOP_ITEMS, type ShopCategory } from '@/constants/shop-data';
import { useAuth } from '@/context/auth-context';
import { getAppStateScope, loadScopedAppState, saveScopedAppState } from '@/lib/app-state-repository';
import { getEffectiveBunSkinId, getEffectiveCompanionSkins } from '@/lib/companion-utils';

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
  streak: StreakData;
  earnedToday: number;
  earnedDate: string;
  // Wave 2
  subjects: Subject[];
  tasks: Task[];
  ownedShopItems: string[];
  equippedShopItems: EquippedShopItems;
  subjectTimeMap: Record<string, number>;
  skipSubjectCount: number;
  sessionHistory: SessionRecord[];
  // Wave 4
  isPlus: boolean;
  streakFreezes: number;
  streakFreezeResetMonth: string;
  savedTimerPresets: TimerPreset[];
  savedBreakPresets: TimerPreset[];
  ambienceId: string | null;
  defaultCompanionId: DefaultCompanionId;
  activeCompanionId: ActiveCompanionId;
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
  profileCompanionId: string; // chosen character for the card ('' = use active)
  profileSkinId: string; // chosen outfit/skin for that character

  // Cake Kitchen mini-game best scores + chosen character
  cakeBestRush: number;
  cakeBestLine: number;
  cakeCharacter: string;

  // i18n
  language: string;
  languageSelected: boolean;
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
  coins: 0,
  sessionsCompleted: 0,
  totalMinutes: 0,
  moodEntries: [],
  examCountdowns: [],
  reminderEnabled: false,
  reminderTime: '20:00',
  use24HourTime: false,
  streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: null },
  earnedToday: 0,
  earnedDate: '',
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
  // Wave 4
  isPlus: false,
  streakFreezes: 3,
  streakFreezeResetMonth: '',
  savedTimerPresets: [],
  savedBreakPresets: [],
  ambienceId: null,
  defaultCompanionId: 'girl',
  activeCompanionId: 'starter:girl',
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
  dayNotes: {},
  friendCode: '',
  friends: [],
  profileDisplayName: '',
  profileDescription: '',
  profileBirthday: '',
  profileBackgroundId: 'cozy',
  profileCompanionId: '',
  profileSkinId: 'classic',
  cakeBestRush: 0,
  cakeBestLine: 0,
  cakeCharacter: 'bun',
  language: 'en',
  languageSelected: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

const MAX_COMPANION_SLOTS = 3;
const FREE_EXAM_LIMIT = 3;
const STREAK_MAX = 200; // study-day streak caps here

function daysBetween(a: string, b: string): number {
  const msA = new Date(a).setHours(0, 0, 0, 0);
  const msB = new Date(b).setHours(0, 0, 0, 0);
  return Math.round((msB - msA) / 86400000);
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getShopItem(itemId: string) {
  return SHOP_ITEMS.find((item) => item.id === itemId) ?? null;
}

function normalizePersistedState(saved?: Partial<PersistedState> | null): PersistedState {
  if (!saved) {
    return { ...DEFAULTS, friendCode: generateFriendCode() };
  }

  const month = new Date().toISOString().slice(0, 7);
  const merged = { ...saved };

  if (!merged.streakFreezeResetMonth || merged.streakFreezeResetMonth < month) {
    merged.streakFreezes = 3;
    merged.streakFreezeResetMonth = month;
  }

  if (merged.isPlus && (!merged.aiTicketsResetMonth || merged.aiTicketsResetMonth < month)) {
    merged.aiTickets = 3;
    merged.aiTicketsResetMonth = month;
  }

  // Plus exclusive: ensure Plus members own Tira (covers players who had Plus
  // before she became a Plus perk).
  if (merged.isPlus && !(merged.ownedShopItems ?? []).includes('companion_tira')) {
    merged.ownedShopItems = [...(merged.ownedShopItems ?? []), 'companion_tira'];
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
  merged.activeCompanionId = activeCompanionExists
    ? activeCompanionId
    : `starter:${merged.defaultCompanionId ?? DEFAULTS.defaultCompanionId}`;

  // Give every user a stable friend code the first time.
  if (!merged.friendCode) merged.friendCode = generateFriendCode();

  return { ...DEFAULTS, ...merged };
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
  streak: StreakData;
  earnedToday: number;

  // Wave 2 state
  subjects: Subject[];
  tasks: Task[];
  ownedShopItems: string[];
  equippedShopItems: EquippedShopItems;
  subjectTimeMap: Record<string, number>;
  skipSubjectCount: number;
  sessionHistory: SessionRecord[];
  activeSession: ActiveSession | null;

  // Wave 4 state
  isPlus: boolean;
  streakFreezes: number;
  savedTimerPresets: TimerPreset[];
  savedBreakPresets: TimerPreset[];
  ambienceId: string | null;
  defaultCompanionId: DefaultCompanionId;
  activeCompanionId: ActiveCompanionId;
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
  selectedFoodId: string;
  madeFoods: string[];
  setSelectedFood: (id: string) => void;
  markFoodMade: (id: string) => void;
  dayNotes: Record<string, string>;
  setDayNote: (date: string, note: string) => void;
  friendCode: string;
  friends: Friend[];
  addFriend: (code: string) => { ok: boolean; error?: string };
  removeFriend: (code: string) => void;
  setFriendProfile: (code: string, data: Partial<Friend>) => void;
  profileDisplayName: string;
  profileDescription: string;
  profileBirthday: string;
  profileBackgroundId: string;
  profileCompanionId: string;
  profileSkinId: string;
  updateProfile: (patch: Partial<{
    displayName: string;
    description: string;
    birthday: string;
    backgroundId: string;
    companionId: string;
    skinId: string;
  }>) => void;
  cakeBestRush: number;
  cakeBestLine: number;
  cakeCharacter: string;
  setCakeCharacter: (id: string) => void;
  recordCakeBest: (mode: 'rush' | 'line', score: number) => void;
  setLanguage: (lang: string) => void;
  markLanguageSelected: () => void;

  // Wave 1 actions
  addCoins: (amount: number) => void;
  recordSession: (minutes: number) => void;
  addMoodEntry: (entry: Omit<MoodEntry, 'id'>) => void;
  addExam: (exam: Omit<ExamCountdown, 'id'>) => string | null;
  removeExam: (id: string) => void;
  setReminder: (enabled: boolean, time: string) => void;
  setUse24HourTime: (value: boolean) => void;
  updateStreak: () => { bonus: number; isComeback: boolean };

  // Wave 2 subject actions
  addSubject: (name: string, color: string, emoji?: string) => boolean;
  renameSubject: (id: string, name: string) => void;
  archiveSubject: (id: string) => void;
  deleteSubject: (id: string) => void;
  reorderSubjects: (orderedIds: string[]) => void;

  // Wave 2 task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'postponeCount' | 'lastActivityAt' | 'notifId'>) => string;
  updateTask: (id: string, patch: Partial<Pick<Task, 'title' | 'subjectId' | 'dueDate' | 'dueTime' | 'estimatedMinutes' | 'priority' | 'status' | 'notifyAt' | 'notifId'>>) => void;
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
  }) => void;
  clearActiveSession: () => void;

  // Wave 2 skip nudge
  incrementSkipSubjectCount: () => void;
  resetSkipSubjectCount: () => void;

  // Wave 2 shop
  purchaseShopItem: (itemId: string, price: number) => boolean;
  equipShopItem: (itemId: string) => boolean;

  // Wave 4 actions
  setIsPlus: (value: boolean) => void;
  useStreakFreeze: () => boolean;
  saveTimerPreset: (preset: Omit<TimerPreset, 'id'>) => void;
  deleteTimerPreset: (id: string) => void;
  saveBreakPreset: (preset: Omit<TimerPreset, 'id'>) => void;
  deleteBreakPreset: (id: string) => void;
  setAmbience: (id: string | null) => void;
  setDefaultCompanion: (id: DefaultCompanionId) => void;
  setActiveCompanion: (id: ActiveCompanionId) => void;
  setBunSkin: (skinId: string) => void;
  setCompanionSkin: (companionId: string, skinId: string) => void;
  setEquippedBackground: (roomId: string) => void;
  setEquippedDesk: (roomId: string) => void;
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
  const appStateScope = useMemo(() => getAppStateScope(session), [session]);

  useEffect(() => {
    if (!authInitialized) return;

    let mounted = true;
    setLoaded(false);
    setLoadedScopeKey(null);
    setActiveSession(null);

    loadScopedAppState<Partial<PersistedState>>(appStateScope)
      .then((saved) => {
        if (!mounted) return;
        const normalized = normalizePersistedState(saved);
        setS(normalized);
        if (normalized.language) i18n.changeLanguage(normalized.language);
        setLoadedScopeKey(appStateScope.storageKey);
      })
      .finally(() => {
        if (mounted) {
          setLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [appStateScope, authInitialized]);

  useEffect(() => {
    if (!loaded || loadedScopeKey !== appStateScope.storageKey) return;
    saveScopedAppState(appStateScope, s);
  }, [appStateScope, loaded, loadedScopeKey, s]);

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

  const recordSession = (minutes: number) =>
    setS((prev) => ({
      ...prev,
      sessionsCompleted: prev.sessionsCompleted + 1,
      totalMinutes: prev.totalMinutes + minutes,
    }));

  const addMoodEntry = (entry: Omit<MoodEntry, 'id'>) =>
    setS((prev) => ({
      ...prev,
      moodEntries: [{ ...entry, id: uid() }, ...prev.moodEntries],
    }));

  const addExam = (exam: Omit<ExamCountdown, 'id'>): string | null => {
    const newId = uid();
    let added = false;
    setS((prev) => {
      if (!prev.isPlus && prev.examCountdowns.length >= FREE_EXAM_LIMIT) return prev;
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

  const setReminder = (enabled: boolean, time: string) =>
    setS((prev) => ({ ...prev, reminderEnabled: enabled, reminderTime: time }));

  const setUse24HourTime = (value: boolean) =>
    setS((prev) => ({ ...prev, use24HourTime: value }));

  const updateProfile = (patch: Partial<{
    displayName: string;
    description: string;
    birthday: string;
    backgroundId: string;
    companionId: string;
    skinId: string;
  }>) =>
    setS((prev) => ({
      ...prev,
      ...(patch.displayName !== undefined ? { profileDisplayName: patch.displayName } : {}),
      ...(patch.description !== undefined ? { profileDescription: patch.description } : {}),
      ...(patch.birthday !== undefined ? { profileBirthday: patch.birthday } : {}),
      ...(patch.backgroundId !== undefined ? { profileBackgroundId: patch.backgroundId } : {}),
      ...(patch.companionId !== undefined ? { profileCompanionId: patch.companionId } : {}),
      ...(patch.skinId !== undefined ? { profileSkinId: patch.skinId } : {}),
    }));

  // Streak counts STUDY days only (called from session-complete). Each study day
  // rewards coins equal to the new streak number (1, 2, 3, … up to 200). Missing a
  // day resets the streak — today becomes day 1 again.
  const updateStreak = (): { bonus: number; isComeback: boolean } => {
    let bonus = 0;
    let isComeback = false;

    setS((prev) => {
      const today = todayISO();
      const { streak: st } = prev;

      // Advance to `next` day, award `next` coins (once per day, so not capped).
      const advance = (next: number) => {
        bonus = next;
        return {
          ...prev,
          streak: {
            currentStreak: next,
            longestStreak: Math.max(st.longestStreak, next),
            lastStudyDate: today,
          },
          coins: prev.coins + next,
        };
      };

      if (!st.lastStudyDate) return advance(1); // first study ever

      const diff = daysBetween(st.lastStudyDate, today);
      if (diff === 0) return prev; // already studied today

      if (diff === 1) return advance(Math.min(STREAK_MAX, st.currentStreak + 1)); // consecutive day

      // Missed a day → streak resets; today is day 1 of a fresh streak.
      isComeback = true;
      return advance(1);
    });

    return { bonus, isComeback };
  };

  // ─── Wave 2 subject actions ───────────────────────────────────────────────

  const addSubject = (name: string, color: string, emoji = ''): boolean => {
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
      subjects: prev.subjects.map((s) => (s.id === id ? { ...s, name } : s)),
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
    const id = uid();
    setS((prev) => ({
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
    }));
    return id;
  };

  const updateTask = (id: string, patch: Partial<Pick<Task, 'title' | 'subjectId' | 'dueDate' | 'dueTime' | 'estimatedMinutes' | 'priority' | 'status' | 'notifyAt' | 'notifId'>>) =>
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

      return {
        ...prev,
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
      sessionHistory: [record, ...prev.sessionHistory].slice(0, 90),
    }));
  };

  const startActiveSession = ({
    durationMinutes,
    subjectName,
    taskId,
    taskTitle,
    startedAt,
  }: {
    durationMinutes: number;
    subjectName: string | null;
    taskId: string | null;
    taskTitle: string | null;
    startedAt?: string;
  }) => {
    setActiveSession({
      id: uid(),
      durationMinutes,
      subjectName,
      taskId,
      taskTitle,
      startedAt: startedAt ?? new Date().toISOString(),
    });
  };

  const clearActiveSession = () => {
    setActiveSession(null);
  };

  // ─── Wave 2 skip nudge ────────────────────────────────────────────────────

  const incrementSkipSubjectCount = () =>
    setS((prev) => ({ ...prev, skipSubjectCount: prev.skipSubjectCount + 1 }));

  const resetSkipSubjectCount = () =>
    setS((prev) => ({ ...prev, skipSubjectCount: 0 }));

  // ─── Wave 4 actions ───────────────────────────────────────────────────────

  const setIsPlus = (value: boolean) => {
    const month = new Date().toISOString().slice(0, 7);
    setS((prev) => {
      const updates: Partial<PersistedState> = { isPlus: value };
      if (value && prev.aiTicketsResetMonth !== month) {
        updates.aiTickets = 3;
        updates.aiTicketsResetMonth = month;
      }
      // Plus exclusive: getting Plus grants Tira (the companion) for free. She is
      // kept even if Plus later lapses; her outfits must still be bought.
      if (value && !prev.ownedShopItems.includes('companion_tira')) {
        updates.ownedShopItems = [...prev.ownedShopItems, 'companion_tira'];
      }
      return { ...prev, ...updates };
    });
  };

  const useStreakFreeze = (): boolean => {
    if (!s.isPlus || s.streakFreezes <= 0) return false;
    const { lastStudyDate } = s.streak;
    if (!lastStudyDate || daysBetween(lastStudyDate, todayISO()) !== 2) return false;

    setS((prev) => {
      if (!prev.isPlus || prev.streakFreezes <= 0) return prev;
      const { lastStudyDate: last } = prev.streak;
      if (!last || daysBetween(last, todayISO()) !== 2) return prev;
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
      savedTimerPresets: [{ ...preset, id: uid() }, ...prev.savedTimerPresets].slice(0, MAX_TIMER_PRESETS),
    }));

  const deleteTimerPreset = (id: string) =>
    setS((prev) => ({
      ...prev,
      savedTimerPresets: prev.savedTimerPresets.filter((p) => p.id !== id),
    }));

  const saveBreakPreset = (preset: Omit<TimerPreset, 'id'>) =>
    setS((prev) => ({
      ...prev,
      savedBreakPresets: [{ ...preset, id: uid() }, ...prev.savedBreakPresets].slice(0, MAX_TIMER_PRESETS),
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
      activeCompanionId:
        prev.activeCompanionId === id ? `starter:${prev.defaultCompanionId}` : prev.activeCompanionId,
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

  const setSelectedFood = (id: string) =>
    setS((prev) => ({ ...prev, selectedFoodId: id }));

  const markFoodMade = (id: string) =>
    setS((prev) => ({
      ...prev,
      madeFoods: prev.madeFoods.includes(id) ? prev.madeFoods : [...prev.madeFoods, id],
    }));

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
    setS((prev) => ({
      ...prev,
      friends: [{ code, name: `Friend ${code}`, addedAt: new Date().toISOString() }, ...prev.friends],
    }));
    return { ok: true };
  };

  const removeFriend = (code: string) =>
    setS((prev) => ({ ...prev, friends: prev.friends.filter((f) => f.code !== code) }));

  const setFriendProfile = (code: string, data: Partial<Friend>) =>
    setS((prev) => ({
      ...prev,
      friends: prev.friends.map((f) => (f.code === code ? { ...f, ...data } : f)),
    }));

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

  // ─── Wave 2 shop ─────────────────────────────────────────────────────────

  const purchaseShopItem = (itemId: string, price: number): boolean => {
    const item = getShopItem(itemId);
    if (!item || s.ownedShopItems.includes(itemId) || s.coins < price) return false;
    setS((prev) => {
      if (prev.ownedShopItems.includes(itemId) || prev.coins < price) return prev;

      // Buying only marks an item owned — the player equips it separately.
      return {
        ...prev,
        coins: prev.coins - price,
        ownedShopItems: [...prev.ownedShopItems, itemId],
      };
    });
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
        streak: s.streak,
        earnedToday: s.earnedDate === todayISO() ? s.earnedToday : 0,
        subjects: s.subjects,
        tasks: s.tasks,
        ownedShopItems: s.ownedShopItems,
        equippedShopItems: s.equippedShopItems,
        subjectTimeMap: s.subjectTimeMap,
        skipSubjectCount: s.skipSubjectCount,
        sessionHistory: s.sessionHistory,
        activeSession,
        addCoins,
        recordSession,
        addMoodEntry,
        addExam,
        removeExam,
        setReminder,
        setUse24HourTime,
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
        incrementSkipSubjectCount,
        resetSkipSubjectCount,
        purchaseShopItem,
        equipShopItem,
        // Wave 4
        isPlus: s.isPlus,
        streakFreezes: s.streakFreezes,
        savedTimerPresets: s.savedTimerPresets,
        savedBreakPresets: s.savedBreakPresets,
        ambienceId: s.ambienceId,
        defaultCompanionId: s.defaultCompanionId,
        activeCompanionId: s.activeCompanionId,
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
        setSelectedFood,
        markFoodMade,
        dayNotes: s.dayNotes ?? {},
        setDayNote,
        friendCode: s.friendCode,
        friends: s.friends ?? [],
        addFriend,
        removeFriend,
        setFriendProfile,
        profileDisplayName: s.profileDisplayName ?? '',
        profileDescription: s.profileDescription ?? '',
        profileBirthday: s.profileBirthday ?? '',
        profileBackgroundId: s.profileBackgroundId ?? 'cozy',
        profileCompanionId: s.profileCompanionId ?? '',
        profileSkinId: s.profileSkinId ?? 'classic',
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
        setBunSkin,
        setCompanionSkin,
        setEquippedBackground,
        setEquippedDesk,
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
        setMultipleReminders,
        updateAdvancedExam,
        language: s.language ?? 'en',
        languageSelected: s.languageSelected ?? false,
        setLanguage,
        markLanguageSelected,
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
