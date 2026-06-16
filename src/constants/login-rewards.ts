/**
 * Daily reward — coins handed out once per day for opening the app, tied to the
 * STUDY streak (the one shown on Home). The reward on streak day N is simply N
 * coins, capped at 200 — so day 1 = 1 coin, day 200 = 200 coins, and it holds at
 * 200 for any longer streak. Claimable once per calendar day (account timezone).
 *
 * The date-aware transition (`nextLoginReward`) lives in app-context next to the
 * study-streak logic, since it reads the current study streak + account-tz day math.
 */

// Most coins a single daily claim can pay out (reached at a 200-day streak).
export const DAILY_REWARD_CAP = 200;

/** Coins awarded on study-streak day N: N coins, capped at the 200 max. */
export function dailyRewardCoins(streakDay: number): number {
  if (streakDay <= 0) return 0;
  return Math.min(streakDay, DAILY_REWARD_CAP);
}
