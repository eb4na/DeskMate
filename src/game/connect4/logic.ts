// Pure Connect 4 game logic — shared by the vs-AI and online multiplayer modes.
// Board is row-major: board[row][col], row 0 = top, row ROWS-1 = bottom (gravity
// pulls discs down to the largest empty row index in a column).

// Board art is 8 columns wide; win is still four-in-a-row.
export const COLS = 8;
export const ROWS = 6;

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

/**
 * Heuristic AI: take a win, block a loss, avoid handing the opponent a win,
 * then prefer central columns, with a random fallback.
 */
export function getAIMove(board: Board, ai: Player, human: Player): number {
  const cols = validCols(board);
  if (cols.length === 0) return -1;

  // 1) Win now.
  for (const c of cols) if (winsWith(board, c, ai)) return c;
  // 2) Block the human's immediate win.
  for (const c of cols) if (winsWith(board, c, human)) return c;
  // 3) Don't play a column that lets the human win on their next turn.
  const safe = cols.filter((c) => {
    const res = applyMove(board, c, ai)!;
    return !validCols(res.board).some((hc) => winsWith(res.board, hc, human));
  });
  const pool = safe.length > 0 ? safe : cols;
  // 4) Prefer the center, then work outward.
  const preference = [3, 2, 4, 1, 5, 0, 6];
  for (const c of preference) if (pool.includes(c)) return c;
  // 5) Random fallback.
  return pool[Math.floor(Math.random() * pool.length)];
}
