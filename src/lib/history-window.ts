// Progress-history window. Free accounts can review the most recent 3 months of
// study history; Memobun Plus unlocks the full archive (the "Advanced
// reports" perk). Lifetime headline counters (total sessions/minutes, streak)
// are NOT trimmed by this — they're cumulative and can't be rebuilt from a
// trimmed history; only the browsable time-series views are capped.
export const FREE_HISTORY_MONTHS = 3;

/**
 * Inclusive earliest date a record may have to stay visible, as a `YYYY-MM-DD`
 * string — or `null` when there's no limit (Plus). Works for both history
 * shapes via string comparison: `SessionRecord.dateISO` ("2026-03-13") and any
 * full-ISO timestamp ("2026-03-13T08:00:00.000Z") both compare
 * `>= cutoff` correctly, so the entire cutoff day is included.
 */
export function historyCutoffISO(isPlus: boolean): string | null {
  if (isPlus) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - FREE_HISTORY_MONTHS);
  return d.toISOString().split('T')[0];
}
