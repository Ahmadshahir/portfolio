import { MinHeap, bfs, dfs, dijkstra, astar, greedy } from "./pathfinding/algorithms";
import { recursiveDivisionMaze, randomScatter, randomTerrain } from "./pathfinding/maze";

const openGrid = (rows, cols) => ({
  rows,
  cols,
  start: 0,
  target: rows * cols - 1,
  walls: new Set(),
  costs: new Map(),
});

describe("MinHeap", () => {
  it("pops values in priority order", () => {
    const heap = new MinHeap();
    [5, 1, 4, 2, 3].forEach((p) => heap.push(`v${p}`, p));
    const out = [];
    while (heap.size > 0) out.push(heap.pop());
    expect(out).toEqual(["v1", "v2", "v3", "v4", "v5"]);
  });

  it("breaks ties first-in first-out", () => {
    const heap = new MinHeap();
    heap.push("first", 1);
    heap.push("second", 1);
    heap.push("third", 1);
    expect(heap.pop()).toBe("first");
    expect(heap.pop()).toBe("second");
    expect(heap.pop()).toBe("third");
  });
});

describe("shortest-path algorithms", () => {
  it("BFS finds a shortest path on an open grid", () => {
    const spec = openGrid(5, 8);
    const { path, cost } = bfs(spec);
    // Manhattan distance corner to corner: (5-1) + (8-1) = 11 steps
    expect(cost).toBe(11);
    expect(path[0]).toBe(spec.start);
    expect(path[path.length - 1]).toBe(spec.target);
  });

  it("A* matches Dijkstra's optimal cost on random weighted grids", () => {
    for (let trial = 0; trial < 25; trial++) {
      const spec = openGrid(12, 12);
      spec.walls = randomScatter(12, 12, [spec.start, spec.target], 0.25);
      spec.costs = randomTerrain(12, 12, [spec.start, spec.target], 0.3, 6);
      const d = dijkstra(spec);
      const a = astar(spec);
      expect(a.path === null).toBe(d.path === null);
      if (d.path) expect(a.cost).toBe(d.cost);
    }
  });

  it("A* expands fewer cells than Dijkstra on an open grid", () => {
    const spec = openGrid(20, 20);
    const d = dijkstra(spec);
    const a = astar(spec);
    expect(a.path).not.toBeNull();
    expect(a.expanded).toBeLessThan(d.expanded / 2);
  });

  it("every algorithm returns null when the target is walled off", () => {
    const spec = openGrid(6, 6);
    // Box in the target (bottom-right corner) completely
    const t = spec.target;
    spec.walls = new Set([t - 1, t - 6, t - 7]);
    for (const run of [bfs, dfs, dijkstra, astar, greedy]) {
      expect(run(spec).path).toBeNull();
    }
  });

  it("never walks through walls", () => {
    for (let trial = 0; trial < 10; trial++) {
      const spec = openGrid(10, 10);
      spec.walls = randomScatter(10, 10, [spec.start, spec.target], 0.3);
      for (const run of [bfs, dfs, dijkstra, astar, greedy]) {
        const { path, visitedOrder } = run(spec);
        for (const id of visitedOrder) expect(spec.walls.has(id)).toBe(false);
        if (path) for (const id of path) expect(spec.walls.has(id)).toBe(false);
      }
    }
  });

  it("Dijkstra routes around expensive terrain", () => {
    // 3x5 grid: straight middle row is coated in cost-10 mud. Going around
    // through the top row costs 6; straight through costs > 20.
    const spec = { rows: 3, cols: 5, start: 5, target: 9, walls: new Set(), costs: new Map() };
    [6, 7, 8].forEach((id) => spec.costs.set(id, 10));
    const { path, cost } = dijkstra(spec);
    expect(cost).toBe(6);
    expect(path).not.toContain(6);
    expect(path).not.toContain(7);
    expect(path).not.toContain(8);
  });

  it("greedy always finds some path when one exists", () => {
    for (let trial = 0; trial < 15; trial++) {
      const spec = openGrid(12, 12);
      spec.walls = randomScatter(12, 12, [spec.start, spec.target], 0.2);
      const reference = bfs(spec);
      const g = greedy(spec);
      expect(g.path === null).toBe(reference.path === null);
      if (g.path) {
        expect(g.path[0]).toBe(spec.start);
        expect(g.path[g.path.length - 1]).toBe(spec.target);
      }
    }
  });
});

describe("maze generation", () => {
  it("recursive division mazes are always solvable", () => {
    for (let trial = 0; trial < 10; trial++) {
      const rows = 21;
      const cols = 41;
      const start = 22; // row 0-ish area
      const target = rows * cols - 23;
      const walls = recursiveDivisionMaze(rows, cols, [start, target]);
      expect(walls.has(start)).toBe(false);
      expect(walls.has(target)).toBe(false);
      const { path } = bfs({ rows, cols, start, target, walls });
      expect(path).not.toBeNull();
    }
  });

  it("random scatter respects protected cells", () => {
    const walls = randomScatter(10, 10, [0, 99], 0.9);
    expect(walls.has(0)).toBe(false);
    expect(walls.has(99)).toBe(false);
    expect(walls.size).toBeGreaterThan(50);
  });

  it("random terrain assigns the requested cost", () => {
    const costs = randomTerrain(10, 10, [0], 0.5, 7);
    expect(costs.has(0)).toBe(false);
    expect(costs.size).toBeGreaterThan(10);
    for (const value of costs.values()) expect(value).toBe(7);
  });
});
