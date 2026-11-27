import * as THREE from 'three';
import { mulberry32, fbm2D, smoothstep, clamp } from './noise.js';
import { getWorldElevation, getShoreZ } from './terrain.js';

/**
 * 静水泻湖 · 吉卜力 × 动森 风吹草地与野花系统 (Meadow Grass v2)
 * ---------------------------------------------------------------------------
 * - GPU 实例化水粉草簇（每簇 7 片柔宽弯叶、2 段 28 三角形，高覆盖且 GPU 轻量），8m 分块 + 视锥剔除 + 距离稀疏化 LOD
 * - 吉卜力参考画风着色：大尺度阵风草浪 + 斜向日光云影色带 + 嫩芽黄绿叶尖 + 受风亮绿微光
 * - 角色 / 小狗走过时草叶向两侧柔和分开
 * - 分区自然过渡：石板路与屋脚自动变矮羽化、村内动森式柔顺草坪、山坡起伏高草野地 + 奶油白与金黄毛茛野花簇
 * - 精确贴合地形三角形表面，精准避开水面沙滩、石板长廊、码头、门廊、房屋本体、菜园、灯塔与渔市（消除生硬矩形空地）
 * - 水面折射离屏通道自动跳过草地渲染（零额外开销）
 */

// Mirrors the seabed/terrain PlaneGeometry in environment.js (164 x 164, 184 x 184 segments)
const TERRAIN_SIZE = 164;
const TERRAIN_SEGS = 184;
const TERRAIN_CELL = TERRAIN_SIZE / TERRAIN_SEGS;
const TERRAIN_HALF = TERRAIN_SIZE / 2;

const CHUNK_SIZE = 8;
const GRID_STEP = 0.255; // Lush painterly carpet (~15 candidate tufts / m² before masks)

// Stepping-stone flagstone lane to the lighthouse (mirrors town.js lanePoints[6..9])
const FLAGSTONE_LANE = [
  [13.4, -16.4],
  [15.8, -15.7],
  [18.0, -15.0],
  [19.8, -14.5],
];

const WIND_BY_PRESET = { sunny: 0.56, morning: 0.36, sunset: 0.44, overcast: 0.86 };

export const meadowUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.84, 0.54).normalize() },
  uWindStrength: { value: 0.56 },
  uPushA: { value: new THREE.Vector4(0, 0, 0.95, 0) },
  uPushB: { value: new THREE.Vector4(0, 0, 0.62, 0) },
  uFadeNear: { value: 66 },
  uFadeFar: { value: 92 },
  uDaylight: { value: 1 },
  uRootCol: { value: new THREE.Color('#2b6b28') },
  uMidCol: { value: new THREE.Color('#519e2e') },
  uTipCol: { value: new THREE.Color('#95cc3d') },
  uSheenCol: { value: new THREE.Color('#d2eb6e') },
  uStemCol: { value: new THREE.Color('#4d9430') },
  uHeartCol: { value: new THREE.Color('#f5c034') },
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * One painterly Ghibli grass tuft: 7 softly broad, curved blades (2 height segments = 28 tris/tuft).
 * Slightly wider rounded-tip blades blend together like gouache strokes without spiky bare gaps.
 */
function createTuftGeometry(seed, blades = 7, segments = 2) {
  const rng = mulberry32(seed);
  const pos = [];
  const nor = [];
  const hgt = [];
  const idx = [];
  const n = new THREE.Vector3();
  let base = 0;

  for (let b = 0; b < blades; b++) {
    const yaw = (b / blades) * Math.PI * 2 + (rng() - 0.5) * 0.78;
    const ox = Math.cos(yaw);
    const oz = Math.sin(yaw);
    const r = 0.012 + rng() * 0.085;
    const bx = ox * r;
    const bz = oz * r;
    const h = 0.66 + rng() * 0.36;
    const w = 0.068 + rng() * 0.036;
    const lean = 0.18 + rng() * 0.34;
    const faceYaw = yaw + Math.PI * 0.5 + (rng() - 0.5) * 0.72;
    const wx = Math.cos(faceYaw);
    const wz = Math.sin(faceYaw);

    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      // Soft painterly brushstroke taper (fuller mid-blade, gently rounded tip)
      const taper = s === segments ? 0.12 : Math.pow(1 - t * 0.68, 0.75);
      const half = 0.5 * w * taper;
      const leanOff = lean * h * t * t;
      const cy = h * t * (1 - 0.32 * lean * t);
      const cx = bx + ox * leanOff;
      const cz = bz + oz * leanOff;
      pos.push(cx - wx * half, cy, cz - wz * half, cx + wx * half, cy, cz + wz * half);
      // Sky-biased soft gouache normal so grass looks cohesive and luminous from top-down camera
      n.set(-wz * 0.28 + ox * 0.22, 1.0, wx * 0.28 + oz * 0.22).normalize();
      nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
      hgt.push(t, t);
      if (s < segments) {
        const a = base + s * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += (segments + 1) * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aBladeH', new THREE.Float32BufferAttribute(hgt, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * A sunny Ghibli × Animal Crossing wildflower cluster (1-2 tiny blooms on slender stems).
 * `aPart`: 0 = stem, 1 = petals (instance colour), 2 = warm golden heart.
 */
function createFlowerGeometry() {
  const pos = [];
  const nor = [];
  const hgt = [];
  const part = [];
  const idx = [];
  let v = 0;

  const blooms = [
    { ox: 0.0, oz: 0.0, h: 1.0, r: 0.082, tiltX: 0.08, tiltZ: -0.05 },
    { ox: 0.075, oz: 0.055, h: 0.78, r: 0.06, tiltX: -0.1, tiltZ: 0.12 },
  ];

  for (const bl of blooms) {
    // Slender crossed stem
    for (const ang of [0, Math.PI * 0.5]) {
      const dx = Math.cos(ang) * 0.009;
      const dz = Math.sin(ang) * 0.009;
      pos.push(
        bl.ox - dx, 0, bl.oz - dz,
        bl.ox + dx, 0, bl.oz + dz,
        bl.ox - dx, bl.h, bl.oz - dz,
        bl.ox + dx, bl.h, bl.oz + dz
      );
      for (let i = 0; i < 4; i++) {
        nor.push(0, 1, 0);
        part.push(0);
      }
      hgt.push(0, 0, bl.h, bl.h);
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      v += 4;
    }

    // 5-lobed buttercup / daisy petal disc
    const ring = 15;
    const petalCenter = v;
    pos.push(bl.ox, bl.h, bl.oz);
    nor.push(0, 1, 0);
    hgt.push(bl.h);
    part.push(1);
    v += 1;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      const pr = bl.r * (0.56 + 0.44 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.55));
      const px = Math.cos(a) * pr;
      const pz = Math.sin(a) * pr;
      const py = bl.h + 0.012 + px * bl.tiltX + pz * bl.tiltZ;
      pos.push(bl.ox + px, py, bl.oz + pz);
      nor.push(0, 1, 0);
      hgt.push(bl.h);
      part.push(1);
    }
    for (let i = 0; i < ring; i++) {
      idx.push(petalCenter, petalCenter + 1 + ((i + 1) % ring), petalCenter + 1 + i);
    }
    v += ring;

    // Warm golden stamen centre
    const heartSegs = 6;
    const heartCenter = v;
    pos.push(bl.ox, bl.h + 0.02, bl.oz);
    nor.push(0, 1, 0);
    hgt.push(bl.h);
    part.push(2);
    v += 1;
    for (let i = 0; i < heartSegs; i++) {
      const a = (i / heartSegs) * Math.PI * 2;
      const hr = bl.r * 0.3;
      pos.push(bl.ox + Math.cos(a) * hr, bl.h + 0.016, bl.oz + Math.sin(a) * hr);
      nor.push(0, 1, 0);
      hgt.push(bl.h);
      part.push(2);
    }
    for (let i = 0; i < heartSegs; i++) {
      idx.push(heartCenter, heartCenter + 1 + ((i + 1) % heartSegs), heartCenter + 1 + i);
    }
    v += heartSegs;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aBladeH', new THREE.Float32BufferAttribute(hgt, 1));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------------------
// Material (Lambert + wind / parting / Ghibli sunlit bands; keeps fog, shadows & scene lights)
// ---------------------------------------------------------------------------

const WIND_VERTEX = /* glsl */ `
{
  vec3 gBase = instanceMatrix[3].xyz;
  vec3 gC0 = instanceMatrix[0].xyz;
  vec3 gC1 = instanceMatrix[1].xyz;
  vec3 gC2 = instanceMatrix[2].xyz;
  float gWorldH = length(gC1);
  float gH = aBladeH;
  float gW = gH * gH;

  // Travelling Ghibli hillside gust bands + slow meadow swell + crisp leaf-tip flutter
  float gWave = 0.5 + 0.5 * sin(dot(gBase.xz, uWindDir) * 0.28 - uTime * 1.25 + sin(gBase.x * 0.09) * 1.1);
  float gSlow = 0.5 + 0.5 * sin(dot(gBase.xz, vec2(0.055, -0.044)) - uTime * 0.29);
  float gGust = gWave * gWave * (0.48 + 0.52 * gSlow);
  float gFlutter = sin(gBase.x * 1.9 + gBase.z * 1.37 + uTime * 3.3 + position.x * 10.0 + position.z * 7.0);
  vec2 gPerp = vec2(-uWindDir.y, uWindDir.x);
  vec2 gBend = uWindDir * uWindStrength * (0.18 + 0.72 * gGust) + gPerp * gFlutter * 0.075 * uWindStrength;

  // Soft parting around the walking player (A) and companion puppy (B)
  vec2 gToA = gBase.xz - uPushA.xy;
  float gDA = length(gToA);
  gBend += (gToA / max(gDA, 0.001)) * (1.0 - smoothstep(uPushA.z * 0.25, uPushA.z, gDA)) * uPushA.w;
  vec2 gToB = gBase.xz - uPushB.xy;
  float gDB = length(gToB);
  gBend += (gToB / max(gDB, 0.001)) * (1.0 - smoothstep(uPushB.z * 0.25, uPushB.z, gDB)) * uPushB.w;

  // Length-preserving bend (tip arcs sideways and slightly dips)
  float gLen = min(length(gBend), 0.9);
  gBend = gLen > 0.0001 ? normalize(gBend) * gLen : vec2(0.0);
  float gDrop = 1.0 - sqrt(1.0 - gLen * gLen);
  vec3 gDisp = vec3(gBend.x, -gDrop, gBend.y) * gW * gWorldH;

  // World-space displacement -> instance-local (instance matrix = T * R * S)
  transformed += vec3(
    dot(gC0, gDisp) / dot(gC0, gC0),
    dot(gC1, gDisp) / dot(gC1, gC1),
    dot(gC2, gDisp) / dot(gC2, gC2)
  );

  // Far tufts gently sink into the meadow so distance LOD thinning never pops
  float gFade = 1.0 - smoothstep(uFadeNear, uFadeFar, distance(gBase, cameraPosition));
  transformed.y *= gFade;

  vBladeH = gH;
  vGust = gGust * gW * clamp(uWindStrength * 1.65, 0.0, 1.0);
  // Broad diagonal sunlit/cloud-dapple hillside wave like Miyazaki painted slopes
  vSunBand = 0.5 + 0.5 * sin(gBase.x * 0.095 + gBase.z * 0.135 - uTime * 0.12 + sin(gBase.x * 0.04) * 1.4);
}
`;

function createMeadowMaterial(isFlower) {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, meadowUniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;
        uniform vec4 uPushA;
        uniform vec4 uPushB;
        uniform float uFadeNear;
        uniform float uFadeFar;
        attribute float aBladeH;
        varying float vBladeH;
        varying float vGust;
        varying float vSunBand;
        ${isFlower ? 'attribute float aPart;\n        varying float vPart;' : ''}
        `
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${WIND_VERTEX}
        ${isFlower ? 'vPart = aPart;' : ''}
        `
      );

    const colorSnippet = isFlower
      ? `
        {
          vec3 fPetal = diffuseColor.rgb * (0.94 + 0.12 * vSunBand);
          vec3 fStem = mix(uRootCol, uStemCol, clamp(vBladeH, 0.0, 1.0));
          diffuseColor.rgb = vPart < 0.5 ? fStem : (vPart < 1.5 ? fPetal : uHeartCol);
        }
      `
      : `
        {
          vec3 gTint = diffuseColor.rgb;
          vec3 gCol = mix(uRootCol, uMidCol, smoothstep(0.0, 0.48, vBladeH));
          gCol = mix(gCol, uTipCol, smoothstep(0.42, 1.0, vBladeH));
          gCol *= gTint;
          // Painterly diagonal sunlit hillside dapple + luminous breeze crest sheen
          gCol *= 0.91 + 0.14 * vSunBand;
          gCol = mix(gCol, uSheenCol, clamp(vGust * 0.34 + vSunBand * vBladeH * 0.08, 0.0, 0.38));
          diffuseColor.rgb = gCol;
        }
      `;

    const glow = isFlower ? '0.18' : '(0.05 + 0.06 * vBladeH)';

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRootCol;
        uniform vec3 uMidCol;
        uniform vec3 uTipCol;
        uniform vec3 uSheenCol;
        uniform vec3 uStemCol;
        uniform vec3 uHeartCol;
        uniform float uDaylight;
        varying float vBladeH;
        varying float vGust;
        varying float vSunBand;
        ${isFlower ? 'varying float vPart;' : ''}
        `
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${colorSnippet}`)
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        // Double-sided blades keep their sky-biased normal on both faces (no dark back sides)
        normal = normalize(vNormal);
        `
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // Soft sun-soaked gouache glow so the meadow stays fresh and never muddy in shade
        totalEmissiveRadiance += diffuseColor.rgb * ${glow} * uDaylight;
        `
      );
  };

  material.customProgramCacheKey = () => (isFlower ? 'meadow_flower_v2' : 'meadow_grass_v2');
  return material;
}

// ---------------------------------------------------------------------------
// Terrain-exact height sampling (matches environment.js triangle mesh)
// ---------------------------------------------------------------------------

function createTerrainSampler() {
  const n = TERRAIN_SEGS + 1;
  const heights = new Float32Array(n * n);
  for (let iy = 0; iy < n; iy++) {
    const z = iy * TERRAIN_CELL - TERRAIN_HALF;
    for (let ix = 0; ix < n; ix++) {
      heights[iy * n + ix] = getWorldElevation(ix * TERRAIN_CELL - TERRAIN_HALF, z);
    }
  }

  const out = { y: 0, slope: 0 };
  function sample(x, z) {
    const u = (x + TERRAIN_HALF) / TERRAIN_CELL;
    const v = (z + TERRAIN_HALF) / TERRAIN_CELL;
    const ix = Math.floor(u);
    const iy = Math.floor(v);
    if (ix < 0 || iy < 0 || ix >= TERRAIN_SEGS || iy >= TERRAIN_SEGS) return null;
    const fx = u - ix;
    const fz = v - iy;
    const ha = heights[iy * n + ix];
    const hb = heights[(iy + 1) * n + ix];
    const hc = heights[(iy + 1) * n + ix + 1];
    const hd = heights[iy * n + ix + 1];
    let dx;
    let dz;
    if (fx + fz <= 1) {
      out.y = ha + fx * (hd - ha) + fz * (hb - ha);
      dx = hd - ha;
      dz = hb - ha;
    } else {
      out.y = hc + (1 - fx) * (hb - hc) + (1 - fz) * (hd - hc);
      dx = hc - hb;
      dz = hc - hd;
    }
    out.slope = Math.hypot(dx, dz) / TERRAIN_CELL;
    return out;
  }

  function chunkMaxHeight(x0, z0, size) {
    const i0 = clamp(Math.floor((x0 + TERRAIN_HALF) / TERRAIN_CELL), 0, TERRAIN_SEGS);
    const i1 = clamp(Math.ceil((x0 + size + TERRAIN_HALF) / TERRAIN_CELL), 0, TERRAIN_SEGS);
    const j0 = clamp(Math.floor((z0 + TERRAIN_HALF) / TERRAIN_CELL), 0, TERRAIN_SEGS);
    const j1 = clamp(Math.ceil((z0 + size + TERRAIN_HALF) / TERRAIN_CELL), 0, TERRAIN_SEGS);
    let m = -Infinity;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) m = Math.max(m, heights[j * n + i]);
    }
    return m;
  }

  return { sample, chunkMaxHeight };
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz), 0, 1);
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

// Reference-matched sunlit Ghibli meadow blossoms: predominantly warm buttercup yellow & creamy white
const FLOWER_PALETTE = [
  '#fffbe8', // creamy white daisy
  '#fffbe8',
  '#fae362', // warm buttercup yellow
  '#fae362',
  '#f4cc48', // golden dandelion
  '#f7b9ce', // soft blossom pink
  '#bcd1f7', // pale sky forget-me-not
].map((h) => new THREE.Color(h));

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds the meadow and returns `{ group, stats, update(elapsed, camera, opts) }`.
 * @param {THREE.Scene} scene
 * @param {{ town?: object, quality?: number }} options
 */
export function buildMeadowGrass(scene, { town = null, quality } = {}) {
  if (typeof quality !== 'number') {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
    quality = /Android|iPhone|iPad|Mobile/i.test(ua) || cores <= 4 ? 0.55 : 1.0;
  }

  const group = new THREE.Group();
  group.name = 'MeadowGrass';
  scene.add(group);

  const rng = mulberry32(20261128);
  const terrain = createTerrainSampler();
  const tuftGeo = createTuftGeometry(77, 7, 2);
  const flowerGeo = createFlowerGeometry();
  const grassMat = createMeadowMaterial(false);
  const flowerMat = createMeadowMaterial(true);

  const farm = town?.farmPlotAnchor
    ? { x: town.farmPlotAnchor.x, z: town.farmPlotAnchor.z - 0.32 - 1.175 }
    : null;
  const buildings = town?.enterableBuildings || [];
  const probe = new THREE.Vector3();

  /**
   * Returns 0 when completely blocked (inside buildings, porches, paths, garden, landmarks),
   * or a soft edge height factor (0.55..1.0) right next to stone paths & cottage plinths so grass
   * feathers organically instead of ending in a rigid rectangular cutout.
   */
  function getPlacementScale(x, z) {
    const zShore = getShoreZ(x);
    const edgeJitter = (fbm2D(x * 0.85 + 2.1, z * 0.85 - 1.7, 2) - 0.5) * 0.14;
    let edgeFactor = 1.0;

    // 1. Cobblestone promenade + stone quay coping (promenade back edge = zShore - 2.93)
    if (x > -13.18 && x < 13.48) {
      const promBack = zShore - 2.96 + edgeJitter;
      if (z > promBack) return 0;
      const dProm = promBack - z;
      if (dProm < 0.42) edgeFactor = Math.min(edgeFactor, 0.58 + (dProm / 0.42) * 0.42);
    }

    // 2. Three wooden piers & top stair landings
    if (Math.abs(x - 4.2) < 1.32 && z > zShore - 0.45) return 0;
    if (Math.abs(x + 6.8) < 1.22 && z > zShore - 0.45) return 0;
    if (Math.abs(x - 14.2) < 1.18 && z > zShore - 0.55) return 0;

    // 3. Stepping-stone flagstone lane to the eastern lighthouse cliff
    for (let i = 0; i < FLAGSTONE_LANE.length - 1; i++) {
      const [ax, az] = FLAGSTONE_LANE[i];
      const [bx, bz] = FLAGSTONE_LANE[i + 1];
      const d = distToSegment(x, z, ax, az, bx, bz);
      if (d < 0.66 + edgeJitter * 0.5) return 0;
      if (d < 1.05) edgeFactor = Math.min(edgeFactor, 0.6 + ((d - 0.66) / 0.39) * 0.4);
    }

    // 4. Fenced garden farm plot beside Player's Home
    if (farm) {
      const dxF = Math.abs(x - farm.x);
      const dzF = Math.abs(z - farm.z);
      if (dxF < 1.72 && dzF < 1.46) return 0;
    }

    // 5. Landmark plinths (lighthouse, keeper shed, fish market stall & drying rack)
    if (Math.hypot(x - 21.8, z + 15.2) < 2.38) return 0;
    if (Math.hypot(x - 19.75, z + 15.82) < 1.52) return 0;
    if (Math.hypot(x + 8.05, z + 19.55) < 1.82) return 0;
    if (Math.hypot(x + 10.4, z + 19.85) < 0.85) return 0;

    // 6. Exact enterable building footprints + real porch / stoop shapes (zero bare yard under windows!)
    for (const b of buildings) {
      if (!b.toLocal || !b.dims) continue;
      const { lx, lz } = b.toLocal(x, z);
      const halfW = b.dims.width * 0.5;
      const halfD = b.dims.depth * 0.5;
      const porchD = b.dims.porchD ?? 1.22;
      const doorX = b.dims.doorX ?? 0;

      // Main house body + stone foundation plinth
      const pad = 0.14 + edgeJitter * 0.4;
      if (Math.abs(lx) < halfW + pad && Math.abs(lz) < halfD + pad) return 0;

      // Real porch / stone stoop shape per cottage
      if (b.id === 'neighbor_east') {
        // East yellow-roofed cottage only has a stone stoop around its left-side front door;
        // the front-right yard under the sunny window stays lush with grass right up to the plinth!
        if (lx > doorX - 1.15 && lx < doorX + 1.05 && lz >= halfD - 0.1 && lz < halfD + porchD + 0.62) {
          return 0;
        }
      } else if (b.id === 'player_home') {
        // Full-width wooden deck + 2 front stairs
        if (Math.abs(lx) < halfW + 0.18 && lz >= halfD - 0.1 && lz < halfD + porchD + 0.58) {
          return 0;
        }
      } else {
        // Artisan workshop porch
        if (Math.abs(lx) < halfW + 0.15 && lz >= halfD - 0.1 && lz < halfD + porchD + 0.42) {
          return 0;
        }
      }

      // Soft grass feathering along cottage walls
      const wallDist = Math.max(Math.abs(lx) - (halfW + pad), Math.abs(lz) - (halfD + pad));
      if (wallDist > 0 && wallDist < 0.35) {
        edgeFactor = Math.min(edgeFactor, 0.65 + (wallDist / 0.35) * 0.35);
      }
    }

    // 7. Non-enterable back-row houses, trees, boulders & coastal rocks via town collision check
    if (town?.resolveLandCollisions) {
      probe.set(x, 0, z);
      town.resolveLandCollisions(probe, 0.02);
      if (Math.abs(probe.x - x) + Math.abs(probe.z - z) > 0.05) return 0;
    }

    return edgeFactor;
  }

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const chunks = [];
  let totalTufts = 0;
  let totalFlowers = 0;

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
  };

  const chunkMin = -TERRAIN_HALF + 2;
  const chunkMax = TERRAIN_HALF - 2;

  for (let x0 = chunkMin; x0 < chunkMax; x0 += CHUNK_SIZE) {
    for (let z0 = chunkMin; z0 < chunkMax; z0 += CHUNK_SIZE) {
      if (terrain.chunkMaxHeight(x0, z0, CHUNK_SIZE) < 0.5) continue;

      const tufts = [];
      const flowers = [];

      for (let gx = x0 + GRID_STEP * 0.5; gx < x0 + CHUNK_SIZE; gx += GRID_STEP) {
        for (let gz = z0 + GRID_STEP * 0.5; gz < z0 + CHUNK_SIZE; gz += GRID_STEP) {
          const x = gx + (rng() - 0.5) * GRID_STEP * 0.94;
          const z = gz + (rng() - 0.5) * GRID_STEP * 0.94;
          const s = terrain.sample(x, z);
          if (!s || s.y < 0.5) continue;
          const y = s.y;

          // Sand -> grass shoreline fade, bare rocky cliff faces
          let dens = smoothstep(0.5, 0.82, y) * (1 - smoothstep(1.05, 1.85, s.slope));
          if (dens <= 0.001) continue;

          // Zones: cozy trimmed village lawn vs. lush tall Ghibli meadow hills
          const inland = getShoreZ(x) - z;
          const lawnW =
            smoothstep(-17.5, -15.0, x) *
            (1 - smoothstep(15.0, 17.5, x)) *
            (1 - smoothstep(11.0, 14.2, inland)) *
            smoothstep(-1.0, 0.5, inland);
          const tallN = fbm2D(x * 0.085 + 17.3, z * 0.085 - 8.1, 3);
          const meadowH = 0.34 + smoothstep(0.32, 0.75, tallN) * 0.34;
          const lawnH = 0.19 + tallN * 0.12;
          const baseHeight = THREE.MathUtils.lerp(meadowH, lawnH, lawnW);

          // Keep village & visible hillside lush; gently thin distant perimeter beyond 46m for fast frame rate
          const distFromVillage = Math.hypot(x - 2, z + 24);
          const farFromVillage = smoothstep(42, 66, distFromVillage);
          dens *= THREE.MathUtils.lerp(0.84 + 0.16 * smoothstep(0.28, 0.62, tallN), 1.0, lawnW);
          dens *= 1 - farFromVillage * 0.52;
          dens *= quality;
          if (rng() > dens) continue;

          const edgeScale = getPlacementScale(x, z);
          if (edgeScale <= 0) continue;

          // Painterly patch tint: warm sunlit golden-lime swathes & cool emerald-moss hollows
          const patch = fbm2D(x * 0.055 + 3.3, z * 0.055 + 9.1, 3);
          const hueN = fbm2D(x * 0.19 - 5.2, z * 0.19 + 2.7, 2);
          const bright = 0.86 + patch * 0.3 + (rng() - 0.5) * 0.09;
          const warmSun = smoothstep(0.56, 0.78, hueN) * (1 - lawnW * 0.55) * 0.48;
          const coolShade = smoothstep(0.4, 0.22, hueN) * 0.3;
          tint.setRGB(
            bright * (1 + warmSun * 0.34 - coolShade * 0.12),
            bright * (1 + warmSun * 0.09),
            bright * (1 - warmSun * 0.44 + coolShade * 0.2)
          );

          const tuftH = baseHeight * edgeScale * (0.8 + rng() * 0.42);
          const tuftScale = (1.02 + rng() * 0.58) * (0.82 + 0.18 * edgeScale);
          tufts.push({
            x,
            y: y - 0.025,
            z,
            h: tuftH,
            s: tuftScale,
            rot: rng() * Math.PI * 2,
            r: tint.r,
            g: tint.g,
            b: tint.b,
          });

          // Sunlit Ghibli wildflower drifts (warm buttercup yellow & creamy white clusters across hills & yards!)
          const fN = fbm2D(x * 0.14 + 30.1, z * 0.14 - 12.4, 3);
          const fChance = smoothstep(0.5, 0.72, fN) * 0.28 + 0.012;
          if (edgeScale > 0.75 && rng() < fChance) {
            const cN = fbm2D(x * 0.08 - 41.0, z * 0.08 + 23.0, 2);
            const palIdx =
              rng() < 0.38
                ? (rng() < 0.52 ? 0 : 2) // creamy white or warm buttercup yellow
                : Math.min(
                    FLOWER_PALETTE.length - 1,
                    Math.floor(cN * 1.8 * FLOWER_PALETTE.length) % FLOWER_PALETTE.length
                  );
            flowers.push({
              x: x + (rng() - 0.5) * 0.11,
              y: y - 0.012,
              z: z + (rng() - 0.5) * 0.11,
              h: Math.max(0.22, tuftH * (1.02 + rng() * 0.32)),
              s: 0.92 + rng() * 0.48,
              rot: rng() * Math.PI * 2,
              col: FLOWER_PALETTE[palIdx],
            });
          }
        }
      }

      if (!tufts.length) continue;
      shuffle(tufts);
      shuffle(flowers);

      const grassMesh = new THREE.InstancedMesh(tuftGeo, grassMat, tufts.length);
      tufts.forEach((t, i) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.set(t.s, t.h, t.s);
        dummy.updateMatrix();
        grassMesh.setMatrixAt(i, dummy.matrix);
        tint.setRGB(t.r, t.g, t.b);
        grassMesh.setColorAt(i, tint);
      });
      grassMesh.instanceMatrix.needsUpdate = true;
      grassMesh.instanceColor.needsUpdate = true;
      grassMesh.receiveShadow = true;
      grassMesh.castShadow = false;
      grassMesh.computeBoundingSphere();
      grassMesh.boundingSphere.radius += 1.0;
      group.add(grassMesh);

      let flowerMesh = null;
      if (flowers.length) {
        flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowers.length);
        flowers.forEach((f, i) => {
          dummy.position.set(f.x, f.y, f.z);
          dummy.rotation.set(0, f.rot, 0);
          dummy.scale.set(f.s, f.h, f.s);
          dummy.updateMatrix();
          flowerMesh.setMatrixAt(i, dummy.matrix);
          flowerMesh.setColorAt(i, f.col);
        });
        flowerMesh.instanceMatrix.needsUpdate = true;
        flowerMesh.instanceColor.needsUpdate = true;
        flowerMesh.receiveShadow = true;
        flowerMesh.castShadow = false;
        flowerMesh.computeBoundingSphere();
        flowerMesh.boundingSphere.radius += 1.0;
        group.add(flowerMesh);
      }

      const center = grassMesh.boundingSphere.center.clone();
      chunks.push({ grassMesh, flowerMesh, center, tufts: tufts.length, flowers: flowers.length });
      totalTufts += tufts.length;
      totalFlowers += flowers.length;
    }
  }

  // Skip the meadow in off-screen passes (water refraction RT only needs what lies under the surface)
  const prevSceneHook = scene.onBeforeRender;
  scene.onBeforeRender = function meadowSceneHook(renderer, sc, cam, renderTarget) {
    const rt = renderTarget !== undefined ? renderTarget : renderer.getRenderTarget();
    group.visible = rt === null;
    if (typeof prevSceneHook === 'function') prevSceneHook.call(this, renderer, sc, cam, renderTarget);
  };

  const LOD_FULL = 42;
  const LOD_MIN_DIST = 78;
  const LOD_MIN_FRAC = 0.42;
  const LOD_CULL = meadowUniforms.uFadeFar.value + 6;

  console.info(
    `[Meadow] ${chunks.length} chunks · ${totalTufts} grass tufts · ${totalFlowers} wildflowers · quality ${quality}`
  );

  return {
    group,
    stats: { chunks: chunks.length, tufts: totalTufts, flowers: totalFlowers, quality },

    /**
     * @param {number} elapsed
     * @param {THREE.Camera} camera
     * @param {{ walkerPos?: THREE.Vector3|null, dogPos?: THREE.Vector3|null, weatherKey?: string, nightGlow?: number, dt?: number }} opts
     */
    update(elapsed, camera, { walkerPos = null, dogPos = null, weatherKey = 'sunny', nightGlow = 0, dt = 0.016 } = {}) {
      const u = meadowUniforms;
      u.uTime.value = elapsed;

      const targetWind = WIND_BY_PRESET[weatherKey] ?? 0.56;
      u.uWindStrength.value = THREE.MathUtils.lerp(u.uWindStrength.value, targetWind, clamp(dt * 0.8, 0, 1));
      u.uDaylight.value = clamp(1 - nightGlow * 0.75, 0.25, 1);

      if (walkerPos) u.uPushA.value.set(walkerPos.x, walkerPos.z, 0.95, 0.88);
      else u.uPushA.value.w = 0;
      if (dogPos) u.uPushB.value.set(dogPos.x, dogPos.z, 0.62, 0.72);
      else u.uPushB.value.w = 0;

      const cam = camera.position;
      for (const c of chunks) {
        const d = c.center.distanceTo(cam);
        if (d > LOD_CULL) {
          c.grassMesh.visible = false;
          if (c.flowerMesh) c.flowerMesh.visible = false;
          continue;
        }
        const frac = THREE.MathUtils.lerp(1, LOD_MIN_FRAC, smoothstep(LOD_FULL, LOD_MIN_DIST, d));
        c.grassMesh.visible = true;
        c.grassMesh.count = Math.max(1, Math.ceil(c.tufts * frac));
        if (c.flowerMesh) {
          c.flowerMesh.visible = true;
          c.flowerMesh.count = Math.max(1, Math.ceil(c.flowers * frac));
        }
      }
    },
  };
}
