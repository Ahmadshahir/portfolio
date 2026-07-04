/**
 * Smart Rockets — a genetic algorithm from scratch.
 *
 * Each rocket's DNA is a sequence of thrust vectors, one per simulation
 * frame. A population launches together, gets scored on how close it got
 * to the target (with bonuses for arriving fast and penalties for
 * crashing), then the best genomes are recombined and mutated to breed
 * the next generation. Within a few dozen generations the swarm learns
 * to thread the obstacles and hit the target.
 */

export const WORLD = { width: 600, height: 520 };
export const LIFESPAN = 260; // frames per generation
const MAX_FORCE = 0.28;

export const TARGET = { x: WORLD.width / 2, y: 55, r: 16 };

export const OBSTACLES = [
  { x: 170, y: 230, w: 430, h: 16 }, // upper wall — gap on the left
  { x: 0, y: 390, w: 220, h: 16 }, // lower walls — gap in the centre
  { x: 380, y: 390, w: 220, h: 16 },
];

// Waypoints in the middle of each gap, used to shape the fitness function.
// Straight-line distance to the target is deceptive here: a rocket hovering
// right under a wall looks "close" but can never get through. Scoring
// remaining distance ALONG the course instead gives evolution an honest,
// smooth gradient to climb.
const GAP_LOWER = { x: 300, y: 382 };
const GAP_UPPER = { x: 85, y: 214 };

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const LEG_UPPER = dist(GAP_UPPER, TARGET); // gap in upper wall -> target
const LEG_LOWER = dist(GAP_LOWER, GAP_UPPER) + LEG_UPPER; // lower gap -> onward

/** Remaining distance to the target following the course through the gaps. */
export function courseDistance(pos) {
  if (pos.y > 398) return dist(pos, GAP_LOWER) + LEG_LOWER; // below both walls
  if (pos.y > 238) return dist(pos, GAP_UPPER) + LEG_UPPER; // between walls
  return dist(pos, TARGET); // clear line to the target
}

function randomForce() {
  const angle = Math.random() * Math.PI * 2;
  const mag = Math.random() * MAX_FORCE;
  return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag };
}

function clampForce(v) {
  return Math.max(-MAX_FORCE, Math.min(MAX_FORCE, v));
}

class DNA {
  constructor(genes) {
    this.genes = genes || Array.from({ length: LIFESPAN }, randomForce);
  }

  /** Single-point crossover between two parents. */
  crossover(partner) {
    const mid = Math.floor(Math.random() * LIFESPAN);
    const genes = this.genes.map((gene, i) => (i < mid ? gene : partner.genes[i]));
    return new DNA(genes);
  }

  /**
   * Each gene has an independent chance of mutating. Most mutations gently
   * perturb the existing thrust (fine-tuning a good trajectory); some
   * replace it outright (exploring new behaviour).
   */
  mutate(rate) {
    for (let i = 0; i < this.genes.length; i++) {
      if (Math.random() >= rate) continue;
      if (Math.random() < 0.4) {
        this.genes[i] = randomForce();
      } else {
        const gene = this.genes[i];
        this.genes[i] = {
          x: clampForce(gene.x + (Math.random() - 0.5) * MAX_FORCE * 0.5),
          y: clampForce(gene.y + (Math.random() - 0.5) * MAX_FORCE * 0.5),
        };
      }
    }
  }
}

class Rocket {
  constructor(dna) {
    this.dna = dna || new DNA();
    this.reset();
  }

  reset() {
    this.pos = { x: WORLD.width / 2, y: WORLD.height - 20 };
    this.vel = { x: 0, y: 0 };
    this.crashed = false;
    this.completed = false;
    this.finishFrame = null;
    this.closest = Infinity;
  }

  update(frame) {
    if (this.crashed || this.completed) return;

    const force = this.dna.genes[frame];
    this.vel.x += force.x;
    this.vel.y += force.y;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    const d = courseDistance(this.pos);
    if (d < this.closest) this.closest = d;

    if (dist(this.pos, TARGET) < TARGET.r) {
      this.completed = true;
      this.finishFrame = frame;
      this.pos = { x: TARGET.x, y: TARGET.y };
      return;
    }

    if (this.pos.x < 0 || this.pos.x > WORLD.width || this.pos.y < 0 || this.pos.y > WORLD.height) {
      this.crashed = true;
      return;
    }
    for (const o of OBSTACLES) {
      if (
        this.pos.x > o.x &&
        this.pos.x < o.x + o.w &&
        this.pos.y > o.y &&
        this.pos.y < o.y + o.h
      ) {
        this.crashed = true;
        return;
      }
    }
  }

  /** Higher is better. Uses closest approach so partial progress counts. */
  fitness() {
    // Exponential falloff keeps selection pressure strong even when the
    // whole population is still far from the target
    let score = Math.exp(-this.closest / 120);
    if (this.completed) {
      // Big bonus for reaching the target, larger if it arrived early
      score = 1 + (LIFESPAN - this.finishFrame) / LIFESPAN;
    }
    if (this.crashed) score *= 0.3;
    return score;
  }
}

export class RocketSimulation {
  constructor({ populationSize = 150, mutationRate = 0.015 } = {}) {
    this.populationSize = populationSize;
    this.mutationRate = mutationRate;
    this.generation = 1;
    this.frame = 0;
    this.rockets = Array.from({ length: populationSize }, () => new Rocket());
    this.stats = []; // per-generation {best, avg, completed}
  }

  /** Advances one frame; returns true if the generation just ended. */
  step() {
    for (const rocket of this.rockets) rocket.update(this.frame);
    this.frame++;

    const allDone = this.rockets.every((r) => r.crashed || r.completed);
    if (this.frame >= LIFESPAN || allDone) {
      this.evolve();
      return true;
    }
    return false;
  }

  evolve() {
    const fitnesses = this.rockets.map((r) => r.fitness());
    const best = Math.max(...fitnesses);
    const avg = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const completed = this.rockets.filter((r) => r.completed).length;
    this.stats.push({ best, avg, completed });
    if (this.stats.length > 200) this.stats.shift();

    // Tournament selection: the fittest of 5 random candidates gets to mate.
    // Stronger selection pressure than roulette when fitnesses are close.
    const pick = () => {
      let winner = Math.floor(Math.random() * this.rockets.length);
      for (let i = 1; i < 5; i++) {
        const candidate = Math.floor(Math.random() * this.rockets.length);
        if (fitnesses[candidate] > fitnesses[winner]) winner = candidate;
      }
      return this.rockets[winner];
    };

    // Elitism: the champion's genome survives unchanged
    const champion = this.rockets[fitnesses.indexOf(best)];
    const nextGen = [new Rocket(new DNA([...champion.dna.genes]))];

    while (nextGen.length < this.populationSize) {
      const child = pick().dna.crossover(pick().dna);
      child.mutate(this.mutationRate);
      nextGen.push(new Rocket(child));
    }

    this.rockets = nextGen;
    this.generation++;
    this.frame = 0;
  }

  get liveStats() {
    return {
      generation: this.generation,
      frame: this.frame,
      alive: this.rockets.filter((r) => !r.crashed && !r.completed).length,
      completed: this.rockets.filter((r) => r.completed).length,
      crashed: this.rockets.filter((r) => r.crashed).length,
      history: this.stats,
    };
  }
}
