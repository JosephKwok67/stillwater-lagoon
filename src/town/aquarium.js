import * as THREE from 'three';
import { clamp } from '../noise.js';
import { FISH_SPECIES, buildSpeciesGeometry, createSpeciesTexture } from '../fishCatalog.js';

/**
 * Builds the player's indoor glowing glass Home Aquarium with live animated 3D fish!
 * Automatically syncs whenever the player adds or removes fish in gameState.aquariumFish.
 */
export function createIndoorAquarium(timberMat, darkTimberMat) {
  const group = new THREE.Group();

  const tankW = 2.04;
  const tankH = 0.86;
  const tankD = 0.6;
  const standH = 0.56;

  // Honey-wood cabinet stand underneath the glass tank
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(tankW + 0.12, standH, tankD + 0.1), timberMat);
  cabinet.position.y = standH * 0.5;
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  group.add(cabinet);

  // Subtle cabinet doors & knobs
  const panelGeo = new THREE.BoxGeometry(0.76, 0.4, 0.03);
  for (const sx of [-0.46, 0.46]) {
    const panel = new THREE.Mesh(panelGeo, darkTimberMat);
    panel.position.set(sx, standH * 0.5, tankD * 0.5 + 0.055);
    group.add(panel);
  }

  // Tank bottom sand & smooth river pebbles
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe6d3a5, roughness: 0.92 });
  const sand = new THREE.Mesh(new THREE.BoxGeometry(tankW - 0.06, 0.08, tankD - 0.06), sandMat);
  sand.position.y = standH + 0.05;
  group.add(sand);

  // Miniature aquarium rocks & soft emerald kelp fronds
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7c877c, roughness: 0.9 });
  const kelpMat = new THREE.MeshStandardMaterial({ color: 0x4fa36b, roughness: 0.78 });
  const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  for (const [rx, rz, rs] of [
    [-0.58, -0.08, 0.13],
    [0.52, -0.1, 0.11],
    [0.14, -0.14, 0.09],
  ]) {
    const r = new THREE.Mesh(pebbleGeo, rockMat);
    r.scale.set(rs * 1.2, rs * 0.7, rs);
    r.position.set(rx, standH + 0.09, rz);
    group.add(r);
  }
  const frondGeo = new THREE.CylinderGeometry(0.015, 0.028, 1, 6);
  for (const [kx, kz, kh] of [
    [-0.72, -0.14, 0.44],
    [-0.64, -0.06, 0.34],
    [0.68, -0.13, 0.48],
    [0.6, -0.08, 0.32],
    [0.02, -0.17, 0.36],
  ]) {
    const frond = new THREE.Mesh(frondGeo, kelpMat);
    frond.scale.set(1, kh, 1);
    frond.position.set(kx, standH + 0.08 + kh * 0.5, kz);
    frond.rotation.z = Math.sin(kx * 7) * 0.12;
    group.add(frond);
  }

  // Luminous translucent teal aquarium water volume
  const waterBoxMat = new THREE.MeshStandardMaterial({
    color: 0x52c7bc,
    emissive: 0x1e7d78,
    emissiveIntensity: 0.42,
    transparent: true,
    opacity: 0.28,
    roughness: 0.15,
    metalness: 0.05,
    depthWrite: false,
  });
  const waterBox = new THREE.Mesh(new THREE.BoxGeometry(tankW - 0.04, tankH - 0.08, tankD - 0.04), waterBoxMat);
  waterBox.position.y = standH + tankH * 0.5;
  group.add(waterBox);

  // Clean glass tank frame rails (top/bottom trim + vertical brass/wood corners)
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(tankW + 0.08, 0.07, tankD + 0.08), darkTimberMat);
  topCap.position.y = standH + tankH + 0.02;
  group.add(topCap);

  const cornerGeo = new THREE.BoxGeometry(0.045, tankH, 0.045);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(cornerGeo, darkTimberMat);
      c.position.set(sx * (tankW * 0.5), standH + tankH * 0.5, sz * (tankD * 0.5));
      group.add(c);
    }
  }

  // Soft cyan-warm aquarium overhead glow light
  const aqLight = new THREE.PointLight(0x8ff0e2, 0.9, 3.8, 1.8);
  aqLight.position.set(0, standH + tankH - 0.06, 0.12);
  group.add(aqLight);

  // Live 3D swimming fish container
  const fishLayer = new THREE.Group();
  fishLayer.name = 'Aquarium_FishLayer';
  group.add(fishLayer);

  const specById = new Map(FISH_SPECIES.map((s) => [s.id, s]));
  const geomCache = new Map();
  const matCache = new Map();
  let swimmers = [];

  function syncFishList(fishRecords) {
    while (fishLayer.children.length > 0) {
      fishLayer.remove(fishLayer.children[0]);
    }
    swimmers = [];

    const list = fishRecords || [];
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      const spec = specById.get(rec.speciesId) || FISH_SPECIES[0];
      if (!geomCache.has(spec.id)) {
        geomCache.set(spec.id, buildSpeciesGeometry(spec));
      }
      if (!matCache.has(spec.id)) {
        const tex = createSpeciesTexture(spec);
        matCache.set(
          spec.id,
          new THREE.MeshStandardMaterial({
            map: tex,
            vertexColors: true,
            roughness: 0.42,
            emissive: new THREE.Color(spec.palette.flank),
            emissiveIntensity: 0.25,
            side: THREE.DoubleSide,
          })
        );
      }

      const mesh = new THREE.Mesh(geomCache.get(spec.id), matCache.get(spec.id));
      const rawScale = (spec.baseScale || 1.0) * (rec.sizeRatio || 1.0);
      const displayScale = clamp(rawScale * 0.24, 0.13, 0.46);
      mesh.scale.setScalar(displayScale);
      fishLayer.add(mesh);

      const dir = i % 2 === 0 ? 1 : -1;
      swimmers.push({
        mesh,
        x: ((i % 4) - 1.5) * 0.34,
        y: standH + 0.24 + ((i * 0.17) % 0.46),
        z: ((i % 3) - 1) * 0.11,
        dir,
        speed: 0.16 + (i % 4) * 0.055,
        phase: i * 1.73,
        yaw: dir > 0 ? 0 : Math.PI,
      });
    }
  }

  function update(dt, elapsedTime) {
    const halfX = tankW * 0.5 - 0.24;
    for (const f of swimmers) {
      f.x += f.dir * f.speed * dt;
      if (f.x > halfX) {
        f.x = halfX;
        f.dir = -1;
      } else if (f.x < -halfX) {
        f.x = -halfX;
        f.dir = 1;
      }
      const targetYaw = f.dir > 0 ? 0 : Math.PI;
      let diff = targetYaw - f.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      f.yaw += diff * clamp(dt * 6.5, 0, 1);

      f.mesh.position.set(
        f.x,
        f.y + Math.sin(elapsedTime * 1.9 + f.phase) * 0.035,
        f.z + Math.cos(elapsedTime * 1.1 + f.phase) * 0.045
      );
      f.mesh.rotation.y = f.yaw;
      f.mesh.rotation.z = Math.sin(elapsedTime * 5.2 + f.phase) * 0.05;
    }
  }

  return { group, syncFishList, update, aqLight };
}
