import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import Footer from "../../../components/Footer";
import {
  emptyBoard,
  drop,
  validMoves,
  isFull,
  checkWin,
  winningCells,
  bestMove,
  COLS,
  ROWS,
  HUMAN,
  AI,
} from "../../../ai/connect4/engine";
import "../ailab.css";
import "./connect4.css";

const DIFFICULTIES = {
  casual: { label: "Casual", maxDepth: 3, timeBudgetMs: 200, blunderChance: 0.35 },
  challenger: { label: "Challenger", maxDepth: 6, timeBudgetMs: 500, blunderChance: 0.08 },
  grandmaster: { label: "Grandmaster", maxDepth: 11, timeBudgetMs: 1200, blunderChance: 0 },
};

/**
 * Connect 4 vs. a minimax engine with alpha-beta pruning and iterative
 * deepening. On Grandmaster it looks 11 moves ahead and is very hard to beat.
 *
 * @component
 */

const ConnectFour = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const [board, setBoard] = useState(emptyBoard);
  const [status, setStatus] = useState("yourTurn"); // yourTurn | thinking | won | lost | draw
  const [difficulty, setDifficulty] = useState("challenger");
  const [highlight, setHighlight] = useState(null);
  const [lastAiMove, setLastAiMove] = useState(null);
  const [searchInfo, setSearchInfo] = useState(null);
  const [record, setRecord] = useState({ wins: 0, losses: 0, draws: 0 });
  const thinkTimer = useRef(null);

  useEffect(() => () => clearTimeout(thinkTimer.current), []);

  const newGame = useCallback(() => {
    clearTimeout(thinkTimer.current);
    setBoard(emptyBoard());
    setStatus("yourTurn");
    setHighlight(null);
    setLastAiMove(null);
    setSearchInfo(null);
  }, []);

  const finishGame = (result, finalBoard) => {
    setStatus(result);
    if (result === "won") {
      setHighlight(winningCells(finalBoard, HUMAN));
      setRecord((r) => ({ ...r, wins: r.wins + 1 }));
    } else if (result === "lost") {
      setHighlight(winningCells(finalBoard, AI));
      setRecord((r) => ({ ...r, losses: r.losses + 1 }));
    } else {
      setRecord((r) => ({ ...r, draws: r.draws + 1 }));
    }
  };

  const handleColumnClick = (col) => {
    if (status !== "yourTurn") return;
    if (!validMoves(board).includes(col)) return;

    const next = board.map((column) => [...column]);
    drop(next, col, HUMAN);
    setBoard(next);
    setLastAiMove(null);

    if (checkWin(next, HUMAN)) return finishGame("won", next);
    if (isFull(next)) return finishGame("draw", next);

    setStatus("thinking");
    // Give React a frame to paint the human's piece before searching
    thinkTimer.current = setTimeout(() => {
      const config = DIFFICULTIES[difficulty];
      const t0 = performance.now();
      const result = bestMove(next, config);
      const elapsed = performance.now() - t0;

      const afterAi = next.map((column) => [...column]);
      drop(afterAi, result.col, AI);
      setBoard(afterAi);
      setLastAiMove(result.col);
      setSearchInfo({ ...result, elapsed });

      if (checkWin(afterAi, AI)) return finishGame("lost", afterAi);
      if (isFull(afterAi)) return finishGame("draw", afterAi);
      setStatus("yourTurn");
    }, 60);
  };

  const statusText = {
    yourTurn: "Your move — click a column",
    thinking: "Engine is thinking…",
    won: "You beat the engine! 🎉",
    lost: "The engine wins this one.",
    draw: "A draw — every cell filled.",
  }[status];

  const isHighlighted = (col, row) =>
    highlight?.some(([hc, hr]) => hc === col && hr === row) ?? false;

  return (
    <>
      <main className="ailab container connect4Lab">
        <PageHeader title="Connect 4 Engine" description="Play a classic search algorithm" />

        <p className="labIntro">
          This opponent is a minimax game-tree search with alpha-beta pruning, centre-first move
          ordering and iterative deepening — the same family of algorithms behind classic chess
          engines. On Grandmaster it evaluates hundreds of thousands of positions and looks up to
          11 plies ahead. You play red and move first; good luck.
        </p>

        <div className="c4Layout">
          <section className="boardPanel">
            <div className={`c4Board ${status === "thinking" ? "thinking" : ""}`}>
              {Array.from({ length: COLS }, (_, col) => (
                <button
                  key={col}
                  className="c4Column"
                  onClick={() => handleColumnClick(col)}
                  disabled={status !== "yourTurn" || board[col][ROWS - 1] !== 0}
                  aria-label={`Drop piece in column ${col + 1}`}
                >
                  {Array.from({ length: ROWS }, (_, i) => {
                    const row = ROWS - 1 - i; // render top-down
                    const cell = board[col][row];
                    return (
                      <div
                        key={row}
                        className={[
                          "c4Cell",
                          cell === HUMAN ? "human" : "",
                          cell === AI ? "ai" : "",
                          isHighlighted(col, row) ? "winning" : "",
                          lastAiMove === col && cell === AI && isTopPiece(board, col, row)
                            ? "lastMove"
                            : "",
                        ].join(" ")}
                      />
                    );
                  })}
                </button>
              ))}
            </div>
            <p className={`c4Status ${status}`}>{statusText}</p>
          </section>

          <section className="controlPanel">
            <h4 className="panelTitle">Engine settings</h4>

            <div className="difficultyRow">
              {Object.entries(DIFFICULTIES).map(([key, config]) => (
                <button
                  key={key}
                  className={`difficultyBtn ${difficulty === key ? "active" : ""}`}
                  onClick={() => setDifficulty(key)}
                >
                  {config.label}
                </button>
              ))}
            </div>

            <div className="statGrid">
              <div className="stat">
                <span className="statValue">{record.wins}</span>
                <span className="statLabel">your wins</span>
              </div>
              <div className="stat">
                <span className="statValue">{record.losses}</span>
                <span className="statLabel">engine wins</span>
              </div>
              <div className="stat">
                <span className="statValue">{searchInfo ? searchInfo.nodes.toLocaleString() : "—"}</span>
                <span className="statLabel">positions searched</span>
              </div>
              <div className="stat">
                <span className="statValue">
                  {searchInfo?.depth ? `${searchInfo.depth} plies` : "—"}
                </span>
                <span className="statLabel">search depth</span>
              </div>
            </div>

            {searchInfo && (
              <p className="hint">
                Last move took {Math.round(searchInfo.elapsed)}ms
                {searchInfo.score >= 1_000_000 && " — the engine has found a forced win."}
                {searchInfo.score <= -1_000_000 && " — the engine knows it's losing!"}
              </p>
            )}

            <button className="btn trainBtn" onClick={newGame}>
              New game
            </button>

            <p className="hint">
              Minimax assumes both players play perfectly: it maximises its worst-case outcome.
              Alpha-beta pruning skips branches that can&apos;t change the result, and searching the
              centre columns first makes those cutoffs happen sooner — the difference between
              thousands and millions of nodes.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
};

/** True if (col,row) holds the topmost piece of its column. */
function isTopPiece(board, col, row) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[col][r] !== 0) return r === row;
  }
  return false;
}

export default ConnectFour;
