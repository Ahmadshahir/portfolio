import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import Footer from "../../../components/Footer";
import { ALGORITHMS } from "../../../ai/pathfinding/algorithms";
import { recursiveDivisionMaze, randomTerrain } from "../../../ai/pathfinding/maze";
import "../ailab.css";
import "./pathfinder.css";

const ROWS = 23;
const COLS = 45;
const TERRAIN_COST = 5;

/**
 * Pathfinder — an interactive visualizer for five classic search
 * algorithms. Draw walls and rough terrain, generate mazes, then watch
 * each algorithm explore the grid and compare their stats head-to-head.
 *
 * The grid is updated imperatively (className on cell DOM nodes) so the
 * search animation stays smooth across a thousand cells — React re-renders
 * are reserved for the controls and the stats table.
 *
 * @component
 */

const Pathfinder = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const cellRefs = useRef([]);
  const walls = useRef(new Set());
  const costs = useRef(new Map());
  const startId = useRef(11 * COLS + 6);
  const targetId = useRef(11 * COLS + (COLS - 7));
  const painting = useRef(null); // 'draw' | 'erase' | 'start' | 'target' | null
  const timer = useRef(null);
  const runningRef = useRef(false);

  const [algorithm, setAlgorithm] = useState("astar");
  const [drawMode, setDrawMode] = useState("wall"); // wall | terrain
  const [speed, setSpeed] = useState(8);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({});
  const speedRef = useRef(speed);
  speedRef.current = speed;

  /** Recomputes one cell's className from the refs. */
  const paintCell = useCallback((id, extra = "") => {
    const node = cellRefs.current[id];
    if (!node) return;
    let cls = "pfCell";
    if (walls.current.has(id)) cls += " wall";
    if (costs.current.has(id)) cls += " terrain";
    if (id === startId.current) cls += " start";
    if (id === targetId.current) cls += " target";
    node.className = cls + (extra ? ` ${extra}` : "");
  }, []);

  const clearSearchPaint = useCallback(() => {
    clearInterval(timer.current);
    for (let id = 0; id < ROWS * COLS; id++) {
      const node = cellRefs.current[id];
      if (node && /visited|path|head/.test(node.className)) paintCell(id);
    }
  }, [paintCell]);

  const stopRun = useCallback(() => {
    clearInterval(timer.current);
    runningRef.current = false;
    setRunning(false);
  }, []);

  // --- Painting interactions ---
  const handleCellDown = useCallback(
    (id) => {
      if (runningRef.current) return;
      clearSearchPaint();
      if (id === startId.current) {
        painting.current = "start";
      } else if (id === targetId.current) {
        painting.current = "target";
      } else if (drawMode === "wall") {
        painting.current = walls.current.has(id) ? "erase" : "draw";
        applyPaint(id);
      } else {
        painting.current = costs.current.has(id) ? "erase" : "draw";
        applyPaint(id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawMode, clearSearchPaint]
  );

  const applyPaint = useCallback(
    (id) => {
      if (id === startId.current || id === targetId.current) return;
      if (drawMode === "wall") {
        if (painting.current === "draw") {
          walls.current.add(id);
          costs.current.delete(id);
        } else {
          walls.current.delete(id);
        }
      } else {
        if (painting.current === "draw") {
          costs.current.set(id, TERRAIN_COST);
          walls.current.delete(id);
        } else {
          costs.current.delete(id);
        }
      }
      paintCell(id);
    },
    [drawMode, paintCell]
  );

  const handleCellEnter = useCallback(
    (id) => {
      if (!painting.current || runningRef.current) return;
      if (painting.current === "start" || painting.current === "target") {
        const endpoint = painting.current === "start" ? startId : targetId;
        if (walls.current.has(id) || id === startId.current || id === targetId.current) return;
        const previous = endpoint.current;
        endpoint.current = id;
        paintCell(previous);
        paintCell(id);
      } else {
        applyPaint(id);
      }
    },
    [applyPaint, paintCell]
  );

  const handlePointerUp = useCallback(() => {
    painting.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      clearInterval(timer.current);
    };
  }, [handlePointerUp]);

  // --- Board tools ---
  const clearBoard = () => {
    if (runningRef.current) stopRun();
    clearSearchPaint();
    walls.current.clear();
    costs.current.clear();
    for (let id = 0; id < ROWS * COLS; id++) paintCell(id);
  };

  const generateMaze = () => {
    if (runningRef.current) stopRun();
    clearSearchPaint();
    costs.current.clear();
    walls.current = recursiveDivisionMaze(ROWS, COLS, [startId.current, targetId.current]);
    for (let id = 0; id < ROWS * COLS; id++) paintCell(id);
  };

  const generateTerrain = () => {
    if (runningRef.current) stopRun();
    clearSearchPaint();
    const patches = randomTerrain(ROWS, COLS, [startId.current, targetId.current], 0.22, TERRAIN_COST);
    for (const id of patches.keys()) {
      if (!walls.current.has(id)) costs.current.set(id, TERRAIN_COST);
    }
    for (let id = 0; id < ROWS * COLS; id++) paintCell(id);
  };

  // --- Search + animation ---
  const visualize = () => {
    if (runningRef.current) return;
    clearSearchPaint();

    const spec = {
      rows: ROWS,
      cols: COLS,
      start: startId.current,
      target: targetId.current,
      walls: walls.current,
      costs: costs.current,
    };
    const t0 = performance.now();
    const result = ALGORITHMS[algorithm].run(spec);
    const elapsed = performance.now() - t0;

    setResults((prev) => ({
      ...prev,
      [algorithm]: {
        expanded: result.expanded,
        cost: result.path ? result.cost : null,
        length: result.path ? result.path.length - 1 : null,
        time: elapsed,
      },
    }));

    runningRef.current = true;
    setRunning(true);

    const { visitedOrder, path } = result;
    let i = 0;
    let pathIndex = 0;
    timer.current = setInterval(() => {
      // Phase 1: flood the visited cells
      if (i < visitedOrder.length) {
        for (let n = 0; n < speedRef.current && i < visitedOrder.length; n++, i++) {
          paintCell(visitedOrder[i], "visited");
        }
        return;
      }
      // Phase 2: trace the final path
      if (path && pathIndex < path.length) {
        paintCell(path[pathIndex], "path");
        pathIndex++;
        return;
      }
      stopRun();
    }, 12);
  };

  return (
    <>
      <main className="ailab container pathfinderLab">
        <PageHeader title="Pathfinder" description="Watch search algorithms think" />

        <p className="labIntro">
          Five classic search algorithms racing over the same grid — A*, Dijkstra, breadth-first,
          greedy best-first and depth-first, each written from scratch on a binary min-heap. Draw
          walls, spread rough terrain (cost {TERRAIN_COST}&times; to cross), drag the endpoints,
          generate a maze — then watch how differently each algorithm explores, and compare their
          stats below.
        </p>

        <section className="pfToolbar">
          <div className="pfControl">
            <label htmlFor="pfAlgorithm">Algorithm</label>
            <select
              id="pfAlgorithm"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              disabled={running}
            >
              {Object.entries(ALGORITHMS).map(([key, algo]) => (
                <option key={key} value={key}>
                  {algo.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pfControl">
            <label>Draw</label>
            <div className="pfToggle">
              <button
                className={drawMode === "wall" ? "active" : ""}
                onClick={() => setDrawMode("wall")}
              >
                Wall
              </button>
              <button
                className={drawMode === "terrain" ? "active" : ""}
                onClick={() => setDrawMode("terrain")}
              >
                Terrain
              </button>
            </div>
          </div>

          <div className="pfControl">
            <label htmlFor="pfSpeed">Speed</label>
            <input
              id="pfSpeed"
              type="range"
              min="1"
              max="30"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            />
          </div>

          <div className="pfButtons">
            <button className="btn labBtn small" onClick={visualize} disabled={running}>
              Visualize
            </button>
            <button className="btn labBtn small secondary" onClick={generateMaze}>
              Maze
            </button>
            <button className="btn labBtn small secondary" onClick={generateTerrain}>
              Terrain
            </button>
            <button className="btn labBtn small secondary" onClick={clearBoard}>
              Clear
            </button>
          </div>
        </section>

        <PathfinderGrid
          cellRefs={cellRefs}
          onCellDown={handleCellDown}
          onCellEnter={handleCellEnter}
          initialStart={startId.current}
          initialTarget={targetId.current}
        />

        <p className="hint">
          Drag to draw &middot; drag the circles to move start and target &middot; darker cells are
          rough terrain
        </p>

        <section className="pfResults">
          <h4 className="panelTitle">Head-to-head</h4>
          <div className="pfTableWrap">
            <table className="pfTable">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Guarantees shortest?</th>
                  <th>Cells expanded</th>
                  <th>Path cost</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ALGORITHMS).map(([key, algo]) => {
                  const r = results[key];
                  return (
                    <tr key={key} className={key === algorithm ? "current" : ""}>
                      <td>{algo.name}</td>
                      <td>
                        {algo.optimal === true
                          ? "Yes"
                          : algo.optimal === "unweighted"
                          ? "Only unweighted"
                          : "No"}
                      </td>
                      <td>{r ? r.expanded.toLocaleString() : "—"}</td>
                      <td>{r ? (r.cost === null ? "no path" : r.cost) : "—"}</td>
                      <td>{r ? `${r.time.toFixed(1)}ms` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Run every algorithm on the same board to fill the table. Watch A* match Dijkstra&apos;s
            cost while expanding a fraction of the cells — and greedy find fast, ugly paths.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
};

/**
 * The grid never re-renders after mount — every visual change goes through
 * direct className updates. memo() with stable props guarantees React
 * leaves it alone while the controls above re-render freely.
 */
const PathfinderGrid = memo(({ cellRefs, onCellDown, onCellEnter, initialStart, initialTarget }) => (
  <section
    className="pfGridPanel"
    style={{ "--pf-cols": COLS }}
    onDragStart={(e) => e.preventDefault()}
  >
    <div className="pfGrid" role="grid">
      {Array.from({ length: ROWS * COLS }, (_, id) => (
        <div
          key={id}
          ref={(node) => {
            cellRefs.current[id] = node;
          }}
          className={`pfCell${id === initialStart ? " start" : ""}${
            id === initialTarget ? " target" : ""
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.target.releasePointerCapture(e.pointerId);
            onCellDown(id);
          }}
          onPointerEnter={() => onCellEnter(id)}
        />
      ))}
    </div>
  </section>
));

export default Pathfinder;
