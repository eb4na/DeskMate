// Cake Kitchen mini-game — core types.
// Wave 0: types are shaped so later waves (movement, cooking loop, modes,
// multiplayer) slot in without rewrites. Keep this file logic-free.

export type CakeBase = 'vanilla' | 'chocolate' | 'strawberry' | 'redVelvet';
export type CakeFilling = 'cream' | 'chocCream' | 'strawJam' | 'redVelvet';
export type CakeTopping = 'strawberry' | 'cherry' | 'blueberry' | 'choco' | 'sprinkles';

// A pickable ingredient with placeholder art (emoji + color) for now.
export type IngredientDef<Id extends string = string> = {
  id: Id;
  label: string;
  emoji: string;
  color: string;
};

// A station's role. There can be more than one station of a kind (e.g. two
// mixers, two ovens), each a separate instance with its own id.
export type StationKind =
  | 'ingredient'
  | 'mixer'
  | 'oven'
  | 'assembly'
  | 'decoration'
  | 'counter'
  | 'trash';

// What a player can do. Used later for highlighting the next useful station.
export type PlayerAction =
  | 'pickBase'
  | 'mix'
  | 'bake'
  | 'addFilling'
  | 'addTopping'
  | 'serve';

// Fixed station on the top-down kitchen map. x/y are 0–100 percentages so the
// layout scales to any phone width/height. `id` is a unique instance id
// (e.g. 'mixer1'), `kind` is its role.
export type Station = {
  id: string;
  kind: StationKind;
  label: string;
  emoji: string;
  x: number; // 0–100 (% of kitchen width)
  y: number; // 0–100 (% of kitchen height)
  allowedActions: PlayerAction[];
};

// A mixer/oven job in progress (drop-and-collect). `ready` is computed from time.
export type Cooker = { base: CakeBase; startedAt: number; durationMs: number };

// The cake state machine progresses through these stages as the player works.
export type CakeStage =
  | 'idle'
  | 'holdingIngredient'
  | 'mixing'
  | 'mixed'
  | 'baking'
  | 'baked'
  | 'assembling'
  | 'decorating'
  | 'readyToServe';

export type HeldItem = {
  kind: 'base' | 'batter' | 'sponge' | 'cake';
  base?: CakeBase;
  filling?: CakeFilling;
  topping?: CakeTopping;
  orderId?: string; // the order this cake is being built for (checklist target)
  spoiled?: boolean; // a wrong ingredient was added — must be tossed and redone
};

export type CakeInProgress = {
  base?: CakeBase;
  filling?: CakeFilling;
  topping?: CakeTopping;
  stage: CakeStage;
};

export type CakeOrder = {
  id: string;
  base: CakeBase;
  filling: CakeFilling;
  topping: CakeTopping;
  createdAt?: number; // epoch ms the order appeared (for the fast-serve bonus)
  patienceMs?: number; // how long the customer waits before leaving (Customer Line)
};

export type GameMode = 'rush' | 'line';

// Screen-level phase for Wave 0 (mode select vs. in the kitchen).
export type GamePhase = 'modeSelect' | 'playing';

// Stored as an array even in single-player so multiplayer is easy to add later.
export type PlayerState = {
  id: string;
  name: string;
  x: number; // current position (% of kitchen)
  y: number;
  targetX: number; // where the player is sliding toward (Wave 1)
  targetY: number;
  // Optional waypoint path (percent coords) for obstacle-avoiding movement. When
  // set, the sprite walks the points in order; otherwise it slides straight to
  // targetX/targetY. Last point equals the final target.
  path?: { x: number; y: number }[];
  currentStation: string | null;
  heldItem: HeldItem | null;
  currentAction: PlayerAction | null;
  color: string;
};

export type GameState = {
  mode: GameMode;
  phase: GamePhase;
  players: PlayerState[];
  orders: CakeOrder[];
};
