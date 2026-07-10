// Recipe-badge unlock logic, kept in a plain constants module (not the
// food-gallery screen) so foundational code like app-context can import it
// without creating an import cycle.

// The companion unlocked by collecting every recipe badge — granted, never sold.
export const HANJI_COMPANION_ID = 'companion_hanji';

// Each recipe badge belongs to a character (their signature bake). companionId
// feeds getCompanionImage() for the avatar ('' = the starter Bun). Keep in sync
// with FOOD_ITEMS in src/app/food-gallery.tsx.
// `recipeItem` is the shop SKU that unlocks baking the recipe — granted free to a
// player who picks that character as their starter. null = Bun's strawberry
// shortcake, which is free for everyone and needs no SKU.
export const RECIPE_BADGES: { recipeId: string; owner: string; companionId: string; recipeItem: string | null }[] = [
  { recipeId: 'strawberry-shortcake', owner: 'Bun', companionId: '', recipeItem: null },
  { recipeId: 'sakura-mochi', owner: 'Cocoa', companionId: 'shop:companion_cocoa', recipeItem: 'recipe_sakura' },
  { recipeId: 'berry-croissant', owner: 'Bunny', companionId: 'shop:companion_bunny', recipeItem: 'recipe_croissant' },
  { recipeId: 'pudding', owner: 'Miel', companionId: 'shop:companion_honey', recipeItem: 'recipe_pudding' },
  { recipeId: 'matcha-crepe', owner: 'Tira', companionId: 'shop:companion_tira', recipeItem: 'recipe_matcha' },
];

/** The signature recipe (and its unlock SKU) matching a starter companion, so a
 * new player gets the recipe that goes with the character they chose. The Bun
 * starter uses companionId '' and its recipe is free (recipeItem null). Returns
 * null if the id isn't a known starter character. */
export function starterRecipe(companionId: string): { recipeId: string; recipeItem: string | null } | null {
  const b = RECIPE_BADGES.find((x) => x.companionId === companionId);
  return b ? { recipeId: b.recipeId, recipeItem: b.recipeItem } : null;
}

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
