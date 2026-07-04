// Localized "Xh Ym" / "Xh" / "Ym" study-duration formatting. Every place that
// showed a hard-coded English "m"/"h" suffix routes through here so the unit reads
// in the active language (e.g. "30分" / "30 min").

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** Format a whole-minute duration as a localized "Xh Ym" string. */
export function formatDuration(totalMinutes: number, t: TFn): string {
  const total = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return t('common.durM', { m });
  if (m === 0) return t('common.durH', { h });
  return t('common.durHM', { h, m });
}

/** Format a bare minute count with the localized minute unit (e.g. "125m" → "125分"). */
export function formatMinutesShort(minutes: number, t: TFn): string {
  return t('common.durM', { m: Math.max(0, Math.floor(minutes)) });
}
