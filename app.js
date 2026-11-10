import {
  SX, SY, CENTRAL, LAPLACIAN, neighborhood, responses, edgeMap, gaussianWeights,
} from './core.js';

const $ = (id) => document.getElementById(id);
const input = $('input');
const output = $('output');
const ic = input.getContext('2d');
const oc = output.getContext('2d');

// Integer kernels for display, with the scale factor applied after the sum.
const KERNELS = {
  x: { name: 'Sₓ', ints: SX.map((v) => v * 8), scale: 1 / 8, label: '1/8' },
  y: { name: 'Sᵧ', ints: SY.map((v) => v * 8), scale: 1 / 8, label: '1/8' },
  central: { name: 'dₓ', ints: CENTRAL.map((v) => v * 2), scale: 1 / 2, label: '1/2' },
  log: { name: 'L', ints: LAPLACIAN, scale: 1, label: '' },
};
const MODE_INFO = {
  magnitude: 'Sobel on f_σ, M = √(gₓ² + gᵧ²). Edge map: local maxima along the gradient above the threshold.',
  x: 'Signed horizontal Sobel response of f_σ.',
  y: 'Signed vertical Sobel response of f_σ.',
  central: 'Central difference dₓ = ½(f[x+1] − f[x−1]) of f_σ.',
  smooth: 'Gaussian smoothing f_σ = w_σ ⋆ f, a normalized weighted average.',
  log: 'Laplacian of Gaussian r_L = L ⋆ f_σ. Edge map: zero crossings above the threshold.',
  dog: 'Difference of Gaussians r_D = f_kσ − f_σ ≈ (k−1)σ² ΔI_σ. Edge map: zero crossings.',
};

let source = null;
let w = 48, h = 36;
let gray, values, edges;
let at = 0, running = false, last = 0, credit = 0, loadVersion = 0;
let scale = 1, cachedKey = null;
const baseCanvas = document.createElement('canvas');
const resultCanvas = document.createElement('canvas');

const settings = () => ({
  mode: $('operator').value,
  view: $('view').value,
  sigma: Number($('sigma').value),
  k: Number($('kfactor').value),
  noise: Number($('noise').value),
  threshold: Number($('threshold').value) / 100,
});
const needsSigma = (mode) => mode === 'log' || mode === 'dog' || mode === 'smooth';
const effectiveSigma = (s) => (needsSigma(s.mode) ? Math.max(0.5, s.sigma) : s.sigma);
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) >= 100 ? 1 : 2));

function updateLabels() {
  const s = settings();
  const sig = effectiveSigma(s);
  $('sigmaValue').textContent = sig === 0 ? 'off' : sig.toFixed(2);
  $('kValue').textContent = s.k.toFixed(2);
  $('noiseValue').textContent = String(s.noise);
  $('thresholdValue').textContent = `${Math.round(s.threshold * 100)}%`;
  $('kLabel').hidden = s.mode !== 'dog';
  $('thresholdLabel').hidden = s.view !== 'edges' || s.mode === 'smooth';
  $('view').disabled = s.mode === 'smooth';
  $('modeInfo').textContent = MODE_INFO[s.mode];
}

function compute() {
  if (!gray) return;
  const s = settings();
  values = responses(gray, w, h, { sigma: effectiveSigma(s), k: s.k, noise: s.noise, seed: 12345 });
  edges = null;
  cachedKey = null;
  drawBase();
}

function drawBase() {
  baseCanvas.width = w; baseCanvas.height = h;
  const px = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const g = Math.round(values.base[i]);
    px.data.set([g, g, g, 255], 4 * i);
  }
  baseCanvas.getContext('2d').putImageData(px, 0, 0);
}

function cacheResult(s) {
  const key = `${s.mode}|${s.view}|${s.threshold}`;
  if (key === cachedKey) return;
  resultCanvas.width = w; resultCanvas.height = h;
  const px = new ImageData(w, h);
  if (s.view === 'edges' && s.mode !== 'smooth') {
    edges = edgeMap(s.mode, values, w, h, s.threshold);
    for (let i = 0; i < w * h; i++) {
      const v = edges[i] ? 20 : 250;
      px.data.set([v, v, v, 255], 4 * i);
    }
  } else {
    const a = s.mode === 'smooth' ? values.smooth : values[s.mode];
    const max = a.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
    for (let i = 0; i < w * h; i++) {
      if (s.mode === 'smooth') {
        const g = Math.round(a[i]);
        px.data.set([g, g, g, 255], 4 * i);
      } else if (s.mode === 'magnitude') {
        const g = Math.round((255 * a[i]) / max);
        px.data.set([g, g, g, 255], 4 * i);
      } else {
        const t = Math.abs(a[i]) / max;
        const end = a[i] < 0 ? [36, 100, 184] : [211, 103, 32];
        px.data.set([0, 1, 2].map((c) => Math.round(245 + (end[c] - 245) * t)).concat(255), 4 * i);
      }
    }
  }
  resultCanvas.getContext('2d').putImageData(px, 0, 0);
  cachedKey = key;
}

function pause() { running = false; $('play').textContent = 'Play'; }

function example() {
  pause();
  loadVersion++;
  const c = document.createElement('canvas');
  c.width = 320; c.height = 240;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#253b46'; ctx.fillRect(0, 0, 320, 240);
  ctx.fillStyle = '#e8e5d3'; ctx.fillRect(55, 40, 105, 155);
  ctx.fillStyle = '#8faaa4'; ctx.beginPath(); ctx.arc(226, 125, 57, 0, 2 * Math.PI); ctx.fill();
  source = c;
  $('fileStatus').textContent = 'Example image';
  prepare();
}

function prepare() {
  pause();
  document.body.classList.add('has-image');
  $('editor').hidden = false;
  w = Number($('resolution').value);
  h = Math.max(3, Math.round((w * source.height) / source.width));
  if (h > 1024) { w = Math.max(3, Math.round((w * 1024) / h)); h = 1024; }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]);
  }
  scale = Math.max(1, Math.floor(768 / Math.max(w, h)));
  input.width = output.width = w * scale;
  input.height = output.height = h * scale;
  ic.imageSmoothingEnabled = oc.imageSmoothingEnabled = false;
  $('dimensions').textContent = `${w} × ${h} pixels`;
  $('scrub').max = w * h - 1;
  at = 0;
  compute();
  render();
}

// ---------- pixel-calculation panel ----------
function matrix(data, intensity = false) {
  const box = document.createElement('div');
  box.className = 'matrix';
  data.forEach((v, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell' + (i === 4 ? ' center' : '');
    cell.textContent = fmt(v);
    if (intensity) {
      const g = Math.round(Math.max(0, Math.min(255, v)));
      cell.style.background = `rgb(${g},${g},${g})`;
      cell.style.color = g > 135 ? '#152d37' : 'white';
    }
    box.append(cell);
  });
  return box;
}
function group(title, data, intensity) {
  const el = document.createElement('div');
  el.className = 'matrix-group';
  const caption = document.createElement('p');
  caption.className = 'matrix-title';
  caption.textContent = title;
  el.append(caption, matrix(data, intensity));
  return el;
}
const symbol = (t) => Object.assign(document.createElement('span'), { className: 'symbol', textContent: t });
const strong = (t) => Object.assign(document.createElement('strong'), { className: 'sum', textContent: t });

function kernelRow(kernel, pixels, pixelTitle) {
  const row = document.createElement('div');
  row.className = 'calc-row';
  const products = pixels.map((v, i) => v * kernel.ints[i]);
  const sum = products.reduce((s, v) => s + v, 0);
  row.append(group(pixelTitle, pixels, true), symbol('×'), group(kernel.name, kernel.ints), symbol('='),
    group('Products', products), symbol('Σ'), strong(fmt(sum)));
  if (kernel.scale !== 1) row.append(symbol(`× ${kernel.label} =`), strong(fmt(sum * kernel.scale)));
  return row;
}

function valueRow(parts) {
  const row = document.createElement('div');
  row.className = 'calc-row';
  parts.forEach((p) => row.append(typeof p === 'string' ? symbol(p) : p));
  return row;
}
const labeled = (title, value) => {
  const el = document.createElement('div');
  el.className = 'matrix-group';
  el.append(Object.assign(document.createElement('p'), { className: 'matrix-title', textContent: title }), strong(fmt(value)));
  return el;
};

function calculationPanel(s, x, y) {
  const box = $('calculations');
  box.replaceChildren();
  const sig = effectiveSigma(s);
  const fTitle = sig > 0 ? `f_σ (σ = ${sig.toFixed(2)})` : 'Pixels f';
  const p = neighborhood(values.smooth, w, h, x, y);
  if (s.mode === 'magnitude' || s.mode === 'x') box.append(kernelRow(KERNELS.x, p, fTitle));
  if (s.mode === 'magnitude' || s.mode === 'y') box.append(kernelRow(KERNELS.y, p, fTitle));
  if (s.mode === 'central') box.append(kernelRow(KERNELS.central, p, fTitle));
  if (s.mode === 'log') box.append(kernelRow(KERNELS.log, p, fTitle));
  if (s.mode === 'smooth') {
    const m = (gaussianWeights(sig).length - 1) / 2;
    box.append(valueRow([group('Pixels f (3×3 of the window)', neighborhood(values.base, w, h, x, y), true),
      `→ weighted average over a ${2 * m + 1}×${2 * m + 1} window →`, labeled('f_σ', values.smooth[at])]));
  }
  if (s.mode === 'dog') {
    box.append(valueRow([labeled(`f_kσ (kσ = ${(s.k * sig).toFixed(2)})`, values.smoothK[at]), '−',
      labeled(`f_σ (σ = ${sig.toFixed(2)})`, values.smooth[at]), '=', labeled('r_D', values.dog[at])]));
  }
}

function resultText(s) {
  const v = values;
  let text;
  if (s.mode === 'magnitude') text = `M = √((${fmt(v.x[at])})² + (${fmt(v.y[at])})²) = ${fmt(v.magnitude[at])}`;
  else if (s.mode === 'smooth') text = `f_σ = ${fmt(v.smooth[at])}`;
  else text = `${{ x: 'gₓ', y: 'gᵧ', central: 'dₓ', log: 'r_L', dog: 'r_D' }[s.mode]} = ${fmt(v[s.mode][at])}`;
  if (s.view === 'edges' && s.mode !== 'smooth' && edges) text += edges[at] ? '   →  edge pixel' : '   →  not an edge';
  return text;
}

function render() {
  if (!values) return;
  const s = settings();
  cacheResult(s);
  const x = at % w, y = Math.floor(at / w);
  ic.drawImage(baseCanvas, 0, 0, input.width, input.height);
  oc.fillStyle = '#d9d9de';
  oc.fillRect(0, 0, output.width, output.height);
  if (y > 0) oc.drawImage(resultCanvas, 0, 0, w, y, 0, 0, w * scale, y * scale);
  oc.drawImage(resultCanvas, 0, y, x + 1, 1, 0, y * scale, (x + 1) * scale, scale);
  const stroke = Math.max(1, Math.max(w, h) / 400);
  ic.strokeStyle = oc.strokeStyle = '#ffb547';
  ic.lineWidth = oc.lineWidth = stroke;
  ic.strokeRect((x - 1) * scale, (y - 1) * scale, 3 * scale, 3 * scale);
  oc.strokeRect(x * scale, y * scale, Math.max(1, scale), Math.max(1, scale));
  $('position').textContent = `x = ${x}, y = ${y}`;
  $('progressLabel').textContent = `${at + 1} / ${w * h}`;
  $('scrub').value = at;
  $('back').disabled = at === 0;
  $('step').disabled = at === w * h - 1;
  $('resultTitle').textContent = s.view === 'edges' && s.mode !== 'smooth' ? 'Edge map' : 'Response';
  calculationPanel(s, x, y);
  $('result').textContent = resultText(s);
}

function advance(n) {
  at = Math.min(w * h - 1, Math.max(0, at + n));
  if (at === w * h - 1) pause();
  render();
}
function frame(time) {
  if (running) {
    credit += (Math.min(250, time - last) * Number($('speed').value)) / 1000;
    const n = Math.floor(credit);
    if (n) { credit -= n; advance(n); }
  }
  last = time;
  requestAnimationFrame(frame);
}

// ---------- events ----------
$('play').onclick = () => {
  if (running) return pause();
  if (at === w * h - 1) at = 0;
  running = true; credit = 0; last = performance.now();
  $('play').textContent = 'Pause';
  render();
};
$('step').onclick = () => { pause(); advance(1); };
$('back').onclick = () => { pause(); advance(-1); };
$('reset').onclick = () => { pause(); at = 0; render(); };
$('finish').onclick = () => { pause(); at = w * h - 1; render(); };
$('scrub').oninput = () => { pause(); at = Number($('scrub').value); render(); };
$('resolution').onchange = () => { if (source) prepare(); };
$('sample').onclick = example;

// Settings that only change the display.
for (const id of ['view', 'threshold']) $(id).oninput = () => { updateLabels(); render(); };
// Settings that change the numbers.
let pending = 0;
for (const id of ['operator', 'sigma', 'kfactor', 'noise']) {
  $(id).oninput = () => {
    updateLabels();
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { compute(); render(); });
  };
}

input.onclick = (e) => {
  pause();
  const r = input.getBoundingClientRect();
  const x = Math.min(w - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * h)));
  at = y * w + x;
  render();
};

$('upload').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pause();
  const version = ++loadVersion;
  if (!file.type.startsWith('image/')) { $('fileStatus').textContent = 'Choose a supported image file.'; return; }
  if (file.size > 30 * 1024 * 1024) { $('fileStatus').textContent = 'Choose an image smaller than 30 MB.'; return; }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    if (version !== loadVersion) return;
    source = img;
    prepare();
    $('fileStatus').textContent = file.name;
  } catch {
    if (version === loadVersion) $('fileStatus').textContent = 'This image could not be read. Try PNG, JPEG, or WebP.';
  } finally {
    URL.revokeObjectURL(url);
    e.target.value = '';
  }
};

updateLabels();
requestAnimationFrame(frame);
