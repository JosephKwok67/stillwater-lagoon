import * as THREE from 'three';
import { mulberry32, fbm2D, fbm3D, smoothstep, clamp } from './noise.js';
import { getWorldElevation } from './terrain.js';
import { applyLagoonMaterialShader } from './underwaterMaterial.js';
import {
  createSeabedTexture,
  createUnderwaterRockTextures,
  createDryRockTexture,
  createLilyPadTexture,
} from './textures.js';

export { getWorldElevation as getSeabedHeight };

/**
 * Generates a softly faceted, painterly sculpted boulder geometry
 */
function createSculptedRockGeometry(
  seed,
  { radius = 1, detail = 3, flatness = 0.62, topFlatten = 0.28, roughness = 0.28 } = {}
) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const ox = seed * 13.7;
  const oy = seed * 7.3;
  const oz = seed * 19.1;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();

    const n1 = fbm3D(dir.x * 1.8 + ox, dir.y * 1.8 + oy, dir.z * 1.8 + oz, 3);
    const n2 = fbm3D(dir.x * 3.8 - ox, dir.y * 3.8 + oz, dir.z * 3.8 - oy, 2);
    const disp = 1.0 + (n1 - 0.5) * roughness * 2.1 + (n2 - 0.5) * roughness * 0.75;

    v.multiplyScalar(disp);
    v.y *= flatness;

    // Softly flatten top face like weathered river/lagoon stones
    if (v.y > 0) {
      const topFactor = smoothstep(0.15 * radius, 0.9 * radius, v.y);
      v.y = THREE.MathUtils.lerp(v.y, v.y * (1.0 - topFlatten), topFactor);
    } else {
      // Slightly broaden base so rocks sit grounded on the seabed
      v.x *= 1.08;
      v.z *= 1.08;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a peaked mossy islet geometry (like the upper-left islets in Stillwater)
 */
function createIsletGeometry(seed, { rx = 1.6, rz = 1.3, height = 1.0, peaked = false } = {}) {
  const geo = new THREE.IcosahedronGeometry(1.0, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const ox = seed * 9.1;
  const oz = seed * 15.4;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();
    const n1 = fbm3D(dir.x * 2.1 + ox, dir.y * 2.1, dir.z * 2.1 + oz, 3);
    const disp = 1.0 + (n1 - 0.5) * 0.42;

    v.x *= rx * disp;
    v.z *= rz * disp;

    if (v.y >= 0) {
      if (peaked) {
        // Taper into a charming rocky peak
        const taper = 1.0 - v.y * 0.42;
        v.x *= taper;
        v.z *= taper;
        v.y = Math.pow(v.y, 0.85) * height * (0.9 + n1 * 0.25);
      } else {
        // Broad, cozy plateau rock top
        v.y = Math.pow(v.y, 0.65) * height * 0.85 * (0.92 + n1 * 0.16);
        if (v.y > height * 0.62) {
          v.y = height * 0.62 + (v.y - height * 0.62) * 0.25;
        }
      }
    } else {
      // Deeply rooted submerged skirt extending down to the seabed
      v.x *= 1.18;
      v.z *= 1.18;
      v.y *= 1.65;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a notched floating lily pad geometry with gentle upturned rim
 */
function createLilyPadGeometry() {
  const segments = 26;
  const notchAngle = 0.36; // ~21 degree classic V-notch
  const geometry = new THREE.BufferGeometry();
  const positions = [0, -0.012, 0];
  const uvs = [0.5, 0.5];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = notchAngle * 0.5 + t * (Math.PI * 2 - notchAngle);
    const wobble = 1.0 + Math.sin(angle * 3.0) * 0.035 + Math.cos(angle * 5.0) * 0.02;
    const x = Math.cos(angle) * wobble;
    const z = Math.sin(angle) * wobble;
    // Slight saucer curve upward at rim
    const y = 0.018 + Math.sin(angle * 2.0) * 0.004;
    positions.push(x, y, z);
    uvs.push(0.5 + x * 0.48, 0.5 + z * 0.48);
  }

  for (let i = 1; i <= segments; i++) {
    indices.push(0, i + 1, i);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Creates a delicate multi-layered lotus blossom group (pink outer petals, cream inner, golden heart)
 */
function createLotusTemplate() {
  const group = new THREE.Group();

  // Petal geometry: tapered curved teardrop
  const makePetalGeo = (length, width, curl) => {
    const geo = new THREE.SphereGeometry(0.5, 6, 5);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      // Shift so base is at z = 0 and tip is at z = length (clamped to prevent NaN in pow)
      const t = clamp(z + 0.5, 0, 1);
      const taper = Math.sin(t * Math.PI);
      x *= width * (0.45 + taper * 0.85);
      y *= 0.09;
      z = t * length;
      y += Math.pow(t, 1.8) * curl;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const outerGeo = makePetalGeo(0.24, 0.13, 0.07);
  const innerGeo = makePetalGeo(0.18, 0.105, 0.105);

  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xf4b6c4,
    roughness: 0.65,
    metalness: 0.0,
    emissive: 0x3b1822,
    emissiveIntensity: 0.22,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xfde8ea,
    roughness: 0.58,
    metalness: 0.0,
    emissive: 0x3a2626,
    emissiveIntensity: 0.24,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf3c64f,
    roughness: 0.5,
    emissive: 0x5c3c08,
    emissiveIntensity: 0.35,
  });

  // Outer ring (7 petals)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const petal = new THREE.Mesh(outerGeo, outerMat);
    petal.rotation.y = a;
    petal.rotation.x = -0.14;
    petal.castShadow = true;
    group.add(petal);
  }

  // Inner ring (6 petals, staggered & more upright)
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(innerGeo, innerMat);
    petal.rotation.y = a;
    petal.rotation.x = -0.34;
    petal.position.y = 0.015;
    group.add(petal);
  }

  // Golden stamen center
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), coreMat);
  core.scale.set(1, 0.65, 1);
  core.position.y = 0.04;
  group.add(core);

  return group;
}

/**
 * Builds a branching coral silhouette mesh (for lavender/indigo and pale-turquoise corals)
 */
function createBranchCoralGeometry(seed) {
  const rng = mulberry32(seed);
  const geometries = [];

  const addBranch = (origin, dir, len, rBase, rTop, depth) => {
    const segGeo = new THREE.CylinderGeometry(rTop, rBase, len, 6, 1);
    segGeo.translate(0, len * 0.5, 0);

    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    const mat4 = new THREE.Matrix4().compose(origin, quat, new THREE.Vector3(1, 1, 1));
    segGeo.applyMatrix4(mat4);
    geometries.push(segGeo);

    const tip = origin.clone().addScaledVector(dir.clone().normalize(), len);
    if (depth > 0) {
      const subCount = depth === 2 ? 3 : 2;
      for (let i = 0; i < subCount; i++) {
        const spread = 0.45 + rng() * 0.42;
        const az = (i / subCount) * Math.PI * 2 + rng() * 1.1;
        const nextDir = dir
          .clone()
          .add(new THREE.Vector3(Math.cos(az) * spread, 0.45, Math.sin(az) * spread))
          .normalize();
        addBranch(tip, nextDir, len * (0.64 + rng() * 0.16), rTop * 0.95, rTop * 0.58, depth - 1);
      }
    }
  };

  addBranch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.36, 0.075, 0.052, 2);
  return mergeSimpleGeometries(geometries);
}

/**
 * Builds a leafy underwater sea-rosette / kelp cluster (3-6 broad wavy leaves fanning outward)
 */
function createKelpRosetteGeometry(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const leafCount = 6;

  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const h = 0.32 + rng() * 0.32;
    const w = 0.14 + rng() * 0.09;
    const tilt = 0.35 + rng() * 0.48;

    const leaf = new THREE.PlaneGeometry(w, h, 2, 4);
    const pos = leaf.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      let x = pos.getX(j);
      let y = Math.max(0, pos.getY(j) + h * 0.5); // 0..h (clamped to prevent NaN in pow)
      const t = clamp(y / h, 0, 1);
      // Organic paddle leaf silhouette (narrow stem, rounded leafy tip)
      const widthCurve = Math.sin(Math.pow(t, 0.72) * Math.PI) * 1.15;
      x *= widthCurve;
      // Gentle outward arch and slight ruffled edge
      const z = Math.pow(t, 1.5) * h * 0.45 + Math.sin(t * 7.0 + i) * 0.02;
      pos.setXYZ(j, x, y, z);
    }

    const mat4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, angle, 0, 'YXZ'));
    mat4.compose(new THREE.Vector3(0, 0, 0), q, new THREE.Vector3(1, 1, 1));
    leaf.applyMatrix4(mat4);
    leaf.computeVertexNormals();
    parts.push(leaf);
  }

  return mergeSimpleGeometries(parts);
}

/**
 * Creates a small 5-pointed starfish geometry
 */
function createStarfishGeometry() {
  const geo = new THREE.BufferGeometry();
  const arms = 5;
  const positions = [0, 0.045, 0]; // top center
  const indices = [];

  for (let i = 0; i < arms * 2; i++) {
    const a = (i / (arms * 2)) * Math.PI * 2;
    const isTip = i % 2 === 0;
    const r = isTip ? 0.24 : 0.09;
    const y = isTip ? 0.008 : 0.026;
    positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
  }

  const ringCount = arms * 2;
  for (let i = 0; i < ringCount; i++) {
    const curr = i + 1;
    const next = ((i + 1) % ringCount) + 1;
    indices.push(0, next, curr);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Lightweight buffer geometry merger for non-indexed or indexed BufferGeometries
 */
function mergeSimpleGeometries(geos) {
  const positions = [];
  const normals = [];
  for (const raw of geos) {
    const g = raw.index ? raw.toNonIndexed() : raw;
    g.computeVertexNormals();
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
    }
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}

/**
 * Builds the entire Stillwater lagoon environment:
 * seabed, emergent mossy islets, submerged boulders, tube & branch corals,
 * leafy kelp rosettes, starfish, sea urchins, floating lily pads & lotus blossoms.
 */
export function buildLagoonEnvironment(scene) {
  const rng = mulberry32(20261125);
  const envGroup = new THREE.Group();
  scene.add(envGroup);

  const seabedTex = createSeabedTexture();
  const rockTextures = createUnderwaterRockTextures();
  const dryRockTex = createDryRockTexture();
  const lilyPadTex = createLilyPadTexture();

  // -------------------------------------------------------------------------
  // 1. Expanded Lagoon Seabed & Sculpted Coastal Village Terrain (164 x 164)
  // -------------------------------------------------------------------------
  const seabedGeo = new THREE.PlaneGeometry(164, 164, 184, 184);
  seabedGeo.rotateX(-Math.PI / 2);
  const sbPos = seabedGeo.attributes.position;
  for (let i = 0; i < sbPos.count; i++) {
    sbPos.setY(i, getWorldElevation(sbPos.getX(i), sbPos.getZ(i)));
  }
  seabedGeo.computeVertexNormals();

  const sbNorm = seabedGeo.attributes.normal;
  const sbColors = new Float32Array(sbPos.count * 3);
  const colDeep = new THREE.Color('#0c4459');
  const colMid = new THREE.Color('#226d70');
  const colShallow = new THREE.Color('#5ca388');
  const colSand = new THREE.Color('#dfd1a6');
  // Meadow soil-green beneath the instanced grass (grass.js): matches grass roots so blades blend seamlessly
  const colGrassA = new THREE.Color('#5a9938');
  const colGrassB = new THREE.Color('#427c32');
  const colCliff = new THREE.Color('#9a907b');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < sbPos.count; i++) {
    const x = sbPos.getX(i);
    const y = sbPos.getY(i);
    const z = sbPos.getZ(i);
    const ny = sbNorm.getY(i);

    if (y < -0.22) {
      const depth = -y;
      if (depth < 1.95) {
        tmpCol.lerpColors(colShallow, colMid, smoothstep(0.55, 1.95, depth));
      } else {
        tmpCol.lerpColors(colMid, colDeep, smoothstep(1.95, 3.8, depth));
      }
      // Warm sandy shoal tint approaching the beach cove
      tmpCol.lerp(colSand, (1.0 - smoothstep(0.22, 0.95, depth)) * 0.55);
    } else if (y < 0.58) {
      // Sun-warmed sandy coastal beach blending gently into meadow grass
      tmpCol.lerpColors(colSand, colGrassA, smoothstep(0.18, 0.56, y));
    } else {
      // Painterly dappled meadow hillside with subtle olive variation
      const patch = fbm2D(x * 0.14 + 4.2, z * 0.14 - 3.7, 3);
      tmpCol.lerpColors(colGrassB, colGrassA, smoothstep(0.32, 0.72, patch));
      // Rocky cliff tones on steeper coastal slopes
      const cliffMask = smoothstep(0.74, 0.92, 1.0 - ny + 0.16);
      tmpCol.lerp(colCliff, cliffMask * 0.78);
    }

    sbColors[i * 3] = tmpCol.r;
    sbColors[i * 3 + 1] = tmpCol.g;
    sbColors[i * 3 + 2] = tmpCol.b;
  }
  seabedGeo.setAttribute('color', new THREE.BufferAttribute(sbColors, 3));

  const seabedMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.93,
      metalness: 0.0,
    }),
    { causticsScale: 1.15, wetline: true }
  );
  const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
  seabedMesh.receiveShadow = true;
  envGroup.add(seabedMesh);

  // -------------------------------------------------------------------------
  // 2. Emergent Mossy Islets (upper-left hero islets + perimeter exploration islets)
  // -------------------------------------------------------------------------
  const isletColliders = [];
  const isletMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({
      map: dryRockTex,
      color: 0xd4c7ad,
      roughness: 0.88,
      metalness: 0.0,
    }),
    { causticsScale: 0.6, isEmergentIslet: true, wetline: true }
  );

  const isletSpecs = [
    // Hero top-left pair closely matching Stillwater's framing (fully visible inside standard view!)
    { x: -7.2, z: -5.4, rx: 2.05, rz: 1.48, h: 0.85, peaked: false, rot: 0.35, seed: 11 },
    { x: -9.3, z: -3.4, rx: 1.38, rz: 1.22, h: 1.08, peaked: true, rot: -0.4, seed: 22 },
    // Subtle corner rock peek at bottom-left like screenshot
    { x: -6.2, z: 6.4, rx: 1.05, rz: 0.9, h: 0.34, peaked: false, rot: 0.8, seed: 33 },
    // Additional islets out in the wider playable lagoon (keeping the town bay & pier approach wide open!)
    { x: 14.5, z: -7.5, rx: 2.3, rz: 1.7, h: 1.2, peaked: true, rot: 0.5, seed: 44 },
    { x: 16.5, z: -5.2, rx: 1.5, rz: 1.2, h: 0.72, peaked: false, rot: -0.2, seed: 55 },
    { x: -17.5, z: 3.5, rx: 2.4, rz: 1.8, h: 1.05, peaked: false, rot: 1.1, seed: 66 },
    { x: -16.8, z: -9.8, rx: 2.0, rz: 1.5, h: 1.08, peaked: true, rot: 2.0, seed: 77 },
    { x: 24.5, z: 2.2, rx: 2.3, rz: 1.7, h: 1.0, peaked: false, rot: 0.25, seed: 88 },
    { x: 13.8, z: 12.2, rx: 2.4, rz: 1.9, h: 1.08, peaked: true, rot: -0.9, seed: 99 },
    { x: -9.8, z: 15.8, rx: 2.1, rz: 1.5, h: 0.86, peaked: false, rot: 0.6, seed: 110 },
    { x: 2.5, z: 19.5, rx: 2.5, rz: 1.8, h: 1.12, peaked: true, rot: 1.4, seed: 121 },
  ];

  for (const sp of isletSpecs) {
    const geo = createIsletGeometry(sp.seed, {
      rx: sp.rx,
      rz: sp.rz,
      height: sp.h,
      peaked: sp.peaked,
    });
    const mesh = new THREE.Mesh(geo, isletMat);
    mesh.position.set(sp.x, -0.04, sp.z);
    mesh.rotation.y = sp.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    envGroup.add(mesh);

    isletColliders.push({
      x: sp.x,
      z: sp.z,
      radius: Math.max(sp.rx, sp.rz) * 0.95 + 0.55,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Underwater Sculpted Boulders & Flat Mossy Slabs
  // -------------------------------------------------------------------------
  const rockVariants = [
    createSculptedRockGeometry(1, { radius: 1.0, detail: 3, flatness: 0.58, topFlatten: 0.34, roughness: 0.26 }),
    createSculptedRockGeometry(2, { radius: 1.0, detail: 3, flatness: 0.7, topFlatten: 0.22, roughness: 0.3 }),
    createSculptedRockGeometry(3, { radius: 1.0, detail: 2, flatness: 0.48, topFlatten: 0.42, roughness: 0.24 }),
    createSculptedRockGeometry(4, { radius: 1.0, detail: 2, flatness: 0.64, topFlatten: 0.26, roughness: 0.32 }),
  ];

  const underwaterRockMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({
      map: rockTextures.map,
      bumpMap: rockTextures.bumpMap,
      bumpScale: 0.08,
      color: 0xc8dad2,
      roughness: 0.88,
      metalness: 0.0,
    }),
    { causticsScale: 1.25, wetline: true }
  );

  // Curated hero underwater stones mirroring the screenshot's rhythm & negative space
  const rockPlacements = [
    // Large elongated slab just south of the boat
    { x: -0.45, z: 3.65, sx: 2.45, sy: 0.95, sz: 1.38, rot: 0.52, v: 2, topClear: 0.36 },
    // Large rounded boulder on right mid-lower
    { x: 8.1, z: 1.05, sx: 1.95, sy: 1.28, sz: 1.75, rot: -0.4, v: 1, topClear: 0.24 },
    // Right mid-upper boulder
    { x: 6.7, z: -2.05, sx: 1.48, sy: 1.02, sz: 1.22, rot: 0.65, v: 0, topClear: 0.38 },
    // Mid-right stone catching bright water reflection nearby
    { x: 3.1, z: 1.65, sx: 1.08, sy: 0.72, sz: 0.95, rot: 0.3, v: 0, topClear: 0.42 },
    // Upper-center submerged boulder in deep teal zone
    { x: -1.1, z: -4.1, sx: 1.65, sy: 1.05, sz: 1.32, rot: -0.25, v: 1, topClear: 0.72 },
    // Mid-left cluster of mossy stepping stones
    { x: -4.9, z: -2.15, sx: 1.15, sy: 0.85, sz: 0.98, rot: 0.4, v: 0, topClear: 0.36 },
    { x: -6.4, z: -1.3, sx: 0.98, sy: 0.78, sz: 0.86, rot: 1.2, v: 3, topClear: 0.38 },
    { x: -8.6, z: -1.55, sx: 1.02, sy: 0.82, sz: 0.94, rot: 2.1, v: 1, topClear: 0.34 },
    { x: -8.0, z: 0.85, sx: 0.86, sy: 0.68, sz: 0.82, rot: 0.8, v: 3, topClear: 0.42 },
    { x: -7.5, z: 2.55, sx: 0.94, sy: 0.74, sz: 0.84, rot: -0.7, v: 0, topClear: 0.38 },
    { x: -4.2, z: 4.1, sx: 1.32, sy: 0.88, sz: 1.18, rot: 0.2, v: 0, topClear: 0.35 },
    { x: -6.0, z: 4.6, sx: 1.05, sy: 0.75, sz: 0.9, rot: 1.5, v: 2, topClear: 0.42 },
    { x: -8.9, z: 4.3, sx: 1.22, sy: 0.86, sz: 1.0, rot: -0.4, v: 1, topClear: 0.34 },
    // Stones around the boat (deep enough for clear boating!)
    { x: 1.2, z: 0.35, sx: 0.78, sy: 0.56, sz: 0.68, rot: 0.4, v: 3, topClear: 0.65 },
    { x: -3.2, z: -0.35, sx: 0.72, sy: 0.54, sz: 0.62, rot: 1.1, v: 3, topClear: 0.68 },
    { x: 2.6, z: -2.8, sx: 0.92, sy: 0.68, sz: 0.84, rot: -0.9, v: 0, topClear: 0.78 },
    { x: 0.4, z: -2.5, sx: 0.82, sy: 0.62, sz: 0.75, rot: 0.7, v: 1, topClear: 0.84 },
    { x: 5.1, z: 4.4, sx: 1.28, sy: 0.86, sz: 1.14, rot: -0.3, v: 0, topClear: 0.36 },
    { x: 7.4, z: 4.6, sx: 1.18, sy: 0.82, sz: 1.04, rot: 0.8, v: 2, topClear: 0.35 },
    { x: 9.6, z: 3.4, sx: 1.08, sy: 0.78, sz: 0.92, rot: 1.7, v: 1, topClear: 0.38 },
    { x: -2.5, z: -5.4, sx: 1.18, sy: 0.8, sz: 0.96, rot: 0.5, v: 2, topClear: 0.78 },
    { x: 4.4, z: -5.4, sx: 1.32, sy: 0.88, sz: 1.08, rot: -0.6, v: 1, topClear: 0.88 },
  ];

  // Procedurally populate additional natural rocks across the ENTIRE expanded navigable lagoon (radius up to 44!)
  for (let i = 0; i < 340; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 2.4 + Math.pow(rng(), 0.72) * 42.0;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Only place submerged rocks in sufficiently deep water (off beach & town peninsula)
    if (getWorldElevation(x, z) > -0.75) continue;
    // Keep immediate starting boat swim corridor & pier approach clean
    if (Math.hypot(x + 1.1, z - 0.7) < 2.35) continue;
    if (Math.hypot(x - 3.6, z + 13.5) < 3.0) continue;
    // Don't overlap islets
    if (isletColliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius + 0.5)) continue;

    const cluster = fbm2D(x * 0.16 + 11.4, z * 0.16 - 6.2, 2);
    if (cluster < 0.35 && rng() < 0.55) continue;

    const baseSize = 0.35 + Math.pow(rng(), 1.65) * 1.15;
    rockPlacements.push({
      x,
      z,
      sx: baseSize * (0.85 + rng() * 0.45),
      sy: baseSize * (0.55 + rng() * 0.42),
      sz: baseSize * (0.85 + rng() * 0.45),
      rot: rng() * Math.PI * 2,
      v: Math.floor(rng() * rockVariants.length),
      topClear: 0.38 + rng() * 0.75,
    });
  }

  // Group rock placements by variant and build InstancedMeshes with subtle color variety
  const rockGroups = rockVariants.map(() => []);
  const kelpAnchorSpots = [];

  for (const rp of rockPlacements) {
    const sbY = getWorldElevation(rp.x, rp.z);
    if (sbY > -0.6) continue;
    // Sit naturally embedded into the seabed, never poking above water surface
    const maxCenterY = -rp.topClear - rp.sy * 0.48;
    const y = Math.min(sbY + rp.sy * 0.25, maxCenterY);
    rockGroups[rp.v].push({ ...rp, y });

    if (rp.sx > 0.62 && rng() < 0.78) {
      kelpAnchorSpots.push({ x: rp.x, z: rp.z, r: Math.max(rp.sx, rp.sz), y: sbY });
    }
  }

  const dummy = new THREE.Object3D();
  const rockTint = new THREE.Color();

  rockGroups.forEach((items, vIdx) => {
    if (!items.length) return;
    const inst = new THREE.InstancedMesh(rockVariants[vIdx], underwaterRockMat, items.length);
    inst.receiveShadow = true;
    inst.castShadow = false;

    items.forEach((r, i) => {
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set((rng() - 0.5) * 0.2, r.rot, (rng() - 0.5) * 0.2);
      dummy.scale.set(r.sx, r.sy, r.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      // Painterly hue variation per stone (brighter sage-grey & mossy slate clearly readable through clear turquoise water)
      const h = 0.42 + (rng() - 0.5) * 0.08;
      const s = 0.14 + rng() * 0.14;
      const l = 0.66 + (rng() - 0.5) * 0.16;
      rockTint.setHSL(h, s, l);
      inst.setColorAt(i, rockTint);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    envGroup.add(inst);
  });

  // -------------------------------------------------------------------------
  // 4. Underwater Flora: Kelp Rosettes, Ochre Tube Corals, Lavender Corals, Starfish, Urchins
  // -------------------------------------------------------------------------

  // 4a. Leafy green-teal kelp rosettes nestled around almost every submerged boulder
  const kelpGeo = createKelpRosetteGeometry(707);
  const kelpMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    { causticsScale: 0.9, swayAmount: 0.085, swaySpeed: 1.5, wetline: false }
  );

  const kelpTransforms = [];
  for (const spot of kelpAnchorSpots) {
    const count = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < count; k++) {
      const a = rng() * Math.PI * 2;
      const dist = spot.r * (0.62 + rng() * 0.55);
      const kx = spot.x + Math.cos(a) * dist;
      const kz = spot.z + Math.sin(a) * dist;
      const ky = getWorldElevation(kx, kz) - 0.03;
      if (ky > -0.55) continue;
      kelpTransforms.push({
        x: kx,
        y: ky,
        z: kz,
        s: 0.62 + rng() * 0.85,
        rot: rng() * Math.PI * 2,
        tone: rng(),
      });
    }
  }

  // Extra scattered lush tufts across shallow & outer island beds
  for (let i = 0; i < 160; i++) {
    const a = rng() * Math.PI * 2;
    const d = 2.0 + rng() * 40.0;
    const kx = Math.cos(a) * d;
    const kz = Math.sin(a) * d;
    const ky = getWorldElevation(kx, kz) - 0.04;
    if (ky > -0.6) continue;
    kelpTransforms.push({
      x: kx,
      y: ky,
      z: kz,
      s: 0.55 + rng() * 0.78,
      rot: rng() * Math.PI * 2,
      tone: rng(),
    });
  }

  const kelpInst = new THREE.InstancedMesh(kelpGeo, kelpMat, kelpTransforms.length);
  const kelpColorA = new THREE.Color('#479e76');
  const kelpColorB = new THREE.Color('#70b876');
  const kelpColorC = new THREE.Color('#35847a');
  kelpTransforms.forEach((k, i) => {
    dummy.position.set(k.x, k.y, k.z);
    dummy.rotation.set(0, k.rot, 0);
    dummy.scale.set(k.s, k.s * (0.85 + (k.tone * 0.35)), k.s);
    dummy.updateMatrix();
    kelpInst.setMatrixAt(i, dummy.matrix);
    if (k.tone < 0.45) tmpCol.lerpColors(kelpColorA, kelpColorB, k.tone / 0.45);
    else tmpCol.lerpColors(kelpColorA, kelpColorC, (k.tone - 0.45) / 0.55);
    kelpInst.setColorAt(i, tmpCol);
  });
  kelpInst.instanceMatrix.needsUpdate = true;
  kelpInst.instanceColor.needsUpdate = true;
  envGroup.add(kelpInst);

  // 4b. Warm Ochre-Yellow Tube Corals / Sponges (distinct iconic clusters from Stillwater!)
  const tubeGeo = new THREE.CylinderGeometry(0.115, 0.082, 0.85, 8, 1, false);
  tubeGeo.translate(0, 0.425, 0);
  // Dark recessed inner mouth cap for each tube
  const tubeMouthGeo = new THREE.CircleGeometry(0.082, 8);
  tubeMouthGeo.rotateX(-Math.PI / 2);
  tubeMouthGeo.translate(0, 0.855, 0);

  const tubeMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({
      color: 0xd9a84c,
      roughness: 0.76,
      metalness: 0.0,
    }),
    { causticsScale: 0.9, swayAmount: 0.04, swaySpeed: 1.1, wetline: false }
  );
  const tubeMouthMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({
      color: 0x3b2c1a,
      roughness: 0.95,
    }),
    { causticsScale: 0.2, swayAmount: 0.04, swaySpeed: 1.1, wetline: false }
  );

  const tubeClusterCenters = [
    // Hero clusters matching Stillwater screenshot
    { x: -3.55, z: -2.45 },
    { x: -4.15, z: -1.85 },
    { x: 4.1, z: 3.75 },
    { x: 4.65, z: 3.25 },
    { x: -9.8, z: 1.25 },
    // Wider & outer lagoon exploration clusters (around islands & outer bays!)
    { x: 8.8, z: -4.8 },
    { x: -11.5, z: -7.5 },
    { x: -2.4, z: 10.2 },
    { x: 11.2, z: 6.4 },
    { x: -13.2, z: 7.4 },
    { x: 2.5, z: -10.8 },
    { x: -6.8, z: -11.4 },
    { x: 12.6, z: -1.8 },
    { x: 24.5, z: 11.2 },
    { x: 26.8, z: -4.5 },
    { x: -25.2, z: 9.5 },
    { x: -22.8, z: -5.5 },
    { x: -11.0, z: 24.5 },
    { x: 12.5, z: 23.5 },
  ];

  const tubeEntries = [];
  for (const cc of tubeClusterCenters) {
    const count = 4 + Math.floor(rng() * 4);
    for (let t = 0; t < count; t++) {
      const a = (t / count) * Math.PI * 2 + rng() * 0.5;
      const r = 0.08 + rng() * 0.34;
      const tx = cc.x + Math.cos(a) * r;
      const tz = cc.z + Math.sin(a) * r;
      const ty = getWorldElevation(tx, tz) - 0.06;
      if (ty > -0.65) continue;
      const hScale = 0.55 + rng() * 0.95;
      const rScale = 0.72 + rng() * 0.55;
      tubeEntries.push({
        x: tx,
        y: ty,
        z: tz,
        sx: rScale,
        sy: hScale,
        sz: rScale,
        rx: (rng() - 0.5) * 0.28,
        rz: (rng() - 0.5) * 0.28,
        tint: rng(),
      });
    }
  }

  const tubeInst = new THREE.InstancedMesh(tubeGeo, tubeMat, tubeEntries.length);
  const tubeMouthInst = new THREE.InstancedMesh(tubeMouthGeo, tubeMouthMat, tubeEntries.length);
  const ochreA = new THREE.Color('#e8b85a');
  const ochreB = new THREE.Color('#d29a48');
  tubeEntries.forEach((e, i) => {
    dummy.position.set(e.x, e.y, e.z);
    dummy.rotation.set(e.rx, 0, e.rz);
    dummy.scale.set(e.sx, e.sy, e.sz);
    dummy.updateMatrix();
    tubeInst.setMatrixAt(i, dummy.matrix);
    tubeMouthInst.setMatrixAt(i, dummy.matrix);
    tmpCol.lerpColors(ochreA, ochreB, e.tint);
    tubeInst.setColorAt(i, tmpCol);
  });
  tubeInst.instanceMatrix.needsUpdate = true;
  tubeInst.instanceColor.needsUpdate = true;
  tubeMouthInst.instanceMatrix.needsUpdate = true;
  envGroup.add(tubeInst, tubeMouthInst);

  // 4c. Lavender-Indigo & Pale-Turquoise Branching Corals
  const branchGeo = createBranchCoralGeometry(808);
  const branchMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.0,
    }),
    { causticsScale: 0.8, swayAmount: 0.065, swaySpeed: 1.25, wetline: false }
  );

  const branchSpots = [
    // Curated lavender-purple & blue-cyan corals in upper-right and mid-bottom
    { x: 4.5, z: -2.9, col: '#6972aa', s: 1.35 },
    { x: 5.3, z: -2.4, col: '#5a639c', s: 1.15 },
    { x: 3.7, z: -3.4, col: '#777eb5', s: 1.05 },
    { x: 0.1, z: -3.2, col: '#5aaea8', s: 1.0 },
    { x: -0.6, z: -2.4, col: '#62b2ab', s: 0.9 },
    { x: 1.7, z: 4.6, col: '#58b1ad', s: 1.25 },
    { x: 2.3, z: 4.1, col: '#78b8b2', s: 1.0 },
    { x: 5.7, z: -0.6, col: '#6671a8', s: 1.05 },
    { x: -1.4, z: -1.2, col: '#57989b', s: 0.85 },
    { x: 3.1, z: -1.4, col: '#6d75ac', s: 0.92 },
  ];
  const coralPalette = ['#6872ab', '#7c7eb8', '#529fa1', '#6dbbb2', '#5b6799'];
  for (let i = 0; i < 110; i++) {
    const a = rng() * Math.PI * 2;
    const d = 4.5 + rng() * 38.0;
    const bx = Math.cos(a) * d;
    const bz = Math.sin(a) * d;
    if (getWorldElevation(bx, bz) > -0.68) continue;
    branchSpots.push({
      x: bx,
      z: bz,
      col: coralPalette[Math.floor(rng() * coralPalette.length)],
      s: 0.72 + rng() * 0.85,
    });
  }

  const branchInst = new THREE.InstancedMesh(branchGeo, branchMat, branchSpots.length);
  branchSpots.forEach((b, i) => {
    const by = getWorldElevation(b.x, b.z) - 0.04;
    dummy.position.set(b.x, by, b.z);
    dummy.rotation.set((rng() - 0.5) * 0.15, rng() * Math.PI * 2, (rng() - 0.5) * 0.15);
    dummy.scale.setScalar(b.s);
    dummy.updateMatrix();
    branchInst.setMatrixAt(i, dummy.matrix);
    branchInst.setColorAt(i, new THREE.Color(b.col));
  });
  branchInst.instanceMatrix.needsUpdate = true;
  branchInst.instanceColor.needsUpdate = true;
  envGroup.add(branchInst);

  // 4d. Tiny Terracotta-Orange Starfish & Cobalt Sea Urchin Accents
  const starGeo = createStarfishGeometry();
  const starMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({ color: 0xd77748, roughness: 0.78 }),
    { causticsScale: 0.7, wetline: false }
  );
  const starSpots = [
    { x: -0.15, z: -2.45 },
    { x: 3.85, z: 0.15 },
    { x: -4.5, z: 1.85 },
    { x: 1.9, z: 2.9 },
    { x: 6.1, z: -3.9 },
  ];
  for (let i = 0; i < 55; i++) {
    const a = rng() * Math.PI * 2;
    const d = 3.5 + rng() * 38.0;
    const sx = Math.cos(a) * d;
    const sz = Math.sin(a) * d;
    if (getWorldElevation(sx, sz) > -0.6) continue;
    starSpots.push({ x: sx, z: sz });
  }
  const starInst = new THREE.InstancedMesh(starGeo, starMat, starSpots.length);
  starSpots.forEach((s, i) => {
    dummy.position.set(s.x, getWorldElevation(s.x, s.z) + 0.03, s.z);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.85 + rng() * 0.45);
    dummy.updateMatrix();
    starInst.setMatrixAt(i, dummy.matrix);
  });
  starInst.instanceMatrix.needsUpdate = true;
  envGroup.add(starInst);

  // Small cobalt/indigo round sea urchins / anemones
  const urchinGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const urchinMat = applyLagoonMaterialShader(
    new THREE.MeshStandardMaterial({ color: 0x4566b8, roughness: 0.65 }),
    { causticsScale: 0.6, wetline: false }
  );
  const urchinSpots = [
    { x: -4.85, z: -0.55 },
    { x: 1.65, z: -0.05 },
    { x: 0.9, z: -2.15 },
    { x: 6.2, z: 2.5 },
  ];
  for (let i = 0; i < 24; i++) {
    const a = rng() * Math.PI * 2;
    const d = 4.0 + rng() * 26.0;
    const ux = Math.cos(a) * d;
    const uz = Math.sin(a) * d;
    if (getWorldElevation(ux, uz) > -0.6) continue;
    urchinSpots.push({ x: ux, z: uz });
  }
  const urchinInst = new THREE.InstancedMesh(urchinGeo, urchinMat, urchinSpots.length);
  urchinSpots.forEach((u, i) => {
    dummy.position.set(u.x, getWorldElevation(u.x, u.z) + 0.08, u.z);
    dummy.rotation.set(0, 0, 0);
    const sc = 0.78 + rng() * 0.48;
    dummy.scale.set(sc, sc * 0.72, sc);
    dummy.updateMatrix();
    urchinInst.setMatrixAt(i, dummy.matrix);
  });
  urchinInst.instanceMatrix.needsUpdate = true;
  envGroup.add(urchinInst);

  // -------------------------------------------------------------------------
  // 5. Floating Surface Lily Pads & Pink Lotus Blossoms
  // -------------------------------------------------------------------------
  const lilyPadGeo = createLilyPadGeometry();
  const lilyPadMat = new THREE.MeshStandardMaterial({
    map: lilyPadTex,
    roughness: 0.68,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Curated lily-pad patches closely echoing the screenshot's lush left, bottom, and right groupings
  const lilyPatchCenters = [
    // Left-mid & bottom-left lush belt
    { x: -7.8, z: -0.4, count: 9, spread: 1.8, flowers: 1 },
    { x: -6.2, z: 2.25, count: 10, spread: 1.9, flowers: 2 },
    { x: -4.1, z: 3.7, count: 9, spread: 1.7, flowers: 2 },
    { x: -0.8, z: 4.5, count: 7, spread: 1.7, flowers: 2 },
    { x: -8.6, z: 4.4, count: 7, spread: 1.8, flowers: 1 },
    // Far-right water edge lily pads
    { x: 9.8, z: -2.4, count: 7, spread: 1.6, flowers: 1 },
    { x: 9.7, z: 2.3, count: 8, spread: 1.7, flowers: 2 },
    // Wider & outer island lily clusters
    { x: -13.5, z: -1.5, count: 8, spread: 2.1, flowers: 2 },
    { x: -11.5, z: 9.5, count: 8, spread: 2.2, flowers: 2 },
    { x: 3.5, z: 10.5, count: 7, spread: 2.0, flowers: 1 },
    { x: 13.5, z: 5.5, count: 8, spread: 2.1, flowers: 2 },
    { x: 12.2, z: -11.0, count: 7, spread: 1.9, flowers: 1 },
    { x: -3.8, z: -11.8, count: 7, spread: 1.9, flowers: 1 },
    { x: 25.5, z: 11.8, count: 9, spread: 2.4, flowers: 2 },
    { x: -25.8, z: 9.8, count: 9, spread: 2.4, flowers: 2 },
    { x: 23.5, z: -9.5, count: 7, spread: 2.1, flowers: 1 },
    { x: -22.5, z: -8.5, count: 7, spread: 2.1, flowers: 1 },
    { x: -12.5, z: 23.5, count: 8, spread: 2.4, flowers: 2 },
    { x: 14.5, z: 22.5, count: 8, spread: 2.4, flowers: 2 },
  ];

  const floatingPads = [];
  const lotusTemplate = createLotusTemplate();

  for (const patch of lilyPatchCenters) {
    const placed = [];
    for (let i = 0; i < patch.count; i++) {
      let px = 0;
      let pz = 0;
      let ok = false;
      const radius = 0.25 + rng() * 0.24;

      for (let attempt = 0; attempt < 18; attempt++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * patch.spread;
        px = patch.x + Math.cos(a) * r;
        pz = patch.z + Math.sin(a) * r;

        // Avoid overlapping boat start, dry land/beach, pier corridor, islets, or other pads
        if (getWorldElevation(px, pz) > -0.45) continue;
        if (Math.hypot(px + 1.15, pz - 0.85) < 2.2) continue;
        if (Math.hypot(px - 3.6, pz + 13.8) < 2.6) continue;
        if (isletColliders.some((c) => Math.hypot(px - c.x, pz - c.z) < c.radius + 0.3)) continue;
        if (placed.some((p) => Math.hypot(px - p.x, pz - p.z) < radius + p.r + 0.08)) continue;
        ok = true;
        break;
      }
      if (!ok) continue;

      placed.push({ x: px, z: pz, r: radius });

      const padGroup = new THREE.Group();
      const padMesh = new THREE.Mesh(lilyPadGeo, lilyPadMat);
      padMesh.scale.set(radius, 1, radius * (0.92 + rng() * 0.16));
      padMesh.castShadow = true;
      padMesh.receiveShadow = true;
      padGroup.add(padMesh);

      // Attach a delicate pink lotus blossom to select lily pads
      if (i < patch.flowers) {
        const lotus = lotusTemplate.clone();
        const lScale = 0.82 + rng() * 0.32;
        lotus.scale.setScalar(lScale);
        lotus.position.set((rng() - 0.5) * radius * 0.35, 0.02, (rng() - 0.5) * radius * 0.35);
        lotus.rotation.y = rng() * Math.PI * 2;
        padGroup.add(lotus);
      }

      padGroup.position.set(px, 0.018, pz);
      padGroup.rotation.y = rng() * Math.PI * 2;
      envGroup.add(padGroup);

      floatingPads.push({
        group: padGroup,
        baseX: px,
        baseZ: pz,
        curX: px,
        curZ: pz,
        vx: 0,
        vz: 0,
        rotY: padGroup.rotation.y,
        rotVel: 0,
        dip: 0,
        radius,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  return {
    envGroup,
    isletColliders,
    update(dt, elapsedTime, boatState, dogPos) {
      const clampedDt = Math.min(dt, 0.05);
      const boatPos = boatState ? boatState.pos : null;
      const boatFwdX = boatState ? Math.cos(boatState.yaw) : 1;
      const boatFwdZ = boatState ? -Math.sin(boatState.yaw) : 0;
      const boatRightX = -boatFwdZ;
      const boatRightZ = boatFwdX;
      const boatVelX = boatState ? boatFwdX * boatState.speed : 0;
      const boatVelZ = boatState ? boatFwdZ * boatState.speed : 0;

      // Smooth frame-rate-independent spring-damper physics so lily pads glide aside
      // along the hull & dog without EVER snapping or teleporting back!
      for (const pad of floatingPads) {
        // 1. Very gentle elastic stem tether pulling lazily back toward root (baseX, baseZ)
        const toRootX = pad.baseX - pad.curX;
        const toRootZ = pad.baseZ - pad.curZ;
        const rootDist = Math.hypot(toRootX, toRootZ);
        let ax = toRootX * 0.95;
        let az = toRootZ * 0.95;

        // 2. Smooth oriented boat-hull parting (uses actual boat capsule shape, not oversized circle)
        let nudged = 0;
        if (boatPos) {
          const rx = pad.curX - boatPos.x;
          const rz = pad.curZ - boatPos.z;
          // Project onto boat's centerline segment (stern -0.82 to bow +0.92)
          const along = clamp(rx * boatFwdX + rz * boatFwdZ, -0.82, 0.92);
          const nearX = boatPos.x + boatFwdX * along;
          const nearZ = boatPos.z + boatFwdZ * along;
          const dx = pad.curX - nearX;
          const dz = pad.curZ - nearZ;
          const dist = Math.hypot(dx, dz);

          // Hull half-width tapers neatly toward pointed bow
          const hullHalfW = along > 0.35 ? 0.56 - (along - 0.35) * 0.35 : 0.62;
          const contactR = hullHalfW + pad.radius * 0.92;
          const influenceR = contactR + 0.55;

          if (dist < influenceR) {
            // Stable outward direction (if nearly dead-center ahead of bow, push gently sideways)
            let nx, nz;
            if (dist > 0.02) {
              nx = dx / dist;
              nz = dz / dist;
            } else {
              const sideSign = pad.phase > Math.PI ? 1 : -1;
              nx = boatRightX * sideSign;
              nz = boatRightZ * sideSign;
            }

            // Smooth water cushion force pushing outward ahead of the hull
            const closeness = 1.0 - dist / influenceR;
            const pushAccel = closeness * closeness * 16.0;
            ax += nx * pushAccel + boatVelX * closeness * 1.4;
            az += nz * pushAccel + boatVelZ * closeness * 1.4;

            // Gentle rotational spin & water dip when brushed by the boat
            const sideDot = dx * boatRightX + dz * boatRightZ;
            pad.rotVel += (sideDot >= 0 ? 1 : -1) * closeness * 1.8 * clampedDt;
            nudged = Math.max(nudged, closeness);

            // Soft positional separation ONLY right at the hull skin (prevents clipping inside boat
            // without creating any jump when the boat moves away!)
            if (dist < contactR) {
              const overlap = contactR - dist;
              pad.curX += nx * overlap * 0.85;
              pad.curZ += nz * overlap * 0.85;
              // Cancel inward velocity component smoothly
              const vn = pad.vx * nx + pad.vz * nz;
              if (vn < 0) {
                pad.vx -= nx * vn;
                pad.vz -= nz * vn;
              }
            }
          }
        }

        // 3. Gentle parting around the swimming companion dog as well!
        if (dogPos) {
          const dx = pad.curX - dogPos.x;
          const dz = pad.curZ - dogPos.z;
          const dist = Math.hypot(dx, dz);
          const dogR = 0.48 + pad.radius * 0.85;
          if (dist < dogR + 0.35 && dist > 0.01) {
            const nx = dx / dist;
            const nz = dz / dist;
            const c = 1.0 - dist / (dogR + 0.35);
            ax += nx * c * c * 10.0;
            az += nz * c * c * 10.0;
            if (dist < dogR) {
              const ov = dogR - dist;
              pad.curX += nx * ov * 0.7;
              pad.curZ += nz * ov * 0.7;
            }
            nudged = Math.max(nudged, c * 0.6);
          }
        }

        // Integrate velocity with realistic calm-water viscosity damping (smooth & zero-jitter!)
        pad.vx += ax * clampedDt;
        pad.vz += az * clampedDt;
        const damping = Math.exp(-3.4 * clampedDt);
        pad.vx *= damping;
        pad.vz *= damping;

        // Clamp max drift speed so a displaced pad always glides back lazily and organically
        const spd = Math.hypot(pad.vx, pad.vz);
        const maxSpd = nudged > 0.1 ? 3.8 : 0.85;
        if (spd > maxSpd) {
          pad.vx = (pad.vx / spd) * maxSpd;
          pad.vz = (pad.vz / spd) * maxSpd;
        }

        pad.curX += pad.vx * clampedDt;
        pad.curZ += pad.vz * clampedDt;

        // Soft max stem stretch limit (~2.3 units from root) so pads stay anchored to their patch
        if (rootDist > 2.35) {
          const pull = (rootDist - 2.35) * 0.25;
          pad.curX += (toRootX / rootDist) * pull;
          pad.curZ += (toRootZ / rootDist) * pull;
        }

        pad.rotVel *= Math.exp(-2.8 * clampedDt);
        pad.rotY += pad.rotVel * clampedDt;
        pad.dip = THREE.MathUtils.lerp(pad.dip, nudged * 0.04, clampedDt * 6.0);

        const wave = Math.sin(elapsedTime * 1.35 + pad.phase + pad.curX * 0.35);
        const wave2 = Math.cos(elapsedTime * 1.05 + pad.phase * 1.4 + pad.curZ * 0.32);
        pad.group.position.set(pad.curX, 0.016 + wave * 0.012 - pad.dip, pad.curZ);
        pad.group.rotation.y = pad.rotY;
        pad.group.rotation.x = wave * 0.032 + pad.vz * 0.04;
        pad.group.rotation.z = wave2 * 0.032 - pad.vx * 0.04;
      }
    },
  };
}
