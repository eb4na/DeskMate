// Companion bond level, derived purely from minutes studied with that companion
// (no rewards — it's a relationship/progress display only). The curve gets
// progressively harder: each level needs more minutes than the last.
//   level 1 → 2 : BASE
//   level 2 → 3 : BASE + STEP
//   level L → L+1 : BASE + (L-1) * STEP
export const BASE_MINUTES = 30; // minutes to reach level 2
export const STEP_MINUTES = 20; // each subsequent level costs this many more

// Minutes needed to advance FROM `level` to `level + 1`.
export function minutesForLevel(level: number): number {
  return BASE_MINUTES + (level - 1) * STEP_MINUTES;
}

export function companionLevelInfo(
  minutes: number,
): { level: number; progress: number; intoLevel: number; forNext: number } {
  let remaining = Math.max(0, Math.floor(minutes || 0));
  let level = 1;
  let need = minutesForLevel(level);
  // Levels grow ~√(minutes), so this loop is short even for large totals.
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = minutesForLevel(level);
  }
  return { level, progress: need > 0 ? remaining / need : 0, intoLevel: remaining, forNext: need };
}
