// Cake Kitchen mini-game — static data + placeholder art.
// Placeholder art is emoji + soft color boxes; swap for PNGs in Wave 6.

import type {
  CakeBase,
  CakeFilling,
  CakeTopping,
  GameMode,
  IngredientDef,
  PlayerState,
  RecipeId,
  Station,
} from './gameTypes';

export const BASES: IngredientDef<CakeBase>[] = [
  { id: 'vanilla', label: 'Vanilla', emoji: '🟡', color: '#FDE6B8' },
  { id: 'chocolate', label: 'Chocolate', emoji: '🟤', color: '#C99878' },
  { id: 'strawberry', label: 'Strawberry', emoji: '🩷', color: '#F7B6C6' },
  { id: 'redVelvet', label: 'Red Velvet', emoji: '🍰', color: '#B5352F' },
  { id: 'milk', label: 'Milk', emoji: '🥛', color: '#FBF6EC' },
  { id: 'riceFlour', label: 'Rice Flour', emoji: '🍚', color: '#FBEFF2' },
  { id: 'matcha', label: 'Matcha', emoji: '🍵', color: '#A7C268' },
  { id: 'flour', label: 'Flour', emoji: '🌾', color: '#F8E9D2' },
];

export const FILLINGS: IngredientDef<CakeFilling>[] = [
  { id: 'cream', label: 'Cream', emoji: '🥛', color: '#FFF6E9' },
  { id: 'chocCream', label: 'Choc Cream', emoji: '🍫', color: '#B07A5C' },
  { id: 'strawJam', label: 'Strawberry Jam', emoji: '🍓', color: '#F28BA0' },
  { id: 'redVelvet', label: 'Red Velvet', emoji: '🍰', color: '#C0303A' },
  { id: 'sugar', label: 'Sugar', emoji: '🍬', color: '#FBE3EC' },
  { id: 'redBean', label: 'Red Bean', emoji: '🫘', color: '#7A2E33' },
  { id: 'milk', label: 'Milk', emoji: '🥛', color: '#FBF6EC' },
  { id: 'butter', label: 'Butter', emoji: '🧈', color: '#F5DE7E' },
];

export const TOPPINGS: IngredientDef<CakeTopping>[] = [
  { id: 'strawberry', label: 'Strawberry', emoji: '🍓', color: '#F28BA0' },
  { id: 'cherry', label: 'Cherry', emoji: '🍒', color: '#E26A7E' },
  { id: 'blueberry', label: 'Blueberry', emoji: '🫐', color: '#8E9BE0' },
  { id: 'choco', label: 'Chocolate', emoji: '🍫', color: '#6B4A33' },
  { id: 'sprinkles', label: 'Sprinkles', emoji: '✨', color: '#FAD9A0' },
  { id: 'cornstarch', label: 'Cornstarch', emoji: '🌽', color: '#FFFDF6' },
  { id: 'sakuraLeaf', label: 'Sakura Leaf', emoji: '🌿', color: '#8FA45A' },
  { id: 'eggFlour', label: 'Eggs & Flour', emoji: '🥚', color: '#F6E7C2' },
  { id: 'berries', label: 'Berries', emoji: '🍓', color: '#D24B66' },
];

// Each non-cake recipe is a single fixed order using its own dedicated ingredient
// trio. These ids are reserved — they never appear in normal 'cake' play.
type RecipeOrder = { base: CakeBase; filling: CakeFilling; topping: CakeTopping };

export const SPECIAL_ORDERS: Record<Exclude<RecipeId, 'cake'>, RecipeOrder> = {
  pudding: { base: 'milk', filling: 'sugar', topping: 'cornstarch' },
  sakura: { base: 'riceFlour', filling: 'redBean', topping: 'sakuraLeaf' },
  matcha: { base: 'matcha', filling: 'milk', topping: 'eggFlour' },
  croissant: { base: 'flour', filling: 'butter', topping: 'berries' },
};

// Backwards-compatible alias used elsewhere.
export const PUDDING_ORDER = SPECIAL_ORDERS.pudding;

const RESERVED_BASES = Object.values(SPECIAL_ORDERS).map((o) => o.base);
const RESERVED_FILLINGS = Object.values(SPECIAL_ORDERS).map((o) => o.filling);
const RESERVED_TOPPINGS = Object.values(SPECIAL_ORDERS).map((o) => o.topping);

/** The fixed order for a recipe, or null for free-form 'cake' play. */
export function recipeOrder(recipe: RecipeId): RecipeOrder | null {
  return recipe === 'cake' ? null : SPECIAL_ORDERS[recipe];
}

// The ingredient pool the kitchen offers for the active recipe. 'cake' keeps the
// original cake ingredients (every reserved recipe id filtered out); a special
// recipe shows only its own trio.
export function recipePools(recipe: RecipeId): {
  bases: IngredientDef<CakeBase>[];
  fillings: IngredientDef<CakeFilling>[];
  toppings: IngredientDef<CakeTopping>[];
} {
  const order = recipeOrder(recipe);
  if (order) {
    return {
      bases: BASES.filter((b) => b.id === order.base),
      fillings: FILLINGS.filter((f) => f.id === order.filling),
      toppings: TOPPINGS.filter((t) => t.id === order.topping),
    };
  }
  return {
    bases: BASES.filter((b) => !RESERVED_BASES.includes(b.id)),
    fillings: FILLINGS.filter((f) => !RESERVED_FILLINGS.includes(f.id)),
    toppings: TOPPINGS.filter((t) => !RESERVED_TOPPINGS.includes(t.id)),
  };
}

// Top-down kitchen map. Coordinates are 0–100 percentages (seeded from the PDF
// appendix, normalized to a ~300x540 vertical layout) so they scale on any
// phone. Stations are placed so the flow reads roughly top-to-bottom.
export const STATIONS: Station[] = [
  { id: 'counter', kind: 'counter', label: 'Counter', emoji: '🔔', x: 50, y: 14, allowedActions: ['serve'] },
  // Left column: ingredients + ovens
  { id: 'ingredient', kind: 'ingredient', label: 'Ingredients', emoji: '🧺', x: 14, y: 30, allowedActions: ['pickBase'] },
  { id: 'oven1', kind: 'oven', label: 'Oven', emoji: '🔥', x: 14, y: 48, allowedActions: ['bake'] },
  { id: 'oven2', kind: 'oven', label: 'Oven', emoji: '🔥', x: 14, y: 65, allowedActions: ['bake'] },
  { id: 'oven3', kind: 'oven', label: 'Oven', emoji: '🔥', x: 14, y: 82, allowedActions: ['bake'] },
  // Right column: assembly, decorate, trash
  { id: 'assembly', kind: 'assembly', label: 'Assembly', emoji: '🍰', x: 86, y: 40, allowedActions: ['addFilling'] },
  { id: 'decoration', kind: 'decoration', label: 'Decorate', emoji: '🎀', x: 86, y: 58, allowedActions: ['addTopping'] },
  { id: 'trash', kind: 'trash', label: 'Trash', emoji: '🗑️', x: 86, y: 76, allowedActions: [] },
  // Bottom row: mixers
  { id: 'mixer1', kind: 'mixer', label: 'Mixer', emoji: '🥣', x: 33, y: 93, allowedActions: ['mix'] },
  { id: 'mixer2', kind: 'mixer', label: 'Mixer', emoji: '🥣', x: 50, y: 93, allowedActions: ['mix'] },
  { id: 'mixer3', kind: 'mixer', label: 'Mixer', emoji: '🥣', x: 67, y: 93, allowedActions: ['mix'] },
];

// A small set of starter recipes so early orders are gentle and completable
// (Wave 2). More variety is added in later waves.
export const STARTER_RECIPES: { base: CakeBase; filling: CakeFilling; topping: CakeTopping }[] = [
  { base: 'vanilla', filling: 'cream', topping: 'strawberry' },
  { base: 'chocolate', filling: 'chocCream', topping: 'choco' },
  { base: 'strawberry', filling: 'strawJam', topping: 'blueberry' },
];

export const findBase = (id: CakeBase) => BASES.find((b) => b.id === id)!;
export const findFilling = (id: CakeFilling) => FILLINGS.find((f) => f.id === id)!;
export const findTopping = (id: CakeTopping) => TOPPINGS.find((t) => t.id === id)!;

// Mode-select card copy.
export const MODE_META: Record<GameMode, { label: string; emoji: string; blurb: string }> = {
  rush: { label: 'Cake Rush', emoji: '🧁', blurb: 'Make as many cakes as you can in 2 minutes!' },
  line: { label: 'Customer Line', emoji: '🔔', blurb: 'Endless orders — keep your 3 hearts alive!' },
};

// One local player named "You". Stored in an array later (multiplayer-ready).
export function createInitialPlayer(): PlayerState {
  return {
    id: 'you',
    name: 'You',
    x: 50,
    y: 50,
    targetX: 50,
    targetY: 50,
    currentStation: null,
    heldItem: null,
    currentAction: null,
    color: '#F6A04D',
  };
}
