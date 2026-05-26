import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { DAILY_EARN_CAP, STATIC_SUBJECTS } from '@/constants/placeholder-data';
import { SHOP_ITEMS, type ShopCategory } from '@/constants/shop-data';
import { useAuth } from '@/context/auth-context';
import { getAppStateScope, loadScopedAppState, saveScopedAppState } from '@/lib/app-state-repository';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  estimatedMinutes: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  postponeCount: number;
  lastActivityAt: string | null;
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

export type DefaultCompanionId = 'girl' | 'dude';

export type CompanionSlot = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  isGenerated: boolean;
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
  companionSlots: CompanionSlot[];
  aiTickets: number;
  aiTicketsResetMonth: string;
  purchasedCoins: number;
  multipleReminders: ReminderEntry[];
  advancedExamMap: Record<string, AdvancedExamFields>;
};

const DEFAULTS: PersistedState = {
  coins: 0,
  sessionsCompleted: 0,
  totalMinutes: 0,
  moodEntries: [],
  examCountdowns: [],
  reminderEnabled: false,
  reminderTime: '20:00',
  streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: null },
  earnedToday: 0,
  earnedDate: '',
  subjects: INITIAL_SUBJECTS,
  tasks: [],
  ownedShopItems: [],
  equippedShopItems: {
    decoration: null,
    outfit: null,
    theme: null,
    pose: null,
    reminder: null,
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
  companionSlots: [],
  aiTickets: 0,
  aiTicketsResetMonth: '',
  purchasedCoins: 0,
  multipleReminders: [],
  advancedExamMap: {},
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
    return DEFAULTS;
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

  merged.equippedShopItems = {
    ...DEFAULTS.equippedShopItems,
    ...(merged.equippedShopItems ?? {}),
  };

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
  companionSlots: CompanionSlot[];
  aiTickets: number;
  purchasedCoins: number;
  multipleReminders: ReminderEntry[];
  advancedExamMap: Record<string, AdvancedExamFields>;

  // Wave 1 actions
  addCoins: (amount: number) => void;
  recordSession: (minutes: number) => void;
  addMoodEntry: (entry: Omit<MoodEntry, 'id'>) => void;
  addExam: (exam: Omit<ExamCountdown, 'id'>) => string | null;
  removeExam: (id: string) => void;
  setReminder: (enabled: boolean, time: string) => void;
  updateStreak: () => { bonus: number; isComeback: boolean };

  // Wave 2 subject actions
  addSubject: (name: string, color: string, emoji?: string) => void;
  renameSubject: (id: string, name: string) => void;
  archiveSubject: (id: string) => void;
  deleteSubject: (id: string) => void;
  reorderSubjects: (orderedIds: string[]) => void;

  // Wave 2 task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'postponeCount' | 'lastActivityAt'>) => void;
  updateTask: (id: string, patch: Partial<Pick<Task, 'title' | 'subjectId' | 'dueDate' | 'estimatedMinutes' | 'priority' | 'status'>>) => void;
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
  saveCompanionSlot: (slot: Omit<CompanionSlot, 'id'>) => void;
  deleteCompanionSlot: (id: string) => void;
  consumeAiTicket: () => boolean;
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
        setS(normalizePersistedState(saved));
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

  const updateStreak = (): { bonus: number; isComeback: boolean } => {
    let bonus = 0;
    let isComeback = false;

    setS((prev) => {
      const today = todayISO();
      const { streak: st } = prev;

      if (!st.lastStudyDate) {
        return { ...prev, streak: { currentStreak: 1, longestStreak: 1, lastStudyDate: today } };
      }

      const diff = daysBetween(st.lastStudyDate, today);
      if (diff === 0) return prev;

      const applyBonus = (amount: number) => {
        const isNewDay = prev.earnedDate !== today;
        const basedToday = isNewDay ? 0 : prev.earnedToday;
        const remaining = Math.max(0, DAILY_EARN_CAP - basedToday);
        const actual = Math.min(amount, remaining);
        return {
          coins: prev.coins + actual,
          earnedToday: basedToday + actual,
          earnedDate: today,
        };
      };

      if (diff === 1) {
        const next = st.currentStreak + 1;
        if (next === 3) bonus = 30;
        else if (next === 7) bonus = 80;
        return {
          ...prev,
          streak: { currentStreak: next, longestStreak: Math.max(st.longestStreak, next), lastStudyDate: today },
          ...applyBonus(bonus),
        };
      }

      isComeback = diff >= 3;
      const comebackBonus = isComeback ? 50 : 0;
      bonus = comebackBonus;
      return {
        ...prev,
        streak: { currentStreak: 1, longestStreak: st.longestStreak, lastStudyDate: today },
        ...applyBonus(comebackBonus),
      };
    });

    return { bonus, isComeback };
  };

  // ─── Wave 2 subject actions ───────────────────────────────────────────────

  const addSubject = (name: string, color: string, emoji = '') => {
    setS((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        { id: uid(), name, color, emoji, archived: false, order: prev.subjects.length },
      ],
    }));
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

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'postponeCount' | 'lastActivityAt'>) =>
    setS((prev) => ({
      ...prev,
      tasks: [
        {
          ...task,
          id: uid(),
          createdAt: new Date().toISOString(),
          completedAt: null,
          postponeCount: 0,
          lastActivityAt: null,
        },
        ...prev.tasks,
      ],
    }));

  const updateTask = (id: string, patch: Partial<Pick<Task, 'title' | 'subjectId' | 'dueDate' | 'estimatedMinutes' | 'priority' | 'status'>>) =>
    setS((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, ...patch, lastActivityAt: new Date().toISOString() } : t,
      ),
    }));

  const deleteTask = (id: string) =>
    setS((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));

  const completeTask = (id: string) => {
    if (!s.tasks.find((t) => t.id === id && t.status !== 'done')) return;
    const now = new Date().toISOString();
    const today = todayISO();

    setS((prev) => {
      const task = prev.tasks.find((t) => t.id === id);
      if (!task || task.status === 'done') return prev;

      const isNewDay = prev.earnedDate !== today;
      const basedToday = isNewDay ? 0 : prev.earnedToday;
      const remaining = Math.max(0, DAILY_EARN_CAP - basedToday);
      const actualAdd = Math.min(10, remaining);

      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id
            ? { ...t, status: 'done' as TaskStatus, completedAt: now, lastActivityAt: now }
            : t,
        ),
        coins: prev.coins + actualAdd,
        earnedToday: basedToday + actualAdd,
        earnedDate: today,
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
  }: {
    durationMinutes: number;
    subjectName: string | null;
    taskId: string | null;
    taskTitle: string | null;
  }) => {
    setActiveSession({
      id: uid(),
      durationMinutes,
      subjectName,
      taskId,
      taskTitle,
      startedAt: new Date().toISOString(),
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

  const saveTimerPreset = (preset: Omit<TimerPreset, 'id'>) =>
    setS((prev) => ({
      ...prev,
      savedTimerPresets: [...prev.savedTimerPresets, { ...preset, id: uid() }],
    }));

  const deleteTimerPreset = (id: string) =>
    setS((prev) => ({
      ...prev,
      savedTimerPresets: prev.savedTimerPresets.filter((p) => p.id !== id),
    }));

  const saveBreakPreset = (preset: Omit<TimerPreset, 'id'>) =>
    setS((prev) => ({
      ...prev,
      savedBreakPresets: [...prev.savedBreakPresets, { ...preset, id: uid() }],
    }));

  const deleteBreakPreset = (id: string) =>
    setS((prev) => ({
      ...prev,
      savedBreakPresets: prev.savedBreakPresets.filter((p) => p.id !== id),
    }));

  const setAmbience = (id: string | null) =>
    setS((prev) => ({ ...prev, ambienceId: id }));

  const setDefaultCompanion = (id: DefaultCompanionId) =>
    setS((prev) => ({ ...prev, defaultCompanionId: id }));

  const saveCompanionSlot = (slot: Omit<CompanionSlot, 'id'>) =>
    setS((prev) => {
      if (!prev.isPlus || prev.companionSlots.length >= MAX_COMPANION_SLOTS) return prev;
      return {
        ...prev,
        companionSlots: [...prev.companionSlots, { ...slot, id: uid() }],
      };
    });

  const deleteCompanionSlot = (id: string) =>
    setS((prev) => ({
      ...prev,
      companionSlots: prev.companionSlots.filter((c) => c.id !== id),
    }));

  const consumeAiTicket = (): boolean => {
    if (!s.isPlus || s.aiTickets <= 0) return false;
    setS((prev) => {
      if (!prev.isPlus || prev.aiTickets <= 0) return prev;
      return { ...prev, aiTickets: prev.aiTickets - 1 };
    });
    return true;
  };

  const addPurchasedCoins = (amount: number) =>
    setS((prev) => ({
      ...prev,
      coins: prev.coins + amount,
      purchasedCoins: prev.purchasedCoins + amount,
    }));

  const setMultipleReminders = (reminders: ReminderEntry[]) =>
    setS((prev) => ({ ...prev, multipleReminders: reminders }));

  const updateAdvancedExam = (examId: string, fields: AdvancedExamFields) =>
    setS((prev) => ({
      ...prev,
      advancedExamMap: { ...prev.advancedExamMap, [examId]: fields },
    }));

  // ─── Wave 2 shop ─────────────────────────────────────────────────────────

  const purchaseShopItem = (itemId: string, price: number): boolean => {
    const item = getShopItem(itemId);
    if (!item || s.ownedShopItems.includes(itemId) || s.coins < price) return false;
    setS((prev) => {
      if (prev.ownedShopItems.includes(itemId) || prev.coins < price) return prev;

      const nextState: PersistedState = {
        ...prev,
        coins: prev.coins - price,
        ownedShopItems: [...prev.ownedShopItems, itemId],
      };

      if (item.category !== 'game') {
        nextState.equippedShopItems = {
          ...prev.equippedShopItems,
          [item.category]: itemId,
        };
      }

      return nextState;
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
        companionSlots: s.companionSlots,
        aiTickets: s.aiTickets,
        purchasedCoins: s.purchasedCoins,
        multipleReminders: s.multipleReminders,
        advancedExamMap: s.advancedExamMap,
        setIsPlus,
        useStreakFreeze,
        saveTimerPreset,
        deleteTimerPreset,
        saveBreakPreset,
        deleteBreakPreset,
        setAmbience,
        setDefaultCompanion,
        saveCompanionSlot,
        deleteCompanionSlot,
        consumeAiTicket,
        addPurchasedCoins,
        setMultipleReminders,
        updateAdvancedExam,
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
