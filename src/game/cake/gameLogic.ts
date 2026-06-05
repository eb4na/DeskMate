// Cake Kitchen mini-game — pure helpers.
// Wave 0: these are defined now but only lightly used (no timers/scoring yet).
// They are side-effect-free so later waves can drive the game from them.

import { BASES, FILLINGS, STARTER_RECIPES, TOPPINGS, createInitialPlayer } from './gameData';
import type { CakeInProgress, CakeOrder, GameMode, GameState } from './gameTypes';

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let orderCounter = 0;

// A random basic order: 1 base + 1 filling + 1 topping.
export function generateOrder(): CakeOrder {
  orderCounter += 1;
  return {
    id: `order-${orderCounter}`,
    base: pick(BASES).id,
    filling: pick(FILLINGS).id,
    topping: pick(TOPPINGS).id,
  };
}

// An order drawn from the gentle starter-recipe pool (Wave 2).
export function generateStarterOrder(): CakeOrder {
  orderCounter += 1;
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
