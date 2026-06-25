// Pure 2048 game logic — no React, no rendering. Tiles are tracked as objects
// with a stable `id` so the screen can animate each one sliding to its new cell
// before merges/spawns are committed.

export const GRID = 4;
export const WIN_VALUE = 2048;

export type Dir = 'up' | 'down' | 'left' | 'right';

export type Tile = {
  id: number;
  value: number;
  row: number; // 0 = top
  col: number; // 0 = left
};

export type SlideResult = {
  /** Surviving tiles with their final value + position (merged tiles already doubled). */
  tiles: Tile[];
  /** Tiles that disappear into a merge — each carries the cell it should slide into first. */
  removed: { id: number; row: number; col: number }[];
  /** Ids of surviving tiles that absorbed a merge this move (used to trigger a pop). */
  mergedIds: number[];
  /** Points earned this move (sum of the new doubled values). */
  gained: number;
  /** Whether anything actually moved or merged (gates the spawn of a new tile). */
  moved: boolean;
};

// For a direction, list each line's cells ordered from the destination wall
// outward, so compacting toward index 0 of the returned list slides to the wall.
function lines(dir: Dir): { r: number; c: number }[][] {
  const out: { r: number; c: number }[][] = [];
  for (let i = 0; i < GRID; i++) {
    const line: { r: number; c: number }[] = [];
    for (let j = 0; j < GRID; j++) {
      // j counts distance from the wall.
      let r: number;
      let c: number;
      switch (dir) {
        case 'left':
          r = i;
          c = j;
          break;
        case 'right':
          r = i;
          c = GRID - 1 - j;
          break;
        case 'up':
          r = j;
          c = i;
          break;
        case 'down':
          r = GRID - 1 - j;
          c = i;
          break;
      }
      line.push({ r, c });
    }
    out.push(line);
  }
  return out;
}

/** Apply a swipe. Returns the post-move tiles plus animation metadata. Pure. */
export function slide(input: Tile[], dir: Dir): SlideResult {
  const at = new Map<string, Tile>();
  for (const t of input) at.set(`${t.row},${t.col}`, t);

  const survivors: Tile[] = [];
  const removed: { id: number; row: number; col: number }[] = [];
  const mergedIds: number[] = [];
  let gained = 0;
  let moved = false;

  for (const line of lines(dir)) {
    // Tiles in this line, ordered from the wall outward.
    const ordered: Tile[] = [];
    for (const cell of line) {
      const t = at.get(`${cell.r},${cell.c}`);
      if (t) ordered.push(t);
    }

    let slot = 0; // next free position from the wall
    let lastPlaced: Tile | null = null;
    let lastMerged = false;

    for (const t of ordered) {
      if (lastPlaced && lastPlaced.value === t.value && !lastMerged) {
        // Merge into the previously placed tile (which sits at slot-1).
        const dest = line[slot - 1];
        const newValue = lastPlaced.value * 2;
        lastPlaced.value = newValue;
        gained += newValue;
        mergedIds.push(lastPlaced.id);
        removed.push({ id: t.id, row: dest.r, col: dest.c });
        lastMerged = true;
        moved = true;
      } else {
        const dest = line[slot];
        if (t.row !== dest.r || t.col !== dest.c) moved = true;
        const placed: Tile = { id: t.id, value: t.value, row: dest.r, col: dest.c };
        survivors.push(placed);
        lastPlaced = placed;
        lastMerged = false;
        slot++;
      }
    }
  }

  return { tiles: survivors, removed, mergedIds, gained, moved };
}

/** First free random cell gets a new tile (2 at 90%, 4 at 10%). Null if full. */
export function spawnTile(tiles: Tile[], id: number): Tile | null {
  const taken = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const free: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!taken.has(`${r},${c}`)) free.push({ row: r, col: c });
    }
  }
  if (free.length === 0) return null;
  const cell = free[Math.floor(Math.random() * free.length)];
  return { id, value: Math.random() < 0.9 ? 2 : 4, row: cell.row, col: cell.col };
}

/** True while at least one move is possible (an empty cell, or an adjacent equal pair). */
export function hasMoves(tiles: Tile[]): boolean {
  if (tiles.length < GRID * GRID) return true;
  const grid: (number | null)[][] = Array.from({ length: GRID }, () => Array<number | null>(GRID).fill(null));
  for (const t of tiles) grid[t.row][t.col] = t.value;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = grid[r][c];
      if (v === null) return true;
      if (c + 1 < GRID && grid[r][c + 1] === v) return true;
      if (r + 1 < GRID && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}
