import * as THREE from 'three';
import { clamp } from '../noise.js';
import { getWorldElevation } from '../terrain.js';

let sharedRopeMat = null;
let sharedPileGeo = null;
let sharedTieGeo = null;

function getPierShared() {
  if (!sharedRopeMat) {
    sharedRopeMat = new THREE.MeshStandardMaterial({ color: 0xc9af7d, roughness: 0.92 });
  }
  if (!sharedPileGeo) {
    sharedPileGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.0, 8);
  }
  if (!sharedTieGeo) {
    sharedTieGeo = new THREE.TorusGeometry(0.118, 0.024, 6, 12);
    sharedTieGeo.rotateX(Math.PI / 2);
  }
  return { ropeMat: sharedRopeMat, pileGeo: sharedPileGeo, tieGeo: sharedTieGeo };
}

/**
 * v2.1 Unified 5-Step Tiered Wooden Pier with GPU-instanced planks, treads, and pilings!
 */
export function buildWoodenPier({
  id,
  nameZh,
  pierX,
  pierStartZ,
  pierEndZ,
  pierY = 0.44,
  quayY = 1.14,
  pierW = 2.15,
  timberMat,
  darkTimberMat,
  rng,
  addLanternPost,
  townColliders,
  walkableDecks,
  docks,
  decorations = false,
}) {
  const { ropeMat, pileGeo, tieGeo } = getPierShared();
  const pierGroup = new THREE.Group();
  const dummy = new THREE.Object3D();

  const steps = 5;
  const stepD = 0.32;
  const stairLen = steps * stepD;
  const stairW = Math.max(1.58, pierW * 0.76);
  const deckStartZ = pierStartZ + stairLen;
  const deckLen = Math.max(3.2, pierEndZ - deckStartZ);

  // 1. Five wooden stairs (instanced)
  const treadGeo = new THREE.BoxGeometry(stairW, 0.11, stepD + 0.03);
  const treadInst = new THREE.InstancedMesh(treadGeo, timberMat, steps);
  treadInst.castShadow = true;
  treadInst.receiveShadow = true;
  for (let s = 0; s < steps; s++) {
    dummy.position.set(pierX, quayY - (s + 0.5) * 0.14, pierStartZ + (s + 0.5) * stepD);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    treadInst.setMatrixAt(s, dummy.matrix);
  }
  treadInst.instanceMatrix.needsUpdate = true;
  pierGroup.add(treadInst);

  // Angled stair cheek stringers + grounded shore abutment
  const slopeAngle = Math.atan2(quayY - pierY, stairLen);
  const cheekLen = Math.hypot(stairLen, quayY - pierY) + 0.22;
  const cheekGeo = new THREE.BoxGeometry(0.13, 0.22, cheekLen);
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeo, darkTimberMat);
    cheek.position.set(pierX + sx * (stairW * 0.5 + 0.05), (quayY + pierY) * 0.5 - 0.06, pierStartZ + stairLen * 0.5);
    cheek.rotation.x = slopeAngle;
    cheek.castShadow = true;
    pierGroup.add(cheek);
  }
  const abut = new THREE.Mesh(new THREE.BoxGeometry(stairW + 0.18, 1.3, 0.55), darkTimberMat);
  abut.position.set(pierX, quayY - 0.66, pierStartZ - 0.1);
  pierGroup.add(abut);

  // 2. Flat Timber Pier Deck (instanced planks -> 1 draw call!)
  const plankCount = Math.max(12, Math.round(deckLen * 3.1));
  const plankGeo = new THREE.BoxGeometry(pierW, 0.1, 0.28);
  const plankInst = new THREE.InstancedMesh(plankGeo, timberMat, plankCount);
  plankInst.castShadow = true;
  plankInst.receiveShadow = true;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1);
    const pz = deckStartZ + 0.1 + t * (deckLen - 0.1);
    dummy.position.set(pierX + (rng() - 0.5) * 0.02, pierY, pz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    plankInst.setMatrixAt(i, dummy.matrix);
  }
  plankInst.instanceMatrix.needsUpdate = true;
  pierGroup.add(plankInst);

  // Longitudinal stringers under flat pier planks
  const beamGeo = new THREE.BoxGeometry(0.14, 0.16, deckLen + 0.25);
  for (const sx of [-pierW * 0.42, pierW * 0.42]) {
    const beam = new THREE.Mesh(beamGeo, darkTimberMat);
    beam.position.set(pierX + sx, pierY - 0.1, deckStartZ + deckLen * 0.5);
    pierGroup.add(beam);
  }

  // 3. Instanced pilings & mooring bollard ropes
  const pilingRows = Math.max(3, Math.round(deckLen / 1.75) + 1);
  const pileInst = new THREE.InstancedMesh(pileGeo, darkTimberMat, pilingRows * 2);
  pileInst.castShadow = true;
  const tieMatrices = [];
  let pIdx = 0;
  for (let i = 0; i < pilingRows; i++) {
    const pz = deckStartZ + 0.35 + (i / Math.max(1, pilingRows - 1)) * (deckLen - 0.55);
    const isBollard = i === 0 || i === pilingRows - 1;
    for (const sx of [-pierW * 0.46, pierW * 0.46]) {
      const px = pierX + sx;
      const sb = getWorldElevation(px, pz);
      const pileTop = pierY + (isBollard ? 0.34 : 0.06);
      const pileH = Math.max(1.4, pileTop - sb + 0.45);
      dummy.position.set(px, pileTop - pileH * 0.5, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, pileH, 1);
      dummy.updateMatrix();
      pileInst.setMatrixAt(pIdx++, dummy.matrix);

      if (isBollard) {
        dummy.position.set(px, pierY + 0.22, pz);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        tieMatrices.push(dummy.matrix.clone());
      }
    }
  }
  pileInst.instanceMatrix.needsUpdate = true;
  pierGroup.add(pileInst);

  if (tieMatrices.length) {
    const tieInst = new THREE.InstancedMesh(tieGeo, ropeMat, tieMatrices.length);
    tieMatrices.forEach((m, idx) => tieInst.setMatrixAt(idx, m));
    tieInst.instanceMatrix.needsUpdate = true;
    pierGroup.add(tieInst);
  }

  if (decorations) {
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.44), timberMat);
    crate1.position.set(pierX + pierW * 0.32, pierY + 0.24, pierEndZ - 1.65);
    crate1.rotation.y = 0.24;
    crate1.castShadow = true;
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 7, 14), ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(pierX - pierW * 0.3, pierY + 0.09, pierEndZ - 0.65);
    pierGroup.add(crate1, rope);
  }

  addLanternPost(pierX + pierW * 0.4, pierY + 0.04, deckStartZ + 0.85, 1.65, decorations, pierGroup);

  for (let pz = deckStartZ + 0.4; pz <= pierEndZ - 0.1; pz += 1.4) {
    townColliders.push({ x: pierX, z: pz, radius: pierW * 0.54 + 0.22 });
  }

  walkableDecks.push({
    minX: pierX - pierW * 0.48,
    maxX: pierX + pierW * 0.48,
    minZ: pierStartZ - 0.35,
    maxZ: pierEndZ + 0.12,
    getY: (x, z) => {
      if (z <= pierStartZ) return quayY + 0.02;
      if (z < deckStartZ) {
        const t = clamp((z - pierStartZ) / stairLen, 0, 1);
        return THREE.MathUtils.lerp(quayY + 0.02, pierY + 0.055, t);
      }
      return pierY + 0.055;
    },
  });

  docks.push({
    id,
    nameZh,
    triggerPos: new THREE.Vector3(pierX, pierY + 0.22, pierEndZ - 0.55),
    boatMoorPos: new THREE.Vector3(pierX - (pierW * 0.5 + 1.38), 0, pierEndZ - 0.9),
    boatMoorYaw: 0.06,
    disembarkPos: new THREE.Vector3(pierX - 0.15, pierY + 0.06, pierEndZ - 0.95),
  });

  return pierGroup;
}
