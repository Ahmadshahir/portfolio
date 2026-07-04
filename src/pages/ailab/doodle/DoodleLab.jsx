import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import Footer from "../../../components/Footer";
import { NeuralNetwork } from "../../../ai/neural/network";
import { featurizeCanvas, augment, INPUT_SIZE, GRID } from "../../../ai/neural/featurize";
import "../ailab.css";
import "./doodle.css";

const CANVAS_SIZE = 280;
const DEFAULT_CLASSES = ["Circle", "Square", "Zigzag"];

/**
 * Doodle Brain — a teachable machine built on a from-scratch neural network.
 * Draw a few examples per class, train the network live in the browser and
 * watch it recognise new drawings in real time.
 *
 * @component
 */

const DoodleLab = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);

  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [samples, setSamples] = useState(() => DEFAULT_CLASSES.map(() => []));
  const [network, setNetwork] = useState(null);
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(null); // {epoch, epochs, loss, accuracy}
  const [lossHistory, setLossHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [newClassName, setNewClassName] = useState("");

  const getCtx = () => canvasRef.current.getContext("2d", { willReadFrequently: true });

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setPrediction(null);
  }, []);

  // Runs live classification once a trained network exists
  const classify = useCallback(
    (net) => {
      const activeNet = net || network;
      if (!activeNet) return;
      const features = featurizeCanvas(getCtx(), CANVAS_SIZE);
      if (!features) {
        setPrediction(null);
        return;
      }
      setPrediction(Array.from(activeNet.predict(features)));
    },
    [network]
  );

  // --- Pointer drawing handlers ---
  const pointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPoint.current = pointerPos(e);
  };

  const handlePointerMove = (e) => {
    if (!drawing.current) return;
    const point = pointerPos(e);
    const ctx = getCtx();
    ctx.strokeStyle = "#f3f3f3";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
  };

  const handlePointerUp = () => {
    drawing.current = false;
    classify();
  };

  // --- Dataset management ---
  const addSample = (classIndex) => {
    const features = featurizeCanvas(getCtx(), CANVAS_SIZE);
    if (!features) return;
    setSamples((prev) => prev.map((list, i) => (i === classIndex ? [...list, features] : list)));
    clearCanvas();
  };

  const addClass = () => {
    const name = newClassName.trim();
    if (!name || classes.length >= 6) return;
    setClasses((prev) => [...prev, name]);
    setSamples((prev) => [...prev, []]);
    setNewClassName("");
    setNetwork(null);
    setPrediction(null);
  };

  const removeClass = (index) => {
    if (classes.length <= 2) return;
    setClasses((prev) => prev.filter((_, i) => i !== index));
    setSamples((prev) => prev.filter((_, i) => i !== index));
    setNetwork(null);
    setPrediction(null);
  };

  const resetAll = () => {
    setSamples(classes.map(() => []));
    setNetwork(null);
    setPrediction(null);
    setLossHistory([]);
    setProgress(null);
    clearCanvas();
  };

  // --- Training loop (chunked so the UI stays responsive) ---
  const train = () => {
    if (training) return;
    const net = new NeuralNetwork([INPUT_SIZE, 96, 48, classes.length]);

    // Build the augmented training set
    const inputs = [];
    const labels = [];
    samples.forEach((list, classIndex) => {
      list.forEach((grid) => {
        augment(grid, 9).forEach((variant) => {
          inputs.push(variant);
          labels.push(classIndex);
        });
      });
    });

    const epochs = 40;
    const batchSize = 16;
    const history = [];
    setTraining(true);
    setLossHistory([]);

    let epoch = 0;
    const runEpoch = () => {
      // Shuffle indices each epoch
      const order = inputs.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      let epochLoss = 0;
      let epochAcc = 0;
      let batches = 0;
      for (let start = 0; start < order.length; start += batchSize) {
        const idx = order.slice(start, start + batchSize);
        const { loss, accuracy } = net.trainBatch(
          idx.map((i) => inputs[i]),
          idx.map((i) => labels[i]),
          0.002
        );
        epochLoss += loss;
        epochAcc += accuracy;
        batches++;
      }

      epoch++;
      const avgLoss = epochLoss / batches;
      history.push(avgLoss);
      setProgress({ epoch, epochs, loss: avgLoss, accuracy: epochAcc / batches });
      setLossHistory([...history]);

      if (epoch < epochs) {
        setTimeout(runEpoch, 0); // yield to the browser between epochs
      } else {
        setTraining(false);
        setNetwork(net);
        clearCanvas();
      }
    };
    runEpoch();
  };

  const totalSamples = samples.reduce((sum, list) => sum + list.length, 0);
  const trainableClasses = samples.filter((list) => list.length >= 2).length;
  const canTrain = !training && trainableClasses === classes.length && classes.length >= 2;

  return (
    <>
      <main className="ailab container doodleLab">
        <PageHeader title="Doodle Brain" description="Teach a neural network to see" />

        <p className="labIntro">
          This is a real neural network ({INPUT_SIZE}&nbsp;&rarr;&nbsp;96&nbsp;&rarr;&nbsp;48&nbsp;&rarr;&nbsp;
          {classes.length} neurons) written from scratch in JavaScript — no libraries. Draw a few
          examples for each class, hit <strong>Train</strong>, and it learns to recognise your
          drawings right here in your browser using backpropagation and the Adam optimizer.
        </p>

        <div className="doodleLayout">
          {/* Drawing area */}
          <section className="drawPanel">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="drawCanvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            <div className="canvasActions">
              <button className="btn labBtn" onClick={clearCanvas}>
                Clear
              </button>
              <button className="btn labBtn secondary" onClick={resetAll}>
                Reset all
              </button>
            </div>
            <p className="hint">
              {network
                ? "Draw anything — the network classifies it live as you draw."
                : "Draw an example, then add it to one of the classes below."}
            </p>
          </section>

          {/* Classes and training */}
          <section className="trainPanel">
            <h4 className="panelTitle">Training data</h4>
            {classes.map((name, i) => (
              <div className="classRow" key={`${name}-${i}`}>
                <span className="className">{name}</span>
                <span className="sampleCount">
                  {samples[i].length} example{samples[i].length === 1 ? "" : "s"}
                </span>
                <button className="btn labBtn small" onClick={() => addSample(i)} disabled={training}>
                  Add drawing
                </button>
                {classes.length > 2 && (
                  <button
                    className="removeClass"
                    onClick={() => removeClass(i)}
                    disabled={training}
                    aria-label={`Remove ${name}`}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}

            {classes.length < 6 && (
              <div className="addClassRow">
                <input
                  type="text"
                  value={newClassName}
                  maxLength={14}
                  placeholder="New class name"
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addClass()}
                />
                <button className="btn labBtn small" onClick={addClass} disabled={training}>
                  Add class
                </button>
              </div>
            )}

            <button className="btn trainBtn" onClick={train} disabled={!canTrain}>
              {training
                ? `Training… epoch ${progress?.epoch ?? 0}/${progress?.epochs ?? 0}`
                : network
                ? "Retrain network"
                : "Train network"}
            </button>
            {!canTrain && !training && (
              <p className="hint">Add at least 2 drawings to every class to start training.</p>
            )}
            <p className="hint">
              {totalSamples} drawings collected &middot; each one is augmented into 10 training
              samples (shifts, rotations, noise)
            </p>

            {(training || lossHistory.length > 0) && (
              <LossChart history={lossHistory} accuracy={progress?.accuracy} />
            )}
          </section>

          {/* Live predictions */}
          <section className="predictPanel">
            <h4 className="panelTitle">Network output</h4>
            {network ? (
              <>
                {classes.map((name, i) => {
                  const p = prediction ? prediction[i] : 0;
                  const best = prediction && p === Math.max(...prediction);
                  return (
                    <div className="probRow" key={`${name}-${i}`}>
                      <span className={`probLabel ${best ? "best" : ""}`}>{name}</span>
                      <div className="probTrack">
                        <div
                          className={`probFill ${best ? "best" : ""}`}
                          style={{ width: `${Math.round(p * 100)}%` }}
                        />
                      </div>
                      <span className="probValue">{Math.round(p * 100)}%</span>
                    </div>
                  );
                })}
                {!prediction && <p className="hint">Waiting for a drawing…</p>}
              </>
            ) : (
              <p className="hint">Train the network to see live softmax probabilities here.</p>
            )}
          </section>
        </div>

        <section className="howItWorks">
          <h4 className="panelTitle">How it works</h4>
          <p>
            Every drawing is cropped to its bounding box and downsampled to a {GRID}&times;{GRID}
            intensity grid, so position and scale don&apos;t matter. Those {INPUT_SIZE} values feed a
            fully-connected network with ReLU activations and a softmax output, trained with
            mini-batch gradient descent (Adam, cross-entropy loss). Because you only draw a handful
            of examples, each one is augmented with random shifts, rotations and noise — the same
            trick large-scale vision models use to stretch small datasets.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
};

/** Tiny canvas sparkline of the training loss. */
const LossChart = ({ history, accuracy }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(...history);
    ctx.strokeStyle = "#48a3c6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((loss, i) => {
      const x = (i / (history.length - 1)) * (w - 8) + 4;
      const y = h - 6 - (loss / max) * (h - 12);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [history]);

  return (
    <div className="lossChart">
      <canvas ref={ref} width={260} height={70} />
      <p className="hint">
        loss {history[history.length - 1]?.toFixed(3)}
        {accuracy !== undefined && ` · accuracy ${(accuracy * 100).toFixed(0)}%`}
      </p>
    </div>
  );
};

export default DoodleLab;
