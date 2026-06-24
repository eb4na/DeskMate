export const SESSION_LENGTHS = [
  { minutes: 15, label: 'Quick Warm-up' },
  { minutes: 30, label: 'Focus Boost' },
  { minutes: 60, label: 'Deep Focus' },
  { minutes: 90, label: 'Long Session' },
] as const;

export type SessionLengthOption = (typeof SESSION_LENGTHS)[number];

// Auto-break length for a solo session: a flat 5 min break for sessions under an
// hour, and 10 min for an hour or longer.
export function autoBreakMinutes(focusMinutes: number): number {
  return focusMinutes < 60 ? 5 : 10;
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

// Max number of friends a user can add.
export const MAX_FRIENDS = 150;

export const BREAK_LENGTHS = [5, 10, 15] as const;

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

// Before-session mood options (how you feel going into studying)
export const BEFORE_SESSION_MOODS = [
  { value: 'motivated', emoji: '', label: 'Motivated', image: require('@/assets/images/moods/after-0.png') },
  { value: 'ready', emoji: '', label: 'Ready', image: require('@/assets/images/moods/after-1.png') },
  { value: 'calm', emoji: '', label: 'Calm', image: require('@/assets/images/moods/after-2.png') },
  { value: 'excited', emoji: '', label: 'Excited', image: require('@/assets/images/moods/after-3.png') },
  { value: 'happy', emoji: '', label: 'Happy', image: require('@/assets/images/moods/after-4.png') },
  { value: 'okay', emoji: '', label: 'Okay', image: require('@/assets/images/moods/before-4.png') },
  { value: 'sleepy', emoji: '', label: 'Sleepy', image: require('@/assets/images/moods/before-0.png') },
  { value: 'tired', emoji: '', label: 'Tired', image: require('@/assets/images/moods/after-5.png') },
  { value: 'stressed', emoji: '', label: 'Stressed', image: require('@/assets/images/moods/before-1.png') },
  { value: 'lost', emoji: '', label: 'Lost', image: require('@/assets/images/moods/before-2.png') },
  { value: 'frustrated', emoji: '', label: 'Frustrated', image: require('@/assets/images/moods/before-3.png') },
  { value: 'down', emoji: '', label: 'Down', image: require('@/assets/images/moods/before-5.png') },
] as const;

// After-session mood options (how you feel after studying). Full emotional range
// — the same breadth as the before-session set, framed for "after studying".
export const AFTER_SESSION_MOODS = [
  { value: 'proud', emoji: '', label: 'Proud', image: require('@/assets/images/moods/after-0.png') },
  { value: 'better', emoji: '', label: 'Better', image: require('@/assets/images/moods/after-1.png') },
  { value: 'relieved', emoji: '', label: 'Relieved', image: require('@/assets/images/moods/after-2.png') },
  { value: 'motivated', emoji: '', label: 'Motivated', image: require('@/assets/images/moods/after-3.png') },
  { value: 'happy', emoji: '', label: 'Happy', image: require('@/assets/images/moods/after-4.png') },
  { value: 'okay', emoji: '', label: 'Okay', image: require('@/assets/images/moods/before-4.png') },
  { value: 'sleepy', emoji: '', label: 'Sleepy', image: require('@/assets/images/moods/before-0.png') },
  { value: 'exhausted', emoji: '', label: 'Exhausted', image: require('@/assets/images/moods/after-5.png') },
  { value: 'stressed', emoji: '', label: 'Stressed', image: require('@/assets/images/moods/before-1.png') },
  { value: 'lost', emoji: '', label: 'Lost', image: require('@/assets/images/moods/before-2.png') },
  { value: 'frustrated', emoji: '', label: 'Frustrated', image: require('@/assets/images/moods/before-3.png') },
  { value: 'down', emoji: '', label: 'Down', image: require('@/assets/images/moods/before-5.png') },
] as const;

export type BeforeMoodValue = (typeof BEFORE_SESSION_MOODS)[number]['value'];
export type AfterMoodValue = (typeof AFTER_SESSION_MOODS)[number]['value'];
