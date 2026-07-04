/**
 * A tiny neural network library written from scratch — no dependencies.
 *
 * Implements a fully-connected feed-forward network (multi-layer perceptron)
 * with ReLU hidden layers, a softmax output, cross-entropy loss and the
 * Adam optimizer. Everything runs on Float32Arrays so training is fast
 * enough to happen live in the browser while the user watches.
 */

/** He-initialised weight matrix stored flat in row-major order. */
function heInit(rows, cols) {
  const w = new Float32Array(rows * cols);
  const std = Math.sqrt(2 / cols);
  for (let i = 0; i < w.length; i++) {
    // Box-Muller transform for a normal distribution
    const u1 = Math.random() || 1e-12;
    const u2 = Math.random();
    w[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std;
  }
  return w;
}

class DenseLayer {
  constructor(inputSize, outputSize) {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.weights = heInit(outputSize, inputSize);
    this.biases = new Float32Array(outputSize);

    // Gradients
    this.gradW = new Float32Array(outputSize * inputSize);
    this.gradB = new Float32Array(outputSize);

    // Adam moment estimates
    this.mW = new Float32Array(outputSize * inputSize);
    this.vW = new Float32Array(outputSize * inputSize);
    this.mB = new Float32Array(outputSize);
    this.vB = new Float32Array(outputSize);

    // Caches for backprop
    this.lastInput = null;
    this.lastOutput = new Float32Array(outputSize);
  }

  forward(input) {
    this.lastInput = input;
    const { weights, biases, outputSize, inputSize, lastOutput } = this;
    for (let o = 0; o < outputSize; o++) {
      let sum = biases[o];
      const rowOffset = o * inputSize;
      for (let i = 0; i < inputSize; i++) {
        sum += weights[rowOffset + i] * input[i];
      }
      lastOutput[o] = sum;
    }
    return lastOutput;
  }

  /** Accumulates gradients and returns the gradient w.r.t. the input. */
  backward(gradOutput) {
    const { weights, inputSize, outputSize, lastInput, gradW, gradB } = this;
    const gradInput = new Float32Array(inputSize);
    for (let o = 0; o < outputSize; o++) {
      const g = gradOutput[o];
      gradB[o] += g;
      const rowOffset = o * inputSize;
      for (let i = 0; i < inputSize; i++) {
        gradW[rowOffset + i] += g * lastInput[i];
        gradInput[i] += weights[rowOffset + i] * g;
      }
    }
    return gradInput;
  }

  zeroGrad() {
    this.gradW.fill(0);
    this.gradB.fill(0);
  }

  adamStep(lr, beta1, beta2, eps, t, batchSize) {
    const correct1 = 1 - Math.pow(beta1, t);
    const correct2 = 1 - Math.pow(beta2, t);
    const { weights, biases, gradW, gradB, mW, vW, mB, vB } = this;

    for (let i = 0; i < weights.length; i++) {
      const g = gradW[i] / batchSize;
      mW[i] = beta1 * mW[i] + (1 - beta1) * g;
      vW[i] = beta2 * vW[i] + (1 - beta2) * g * g;
      weights[i] -= (lr * (mW[i] / correct1)) / (Math.sqrt(vW[i] / correct2) + eps);
    }
    for (let i = 0; i < biases.length; i++) {
      const g = gradB[i] / batchSize;
      mB[i] = beta1 * mB[i] + (1 - beta1) * g;
      vB[i] = beta2 * vB[i] + (1 - beta2) * g * g;
      biases[i] -= (lr * (mB[i] / correct1)) / (Math.sqrt(vB[i] / correct2) + eps);
    }
  }
}

function relu(x) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] > 0 ? x[i] : 0;
  return out;
}

function reluBackward(gradOutput, preActivation) {
  const out = new Float32Array(gradOutput.length);
  for (let i = 0; i < gradOutput.length; i++) {
    out[i] = preActivation[i] > 0 ? gradOutput[i] : 0;
  }
  return out;
}

export function softmax(logits) {
  const out = new Float32Array(logits.length);
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp(logits[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

export class NeuralNetwork {
  /**
   * @param {number[]} layerSizes e.g. [256, 64, 3] — input, hidden…, output
   */
  constructor(layerSizes) {
    this.layerSizes = layerSizes;
    this.layers = [];
    for (let i = 0; i < layerSizes.length - 1; i++) {
      this.layers.push(new DenseLayer(layerSizes[i], layerSizes[i + 1]));
    }
    this.adamT = 0;
  }

  /** Runs a forward pass and returns softmax probabilities. */
  predict(input) {
    let x = input;
    for (let i = 0; i < this.layers.length; i++) {
      x = this.layers[i].forward(x);
      if (i < this.layers.length - 1) x = relu(x);
    }
    return softmax(x);
  }

  /**
   * Trains on one mini-batch with softmax cross-entropy loss.
   *
   * @param {Float32Array[]} inputs
   * @param {number[]} labels class indices
   * @param {number} lr learning rate
   * @returns {{loss: number, accuracy: number}}
   */
  trainBatch(inputs, labels, lr = 0.001) {
    const numLayers = this.layers.length;
    for (const layer of this.layers) layer.zeroGrad();

    let totalLoss = 0;
    let correct = 0;

    for (let n = 0; n < inputs.length; n++) {
      // Forward pass, keeping pre-activations for the ReLU backward pass
      const preActivations = [];
      let x = inputs[n];
      for (let i = 0; i < numLayers; i++) {
        x = this.layers[i].forward(x);
        preActivations.push(x);
        if (i < numLayers - 1) x = relu(x);
      }
      const probs = softmax(x);

      const label = labels[n];
      totalLoss += -Math.log(probs[label] + 1e-12);
      let argmax = 0;
      for (let i = 1; i < probs.length; i++) if (probs[i] > probs[argmax]) argmax = i;
      if (argmax === label) correct++;

      // Softmax + cross-entropy gradient is simply (probs - onehot)
      let grad = new Float32Array(probs.length);
      for (let i = 0; i < probs.length; i++) grad[i] = probs[i] - (i === label ? 1 : 0);

      // Backward pass
      for (let i = numLayers - 1; i >= 0; i--) {
        grad = this.layers[i].backward(grad);
        if (i > 0) grad = reluBackward(grad, preActivations[i - 1]);
      }
    }

    this.adamT++;
    for (const layer of this.layers) {
      layer.adamStep(lr, 0.9, 0.999, 1e-8, this.adamT, inputs.length);
    }

    return { loss: totalLoss / inputs.length, accuracy: correct / inputs.length };
  }

  /** Serialises weights so a trained model can be saved or inspected. */
  toJSON() {
    return {
      layerSizes: this.layerSizes,
      layers: this.layers.map((l) => ({
        weights: Array.from(l.weights),
        biases: Array.from(l.biases),
      })),
    };
  }

  static fromJSON(json) {
    const net = new NeuralNetwork(json.layerSizes);
    json.layers.forEach((saved, i) => {
      net.layers[i].weights.set(saved.weights);
      net.layers[i].biases.set(saved.biases);
    });
    return net;
  }

  /** Total number of trainable parameters. */
  get parameterCount() {
    return this.layers.reduce((sum, l) => sum + l.weights.length + l.biases.length, 0);
  }
}
