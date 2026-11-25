import * as THREE from 'three';
import { mulberry32, clamp } from './noise.js';
import { getWorldElevation } from './terrain.js';
import {
  createWoodPlankTexture,
  createStuccoTexture,
  createRoofTileTexture,
  createCobbleTexture,
} from './textures.js';

/**
 * Builds a charming painterly cottage with foundation skirt (so it sits cleanly on terraced hills),
 * stucco walls, timber beams, pitched tiled roof, glowing windows, shutters, flower boxes, and chimney.
 */
function createCottage({
  width = 2.6,
  depth = 2.2,
  wallHeight = 1.65,
  roofHeight = 1.15,
  wallMat,
  roofMat,
  trimMat,
  shutterMat,
  windowMat,
  stoneMat,
  hasPorch = false,
  hasDormer = false,
  hasChimney = true,
  isPlayerHome = false,
}) {
  const group = new THREE.Group();

  // Deep stone foundation skirt so sloped ground never shows gaps under the house
  const baseGeo = new THREE.BoxGeometry(width + 0.24, 1.5, depth + 0.24);
  const base = new THREE.Mesh(baseGeo, stoneMat);
  base.position.y = -0.62;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Main painted stucco walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
  walls.position.y = wallHeight * 0.5 + 0.12;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Timber corner framing posts for cozy storybook detail
  const postGeo = new THREE.BoxGeometry(0.11, wallHeight + 0.04, 0.11);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, trimMat);
      post.position.set(sx * (width * 0.5 - 0.02), wallHeight * 0.5 + 0.12, sz * (depth * 0.5 - 0.02));
      group.add(post);
    }
  }

  // Pitched gabled roof (triangular prism extruded along X)
  const overhangX = 0.26;
  const overhangZ = 0.28;
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
  // Extrude runs along +Z; rotate so ridge runs along X and slopes face +Z (front) and -Z (back)
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(-(width * 0.5 + overhangX), wallHeight + 0.08, 0);
  roofGeo.computeVertexNormals();

  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Wooden ridge beam capping the roof peak
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(width + overhangX * 2 + 0.12, 0.1, 0.14),
    trimMat
  );
  ridge.position.set(0, wallHeight + roofHeight + 0.08, 0);
  group.add(ridge);

  // Optional cute front roof dormer (gives the player's own house unmistakable character!)
  if (hasDormer) {
    const dormer = new THREE.Group();
    const dBox = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.58, 0.72), wallMat);
    dBox.position.set(0, 0, 0);
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
    dormer.position.set(0, wallHeight + 0.48, depth * 0.28);
    group.add(dormer);
  }

  // Front wooden door (+Z face)
  const doorW = 0.54;
  const doorH = 0.96;
  const doorX = isPlayerHome ? -0.52 : 0;
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), trimMat);
  door.position.set(doorX, doorH * 0.5 + 0.12, depth * 0.5 + 0.02);
  group.add(door);

  // Glowing paned windows on front & sides with colorful shutters and flower boxes
  const addWindow = (x, y, z, rotY, addBox = true) => {
    const winGroup = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.54, 0.06), trimMat);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.42), windowMat);
    glass.position.z = 0.036;
    // Cross mullions
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
    group.add(winGroup);
  };

  if (isPlayerHome) {
    addWindow(0.62, wallHeight * 0.56 + 0.12, depth * 0.5 + 0.02, 0, true);
    addWindow(-width * 0.5 - 0.02, wallHeight * 0.56 + 0.12, 0.0, -Math.PI / 2, true);
    addWindow(width * 0.5 + 0.02, wallHeight * 0.56 + 0.12, 0.0, Math.PI / 2, true);
  } else {
    if (width >= 2.3) {
      addWindow(-width * 0.31, wallHeight * 0.56 + 0.12, depth * 0.5 + 0.02, 0, true);
      addWindow(width * 0.31, wallHeight * 0.56 + 0.12, depth * 0.5 + 0.02, 0, true);
    } else {
      addWindow(0, wallHeight * 0.62 + 0.12, depth * 0.5 + 0.02, 0, false);
    }
    addWindow(width * 0.5 + 0.02, wallHeight * 0.56 + 0.12, 0, Math.PI / 2, false);
    addWindow(-width * 0.5 - 0.02, wallHeight * 0.56 + 0.12, 0, -Math.PI / 2, false);
  }

  // Optional cozy covered wooden porch on the front (+Z)
  let porchLanternPos = null;
  if (hasPorch) {
    const porchD = 1.05;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.14, porchD), trimMat);
    deck.position.set(0, 0.12, depth * 0.5 + porchD * 0.5);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // Porch wooden posts supporting an extended awning roof
    const pPostGeo = new THREE.CylinderGeometry(0.055, 0.06, 1.38, 7);
    for (const px of [-width * 0.44, 0.12, width * 0.44]) {
      const pPost = new THREE.Mesh(pPostGeo, trimMat);
      pPost.position.set(px, 0.82, depth * 0.5 + porchD - 0.1);
      pPost.castShadow = true;
      group.add(pPost);
    }

    // Sloped porch awning roof
    const awning = new THREE.Mesh(new THREE.BoxGeometry(width + 0.32, 0.09, porchD + 0.25), roofMat);
    awning.position.set(0, 1.56, depth * 0.5 + porchD * 0.48);
    awning.rotation.x = 0.22;
    awning.castShadow = true;
    group.add(awning);

    // Porch railing on right half (leaving steps open on left in front of door!)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.48, 0.07, 0.07), trimMat);
    rail.position.set(width * 0.24, 0.58, depth * 0.5 + porchD - 0.1);
    group.add(rail);

    // Warm little porch steps leading toward the pier
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.28), trimMat);
      step.position.set(-0.52, 0.06 - s * 0.16, depth * 0.5 + porchD + 0.14 + s * 0.26);
      step.receiveShadow = true;
      group.add(step);
    }

    porchLanternPos = new THREE.Vector3(-0.08, 1.24, depth * 0.5 + 0.14);
  }

  // Stone chimney with smoke emitter coordinates
  let chimneyTopLocal = null;
  if (hasChimney) {
    const chX = width * 0.3;
    const chZ = -depth * 0.2;
    const chH = roofHeight + 0.72;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.42, chH, 0.42), stoneMat);
    chimney.position.set(chX, wallHeight + chH * 0.5 - 0.15, chZ);
    chimney.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.52), stoneMat);
    cap.position.set(chX, wallHeight + chH - 0.12, chZ);
    group.add(chimney, cap);
    chimneyTopLocal = new THREE.Vector3(chX, wallHeight + chH + 0.04, chZ);
  }

  return { group, chimneyTopLocal, porchLanternPos };
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
 * Builds the entire Lakeside Town, Player's Own Cozy House, Wooden Pier,
 * Fish Market Stall, Eastern Headland Lighthouse, Trees, Streetlamps, and Smoke Puffs!
 */
export function buildLakesideTown(scene) {
  const rng = mulberry32(20261201);
  const townGroup = new THREE.Group();
  scene.add(townGroup);

  // Shared painterly materials
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

  // Warm interior glowing window material (dynamically brightens at sunset/dusk!)
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

  const townColliders = [];
  const warmLights = [];
  const smokeSources = [];

  // Helper to place a warm rustic lantern post
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

  // =========================================================================
  // 1. PLAYER'S OWN COZY WATERSIDE HOUSE ("我的小屋") + WOODEN FISHING PIER
  // =========================================================================
  const homeX = 3.6;
  const homeZ = -20.6;
  const homeY = getWorldElevation(homeX, homeZ);

  const playerHouse = createCottage({
    width: 3.25,
    depth: 2.55,
    wallHeight: 1.82,
    roofHeight: 1.28,
    wallMat: stuccoCream,
    roofMat: roofRed,
    trimMat: timberMat,
    shutterMat: shutterTeal,
    windowMat,
    stoneMat,
    hasPorch: true,
    hasDormer: true,
    hasChimney: true,
    isPlayerHome: true,
  });
  playerHouse.group.position.set(homeX, homeY, homeZ);
  playerHouse.group.rotation.y = 0.08;
  townGroup.add(playerHouse.group);

  if (playerHouse.chimneyTopLocal) {
    const wp = playerHouse.chimneyTopLocal.clone().applyMatrix4(playerHouse.group.matrixWorld);
    // Compute manually since matrixWorld isn't updated yet
    playerHouse.group.updateMatrixWorld(true);
    wp.copy(playerHouse.chimneyTopLocal).applyMatrix4(playerHouse.group.matrixWorld);
    smokeSources.push(wp);
  }

  // Warm porch lantern light at the player's doorway
  const homeLight = new THREE.PointLight(0xffcb6e, 1.15, 9.0, 1.7);
  homeLight.position.set(homeX - 0.1, homeY + 1.5, homeZ + 1.8);
  townGroup.add(homeLight);
  warmLights.push({ light: homeLight, base: 1.15 });

  // Stone patio apron & cute white/wood garden fence beside the player's house
  const patio = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.75, 0.16, 16), cobbleMat);
  patio.scale.set(1.2, 1.0, 0.9);
  patio.position.set(homeX, homeY + 0.03, homeZ + 1.55);
  patio.receiveShadow = true;
  townGroup.add(patio);

  // Little wooden fence framing the right side of the player's garden
  for (let i = 0; i < 5; i++) {
    const fx = homeX + 2.0 + i * 0.55;
    const fz = homeZ + 1.45 - i * 0.18;
    const fy = getWorldElevation(fx, fz);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.56, 0.09), timberMat);
    post.position.set(fx, fy + 0.28, fz);
    post.castShadow = true;
    townGroup.add(post);
    if (i < 4) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.05), timberMat);
      rail.position.set(fx + 0.27, fy + 0.42, fz - 0.09);
      rail.rotation.y = 0.31;
      townGroup.add(rail);
    }
  }

  // ---- Player's Wooden Fishing Pier / Boat Dock seamlessly connecting the stone patio to clear water! ----
  const pierGroup = new THREE.Group();
  const pierX = 3.6;
  const pierStartZ = -19.05;
  const pierEndZ = -12.6;
  const pierY = 0.44;
  const pierW = 2.0;
  const pierLen = pierEndZ - pierStartZ; // 6.45 units long

  // Main wooden cross-planks with tiny realistic gaps
  const plankCount = 21;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1);
    const pz = pierStartZ + t * pierLen;
    // Slight ramp up on the first 4 landward planks so they meet the patio cleanly!
    const rampY = i < 4 ? (3 - i) * 0.14 : 0;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(pierW, 0.09, 0.25), timberMat);
    plank.position.set(pierX + (rng() - 0.5) * 0.03, pierY + rampY, pz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pierGroup.add(plank);
  }

  // Two longitudinal side stringers under the planks
  for (const sx of [-pierW * 0.42, pierW * 0.42]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, pierLen + 0.2), darkTimberMat);
    beam.position.set(pierX + sx, pierY - 0.09, (pierStartZ + pierEndZ) * 0.5);
    pierGroup.add(beam);
  }

  // Sturdy wooden pilings rooted deep into the seabed + mooring bollards sticking above deck
  for (const pz of [-17.2, -15.6, -14.1, -12.7]) {
    for (const sx of [-pierW * 0.46, pierW * 0.46]) {
      const px = pierX + sx;
      const sb = getWorldElevation(px, pz);
      const pileTop = pierY + 0.36;
      const pileH = Math.max(1.2, pileTop - sb + 0.3);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, pileH, 8), darkTimberMat);
      pile.position.set(px, pileTop - pileH * 0.5, pz);
      pile.castShadow = true;
      pierGroup.add(pile);
    }
  }

  // Cozy wooden crates, coiled mooring rope, and glowing lantern post at pier tip
  const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.46), timberMat);
  crate1.position.set(pierX + 0.55, pierY + 0.25, -14.4);
  crate1.rotation.y = 0.22;
  crate1.castShadow = true;
  const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.36), darkTimberMat);
  crate2.position.set(pierX + 0.58, pierY + 0.2, -13.95);
  crate2.rotation.y = -0.35;
  crate2.castShadow = true;
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.045, 7, 14),
    new THREE.MeshStandardMaterial({ color: 0xc9af7d, roughness: 0.92 })
  );
  rope.rotation.x = Math.PI / 2;
  rope.position.set(pierX - 0.58, pierY + 0.08, -13.3);
  pierGroup.add(crate1, crate2, rope);

  // Glowing dock lamp at the end of the player's pier (welcoming beacon when rowing home!)
  addLanternPost(pierX + 0.72, pierY + 0.04, pierEndZ + 0.02, 1.55, true);

  townGroup.add(pierGroup);

  // Add smooth circular/capsule collision proxies along the wooden pier so boat docks cleanly alongside it
  for (let pz = -17.2; pz <= -12.8; pz += 1.45) {
    townColliders.push({ x: pierX, z: pz, radius: 1.32 });
  }

  // =========================================================================
  // 2. NEIGHBORING LAKESIDE VILLAGE COTTAGES (Terraced Story-Book Town!)
  // =========================================================================
  const villageHouses = [
    { x: -4.2, z: -22.2, rot: 0.28, w: 2.8, d: 2.2, h: 1.72, rh: 1.18, wall: stuccoOchre, roof: roofTerracotta, shutter: shutterBlue, porch: true, dormer: false },
    { x: -9.8, z: -20.8, rot: 0.45, w: 2.5, d: 2.1, h: 1.62, rh: 1.12, wall: stuccoSage, roof: roofSlate, shutter: shutterTeal, porch: false, dormer: false },
    { x: -1.4, z: -26.8, rot: 0.14, w: 3.1, d: 2.4, h: 1.95, rh: 1.25, wall: stuccoPeach, roof: roofRed, shutter: shutterGreen, porch: false, dormer: true },
    { x: 10.0, z: -20.8, rot: -0.24, w: 2.75, d: 2.2, h: 1.68, rh: 1.16, wall: stuccoCream, roof: roofSlate, shutter: shutterBlue, porch: true, dormer: false },
    { x: 7.4, z: -26.8, rot: -0.15, w: 2.9, d: 2.3, h: 1.85, rh: 1.22, wall: stuccoOchre, roof: roofRed, shutter: shutterTeal, porch: false, dormer: false },
    { x: -8.0, z: -26.4, rot: 0.32, w: 2.6, d: 2.2, h: 1.76, rh: 1.14, wall: stuccoCream, roof: roofTerracotta, shutter: shutterGreen, porch: false, dormer: false },
    { x: 14.5, z: -23.6, rot: -0.45, w: 2.4, d: 2.0, h: 1.6, rh: 1.1, wall: stuccoPeach, roof: roofTerracotta, shutter: shutterTeal, porch: false, dormer: false },
  ];

  for (const vh of villageHouses) {
    const vy = getWorldElevation(vh.x, vh.z);
    const house = createCottage({
      width: vh.w,
      depth: vh.d,
      wallHeight: vh.h,
      roofHeight: vh.rh,
      wallMat: vh.wall,
      roofMat: vh.roof,
      trimMat: timberMat,
      shutterMat: vh.shutter,
      windowMat,
      stoneMat,
      hasPorch: vh.porch,
      hasDormer: vh.dormer,
      hasChimney: true,
      isPlayerHome: false,
    });
    house.group.position.set(vh.x, vy, vh.z);
    house.group.rotation.y = vh.rot;
    townGroup.add(house.group);

    if (house.chimneyTopLocal && rng() < 0.55) {
      house.group.updateMatrixWorld(true);
      const wp = house.chimneyTopLocal.clone().applyMatrix4(house.group.matrixWorld);
      smokeSources.push(wp);
    }
  }

  // =========================================================================
  // 3. COZY LAKESIDE FISH MARKET STALL & COBBLESTONE VILLAGE LANE
  // =========================================================================
  const stallX = -5.6;
  const stallZ = -19.2;
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
  // Striped red-and-cream canvas market awning
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
  // Wooden barrels beside the fish stall
  for (const bx of [-1.4, -1.78]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.58, 10), darkTimberMat);
    barrel.position.set(bx, 0.29, 0.15);
    barrel.castShadow = true;
    stall.add(barrel);
  }

  stall.position.set(stallX, stallY, stallZ);
  stall.rotation.y = 0.26;
  townGroup.add(stall);

  // Stepping cobblestone path winding from the player's house across the village waterfront
  const lanePoints = [
    [-11.5, -18.5],
    [-8.6, -19.0],
    [-5.8, -19.8],
    [-2.5, -20.2],
    [0.6, -19.6],
    [3.6, -19.0],
    [6.8, -19.4],
    [10.2, -19.0],
    [13.8, -19.8],
    [17.5, -18.4],
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

  // Warm coastal streetlamps lining the waterfront path
  for (const [lx, lz] of [
    [-7.4, -18.8],
    [-1.4, -19.4],
    [7.4, -18.6],
    [13.4, -19.1],
  ]) {
    addLanternPost(lx, getWorldElevation(lx, lz), lz, 1.75, false);
  }

  // =========================================================================
  // 4. EASTERN HEADLAND STONE LIGHTHOUSE (Scenic Landmark visible from town & lagoon!)
  // =========================================================================
  const lhX = 17.2;
  const lhZ = -16.2;
  const lhY = getWorldElevation(lhX, lhZ);
  const lighthouse = new THREE.Group();

  const lhPlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.72, 1.4, 12), stoneMat);
  lhPlinth.position.y = -0.35;
  lhPlinth.castShadow = true;
  lhPlinth.receiveShadow = true;

  // Classic cream-and-coral striped tapered lighthouse shaft
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 1.6, 14), stuccoCream);
  seg1.position.y = 1.05;
  seg1.castShadow = true;
  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.95, 1.15, 14), roofRed);
  seg2.position.y = 2.42;
  seg2.castShadow = true;
  const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.82, 1.25, 14), stuccoCream);
  seg3.position.y = 3.62;
  seg3.castShadow = true;

  // Gallery deck + glowing beacon glass + red cupola dome
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

  // =========================================================================
  // 5. PAINTERLY TREES, BUSHES & WILDFLOWERS FRAMING THE TOWN & HEADLANDS
  // =========================================================================
  const houseExclusion = [
    { x: homeX, z: homeZ, r: 3.8 },
    { x: homeX, z: -16.5, r: 2.6 },
    { x: stallX, z: stallZ, r: 2.5 },
    { x: lhX, z: lhZ, r: 2.8 },
    ...villageHouses.map((h) => ({ x: h.x, z: h.z, r: 3.1 })),
  ];

  // Hand-placed picturesque hero trees + lush hillside forest backdrop
  const treeSpots = [
    [0.2, -21.8],
    [6.8, -21.5],
    [13.4, -20.4],
    [-13.5, -19.2],
    [-16.2, -17.5],
    [-18.0, -21.5],
    [-12.8, -24.5],
    [17.2, -19.8],
    [23.2, -19.5],
    [2.5, -25.2],
    [11.5, -26.2],
  ];

  // Fill hillside ridge & outer green islands with lush groves
  for (let i = 0; i < 64; i++) {
    const tx = -30 + rng() * 60;
    const tz = -15 - rng() * 24;
    treeSpots.push([tx, tz]);
  }
  // Distant scenic side islands trees
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 4.2;
    treeSpots.push([34 + Math.cos(a) * r, 14 + Math.sin(a) * r]);
    treeSpots.push([-34 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
  }

  for (const [tx, tz] of treeSpots) {
    const ty = getWorldElevation(tx, tz);
    if (ty < 0.72) continue; // stay off sandy beach & water
    if (houseExclusion.some((ex) => Math.hypot(tx - ex.x, tz - ex.z) < ex.r)) continue;
    // Keep the cobblestone waterfront lane open
    if (lanePoints.some(([lx, lz]) => Math.hypot(tx - lx, tz - lz) < 1.85)) continue;

    const tree = createTreeMesh(rng, darkTimberMat, treeLeafMats);
    tree.position.set(tx, ty - 0.12, tz);
    tree.rotation.y = rng() * Math.PI * 2;
    townGroup.add(tree);
  }

  // Flowering coastal bushes dotted around cottages & paths
  const bushGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const flowerColors = [0xf5a8b8, 0xfbe285, 0xf7f2e7];
  for (let i = 0; i < 36; i++) {
    const bx = -20 + rng() * 44;
    const bz = -16.5 - rng() * 14;
    const by = getWorldElevation(bx, bz);
    if (by < 0.55) continue;
    if (houseExclusion.some((ex) => Math.hypot(bx - ex.x, bz - ex.z) < ex.r * 0.78)) continue;

    const bush = new THREE.Mesh(bushGeo, treeLeafMats[Math.floor(rng() * treeLeafMats.length)]);
    const s = 0.65 + rng() * 0.65;
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
  // 6. GENTLE DRIFTING CHIMNEY SMOKE PUFFS (Lively Storybook Charm!)
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
        phase: (k / 5) + rng() * 0.15,
        speed: 0.16 + rng() * 0.04,
      });
    }
  }

  return {
    townGroup,
    townColliders,
    homeViewTarget: new THREE.Vector3(4.8, 1.1, -18.0),
    pierDockSpot: new THREE.Vector3(1.6, 0, -13.6),
    update(dt, elapsedTime, nightGlow = 0.25) {
      // Dynamically warm up cottage windows & dock lanterns as sun lowers toward sunset!
      windowMat.emissiveIntensity = 0.3 + nightGlow * 1.45;
      lanternGlassMat.emissiveIntensity = 1.0 + nightGlow * 1.8;
      for (const wl of warmLights) {
        wl.light.intensity = wl.base * (0.45 + nightGlow * 1.25);
      }

      // Gently animate rising wispy chimney smoke puffs drifting with the lagoon breeze
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

      // Subtle beacon pulse on eastern lighthouse
      beaconPivot.rotation.y = elapsedTime * 0.9;
    },
  };
}
