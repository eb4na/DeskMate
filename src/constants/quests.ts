/**
 * Daily Goals + Achievements — declarative definitions.
 *
 * Both pay BONUS coins that bypass the daily earn cap (claimed via app-context
 * actions). Progress is read from compact counters kept in PersistedState: the
 * daily counters (reset at midnight in the account timezone) for goals, and the
 * lifetime stats for achievements. Display strings live in i18n under
 * `quests.items.<id>` / `achievements.items.<id>`.
 */
import { RECIPE_IDS } from '@/constants/recipes';

// ─── Daily goals ──────────────────────────────────────────────────────────────

/** Per-day counters a goal can be measured against (see PersistedState.quests). */
export type QuestStatKey =
  | 'sessionsToday'
  | 'minutesToday'
  | 'beforeNoonMinutesToday'
  | 'friendSessionsToday'
  | 'tasksToday';

export type QuestDef = {
  id: string;
  category: 'study' | 'tasks' | 'social';
  statKey: QuestStatKey;
  goal: number;
  reward: number;
};

// Flat bonus per goal.
const GOAL_REWARD = 25;

// The fixed everyday goals — the SAME list every day (not randomized), so the
// "today" pull is predictable. All are solo-achievable (no friend goal, which would
// sit permanently unclaimable for a user with no friends).
export const DAILY_GOALS: QuestDef[] = [
  { id: 'g_study_60', category: 'study', statKey: 'minutesToday', goal: 60, reward: GOAL_REWARD },
  { id: 'g_sessions_2', category: 'study', statKey: 'sessionsToday', goal: 2, reward: GOAL_REWARD },
  { id: 'g_before_noon', category: 'study', statKey: 'beforeNoonMinutesToday', goal: 25, reward: GOAL_REWARD },
  { id: 'g_task_1', category: 'tasks', statKey: 'tasksToday', goal: 1, reward: GOAL_REWARD },
];

const GOAL_BY_ID: Record<string, QuestDef> = Object.fromEntries(DAILY_GOALS.map((g) => [g.id, g]));

export function getQuest(id: string): QuestDef | undefined {
  return GOAL_BY_ID[id];
}

/** The day's goal ids — the fixed list, identical every day. */
export function dailyGoalIds(): string[] {
  return DAILY_GOALS.map((g) => g.id);
}

// ─── Achievements ─────────────────────────────────────────────────────────────

/** Lifetime stats an achievement can be measured against. */
export type AchievementStatKey =
  | 'sessionsCompleted'
  | 'totalMinutes'
  | 'lifetimeTasksCompleted'
  | 'longestStreak'
  | 'lifetimeFriendSessions'
  | 'recipesMade';

export type AchievementDef = {
  id: string;
  category: 'study' | 'tasks' | 'streak' | 'social' | 'recipes';
  statKey: AchievementStatKey;
  goal: number;
  reward: number;
};

// One-time milestones. Order here is the display order on the achievements screen.
// Rewards are deliberately bigger than the daily goals (GOAL_REWARD) — these are
// rare lifetime milestones, so they pay out generously (roughly 2× their old value).
export const ACHIEVEMENTS: AchievementDef[] = [
  // Study — sessions
  { id: 'a_first', category: 'study', statKey: 'sessionsCompleted', goal: 1, reward: 100 },
  { id: 'a_sessions_25', category: 'study', statKey: 'sessionsCompleted', goal: 25, reward: 200 },
  { id: 'a_sessions_100', category: 'study', statKey: 'sessionsCompleted', goal: 100, reward: 500 },
  // Study — hours (totalMinutes)
  { id: 'a_hours_10', category: 'study', statKey: 'totalMinutes', goal: 600, reward: 200 },
  { id: 'a_hours_50', category: 'study', statKey: 'totalMinutes', goal: 3000, reward: 500 },
  { id: 'a_hours_100', category: 'study', statKey: 'totalMinutes', goal: 6000, reward: 1000 },
  // Tasks
  { id: 'a_tasks_10', category: 'tasks', statKey: 'lifetimeTasksCompleted', goal: 10, reward: 150 },
  { id: 'a_tasks_50', category: 'tasks', statKey: 'lifetimeTasksCompleted', goal: 50, reward: 300 },
  { id: 'a_tasks_200', category: 'tasks', statKey: 'lifetimeTasksCompleted', goal: 200, reward: 800 },
  // Streak (measured against the longest streak ever reached)
  { id: 'a_streak_7', category: 'streak', statKey: 'longestStreak', goal: 7, reward: 200 },
  { id: 'a_streak_30', category: 'streak', statKey: 'longestStreak', goal: 30, reward: 600 },
  { id: 'a_streak_100', category: 'streak', statKey: 'longestStreak', goal: 100, reward: 1500 },
  // Social
  { id: 'a_friend_1', category: 'social', statKey: 'lifetimeFriendSessions', goal: 1, reward: 150 },
  { id: 'a_friend_10', category: 'social', statKey: 'lifetimeFriendSessions', goal: 10, reward: 400 },
  // Baking — collect every recipe (goal = total number of recipes).
  { id: 'a_all_recipes', category: 'recipes', statKey: 'recipesMade', goal: RECIPE_IDS.length, reward: 600 },
];

const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_BY_ID[id];
}
