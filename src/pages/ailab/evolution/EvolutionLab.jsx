import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import Footer from "../../../components/Footer";
import {
  RocketSimulation,
  WORLD,
  TARGET,
  OBSTACLES,
  LIFESPAN,
} from "../../../ai/evolution/rockets";
import "../ailab.css";
import "./evolution.css";

/**
 * Evolution Lab — smart rockets learn to reach a target through obstacles
 * using a genetic algorithm: selection, crossover, mutation and elitism.
 * No rocket is ever told where the target is; good genomes simply
 * out-reproduce bad ones.
 *
 * @component
 */

const EvolutionLab = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const simRef = useRef(null);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [mutationRate, setMutationRate] = useState(0.015);
  const [stats, setStats] = useState(null);

  runningRef.current = running;
  speedRef.current = speed;

  // Main animation loop
  useEffect(() => {
    simRef.current = new RocketSimulation({ mutationRate });
    let rafId;

    const drawFrame = () => {
      const sim = simRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !sim) return;
      const ctx = canvas.getContext("2d");

      if (runningRef.current) {
        for (let i = 0; i < speedRef.current; i++) sim.step();
        setStats(sim.liveStats);
      }

      // --- Render world ---
      ctx.clearRect(0, 0, WORLD.width, WORLD.height);

      // Obstacles
      ctx.fillStyle = "#ea5b5c";
      for (const o of OBSTACLES) ctx.fillRect(o.x, o.y, o.w, o.h);

      // Target
      ctx.beginPath();
      ctx.arc(TARGET.x, TARGET.y, TARGET.r, 0, Math.PI * 2);
      ctx.fillStyle = "#48a3c6";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(TARGET.x, TARGET.y, TARGET.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = "#f3f3f3";
      ctx.fill();

      // Rockets
      for (const rocket of sim.rockets) {
        if (rocket.crashed) continue;
        const angle = Math.atan2(rocket.vel.y, rocket.vel.x);
        ctx.save();
        ctx.translate(rocket.pos.x, rocket.pos.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = rocket.completed ? "#48a3c6" : "rgba(243, 243, 243, 0.75)";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(4, 6);
        ctx.lineTo(-4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fitness history chart
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || !stats || stats.history.length < 2) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const { history } = stats;
    const max = Math.max(...history.map((s) => s.best), 0.01);

    ctx.clearRect(0, 0, w, h);
    const drawSeries = (key, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      history.forEach((s, i) => {
        const x = (i / (history.length - 1)) * (w - 8) + 4;
        const y = h - 6 - (s[key] / max) * (h - 12);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    drawSeries("avg", "#9f9f9f");
    drawSeries("best", "#48a3c6");
  }, [stats]);

  const restart = (rate = mutationRate) => {
    simRef.current = new RocketSimulation({ mutationRate: rate });
    setStats(simRef.current.liveStats);
  };

  const handleMutationChange = (e) => {
    const rate = parseFloat(e.target.value);
    setMutationRate(rate);
    if (simRef.current) simRef.current.mutationRate = rate;
  };

  const lastGen = stats?.history[stats.history.length - 1];

  return (
    <>
      <main className="ailab container evolutionLab">
        <PageHeader title="Evolution Lab" description="Watch natural selection learn" />

        <p className="labIntro">
          {`Each rocket is born with random DNA — ${LIFESPAN} thrust vectors and nothing else. No rocket
          knows where the target is. After every generation, the rockets that made it furthest
          along the course breed the next one (tournament selection, single-point crossover,
          mutation, elitism). Crank up the speed and watch a blind swarm learn to thread the
          gaps and hit the target.`}
        </p>

        <div className="evolutionLayout">
          <section className="simPanel">
            <canvas ref={canvasRef} width={WORLD.width} height={WORLD.height} className="simCanvas" />
          </section>

          <section className="controlPanel">
            <h4 className="panelTitle">Generation {stats?.generation ?? 1}</h4>

            <div className="statGrid">
              <div className="stat">
                <span className="statValue">{stats?.completed ?? 0}</span>
                <span className="statLabel">reached target</span>
              </div>
              <div className="stat">
                <span className="statValue">{stats?.crashed ?? 0}</span>
                <span className="statLabel">crashed</span>
              </div>
              <div className="stat">
                <span className="statValue">{lastGen ? lastGen.completed : 0}</span>
                <span className="statLabel">finishers last gen</span>
              </div>
              <div className="stat">
                <span className="statValue">
                  {lastGen ? lastGen.best.toFixed(lastGen.best >= 0.1 ? 2 : 3) : "—"}
                </span>
                <span className="statLabel">best fitness</span>
              </div>
            </div>

            <div className="controlRow">
              <label htmlFor="mutation">
                Mutation rate <strong>{(mutationRate * 100).toFixed(1)}%</strong>
              </label>
              <input
                id="mutation"
                type="range"
                min="0"
                max="0.08"
                step="0.005"
                value={mutationRate}
                onChange={handleMutationChange}
              />
            </div>

            <div className="controlRow">
              <label htmlFor="speed">
                Simulation speed <strong>{speed}&times;</strong>
              </label>
              <input
                id="speed"
                type="range"
                min="1"
                max="10"
                step="1"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="canvasActions">
              <button className="btn labBtn" onClick={() => setRunning(!running)}>
                {running ? "Pause" : "Resume"}
              </button>
              <button className="btn labBtn secondary" onClick={() => restart()}>
                Restart evolution
              </button>
            </div>

            <div className="lossChart">
              <canvas ref={chartRef} width={280} height={90} />
              <p className="hint">
                <span className="legendBest">best</span> and{" "}
                <span className="legendAvg">average</span> fitness per generation
              </p>
            </div>

            <p className="hint">
              Try mutation at 0% — evolution stalls without variation. Crank it to 8% and it
              never converges. Around 1–2% is the sweet spot, just like in biology.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default EvolutionLab;
