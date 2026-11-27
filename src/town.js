import * as THREE from 'three';
import { mulberry32, clamp } from './noise.js';
import { getWorldElevation, getShoreZ } from './terrain.js';
import {
  createWoodPlankTexture,
  createStuccoTexture,
  createRoofTileTexture,
  createCobbleTexture,
} from './textures.js';
import {
  HOME_SPEC,
  FARM_PLOT_SPEC,
  MARKET_STALL_SPEC,
  LIGHTHOUSE_SPEC,
  PROMENADE_SPEC,
  PIER_SPECS,
  VILLAGE_HOUSE_SPECS,
  getLanternPostSpots,
} from './world/layout.js';
import { SpatialHash2D } from './world/spatialHash.js';
import { createCottage } from './town/cottage.js';
import { buildWoodenPier } from './town/pier.js';
import {
  buildInstancedQuayAndBoulders,
  buildInstancedFlagstones,
  buildInstancedTreesAndBushes,
  buildInstancedSmoke,
} from './town/foliageAndProps.js';

/**
 * Builds the entire Lakeside Town with:
 * - Seamless Walk-In Open-Door Cottages (Player's Home w/ Live 3D Aquarium, Artisan Workshop, East Cabin)
 * - 3 Walkable Wooden Piers (Home Pier, Fish Market Pier, Lighthouse Jetty)
 * - Reserved Sunny Garden Farm Plot beside Player's Home
 * - Fish Market Stall, Eastern Lighthouse, GPU-Instanced Trees/Bushes/Quay/Rocks/Smoke
 * - SpatialHash2D O(1) land collision lookups & inland/shoreline group split for water refraction culling
 */
export function buildLakesideTown(scene) {
  const rng = mulberry32(20261201);
  const townGroup = new THREE.Group();
  townGroup.name = 'LakesideTown';
  scene.add(townGroup);

  // Split into shoreline/water-contact structures (visible in water refraction depth pass)
  // vs strictly inland structures (skipped during off-screen water refraction pass -> major P0 GPU savings!)
  const shoreWaterGroup = new THREE.Group();
  shoreWaterGroup.name = 'Town_ShoreWater';
  const inlandVisualGroup = new THREE.Group();
  inlandVisualGroup.name = 'Town_InlandVisual';
  townGroup.add(shoreWaterGroup, inlandVisualGroup);

  const woodTex = createWoodPlankTexture();
  const cobbleTex = createCobbleTexture();

  const wallMats = {
    cream: new THREE.MeshStandardMaterial({ map: createStuccoTexture('#f2e8d5'), roughness: 0.86 }),
    ochre: new THREE.MeshStandardMaterial({ map: createStuccoTexture('#ebd2a0'), roughness: 0.86 }),
    peach: new THREE.MeshStandardMaterial({ map: createStuccoTexture('#eec8b6'), roughness: 0.86 }),
    sage: new THREE.MeshStandardMaterial({ map: createStuccoTexture('#d6e0cf'), roughness: 0.86 }),
  };

  const roofMats = {
    red: new THREE.MeshStandardMaterial({ map: createRoofTileTexture('#c84d37', '#892f21', '#df6d53'), roughness: 0.78 }),
    terracotta: new THREE.MeshStandardMaterial({ map: createRoofTileTexture('#cf6f43', '#944726', '#e38c60'), roughness: 0.78 }),
    slate: new THREE.MeshStandardMaterial({ map: createRoofTileTexture('#4d6b7c', '#314755', '#68899b'), roughness: 0.76 }),
  };

  const shutterMats = {
    teal: new THREE.MeshStandardMaterial({ color: 0x3b7b7d, roughness: 0.78 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x4c6e91, roughness: 0.78 }),
    green: new THREE.MeshStandardMaterial({ color: 0x527f4e, roughness: 0.78 }),
  };

  const timberMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb9854c, roughness: 0.82 });
  const darkTimberMat = new THREE.MeshStandardMaterial({ color: 0x6f4a28, roughness: 0.86 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9b9484, roughness: 0.92 });
  const cobbleMat = new THREE.MeshStandardMaterial({
    map: cobbleTex,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });

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

  const townColliders = [];
  const landCircleColliders = [];
  const landColliderGrid = new SpatialHash2D(4.0);
  const walkableDecks = [];
  const docks = [];
  const enterableBuildings = [];
  const warmLights = [];
  const smokeSources = [];

  function addLandCollider(circle) {
    landCircleColliders.push(circle);
    landColliderGrid.insert(circle);
  }

  // Shared lantern geometries
  const lanternArmGeo = new THREE.BoxGeometry(0.28, 0.04, 0.04);
  const lanternBulbGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8);
  const lanternCapGeo = new THREE.ConeGeometry(0.11, 0.08, 8);

  const addLanternPost = (x, y, z, height = 1.65, addPointLight = false, parent = inlandVisualGroup) => {
    const post = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, height, 7), ironMat);
    pole.position.y = height * 0.5;
    pole.castShadow = true;
    const arm = new THREE.Mesh(lanternArmGeo, ironMat);
    arm.position.set(0.12, height - 0.04, 0);
    const bulb = new THREE.Mesh(lanternBulbGeo, lanternGlassMat);
    bulb.position.set(0.24, height - 0.16, 0);
    const cap = new THREE.Mesh(lanternCapGeo, ironMat);
    cap.position.set(0.24, height - 0.05, 0);
    post.add(pole, arm, bulb, cap);

    if (addPointLight) {
      const pt = new THREE.PointLight(0xffc966, 0.85, 7.5, 1.8);
      pt.position.set(0.24, height - 0.18, 0);
      post.add(pt);
      warmLights.push({ light: pt, base: 0.85, essential: false });
    }
    post.position.set(x, y, z);
    parent.add(post);
  };

  /**
   * Registers an enterable walk-in building with local-space OBB doorway collision,
   * openable hinged door state, and smooth roof cutaway transition!
   */
  function registerEnterableBuilding(cottage, wx, wy, wz, rotY, hasPorch = false) {
    cottage.group.position.set(wx, wy, wz);
    cottage.group.rotation.y = rotY;
    cottage.group.updateMatrixWorld(true);
    inlandVisualGroup.add(cottage.group);

    if (cottage.chimneyTopLocal) {
      const wp = cottage.chimneyTopLocal.clone().applyMatrix4(cottage.group.matrixWorld);
      smokeSources.push(wp);
    }
    if (cottage.interiorLight) {
      warmLights.push({ light: cottage.interiorLight, base: 1.35, essential: true });
    }

    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const { width, depth, floorY, wallT, doorX, doorW, porchD = 1.22 } = cottage.dims;

    const toLocal = (px, pz) => {
      const dx = px - wx;
      const dz = pz - wz;
      return {
        lx: dx * cosR - dz * sinR,
        lz: dx * sinR + dz * cosR,
      };
    };

    const toWorld = (lx, ly, lz) =>
      new THREE.Vector3(wx + lx * cosR + lz * sinR, wy + ly, wz - lx * sinR + lz * cosR);

    const doorWorldPos = toWorld(doorX, floorY + 0.65, depth * 0.5);
    const interiorCenterWorld = toWorld(0, floorY + 0.5, 0);

    const porchExtraZ = hasPorch ? porchD + 0.68 : 0.35;
    walkableDecks.push({
      contains: (px, pz) => {
        const { lx, lz } = toLocal(px, pz);
        return (
          Math.abs(lx) <= width * 0.5 + 0.22 &&
          lz >= -depth * 0.5 + 0.05 &&
          lz <= depth * 0.5 + porchExtraZ
        );
      },
      getY: (px, pz) => {
        const { lz } = toLocal(px, pz);
        if (lz <= depth * 0.5 + (hasPorch ? porchD : 0.15)) {
          return wy + floorY + 0.05;
        }
        const t = clamp((lz - (depth * 0.5 + porchD)) / 0.68, 0, 1);
        const groundY = getWorldElevation(px, pz);
        return THREE.MathUtils.lerp(wy + floorY + 0.05, groundY, t);
      },
    });

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
        return Math.abs(lx) < width * 0.5 - margin && Math.abs(lz) < depth * 0.5 - margin;
      },
      resolveCollision(pos, actorRadius = 0.28) {
        const { lx, lz } = toLocal(pos.x, pos.z);
        const halfW = width * 0.5;
        const halfD = depth * 0.5;
        const pad = actorRadius + wallT * 0.5;

        if (Math.abs(lx) > halfW + pad + 1.55 || lz < -halfD - pad - 0.35 || lz > halfD + porchD + 0.55) return;

        let nlx = lx;
        let nlz = lz;
        const doorPassable = record.isDoorOpen && record.doorOpenAmount > 0.35;
        const inDoorSpan = Math.abs(nlx - doorX) < doorW * 0.5 - actorRadius * 0.55;

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

        pushBox(-halfW, halfW, -halfD, -halfD + wallT);
        pushBox(-halfW, -halfW + wallT, -halfD, halfD);
        pushBox(halfW - wallT, halfW, -halfD, halfD);

        const fMinZ = halfD - wallT;
        const fMaxZ = halfD;
        if (!doorPassable) {
          pushBox(-halfW, halfW, fMinZ, fMaxZ);
        } else {
          const doorL = doorX - doorW * 0.5;
          const doorR = doorX + doorW * 0.5;
          if (doorL > -halfW + 0.02) pushBox(-halfW, doorL, fMinZ, fMaxZ);
          if (doorR < halfW - 0.02) pushBox(doorR, halfW, fMinZ, fMaxZ);
          if (!inDoorSpan && nlz > fMinZ - actorRadius && nlz < fMaxZ + actorRadius) {
            pushBox(-halfW, doorL, fMinZ, fMaxZ);
            pushBox(doorR, halfW, fMinZ, fMaxZ);
          }
          pushBox(doorL - 0.05, doorL + 0.09, fMaxZ - 0.02, fMaxZ + doorW * 0.92);
        }

        if (record.id === 'player_home') {
          const railZ = halfD + porchD - 0.12;
          pushBox(-0.08, halfW * 0.94, railZ - 0.08, railZ + 0.08);
          pushBox(0.72, 2.04, halfD + 0.18, halfD + 0.66);
          pushBox(-0.22, 2.04, -halfD + 0.14, -halfD + 0.94);
          pushBox(-2.2, -0.84, -halfD + 0.18, -halfD + 1.88);
          pushBox(1.8, 2.46, 0.04, 0.68);
        } else if (record.id === 'artisan_workshop') {
          pushBox(halfW - 0.05, halfW + 1.38, -1.56, 0.66);
          pushBox(-1.9, -0.4, halfD + 0.22, halfD + 0.84);
          pushBox(-1.4, 1.4, -halfD + 0.14, -halfD + 0.92);
          pushBox(-halfW + 0.14, -halfW + 0.6, -0.78, 0.72);
        } else if (record.id === 'neighbor_east') {
          pushBox(-0.08, 0.22, halfD + porchD - 0.08, halfD + porchD + 0.68);
          pushBox(-0.18, 1.02, -0.58, 0.64);
          pushBox(-1.58, -0.06, -halfD + 0.14, -halfD + 0.68);
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
  // 1. PLAYER HERO HOME + CURVED STONE QUAY + PROMENADE + GARDEN + 3 PIERS
  // =========================================================================
  const homeY = getWorldElevation(HOME_SPEC.x, HOME_SPEC.z);
  const playerHomeCottage = createCottage({
    ...HOME_SPEC,
    wallMat: wallMats.cream,
    roofMat: roofMats.red,
    trimMat: timberMat,
    darkTimberMat,
    shutterMat: shutterMats.teal,
    windowMat,
    stoneMat,
    hasPorch: true,
    hasDormer: true,
    hasChimney: true,
    isPlayerHome: true,
    enterable: true,
    interiorTheme: 'player_home',
  });
  const playerHome = registerEnterableBuilding(
    playerHomeCottage,
    HOME_SPEC.x,
    homeY,
    HOME_SPEC.z,
    HOME_SPEC.rotY,
    true
  );

  const homeLight = new THREE.PointLight(0xffcb6e, 1.15, 9.2, 1.7);
  homeLight.position.set(HOME_SPEC.x - 0.1, homeY + 1.95, HOME_SPEC.z + 3.6);
  inlandVisualGroup.add(homeLight);
  warmLights.push({ light: homeLight, base: 1.15, essential: true });

  // Curved Stone Retaining Quay Wall + Waterline & Cliff Boulders (GPU Instanced!)
  const quayCapMat = new THREE.MeshStandardMaterial({ color: 0xc9c0ae, roughness: 0.88 });
  const quayWallMat = new THREE.MeshStandardMaterial({ color: 0x918a7b, roughness: 0.92 });
  const quayRockMat = new THREE.MeshStandardMaterial({ color: 0x969184, roughness: 0.92, flatShading: true });
  buildInstancedQuayAndBoulders({
    shoreWaterGroup,
    inlandVisualGroup,
    quayWallMat,
    quayCapMat,
    quayRockMat,
    addLandCollider,
  });

  // Continuous Smooth Curved Cobblestone Promenade Ribbon
  const { startX: promStartX, endX: promEndX, width: promW, frontOffset, pts: promPts, y: promY } = PROMENADE_SPEC;
  const promPos = [];
  const promUV = [];
  const promIdx = [];
  for (let i = 0; i <= promPts; i++) {
    const t = i / promPts;
    const px = promStartX + t * (promEndX - promStartX);
    const zFront = getShoreZ(px) - frontOffset;
    const zBack = zFront - promW;
    promPos.push(px, promY, zFront, px, promY, zBack);
    promUV.push(t * 14.0, 0, t * 14.0, 1.35);
    if (i < promPts) {
      const a = i * 2;
      promIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const promGeo = new THREE.BufferGeometry();
  promGeo.setAttribute('position', new THREE.Float32BufferAttribute(promPos, 3));
  promGeo.setAttribute('uv', new THREE.Float32BufferAttribute(promUV, 2));
  promGeo.setIndex(promIdx);
  promGeo.computeVertexNormals();
  const promMesh = new THREE.Mesh(promGeo, cobbleMat);
  promMesh.receiveShadow = true;
  inlandVisualGroup.add(promMesh);

  walkableDecks.push({
    contains: (px, pz) => {
      if (px < promStartX - 0.2 || px > promEndX + 0.2) return false;
      const zS = getShoreZ(px);
      return pz <= zS - 0.15 && pz >= zS - promW - 0.45;
    },
    getY: () => 1.16,
  });

  // Reserved Future Farming Plot (12-tile Fenced Sunny Garden Plot!)
  const { x: farmX, z: farmZ, plotW, plotD } = FARM_PLOT_SPEC;
  const farmY = getWorldElevation(farmX, farmZ);
  const farmGroup = new THREE.Group();
  farmGroup.position.set(farmX, farmY, farmZ);

  const soilBorderMat = new THREE.MeshStandardMaterial({ color: 0x8f663a, roughness: 0.88 });
  const soilBedMat = new THREE.MeshStandardMaterial({ color: 0x7c5a3c, roughness: 0.96 });
  const cloverMat = new THREE.MeshStandardMaterial({ color: 0x7aa94c, roughness: 0.9 });

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

  const fencePostGeo = new THREE.BoxGeometry(0.09, 0.54, 0.09);
  const sideRailGeo = new THREE.BoxGeometry(0.06, 0.06, plotD + 0.24);
  for (const fx of [-plotW * 0.5 - 0.12, plotW * 0.5 + 0.12]) {
    for (const fz of [-plotD * 0.5 - 0.12, 0, plotD * 0.5 + 0.12]) {
      const fp = new THREE.Mesh(fencePostGeo, darkTimberMat);
      fp.position.set(fx, 0.27, fz);
      fp.castShadow = true;
      farmGroup.add(fp);
    }
    const sideRail = new THREE.Mesh(sideRailGeo, timberMat);
    sideRail.position.set(fx, 0.42, 0);
    farmGroup.add(sideRail);
  }
  const backRail = new THREE.Mesh(new THREE.BoxGeometry(plotW + 0.28, 0.06, 0.06), timberMat);
  backRail.position.set(0, 0.42, -plotD * 0.5 - 0.12);
  farmGroup.add(backRail);

  const tileInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.05, 0.58), cloverMat, 12);
  tileInst.receiveShadow = true;
  const tileDummy = new THREE.Object3D();
  let tIdx = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      tileDummy.position.set(-0.99 + c * 0.66, 0.075, -0.68 + r * 0.68);
      tileDummy.updateMatrix();
      tileInst.setMatrixAt(tIdx++, tileDummy.matrix);
    }
  }
  tileInst.instanceMatrix.needsUpdate = true;
  farmGroup.add(tileInst);

  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 0.78, 7), darkTimberMat);
  signPost.position.set(plotW * 0.5 + 0.22, 0.39, plotD * 0.5 + 0.06);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.05), timberMat);
  signBoard.position.set(plotW * 0.5 + 0.22, 0.68, plotD * 0.5 + 0.06);
  signBoard.rotation.y = -0.22;
  farmGroup.add(signPost, signBoard);
  inlandVisualGroup.add(farmGroup);

  const farmPlotAnchor = new THREE.Vector3(farmX, farmY + 0.4, farmZ + plotD * 0.5 + 0.32);

  // 3 Tiered Wooden Piers (in shoreWaterGroup so underwater pilings refract cleanly!)
  for (const ps of PIER_SPECS) {
    shoreWaterGroup.add(
      buildWoodenPier({
        id: ps.id,
        nameZh: ps.nameZh,
        pierX: ps.pierX,
        pierStartZ: getShoreZ(ps.pierX) + ps.shoreZOffset,
        pierEndZ: ps.pierEndZ,
        pierY: ps.pierY,
        quayY: ps.quayY,
        pierW: ps.pierW,
        timberMat,
        darkTimberMat,
        rng,
        addLanternPost,
        townColliders,
        walkableDecks,
        docks,
        decorations: ps.decorations,
      })
    );
  }

  // =========================================================================
  // 2. NEIGHBOR COTTAGES & STAGGERED HILLSIDE BACK ROW
  // =========================================================================
  for (const vh of VILLAGE_HOUSE_SPECS) {
    const vy = getWorldElevation(vh.x, vh.z);
    const house = createCottage({
      id: vh.id || '',
      nameZh: vh.nameZh || '小镇小屋',
      width: vh.w,
      depth: vh.d,
      wallHeight: vh.h,
      roofHeight: vh.rh,
      floorY: vh.floorY ?? 0.14,
      doorX: vh.doorX ?? null,
      doorW: vh.doorW ?? null,
      doorH: vh.doorH ?? null,
      porchD: vh.porchD ?? 1.22,
      wallMat: wallMats[vh.wallKey] || wallMats.cream,
      roofMat: roofMats[vh.roofKey] || roofMats.red,
      trimMat: timberMat,
      darkTimberMat,
      shutterMat: shutterMats[vh.shutterKey] || shutterMats.teal,
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
      inlandVisualGroup.add(house.group);
      addLandCollider({ x: vh.x, z: vh.z, radius: Math.max(vh.w, vh.d) * 0.56 });

      if (house.chimneyTopLocal && rng() < 0.6) {
        house.group.updateMatrixWorld(true);
        const wp = house.chimneyTopLocal.clone().applyMatrix4(house.group.matrixWorld);
        smokeSources.push(wp);
      }
    }
  }

  // =========================================================================
  // 3. FISH MARKET STALL (GLB HOT-SWAPPABLE) & STEPPING STONES
  // =========================================================================
  const landmarks = {};
  const { x: stallX, z: stallZ, rotY: stallRot } = MARKET_STALL_SPEC;
  const stallY = getWorldElevation(stallX, stallZ);
  const stall = new THREE.Group();

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 0.76), timberMat);
  counter.position.set(0, 0.35, 0);
  counter.castShadow = true;
  counter.receiveShadow = true;
  stall.add(counter);

  const stallPostGeo = new THREE.CylinderGeometry(0.05, 0.055, 2.0, 6);
  for (const px of [-1.25, 1.25]) {
    for (const pz of [-0.36, 0.36]) {
      const p = new THREE.Mesh(stallPostGeo, darkTimberMat);
      p.position.set(px, 1.0, pz);
      stall.add(p);
    }
  }
  const stripeRed = new THREE.MeshStandardMaterial({ color: 0xd14f38, roughness: 0.85 });
  const stripeCream = new THREE.MeshStandardMaterial({ color: 0xf7eedc, roughness: 0.85 });
  const stripGeo = new THREE.BoxGeometry(0.48, 0.06, 1.6);
  for (let s = 0; s < 6; s++) {
    const strip = new THREE.Mesh(stripGeo, s % 2 === 0 ? stripeRed : stripeCream);
    strip.position.set(-1.2 + s * 0.48, 2.06, 0.08);
    strip.rotation.x = 0.22;
    strip.castShadow = true;
    stall.add(strip);
  }
  stall.position.set(stallX, stallY, stallZ);
  stall.rotation.y = stallRot;
  inlandVisualGroup.add(stall);
  landmarks.market_stall = stall;
  addLandCollider({ x: stallX, z: stallZ, radius: MARKET_STALL_SPEC.colliderRadius });
  addLandCollider({ x: MARKET_STALL_SPEC.rackX, z: MARKET_STALL_SPEC.rackZ, radius: MARKET_STALL_SPEC.rackRadius });

  buildInstancedFlagstones({ inlandVisualGroup, cobbleMat, rng });

  for (const [lx, lz] of getLanternPostSpots()) {
    addLanternPost(lx, getWorldElevation(lx, lz), lz, 1.82, false, inlandVisualGroup);
  }

  // =========================================================================
  // 4. 7.8m COASTAL LIGHTHOUSE (GLB HOT-SWAPPABLE)
  // =========================================================================
  const { x: lhX, z: lhZ } = LIGHTHOUSE_SPEC;
  const lhY = getWorldElevation(lhX, lhZ);
  const lighthouse = new THREE.Group();

  const lhPlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.68, 1.6, 14), stoneMat);
  lhPlinth.position.y = -0.3;
  lhPlinth.castShadow = true;
  lhPlinth.receiveShadow = true;
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.16, 1.3, 14), wallMats.cream);
  seg1.position.y = 1.25;
  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.06, 1.2, 14), roofMats.red);
  seg2.position.y = 2.48;
  const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.96, 1.2, 14), wallMats.cream);
  seg3.position.y = 3.65;
  const seg4 = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 1.12, 14), roofMats.red);
  seg4.position.y = 4.78;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 0.92, 0.22, 14), ironMat);
  gallery.position.y = 5.44;
  const beaconGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.96, 12), lanternGlassMat);
  beaconGlass.position.y = 6.02;
  const cupola = new THREE.Mesh(new THREE.ConeGeometry(0.92, 1.0, 14), roofMats.red);
  cupola.position.y = 7.0;

  const beaconPivot = new THREE.Group();
  beaconPivot.name = 'Lighthouse_BeaconPivot';
  beaconPivot.position.y = 6.02;
  const lhLight = new THREE.PointLight(0xffd782, 1.6, 16, 1.5);
  beaconPivot.add(lhLight);
  warmLights.push({ light: lhLight, base: 1.6, essential: false });

  lighthouse.add(lhPlinth, seg1, seg2, seg3, seg4, gallery, beaconGlass, cupola, beaconPivot);
  lighthouse.position.set(lhX, lhY, lhZ);
  inlandVisualGroup.add(lighthouse);
  landmarks.lighthouse = lighthouse;
  addLandCollider({ x: lhX, z: lhZ, radius: LIGHTHOUSE_SPEC.colliderRadius });
  addLandCollider({ x: LIGHTHOUSE_SPEC.shedX, z: LIGHTHOUSE_SPEC.shedZ, radius: LIGHTHOUSE_SPEC.shedColliderRadius });

  // =========================================================================
  // 5. GPU-INSTANCED TREES, FLOWERING BUSHES & CHIMNEY SMOKE
  // =========================================================================
  const houseExclusion = [
    { x: HOME_SPEC.x, z: HOME_SPEC.z, r: 5.2 },
    { x: 4.2, z: -17.5, r: 2.8 },
    { x: farmX, z: farmZ, r: 3.1 },
    { x: -6.8, z: -17.0, r: 2.7 },
    { x: 14.2, z: -14.8, r: 2.6 },
    { x: stallX, z: stallZ, r: 3.2 },
    { x: stallX - 2.2, z: stallZ, r: 2.2 },
    { x: lhX, z: lhZ, r: 4.2 },
    { x: 19.65, z: -14.35, r: 2.4 },
    ...VILLAGE_HOUSE_SPECS.map((h) => ({ x: h.x, z: h.z, r: Math.max(h.w, h.d) * 0.85 + 1.2 })),
  ];

  buildInstancedTreesAndBushes({
    inlandVisualGroup,
    darkTimberMat,
    rng,
    houseExclusion,
    addLandCollider,
  });

  const smokeSystem = buildInstancedSmoke({ inlandVisualGroup, smokeSources, rng });

  // =========================================================================
  // 6. WALKABLE ELEVATION & O(1) SPATIAL-HASHED COLLISION RESOLUTION
  // =========================================================================
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

  function resolveLandCollisions(pos, actorRadius = 0.28, extraCircles = null) {
    for (const b of enterableBuildings) {
      b.resolveCollision(pos, actorRadius);
    }
    const nearby = landColliderGrid.query(pos.x, pos.z, actorRadius + 2.6);
    for (let i = 0; i < nearby.length; i++) {
      const c = nearby[i];
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const minD = c.radius + actorRadius;
      if (d < minD && d > 1e-5) {
        pos.x = c.x + (dx / d) * minD;
        pos.z = c.z + (dz / d) * minD;
      }
    }
    if (extraCircles) {
      for (const c of extraCircles) {
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
  }

  let qualityLevel = 'high';

  return {
    townGroup,
    shoreWaterGroup,
    inlandVisualGroup,
    townColliders,
    docks,
    enterableBuildings,
    playerHome,
    farmPlotAnchor,
    homeViewTarget: new THREE.Vector3(2.8, 1.5, -20.5),
    pierDockSpot: docks[0].boatMoorPos,
    isWalkableDeck,
    isWalkableLand,
    getWalkableElevation,
    resolveLandCollisions,

    setQuality(level = 'high') {
      qualityLevel = level;
      const enableNonEssential = level !== 'low';
      for (const wl of warmLights) {
        if (!wl.essential) {
          wl.light.visible = enableNonEssential;
        }
      }
    },

    attachLandmarkGlb(landmarkId, glbData) {
      const target = landmarks[landmarkId];
      if (!target || !glbData || !glbData.model) return false;
      for (const ch of target.children) {
        if (ch.name === 'Lighthouse_BeaconPivot' || ch.isLight) continue;
        ch.visible = false;
      }
      target.add(glbData.model);
      return true;
    },

    syncHomeAquarium(fishList) {
      if (playerHome && playerHome.aquarium) {
        playerHome.aquarium.syncFishList(fishList);
      }
    },

    attachBuildingGlb(buildingId, glbData) {
      const b = enterableBuildings.find((item) => item.id === buildingId);
      if (!b || !glbData || !glbData.model) return false;

      for (const child of b.group.children) {
        if (child === b.aquarium?.group || child.isLight) continue;
        child.visible = false;
      }

      b.group.add(glbData.model);
      if (glbData.roofNode) {
        b.roofCutawayGroup = glbData.roofNode;
        b.cutawayMaterials = glbData.cutawayMaterials || [];
      }
      if (glbData.doorHinge) {
        b.doorPivot = glbData.doorHinge;
      }

      b.group.updateMatrixWorld(true);
      if (glbData.anchors?.aquarium) {
        const aqPos = new THREE.Vector3();
        glbData.anchors.aquarium.getWorldPosition(aqPos);
        b.worldAnchors.aquarium = aqPos.clone().add(new THREE.Vector3(0, 1.0, 0));
        if (b.aquarium) {
          b.aquarium.group.position.copy(glbData.anchors.aquarium.position);
          let hasBlenderTank = false;
          glbData.model.traverse((obj) => {
            if (/aq_cabinet|aq_waterglow/i.test(obj.name || '')) hasBlenderTank = true;
          });
          if (hasBlenderTank) {
            for (const ch of b.aquarium.group.children) {
              if (ch.name === 'Aquarium_FishLayer' || ch.isLight) continue;
              ch.visible = false;
            }
          }
        }
      }
      if (glbData.anchors?.bed) {
        const bedPos = new THREE.Vector3();
        glbData.anchors.bed.getWorldPosition(bedPos);
        b.worldAnchors.bed = bedPos;
        b.worldAnchors.bedLie = bedPos.clone();
      }
      if (glbData.anchors?.workbench) {
        const wbPos = new THREE.Vector3();
        glbData.anchors.workbench.getWorldPosition(wbPos);
        b.worldAnchors.workbench = wbPos;
      }
      return true;
    },

    update(dt, elapsedTime, nightGlow = 0.25, walkerPos = null) {
      windowMat.emissiveIntensity = 0.3 + nightGlow * 1.45;
      lanternGlassMat.emissiveIntensity = 1.0 + nightGlow * 1.8;
      for (const wl of warmLights) {
        if (!wl.light.visible) continue;
        wl.light.intensity = wl.base * (0.45 + nightGlow * 1.25);
      }

      let activeInsideBuilding = null;
      for (const b of enterableBuildings) {
        const targetDoor = b.isDoorOpen ? 1 : 0;
        b.doorOpenAmount = THREE.MathUtils.lerp(b.doorOpenAmount, targetDoor, clamp(dt * 7.5, 0, 1));
        if (b.doorPivot) {
          b.doorPivot.rotation.y = -b.doorOpenAmount * Math.PI * 0.51;
        }

        const isInside = walkerPos ? b.isPointInside(walkerPos.x, walkerPos.z, 0.04) : false;
        b.playerInside = isInside;
        if (isInside) activeInsideBuilding = b;

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

      smokeSystem.update(elapsedTime);
      beaconPivot.rotation.y = elapsedTime * 0.9;
      return activeInsideBuilding;
    },
  };
}
