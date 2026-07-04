import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FaBrain, FaRocket, FaChessBoard, FaRoute } from "react-icons/fa";
import PageHeader from "../../components/PageHeader";
import Footer from "../../components/Footer";
import "./ailab.css";

const EXPERIMENTS = [
  {
    path: "/ai-lab/doodle-brain",
    icon: <FaBrain />,
    title: "Doodle Brain",
    tagline: "Teach a neural network to recognise your drawings",
    body: "A fully-connected neural network written from scratch — backpropagation, Adam optimizer, softmax and all. Draw a few examples per class and train it live in your browser.",
    tags: ["Neural network", "Backpropagation", "Data augmentation"],
    accent: "var(--hl-color)",
  },
  {
    path: "/ai-lab/evolution",
    icon: <FaRocket />,
    title: "Evolution Lab",
    tagline: "Watch a genetic algorithm learn to fly",
    body: "150 rockets are born with random DNA and no idea where the target is. Selection, crossover and mutation breed each generation from the best of the last — watch blind chance become precision.",
    tags: ["Genetic algorithm", "Selection & crossover", "Emergence"],
    accent: "var(--hl2-color)",
  },
  {
    path: "/ai-lab/connect-4",
    icon: <FaChessBoard />,
    title: "Connect 4 Engine",
    tagline: "Play against classic game-tree search",
    body: "Minimax with alpha-beta pruning and iterative deepening — the algorithm family behind classic chess engines. On Grandmaster it searches hundreds of thousands of positions per move.",
    tags: ["Minimax", "Alpha-beta pruning", "Game theory"],
    accent: "#f5c542",
  },
  {
    path: "/ai-lab/pathfinder",
    icon: <FaRoute />,
    title: "Pathfinder",
    tagline: "Watch search algorithms think",
    body: "A*, Dijkstra, breadth-first, greedy and depth-first search racing over the same grid. Draw walls and rough terrain, generate mazes, and compare how each algorithm explores — cells expanded, path cost, time.",
    tags: ["A* search", "Dijkstra", "Heuristics"],
    accent: "#6cc551",
  },
];

/**
 * AI Lab hub — interactive artificial intelligence experiments, every
 * algorithm implemented from scratch and running live in the browser.
 *
 * @component
 */

const AiLab = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <>
      <main className="ailab container">
        <PageHeader title="AI Lab" description="Interactive AI experiments" />

        <p className="labIntro">
          Four artificial intelligence projects, each implemented from scratch in JavaScript — no
          ML libraries, no APIs, no server. Everything trains, evolves and searches live in your
          browser. Open the code to see exactly how each algorithm works.
        </p>

        <div className="labGrid">
          {EXPERIMENTS.map((experiment, i) => (
            <motion.div
              key={experiment.path}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 * i, duration: 0.5, ease: "easeOut" }}
            >
              <Link to={experiment.path} className="labCard" style={{ "--accent": experiment.accent }}>
                <span className="labIcon">{experiment.icon}</span>
                <h4 className="labCardTitle">{experiment.title}</h4>
                <p className="labCardTagline">{experiment.tagline}</p>
                <p className="labCardBody">{experiment.body}</p>
                <div className="labTags">
                  {experiment.tags.map((tag) => (
                    <span className="technology" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="labCardCta">Open experiment &rarr;</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default AiLab;
