// Recipe-badge unlock logic, kept in a plain constants module (not the
// food-gallery screen) so foundational code like app-context can import it
// without creating an import cycle.

// The companion unlocked by collecting every recipe badge — granted, never sold.
export const HANJI_COMPANION_ID = 'companion_hanji';

// The recipe ids whose "made" badges must all be collected to unlock Hanji.
// Keep in sync with FOOD_ITEMS in src/app/food-gallery.tsx.
export const RECIPE_IDS = [
  'strawberry-shortcake',
  'pudding',
  'sakura-mochi',
  'matcha-crepe',
  'berry-croissant',
] as const;

/** True once the player has earned the badge for (made) every recipe. */
export function hasAllRecipeBadges(madeFoods: string[]): boolean {
  return RECIPE_IDS.every((id) => madeFoods.includes(id));
}
