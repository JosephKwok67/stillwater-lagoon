import * as THREE from 'three';
import { createIndoorAquarium } from './aquarium.js';

// Shared lightweight materials & geometries across all procedural cottage windows/doors
let sharedMats = null;
let sharedGeos = null;

function getShared() {
  if (!sharedMats) {
    sharedMats = {
      innerWall: new THREE.MeshStandardMaterial({ color: 0xf6ebd7, roughness: 0.88 }),
      doorLeaf: new THREE.MeshStandardMaterial({ color: 0x9c6638, roughness: 0.78 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xe6be63, roughness: 0.35, metalness: 0.6 }),
      winBush: new THREE.MeshStandardMaterial({ color: 0x568d41, roughness: 0.85 }),
      winFlower: new THREE.MeshStandardMaterial({ color: 0xf498ab, roughness: 0.7 }),
    };
  }
  if (!sharedGeos) {
    sharedGeos = {
      winFrame: new THREE.BoxGeometry(0.56, 0.54, 0.06),
      winGlass: new THREE.PlaneGeometry(0.44, 0.42),
      winMullV: new THREE.BoxGeometry(0.035, 0.44, 0.03),
      winMullH: new THREE.BoxGeometry(0.46, 0.035, 0.03),
      winShutter: new THREE.BoxGeometry(0.18, 0.54, 0.045),
      winBox: new THREE.BoxGeometry(0.62, 0.14, 0.18),
      winBush: new THREE.BoxGeometry(0.54, 0.12, 0.14),
      winFlower: new THREE.SphereGeometry(0.055, 6, 5),
      knob: new THREE.SphereGeometry(0.045, 8, 6),
    };
  }
  return { mats: sharedMats, geos: sharedGeos };
}

/**
 * Clones materials inside a roof cutaway group so each enterable building can
 * smoothly dissolve its roof & awning independently when the player walks inside!
 */
export function prepareCutawayMaterials(root) {
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
 * Builds a charming painterly cottage (used as procedural fallback & collision/anchor shell
 * before Blender GLBs hot-swap on top, and directly for hillside backdrop cottages).
 */
export function createCottage({
  id = '',
  nameZh = '小屋',
  width = 2.6,
  depth = 2.2,
  wallHeight = 1.65,
  roofHeight = 1.15,
  floorY = 0.14,
  doorX: customDoorX = null,
  doorW: customDoorW = null,
  doorH: customDoorH = null,
  porchD: customPorchD = 1.22,
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
  interiorTheme = 'none',
}) {
  const { mats, geos } = getShared();
  const group = new THREE.Group();
  const roofCutawayGroup = new THREE.Group();
  group.add(roofCutawayGroup);

  const wallT = 0.16;
  const doorW = customDoorW ?? (enterable ? 0.94 : 0.54);
  const doorH = customDoorH ?? (enterable ? 1.24 : 0.96);
  const doorX = customDoorX ?? (isPlayerHome ? -0.68 : 0);
  const porchD = customPorchD;

  // Deep stone foundation skirt so sloped ground never shows gaps under the house
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.24, 1.5, depth + 0.24), stoneMat);
  base.position.y = floorY - 0.75;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  let doorPivot = null;
  let interiorLight = null;
  let aquarium = null;
  const interiorAnchors = {};

  if (enterable) {
    const floorPlankMat = new THREE.MeshStandardMaterial({
      map: trimMat.map || null,
      color: 0xd4a468,
      roughness: 0.82,
    });

    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.08, depth - 0.08), floorPlankMat);
    floorMesh.position.y = floorY + 0.02;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    const wy = floorY + wallHeight * 0.5;

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, wallT), wallMat);
    backWall.position.set(0, wy, -depth * 0.5 + wallT * 0.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    const backLiner = new THREE.Mesh(new THREE.PlaneGeometry(width - wallT * 2, wallHeight - 0.06), mats.innerWall);
    backLiner.position.set(0, wy, -depth * 0.5 + wallT + 0.008);
    group.add(backLiner);

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

    const lintelH = Math.max(0.18, wallHeight - doorH);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.08, lintelH, wallT + 0.01), wallMat);
    lintel.position.set(doorX, floorY + doorH + lintelH * 0.5, frontZ);
    lintel.castShadow = true;
    roofCutawayGroup.add(lintel);

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

    doorPivot = new THREE.Group();
    doorPivot.position.set(doorLeftEdge + 0.035, floorY + 0.04, frontZ);
    const leafW = doorW - 0.07;
    const leafH = doorH - 0.04;
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.075), mats.doorLeaf);
    doorLeaf.position.set(leafW * 0.5, leafH * 0.5, 0);
    doorLeaf.castShadow = true;
    doorLeaf.receiveShadow = true;
    doorPivot.add(doorLeaf);

    const batten = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.12, 0.08, 0.09), darkTimberMat || trimMat);
    batten.position.set(leafW * 0.5, leafH * 0.72, 0);
    const batten2 = batten.clone();
    batten2.position.y = leafH * 0.28;
    const knobF = new THREE.Mesh(geos.knob, mats.brass);
    knobF.position.set(leafW - 0.12, leafH * 0.48, 0.06);
    const knobB = knobF.clone();
    knobB.position.z = -0.06;
    doorPivot.add(batten, batten2, knobF, knobB);
    group.add(doorPivot);

    interiorLight = new THREE.PointLight(0xffdfb0, 1.35, 6.2, 1.6);
    interiorLight.position.set(0, floorY + wallHeight * 0.82, 0);
    group.add(interiorLight);

    if (interiorTheme === 'player_home') {
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

      aquarium = createIndoorAquarium(trimMat, darkTimberMat || trimMat);
      aquarium.group.position.set(0.68, floorY + 0.05, -depth * 0.5 + 0.54);
      group.add(aquarium.group);
      interiorAnchors.aquarium = new THREE.Vector3(0.68, floorY + 1.0, -depth * 0.5 + 0.54);

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
      interiorAnchors.bed = new THREE.Vector3(-1.52, floorY + 0.5, -depth * 0.5 + 1.05);
      interiorAnchors.bedLie = new THREE.Vector3(-1.52, floorY + 0.48, -depth * 0.5 + 0.92);
      interiorAnchors.bedWake = new THREE.Vector3(-0.32, floorY + 0.05, -depth * 0.5 + 1.35);

      const table = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.44), trimMat);
      table.position.set(1.66, floorY + 0.26, 0.45);
      const lampShade = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xffe49c, emissive: 0xffb84d, emissiveIntensity: 0.85, roughness: 0.4 })
      );
      lampShade.position.set(1.66, floorY + 0.66, 0.45);
      group.add(table, lampShade);
    } else if (interiorTheme === 'artisan_workshop') {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.68, 0.64), trimMat);
      bench.position.set(0.1, floorY + 0.38, -depth * 0.5 + 0.56);
      bench.castShadow = true;
      group.add(bench);

      const spoolMat = new THREE.MeshStandardMaterial({ color: 0xf2e4c8, roughness: 0.85 });
      const spoolGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10);
      for (const sx of [-0.45, -0.15, 0.48]) {
        const sp = new THREE.Mesh(spoolGeo, spoolMat);
        sp.position.set(sx, floorY + 0.8, -depth * 0.5 + 0.54);
        group.add(sp);
      }

      const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 1.3), darkTimberMat || trimMat);
      rackBase.position.set(-width * 0.5 + 0.34, floorY + 0.1, -0.15);
      group.add(rackBase);
      const rodGeo = new THREE.CylinderGeometry(0.014, 0.024, 1.48, 7);
      const rodColors = [0xd4a45e, 0xc76b3b, 0x26658c, 0x3b9d8f];
      for (let r = 0; r < 4; r++) {
        const rod = new THREE.Mesh(rodGeo, new THREE.MeshStandardMaterial({ color: rodColors[r], roughness: 0.68 }));
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
    const walls = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
    walls.position.y = wallHeight * 0.5 + 0.12;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), trimMat);
    door.position.set(doorX, doorH * 0.5 + 0.12, depth * 0.5 + 0.02);
    group.add(door);
  }

  const postGeo = new THREE.BoxGeometry(0.11, wallHeight + 0.04, 0.11);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, trimMat);
      post.position.set(sx * (width * 0.5 - 0.02), wallHeight * 0.5 + floorY, sz * (depth * 0.5 - 0.02));
      group.add(post);
    }
  }

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

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(width + overhangX * 2 + 0.12, 0.1, 0.14), trimMat);
  ridge.position.set(0, wallHeight + roofHeight + floorY - 0.04, 0);
  roofCutawayGroup.add(ridge);

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

  const addWindow = (x, y, z, rotY, addBox = true) => {
    const winGroup = new THREE.Group();
    const frame = new THREE.Mesh(geos.winFrame, trimMat);
    const glass = new THREE.Mesh(geos.winGlass, windowMat);
    glass.position.z = 0.036;
    const mullV = new THREE.Mesh(geos.winMullV, trimMat);
    mullV.position.z = 0.038;
    const mullH = new THREE.Mesh(geos.winMullH, trimMat);
    mullH.position.z = 0.038;

    const shutterL = new THREE.Mesh(geos.winShutter, shutterMat);
    shutterL.position.set(-0.37, 0, 0.01);
    const shutterR = shutterL.clone();
    shutterR.position.x = 0.37;
    winGroup.add(frame, glass, mullV, mullH, shutterL, shutterR);

    if (addBox) {
      const box = new THREE.Mesh(geos.winBox, trimMat);
      box.position.set(0, -0.32, 0.08);
      const bush = new THREE.Mesh(geos.winBush, mats.winBush);
      bush.position.set(0, -0.23, 0.08);
      const flower = new THREE.Mesh(geos.winFlower, mats.winFlower);
      flower.position.set(-0.14, -0.17, 0.1);
      const flower2 = flower.clone();
      flower2.position.set(0.12, -0.17, 0.09);
      winGroup.add(box, bush, flower, flower2);
    }

    winGroup.position.set(x, y, z);
    winGroup.rotation.y = rotY;
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

  let porchLanternPos = null;
  if (hasPorch) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.16, porchD), trimMat);
    deck.position.set(0, floorY - 0.03, depth * 0.5 + porchD * 0.5);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    const porchSkirt = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.85, porchD - 0.08), stoneMat);
    porchSkirt.position.set(0, floorY - 0.5, depth * 0.5 + porchD * 0.5);
    group.add(porchSkirt);

    const pPostGeo = new THREE.CylinderGeometry(0.055, 0.06, 1.52, 7);
    const doorClearL = doorX - doorW * 0.5 - 0.24;
    const doorClearR = doorX + doorW * 0.5 + 0.24;
    const postXs = [-width * 0.46, width * 0.46];
    if (doorClearL > -width * 0.34 && doorClearL < width * 0.34) postXs.push(doorClearL);
    if (doorClearR > -width * 0.34 && doorClearR < width * 0.34) postXs.push(doorClearR);

    for (const px of postXs) {
      const pPost = new THREE.Mesh(pPostGeo, trimMat);
      pPost.position.set(px, floorY + 0.74, depth * 0.5 + porchD - 0.1);
      pPost.castShadow = true;
      group.add(pPost);
    }

    const awning = new THREE.Mesh(new THREE.BoxGeometry(width + 0.32, 0.09, porchD + 0.24), roofMat);
    awning.position.set(0, floorY + 1.54, depth * 0.5 + porchD * 0.48);
    awning.rotation.x = 0.22;
    awning.castShadow = true;
    roofCutawayGroup.add(awning);

    const railZ = depth * 0.5 + porchD - 0.1;
    const leftRailLen = doorClearL - -width * 0.46;
    if (leftRailLen > 0.38) {
      const rL = new THREE.Mesh(new THREE.BoxGeometry(leftRailLen, 0.07, 0.07), trimMat);
      rL.position.set(-width * 0.46 + leftRailLen * 0.5, floorY + 0.52, railZ);
      group.add(rL);
    }
    const rightRailLen = width * 0.46 - doorClearR;
    if (rightRailLen > 0.38) {
      const rR = new THREE.Mesh(new THREE.BoxGeometry(rightRailLen, 0.07, 0.07), trimMat);
      rR.position.set(doorClearR + rightRailLen * 0.5, floorY + 0.52, railZ);
      group.add(rR);
    }

    const stepGeo = new THREE.BoxGeometry(doorW + 0.34, 0.12, 0.32);
    for (let s = 0; s < 2; s++) {
      const step = new THREE.Mesh(stepGeo, trimMat);
      step.position.set(doorX, floorY - 0.07 - s * 0.08, depth * 0.5 + porchD + 0.15 + s * 0.26);
      step.receiveShadow = true;
      group.add(step);
    }

    porchLanternPos = new THREE.Vector3(doorX + doorW * 0.62, floorY + 1.24, depth * 0.5 + 0.14);
  }

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
    dims: { width, depth, wallHeight, floorY, wallT, doorX, doorW, doorH, porchD },
  };
}
