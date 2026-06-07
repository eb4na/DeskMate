// BatterDash kitchen navigation: feet-based collision, config-driven obstacles,
// and grid A* pathfinding. One coordinate system throughout — KITCHEN-LOCAL
// PIXELS (the `size.w × size.h` space the taps, stations and the cat live in).
// The character's collision point is its FEET (bottom-center of the sprite).
//
// Obstacles are stored as FRACTIONS of w/h so they scale with the map; flip
// NAV_DEBUG on to draw them over the art and tune NAV_CONFIG to match.

export type NavPt = { x: number; y: number };
export type NavRect = { x0: number; y0: number; x1: number; y1: number };
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Obstacle = { id: string; rect: NavRect; sides: Side[] };

// Turn on to render the debug overlay + log click/path info. Currently ON so the
// obstacle boxes are visible for tuning — set to false once they line up.
export const NAV_DEBUG = true;

export const NAV_CONFIG = {
  obstaclePadding: 7, // px clearance around each obstacle (visual breathing room)
  characterRadius: 4, // feet clearance, added to padding (keep gaps walkable)
  gridCellSize: 14, // A* grid resolution (px)
  arrivalDistance: 4, // px stop threshold
  edgeMargin: 6, // keep feet this far inside the map edges
  counterFrontFrac: 0.27, // back-counter no-go band: walkable floor starts here (y)
  counterGap: 14, // px below the counter the cat stands to serve/take orders
  // Fractional rects (0–1 of w/h) + accessible sides. TUNE with NAV_DEBUG=true.
  obstacles: [
    { id: 'ingredients', frac: { x0: 0.03, y0: 0.31, x1: 0.31, y1: 0.53 }, sides: ['right', 'bottom'] as Side[] },
    { id: 'mixer', frac: { x0: 0.03, y0: 0.59, x1: 0.36, y1: 0.79 }, sides: ['top', 'right'] as Side[] },
    { id: 'oven', frac: { x0: 0.42, y0: 0.33, x1: 0.83, y1: 0.46 }, sides: ['bottom', 'left', 'right'] as Side[] },
    { id: 'assembly', frac: { x0: 0.6, y0: 0.47, x1: 1.0, y1: 0.61 }, sides: ['left', 'bottom'] as Side[] },
    { id: 'decorate', frac: { x0: 0.6, y0: 0.63, x1: 1.0, y1: 0.76 }, sides: ['left', 'top'] as Side[] },
    { id: 'trash', frac: { x0: 0.63, y0: 0.79, x1: 1.0, y1: 0.93 }, sides: ['left', 'top'] as Side[] },
  ],
} as const;

// Map each tappable station id → the obstacle it belongs to.
export const STATION_OBSTACLE: Record<string, string> = {
  ingredient: 'ingredients',
  mixer1: 'mixer',
  mixer2: 'mixer',
  mixer3: 'mixer',
  oven1: 'oven',
  oven2: 'oven',
  oven3: 'oven',
  assembly: 'assembly',
  decoration: 'decorate',
  trash: 'trash',
};

const totalPad = () => NAV_CONFIG.obstaclePadding + NAV_CONFIG.characterRadius;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: NavPt, b: NavPt) => Math.hypot(a.x - b.x, a.y - b.y);
const inRect = (p: NavPt, r: NavRect) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
const padRect = (r: NavRect, p: number): NavRect => ({ x0: r.x0 - p, y0: r.y0 - p, x1: r.x1 + p, y1: r.y1 + p });

/** Raw obstacle rectangles in px for the current map size. */
export function obstaclesPx(w: number, h: number): Obstacle[] {
  return NAV_CONFIG.obstacles.map((o) => ({
    id: o.id,
    sides: o.sides,
    rect: { x0: o.frac.x0 * w, y0: o.frac.y0 * h, x1: o.frac.x1 * w, y1: o.frac.y1 * h },
  }));
}

/** Outer walkable bounds: inside the map, below the back counter. */
export function walkBounds(w: number, h: number): NavRect {
  const m = NAV_CONFIG.edgeMargin;
  return { x0: m, y0: NAV_CONFIG.counterFrontFrac * h, x1: w - m, y1: h - m };
}

/** Is the cat's feet point free to stand here? */
export function isWalkable(p: NavPt, obstacles: Obstacle[], bounds: NavRect): boolean {
  if (p.x < bounds.x0 || p.x > bounds.x1 || p.y < bounds.y0 || p.y > bounds.y1) return false;
  const pd = totalPad();
  for (const o of obstacles) if (inRect(p, padRect(o.rect, pd))) return false;
  return true;
}

/** Nearest walkable point to p (outward ring search). */
function nearestFree(p: NavPt, obstacles: Obstacle[], bounds: NavRect): NavPt {
  if (isWalkable(p, obstacles, bounds)) return p;
  const step = NAV_CONFIG.gridCellSize;
  const maxR = Math.hypot(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  for (let r = step; r <= maxR; r += step) {
    for (let a = 0; a < 360; a += 12) {
      const rad = (a * Math.PI) / 180;
      const c = { x: p.x + r * Math.cos(rad), y: p.y + r * Math.sin(rad) };
      if (isWalkable(c, obstacles, bounds)) return c;
    }
  }
  return { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
}

/** True if the straight segment a→b stays walkable the whole way (LOS). */
function segClear(a: NavPt, b: NavPt, obstacles: Obstacle[], bounds: NavRect): boolean {
  const d = dist(a, b);
  const steps = Math.max(1, Math.ceil(d / (NAV_CONFIG.gridCellSize / 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, obstacles, bounds)) return false;
  }
  return true;
}

/**
 * Grid A* from start→goal (feet px). 8-direction, no diagonal corner-cutting.
 * If the goal isn't reachable, returns a path to the nearest reachable cell.
 * Output is line-of-sight-smoothed waypoints (never through an obstacle).
 */
export function findPath(startRaw: NavPt, goalRaw: NavPt, obstacles: Obstacle[], bounds: NavRect): NavPt[] {
  const cell = NAV_CONFIG.gridCellSize;
  const start = nearestFree(startRaw, obstacles, bounds);
  const goal = nearestFree(goalRaw, obstacles, bounds);

  if (segClear(start, goal, obstacles, bounds)) return [goal];

  const cols = Math.ceil((bounds.x1 - bounds.x0) / cell) + 1;
  const rows = Math.ceil((bounds.y1 - bounds.y0) / cell) + 1;
  const toCell = (p: NavPt) => ({
    cx: clamp(Math.round((p.x - bounds.x0) / cell), 0, cols - 1),
    cy: clamp(Math.round((p.y - bounds.y0) / cell), 0, rows - 1),
  });
  const cellPt = (cx: number, cy: number): NavPt => ({ x: bounds.x0 + cx * cell, y: bounds.y0 + cy * cell });
  const free = (cx: number, cy: number) => isWalkable(cellPt(cx, cy), obstacles, bounds);
  const key = (cx: number, cy: number) => cy * cols + cx;

  const s = toCell(start);
  const g = toCell(goal);
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const gScore = new Map<number, number>([[key(s.cx, s.cy), 0]]);
  const came = new Map<number, number>();
  const open: { cx: number; cy: number; f: number }[] = [{ ...s, f: 0 }];
  const heur = (cx: number, cy: number) => Math.hypot(cx - g.cx, cy - g.cy);

  let bestCell = key(s.cx, s.cy);
  let bestH = heur(s.cx, s.cy);
  let found = false;
  while (open.length) {
    // pop lowest f (small grid → linear scan is fine)
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.cx, cur.cy);
    if (cur.cx === g.cx && cur.cy === g.cy) {
      found = true;
      break;
    }
    const h0 = heur(cur.cx, cur.cy);
    if (h0 < bestH) {
      bestH = h0;
      bestCell = ck;
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.cx + dx;
      const ny = cur.cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !free(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!free(cur.cx + dx, cur.cy) || !free(cur.cx, cur.cy + dy))) continue; // no corner cut
      const nk = key(nx, ny);
      const tentative = (gScore.get(ck) ?? Infinity) + Math.hypot(dx, dy);
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentative);
        came.set(nk, ck);
        const f = tentative + heur(nx, ny);
        const ex = open.find((o) => key(o.cx, o.cy) === nk);
        if (ex) ex.f = f;
        else open.push({ cx: nx, cy: ny, f });
      }
    }
  }

  // Reconstruct (to goal if found, else to the closest cell we reached).
  let endK = found ? key(g.cx, g.cy) : bestCell;
  const cells: NavPt[] = [];
  while (endK !== key(s.cx, s.cy)) {
    cells.unshift(cellPt(endK % cols, Math.floor(endK / cols)));
    const p = came.get(endK);
    if (p === undefined) break;
    endK = p;
  }
  const pts: NavPt[] = [start, ...cells, found ? goal : (cells[cells.length - 1] ?? goal)];

  // String-pull smoothing.
  const out: NavPt[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segClear(pts[i], pts[j], obstacles, bounds)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out.slice(1);
}

/**
 * Pick the interaction point next to an obstacle: the accessible side nearest
 * `ref` (the click or the cat), projected onto that side and pushed just outside,
 * preserving the side the player aimed at.
 */
export function interactionPoint(o: Obstacle, ref: NavPt, obstacles: Obstacle[], bounds: NavRect): NavPt {
  const pd = totalPad() + 2;
  const r = o.rect;
  const candFor = (side: Side): NavPt => {
    switch (side) {
      case 'bottom':
        return { x: clamp(ref.x, r.x0, r.x1), y: r.y1 + pd };
      case 'top':
        return { x: clamp(ref.x, r.x0, r.x1), y: r.y0 - pd };
      case 'left':
        return { x: r.x0 - pd, y: clamp(ref.y, r.y0, r.y1) };
      case 'right':
        return { x: r.x1 + pd, y: clamp(ref.y, r.y0, r.y1) };
    }
  };
  const cands = o.sides.map(candFor);
  const walkable = cands.filter((c) => isWalkable(c, obstacles, bounds));
  const pool = walkable.length ? walkable : cands;
  let best = pool[0];
  let bestD = dist(best, ref);
  for (const c of pool) {
    const d = dist(c, ref);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return isWalkable(best, obstacles, bounds) ? best : nearestFree(best, obstacles, bounds);
}

/**
 * Turn a tap (feet px) into a destination. Open floor → the tap (nudged off
 * obstacles); a station/table → its accessible-side interaction point; the back
 * counter band → the floor directly in front, aligned to the tap's x.
 */
export function resolveClick(
  click: NavPt,
  from: NavPt,
  obstacles: Obstacle[],
  bounds: NavRect,
): { dest: NavPt; stationId: string | null } {
  // Back counter (above the walkable area) → stand in front, aligned to click x.
  if (click.y < bounds.y0) {
    const dest = nearestFree(
      { x: clamp(click.x, bounds.x0, bounds.x1), y: bounds.y0 + NAV_CONFIG.counterGap },
      obstacles,
      bounds,
    );
    return { dest, stationId: 'counter' };
  }
  // Directly on a station/table → its near accessible side.
  const onObstacle = obstacles.find((o) => inRect(click, o.rect));
  if (onObstacle) return { dest: interactionPoint(onObstacle, click, obstacles, bounds), stationId: onObstacle.id };
  // Too close to a station (inside its padding) → also step beside it.
  const pd = totalPad();
  const near = obstacles.find((o) => inRect(click, padRect(o.rect, pd)));
  if (near) return { dest: interactionPoint(near, click, obstacles, bounds), stationId: null };
  // Open floor.
  const clamped = { x: clamp(click.x, bounds.x0, bounds.x1), y: clamp(click.y, bounds.y0, bounds.y1) };
  return { dest: nearestFree(clamped, obstacles, bounds), stationId: null };
}

/** Interaction point for tapping a station button (approach from the cat's side). */
export function stationTarget(
  stationId: string,
  from: NavPt,
  obstacles: Obstacle[],
  bounds: NavRect,
): NavPt {
  const obId = STATION_OBSTACLE[stationId];
  const o = obstacles.find((ob) => ob.id === obId);
  if (!o) return nearestFree(from, obstacles, bounds);
  return interactionPoint(o, from, obstacles, bounds);
}
