# Math 99R Project · Edge Lab

An interactive, browser-only demonstration of discrete edge detection. Upload an image and watch a kernel scan every pixel from top left to bottom right. The current neighborhood, kernel coefficients, products, signed sums, and gradient magnitude are shown together.

## Run locally

With Node.js installed:

```sh
npm start
```

Open http://127.0.0.1:4173. No dependency installation is needed. A static web server also works; the app can be hosted on GitHub Pages. ES modules require HTTP rather than opening index.html with a file URL.

## Controls

- Upload a PNG, JPEG, WebP, or another browser-supported image, or use the built-in example.
- Choose an operator: Sobel magnitude, signed Sobel X / Y, central difference X, Laplacian of Gaussian (LoG), Difference of Gaussians (DoG), or Gaussian smoothing alone.
- Show either the filter response or a binary edge map. Gradient methods keep local maxima of the magnitude along the gradient direction; LoG and DoG mark zero crossings, keeping the neighbor with the smaller absolute response.
- Adjust the Gaussian smoothing scale σ (0 turns smoothing off for the gradient methods), the DoG scale ratio k, the amount of added Gaussian noise, and the edge threshold (a percentage of the largest response).
- Play/pause, step forward/back, restart, scrub, click a source pixel, or reveal the complete result.
- Adjust scan speed and working image width. Images are resized for legible classroom demonstrations. Choose 48, 96, 192, 384, 768, or 1,024 pixels in width (192 by default). Very tall images are scaled proportionally to at most 1,024 rows. Grayscale and response images are cached so playback does not recompute every pixel on each frame.

## Mathematical conventions

Grayscale intensities are rounded from `0.2126R + 0.7152G + 0.0722B`; alpha is composited over white. Unit pixel spacing is used. Sobel masks include the factor 1/8 (H_x = s_y d_x = 1/(8h)[-1 0 1; -2 0 2; -1 0 1]); the central difference includes its factor of 1/2; the discrete Laplacian is [0 1 0; 1 -4 1; 0 1 0]. Gaussian smoothing uses normalized weights sampled on [-⌈3σ⌉, ⌈3σ⌉], applied separably. DoG is f_kσ − f_σ. Noise is seeded, so the same settings always give the same image. Coordinates are zero-based, x rightward, y downward. Nearest-value replicate padding keeps the output dimensions equal to the input. Kernels are applied without flipping (cross-correlation).

Magnitude display is scaled by the image's maximum magnitude. Signed displays use negative blue, neutral white, and positive orange. Display scaling does not affect reported numerical responses. The selected pixel is included in the revealed scan; the initial state displays the first calculation. The edge maps use a single threshold and no hysteresis, so this is not a complete Canny detector.

## Privacy and tests

Image processing happens locally in the browser. No uploads, external APIs, analytics, or external fonts are used. Run `npm test` for numerical operator tests.

Faris Doughan · Math 99R: Mathematics of Visualization
