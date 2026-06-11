// Cake Kitchen mini-game — pure helpers.
// Wave 0: these are defined now but only lightly used (no timers/scoring yet).
// They are side-effect-free so later waves can drive the game from them.

import {
  STARTER_RECIPES,
  createInitialPlayer,
  recipeOrder,
  recipePools,
} from './gameData';
import type { CakeInProgress, CakeOrder, GameMode, GameState, RecipeId } from './gameTypes';

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let orderCounter = 0;

// The dessert the kitchen is currently making. The game screen sets this from the
// selected (and owned) recipe; order generation reads it. Defaults to cake play.
let activeRecipe: RecipeId = 'cake';
export function setActiveRecipe(recipe: RecipeId) {
  activeRecipe = recipe;
}

// A random basic order: 1 base + 1 filling + 1 topping from the active recipe pool.
export function generateOrder(): CakeOrder {
  orderCounter += 1;
  const pools = recipePools(activeRecipe);
  return {
    id: `order-${orderCounter}`,
    base: pick(pools.bases).id,
    filling: pick(pools.fillings).id,
    topping: pick(pools.toppings).id,
  };
}

// An order for the active recipe. A special recipe (pudding, sakura) is always
// its single fixed order; cake play draws from the gentle starter-recipe pool.
export function generateStarterOrder(): CakeOrder {
  orderCounter += 1;
  const fixed = recipeOrder(activeRecipe);
  if (fixed) {
    return { id: `order-${orderCounter}`, ...fixed };
  }
  const r = pick(STARTER_RECIPES);
  return { id: `order-${orderCounter}`, base: r.base, filling: r.filling, topping: r.topping };
}

// True when the finished cake exactly matches the order.
export function cakeMatchesOrder(cake: CakeInProgress, order: CakeOrder): boolean {
  return (
    cake.stage === 'readyToServe' &&
    cake.base === order.base &&
    cake.filling === order.filling &&
    cake.topping === order.topping
  );
}

// Fresh game state for a mode. Wave 0 seeds a couple of orders for later waves.
export function createInitialState(mode: GameMode): GameState {
  return {
    mode,
    phase: 'playing',
    players: [createInitialPlayer()],
    orders: [generateOrder(), generateOrder()],
  };
}
