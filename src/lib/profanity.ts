// App-wide profanity filter. We MASK (never block): any matched bad word is
// replaced with same-length asterisks so the surrounding text still goes
// through. Used on all user-entered free text — DM + companion chat messages,
// display name, profile description, subject names, and preset names.
//
// The list is English-only for now. To extend to other languages, add their
// terms to BAD_WORDS — the matcher is language-agnostic (it just looks for the
// word with common leet substitutions surrounded by non-letters).

const BAD_WORDS = [
  'anal', 'anus', 'arse', 'ass', 'asshole', 'bastard', 'bitch', 'bollocks',
  'boner', 'boob', 'bukkake', 'bullshit', 'cock', 'coon', 'crap', 'cum',
  'cunt', 'damn', 'dick', 'dildo', 'dyke', 'fag', 'faggot', 'fuck', 'fucker',
  'fucking', 'goddamn', 'handjob', 'hardon', 'hell', 'homo', 'horny', 'jerk',
  'jizz', 'kike', 'kunt', 'masturbate', 'milf', 'nigga', 'nigger', 'nipple',
  'nude', 'orgasm', 'penis', 'piss', 'porn', 'prick', 'pussy', 'queer',
  'rape', 'retard', 'scrotum', 'semen', 'sex', 'shit', 'slut', 'spunk',
  'tit', 'tits', 'titty', 'turd', 'twat', 'vagina', 'wank', 'whore',
];

// Common leetspeak / symbol substitutions so "f*ck", "sh1t", "@ss" are caught.
const LEET: Record<string, string> = {
  a: '[a@4]', b: '[b8]', e: '[e3]', g: '[g9]', i: '[i1!|]', l: '[l1|]',
  o: '[o0]', s: '[s$5]', t: '[t7]', z: '[z2]',
};

function wordPattern(word: string): string {
  // Allow optional repeated separators (spaces, dots, asterisks) between letters
  // so spaced-out attempts like "f u c k" are still caught, and map each letter
  // to its leet character class.
  const letters = word.split('').map((ch) => LEET[ch] ?? escapeRegExp(ch));
  return letters.join('[\\s._*-]*');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// One combined, case-insensitive regex. Each word is bounded by a non-letter (or
// string edge) on both sides so we don't censor innocent substrings (e.g. the
// "ass" inside "class" or "pass").
const PROFANITY_RE = new RegExp(
  `(^|[^a-zA-Z])(${BAD_WORDS.map(wordPattern).join('|')})(?=[^a-zA-Z]|$)`,
  'gi',
);

/** Replace any bad word with asterisks of the same visible length. */
export function maskProfanity(text: string): string {
  if (!text) return text;
  return text.replace(PROFANITY_RE, (_match, lead: string, word: string) => {
    return lead + '*'.repeat(word.length);
  });
}

/** True if the text contains a bad word (does not modify it). */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  PROFANITY_RE.lastIndex = 0;
  return PROFANITY_RE.test(text);
}
