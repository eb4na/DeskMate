export const SESSION_LENGTHS = [
  { minutes: 10, label: 'Quick Focus' },
  { minutes: 25, label: 'Pomodoro' },
  { minutes: 50, label: 'Deep Work' },
  { minutes: 90, label: 'Marathon' },
] as const;

export type SessionLengthOption = (typeof SESSION_LENGTHS)[number];

export const COIN_REWARDS: Record<number, number> = {
  10: 5,
  25: 15,
  50: 35,
  90: 70,
};

export const DAILY_EARN_CAP = 120;

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
  { name: 'Spanish', color: '#F06292' },
] as const;

// Before-session mood options (how you feel going into studying)
export const BEFORE_SESSION_MOODS = [
  { value: 'tired', emoji: '😴', label: 'Tired' },
  { value: 'stressed', emoji: '😰', label: 'Stressed' },
  { value: 'okay', emoji: '🙂', label: 'Okay' },
  { value: 'motivated', emoji: '💪', label: 'Motivated' },
  { value: 'lost', emoji: '😕', label: 'Lost' },
  { value: 'calm', emoji: '😌', label: 'Calm' },
] as const;

// After-session mood options (how you feel after studying)
export const AFTER_SESSION_MOODS = [
  { value: 'proud', emoji: '😤', label: 'Proud' },
  { value: 'better', emoji: '😊', label: 'Better' },
  { value: 'same', emoji: '😐', label: 'Same' },
  { value: 'confused', emoji: '🤔', label: 'Still confused' },
  { value: 'exhausted', emoji: '😮‍💨', label: 'Exhausted' },
  { value: 'relieved', emoji: '😅', label: 'Relieved' },
] as const;

export type BeforeMoodValue = (typeof BEFORE_SESSION_MOODS)[number]['value'];
export type AfterMoodValue = (typeof AFTER_SESSION_MOODS)[number]['value'];
