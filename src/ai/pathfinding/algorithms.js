/**
 * Grid pathfinding algorithms from scratch: BFS, DFS, Dijkstra, A* and
 * Greedy Best-First Search, all built on the same expansion loop so their
 * behaviour differences come purely from the frontier data structure and
 * the scoring function — which is exactly the point of the visualizer.
 *
 * The grid is a {rows, cols} rectangle. Cells are integer ids
 * (row * cols + col). Walls are impassable; every other cell has a
 * movement cost (1 by default, higher for "rough terrain").
 */

/** Binary min-heap keyed by priority, with FIFO tie-breaking. */
export class MinHeap {
  constructor() {
    this.items = [];
    this.counter = 0; // stable ordering for equal priorities
  }

  get size() {
    return this.items.length;
  }

  push(value, priority) {
    this.items.push({ value, priority, order: this.counter++ });
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top?.value;
  }

  less(a, b) {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.order < b.order;
  }

  bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  sinkDown(i) {
    const n = this.items.length;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.less(this.items[left], this.items[smallest])) smallest = left;
      if (right < n && this.less(this.items[right], this.items[smallest])) smallest = right;
      if (smallest === i) return;
      [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
      i = smallest;
    }
  }
}

/**
 * @typedef {Object} GridSpec
 * @property {number} rows
 * @property {number} cols
 * @property {number} start cell id
 * @property {number} target cell id
 * @property {Set<number>} walls impassable cell ids
 * @property {Map<number, number>} [costs] per-cell entry cost (default 1)
 */

function neighbors(id, rows, cols) {
  const row = Math.floor(id / cols);
  const col = id % cols;
  const out = [];
  if (row > 0) out.push(id - cols);
  if (col < cols - 1) out.push(id + 1);
  if (row < rows - 1) out.push(id + cols);
  if (col > 0) out.push(id - 1);
  return out;
}

function manhattan(a, b, cols) {
  return (
    Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) + Math.abs((a % cols) - (b % cols))
  );
}

function cellCost(costs, id) {
  return costs?.get(id) ?? 1;
}

function reconstruct(cameFrom, target) {
  const path = [target];
  let current = target;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.push(current);
  }
  return path.reverse();
}

function pathCost(path, costs) {
  // Cost of entering each cell after the start
  let total = 0;
  for (let i = 1; i < path.length; i++) total += cellCost(costs, path[i]);
  return total;
}

/**
 * Shared result shape for every algorithm.
 *
 * @typedef {Object} SearchResult
 * @property {number[]} visitedOrder cells in the order they were expanded
 * @property {number[] | null} path start->target, or null if unreachable
 * @property {number} cost total path cost (0 if unreachable)
 * @property {number} expanded number of cells expanded
 */

/** Breadth-first search: ignores costs, optimal for unweighted grids. */
export function bfs({ rows, cols, start, target, walls }) {
  const queue = [start];
  const cameFrom = new Map();
  const seen = new Set([start]);
  const visitedOrder = [];

  while (queue.length > 0) {
    const current = queue.shift();
    visitedOrder.push(current);
    if (current === target) {
      const path = reconstruct(cameFrom, target);
      return { visitedOrder, path, cost: path.length - 1, expanded: visitedOrder.length };
    }
    for (const next of neighbors(current, rows, cols)) {
      if (seen.has(next) || walls.has(next)) continue;
      seen.add(next);
      cameFrom.set(next, current);
      queue.push(next);
    }
  }
  return { visitedOrder, path: null, cost: 0, expanded: visitedOrder.length };
}

/** Depth-first search: not optimal — included to show why that matters. */
export function dfs({ rows, cols, start, target, walls }) {
  const stack = [start];
  const cameFrom = new Map();
  const seen = new Set([start]);
  const visitedOrder = [];

  while (stack.length > 0) {
    const current = stack.pop();
    visitedOrder.push(current);
    if (current === target) {
      const path = reconstruct(cameFrom, target);
      return { visitedOrder, path, cost: path.length - 1, expanded: visitedOrder.length };
    }
    for (const next of neighbors(current, rows, cols)) {
      if (seen.has(next) || walls.has(next)) continue;
      seen.add(next);
      cameFrom.set(next, current);
      stack.push(next);
    }
  }
  return { visitedOrder, path: null, cost: 0, expanded: visitedOrder.length };
}

/**
 * Core of Dijkstra, A* and Greedy: a priority-queue search where the
 * frontier is ordered by g(n)*gWeight + h(n)*hWeight.
 *   Dijkstra: g only. A*: g + h. Greedy: h only.
 */
function heapSearch(spec, gWeight, hWeight) {
  const { rows, cols, start, target, walls, costs } = spec;
  const heap = new MinHeap();
  const gScore = new Map([[start, 0]]);
  const cameFrom = new Map();
  const done = new Set();
  const visitedOrder = [];

  // Tie-break equal f-scores toward the goal (smaller h wins). Without
  // this, A* on an open grid expands EVERY cell between start and target,
  // because they all share the same f. The term is far smaller than any
  // real cost difference, so optimality is unaffected.
  const priority = (g, h) => gWeight * g + hWeight * h + (hWeight ? h * 1e-6 : 0);

  heap.push(start, priority(0, manhattan(start, target, cols)));

  while (heap.size > 0) {
    const current = heap.pop();
    if (done.has(current)) continue; // stale heap entry
    done.add(current);
    visitedOrder.push(current);

    if (current === target) {
      const path = reconstruct(cameFrom, target);
      return { visitedOrder, path, cost: pathCost(path, costs), expanded: visitedOrder.length };
    }

    for (const next of neighbors(current, rows, cols)) {
      if (walls.has(next) || done.has(next)) continue;
      const tentative = gScore.get(current) + cellCost(costs, next);
      if (tentative < (gScore.get(next) ?? Infinity)) {
        gScore.set(next, tentative);
        cameFrom.set(next, current);
        heap.push(next, priority(tentative, manhattan(next, target, cols)));
      }
    }
  }
  return { visitedOrder, path: null, cost: 0, expanded: visitedOrder.length };
}

/** Dijkstra's algorithm: optimal for weighted grids, explores uniformly. */
export function dijkstra(spec) {
  return heapSearch(spec, 1, 0);
}

/** A*: optimal like Dijkstra, but the heuristic focuses the search. */
export function astar(spec) {
  return heapSearch(spec, 1, 1);
}

/** Greedy best-first: fast but can return wildly suboptimal paths. */
export function greedy(spec) {
  return heapSearch(spec, 0, 1);
}

export const ALGORITHMS = {
  astar: { name: "A* Search", run: astar, optimal: true, weighted: true },
  dijkstra: { name: "Dijkstra", run: dijkstra, optimal: true, weighted: true },
  bfs: { name: "Breadth-First", run: bfs, optimal: "unweighted", weighted: false },
  greedy: { name: "Greedy Best-First", run: greedy, optimal: false, weighted: true },
  dfs: { name: "Depth-First", run: dfs, optimal: false, weighted: false },
};
