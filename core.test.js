import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  responses, neighborhood, gaussianWeights, gaussianSmooth, correlate3, LAPLACIAN,
  zeroCrossings, gradientEdges, addNoise,
} from './core.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('constant images have zero response, including padded boundaries', () => {
  const v = responses(new Uint8Array(20).fill(90), 5, 4, { sigma: 1 });
  for (const key of ['x', 'y', 'magnitude', 'central', 'log', 'dog']) assert.ok(v[key].every((t) => Math.abs(t) < 1e-9));
});

test('slide 14 example: g_x = 40, g_y = 0, M = 40', () => {
  const v = responses([10, 30, 90, 10, 30, 90, 10, 30, 90], 3, 3);
  close(v.x[4], 40); close(v.y[4], 0); close(v.magnitude[4], 40);
});

test('vertical boundary has horizontal response only', () => {
  const v = responses([0, 0, 255, 0, 0, 255, 0, 0, 255], 3, 3);
  close(v.x[4], 127.5); close(v.y[4], 0); close(v.central[4], 127.5);
});

test('horizontal boundary has vertical response only', () => {
  const v = responses([0, 0, 0, 0, 0, 0, 255, 255, 255], 3, 3);
  close(v.x[4], 0); close(v.y[4], 127.5);
});

test('replicate padding repeats corner values', () => {
  assert.deepEqual(neighborhood([1, 2, 3, 4], 2, 2, 0, 0), [1, 1, 2, 1, 1, 2, 3, 3, 4]);
});

test('reversing contrast reverses signed responses but preserves magnitude', () => {
  const data = [0, 20, 40, 60, 80, 100, 120, 140, 160];
  const a = responses(data, 3, 3), b = responses(data.map((v) => 255 - v), 3, 3);
  for (let i = 0; i < 9; i++) { close(a.x[i], -b.x[i]); close(a.y[i], -b.y[i]); close(a.magnitude[i], b.magnitude[i]); }
});

test('Gaussian weights are symmetric and sum to 1', () => {
  const g = gaussianWeights(1.5);
  close(g.reduce((s, v) => s + v, 0), 1);
  for (let i = 0; i < g.length; i++) close(g[i], g[g.length - 1 - i]);
});

test('Gaussian smoothing reduces noise variance', () => {
  const w = 40, h = 40, noisy = addNoise(new Float64Array(w * h).fill(128), 20, 7);
  const sm = gaussianSmooth(noisy, w, h, 2);
  const variance = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length; };
  assert.ok(variance(sm) < variance(noisy) / 5);
});

test('discrete Laplacian of a quadratic x² is 2', () => {
  const w = 7, h = 7, data = Array.from({ length: w * h }, (_, i) => (i % w) ** 2);
  close(correlate3(data, w, h, LAPLACIAN)[3 * w + 3], 2);
});

test('LoG and DoG zero crossings sit on a smoothed step edge', () => {
  const w = 21, h = 5, data = Array.from({ length: w * h }, (_, i) => (i % w < 10 ? 50 : 200));
  const v = responses(data, w, h, { sigma: 1.5, k: 1.6 });
  for (const mode of ['log', 'dog']) {
    const edges = zeroCrossings(v[mode], w, h, 0.1);
    const cols = [...edges].map((e, i) => (e ? i % w : -1)).filter((c) => c >= 0);
    assert.ok(cols.length > 0 && cols.every((c) => c === 9 || c === 10), `${mode}: ${cols}`);
  }
});

test('DoG has the same sign pattern as LoG (positive multiple)', () => {
  const w = 21, h = 1, data = Array.from({ length: w }, (_, i) => (i < 10 ? 50 : 200));
  const v = responses(data, w, h, { sigma: 2, k: 1.2 });
  for (let i = 0; i < w; i++) if (Math.abs(v.log[i]) > 1) assert.equal(Math.sign(v.log[i]), Math.sign(v.dog[i]));
});

test('non-maximum suppression gives a thin edge on a vertical step', () => {
  const w = 12, h = 6, data = Array.from({ length: w * h }, (_, i) => (i % w < 6 ? 0 : 255));
  const v = responses(data, w, h, { sigma: 1 });
  const edges = gradientEdges(v.x, v.y, v.magnitude, w, h, 0.2);
  for (let y = 0; y < h; y++) {
    const row = [...edges.slice(y * w, y * w + w)];
    assert.ok(row.reduce((s, e) => s + e, 0) <= 2, `row ${y}: ${row}`);
  }
});
