// Recipe-badge unlock logic, kept in a plain constants module (not the
// food-gallery screen) so foundational code like app-context can import it
// without creating an import cycle.

// The companion unlocked by collecting every recipe badge — granted, never sold.
export const HANJI_COMPANION_ID = 'companion_hanji';

// Each recipe badge belongs to a character (their signature bake). companionId
// feeds getCompanionImage() for the avatar ('' = the starter Bun). Keep in sync
// with FOOD_ITEMS in src/app/food-gallery.tsx.
export const RECIPE_BADGES: { recipeId: string; owner: string; companionId: string }[] = [
  { recipeId: 'strawberry-shortcake', owner: 'Bun', companionId: '' },
  { recipeId: 'berry-croissant', owner: 'Cocoa', companionId: 'shop:companion_cocoa' },
  { recipeId: 'sakura-mochi', owner: 'Bunny', companionId: 'shop:companion_bunny' },
  { recipeId: 'pudding', owner: 'Miel', companionId: 'shop:companion_honey' },
  { recipeId: 'matcha-crepe', owner: 'Tira', companionId: 'shop:companion_tira' },
];

// The recipe ids whose "made" badges must all be collected to unlock Hanji.
export const RECIPE_IDS = RECIPE_BADGES.map((b) => b.recipeId);

/** True once the player has earned the badge for (made) every recipe. */
export function hasAllRecipeBadges(madeFoods: string[]): boolean {
  return RECIPE_IDS.every((id) => madeFoods.includes(id));
}

// ── Character badges (toward Hanji) ──────────────────────────────────────────
// A character badge is earned by MAKING that character's designated recipe (each
// recipe in RECIPE_BADGES belongs to one character). The 5 badge characters are
// the companionIds in RECIPE_BADGES ('' = the starter Bun).
const BADGE_COMPANION_IDS = RECIPE_BADGES.map((b) => b.companionId);

/** The badge character (companionId) for a recipe id, or null if it isn't one of
 * the five badge recipes. '' (Bun) is a valid key — null means "no badge". */
export function recipeBadgeKey(recipeId: string): string | null {
  const b = RECIPE_BADGES.find((x) => x.recipeId === recipeId);
  return b ? b.companionId : null;
}

/** The badge keys earned from the set of recipes actually made — the source of
 * truth for badge progress, derived straight from `madeFoods`. */
export function badgesFromMadeFoods(madeFoods: string[]): string[] {
  return RECIPE_BADGES.filter((b) => madeFoods.includes(b.recipeId)).map((b) => b.companionId);
}

/** True once the player has earned all five character badges. */
export function hasAllCharacterBadges(bakedWith: string[]): boolean {
  return BADGE_COMPANION_IDS.every((id) => bakedWith.includes(id));
}
