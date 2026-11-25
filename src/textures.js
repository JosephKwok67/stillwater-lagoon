import * as THREE from 'three';
import { mulberry32, fbm2D } from './noise.js';

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function finalizeTexture(canvas, { repeat = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  if (srgb) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Helper to draw soft gouache-like painterly brush dabs with tile wrap-around
function drawWrappedDab(ctx, size, x, y, rx, ry, angle, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * size;
      const py = y + oy * size;
      if (px + rx * 2 < 0 || px - rx * 2 > size || py + ry * 2 < 0 || py - ry * 2 > size) {
        continue;
      }
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Painterly lagoon seabed: warm sage-teal silt blended with deeper blue-teal patches
 */
export function createSeabedTexture() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(101);

  ctx.fillStyle = '#256c6e';
  ctx.fillRect(0, 0, size, size);

  const palette = [
    '#1b5861',
    '#2a7674',
    '#348073',
    '#1f6169',
    '#3e8571',
    '#2d6c64',
    '#4c8d74',
    '#174c57',
  ];

  // Broad painterly washes
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 24 + rng() * 58;
    const ry = 14 + rng() * 34;
    const angle = rng() * Math.PI;
    const color = palette[Math.floor(rng() * palette.length)];
    drawWrappedDab(ctx, size, x, y, rx, ry, angle, color, 0.16 + rng() * 0.18);
  }

  // Fine sand & pebble speckles
  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 3 + rng() * 9;
    const ry = 2 + rng() * 6;
    const angle = rng() * Math.PI;
    const color = rng() > 0.45 ? '#599882' : '#184b54';
    drawWrappedDab(ctx, size, x, y, rx, ry, angle, color, 0.12 + rng() * 0.14);
  }

  return finalizeTexture(canvas, { repeat: 6, srgb: true });
}

/**
 * Painterly underwater rock albedo & subtle bump texture (cool sage-grey stone with mossy blotches)
 */
export function createUnderwaterRockTextures() {
  const size = 512;
  const colorCanvas = makeCanvas(size);
  const cCtx = colorCanvas.getContext('2d');
  const bumpCanvas = makeCanvas(size);
  const bCtx = bumpCanvas.getContext('2d');
  const rng = mulberry32(202);

  cCtx.fillStyle = '#6c847d';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const stonePalette = [
    '#7c9288',
    '#5e7874',
    '#879b8e',
    '#4d6766',
    '#6d877a',
    '#5c7f67',
    '#7a967a',
    '#465d5f',
  ];

  for (let i = 0; i < 650; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 14 + rng() * 44;
    const ry = 9 + rng() * 26;
    const angle = rng() * Math.PI;
    const color = stonePalette[Math.floor(rng() * stonePalette.length)];
    drawWrappedDab(cCtx, size, x, y, rx, ry, angle, color, 0.24 + rng() * 0.24);

    const gray = Math.floor(85 + rng() * 95);
    const bCol = `rgb(${gray},${gray},${gray})`;
    drawWrappedDab(bCtx, size, x, y, rx * 0.85, ry * 0.85, angle, bCol, 0.22);
  }

  // Painted sunlit/moss highlights & crevice strokes
  for (let i = 0; i < 480; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 4 + rng() * 14;
    const ry = 2 + rng() * 8;
    const angle = rng() * Math.PI;
    const isLight = rng() > 0.48;
    drawWrappedDab(
      cCtx,
      size,
      x,
      y,
      rx,
      ry,
      angle,
      isLight ? '#9eb09d' : '#3a5354',
      0.18 + rng() * 0.16
    );
  }

  return {
    map: finalizeTexture(colorCanvas, { repeat: 1, srgb: true }),
    bumpMap: finalizeTexture(bumpCanvas, { repeat: 1, srgb: false }),
  };
}

/**
 * Painterly dry/mossy emergent islet rock texture (warm sandy-beige stone & soft brushwork)
 */
export function createDryRockTexture() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(303);

  ctx.fillStyle = '#baa98a';
  ctx.fillRect(0, 0, size, size);

  const palette = [
    '#cbbba0',
    '#a6967a',
    '#d6c9ae',
    '#94866e',
    '#b5a686',
    '#837965',
    '#dfd4bc',
  ];

  for (let i = 0; i < 600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 14 + rng() * 42;
    const ry = 9 + rng() * 24;
    const angle = rng() * Math.PI;
    drawWrappedDab(
      ctx,
      size,
      x,
      y,
      rx,
      ry,
      angle,
      palette[Math.floor(rng() * palette.length)],
      0.26 + rng() * 0.24
    );
  }

  return finalizeTexture(canvas, { repeat: 1, srgb: true });
}

/**
 * Hand-painted warm wooden planks for the rowboat interior & benches
 */
export function createWoodPlankTexture() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(404);

  ctx.fillStyle = '#c8914f';
  ctx.fillRect(0, 0, size, size);

  const plankCount = 8;
  const plankH = size / plankCount;
  const plankTones = ['#cf9854', '#c18947', '#d49f5c', '#b98142', '#cc9450'];

  for (let p = 0; p < plankCount; p++) {
    const y0 = p * plankH;
    ctx.fillStyle = plankTones[p % plankTones.length];
    ctx.fillRect(0, y0, size, plankH);

    // Subtle painterly grain streaks along X
    for (let s = 0; s < 32; s++) {
      const sy = y0 + rng() * plankH;
      const sh = 1.5 + rng() * 4.5;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(240, 202, 134, 0.22)' : 'rgba(110, 66, 28, 0.18)';
      ctx.fillRect(0, sy, size, sh);
    }

    // Painterly wood brushstroke dabs
    for (let d = 0; d < 24; d++) {
      drawWrappedDab(
        ctx,
        size,
        rng() * size,
        y0 + rng() * plankH,
        24 + rng() * 42,
        3 + rng() * 5,
        (rng() - 0.5) * 0.08,
        rng() > 0.5 ? '#deb06d' : '#9c6832',
        0.16
      );
    }

    // Hand-painted dark plank seam
    ctx.fillStyle = 'rgba(72, 41, 18, 0.65)';
    ctx.fillRect(0, y0, size, 3);
    ctx.fillStyle = 'rgba(246, 212, 152, 0.28)';
    ctx.fillRect(0, y0 + 3, size, 2);
  }

  return finalizeTexture(canvas, { repeat: 1, srgb: true });
}

/**
 * Woven straw texture for the angler's wide-brimmed straw hat
 */
export function createStrawHatTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(505);

  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#ecd27d';
  ctx.fillRect(0, 0, size, size);

  // Concentric woven braid rings
  for (let r = 6; r < size * 0.72; r += 4.5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 9 < 4.5 ? 'rgba(182, 136, 58, 0.42)' : 'rgba(255, 241, 178, 0.45)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // Radial weave notches
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
    ctx.lineTo(cx + Math.cos(a) * size * 0.7, cy + Math.sin(a) * size * 0.7);
    ctx.strokeStyle = `rgba(164, 118, 46, ${0.1 + rng() * 0.14})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  return finalizeTexture(canvas, { repeat: 1, srgb: true });
}

/**
 * Painterly lily pad texture with radial color gradient and soft leaf veins
 */
export function createLilyPadTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(606);
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, size * 0.5);
  grad.addColorStop(0.0, '#6a9e42');
  grad.addColorStop(0.45, '#86bc4b');
  grad.addColorStop(0.85, '#9dcf5a');
  grad.addColorStop(1.0, '#6e9d40');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle radial veins
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(angle + 0.08) * size * 0.24,
      cy + Math.sin(angle + 0.08) * size * 0.24,
      cx + Math.cos(angle) * size * 0.48,
      cy + Math.sin(angle) * size * 0.48
    );
    ctx.strokeStyle = 'rgba(182, 224, 114, 0.34)';
    ctx.lineWidth = 2.0;
    ctx.stroke();
  }

  // Soft painterly mottling
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * size * 0.46;
    drawWrappedDab(
      ctx,
      size,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      10 + rng() * 14,
      6 + rng() * 9,
      a,
      rng() > 0.5 ? '#b3de6d' : '#5b8f39',
      0.12
    );
  }

  return finalizeTexture(canvas, { repeat: 1, srgb: true });
}

/**
 * Tileable stylized organic water normal map computed via smooth periodic FBM heightfield
 */
export function createWaterNormalTexture() {
  const size = 256;
  const height = new Float32Array(size * size);

  // Periodic smooth heightfield using trigonometric domain warping so it tiles seamlessly
  for (let y = 0; y < size; y++) {
    const v = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      // Map torus coordinates (cos u, sin u, cos v, sin v) into fbm2D approximations
      const nx = Math.cos(u) * 1.65 + Math.sin(v) * 0.72;
      const nz = Math.sin(u) * 1.65 + Math.cos(v) * 0.72;
      const nx2 = Math.cos(v * 2.0 + 1.3) * 1.1 + Math.sin(u * 2.0) * 0.9;
      const nz2 = Math.sin(v * 2.0 + 1.3) * 1.1 + Math.cos(u * 2.0) * 0.9;

      const h1 = fbm2D(nx * 1.4 + 10.2, nz * 1.4 + 4.7, 4);
      const h2 = fbm2D(nx2 * 1.9 + 21.5, nz2 * 1.9 + 13.1, 3);
      const wave =
        Math.sin(u * 2.0 + v * 1.0) * 0.14 +
        Math.cos(u * 3.0 - v * 2.0) * 0.09 +
        Math.sin(v * 4.0 + u * 1.0) * 0.06;

      height[y * size + x] = h1 * 0.58 + h2 * 0.32 + wave;
    }
  }

  const data = new Uint8Array(size * size * 4);
  const strength = 3.8;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Hand-painted warm plaster stucco texture for lakeside village cottages
 */
export function createStuccoTexture(baseHex = '#f1e7d5') {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(711);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 360; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 10 + rng() * 26;
    const ry = 7 + rng() * 18;
    const angle = rng() * Math.PI;
    const col = rng() > 0.5 ? '#ffffff' : '#b79f80';
    drawWrappedDab(ctx, size, x, y, rx, ry, angle, col, 0.055 + rng() * 0.05);
  }

  return finalizeTexture(canvas, { repeat: 2, srgb: true });
}

/**
 * Hand-painted scalloped terracotta / slate roof tile texture
 */
export function createRoofTileTexture(baseHex = '#c5553e', darkHex = '#8c3525', lightHex = '#de7357') {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(812);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const rows = 10;
  const cols = 8;
  const rh = size / rows;
  const cw = size / cols;

  for (let r = 0; r < rows; r++) {
    const y0 = r * rh;
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x0 = c * cw + offset;
      ctx.fillStyle = rng() > 0.55 ? lightHex : rng() > 0.3 ? baseHex : darkHex;
      ctx.globalAlpha = 0.52 + rng() * 0.3;
      ctx.beginPath();
      ctx.roundRect(x0 + 1.5, y0 + 1.5, cw - 3, rh - 2.5, [2, 2, 7, 7]);
      ctx.fill();

      // Shadow line under each tile course
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = darkHex;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return finalizeTexture(canvas, { repeat: 2, srgb: true });
}

/**
 * Painterly cobblestone lane texture for the lakeside village
 */
export function createCobbleTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(913);

  ctx.fillStyle = '#9b917c';
  ctx.fillRect(0, 0, size, size);

  const stoneColors = ['#c9bfa9', '#b8ae97', '#d4cab6', '#a89f8b', '#bfb49c'];
  for (let i = 0; i < 190; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 8 + rng() * 11;
    const ry = 6 + rng() * 9;
    const col = stoneColors[Math.floor(rng() * stoneColors.length)];
    drawWrappedDab(ctx, size, x, y, rx, ry, rng() * Math.PI, col, 0.78);
  }
  return finalizeTexture(canvas, { repeat: 3, srgb: true });
}

