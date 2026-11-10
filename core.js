// Numerical core of the edge-detection demo. All filters are applied as
// cross-correlations (no kernel flip) with replicate padding, matching the slides.

// Sobel masks H_x = s_y d_x = 1/(8h) [-1 0 1; -2 0 2; -1 0 1] with h = 1 (slide 13).
export const SX = [-1, 0, 1, -2, 0, 2, -1, 0, 1].map((v) => v / 8);
export const SY = [-1, -2, -1, 0, 0, 0, 1, 2, 1].map((v) => v / 8);
// Central difference d_x = 1/(2h) [-1 0 1] (slide 12).
export const CENTRAL = [0, 0, 0, -0.5, 0, 0.5, 0, 0, 0];
// Discrete Laplacian L = 1/h^2 [0 1 0; 1 -4 1; 0 1 0] (slide 12).
export const LAPLACIAN = [0, 1, 0, 1, -4, 1, 0, 1, 0];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 3×3 neighborhood of (x, y), row by row, with replicate padding. */
export function neighborhood(data, w, h, x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      out.push(data[clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)]);
    }
  }
  return out;
}

export function dot(a, b) {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

/** Apply a 3×3 kernel to every pixel. */
export function correlate3(data, w, h, kernel) {
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[y * w + x] = dot(neighborhood(data, w, h, x, y), kernel);
  }
  return out;
}

/**
 * Normalized 1-D Gaussian weights on [-m, m], m = ceil(3σ) (slide 11).
 * The 2-D kernel w_σ[a,b] is the outer product of this vector with itself.
 */
export function gaussianWeights(sigma) {
  if (!(sigma > 0)) return [1];
  const m = Math.max(1, Math.ceil(3 * sigma));
  const g = [];
  for (let i = -m; i <= m; i++) g.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const total = g.reduce((s, v) => s + v, 0);
  return g.map((v) => v / total);
}

/** f_σ = w_σ ⋆ f, computed separably (rows then columns). σ = 0 returns a copy. */
export function gaussianSmooth(data, w, h, sigma) {
  const g = gaussianWeights(sigma);
  const m = (g.length - 1) / 2;
  const src = Float64Array.from(data);
  if (m === 0) return src;
  const tmp = new Float64Array(w * h);
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -m; k <= m; k++) s += g[k + m] * src[y * w + clamp(x + k, 0, w - 1)];
      tmp[y * w + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -m; k <= m; k++) s += g[k + m] * tmp[clamp(y + k, 0, h - 1) * w + x];
      out[y * w + x] = s;
    }
  }
  return out;
}

/** Deterministic Gaussian noise (seeded) so the same settings give the same image. */
export function addNoise(data, sigmaNoise, seed = 1) {
  const out = Float64Array.from(data);
  if (!(sigmaNoise > 0)) return out;
  let state = seed >>> 0 || 1;
  const rand = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return (state + 0.5) / 4294967296;
  };
  for (let i = 0; i < out.length; i += 2) {
    const r = Math.sqrt(-2 * Math.log(rand()));
    const t = 2 * Math.PI * rand();
    out[i] = clamp(out[i] + sigmaNoise * r * Math.cos(t), 0, 255);
    if (i + 1 < out.length) out[i + 1] = clamp(out[i + 1] + sigmaNoise * r * Math.sin(t), 0, 255);
  }
  return out;
}

/**
 * Every response used by the demo.
 *   base      noisy grayscale f
 *   smooth    f_σ (σ = 0 means no smoothing)
 *   x, y      Sobel responses of f_σ;  magnitude M = sqrt(g_x² + g_y²)
 *   central   central difference of f_σ
 *   smoothK   f_{kσ}
 *   log       r_L = L ⋆ f_σ
 *   dog       r_D = f_{kσ} − f_σ
 */
export function responses(data, w, h, { sigma = 0, k = 1.6, noise = 0, seed = 1 } = {}) {
  const base = addNoise(data, noise, seed);
  const smooth = gaussianSmooth(base, w, h, sigma);
  const x = correlate3(smooth, w, h, SX);
  const y = correlate3(smooth, w, h, SY);
  const magnitude = x.map((gx, i) => Math.hypot(gx, y[i]));
  const central = correlate3(smooth, w, h, CENTRAL);
  const smoothK = gaussianSmooth(base, w, h, sigma > 0 ? k * sigma : 0);
  const log = correlate3(smooth, w, h, LAPLACIAN);
  const dog = smoothK.map((v, i) => v - smooth[i]);
  return { base, smooth, smoothK, x, y, magnitude, central, log, dog };
}

const maxAbs = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/**
 * Binary edge map for gradient methods (slide 17): keep pixels whose magnitude is
 * a local maximum along the gradient direction and at least `threshold`·max(M).
 */
export function gradientEdges(gx, gy, mag, w, h, threshold) {
  const out = new Uint8Array(w * h);
  const t = threshold * maxAbs(mag);
  const at = (x, y) => mag[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m === 0 || m < t) continue;
      // Quantize the gradient direction to one of four neighbor axes.
      let angle = (Math.atan2(gy[i], gx[i]) * 180) / Math.PI;
      if (angle < 0) angle += 180;
      let dx = 1, dy = 0;
      if (angle >= 22.5 && angle < 67.5) { dx = 1; dy = 1; }
      else if (angle >= 67.5 && angle < 112.5) { dx = 0; dy = 1; }
      else if (angle >= 112.5 && angle < 157.5) { dx = -1; dy = 1; }
      if (m >= at(x + dx, y + dy) && m >= at(x - dx, y - dy)) out[i] = 1;
    }
  }
  return out;
}

/** Edge map for a signed 1-D response (central difference): |r| ≥ threshold·max|r|. */
export function magnitudeEdges(r, threshold) {
  const t = threshold * maxAbs(r);
  return Uint8Array.from(r, (v) => (v !== 0 && Math.abs(v) >= t ? 1 : 0));
}

/**
 * Zero-crossing edge map for LoG / DoG (slides 15–17). For neighbors p, q (right and
 * below) with r[p]·r[q] < 0 and |r[p] − r[q]| ≥ threshold·max|r|, mark whichever pixel
 * has the smaller |r|.
 */
export function zeroCrossings(r, w, h, threshold) {
  const out = new Uint8Array(w * h);
  const t = threshold * maxAbs(r);
  const test = (p, q) => {
    if (r[p] * r[q] < 0 && Math.abs(r[p] - r[q]) >= t) out[Math.abs(r[p]) <= Math.abs(r[q]) ? p : q] = 1;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (x + 1 < w) test(p, p + 1);
      if (y + 1 < h) test(p, p + w);
    }
  }
  return out;
}

/** Edge map for the chosen operator. */
export function edgeMap(mode, v, w, h, threshold) {
  if (mode === 'log' || mode === 'dog') return zeroCrossings(v[mode], w, h, threshold);
  if (mode === 'central' || mode === 'x' || mode === 'y') return magnitudeEdges(v[mode], threshold);
  if (mode === 'smooth') return new Uint8Array(w * h);
  return gradientEdges(v.x, v.y, v.magnitude, w, h, threshold);
}
