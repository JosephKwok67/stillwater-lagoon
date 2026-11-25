import * as THREE from 'three';
import { mulberry32, clamp } from './noise.js';
import { getWorldElevation } from './terrain.js';
import {
  createWoodPlankTexture,
  createStuccoTexture,
  createRoofTileTexture,
  createCobbleTexture,
} from './textures.js';
import { FISH_SPECIES, buildSpeciesGeometry, createSpeciesTexture } from './fishCatalog.js';

/**
 * Clones materials inside a roof cutaway group so each enterable building can
 * smoothly dissolve its roof & awning independently when the player walks inside!
 */
function prepareCutawayMaterials(root) {
  const mats = [];
  const cache = new Map();
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const orig = obj.material;
    if (!cache.has(orig)) {
      const cloned = orig.clone();
      cache.set(orig, cloned);
      mats.push(cloned);
    }
    obj.material = cache.get(orig);
  });
  return mats;
}

/**
 * Builds the player's indoor glowing glass Home Aquarium with live animated 3D fish!
 * Automatically syncs whenever the player adds or removes fish in gameState.aquariumFish.
 */
function createIndoorAquarium(timberMat, darkTimberMat) {
  const group = new THREE.Group();

  const tankW = 1.82;
  const tankH = 0.84;
  const tankD = 0.56;
  const standH = 0.56;

  // Honey-wood cabinet stand underneath the glass tank
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(tankW + 0.12, standH, tankD + 0.1), timberMat);
  cabinet.position.y = standH * 0.5;
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  group.add(cabinet);

  // Subtle cabinet doors & knobs
  for (const sx of [-0.46, 0.46]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.4, 0.03), darkTimberMat);
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
  for (const [rx, rz, rs] of [
    [-0.58, -0.08, 0.13],
    [0.52, -0.1, 0.11],
    [0.14, -0.14, 0.09],
  ]) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), rockMat);
    r.scale.set(1.2, 0.7, 1.0);
    r.position.set(rx, standH + 0.09, rz);
    group.add(r);
  }
  for (const [kx, kz, kh] of [
    [-0.72, -0.14, 0.44],
    [-0.64, -0.06, 0.34],
    [0.68, -0.13, 0.48],
    [0.6, -0.08, 0.32],
    [0.02, -0.17, 0.36],
  ]) {
    const frond = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, kh, 6), kelpMat);
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
      // Scale comfortably to fit inside the home tank while preserving true relative size differences!
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

/**
 * Builds a charming painterly cottage.
 * When `enterable: true`, constructs REAL 4-wall interior geometry with an actual open doorway,
 * hinged swinging wooden door (`doorPivot`), smooth roof/awning cutaway (`roofCutawayGroup`),
 * warm wooden plank interior floor, and cozy interior props — zero teleportation!
 */
function createCottage({
  id = '',
  nameZh = '小屋',
  width = 2.6,
  depth = 2.2,
  wallHeight = 1.65,
  roofHeight = 1.15,
  wallMat,
  roofMat,
  trimMat,
  darkTimberMat,
  shutterMat,
  windowMat,
  stoneMat,
  hasPorch = false,
  hasDormer = false,
  hasChimney = true,
  isPlayerHome = false,
  enterable = false,
  interiorTheme = 'none', // 'player_home' | 'artisan_workshop' | 'neighbor' | 'none'
}) {
  const group = new THREE.Group();
  const roofCutawayGroup = new THREE.Group();
  group.add(roofCutawayGroup);

  const floorY = 0.14;
  const wallT = 0.16;
  const doorW = enterable ? 0.94 : 0.54;
  const doorH = enterable ? 1.24 : 0.96;
  const doorX = isPlayerHome ? -0.68 : 0;

  // Deep stone foundation skirt so sloped ground never shows gaps under the house
  const baseGeo = new THREE.BoxGeometry(width + 0.24, 1.5, depth + 0.24);
  const base = new THREE.Mesh(baseGeo, stoneMat);
  base.position.y = floorY - 0.75;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  let doorPivot = null;
  let interiorLight = null;
  let aquarium = null;
  const interiorAnchors = {};

  if (enterable) {
    // ---- TRUE WALK-IN INTERIOR SHELL (Openable doorway + warm interior planks!) ----
    const innerWallMat = new THREE.MeshStandardMaterial({ color: 0xf6ebd7, roughness: 0.88 });
    const floorPlankMat = new THREE.MeshStandardMaterial({
      map: trimMat.map || null,
      color: 0xd4a468,
      roughness: 0.82,
    });

    // Interior hardwood floor slab
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.08, depth - 0.08), floorPlankMat);
    floorMesh.position.y = floorY + 0.02;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    const wy = floorY + wallHeight * 0.5;

    // Back wall (-Z)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, wallT), wallMat);
    backWall.position.set(0, wy, -depth * 0.5 + wallT * 0.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    // Warm cream interior liner on back & side walls
    const backLiner = new THREE.Mesh(new THREE.PlaneGeometry(width - wallT * 2, wallHeight - 0.06), innerWallMat);
    backLiner.position.set(0, wy, -depth * 0.5 + wallT + 0.008);
    group.add(backLiner);

    // Left wall (-X) & Right wall (+X)
    const sideLen = depth - wallT * 2;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallHeight, sideLen), wallMat);
    leftWall.position.set(-width * 0.5 + wallT * 0.5, wy, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallHeight, sideLen), wallMat);
    rightWall.position.set(width * 0.5 - wallT * 0.5, wy, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    group.add(rightWall);

    // Front wall (+Z) SPLIT cleanly around the open doorway!
    // Lower baseboard curb (0.36m) stays solid to frame the room; upper front wall dissolves with roofCutawayGroup
    // so top-down indoor & aquarium views are NEVER obstructed!
    const doorLeftEdge = doorX - doorW * 0.5;
    const doorRightEdge = doorX + doorW * 0.5;
    const frontZ = depth * 0.5 - wallT * 0.5;
    const curbH = 0.36;
    const upperFrontH = Math.max(0.2, wallHeight - curbH);
    const curbY = floorY + curbH * 0.5;
    const upperFrontY = floorY + curbH + upperFrontH * 0.5;

    const leftSegW = doorLeftEdge - -width * 0.5;
    if (leftSegW > 0.05) {
      const cx = -width * 0.5 + leftSegW * 0.5;
      const fLeftCurb = new THREE.Mesh(new THREE.BoxGeometry(leftSegW, curbH, wallT), wallMat);
      fLeftCurb.position.set(cx, curbY, frontZ);
      fLeftCurb.castShadow = true;
      fLeftCurb.receiveShadow = true;
      group.add(fLeftCurb);

      const fLeftUpper = new THREE.Mesh(new THREE.BoxGeometry(leftSegW, upperFrontH, wallT), wallMat);
      fLeftUpper.position.set(cx, upperFrontY, frontZ);
      fLeftUpper.castShadow = true;
      fLeftUpper.receiveShadow = true;
      roofCutawayGroup.add(fLeftUpper);
    }

    const rightSegW = width * 0.5 - doorRightEdge;
    if (rightSegW > 0.05) {
      const cx = doorRightEdge + rightSegW * 0.5;
      const fRightCurb = new THREE.Mesh(new THREE.BoxGeometry(rightSegW, curbH, wallT), wallMat);
      fRightCurb.position.set(cx, curbY, frontZ);
      fRightCurb.castShadow = true;
      fRightCurb.receiveShadow = true;
      group.add(fRightCurb);

      const fRightUpper = new THREE.Mesh(new THREE.BoxGeometry(rightSegW, upperFrontH, wallT), wallMat);
      fRightUpper.position.set(cx, upperFrontY, frontZ);
      fRightUpper.castShadow = true;
      fRightUpper.receiveShadow = true;
      roofCutawayGroup.add(fRightUpper);
    }

    // Lintel above the doorway (put inside roofCutawayGroup so view inside is extra clear!)
    const lintelH = Math.max(0.18, wallHeight - doorH);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.08, lintelH, wallT + 0.01), wallMat);
    lintel.position.set(doorX, floorY + doorH + lintelH * 0.5, frontZ);
    lintel.castShadow = true;
    roofCutawayGroup.add(lintel);

    // Wooden door frame jambs + threshold step
    const jambGeo = new THREE.BoxGeometry(0.08, doorH + 0.06, wallT + 0.05);
    const jambL = new THREE.Mesh(jambGeo, darkTimberMat || trimMat);
    jambL.position.set(doorLeftEdge, floorY + doorH * 0.5, frontZ);
    const jambR = new THREE.Mesh(jambGeo, darkTimberMat || trimMat);
    jambR.position.set(doorRightEdge, floorY + doorH * 0.5, frontZ);
    const jambTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.14, 0.08, wallT + 0.06), darkTimberMat || trimMat);
    jambTop.position.set(doorX, floorY + doorH + 0.03, frontZ);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.08, 0.05, wallT + 0.12), trimMat);
    sill.position.set(doorX, floorY + 0.03, frontZ);
    group.add(jambL, jambR, jambTop, sill);

    // Hinged swinging wooden door (`doorPivot` rotates smoothly 0 -> -104° inward!)
    doorPivot = new THREE.Group();
    doorPivot.position.set(doorLeftEdge + 0.035, floorY + 0.04, frontZ);
    const leafW = doorW - 0.07;
    const leafH = doorH - 0.04;
    const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0x9c6638, roughness: 0.78 });
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.075), doorLeafMat);
    doorLeaf.position.set(leafW * 0.5, leafH * 0.5, 0);
    doorLeaf.castShadow = true;
    doorLeaf.receiveShadow = true;
    doorPivot.add(doorLeaf);

    // Decorative wood cross-battens + brass doorknob on both sides
    const batten = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.12, 0.08, 0.09), darkTimberMat || trimMat);
    batten.position.set(leafW * 0.5, leafH * 0.72, 0);
    const batten2 = batten.clone();
    batten2.position.y = leafH * 0.28;
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xe6be63, roughness: 0.35, metalness: 0.6 });
    const knobF = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), brassMat);
    knobF.position.set(leafW - 0.12, leafH * 0.48, 0.06);
    const knobB = knobF.clone();
    knobB.position.z = -0.06;
    doorPivot.add(batten, batten2, knobF, knobB);
    group.add(doorPivot);

    // Warm interior ceiling light (makes walking indoors feel super cozy!)
    interiorLight = new THREE.PointLight(0xffdfb0, 1.35, 6.2, 1.6);
    interiorLight.position.set(0, floorY + wallHeight * 0.82, 0);
    group.add(interiorLight);

    // ---- Cozy Storybook Interior Furnishings per Building Theme ----
    if (interiorTheme === 'player_home') {
      // 1. Braided warm floor rug in center
      const rug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.92, 0.95, 0.025, 20),
        new THREE.MeshStandardMaterial({ color: 0xd99b6a, roughness: 0.95 })
      );
      rug.scale.set(1.25, 1, 0.86);
      rug.position.set(-0.05, floorY + 0.065, 0.25);
      rug.receiveShadow = true;
      group.add(rug);

      const rugInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.64, 0.028, 18),
        new THREE.MeshStandardMaterial({ color: 0xf2e4c9, roughness: 0.95 })
      );
      rugInner.scale.set(1.25, 1, 0.86);
      rugInner.position.set(-0.05, floorY + 0.068, 0.25);
      group.add(rugInner);

      // 2. LIVE 3D HOME AQUARIUM along back-right wall!
      aquarium = createIndoorAquarium(trimMat, darkTimberMat || trimMat);
      aquarium.group.position.set(0.68, floorY + 0.05, -depth * 0.5 + 0.54);
      group.add(aquarium.group);
      interiorAnchors.aquarium = new THREE.Vector3(0.68, floorY + 1.0, -depth * 0.5 + 0.54);

      // 3. Cozy wooden bed with coral-red quilt on back-left wall!
      const bedGroup = new THREE.Group();
      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 1.48), trimMat);
      bedFrame.position.y = 0.14;
      bedFrame.castShadow = true;
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.64, 0.1), darkTimberMat || trimMat);
      headboard.position.set(0, 0.36, -0.7);
      const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.16, 1.38),
        new THREE.MeshStandardMaterial({ color: 0xf5ecd9, roughness: 0.9 })
      );
      mattress.position.y = 0.31;
      const quilt = new THREE.Mesh(
        new THREE.BoxGeometry(1.12, 0.14, 0.94),
        new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.88 })
      );
      quilt.position.set(0, 0.34, 0.2);
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.12, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.85 })
      );
      pillow.position.set(0, 0.43, -0.44);
      bedGroup.add(bedFrame, headboard, mattress, quilt, pillow);
      bedGroup.position.set(-1.26, floorY + 0.04, -depth * 0.5 + 0.98);
      group.add(bedGroup);
      interiorAnchors.bed = new THREE.Vector3(-1.26, floorY + 0.5, -depth * 0.5 + 1.05);

      // 4. Tiny wooden nightstand & glowing reading lamp
      const table = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.44), trimMat);
      table.position.set(1.66, floorY + 0.26, 0.45);
      const lampShade = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xffe49c, emissive: 0xffb84d, emissiveIntensity: 0.85, roughness: 0.4 })
      );
      lampShade.position.set(1.66, floorY + 0.66, 0.45);
      group.add(table, lampShade);
    } else if (interiorTheme === 'artisan_workshop') {
      // Old Zhou's Rod-Making Workshop Interior!
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.68, 0.64), trimMat);
      bench.position.set(0.1, floorY + 0.38, -depth * 0.5 + 0.56);
      bench.castShadow = true;
      group.add(bench);

      // Spools & coiled cord on workbench
      const spoolMat = new THREE.MeshStandardMaterial({ color: 0xf2e4c8, roughness: 0.85 });
      for (const sx of [-0.45, -0.15, 0.48]) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10), spoolMat);
        sp.position.set(sx, floorY + 0.8, -depth * 0.5 + 0.54);
        group.add(sp);
      }

      // Vertical fishing rod rack along left wall!
      const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 1.3), darkTimberMat || trimMat);
      rackBase.position.set(-width * 0.5 + 0.34, floorY + 0.1, -0.15);
      group.add(rackBase);
      const rodColors = [0xd4a45e, 0xc76b3b, 0x26658c, 0x3b9d8f];
      for (let r = 0; r < 4; r++) {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.024, 1.48, 7),
          new THREE.MeshStandardMaterial({ color: rodColors[r], roughness: 0.68 })
        );
        rod.position.set(-width * 0.5 + 0.34, floorY + 0.84, -0.58 + r * 0.28);
        rod.rotation.z = -0.06;
        group.add(rod);
      }

      const rug = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.025, 1.15),
        new THREE.MeshStandardMaterial({ color: 0x5c7f62, roughness: 0.94 })
      );
      rug.position.set(0.1, floorY + 0.06, 0.22);
      group.add(rug);
      interiorAnchors.workbench = new THREE.Vector3(0.1, floorY + 0.78, -depth * 0.5 + 0.65);
    } else if (interiorTheme === 'neighbor') {
      // Cozy seaside cottage interior with round table, stools & rug
      const rug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.75, 0.025, 16),
        new THREE.MeshStandardMaterial({ color: 0x6f94a3, roughness: 0.95 })
      );
      rug.position.set(0, floorY + 0.06, -0.05);
      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.07, 14), trimMat);
      tableTop.position.set(0.45, floorY + 0.56, -0.45);
      const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 8), darkTimberMat || trimMat);
      tableLeg.position.set(0.45, floorY + 0.29, -0.45);
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 0.34), darkTimberMat || trimMat);
      shelf.position.set(-0.75, floorY + 0.56, -depth * 0.5 + 0.34);
      group.add(rug, tableTop, tableLeg, shelf);
    }
  } else {
    // ---- Standard Closed Decorative Cottage ----
    const walls = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
    walls.position.y = wallHeight * 0.5 + 0.12;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), trimMat);
    door.position.set(doorX, doorH * 0.5 + 0.12, depth * 0.5 + 0.02);
    group.add(door);
  }

  // Timber corner framing posts for cozy storybook detail
  const postGeo = new THREE.BoxGeometry(0.11, wallHeight + 0.04, 0.11);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, trimMat);
      post.position.set(sx * (width * 0.5 - 0.02), wallHeight * 0.5 + floorY, sz * (depth * 0.5 - 0.02));
      group.add(post);
    }
  }

  // Pitched gabled roof (inside roofCutawayGroup so it dissolves smoothly when entering!)
  const overhangX = 0.28;
  const overhangZ = 0.3;
  const halfD = depth * 0.5 + overhangZ;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-halfD, 0);
  roofShape.lineTo(0, roofHeight);
  roofShape.lineTo(halfD, 0);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: width + overhangX * 2,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(-(width * 0.5 + overhangX), wallHeight + floorY - 0.04, 0);
  roofGeo.computeVertexNormals();

  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.castShadow = true;
  roof.receiveShadow = true;
  roofCutawayGroup.add(roof);

  // Wooden ridge beam capping the roof peak
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(width + overhangX * 2 + 0.12, 0.1, 0.14),
    trimMat
  );
  ridge.position.set(0, wallHeight + roofHeight + floorY - 0.04, 0);
  roofCutawayGroup.add(ridge);

  // Optional cute front roof dormer
  if (hasDormer) {
    const dormer = new THREE.Group();
    const dBox = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.58, 0.72), wallMat);
    dBox.castShadow = true;
    const dRoof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.44, 4), roofMat);
    dRoof.rotation.y = Math.PI / 4;
    dRoof.position.set(0, 0.48, 0.02);
    dRoof.castShadow = true;
    const dWin = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.34), windowMat);
    dWin.position.set(0, 0.02, 0.365);
    const dFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.05), trimMat);
    dFrame.position.set(0, 0.02, 0.35);
    dormer.add(dBox, dRoof, dFrame, dWin);
    dormer.position.set(0.32, wallHeight + floorY + 0.38, depth * 0.28);
    roofCutawayGroup.add(dormer);
  }

  // Glowing paned windows on front & sides with colorful shutters and flower boxes
  const addWindow = (x, y, z, rotY, addBox = true) => {
    const winGroup = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.54, 0.06), trimMat);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.42), windowMat);
    glass.position.z = 0.036;
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.03), trimMat);
    mullV.position.z = 0.038;
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.03), trimMat);
    mullH.position.z = 0.038;

    const shutterL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.54, 0.045), shutterMat);
    shutterL.position.set(-0.37, 0, 0.01);
    const shutterR = shutterL.clone();
    shutterR.position.x = 0.37;
    winGroup.add(frame, glass, mullV, mullH, shutterL, shutterR);

    if (addBox) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.18), trimMat);
      box.position.set(0, -0.32, 0.08);
      const bush = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.12, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x568d41, roughness: 0.85 })
      );
      bush.position.set(0, -0.23, 0.08);
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xf498ab, roughness: 0.7 })
      );
      flower.position.set(-0.14, -0.17, 0.1);
      const flower2 = flower.clone();
      flower2.position.set(0.12, -0.17, 0.09);
      winGroup.add(box, bush, flower, flower2);
    }

    winGroup.position.set(x, y, z);
    winGroup.rotation.y = rotY;
    // Front (+Z) windows fade cleanly together with upper front wall when walking inside enterable houses!
    if (enterable && rotY === 0) {
      roofCutawayGroup.add(winGroup);
    } else {
      group.add(winGroup);
    }
  };

  if (isPlayerHome) {
    addWindow(0.88, wallHeight * 0.56 + floorY, depth * 0.5 + 0.02, 0, true);
    addWindow(-width * 0.5 - 0.02, wallHeight * 0.56 + floorY, 0.0, -Math.PI / 2, true);
    addWindow(width * 0.5 + 0.02, wallHeight * 0.56 + floorY, 0.0, Math.PI / 2, true);
  } else {
    if (width >= 2.8) {
      addWindow(-width * 0.33, wallHeight * 0.56 + floorY, depth * 0.5 + 0.02, 0, true);
      addWindow(width * 0.33, wallHeight * 0.56 + floorY, depth * 0.5 + 0.02, 0, true);
    } else if (!enterable) {
      addWindow(0, wallHeight * 0.62 + floorY, depth * 0.5 + 0.02, 0, false);
    }
    addWindow(width * 0.5 + 0.02, wallHeight * 0.56 + floorY, 0, Math.PI / 2, false);
    addWindow(-width * 0.5 - 0.02, wallHeight * 0.56 + floorY, 0, -Math.PI / 2, false);
  }

  // Optional cozy covered wooden porch on the front (+Z)
  let porchLanternPos = null;
  if (hasPorch) {
    const porchD = 1.05;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.14, porchD), trimMat);
    deck.position.set(0, floorY - 0.02, depth * 0.5 + porchD * 0.5);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // Porch posts leave a wide clear opening right in front of the door!
    const pPostGeo = new THREE.CylinderGeometry(0.055, 0.06, 1.48, 7);
    for (const px of [-width * 0.45, width * 0.08, width * 0.45]) {
      const pPost = new THREE.Mesh(pPostGeo, trimMat);
      pPost.position.set(px, floorY + 0.72, depth * 0.5 + porchD - 0.1);
      pPost.castShadow = true;
      group.add(pPost);
    }

    // Sloped porch awning roof (also fades smoothly with roofCutawayGroup!)
    const awning = new THREE.Mesh(new THREE.BoxGeometry(width + 0.32, 0.09, porchD + 0.25), roofMat);
    awning.position.set(0, floorY + 1.5, depth * 0.5 + porchD * 0.48);
    awning.rotation.x = 0.22;
    awning.castShadow = true;
    roofCutawayGroup.add(awning);

    // Porch railing on right half (leaving entry steps wide open in front of door)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.38, 0.07, 0.07), trimMat);
    rail.position.set(width * 0.26, floorY + 0.52, depth * 0.5 + porchD - 0.1);
    group.add(rail);

    // Warm little porch steps leading smoothly down to stone patio / pier
    for (let s = 0; s < 2; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 0.32), trimMat);
      step.position.set(doorX, floorY - 0.06 - s * 0.09, depth * 0.5 + porchD + 0.16 + s * 0.28);
      step.receiveShadow = true;
      group.add(step);
    }

    porchLanternPos = new THREE.Vector3(doorX + 0.62, floorY + 1.24, depth * 0.5 + 0.14);
  }

  // Stone chimney with smoke emitter coordinates (attached to roofCutawayGroup!)
  let chimneyTopLocal = null;
  if (hasChimney) {
    const chX = width * 0.3;
    const chZ = -depth * 0.22;
    const chH = roofHeight + 0.72;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.42, chH, 0.42), stoneMat);
    chimney.position.set(chX, wallHeight + chH * 0.5 - 0.15, chZ);
    chimney.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.52), stoneMat);
    cap.position.set(chX, wallHeight + chH - 0.12, chZ);
    roofCutawayGroup.add(chimney, cap);
    chimneyTopLocal = new THREE.Vector3(chX, wallHeight + chH + 0.04, chZ);
  }

  const cutawayMaterials = enterable ? prepareCutawayMaterials(roofCutawayGroup) : [];

  return {
    id,
    nameZh,
    group,
    roofCutawayGroup,
    cutawayMaterials,
    doorPivot,
    interiorLight,
    aquarium,
    interiorAnchors,
    chimneyTopLocal,
    porchLanternPos,
    dims: { width, depth, wallHeight, floorY, wallT, doorX, doorW, doorH },
  };
}

/**
 * Builds a Ghibli-inspired multi-blob painterly round canopy tree
 */
function createTreeMesh(rng, woodMat, leafMats) {
  const tree = new THREE.Group();
  const scale = 0.75 + rng() * 0.58;

  const trunkH = 1.25 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11 * scale, 0.19 * scale, trunkH, 7),
    woodMat
  );
  trunk.position.y = trunkH * 0.42;
  trunk.rotation.z = (rng() - 0.5) * 0.12;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const canopyMat = leafMats[Math.floor(rng() * leafMats.length)];
  const clusterSpecs = [
    { x: 0, y: trunkH + 0.42 * scale, z: 0, r: 0.78 * scale },
    { x: 0.45 * scale, y: trunkH + 0.18 * scale, z: 0.22 * scale, r: 0.58 * scale },
    { x: -0.44 * scale, y: trunkH + 0.22 * scale, z: -0.18 * scale, r: 0.6 * scale },
    { x: 0.1 * scale, y: trunkH + 0.2 * scale, z: -0.44 * scale, r: 0.55 * scale },
    { x: -0.18 * scale, y: trunkH + 0.68 * scale, z: 0.16 * scale, r: 0.52 * scale },
  ];

  for (const c of clusterSpecs) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r, 2), canopyMat);
    puff.scale.set(1.08, 0.84, 1.05);
    puff.position.set(c.x, c.y, c.z);
    puff.rotation.set(rng() * 2, rng() * 2, rng() * 2);
    puff.castShadow = true;
    puff.receiveShadow = true;
    tree.add(puff);
  }

  return tree;
}

/**
 * Helper to build a walkable wooden fishing pier with shore ramp, pilings, lantern,
 * boat collision proxies, and dock anchor metadata for seamless boarding/disembarking!
 */
function buildWoodenPier({
  id,
  nameZh,
  pierX,
  pierStartZ,
  pierEndZ,
  pierY = 0.44,
  pierW = 2.0,
  timberMat,
  darkTimberMat,
  rng,
  addLanternPost,
  townColliders,
  walkableDecks,
  docks,
  decorations = false,
}) {
  const pierGroup = new THREE.Group();
  const pierLen = pierEndZ - pierStartZ;
  const shoreY = Math.max(pierY, getWorldElevation(pierX, pierStartZ));

  const plankCount = Math.max(12, Math.round(pierLen * 3.2));
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1);
    const pz = pierStartZ + t * pierLen;
    // Smooth shore ramp over the first 1.6 units so walking from shore onto pier is seamless
    const distFromShore = pz - pierStartZ;
    const rampBlend = 1.0 - clamp(distFromShore / 1.85, 0, 1);
    const py = pierY + (shoreY - pierY) * rampBlend * rampBlend;

    const plank = new THREE.Mesh(new THREE.BoxGeometry(pierW, 0.09, 0.25), timberMat);
    plank.position.set(pierX + (rng() - 0.5) * 0.025, py, pz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pierGroup.add(plank);
  }

  // Longitudinal stringers under planks
  for (const sx of [-pierW * 0.42, pierW * 0.42]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, pierLen + 0.15), darkTimberMat);
    beam.position.set(pierX + sx, pierY - 0.09, (pierStartZ + pierEndZ) * 0.5);
    pierGroup.add(beam);
  }

  // Sturdy wooden pilings rooted deep into the seabed
  const pilingSteps = Math.max(3, Math.round(pierLen / 1.65));
  for (let i = 0; i <= pilingSteps; i++) {
    const pz = pierStartZ + 0.8 + (i / pilingSteps) * (pierLen - 0.9);
    for (const sx of [-pierW * 0.46, pierW * 0.46]) {
      const px = pierX + sx;
      const sb = getWorldElevation(px, pz);
      const pileTop = pierY + 0.34;
      const pileH = Math.max(1.2, pileTop - sb + 0.3);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, pileH, 8), darkTimberMat);
      pile.position.set(px, pileTop - pileH * 0.5, pz);
      pile.castShadow = true;
      pierGroup.add(pile);
    }
  }

  if (decorations) {
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), timberMat);
    crate1.position.set(pierX + 0.62, pierY + 0.23, pierEndZ - 1.75);
    crate1.rotation.y = 0.22;
    crate1.castShadow = true;
    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.042, 7, 14),
      new THREE.MeshStandardMaterial({ color: 0xc9af7d, roughness: 0.92 })
    );
    rope.rotation.x = Math.PI / 2;
    rope.position.set(pierX - 0.62, pierY + 0.08, pierEndZ - 0.72);
    pierGroup.add(crate1, rope);
  }

  addLanternPost(pierX + pierW * 0.36, pierY + 0.04, pierEndZ - 0.06, 1.5, decorations);

  // Boat collision proxies along the pier
  for (let pz = pierStartZ + 1.4; pz <= pierEndZ - 0.1; pz += 1.45) {
    townColliders.push({ x: pierX, z: pz, radius: pierW * 0.56 + 0.2 });
  }

  // Walkable deck surface for land walking controller
  walkableDecks.push({
    minX: pierX - pierW * 0.46,
    maxX: pierX + pierW * 0.46,
    minZ: pierStartZ - 0.35,
    maxZ: pierEndZ + 0.1,
    getY: (x, z) => {
      const distFromShore = Math.max(0, z - pierStartZ);
      const rampBlend = 1.0 - clamp(distFromShore / 1.85, 0, 1);
      return pierY + 0.05 + (shoreY - pierY) * rampBlend * rampBlend;
    },
  });

  // Docking anchor for boarding/disembarking!
  docks.push({
    id,
    nameZh,
    triggerPos: new THREE.Vector3(pierX, pierY + 0.2, pierEndZ - 0.5),
    boatMoorPos: new THREE.Vector3(pierX - (pierW * 0.5 + 1.32), 0, pierEndZ - 0.85),
    boatMoorYaw: 0.06,
    disembarkPos: new THREE.Vector3(pierX - 0.15, pierY + 0.05, pierEndZ - 0.9),
  });

  return pierGroup;
}

/**
 * Builds the entire Lakeside Town with:
 * - Seamless Walk-In Open-Door Cottages (Player's Home w/ Live 3D Aquarium, Artisan Workshop, East Cabin)
 * - 3 Walkable Wooden Piers (Home Pier, Fish Market Pier, Lighthouse Jetty)
 * - Reserved Sunny Garden Farm Plot beside Player's Home
 * - Fish Market Stall, Eastern Lighthouse, Trees, Streetlamps, Smoke Puffs, and Land/Interior Collisions!
 */
export function buildLakesideTown(scene) {
  const rng = mulberry32(20261201);
  const townGroup = new THREE.Group();
  scene.add(townGroup);

  const woodTex = createWoodPlankTexture();
  const cobbleTex = createCobbleTexture();

  const stuccoCream = new THREE.MeshStandardMaterial({ map: createStuccoTexture('#f2e8d5'), roughness: 0.86 });
  const stuccoOchre = new THREE.MeshStandardMaterial({ map: createStuccoTexture('#ebd2a0'), roughness: 0.86 });
  const stuccoPeach = new THREE.MeshStandardMaterial({ map: createStuccoTexture('#eec8b6'), roughness: 0.86 });
  const stuccoSage = new THREE.MeshStandardMaterial({ map: createStuccoTexture('#d6e0cf'), roughness: 0.86 });

  const roofRed = new THREE.MeshStandardMaterial({ map: createRoofTileTexture('#c84d37', '#892f21', '#df6d53'), roughness: 0.78 });
  const roofTerracotta = new THREE.MeshStandardMaterial({ map: createRoofTileTexture('#cf6f43', '#944726', '#e38c60'), roughness: 0.78 });
  const roofSlate = new THREE.MeshStandardMaterial({ map: createRoofTileTexture('#4d6b7c', '#314755', '#68899b'), roughness: 0.76 });

  const timberMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb9854c, roughness: 0.82 });
  const darkTimberMat = new THREE.MeshStandardMaterial({ color: 0x6f4a28, roughness: 0.86 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9b9484, roughness: 0.92 });
  const cobbleMat = new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.92 });

  const shutterTeal = new THREE.MeshStandardMaterial({ color: 0x3b7b7d, roughness: 0.78 });
  const shutterBlue = new THREE.MeshStandardMaterial({ color: 0x4c6e91, roughness: 0.78 });
  const shutterGreen = new THREE.MeshStandardMaterial({ color: 0x527f4e, roughness: 0.78 });

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a1,
    emissive: 0xffb74d,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: 0xfff0b2,
    emissive: 0xffc04d,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x36312d, roughness: 0.5, metalness: 0.45 });

  const treeLeafMats = [
    new THREE.MeshStandardMaterial({ color: 0x588d43, roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: 0x6ea049, roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ color: 0x477d48, roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: 0x7eaa52, roughness: 0.86 }),
  ];

  const townColliders = []; // For boat water navigation
  const landCircleColliders = []; // Trees, stall, lighthouse, non-enterable houses
  const walkableDecks = []; // Piers, porches, interior floors
  const docks = [];
  const enterableBuildings = [];
  const warmLights = [];
  const smokeSources = [];

  const addLanternPost = (x, y, z, height = 1.65, addPointLight = false) => {
    const post = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, height, 7), ironMat);
    pole.position.y = height * 0.5;
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.04), ironMat);
    arm.position.set(0.12, height - 0.04, 0);
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8), lanternGlassMat);
    bulb.position.set(0.24, height - 0.16, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 8), ironMat);
    cap.position.set(0.24, height - 0.05, 0);
    post.add(pole, arm, bulb, cap);

    if (addPointLight) {
      const pt = new THREE.PointLight(0xffc966, 0.85, 7.5, 1.8);
      pt.position.set(0.24, height - 0.18, 0);
      post.add(pt);
      warmLights.push({ light: pt, base: 0.85 });
    }
    post.position.set(x, y, z);
    townGroup.add(post);
  };

  /**
   * Registers an enterable walk-in building with local-space OBB doorway collision,
   * openable hinged door state, and smooth roof cutaway transition!
   */
  function registerEnterableBuilding(cottage, wx, wy, wz, rotY, hasPorch = false) {
    cottage.group.position.set(wx, wy, wz);
    cottage.group.rotation.y = rotY;
    cottage.group.updateMatrixWorld(true);
    townGroup.add(cottage.group);

    if (cottage.chimneyTopLocal) {
      const wp = cottage.chimneyTopLocal.clone().applyMatrix4(cottage.group.matrixWorld);
      smokeSources.push(wp);
    }
    if (cottage.interiorLight) {
      warmLights.push({ light: cottage.interiorLight, base: 1.35 });
    }

    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const { width, depth, floorY, wallT, doorX, doorW } = cottage.dims;

    const toLocal = (px, pz) => {
      const dx = px - wx;
      const dz = pz - wz;
      return {
        lx: dx * cosR - dz * sinR,
        lz: dx * sinR + dz * cosR,
      };
    };

    const toWorld = (lx, ly, lz) => {
      return new THREE.Vector3(
        wx + lx * cosR + lz * sinR,
        wy + ly,
        wz - lx * sinR + lz * cosR
      );
    };

    const doorWorldPos = toWorld(doorX, floorY + 0.65, depth * 0.5);
    const interiorCenterWorld = toWorld(0, floorY + 0.5, 0);

    // Register walkable deck covering interior floor + front porch!
    const porchExtraZ = hasPorch ? 1.55 : 0.35;
    walkableDecks.push({
      contains: (px, pz) => {
        const { lx, lz } = toLocal(px, pz);
        return (
          Math.abs(lx) <= width * 0.5 + 0.15 &&
          lz >= -depth * 0.5 + 0.05 &&
          lz <= depth * 0.5 + porchExtraZ
        );
      },
      getY: (px, pz) => {
        const { lz } = toLocal(px, pz);
        if (lz <= depth * 0.5 + (hasPorch ? 1.0 : 0.15)) {
          return wy + floorY + 0.05;
        }
        // Smooth step ramp from porch edge down to surrounding patio ground
        const t = clamp((lz - (depth * 0.5 + 1.0)) / 0.55, 0, 1);
        const groundY = getWorldElevation(px, pz);
        return THREE.MathUtils.lerp(wy + floorY + 0.05, groundY, t);
      },
    });

    // Convert any interior interactive anchors into world coordinates
    const worldAnchors = {};
    for (const [k, v] of Object.entries(cottage.interiorAnchors)) {
      worldAnchors[k] = toWorld(v.x, v.y, v.z);
    }

    const record = {
      id: cottage.id,
      nameZh: cottage.nameZh,
      group: cottage.group,
      roofCutawayGroup: cottage.roofCutawayGroup,
      cutawayMaterials: cottage.cutawayMaterials,
      doorPivot: cottage.doorPivot,
      aquarium: cottage.aquarium,
      dims: cottage.dims,
      worldPos: new THREE.Vector3(wx, wy, wz),
      rotY,
      doorWorldPos,
      interiorCenterWorld,
      worldAnchors,
      isDoorOpen: false,
      doorOpenAmount: 0,
      roofFade: 0,
      playerInside: false,
      toLocal,
      toWorld,
      toggleDoor() {
        record.isDoorOpen = !record.isDoorOpen;
        return record.isDoorOpen;
      },
      setDoorOpen(open) {
        record.isDoorOpen = Boolean(open);
      },
      isPointInside(px, pz, margin = 0.08) {
        const { lx, lz } = toLocal(px, pz);
        return (
          Math.abs(lx) < width * 0.5 - margin &&
          Math.abs(lz) < depth * 0.5 - margin
        );
      },
      /**
       * Resolves player circle collision against all 4 walls in local house space,
       * leaving the front doorway cleanly passable whenever the hinged door is open!
       */
      resolveCollision(pos, actorRadius = 0.28) {
        const { lx, lz } = toLocal(pos.x, pos.z);
        const halfW = width * 0.5;
        const halfD = depth * 0.5;
        const pad = actorRadius + wallT * 0.5;

        // Broad-phase check around house footprint
        if (Math.abs(lx) > halfW + pad + 0.3 || Math.abs(lz) > halfD + pad + 0.3) return;

        let nlx = lx;
        let nlz = lz;

        const doorPassable = record.isDoorOpen && record.doorOpenAmount > 0.35;
        const inDoorSpan = Math.abs(nlx - doorX) < doorW * 0.5 - actorRadius * 0.65;

        // Helper: push point out of a local axis-aligned wall box [minX, maxX] x [minZ, maxZ]
        const pushBox = (minX, maxX, minZ, maxZ) => {
          const cx = clamp(nlx, minX, maxX);
          const cz = clamp(nlz, minZ, maxZ);
          const dx = nlx - cx;
          const dz = nlz - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < actorRadius * actorRadius) {
            if (d2 > 1e-6) {
              const d = Math.sqrt(d2);
              const push = actorRadius - d;
              nlx += (dx / d) * push;
              nlz += (dz / d) * push;
            } else {
              // Inside box center fallback: eject along shortest axis
              const dl = Math.abs(nlx - minX);
              const dr = Math.abs(maxX - nlx);
              const db = Math.abs(nlz - minZ);
              const df = Math.abs(maxZ - nlz);
              const m = Math.min(dl, dr, db, df);
              if (m === df) nlz = maxZ + actorRadius;
              else if (m === db) nlz = minZ - actorRadius;
              else if (m === dl) nlx = minX - actorRadius;
              else nlx = maxX + actorRadius;
            }
          }
        };

        // Back wall (-Z)
        pushBox(-halfW, halfW, -halfD, -halfD + wallT);
        // Left wall (-X)
        pushBox(-halfW, -halfW + wallT, -halfD, halfD);
        // Right wall (+X)
        pushBox(halfW - wallT, halfW, -halfD, halfD);

        // Front wall (+Z): solid when door closed, split with real doorway when open!
        const fMinZ = halfD - wallT;
        const fMaxZ = halfD;
        if (!doorPassable) {
          pushBox(-halfW, halfW, fMinZ, fMaxZ);
        } else {
          const doorL = doorX - doorW * 0.5;
          const doorR = doorX + doorW * 0.5;
          if (doorL > -halfW + 0.02) pushBox(-halfW, doorL, fMinZ, fMaxZ);
          if (doorR < halfW - 0.02) pushBox(doorR, halfW, fMinZ, fMaxZ);
          // Slight jamb guides so player never clips corners while walking through
          if (!inDoorSpan && nlz > fMinZ - actorRadius && nlz < fMaxZ + actorRadius) {
            pushBox(-halfW, doorL, fMinZ, fMaxZ);
            pushBox(doorR, halfW, fMinZ, fMaxZ);
          }
        }

        // Interior furniture bounds inside Player's Home so player walks around bed & aquarium naturally
        if (record.id === 'player_home') {
          // Aquarium cabinet along back-right
          pushBox(-0.26, 1.62, -halfD + 0.14, -halfD + 0.88);
          // Cozy bed along back-left
          pushBox(-1.92, -0.66, -halfD + 0.18, -halfD + 1.72);
        } else if (record.id === 'artisan_workshop') {
          // Workbench along back wall
          pushBox(-1.0, 1.2, -halfD + 0.16, -halfD + 0.92);
        }

        if (nlx !== lx || nlz !== lz) {
          const w = toWorld(nlx, 0, nlz);
          pos.x = w.x;
          pos.z = w.z;
        }
      },
    };

    enterableBuildings.push(record);
    return record;
  }

  // =========================================================================
  // 1. PLAYER'S OWN SEAMLESS WALK-IN WATERSIDE HOME + LIVE AQUARIUM + PIER
  // =========================================================================
  const homeX = 3.6;
  const homeZ = -20.8;
  const homeY = getWorldElevation(homeX, homeZ);

  const playerHomeCottage = createCottage({
    id: 'player_home',
    nameZh: '我的临水小屋',
    width: 4.2,
    depth: 3.4,
    wallHeight: 1.92,
    roofHeight: 1.32,
    wallMat: stuccoCream,
    roofMat: roofRed,
    trimMat: timberMat,
    darkTimberMat,
    shutterMat: shutterTeal,
    windowMat,
    stoneMat,
    hasPorch: true,
    hasDormer: true,
    hasChimney: true,
    isPlayerHome: true,
    enterable: true,
    interiorTheme: 'player_home',
  });
  const playerHome = registerEnterableBuilding(playerHomeCottage, homeX, homeY, homeZ, 0.04, true);

  // Warm porch lantern light at the player's doorway
  const homeLight = new THREE.PointLight(0xffcb6e, 1.05, 8.5, 1.7);
  homeLight.position.set(homeX - 0.1, homeY + 1.55, homeZ + 2.2);
  townGroup.add(homeLight);
  warmLights.push({ light: homeLight, base: 1.05 });

  // Stone patio apron seamlessly linking house porch to player's wooden pier
  const patio = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 3.0, 0.14, 18), cobbleMat);
  patio.scale.set(1.25, 1.0, 0.9);
  patio.position.set(homeX, homeY + 0.02, homeZ + 1.95);
  patio.receiveShadow = true;
  townGroup.add(patio);

  // ---- RESERVED FUTURE FARMING PLOT (Sunny Garden Plot beside Player's Cottage!) ----
  const farmX = -0.35;
  const farmZ = -21.2;
  const farmY = getWorldElevation(farmX, farmZ);
  const farmGroup = new THREE.Group();
  farmGroup.position.set(farmX, farmY, farmZ);

  const soilBorderMat = new THREE.MeshStandardMaterial({ color: 0x8f663a, roughness: 0.88 });
  const soilBedMat = new THREE.MeshStandardMaterial({ color: 0x7c5a3c, roughness: 0.96 });
  const cloverMat = new THREE.MeshStandardMaterial({ color: 0x7aa94c, roughness: 0.9 });

  // 3×4 neat low wooden garden plot frame with soft loamy soil + wild clover tufts
  const plotW = 2.65;
  const plotD = 2.15;
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(plotW + 0.18, 0.12, 0.12), soilBorderMat);
  frameTop.position.set(0, 0.06, -plotD * 0.5);
  const frameBot = frameTop.clone();
  frameBot.position.z = plotD * 0.5;
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, plotD + 0.18), soilBorderMat);
  frameLeft.position.set(-plotW * 0.5, 0.06, 0);
  const frameRight = frameLeft.clone();
  frameRight.position.x = plotW * 0.5;
  const soilPad = new THREE.Mesh(new THREE.BoxGeometry(plotW, 0.06, plotD), soilBedMat);
  soilPad.position.y = 0.03;
  soilPad.receiveShadow = true;
  farmGroup.add(frameTop, frameBot, frameLeft, frameRight, soilPad);

  // 12 individual soil mounds (3 rows × 4 cols — future seed/crop tiles!)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.54), cloverMat);
      tile.position.set(-0.9 + c * 0.6, 0.075, -0.62 + r * 0.62);
      tile.receiveShadow = true;
      farmGroup.add(tile);
    }
  }

  // Cute wooden signpost at the garden corner
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.72, 7), darkTimberMat);
  signPost.position.set(plotW * 0.5 + 0.16, 0.36, plotD * 0.5 - 0.1);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.05), timberMat);
  signBoard.position.set(plotW * 0.5 + 0.16, 0.62, plotD * 0.5 - 0.1);
  signBoard.rotation.y = -0.25;
  farmGroup.add(signPost, signBoard);
  townGroup.add(farmGroup);

  const farmPlotAnchor = new THREE.Vector3(farmX, farmY + 0.4, farmZ + plotD * 0.5 + 0.25);

  // ---- 3 WALKABLE WOODEN PIERS ----
  // Pier 1: Player's Home Pier
  townGroup.add(
    buildWoodenPier({
      id: 'dock_home',
      nameZh: '自家小屋码头',
      pierX: 3.6,
      pierStartZ: -18.55,
      pierEndZ: -12.6,
      pierY: 0.44,
      pierW: 2.05,
      timberMat,
      darkTimberMat,
      rng,
      addLanternPost,
      townColliders,
      walkableDecks,
      docks,
      decorations: true,
    })
  );

  // Pier 2: Fish Market & Workshop Pier (right in front of Ah Lian's Fish Stall!)
  townGroup.add(
    buildWoodenPier({
      id: 'dock_market',
      nameZh: '渔市集码头',
      pierX: -5.6,
      pierStartZ: -17.95,
      pierEndZ: -13.1,
      pierY: 0.44,
      pierW: 1.95,
      timberMat,
      darkTimberMat,
      rng,
      addLanternPost,
      townColliders,
      walkableDecks,
      docks,
      decorations: false,
    })
  );

  // Pier 3: Eastern Lighthouse Jetty (below Uncle Hai's Lighthouse!)
  townGroup.add(
    buildWoodenPier({
      id: 'dock_lighthouse',
      nameZh: '东海角灯塔栈桥',
      pierX: 14.0,
      pierStartZ: -15.9,
      pierEndZ: -11.6,
      pierY: 0.44,
      pierW: 1.75,
      timberMat,
      darkTimberMat,
      rng,
      addLanternPost,
      townColliders,
      walkableDecks,
      docks,
      decorations: false,
    })
  );

  // =========================================================================
  // 2. NEIGHBORING LAKESIDE VILLAGE COTTAGES (2 MORE SEAMLESS WALK-IN HOUSES!)
  // =========================================================================
  const villageHouses = [
    {
      id: 'artisan_workshop',
      nameZh: '老周渔具工坊',
      x: -4.8,
      z: -22.6,
      rot: 0.22,
      w: 3.55,
      d: 2.9,
      h: 1.82,
      rh: 1.22,
      wall: stuccoOchre,
      roof: roofTerracotta,
      shutter: shutterBlue,
      porch: true,
      dormer: false,
      enterable: true,
      interiorTheme: 'artisan_workshop',
    },
    {
      id: 'neighbor_east',
      nameZh: '东岸木屋',
      x: 10.6,
      z: -21.0,
      rot: -0.22,
      w: 3.25,
      d: 2.75,
      h: 1.76,
      rh: 1.18,
      wall: stuccoCream,
      roof: roofSlate,
      shutter: shutterBlue,
      porch: true,
      dormer: false,
      enterable: true,
      interiorTheme: 'neighbor',
    },
    { x: -10.2, z: -20.8, rot: 0.42, w: 2.5, d: 2.1, h: 1.62, rh: 1.12, wall: stuccoSage, roof: roofSlate, shutter: shutterTeal, porch: false, dormer: false },
    { x: -1.4, z: -27.2, rot: 0.14, w: 3.1, d: 2.4, h: 1.95, rh: 1.25, wall: stuccoPeach, roof: roofRed, shutter: shutterGreen, porch: false, dormer: true },
    { x: 7.4, z: -27.2, rot: -0.15, w: 2.9, d: 2.3, h: 1.85, rh: 1.22, wall: stuccoOchre, roof: roofRed, shutter: shutterTeal, porch: false, dormer: false },
    { x: -8.2, z: -26.8, rot: 0.32, w: 2.6, d: 2.2, h: 1.76, rh: 1.14, wall: stuccoCream, roof: roofTerracotta, shutter: shutterGreen, porch: false, dormer: false },
    { x: 14.8, z: -23.6, rot: -0.45, w: 2.4, d: 2.0, h: 1.6, rh: 1.1, wall: stuccoPeach, roof: roofTerracotta, shutter: shutterTeal, porch: false, dormer: false },
  ];

  for (const vh of villageHouses) {
    const vy = getWorldElevation(vh.x, vh.z);
    const house = createCottage({
      id: vh.id || '',
      nameZh: vh.nameZh || '小镇小屋',
      width: vh.w,
      depth: vh.d,
      wallHeight: vh.h,
      roofHeight: vh.rh,
      wallMat: vh.wall,
      roofMat: vh.roof,
      trimMat: timberMat,
      darkTimberMat,
      shutterMat: vh.shutter,
      windowMat,
      stoneMat,
      hasPorch: vh.porch,
      hasDormer: vh.dormer,
      hasChimney: true,
      isPlayerHome: false,
      enterable: Boolean(vh.enterable),
      interiorTheme: vh.interiorTheme || 'none',
    });

    if (vh.enterable) {
      registerEnterableBuilding(house, vh.x, vy, vh.z, vh.rot, vh.porch);
    } else {
      house.group.position.set(vh.x, vy, vh.z);
      house.group.rotation.y = vh.rot;
      townGroup.add(house.group);
      landCircleColliders.push({ x: vh.x, z: vh.z, radius: Math.max(vh.w, vh.d) * 0.56 });

      if (house.chimneyTopLocal && rng() < 0.55) {
        house.group.updateMatrixWorld(true);
        const wp = house.chimneyTopLocal.clone().applyMatrix4(house.group.matrixWorld);
        smokeSources.push(wp);
      }
    }
  }

  // =========================================================================
  // 3. COZY LAKESIDE FISH MARKET STALL & COBBLESTONE VILLAGE LANE
  // =========================================================================
  const stallX = -6.8;
  const stallZ = -19.1;
  const stallY = getWorldElevation(stallX, stallZ);
  const stall = new THREE.Group();

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 0.92), timberMat);
  counter.position.set(0, 0.36, 0);
  counter.castShadow = true;
  counter.receiveShadow = true;
  stall.add(counter);

  for (const px of [-0.96, 0.96]) {
    for (const pz of [-0.38, 0.38]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.7, 6), darkTimberMat);
      p.position.set(px, 0.85, pz);
      stall.add(p);
    }
  }
  const stripeRed = new THREE.MeshStandardMaterial({ color: 0xd14f38, roughness: 0.85 });
  const stripeCream = new THREE.MeshStandardMaterial({ color: 0xf7eedc, roughness: 0.85 });
  for (let s = 0; s < 5; s++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.06, 1.35),
      s % 2 === 0 ? stripeRed : stripeCream
    );
    strip.position.set(-0.92 + s * 0.46, 1.72, 0.05);
    strip.rotation.x = 0.22;
    strip.castShadow = true;
    stall.add(strip);
  }
  for (const bx of [-1.4, -1.78]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.58, 10), darkTimberMat);
    barrel.position.set(bx, 0.29, 0.15);
    barrel.castShadow = true;
    stall.add(barrel);
  }
  stall.position.set(stallX, stallY, stallZ);
  stall.rotation.y = 0.22;
  townGroup.add(stall);
  landCircleColliders.push({ x: stallX, z: stallZ, radius: 1.15 });

  // Stepping cobblestone path connecting all 3 piers, player home, garden, market, and lighthouse!
  const lanePoints = [
    [-11.5, -18.5],
    [-8.6, -18.8],
    [-5.6, -18.5],
    [-2.5, -19.2],
    [0.2, -19.0],
    [3.6, -18.6],
    [7.2, -18.8],
    [10.6, -18.6],
    [13.8, -17.6],
    [16.2, -16.8],
  ];
  for (let i = 0; i < lanePoints.length - 1; i++) {
    const [x0, z0] = lanePoints[i];
    const [x1, z1] = lanePoints[i + 1];
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const sx = x0 + (x1 - x0) * t;
      const sz = z0 + (z1 - z0) * t;
      const sy = getWorldElevation(sx, sz);
      if (sy < 0.15) continue;
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68 + rng() * 0.25, 0.78 + rng() * 0.25, 0.14, 9),
        cobbleMat
      );
      stone.position.set(sx, sy + 0.02, sz);
      stone.receiveShadow = true;
      townGroup.add(stone);
    }
  }

  for (const [lx, lz] of [
    [-8.6, -18.2],
    [-2.2, -18.9],
    [7.4, -18.4],
    [13.1, -17.9],
  ]) {
    addLanternPost(lx, getWorldElevation(lx, lz), lz, 1.75, false);
  }

  // =========================================================================
  // 4. EASTERN HEADLAND STONE LIGHTHOUSE
  // =========================================================================
  const lhX = 17.2;
  const lhZ = -16.2;
  const lhY = getWorldElevation(lhX, lhZ);
  const lighthouse = new THREE.Group();

  const lhPlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.72, 1.4, 12), stoneMat);
  lhPlinth.position.y = -0.35;
  lhPlinth.castShadow = true;
  lhPlinth.receiveShadow = true;

  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 1.6, 14), stuccoCream);
  seg1.position.y = 1.05;
  seg1.castShadow = true;
  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.95, 1.15, 14), roofRed);
  seg2.position.y = 2.42;
  seg2.castShadow = true;
  const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.82, 1.25, 14), stuccoCream);
  seg3.position.y = 3.62;
  seg3.castShadow = true;

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.82, 0.22, 14), ironMat);
  gallery.position.y = 4.35;
  const beaconGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.82, 12), lanternGlassMat);
  beaconGlass.position.y = 4.86;
  const cupola = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.78, 12), roofRed);
  cupola.position.y = 5.64;

  const beaconPivot = new THREE.Group();
  beaconPivot.position.y = 4.88;
  const lhLight = new THREE.PointLight(0xffd782, 1.4, 14, 1.6);
  beaconPivot.add(lhLight);
  warmLights.push({ light: lhLight, base: 1.4 });

  lighthouse.add(lhPlinth, seg1, seg2, seg3, gallery, beaconGlass, cupola, beaconPivot);
  lighthouse.position.set(lhX, lhY, lhZ);
  townGroup.add(lighthouse);
  landCircleColliders.push({ x: lhX, z: lhZ, radius: 1.65 });

  // =========================================================================
  // 5. PAINTERLY TREES & FLOWERING BUSHES (KEEPING WALKWAYS & FARM PLOT OPEN!)
  // =========================================================================
  const houseExclusion = [
    { x: homeX, z: homeZ, r: 4.1 },
    { x: homeX, z: -16.5, r: 2.6 },
    { x: farmX, z: farmZ, r: 2.65 },
    { x: -5.6, z: -16.0, r: 2.4 },
    { x: 14.0, z: -14.2, r: 2.3 },
    { x: stallX, z: stallZ, r: 2.4 },
    { x: lhX, z: lhZ, r: 2.8 },
    ...villageHouses.map((h) => ({ x: h.x, z: h.z, r: 3.4 })),
  ];

  const treeSpots = [
    [7.2, -22.2],
    [13.6, -20.6],
    [-13.5, -19.2],
    [-16.2, -17.5],
    [-18.0, -21.5],
    [-12.8, -24.5],
    [17.6, -19.8],
    [23.2, -19.5],
    [2.5, -25.6],
    [11.5, -26.2],
  ];

  for (let i = 0; i < 64; i++) {
    const tx = -30 + rng() * 60;
    const tz = -15 - rng() * 24;
    treeSpots.push([tx, tz]);
  }
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 4.2;
    treeSpots.push([34 + Math.cos(a) * r, 14 + Math.sin(a) * r]);
    treeSpots.push([-34 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
  }

  for (const [tx, tz] of treeSpots) {
    const ty = getWorldElevation(tx, tz);
    if (ty < 0.72) continue;
    if (houseExclusion.some((ex) => Math.hypot(tx - ex.x, tz - ex.z) < ex.r)) continue;
    if (lanePoints.some(([lx, lz]) => Math.hypot(tx - lx, tz - lz) < 2.0)) continue;

    const tree = createTreeMesh(rng, darkTimberMat, treeLeafMats);
    tree.position.set(tx, ty - 0.12, tz);
    tree.rotation.y = rng() * Math.PI * 2;
    townGroup.add(tree);
    landCircleColliders.push({ x: tx, z: tz, radius: 0.42 });
  }

  const bushGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const flowerColors = [0xf5a8b8, 0xfbe285, 0xf7f2e7];
  for (let i = 0; i < 34; i++) {
    const bx = -20 + rng() * 44;
    const bz = -16.5 - rng() * 14;
    const by = getWorldElevation(bx, bz);
    if (by < 0.55) continue;
    if (houseExclusion.some((ex) => Math.hypot(bx - ex.x, bz - ex.z) < ex.r * 0.85)) continue;
    if (lanePoints.some(([lx, lz]) => Math.hypot(bx - lx, bz - lz) < 1.5)) continue;

    const bush = new THREE.Mesh(bushGeo, treeLeafMats[Math.floor(rng() * treeLeafMats.length)]);
    const s = 0.65 + rng() * 0.62;
    bush.scale.set(s * 1.15, s * 0.75, s);
    bush.position.set(bx, by + 0.16 * s, bz);
    bush.castShadow = true;
    townGroup.add(bush);

    if (rng() < 0.55) {
      const fMat = new THREE.MeshStandardMaterial({
        color: flowerColors[Math.floor(rng() * flowerColors.length)],
        roughness: 0.7,
      });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), fMat);
      dot.position.set(bx + 0.14, by + 0.34 * s, bz + 0.12);
      townGroup.add(dot);
    }
  }

  // =========================================================================
  // 6. GENTLE DRIFTING CHIMNEY SMOKE PUFFS
  // =========================================================================
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xf7f8f6,
    transparent: true,
    opacity: 0.52,
    roughness: 1.0,
    depthWrite: false,
  });
  const smokeGeo = new THREE.IcosahedronGeometry(0.22, 1);
  const smokePuffs = [];

  for (const src of smokeSources) {
    for (let k = 0; k < 5; k++) {
      const puff = new THREE.Mesh(smokeGeo, smokeMat.clone());
      townGroup.add(puff);
      smokePuffs.push({
        mesh: puff,
        origin: src.clone(),
        phase: k / 5 + rng() * 0.15,
        speed: 0.16 + rng() * 0.04,
      });
    }
  }

  /**
   * Checks whether (x, z) is on a walkable pier deck, porch, interior floor, or dry land!
   */
  function isWalkableDeck(x, z) {
    for (const deck of walkableDecks) {
      if (deck.contains) {
        if (deck.contains(x, z)) return true;
      } else if (x >= deck.minX && x <= deck.maxX && z >= deck.minZ && z <= deck.maxZ) {
        return true;
      }
    }
    return false;
  }

  function getWalkableElevation(x, z) {
    let bestDeckY = null;
    for (const deck of walkableDecks) {
      const hit = deck.contains
        ? deck.contains(x, z)
        : x >= deck.minX && x <= deck.maxX && z >= deck.minZ && z <= deck.maxZ;
      if (hit) {
        const y = deck.getY(x, z);
        if (bestDeckY === null || y > bestDeckY) bestDeckY = y;
      }
    }
    const groundY = getWorldElevation(x, z);
    if (bestDeckY !== null) return Math.max(bestDeckY, groundY);
    return groundY;
  }

  function isWalkableLand(x, z) {
    if (isWalkableDeck(x, z)) return true;
    const elev = getWorldElevation(x, z);
    return elev >= 0.08 && elev <= 4.4;
  }

  /**
   * Resolves walking actor collisions against houses (respecting open/closed doors!),
   * trees, market stall, and lighthouse plinth.
   */
  function resolveLandCollisions(pos, actorRadius = 0.28) {
    for (const b of enterableBuildings) {
      b.resolveCollision(pos, actorRadius);
    }
    for (const c of landCircleColliders) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const minD = c.radius + actorRadius;
      if (d < minD && d > 1e-5) {
        pos.x = c.x + (dx / d) * minD;
        pos.z = c.z + (dz / d) * minD;
      }
    }
  }

  return {
    townGroup,
    townColliders,
    docks,
    enterableBuildings,
    playerHome,
    farmPlotAnchor,
    homeViewTarget: new THREE.Vector3(3.6, 1.15, -18.2),
    pierDockSpot: docks[0].boatMoorPos,
    isWalkableDeck,
    isWalkableLand,
    getWalkableElevation,
    resolveLandCollisions,

    syncHomeAquarium(fishList) {
      if (playerHome && playerHome.aquarium) {
        playerHome.aquarium.syncFishList(fishList);
      }
    },

    update(dt, elapsedTime, nightGlow = 0.25, walkerPos = null) {
      windowMat.emissiveIntensity = 0.3 + nightGlow * 1.45;
      lanternGlassMat.emissiveIntensity = 1.0 + nightGlow * 1.8;
      for (const wl of warmLights) {
        wl.light.intensity = wl.base * (0.45 + nightGlow * 1.25);
      }

      // Animate hinged doors, smooth roof cutaway, and live indoor aquarium fish!
      let activeInsideBuilding = null;
      for (const b of enterableBuildings) {
        const targetDoor = b.isDoorOpen ? 1 : 0;
        b.doorOpenAmount = THREE.MathUtils.lerp(b.doorOpenAmount, targetDoor, clamp(dt * 7.5, 0, 1));
        if (b.doorPivot) {
          b.doorPivot.rotation.y = -b.doorOpenAmount * Math.PI * 0.58;
        }

        const isInside = walkerPos ? b.isPointInside(walkerPos.x, walkerPos.z, 0.04) : false;
        b.playerInside = isInside;
        if (isInside) activeInsideBuilding = b;

        // Smooth roof cutaway fade when walking inside (zero teleportation!)
        const targetFade = isInside ? 1.0 : 0.0;
        b.roofFade = THREE.MathUtils.lerp(b.roofFade, targetFade, clamp(dt * 6.5, 0, 1));

        if (b.roofFade < 0.015) {
          b.roofCutawayGroup.visible = true;
          b.roofCutawayGroup.position.y = 0;
          for (const m of b.cutawayMaterials) {
            if (m.transparent) {
              m.transparent = false;
              m.opacity = 1;
              m.depthWrite = true;
              m.needsUpdate = true;
            }
          }
        } else if (b.roofFade > 0.96) {
          b.roofCutawayGroup.visible = false;
        } else {
          b.roofCutawayGroup.visible = true;
          b.roofCutawayGroup.position.y = b.roofFade * 0.48;
          const op = clamp(1.0 - b.roofFade, 0, 1);
          for (const m of b.cutawayMaterials) {
            if (!m.transparent) {
              m.transparent = true;
              m.depthWrite = false;
              m.needsUpdate = true;
            }
            m.opacity = op;
          }
        }

        if (b.aquarium) {
          b.aquarium.update(dt, elapsedTime);
        }
      }

      // Gently animate rising wispy chimney smoke puffs
      for (const p of smokePuffs) {
        const t = (p.phase + elapsedTime * p.speed) % 1.0;
        p.mesh.position.set(
          p.origin.x + t * 1.45 + Math.sin(elapsedTime * 1.2 + p.phase * 6.2) * 0.14,
          p.origin.y + t * 2.55,
          p.origin.z + t * 0.45
        );
        const sc = 0.55 + t * 1.65;
        p.mesh.scale.setScalar(sc);
        p.mesh.material.opacity = Math.sin(t * Math.PI) * 0.46;
      }

      beaconPivot.rotation.y = elapsedTime * 0.9;
      return activeInsideBuilding;
    },
  };
}
