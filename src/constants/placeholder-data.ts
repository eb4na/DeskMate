// Feature flag: the break mini-games (Home controller button + the in-session break
// game button). Hidden "for now" — flip to `true` to bring the feature back. Gates
// only the ENTRY points; the break-game route/screen/code stay intact.
export const BREAK_GAME_ENABLED = false;

export const SESSION_LENGTHS = [
  { minutes: 15, label: 'Quick Warm-up' },
  { minutes: 30, label: 'Focus Boost' },
  { minutes: 60, label: 'Deep Focus' },
  { minutes: 90, label: 'Long Session' },
] as const;

export type SessionLengthOption = (typeof SESSION_LENGTHS)[number];

// Auto-break length for a solo session: a flat 5 min break for sessions under an
// hour, and 15 min for an hour or longer.
export function autoBreakMinutes(focusMinutes: number): number {
  return focusMinutes < 60 ? 5 : 15;
}

// Coins earned per minute studied.
export const COINS_PER_MINUTE = 2;
export const coinsForMinutes = (minutes: number) => Math.floor(minutes * COINS_PER_MINUTE);

// Display a coin/number value with thousands separators: 1142490 → "1,142,490".
// Always commas (en-US) regardless of device locale.
export const formatCoins = (n: number | string): string =>
  Math.round(Number(n) || 0).toLocaleString('en-US');

// Max coins a user can earn from studying in a single day.
export const DAILY_EARN_CAP = 500;

// Hard ceiling on the coin BALANCE — the wallet can never grow past this, from any
// source (study, rewards, mail, even purchased packs). Spending is unaffected.
export const MAX_COIN_BALANCE = 9_999_999;
/** Clamp a would-be new balance to MAX_COIN_BALANCE. Wrap every wallet credit. */
export const capCoins = (n: number) => Math.min(n, MAX_COIN_BALANCE);

// Max number of friends a user can add.
export const MAX_FRIENDS = 150;

export const BREAK_LENGTHS = [5, 10, 15, 30] as const;

// Auto-assign colors for new subjects (Wave 2)
export const SUBJECT_COLORS = [
  '#64B5F6', '#81C784', '#FFB74D', '#F06292',
  '#BA68C8', '#4DB6AC', '#E57373', '#A1887F',
  '#90A4AE', '#AED581', '#FFD54F', '#FF8A65',
] as const;

// Static subjects for Wave 1 seed (Wave 2 uses dynamic subjects in context)
export const STATIC_SUBJECTS = [
  { name: 'Math', color: '#64B5F6' },
  { name: 'Biology', color: '#81C784' },
  { name: 'History', color: '#FFB74D' },
] as const;
