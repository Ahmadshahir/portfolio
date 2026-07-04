import { NeuralNetwork } from "./neural/network";
import {
  emptyBoard,
  drop,
  undo,
  checkWin,
  validMoves,
  bestMove,
  HUMAN,
  AI,
} from "./connect4/engine";
import { RocketSimulation, LIFESPAN } from "./evolution/rockets";

describe("NeuralNetwork", () => {
  it("learns XOR", () => {
    const net = new NeuralNetwork([2, 8, 2]);
    const inputs = [
      Float32Array.from([0, 0]),
      Float32Array.from([0, 1]),
      Float32Array.from([1, 0]),
      Float32Array.from([1, 1]),
    ];
    const labels = [0, 1, 1, 0];

    let accuracy = 0;
    for (let epoch = 0; epoch < 600; epoch++) {
      ({ accuracy } = net.trainBatch(inputs, labels, 0.01));
    }
    expect(accuracy).toBe(1);
  });

  it("outputs a valid probability distribution", () => {
    const net = new NeuralNetwork([4, 6, 3]);
    const probs = net.predict(Float32Array.from([0.1, 0.5, 0.9, 0.2]));
    const sum = Array.from(probs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    for (const p of probs) expect(p).toBeGreaterThanOrEqual(0);
  });

  it("counts parameters correctly", () => {
    const net = new NeuralNetwork([2, 3, 2]);
    // (2*3 + 3) + (3*2 + 2) = 9 + 8 = 17
    expect(net.parameterCount).toBe(17);
  });
});

describe("Connect 4 engine", () => {
  it("detects horizontal, vertical and diagonal wins", () => {
    const horizontal = emptyBoard();
    [0, 1, 2, 3].forEach((col) => drop(horizontal, col, AI));
    expect(checkWin(horizontal, AI)).toBe(true);

    const vertical = emptyBoard();
    for (let i = 0; i < 4; i++) drop(vertical, 2, HUMAN);
    expect(checkWin(vertical, HUMAN)).toBe(true);

    const diagonal = emptyBoard();
    // Build a staircase for a / diagonal of AI pieces
    drop(diagonal, 0, AI);
    drop(diagonal, 1, HUMAN);
    drop(diagonal, 1, AI);
    drop(diagonal, 2, HUMAN);
    drop(diagonal, 2, HUMAN);
    drop(diagonal, 2, AI);
    drop(diagonal, 3, HUMAN);
    drop(diagonal, 3, HUMAN);
    drop(diagonal, 3, HUMAN);
    drop(diagonal, 3, AI);
    expect(checkWin(diagonal, AI)).toBe(true);
  });

  it("undo reverses a drop", () => {
    const board = emptyBoard();
    drop(board, 3, HUMAN);
    drop(board, 3, AI);
    undo(board, 3);
    expect(board[3][1]).toBe(0);
    expect(board[3][0]).toBe(HUMAN);
  });

  it("excludes full columns from valid moves", () => {
    const board = emptyBoard();
    for (let i = 0; i < 6; i++) drop(board, 0, i % 2 ? HUMAN : AI);
    expect(validMoves(board)).not.toContain(0);
    expect(validMoves(board)).toHaveLength(6);
  });

  it("takes an immediate winning move", () => {
    const board = emptyBoard();
    [0, 1, 2].forEach((col) => {
      drop(board, col, AI);
      drop(board, col, HUMAN);
    });
    const { col } = bestMove(board, { maxDepth: 4, timeBudgetMs: 2000 });
    expect(col).toBe(3);
  });

  it("blocks the opponent's immediate win", () => {
    const board = emptyBoard();
    // Human threatens to win at column 3 (has 0,1,2 on the bottom row)
    drop(board, 0, HUMAN);
    drop(board, 0, AI);
    drop(board, 1, HUMAN);
    drop(board, 1, AI);
    drop(board, 2, HUMAN);
    const { col } = bestMove(board, { maxDepth: 4, timeBudgetMs: 2000 });
    expect(col).toBe(3);
  });
});

describe("RocketSimulation", () => {
  it("evolves and improves fitness over generations", () => {
    const sim = new RocketSimulation({ populationSize: 60, mutationRate: 0.015 });
    // Run 12 full generations headlessly
    while (sim.generation <= 12) sim.step();

    expect(sim.stats.length).toBeGreaterThanOrEqual(12);
    const first = sim.stats[0];
    const last = sim.stats[sim.stats.length - 1];
    expect(last.best).toBeGreaterThan(first.avg);
    expect(sim.rockets).toHaveLength(60);
  });

  it("gives every rocket a full-lifespan genome", () => {
    const sim = new RocketSimulation({ populationSize: 10 });
    for (const rocket of sim.rockets) {
      expect(rocket.dna.genes).toHaveLength(LIFESPAN);
    }
  });
});
