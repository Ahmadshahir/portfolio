/**
 * Turns a freehand canvas drawing into a normalised feature vector the
 * neural network can learn from, plus augmentation helpers that let the
 * network generalise from only a handful of user-drawn examples.
 */

export const GRID = 16; // drawings are downsampled to GRID x GRID
export const INPUT_SIZE = GRID * GRID;

/**
 * Downsamples the canvas to GRID x GRID, crops to the ink's bounding box
 * and re-centres it by centre of mass, so the classifier is insensitive
 * to where and how large the user drew.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size canvas width/height in pixels
 * @returns {Float32Array | null} intensity grid in [0,1], or null if blank
 */
export function featurizeCanvas(ctx, size) {
  const { data } = ctx.getImageData(0, 0, size, size);

  // Find the bounding box of the ink using the alpha channel
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing drawn

  // Square crop around the ink with a small margin
  const boxSize = Math.max(maxX - minX, maxY - minY) * 1.2 + 4;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x0 = cx - boxSize / 2;
  const y0 = cy - boxSize / 2;

  // Average-pool the crop into the grid
  const grid = new Float32Array(INPUT_SIZE);
  const cell = boxSize / GRID;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      let count = 0;
      const startX = Math.floor(x0 + gx * cell);
      const startY = Math.floor(y0 + gy * cell);
      const endX = Math.ceil(x0 + (gx + 1) * cell);
      const endY = Math.ceil(y0 + (gy + 1) * cell);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          count++;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            sum += data[(y * size + x) * 4 + 3] / 255;
          }
        }
      }
      grid[gy * GRID + gx] = count ? sum / count : 0;
    }
  }

  // Normalise peak intensity so stroke width matters less
  let max = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  if (max > 0) for (let i = 0; i < grid.length; i++) grid[i] /= max;

  return grid;
}

/** Shifts a grid by (dx, dy) cells, padding with zeros. */
function shift(grid, dx, dy) {
  const out = new Float32Array(INPUT_SIZE);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx >= 0 && sx < GRID && sy >= 0 && sy < GRID) {
        out[y * GRID + x] = grid[sy * GRID + sx];
      }
    }
  }
  return out;
}

/** Rotates a grid around its centre by a small angle (radians). */
function rotate(grid, angle) {
  const out = new Float32Array(INPUT_SIZE);
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  const half = (GRID - 1) / 2;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      // Inverse-map each destination cell back into the source grid
      const rx = c * (x - half) - s * (y - half) + half;
      const ry = s * (x - half) + c * (y - half) + half;
      const ix = Math.round(rx);
      const iy = Math.round(ry);
      if (ix >= 0 && ix < GRID && iy >= 0 && iy < GRID) {
        out[y * GRID + x] = grid[iy * GRID + ix];
      }
    }
  }
  return out;
}

/** Adds small Gaussian pixel noise. */
function jitter(grid, amount) {
  const out = new Float32Array(INPUT_SIZE);
  for (let i = 0; i < INPUT_SIZE; i++) {
    const noisy = grid[i] + (Math.random() - 0.5) * amount;
    out[i] = Math.min(1, Math.max(0, noisy));
  }
  return out;
}

/**
 * Expands one example into several augmented variants (shifts, rotations,
 * noise) so live training works well with very few drawings per class.
 */
export function augment(grid, variants = 8) {
  const out = [grid];
  for (let i = 0; i < variants; i++) {
    let g = grid;
    g = shift(g, Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
    g = rotate(g, ((Math.random() - 0.5) * 30 * Math.PI) / 180);
    g = jitter(g, 0.15);
    out.push(g);
  }
  return out;
}
