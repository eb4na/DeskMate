import { COMPANION_LINES } from '@/constants/companion-lines';

// Study-reminder lines written in each companion's voice. The reminder reflects
// whoever is currently equipped (active companion) — one voice per character,
// independent of the outfit/skin they're wearing.
//
// companionKey is 'bun' for the starter, or the shop companion's item id
// (e.g. 'companion_tira').
//
// Voices:
//   Bun    — sweet, devoted, earnest; gentle "bun" puns.
//   Cocoa  — cozy barista cat; "work hard now, treat later"; coffee/tea metaphors.
//   Bunny  — vain little princess; speaks in third person; cute-bratty.
//   Miel   — sleepy honey-bear; "nap now, study after"; drowsy but shows up.
//   Tira   — deadpan dropout; dry irony; "I dropped out, but you should study".
type CompanionVoice = { emoji: string; lines: string[] };

export const COMPANION_REMINDER_LINES: Record<string, CompanionVoice> = {
  bun: {
    emoji: '🍓',
    lines: [
      'Bun study with you forever 🍓',
      "It's study o'clock! I saved you the comfiest seat 🍓",
      'Bun believes in you — let’s rise together 📖',
      'Your future self is already thanking you. Let’s go ✨',
      'Just you, me, and a fresh page. Ready? 💛',
      'A little focus now makes everything sweeter later 🍓',
    ],
  },
  companion_cocoa: {
    emoji: '☕',
    lines: [
      'Work hard now, treat later ☕',
      'Order up: one focused session, treat to follow ☕',
      'Work hard now, treat later — I’ll keep your cocoa warm 🐱',
      'Brewing something good? Let’s start studying ☕',
      'One shot of focus, extra foam. On it? 🐱',
      'The café’s open and your seat’s reserved. Let’s study ☕',
    ],
  },
  companion_bunny: {
    emoji: '👑',
    lines: [
      'bunny know bunny the cutest thing ever — now study 👑',
      'Bunny says it’s study time, and Bunny is always right 👑',
      'A princess studies too, you know. Come, join Bunny 💖',
      'Bunny saved the prettiest desk for you. Sit, sit! 👑',
      'Bunny demands one fabulous study session. Now! 💅',
      'Be cute AND smart — Bunny does both. Your turn 👑',
    ],
  },
  companion_honey: {
    emoji: '🍯',
    lines: [
      'Nap now, study after… wait, no — study first 😴🍯',
      'Mmm… *yawn*… okay okay, study time. Miel’s up 🍯',
      'One sweet session, then nap. Deal? 🐻',
      'Miel rolled out of the honey pot for this. Let’s study 🍯',
      'Sleepy but here for you. Let’s do a little focus 🐻',
      'Honey’s sweet, but finishing your work is sweeter 🍯',
    ],
  },
  companion_tira: {
    emoji: '🍰',
    lines: [
      'Tira dropped out, you should study though 🍰',
      'Tira dropped out. You shouldn’t. Go study 🍰',
      'I’m not gonna study. But you? Yeah. Open the book 🍰',
      'Do as Tira says, not as Tira does. Study time 😐',
      'Look, one of us has to have a future. Get to it 🍰',
      'Tira’s rooting for you. Quietly. From the couch. Study 😐',
    ],
  },
};

const FALLBACK_LINES: readonly string[] = COMPANION_LINES.reminder;

/** Reminder line pool for a companion. Falls back to the generic reminder lines. */
export function getCompanionReminderPool(companionKey: string | null | undefined): string[] {
  const voice = companionKey ? COMPANION_REMINDER_LINES[companionKey] : undefined;
  return voice && voice.lines.length > 0 ? [...voice.lines] : [...FALLBACK_LINES];
}

/** The title emoji for a companion (defaults to 🔔). */
export function getCompanionReminderEmoji(companionKey: string | null | undefined): string {
  return (companionKey && COMPANION_REMINDER_LINES[companionKey]?.emoji) || '🔔';
}

/** A single random line from the companion's pool. */
export function getCompanionReminderLine(companionKey: string | null | undefined): string {
  const pool = getCompanionReminderPool(companionKey);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * `n` lines drawn from `pool` with no repeats until the pool is exhausted, then
 * cycling. Used to give each weekday a different line.
 */
export function pickReminderLines(pool: string[], n: number): string[] {
  if (pool.length === 0) return Array.from({ length: n }, () => FALLBACK_LINES[0]);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return Array.from({ length: n }, (_, i) => shuffled[i % shuffled.length]);
}
