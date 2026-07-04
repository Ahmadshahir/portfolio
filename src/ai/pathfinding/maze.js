/**
 * Maze generation for the pathfinding visualizer.
 *
 * Recursive division: start with an open grid, split it with a wall along
 * a random row/column leaving one gap, then recurse into both halves.
 * Produces corridor-style mazes that always remain fully connected.
 */

/**
 * @param {number} rows
 * @param {number} cols
 * @param {number[]} protectedCells cell ids that must stay open (start/target)
 * @returns {Set<number>} wall cell ids
 */
export function recursiveDivisionMaze(rows, cols, protectedCells = []) {
  const walls = new Set();
  const keep = new Set(protectedCells);

  const addWall = (row, col) => {
    const id = row * cols + col;
    if (!keep.has(id)) walls.add(id);
  };

  const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1)); // inclusive

  // Even coordinates host walls, odd coordinates stay corridors — the
  // classic trick that keeps gaps aligned between recursion levels.
  const divide = (top, bottom, left, right) => {
    const height = bottom - top;
    const width = right - left;
    if (height < 2 || width < 2) return;

    const horizontal = height > width ? true : width > height ? false : Math.random() < 0.5;

    if (horizontal) {
      const candidates = [];
      for (let r = top + 1; r < bottom; r += 2) candidates.push(r);
      const wallRow = candidates[randInt(0, candidates.length - 1)];
      const gaps = [];
      for (let c = left; c <= right; c += 2) gaps.push(c);
      const gapCol = gaps[randInt(0, gaps.length - 1)];

      for (let c = left; c <= right; c++) {
        if (c !== gapCol) addWall(wallRow, c);
      }
      divide(top, wallRow - 1, left, right);
      divide(wallRow + 1, bottom, left, right);
    } else {
      const candidates = [];
      for (let c = left + 1; c < right; c += 2) candidates.push(c);
      const wallCol = candidates[randInt(0, candidates.length - 1)];
      const gaps = [];
      for (let r = top; r <= bottom; r += 2) gaps.push(r);
      const gapRow = gaps[randInt(0, gaps.length - 1)];

      for (let r = top; r <= bottom; r++) {
        if (r !== gapRow) addWall(r, wallCol);
      }
      divide(top, bottom, left, wallCol - 1);
      divide(top, bottom, wallCol + 1, right);
    }
  };

  divide(0, rows - 1, 0, cols - 1);
  return walls;
}

/** Random scatter: each cell independently becomes a wall. */
export function randomScatter(rows, cols, protectedCells = [], density = 0.28) {
  const walls = new Set();
  const keep = new Set(protectedCells);
  for (let id = 0; id < rows * cols; id++) {
    if (!keep.has(id) && Math.random() < density) walls.add(id);
  }
  return walls;
}

/** Random patches of rough terrain (higher movement cost). */
export function randomTerrain(rows, cols, protectedCells = [], density = 0.2, cost = 5) {
  const costs = new Map();
  const keep = new Set(protectedCells);
  for (let id = 0; id < rows * cols; id++) {
    if (!keep.has(id) && Math.random() < density) costs.set(id, cost);
  }
  return costs;
}
