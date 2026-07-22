/**
 * Achievements — declarative definitions.
 *
 * Pay BONUS coins that bypass the daily earn cap (claimed via app-context actions).
 * Progress is read from lifetime stats kept in PersistedState. Display strings live
 * in i18n under `achievements.items.<id>`.
 */
import { RECIPE_IDS } from '@/constants/recipes';

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
// Rewards are deliberately generous — these are rare lifetime milestones.
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
