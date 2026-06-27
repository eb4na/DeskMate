// Pure Connect 4 game logic — shared by the vs-AI and online multiplayer modes.
// Board is row-major: board[row][col], row 0 = top, row ROWS-1 = bottom (gravity
// pulls discs down to the largest empty row index in a column).

// Board art is 7 columns × 5 rows; win is still four-in-a-row.
export const COLS = 7;
export const ROWS = 5;

export type Player = 1 | 2;
export type Disc = 0 | Player; // 0 = empty
export type Board = Disc[][];

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Disc>(COLS).fill(0));
}

/** Lowest empty row in a column, or null if the column is full / out of range. */
export function dropRow(board: Board, col: number): number | null {
  if (col < 0 || col >= COLS) return null;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return null;
}

/** Immutably drop a disc; returns the new board + landed row, or null if invalid. */
export function applyMove(
  board: Board,
  col: number,
  player: Player,
): { board: Board; row: number } | null {
  const row = dropRow(board, col);
  if (row === null) return null;
  const next = board.map((r) => r.slice());
  next[row][col] = player;
  return { board: next, row };
}

export function validCols(board: Board): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) if (board[0][c] === 0) cols.push(c);
  return cols;
}

export function isFull(board: Board): boolean {
  return validCols(board).length === 0;
}

const DIRECTIONS: [number, number][] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↙
];

/** Does `player` have 4-in-a-row? Returns the winning cells for highlighting. */
export function checkWin(board: Board, player: Player): { won: boolean; cells: [number, number][] } {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const cells: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (board[nr][nc] !== player) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return { won: true, cells };
      }
    }
  }
  return { won: false, cells: [] };
}

function winsWith(board: Board, col: number, player: Player): boolean {
  const res = applyMove(board, col, player);
  return res ? checkWin(res.board, player).won : false;
}

// --- Strong AI: alpha-beta minimax with a positional evaluation. ----------
// Depth of lookahead. The board is only 7×5, so 8 plies is near-perfect play
// while staying well under a frame on a phone (alpha-beta + center ordering
// prune most of the tree).
const AI_DEPTH = 8;
// Hard wall-clock budget for the whole search. Once it's exceeded, every remaining
// node returns the heuristic immediately (see `minimax`), so the tree collapses fast
// and the AI can NEVER block the JS thread for long (the old uncapped depth-8 search
// could stall a beat early-game). The center-first ordering means the most important
// lines are searched within budget; the win/block shortcuts keep it tactically sound.
const AI_TIME_BUDGET_MS = 250;
const WIN_SCORE = 100000;
const CENTER = Math.floor(COLS / 2);
// Search the centre first — it produces the best alpha-beta cutoffs and centre
// columns are the strongest squares.
const COL_ORDER = [3, 2, 4, 1, 5, 0, 6].filter((c) => c < COLS);

// Score a 4-cell window for `ai` (positive = good for ai). Mixed windows are
// dead (neither side can complete four there).
function windowScore(a: number, h: number): number {
  if (a > 0 && h > 0) return 0;
  if (a === 3) return 50;
  if (a === 2) return 10;
  if (a === 1) return 1;
  if (h === 3) return -55; // weight blocking a hair above building
  if (h === 2) return -10;
  if (h === 1) return -1;
  return 0;
}

// Heuristic board value from `ai`'s perspective (only called on non-terminal
// nodes — wins are caught earlier, so no window can already hold four).
function evaluate(board: Board, ai: Player, human: Player): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = board[r][CENTER];
    if (v === ai) score += 3;
    else if (v === human) score -= 3;
  }
  for (const [dr, dc] of DIRECTIONS) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let a = 0;
        let h = 0;
        for (let k = 0; k < 4; k++) {
          const cell = board[r + dr * k][c + dc * k];
          if (cell === ai) a++;
          else if (cell === human) h++;
        }
        score += windowScore(a, h);
      }
    }
  }
  return score;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ai: Player,
  human: Player,
  deadline: number,
): number {
  // Terminal: a win for either side (+depth so sooner wins / later losses win ties).
  if (checkWin(board, ai).won) return WIN_SCORE + depth;
  if (checkWin(board, human).won) return -WIN_SCORE - depth;
  const cols = COL_ORDER.filter((c) => board[0][c] === 0);
  // Stop deepening at depth 0, a full board, OR once the time budget is spent — the
  // last keeps the AI from ever thinking too long, falling back to the heuristic.
  if (depth === 0 || cols.length === 0 || Date.now() > deadline) return evaluate(board, ai, human);

  if (maximizing) {
    let best = -Infinity;
    for (const c of cols) {
      const s = minimax(applyMove(board, c, ai)!.board, depth - 1, alpha, beta, false, ai, human, deadline);
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const c of cols) {
    const s = minimax(applyMove(board, c, human)!.board, depth - 1, alpha, beta, true, ai, human, deadline);
    if (s < best) best = s;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Strong, non-repetitive AI: an alpha-beta search picks the best column, with a
 * small jitter on the root scores so genuinely-equal choices vary game to game.
 * The jitter (±~2.5) is dwarfed by any real threat (≥10) or forced win/loss
 * (≥100000), so it never causes a tactical blunder — it only shuffles openings
 * and even positions, killing the old "always the same pattern" behaviour.
 */
export function getAIMove(board: Board, ai: Player, human: Player): number {
  const cols = validCols(board);
  if (cols.length === 0) return -1;

  // Cheap insurance the search also covers: take an immediate win; block a lone
  // immediate threat. (Multiple simultaneous threats fall through to the search.)
  for (const c of cols) if (winsWith(board, c, ai)) return c;
  const threats = cols.filter((c) => winsWith(board, c, human));
  if (threats.length === 1) return threats[0];

  // Opening variety: on the AI's first move, pick among the three strong central
  // columns instead of always slamming dead centre — all are fine this early, and
  // the full search takes over once the board develops. Keeps games from feeling
  // identical without conceding anything real.
  let discs = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c] !== 0) discs++;
  if (discs <= 1) {
    const open = [2, 3, 4].filter((c) => cols.includes(c));
    if (open.length) return open[Math.floor(Math.random() * open.length)];
  }

  let best = -Infinity;
  let choice = cols[0];
  const deadline = Date.now() + AI_TIME_BUDGET_MS;
  for (const c of COL_ORDER.filter((x) => cols.includes(x))) {
    const exact = minimax(applyMove(board, c, ai)!.board, AI_DEPTH - 1, -Infinity, Infinity, false, ai, human, deadline);
    const noisy = exact + (Math.random() - 0.5) * 5;
    if (noisy > best) {
      best = noisy;
      choice = c;
    }
  }
  return choice;
}
