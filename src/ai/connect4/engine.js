/**
 * Connect 4 engine — minimax search with alpha-beta pruning, centre-first
 * move ordering and iterative deepening under a time budget. At the top
 * difficulty it searches hundreds of thousands of positions per move.
 *
 * Board representation: column-major array of columns, each an array of
 * cells from bottom to top. 1 = human, 2 = AI, 0 = empty.
 */

export const COLS = 7;
export const ROWS = 6;
export const HUMAN = 1;
export const AI = 2;

const WIN_SCORE = 1_000_000;

export function emptyBoard() {
  return Array.from({ length: COLS }, () => new Array(ROWS).fill(0));
}

/** Returns the row the piece landed in, or -1 if the column is full. */
export function drop(board, col, player) {
  const column = board[col];
  for (let row = 0; row < ROWS; row++) {
    if (column[row] === 0) {
      column[row] = player;
      return row;
    }
  }
  return -1;
}

export function undo(board, col) {
  const column = board[col];
  for (let row = ROWS - 1; row >= 0; row--) {
    if (column[row] !== 0) {
      column[row] = 0;
      return;
    }
  }
}

export function validMoves(board) {
  const moves = [];
  // Centre-first ordering makes alpha-beta pruning dramatically stronger
  const order = [3, 2, 4, 1, 5, 0, 6];
  for (const col of order) {
    if (board[col][ROWS - 1] === 0) moves.push(col);
  }
  return moves;
}

export function isFull(board) {
  return board.every((column) => column[ROWS - 1] !== 0);
}

const DIRECTIONS = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal /
  [1, -1], // diagonal \
];

/** Checks whether `player` has four in a row anywhere on the board. */
export function checkWin(board, player) {
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (board[col][row] !== player) continue;
      for (const [dc, dr] of DIRECTIONS) {
        let count = 1;
        let c = col + dc;
        let r = row + dr;
        while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[c][r] === player) {
          count++;
          if (count === 4) return true;
          c += dc;
          r += dr;
        }
      }
    }
  }
  return false;
}

/** Returns the four winning cell coordinates, for highlighting in the UI. */
export function winningCells(board, player) {
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (board[col][row] !== player) continue;
      for (const [dc, dr] of DIRECTIONS) {
        const cells = [[col, row]];
        let c = col + dc;
        let r = row + dr;
        while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[c][r] === player) {
          cells.push([c, r]);
          if (cells.length === 4) return cells;
          c += dc;
          r += dr;
        }
      }
    }
  }
  return null;
}

/** Scores a window of four cells for the heuristic evaluation. */
function scoreWindow(window, player) {
  const opponent = player === AI ? HUMAN : AI;
  let mine = 0;
  let theirs = 0;
  let empty = 0;
  for (const cell of window) {
    if (cell === player) mine++;
    else if (cell === opponent) theirs++;
    else empty++;
  }
  if (mine === 4) return 10000;
  if (mine === 3 && empty === 1) return 60;
  if (mine === 2 && empty === 2) return 8;
  if (theirs === 3 && empty === 1) return -70; // blocking matters slightly more
  if (theirs === 2 && empty === 2) return -8;
  return 0;
}

/** Static evaluation of a non-terminal position from `player`'s view. */
export function evaluate(board, player) {
  let score = 0;

  // Centre-column control is worth extra
  for (let row = 0; row < ROWS; row++) {
    if (board[3][row] === player) score += 5;
  }

  // Score every possible 4-in-a-row window
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      for (const [dc, dr] of DIRECTIONS) {
        const endC = col + 3 * dc;
        const endR = row + 3 * dr;
        if (endC < 0 || endC >= COLS || endR < 0 || endR >= ROWS) continue;
        const window = [
          board[col][row],
          board[col + dc][row + dr],
          board[col + 2 * dc][row + 2 * dr],
          board[endC][endR],
        ];
        score += scoreWindow(window, player);
      }
    }
  }
  return score;
}

let nodesSearched = 0;

function minimax(board, depth, alpha, beta, maximizing, deadline) {
  nodesSearched++;
  if (nodesSearched % 4096 === 0 && performance.now() > deadline) {
    throw new Error("timeout"); // abandon this depth; earlier result stands
  }

  if (checkWin(board, AI)) return WIN_SCORE + depth; // prefer faster wins
  if (checkWin(board, HUMAN)) return -WIN_SCORE - depth;
  if (isFull(board)) return 0;
  if (depth === 0) return evaluate(board, AI);

  const moves = validMoves(board);
  if (maximizing) {
    let best = -Infinity;
    for (const col of moves) {
      drop(board, col, AI);
      const score = minimax(board, depth - 1, alpha, beta, false, deadline);
      undo(board, col);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const col of moves) {
    drop(board, col, HUMAN);
    const score = minimax(board, depth - 1, alpha, beta, true, deadline);
    undo(board, col);
    if (score < best) best = score;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Picks the AI's move.
 *
 * @param {number[][]} board
 * @param {{maxDepth: number, timeBudgetMs: number, blunderChance?: number}} options
 * @returns {{col: number, nodes: number, depth: number, score: number}}
 */
export function bestMove(board, { maxDepth = 9, timeBudgetMs = 900, blunderChance = 0 } = {}) {
  const moves = validMoves(board);

  // Easy modes occasionally play a random (non-losing-on-the-spot) move
  if (blunderChance > 0 && Math.random() < blunderChance) {
    const col = moves[Math.floor(Math.random() * moves.length)];
    return { col, nodes: 0, depth: 0, score: 0 };
  }

  nodesSearched = 0;
  const deadline = performance.now() + timeBudgetMs;
  let bestCol = moves[0];
  let bestScore = -Infinity;
  let completedDepth = 0;

  // Iterative deepening: always have a full answer from the last depth
  for (let depth = 2; depth <= maxDepth; depth++) {
    try {
      let currentBest = moves[0];
      let currentScore = -Infinity;
      let alpha = -Infinity;
      for (const col of moves) {
        drop(board, col, AI);
        const score = minimax(board, depth - 1, alpha, Infinity, false, deadline);
        undo(board, col);
        if (score > currentScore) {
          currentScore = score;
          currentBest = col;
        }
        if (currentScore > alpha) alpha = currentScore;
      }
      bestCol = currentBest;
      bestScore = currentScore;
      completedDepth = depth;
      // A forced win found — no need to search deeper
      if (bestScore >= WIN_SCORE) break;
    } catch (e) {
      break; // ran out of time mid-depth; keep the previous depth's move
    }
  }

  return { col: bestCol, nodes: nodesSearched, depth: completedDepth, score: bestScore };
}
