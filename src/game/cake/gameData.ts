// Cake Kitchen mini-game — static data + placeholder art.
// Placeholder art is emoji + soft color boxes; swap for PNGs in Wave 6.

import type {
  CakeBase,
  CakeFilling,
  CakeTopping,
  GameMode,
  IngredientDef,
  PlayerState,
  Station,
} from './gameTypes';

export const BASES: IngredientDef<CakeBase>[] = [
  { id: 'vanilla', label: 'Vanilla', emoji: '🟡', color: '#FDE6B8' },
  { id: 'chocolate', label: 'Chocolate', emoji: '🟤', color: '#C99878' },
  { id: 'strawberry', label: 'Strawberry', emoji: '🩷', color: '#F7B6C6' },
  { id: 'blueberry', label: 'Blueberry', emoji: '🔵', color: '#B9C6F2' },
];

export const FILLINGS: IngredientDef<CakeFilling>[] = [
  { id: 'cream', label: 'Cream', emoji: '🥛', color: '#FFF6E9' },
  { id: 'chocCream', label: 'Choc Cream', emoji: '🍫', color: '#B07A5C' },
  { id: 'strawJam', label: 'Strawberry Jam', emoji: '🍓', color: '#F28BA0' },
  { id: 'blueJam', label: 'Blueberry Jam', emoji: '🫐', color: '#8E9BE0' },
];

export const TOPPINGS: IngredientDef<CakeTopping>[] = [
  { id: 'strawberry', label: 'Strawberry', emoji: '🍓', color: '#F28BA0' },
  { id: 'cherry', label: 'Cherry', emoji: '🍒', color: '#E26A7E' },
  { id: 'blueberry', label: 'Blueberry', emoji: '🫐', color: '#8E9BE0' },
  { id: 'chocChunks', label: 'Choc Chunks', emoji: '🍫', color: '#B07A5C' },
  { id: 'sprinkles', label: 'Sprinkles', emoji: '✨', color: '#FAD9A0' },
];

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
  { base: 'chocolate', filling: 'chocCream', topping: 'chocChunks' },
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
