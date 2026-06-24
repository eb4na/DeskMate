// Pet/tap lines shown when the user taps the home companion — written per character
// (the voice) AND per skin (the mood). The text itself lives in the i18n files under
// the `pet` namespace (pet.<companion>.<skin> = array of lines), so every line is
// localized in all supported languages. This module just picks one at random for the
// active companion + skin, in the current language.
import i18n from '@/i18n';

// Ultimate fallback for custom/generated companions (no fixed persona or skins), and
// the unlikely case the i18n `pet` tree isn't available yet. en.json mirrors these.
export const GENERIC_PET_LINES = [
  "Hehe~ that tickles!",
  "Let's study together soon?",
  "So glad you're here.",
];

// Resolve a localized line array for an i18n key, or null when the path isn't an
// array (i18next returns the key string itself for a missing path).
function linesFor(key: string): string[] | null {
  const v = i18n.t(key, { returnObjects: true });
  return Array.isArray(v) && v.length > 0 ? (v as string[]) : null;
}

// Pick a random line for the active companion + skin, in the current language.
// Falls back: this skin → the companion's `classic` skin → the generic set.
export function getPetLine(companionKey: string | undefined, skinId: string | undefined): string {
  const lines =
    (companionKey && linesFor(`pet.${companionKey}.${skinId ?? 'classic'}`)) ||
    (companionKey && linesFor(`pet.${companionKey}.classic`)) ||
    linesFor('pet.generic') ||
    GENERIC_PET_LINES;
  return lines[Math.floor(Math.random() * lines.length)];
}
