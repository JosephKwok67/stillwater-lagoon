import * as THREE from 'three';
import { getWorldElevation, getShoreZ } from '../terrain.js';
import {
  QUAY_SPEC,
  SHORE_BOULDERS,
  CLIFF_ROCKS,
  LANE_POINTS,
  CURATED_TREE_SPOTS,
} from '../world/layout.js';

const LEAF_PALETTE = [0x588d43, 0x6ea049, 0x477d48, 0x7eaa52].map((hex) => new THREE.Color(hex));
const BUSH_FLOWER_PALETTE = [0xf5a8b8, 0xfbe285, 0xf7f2e7].map((hex) => new THREE.Color(hex));

/**
 * Builds the curved stone retaining quay wall (28 segments -> 2 InstancedMeshes),
 * shoreline waterline boulders (1 InstancedMesh), and Lighthouse cliff boulders (1 InstancedMesh).
 */
export function buildInstancedQuayAndBoulders({
  shoreWaterGroup,
  inlandVisualGroup,
  quayWallMat,
  quayCapMat,
  quayRockMat,
  addLandCollider,
}) {
  const dummy = new THREE.Object3D();

  // 1. Curved Stone Retaining Quay Wall + Limestone Coping Cap (56 meshes -> 2 draw calls!)
  const { startX, endX, segs } = QUAY_SPEC;
  const wallGeo = new THREE.BoxGeometry(1, 1.56, 0.72);
  const capGeo = new THREE.BoxGeometry(1, 0.13, 0.62);
  const wallInst = new THREE.InstancedMesh(wallGeo, quayWallMat, segs);
  const capInst = new THREE.InstancedMesh(capGeo, quayCapMat, segs);
  wallInst.castShadow = true;
  wallInst.receiveShadow = true;
  capInst.castShadow = true;
  capInst.receiveShadow = true;

  for (let i = 0; i < segs; i++) {
    const x0 = startX + (i / segs) * (endX - startX);
    const x1 = startX + ((i + 1) / segs) * (endX - startX);
    const z0 = getShoreZ(x0);
    const z1 = getShoreZ(x1);
    const xm = (x0 + x1) * 0.5;
    const zm = (z0 + z1) * 0.5;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.14;
    const ang = -Math.atan2(z1 - z0, x1 - x0);

    dummy.position.set(xm, 0.34, zm - 0.18);
    dummy.rotation.set(0, ang, 0);
    dummy.scale.set(len, 1, 1);
    dummy.updateMatrix();
    wallInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(xm, 1.1, zm - 0.14);
    dummy.scale.set(len + 0.02, 1, 1);
    dummy.updateMatrix();
    capInst.setMatrixAt(i, dummy.matrix);
  }
  wallInst.instanceMatrix.needsUpdate = true;
  capInst.instanceMatrix.needsUpdate = true;
  shoreWaterGroup.add(wallInst, capInst);

  // 2. Waterline Coastal Boulders (procedural fallback, hot-swaps to sculpted `rock_shore_wide.glb`!)
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const shoreRockInst = new THREE.InstancedMesh(rockGeo, quayRockMat, SHORE_BOULDERS.length);
  shoreRockInst.castShadow = true;
  shoreRockInst.receiveShadow = true;
  for (let i = 0; i < SHORE_BOULDERS.length; i++) {
    const [bx, zOff, br] = SHORE_BOULDERS[i];
    const bz = getShoreZ(bx) + zOff;
    dummy.position.set(bx, 0.14 + (i % 3) * 0.08, bz);
    dummy.rotation.set(i * 0.6, i * 1.1, 0.2);
    dummy.scale.set(br * 1.25, br * 0.68, br * 1.05);
    dummy.updateMatrix();
    shoreRockInst.setMatrixAt(i, dummy.matrix);
    addLandCollider({ x: bx, z: bz, radius: br * 0.92 });
  }
  shoreRockInst.instanceMatrix.needsUpdate = true;
  shoreWaterGroup.add(shoreRockInst);

  // 3. Lighthouse Headland Cliff Boulders (procedural fallback, hot-swaps to sculpted `rock_cliff_crag.glb`!)
  const cliffRockInst = new THREE.InstancedMesh(rockGeo, quayRockMat, CLIFF_ROCKS.length);
  cliffRockInst.castShadow = true;
  cliffRockInst.receiveShadow = true;
  for (let i = 0; i < CLIFF_ROCKS.length; i++) {
    const [rx, rz, rr] = CLIFF_ROCKS[i];
    const ry = getWorldElevation(rx, rz);
    dummy.position.set(rx, Math.max(-0.15, ry - rr * 0.22), rz);
    dummy.rotation.set(i * 0.45, i * 0.9, 0.18);
    dummy.scale.set(rr * 1.22, rr * 0.85, rr * 1.12);
    dummy.updateMatrix();
    cliffRockInst.setMatrixAt(i, dummy.matrix);
    addLandCollider({ x: rx, z: rz, radius: rr * 0.95 });
  }
  cliffRockInst.instanceMatrix.needsUpdate = true;
  inlandVisualGroup.add(cliffRockInst);

  // GPU-Instanced Sculpted Coastal Rocks GLB hot-swap container (in shoreWaterGroup so waterline
  // tidal notches & submerged skirts refract seamlessly through the clear turquoise lagoon!)
  const glbRockGroup = new THREE.Group();
  glbRockGroup.name = 'Town_CoastalRocksGLB';
  shoreWaterGroup.add(glbRockGroup);

  function attachRockGlbs(rockMap) {
    if (!rockMap) return false;
    while (glbRockGroup.children.length > 0) {
      glbRockGroup.remove(glbRockGroup.children[0]);
    }
    const tintCol = new THREE.Color();
    let swapped = false;

    if (rockMap.rock_shore_wide?.geo && rockMap.rock_shore_wide?.mat) {
      const inst = new THREE.InstancedMesh(
        rockMap.rock_shore_wide.geo,
        rockMap.rock_shore_wide.mat,
        SHORE_BOULDERS.length
      );
      inst.castShadow = true;
      inst.receiveShadow = true;
      for (let i = 0; i < SHORE_BOULDERS.length; i++) {
        const [bx, zOff, br] = SHORE_BOULDERS[i];
        const bz = getShoreZ(bx) + zOff + 0.08;
        // Origin of rock_shore_wide.glb is exactly at waterline (y=0) with -0.65m reef skirt!
        dummy.position.set(bx, -0.02 + (i % 3) * 0.04, bz);
        dummy.rotation.set(
          Math.sin(i * 2.1) * 0.05,
          i * 1.37 + 0.42,
          Math.cos(i * 1.7) * 0.05
        );
        dummy.scale.set(br * 0.94, br * 0.86, br * 0.92);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        const w = 0.94 + ((i * 37) % 11) * 0.01;
        tintCol.setRGB(w * 1.02, w * 1.0, w * 0.97);
        inst.setColorAt(i, tintCol);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      glbRockGroup.add(inst);
      shoreRockInst.visible = false;
      swapped = true;
    }

    if (rockMap.rock_cliff_crag?.geo && rockMap.rock_cliff_crag?.mat) {
      const inst = new THREE.InstancedMesh(
        rockMap.rock_cliff_crag.geo,
        rockMap.rock_cliff_crag.mat,
        CLIFF_ROCKS.length
      );
      inst.castShadow = true;
      inst.receiveShadow = true;
      for (let i = 0; i < CLIFF_ROCKS.length; i++) {
        const [rx, rz, rr] = CLIFF_ROCKS[i];
        const ry = getWorldElevation(rx, rz);
        // Grounded cleanly into cliff slope & shoreline with -0.85m deep skirt!
        dummy.position.set(rx, Math.max(-0.08, ry - 0.24), rz);
        dummy.rotation.set(
          Math.sin(i * 1.9) * 0.06,
          i * 1.18 + 0.35,
          Math.cos(i * 1.4) * 0.06
        );
        dummy.scale.set(rr * 0.90, rr * 0.86, rr * 0.88);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        const w = 0.94 + ((i * 29) % 10) * 0.011;
        tintCol.setRGB(w * 1.02, w * 0.99, w * 0.96);
        inst.setColorAt(i, tintCol);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      glbRockGroup.add(inst);
      cliffRockInst.visible = false;
      swapped = true;
    }

    return swapped;
  }

  return { attachRockGlbs };
}

/**
 * Builds the east stepping-stone flagstone lane climbing up to the Lighthouse Cliff (1 InstancedMesh).
 */
export function buildInstancedFlagstones({ inlandVisualGroup, cobbleMat, rng }) {
  const spots = [];
  let stoneIdx = 0;
  for (let i = 6; i < LANE_POINTS.length - 1; i++) {
    const [x0, z0] = LANE_POINTS[i];
    const [x1, z1] = LANE_POINTS[i + 1];
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const sx = x0 + (x1 - x0) * t;
      const sz = z0 + (z1 - z0) * t;
      const sy = getWorldElevation(sx, sz);
      if (sy < 0.35) continue;
      const yStagger = (stoneIdx % 5) * 0.005;
      stoneIdx += 1;
      spots.push({ x: sx, y: sy - 0.015 + yStagger, z: sz, rot: rng() * Math.PI });
    }
  }
  if (!spots.length) return;
  const stoneGeo = new THREE.CylinderGeometry(0.52, 0.58, 0.14, 9);
  const inst = new THREE.InstancedMesh(stoneGeo, cobbleMat, spots.length);
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  spots.forEach((p, idx) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    inst.setMatrixAt(idx, dummy.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;
  inlandVisualGroup.add(inst);
}

/**
 * Builds all Ghibli coastal trees (procedural instanced blob fallback that hot-swaps seamlessly
 * to GPU-instanced Codex+Blender `tree_pine` / `tree_fir` / `tree_alder` GLBs in just 6 draw calls!)
 * and flowering bushes (2 InstancedMeshes, zero per-flower material allocations).
 */
export function buildInstancedTreesAndBushes({
  inlandVisualGroup,
  darkTimberMat,
  rng,
  houseExclusion,
  addLandCollider,
}) {
  const treeSpots = CURATED_TREE_SPOTS.map((p) => [p[0], p[1]]);
  for (let i = 0; i < 64; i++) {
    treeSpots.push([-30 + rng() * 60, -15 - rng() * 24]);
  }
  // Natural alpine conifer treeline belt along the upper northern hill (z ∈ [-35, -45])
  // framing the foothill transition into the backdrop mountain with zero terrain changes!
  for (let i = 0; i < 26; i++) {
    const tx = -36 + (i / 25) * 72 + (rng() - 0.5) * 2.4;
    const tz = -35.5 - rng() * 9.5;
    treeSpots.push([tx, tz]);
  }
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 4.2;
    treeSpots.push([34 + Math.cos(a) * r, 14 + Math.sin(a) * r]);
    treeSpots.push([-34 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
  }

  const placedTrees = [];
  const trunks = [];
  const puffs = [];
  const clusterSpecs = [
    { x: 0, yOff: 0.42, z: 0, r: 0.78 },
    { x: 0.45, yOff: 0.18, z: 0.22, r: 0.58 },
    { x: -0.44, yOff: 0.22, z: -0.18, r: 0.6 },
    { x: 0.1, yOff: 0.2, z: -0.44, r: 0.55 },
    { x: -0.18, yOff: 0.68, z: 0.16, r: 0.52 },
  ];

  for (const [tx, tz] of treeSpots) {
    const ty = getWorldElevation(tx, tz);
    if (ty < 0.72) continue;
    if (houseExclusion.some((ex) => Math.hypot(tx - ex.x, tz - ex.z) < ex.r)) continue;
    if (LANE_POINTS.some(([lx, lz]) => Math.hypot(tx - lx, tz - lz) < 2.0)) continue;
    // Prevent overlapping tree trunks when combining curated + ridge spots
    if (placedTrees.some((pt) => Math.hypot(tx - pt.x, tz - pt.z) < 2.15)) continue;

    const scale = 0.78 + rng() * 0.52;
    const trunkH = 1.25 * scale;
    const leanZ = (rng() - 0.5) * 0.12;
    const color = LEAF_PALETTE[Math.floor(rng() * LEAF_PALETTE.length)];
    const treeRot = rng() * Math.PI * 2;
    const cosR = Math.cos(treeRot);
    const sinR = Math.sin(treeRot);
    const baseY = ty - 0.12;

    // Natural ecological species zoning matching lagoon_tree_studies.png & lagoon_mountain_studies.png
    const rSpec = rng();
    let species = 'tree_alder';
    if (tz < -28.0 || ty > 2.55) {
      species = rSpec < 0.64 ? 'tree_fir' : rSpec < 0.84 ? 'tree_pine' : 'tree_alder';
    } else if (Math.abs(tx) > 13.5 || tz > -18.5) {
      species = rSpec < 0.65 ? 'tree_pine' : rSpec < 0.90 ? 'tree_alder' : 'tree_fir';
    } else {
      species = rSpec < 0.56 ? 'tree_alder' : rSpec < 0.92 ? 'tree_pine' : 'tree_fir';
    }

    placedTrees.push({
      x: tx,
      y: ty - 0.08,
      z: tz,
      rotY: treeRot,
      scale,
      species,
      tintR: 0.92 + rng() * 0.14,
      tintG: 0.94 + rng() * 0.12,
      tintB: 0.90 + rng() * 0.14,
    });

    trunks.push({ x: tx, y: baseY + trunkH * 0.42, z: tz, rotY: treeRot, leanZ, scale });

    for (const c of clusterSpecs) {
      const lx = c.x * scale;
      const lz = c.z * scale;
      const wx = tx + lx * cosR + lz * sinR;
      const wz = tz - lx * sinR + lz * cosR;
      puffs.push({
        x: wx,
        y: baseY + trunkH + c.yOff * scale,
        z: wz,
        r: c.r * scale,
        rx: rng() * 2,
        ry: rng() * 2,
        rz: rng() * 2,
        color,
      });
    }

    addLandCollider({ x: tx, z: tz, radius: 0.42 });
  }

  const dummy = new THREE.Object3D();
  const leafInstMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.87 });

  const procTreeGroup = new THREE.Group();
  procTreeGroup.name = 'Town_ProceduralTrees';
  inlandVisualGroup.add(procTreeGroup);

  if (trunks.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.19, 1.25, 7);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, darkTimberMat, trunks.length);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;
    trunks.forEach((tr, i) => {
      dummy.position.set(tr.x, tr.y, tr.z);
      dummy.rotation.set(0, tr.rotY, tr.leanZ);
      dummy.scale.setScalar(tr.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    procTreeGroup.add(trunkInst);
  }

  if (puffs.length) {
    const puffGeo = new THREE.IcosahedronGeometry(1, 2);
    const canopyInst = new THREE.InstancedMesh(puffGeo, leafInstMat, puffs.length);
    canopyInst.castShadow = true;
    canopyInst.receiveShadow = true;
    puffs.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.set(p.r * 1.08, p.r * 0.84, p.r * 1.05);
      dummy.updateMatrix();
      canopyInst.setMatrixAt(i, dummy.matrix);
      canopyInst.setColorAt(i, p.color);
    });
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    procTreeGroup.add(canopyInst);
  }

  // Hot-swap handler: replaces procedural blob trees with GPU-instanced Blender Coastal Trees!
  const glbTreeGroup = new THREE.Group();
  glbTreeGroup.name = 'Town_CoastalTreeGLBs';
  inlandVisualGroup.add(glbTreeGroup);

  function attachTreeGlbs(speciesMap) {
    if (!speciesMap || !Object.keys(speciesMap).length) return false;
    while (glbTreeGroup.children.length > 0) {
      glbTreeGroup.remove(glbTreeGroup.children[0]);
    }
    const availKeys = Object.keys(speciesMap);
    const buckets = new Map();
    for (const k of availKeys) buckets.set(k, []);
    for (const pt of placedTrees) {
      const k = buckets.has(pt.species) ? pt.species : availKeys[0];
      buckets.get(k).push(pt);
    }

    const tintCol = new THREE.Color();
    for (const [k, items] of buckets.entries()) {
      const asset = speciesMap[k];
      if (!asset || !items.length) continue;

      // Subtle per-species world scale tuning so trees harmonize with enlarged v2.1 cottages!
      const spScale = k === 'tree_fir' ? 1.12 : k === 'tree_pine' ? 1.05 : 1.02;

      if (asset.woodGeo && asset.woodMat) {
        const wInst = new THREE.InstancedMesh(asset.woodGeo, asset.woodMat, items.length);
        wInst.castShadow = true;
        wInst.receiveShadow = true;
        items.forEach((pt, i) => {
          dummy.position.set(pt.x, pt.y, pt.z);
          dummy.rotation.set(0, pt.rotY, 0);
          dummy.scale.setScalar(pt.scale * spScale);
          dummy.updateMatrix();
          wInst.setMatrixAt(i, dummy.matrix);
        });
        wInst.instanceMatrix.needsUpdate = true;
        glbTreeGroup.add(wInst);
      }

      if (asset.foliageGeo && asset.foliageMat) {
        const fInst = new THREE.InstancedMesh(asset.foliageGeo, asset.foliageMat, items.length);
        fInst.castShadow = true;
        fInst.receiveShadow = true;
        items.forEach((pt, i) => {
          dummy.position.set(pt.x, pt.y, pt.z);
          dummy.rotation.set(0, pt.rotY, 0);
          dummy.scale.setScalar(pt.scale * spScale);
          dummy.updateMatrix();
          fInst.setMatrixAt(i, dummy.matrix);
          tintCol.setRGB(pt.tintR, pt.tintG, pt.tintB);
          fInst.setColorAt(i, tintCol);
        });
        fInst.instanceMatrix.needsUpdate = true;
        if (fInst.instanceColor) fInst.instanceColor.needsUpdate = true;
        glbTreeGroup.add(fInst);
      }
    }

    procTreeGroup.visible = false;
    return true;
  }

  // Flowering Bushes (2 InstancedMeshes, zero per-flower material clones!)
  const bushes = [];
  const flowers = [];
  for (let i = 0; i < 34; i++) {
    const bx = -20 + rng() * 44;
    const bz = -16.5 - rng() * 14;
    const by = getWorldElevation(bx, bz);
    if (by < 0.55) continue;
    if (houseExclusion.some((ex) => Math.hypot(bx - ex.x, bz - ex.z) < ex.r * 0.85)) continue;
    if (LANE_POINTS.some(([lx, lz]) => Math.hypot(bx - lx, bz - lz) < 1.5)) continue;

    const color = LEAF_PALETTE[Math.floor(rng() * LEAF_PALETTE.length)];
    const s = 0.65 + rng() * 0.62;
    bushes.push({ x: bx, y: by + 0.16 * s, z: bz, s, color });

    if (rng() < 0.55) {
      flowers.push({
        x: bx + 0.14,
        y: by + 0.34 * s,
        z: bz + 0.12,
        color: BUSH_FLOWER_PALETTE[Math.floor(rng() * BUSH_FLOWER_PALETTE.length)],
      });
    }
  }

  if (bushes.length) {
    const bushGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const bushInst = new THREE.InstancedMesh(bushGeo, leafInstMat, bushes.length);
    bushInst.castShadow = true;
    bushes.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(b.s * 1.15, b.s * 0.75, b.s);
      dummy.updateMatrix();
      bushInst.setMatrixAt(i, dummy.matrix);
      bushInst.setColorAt(i, b.color);
    });
    bushInst.instanceMatrix.needsUpdate = true;
    if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
    inlandVisualGroup.add(bushInst);
  }

  if (flowers.length) {
    const flowerGeo = new THREE.SphereGeometry(0.085, 6, 5);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, flowers.length);
    flowers.forEach((f, i) => {
      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      flowerInst.setMatrixAt(i, dummy.matrix);
      flowerInst.setColorAt(i, f.color);
    });
    flowerInst.instanceMatrix.needsUpdate = true;
    if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
    inlandVisualGroup.add(flowerInst);
  }

  return { attachTreeGlbs };
}

/**
 * Builds ALL chimney smoke puffs as ONE single InstancedMesh with per-instance `aOpacity`
 * attribute (eliminating 35+ material clones & draw calls!).
 */
export function buildInstancedSmoke({ inlandVisualGroup, smokeSources, rng }) {
  const puffs = [];
  for (const src of smokeSources) {
    for (let k = 0; k < 5; k++) {
      puffs.push({
        origin: src.clone(),
        phase: k / 5 + rng() * 0.15,
        speed: 0.16 + rng() * 0.04,
      });
    }
  }
  if (!puffs.length) return { update() {} };

  const smokeGeo = new THREE.IcosahedronGeometry(0.22, 1);
  const opacities = new Float32Array(puffs.length);
  const opacityAttr = new THREE.InstancedBufferAttribute(opacities, 1);
  smokeGeo.setAttribute('aOpacity', opacityAttr);

  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xf7f8f6,
    transparent: true,
    opacity: 1.0,
    roughness: 1.0,
    depthWrite: false,
  });
  smokeMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aOpacity;\nvarying float vSmokeOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSmokeOpacity = aOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSmokeOpacity;')
      .replace(
        '#include <opaque_fragment>',
        'diffuseColor.a *= vSmokeOpacity;\n#include <opaque_fragment>'
      );
  };
  smokeMat.customProgramCacheKey = () => 'instanced_smoke_v1';

  const smokeInst = new THREE.InstancedMesh(smokeGeo, smokeMat, puffs.length);
  smokeInst.frustumCulled = false;
  inlandVisualGroup.add(smokeInst);

  const dummy = new THREE.Object3D();
  return {
    update(elapsedTime) {
      for (let i = 0; i < puffs.length; i++) {
        const sp = puffs[i];
        const t = (elapsedTime * sp.speed + sp.phase) % 1.0;
        dummy.position.set(
          sp.origin.x + Math.sin(elapsedTime * 0.9 + sp.phase * 6.0) * 0.22 * t + t * 0.45,
          sp.origin.y + t * 2.4,
          sp.origin.z + Math.cos(elapsedTime * 0.7 + sp.phase * 5.0) * 0.14 * t - t * 0.2
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.55 + t * 1.45);
        dummy.updateMatrix();
        smokeInst.setMatrixAt(i, dummy.matrix);
        opacities[i] = Math.sin(t * Math.PI) * 0.48;
      }
      smokeInst.instanceMatrix.needsUpdate = true;
      opacityAttr.needsUpdate = true;
    },
  };
}
