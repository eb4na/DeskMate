export const COMPANION_LINES = {
  sessionStart: [
    "Let's do this! I'll be right here studying with you 📚",
    "Time to focus. You've got this 💪",
    "Ready when you are. Let's make today count ✨",
    "One session at a time. You're building something real 🌱",
    "I believe in you. Let's get it done 🎯",
  ],
  sessionEnd: [
    "You showed up — that's what matters most 🌟",
    "Great session! I'm so proud of you 🎉",
    "Another one done. Keep that momentum going 🔥",
    "Every session is a win. Well done today 🏆",
    "You came, you focused, you conquered ✨",
  ],
  reminder: [
    "Hey, it's study time! I saved us a cozy spot 📖",
    "Your future self is rooting for you. Let's study ⭐",
    "Small effort today = big results later. Ready? 🚀",
    "Study time! I've been warming up your seat 🪑",
    "Just 10 minutes can change the whole day 💡",
  ],
  missedDay: [
    "No worries — life happens. Ready when you are 🌱",
    "I missed you! Come back whenever you're ready 💛",
    "Every comeback starts with one session. Let's go 🌈",
    "Taking breaks is okay. What matters is coming back 🤝",
    "Hey, I'm still here. Whenever you're ready 🌸",
  ],
  avoidedTask: [
    "This one has been waiting a while. Want to try just 10 minutes? ⏰",
    "Baby steps count too. Even 5 minutes makes a difference 🌻",
    "No pressure — whenever you're ready, I'm here 🤗",
    "Sometimes just starting is the hardest part. You've got this 💪",
    "One tiny step is still a step forward 🐾",
  ],
  breakOver: [
    "Break's over! Feeling refreshed? Let's get back to it 📚",
    "Time to focus again! You're doing amazing 💪",
    "Hope that was fun! Ready to study for a bit? ✨",
    "Rest taken, now let's make something happen 🎯",
    "That was a well-earned break. Back to the good stuff? 📖",
  ],
} as const;

export type CompanionLineCategory = keyof typeof COMPANION_LINES;

export function getCompanionLine(category: CompanionLineCategory): string {
  const options = COMPANION_LINES[category] as readonly string[];
  return options[Math.floor(Math.random() * options.length)];
}

/** Deterministic home greeting based on streak state — no randomness so it doesn't flicker */
export function getHomeGreeting(params: {
  lastStudyDate: string | null;
  currentStreak: number;
}): string {
  const { lastStudyDate, currentStreak } = params;
  const todayISO = new Date().toISOString().split('T')[0];
  const yesterdayISO = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

  if (!lastStudyDate) return "Welcome! Let's start your first session together 📚";
  if (lastStudyDate === todayISO) {
    if (currentStreak >= 7) return `${currentStreak} days strong! You're unstoppable 🔥`;
    if (currentStreak >= 3) return `${currentStreak} days in a row! Keep the streak alive 🔥`;
    return 'You showed up today! Keep it up 💪';
  }
  if (lastStudyDate === yesterdayISO) return 'Ready for another session? 📖';
  return "I missed you! Ready to jump back in? 🌱";
}
