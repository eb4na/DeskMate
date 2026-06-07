import { COMPANION_LINES } from '@/constants/companion-lines';

// Study-reminder lines written in each companion's voice, flavored by the skin
// they're wearing. Keyed by companionKey → skinId → lines[].
//
// companionKey is 'bun' for the starter, or the shop companion's item id
// (e.g. 'companion_tira'). skinId matches the wardrobe skin ids in
// COMPANION_SKINS / BUN_SKINS (companion-utils.ts). 'classic' is the default.
//
// Voices:
//   Bun    — sweet, devoted, earnest; gentle "bun" puns.
//   Cocoa  — cozy barista cat; "work hard now, treat later"; coffee/tea metaphors.
//   Bunny  — vain little princess; speaks in third person; cute-bratty.
//   Miel   — sleepy honey-bear; "nap now, study after"; drowsy but shows up.
//   Tira   — deadpan dropout; dry irony; "I dropped out, but you should study".
export const COMPANION_REMINDER_LINES: Record<string, Record<string, string[]>> = {
  bun: {
    classic: [
      "It's study o'clock! I saved you the comfiest seat 🍓",
      'Bun believes in you — let’s rise together 📖',
      'Your future self is already thanking you. Let’s go ✨',
      'Just you, me, and a fresh page. Ready? 💛',
      'A little focus now makes everything sweeter later 🍓',
    ],
    angel: [
      'A little halo says: time to study, sweet one 👼',
      'Heaven can wait — your goals can’t. Let’s begin ✨',
      'Bun’s watching over you. Let’s make today gentle and good ☁️',
      'Wings up, worries down. One peaceful session 👼',
      'You’re doing divine work just by showing up 💫',
    ],
    angelkei: [
      'Soft wings, soft focus. Let’s float into study time 😇',
      'An angel’s nudge: open the book, you’ve got this ☁️',
      'Be a little divine today — one cozy session 💫',
      'Halo on, distractions off. Bun’s right beside you 😇',
      'Drift gently into focus, sweet one ☁️📖',
    ],
  },

  companion_cocoa: {
    classic: [
      'Order up: one focused session, treat to follow ☕',
      'Work hard now, treat later — I’ll keep your cocoa warm 🐱',
      'Brewing something good? Let’s start studying ☕',
      'One shot of focus, extra foam. On it? 🐱',
      'The café’s open and your seat’s reserved. Let’s study ☕',
    ],
    relax: [
      'Cozy season, cozy study. Steep some tea and begin 🍁',
      'Slow autumn afternoon — perfect for one warm session 🍵',
      'Leaves falling, pages turning. Let’s go 🍂',
      'Wrap up warm, settle in, and study a while 🍁',
      'Tea’s poured, kimono’s comfy. Let’s focus together 🍵',
    ],
  },

  companion_bunny: {
    classic: [
      'Bunny says it’s study time, and Bunny is always right 👑',
      'A princess studies too, you know. Come, join Bunny 💖',
      'Bunny saved the prettiest desk for you. Sit, sit! 👑',
      'Bunny demands one fabulous study session. Now! 💅',
      'Be cute AND smart — Bunny does both. Your turn 👑',
    ],
    jiraikei: [
      'Cute but menacing: open that book or Bunny pouts 🎀🖤',
      'Bunny’s feeling a little dramatic… study with Bunny anyway 🖤',
      'Bunny wore the cool outfit just to make you focus 🖤',
      'Adore Bunny? Then study, or Bunny gets moody 🎀',
      'Soft heart, sharp focus. Don’t keep Bunny waiting 🖤',
    ],
    palace: [
      'By royal decree, Bunny commands one study session 🪷',
      'The palace is quiet — perfect for Bunny and you to study 🏯',
      'Bunny looks regal AND studious today. Join the court 🪷',
      'A noble mind studies first. Bunny insists 🏯',
      'Bow to the books, little scholar. Bunny approves 🪷',
    ],
  },

  companion_honey: {
    classic: [
      'Mmm… *yawn*… okay okay, study time. Miel’s up 🍯',
      'One sweet session, then nap. Deal? 🐻',
      'Miel rolled out of the honey pot for this. Let’s study 🍯',
      'Sleepy but here for you. Let’s do a little focus 🐻',
      'Honey’s sweet, but finishing your work is sweeter 🍯',
    ],
    champion: [
      'Even champions warm up — Miel’s ready, are you? 🏆',
      'Game face on! …after this we nap. Let’s win today 🥇',
      'Miel believes you’re podium material. Study up! 🏆',
      'Go for gold — one strong session, then rest 🥇',
      'Champions show up tired and try anyway. Let’s go 🏆',
    ],
    zzz: [
      'Miel’s in jammies but still showed up. Quick session? 😴',
      'Cozy and sleepy… but you can do one little block 🛌',
      'Five more minutes? No — study first, snuggle after 😴',
      'Miel’s nightcap is on, but study before bed, okay? 🌙',
      'Sleepy hug, then one tiny session. Promise? 🛌',
    ],
  },

  companion_tira: {
    classic: [
      'Tira dropped out. You shouldn’t. Go study 🍰',
      'I’m not gonna study. But you? Yeah. Open the book 🍰',
      'Do as Tira says, not as Tira does. Study time 😐',
      'Look, one of us has to have a future. Get to it 🍰',
      'Tira’s rooting for you. Quietly. From the couch. Study 😐',
    ],
    wolfsmeal: [
      'Off to grandma’s… you, off to studying. Move it 🧺',
      'The wolf waits for slackers. Don’t be lunch — study 🐺',
      'Tira’s got snacks for the road. You’ve got a chapter. Go 🧺',
      'Through the woods and into your notes. March 🧺',
      'Stay on the path: open book, start now 🐺',
    ],
    chocomint: [
      'Sweet on the outside, strict about study. Begin 🍫',
      'Mint-fresh focus. Tira approves. Get to it 🍃',
      'Two scoops of “go study” from Tira 🍫🍃',
      'Cool, crisp, and time to work. No excuses 🍃',
      'Treat yourself — to a finished study session 🍫',
    ],
    sleepover: [
      'Pajama party rule: one study session before gossip 🌙',
      'Tira’s in PJs and STILL nagging you to study. Up 🌙',
      'Lights low, focus high. One cozy session, then snacks 🌙',
      'Sleepover secret: studying first makes the night better ✨',
      'Blanket fort’s ready — bring your notes inside 🌙',
    ],
  },
};

const FALLBACK_LINES: readonly string[] = COMPANION_LINES.reminder;

/**
 * Reminder line pool for a companion + equipped skin. Falls back to the
 * companion's `classic` set, then to the generic reminder lines.
 */
export function getCompanionReminderPool(
  companionKey: string | null | undefined,
  skinId: string | null | undefined,
): string[] {
  const byCompanion = companionKey ? COMPANION_REMINDER_LINES[companionKey] : undefined;
  if (!byCompanion) return [...FALLBACK_LINES];
  const pool = (skinId && byCompanion[skinId]) || byCompanion.classic;
  return pool && pool.length > 0 ? [...pool] : [...FALLBACK_LINES];
}

/** A single random line from the resolved pool. */
export function getCompanionReminderLine(
  companionKey: string | null | undefined,
  skinId: string | null | undefined,
): string {
  const pool = getCompanionReminderPool(companionKey, skinId);
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
