import * as THREE from 'three';
import { clamp } from './noise.js';
import { getWorldElevation } from './terrain.js';
import { createWoodPlankTexture } from './textures.js';

/**
 * Computes half-beam width of the cozy wooden rowboat at longitudinal coordinate u ∈ [0, 1]
 * u = 0 is the squared-off stern transom (-1.22), u = 1 is the pointed bow (+1.38)
 */
function boatHalfWidth(u) {
  if (u < 0.48) {
    // Gentle swell from sturdy stern transom (0.44) out to midship beam (0.63)
    const t = u / 0.48;
    return 0.44 + Math.sin(t * Math.PI * 0.5) * 0.19;
  } else {
    // Graceful curve tapering from midship beam (0.63) to crisp rounded bow point
    const t = (u - 0.48) / 0.52;
    return 0.63 * Math.pow(Math.max(0, 1.0 - t), 0.72);
  }
}

/**
 * Computes gunwale sheer elevation along the boat length (slightly upturned bow & stern)
 */
function boatSheerY(u) {
  return 0.34 + Math.pow(u - 0.44, 2) * 0.28 + (u > 0.7 ? (u - 0.7) * 0.16 : 0);
}

/**
 * Builds a clean lofted wooden hull (outer red shell, inner wood wall, bottom keel, transom, gunwale trim)
 */
function buildRowboatHull(woodTex) {
  const hullGroup = new THREE.Group();

  const lengthStart = -1.2;
  const lengthEnd = 1.38;
  const xAt = (u) => lengthStart + u * (lengthEnd - lengthStart);

  const uSteps = 22;
  const vSteps = 10; // cross-section from keel bottom (0) to gunwale top (1)

  const buildShell = ({ inset = 0, flipWinding = false }) => {
    const positions = [];
    const uvs = [];
    const indices = [];

    // Left (-Z) and Right (+Z) hull flanks
    for (const side of [-1, 1]) {
      const baseVertex = positions.length / 3;
      for (let iu = 0; iu <= uSteps; iu++) {
        const u = iu / uSteps;
        const x = xAt(u) - inset * (u > 0.85 ? 0.9 : 0) + inset * (u < 0.05 ? 0.6 : 0);
        const topW = Math.max(0.008, boatHalfWidth(u) - inset);
        const botW = topW * (0.62 - u * 0.34);
        const topY = boatSheerY(u) - inset * 0.1;
        const botY = -0.2 + inset * 0.55 + Math.pow(Math.max(0, u - 0.55), 2) * 0.45;

        for (let iv = 0; iv <= vSteps; iv++) {
          const v = iv / vSteps;
          // Smooth chine curvature from flat bottom up flared side wall
          const curveW = botW + (topW - botW) * Math.pow(v, 0.58);
          const curveY = botY + (topY - botY) * Math.pow(v, 0.85);
          positions.push(x, curveY, side * curveW);
          uvs.push(u * 2.0, v);
        }
      }

      const row = vSteps + 1;
      for (let iu = 0; iu < uSteps; iu++) {
        for (let iv = 0; iv < vSteps; iv++) {
          const a = baseVertex + iu * row + iv;
          const b = baseVertex + (iu + 1) * row + iv;
          const c = baseVertex + (iu + 1) * row + iv + 1;
          const d = baseVertex + iu * row + iv + 1;
          const windRight = side > 0 ? !flipWinding : flipWinding;
          if (windRight) {
            indices.push(a, b, c, a, c, d);
          } else {
            indices.push(a, c, b, a, d, c);
          }
        }
      }
    }

    // Flat bottom keel strip connecting port & starboard lower chines
    const keelBase = positions.length / 3;
    for (let iu = 0; iu <= uSteps; iu++) {
      const u = iu / uSteps;
      const x = xAt(u) - inset * (u > 0.85 ? 0.9 : 0) + inset * (u < 0.05 ? 0.6 : 0);
      const topW = Math.max(0.008, boatHalfWidth(u) - inset);
      const botW = topW * (0.62 - u * 0.34);
      const botY = -0.2 + inset * 0.55 + Math.pow(Math.max(0, u - 0.55), 2) * 0.45;
      positions.push(x, botY, -botW);
      uvs.push(u * 2.0, 0);
      positions.push(x, botY, botW);
      uvs.push(u * 2.0, 1);
    }
    for (let iu = 0; iu < uSteps; iu++) {
      const a = keelBase + iu * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      if (!flipWinding) {
        indices.push(a, c, b, a, d, c);
      } else {
        indices.push(a, b, c, a, c, d);
      }
    }

    // Stern transom board at u = 0
    const sternBase = positions.length / 3;
    const sx = xAt(0) + inset * 0.6;
    const sTopW = Math.max(0.02, boatHalfWidth(0) - inset);
    const sBotW = sTopW * 0.62;
    const sTopY = boatSheerY(0) - inset * 0.1;
    const sBotY = -0.2 + inset * 0.55;
    positions.push(sx, sBotY, -sBotW, sx, sBotY, sBotW, sx, sTopY, sTopW, sx, sTopY, -sTopW);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    if (!flipWinding) {
      indices.push(sternBase, sternBase + 2, sternBase + 1, sternBase, sternBase + 3, sternBase + 2);
    } else {
      indices.push(sternBase, sternBase + 1, sternBase + 2, sternBase, sternBase + 2, sternBase + 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  // Materials matching Stillwater's warm painted boat palette
  const redHullMat = new THREE.MeshStandardMaterial({
    color: 0xc84b34,
    roughness: 0.66,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const creamTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf1e5ce,
    roughness: 0.64,
    metalness: 0.0,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0xdfb170,
    roughness: 0.78,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0xa6733b,
    roughness: 0.82,
    metalness: 0.0,
  });

  // Outer red painted shell + inner honey-wood lining
  const outerHull = new THREE.Mesh(buildShell({ inset: 0.0, flipWinding: false }), redHullMat);
  outerHull.castShadow = true;
  outerHull.receiveShadow = true;
  hullGroup.add(outerHull);

  const innerHull = new THREE.Mesh(buildShell({ inset: 0.068, flipWinding: true }), woodMat);
  innerHull.receiveShadow = true;
  hullGroup.add(innerHull);

  // Thick painted gunwale rim (red outer cap + crisp cream inner accent lip)
  const buildRimTube = (inset, radius, yOffset) => {
    const pts = [];
    // Stern port -> bow -> stern starboard -> stern port
    for (let i = 0; i <= uSteps; i++) {
      const u = i / uSteps;
      pts.push(new THREE.Vector3(xAt(u), boatSheerY(u) + yOffset, -Math.max(0.01, boatHalfWidth(u) - inset)));
    }
    for (let i = uSteps - 1; i >= 0; i--) {
      const u = i / uSteps;
      pts.push(new THREE.Vector3(xAt(u), boatSheerY(u) + yOffset, Math.max(0.01, boatHalfWidth(u) - inset)));
    }
    pts.push(pts[0].clone());
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
    return new THREE.TubeGeometry(curve, 68, radius, 8, false);
  };

  const redGunwale = new THREE.Mesh(buildRimTube(0.012, 0.044, 0.012), redHullMat);
  redGunwale.castShadow = true;
  hullGroup.add(redGunwale);

  const creamTrim = new THREE.Mesh(buildRimTube(0.056, 0.025, 0.016), creamTrimMat);
  hullGroup.add(creamTrim);

  // Wooden slatted deck floorboards inside the hull
  const floorMat = woodMat;
  for (let i = -2; i <= 2; i++) {
    const zOff = i * 0.145;
    const len = 1.88 - Math.abs(i) * 0.18;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.036, 0.125), floorMat);
    plank.position.set(-0.12 + (2 - Math.abs(i)) * 0.05, -0.05, zOff);
    plank.receiveShadow = true;
    hullGroup.add(plank);
  }

  // Transverse wooden benches (stern, center angler seat, forward bow seat)
  const benchSpecs = [
    { u: 0.09, depth: 0.34, y: 0.21 },
    { u: 0.44, depth: 0.34, y: 0.22 },
    { u: 0.77, depth: 0.3, y: 0.24 },
  ];
  for (const b of benchSpecs) {
    const x = xAt(b.u);
    const w = (boatHalfWidth(b.u) - 0.065) * 2.0;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(b.depth, 0.052, w), woodMat);
    bench.position.set(x, b.y, 0);
    bench.castShadow = true;
    bench.receiveShadow = true;
    hullGroup.add(bench);
  }

  // Cozy triangular wooden bow foredeck
  const bowShape = new THREE.Shape();
  bowShape.moveTo(xAt(0.82), -boatHalfWidth(0.82) + 0.05);
  bowShape.quadraticCurveTo(xAt(0.92), -boatHalfWidth(0.92) + 0.03, xAt(0.99), 0);
  bowShape.quadraticCurveTo(xAt(0.92), boatHalfWidth(0.92) - 0.03, xAt(0.82), boatHalfWidth(0.82) - 0.05);
  bowShape.closePath();
  const bowGeo = new THREE.ExtrudeGeometry(bowShape, { depth: 0.04, bevelEnabled: false });
  bowGeo.rotateX(Math.PI / 2);
  const bowDeck = new THREE.Mesh(bowGeo, darkWoodMat);
  bowDeck.position.y = boatSheerY(0.9) - 0.02;
  bowDeck.receiveShadow = true;
  hullGroup.add(bowDeck);

  // Subtle internal curved wooden hull ribs
  for (const ru of [0.24, 0.34, 0.56, 0.67]) {
    const rx = xAt(ru);
    const rw = boatHalfWidth(ru) - 0.085;
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.28, 0.04), darkWoodMat);
      rib.position.set(rx, 0.12, side * (rw - 0.02));
      rib.rotation.x = side * 0.24;
      hullGroup.add(rib);
    }
  }

  // Charming glowing bow lantern sitting on the foredeck
  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(1.13, 0.45, 0.0);
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x3f3328, roughness: 0.45, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffe482,
    emissive: 0xffb938,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });

  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.04, 8), bronzeMat);
  const lGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.062, 0.14, 8), glassMat);
  lGlass.position.y = 0.09;
  const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.075, 8), bronzeMat);
  lCap.position.y = 0.195;
  const lRing = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 10), bronzeMat);
  lRing.position.y = 0.245;
  lanternGroup.add(lBase, lGlass, lCap, lRing);

  const lanternLight = new THREE.PointLight(0xffcb66, 0.85, 3.4, 2.0);
  lanternLight.position.set(0, 0.12, 0);
  lanternGroup.add(lanternLight);
  hullGroup.add(lanternGroup);

  // Resting bamboo fishing rod along starboard rail (ready for future fishing gameplay!)
  const rodGroup = new THREE.Group();
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x9b6e3c, roughness: 0.65 });
  const rodShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.022, 1.85, 7), rodMat);
  rodShaft.rotation.z = Math.PI / 2 - 0.14;
  rodShaft.rotation.y = -0.18;
  rodShaft.position.set(0.32, 0.43, 0.42);
  rodShaft.castShadow = true;
  rodGroup.add(rodShaft);

  // Tiny brass reel
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 10), bronzeMat);
  reel.rotation.x = Math.PI / 2;
  reel.position.set(-0.34, 0.34, 0.52);
  rodGroup.add(reel);
  hullGroup.add(rodGroup);

  return { hullGroup, lanternLight, restingRod: rodGroup };
}

/**
 * Builds the cozy stylized angler character wearing a wide woven straw hat & blue shirt/overalls
 */
function buildAngler(strawTex) {
  const angler = new THREE.Group();

  const denimMat = new THREE.MeshStandardMaterial({ color: 0x3f678c, roughness: 0.82 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xe6d6bc, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b992, roughness: 0.72 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x4f3524, roughness: 0.85 });
  const hatMat = new THREE.MeshStandardMaterial({
    map: strawTex,
    color: 0xf5df8e,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x925a2b, roughness: 0.78 });

  // Seated legs & boots extending slightly forward
  const thighGeo = new THREE.CapsuleGeometry(0.088, 0.24, 6, 10);
  const thighL = new THREE.Mesh(thighGeo, denimMat);
  thighL.rotation.z = Math.PI / 2 + 0.15;
  thighL.position.set(0.14, 0.05, -0.11);
  const thighR = thighL.clone();
  thighR.position.z = 0.11;

  const shinGeo = new THREE.CapsuleGeometry(0.072, 0.2, 6, 8);
  const shinL = new THREE.Mesh(shinGeo, denimMat);
  shinL.position.set(0.28, -0.09, -0.11);
  shinL.rotation.z = -0.18;
  const shinR = shinL.clone();
  shinR.position.z = 0.11;

  const bootGeo = new THREE.BoxGeometry(0.16, 0.09, 0.1);
  const bootL = new THREE.Mesh(bootGeo, bootMat);
  bootL.position.set(0.34, -0.21, -0.11);
  const bootR = bootL.clone();
  bootR.position.z = 0.11;

  angler.add(thighL, thighR, shinL, shinR, bootL, bootR);

  // Upper body pivot (leans back and forth while rowing!)
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.08, 0);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.175, 0.26, 6, 12), denimMat);
  torso.scale.set(0.92, 1.0, 1.08);
  torso.position.set(0, 0.22, 0);
  torso.castShadow = true;
  upperBody.add(torso);

  // Cream collar/shoulders accent
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.185, 10, 8), shirtMat);
  shoulders.scale.set(0.82, 0.45, 1.12);
  shoulders.position.set(0, 0.36, 0);
  upperBody.add(shoulders);

  // Arms reaching gently down/out toward oar handles
  const armGeo = new THREE.CapsuleGeometry(0.058, 0.26, 6, 8);
  const handGeo = new THREE.SphereGeometry(0.055, 8, 6);

  const armL = new THREE.Group();
  armL.position.set(0.04, 0.34, -0.2);
  const armLMesh = new THREE.Mesh(armGeo, shirtMat);
  armLMesh.position.set(0.11, -0.11, -0.05);
  armLMesh.rotation.set(0.22, 0, 0.85);
  armLMesh.castShadow = true;
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.set(0.23, -0.2, -0.09);
  armL.add(armLMesh, handL);

  const armR = new THREE.Group();
  armR.position.set(0.04, 0.34, 0.2);
  const armRMesh = new THREE.Mesh(armGeo, shirtMat);
  armRMesh.position.set(0.11, -0.11, 0.05);
  armRMesh.rotation.set(-0.22, 0, 0.85);
  armRMesh.castShadow = true;
  const handR = new THREE.Mesh(handGeo, skinMat);
  handR.position.set(0.23, -0.2, 0.09);
  armR.add(armRMesh, handR);

  upperBody.add(armL, armR);

  // Head & iconic oversized painterly straw hat
  const headGroup = new THREE.Group();
  headGroup.position.set(0.02, 0.51, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Gently wavy wide straw hat brim
  const brimGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.026, 28, 1, false);
  const bPos = brimGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const vx = bPos.getX(i);
    const vy = bPos.getY(i);
    const vz = bPos.getZ(i);
    const r = Math.hypot(vx, vz);
    const a = Math.atan2(vz, vx);
    // Cozy subtle flop/droop around outer brim edge
    const droop = Math.pow(r / 0.44, 2) * (-0.055 + Math.sin(a * 2.0 + 0.4) * 0.022);
    bPos.setY(i, vy + droop);
  }
  brimGeo.computeVertexNormals();
  const brim = new THREE.Mesh(brimGeo, hatMat);
  brim.position.y = 0.09;
  brim.castShadow = true;
  brim.receiveShadow = true;

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.215, 0.16, 18), hatMat);
  crown.position.y = 0.165;
  crown.castShadow = true;

  const crownTop = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 8), hatMat);
  crownTop.scale.set(1, 0.35, 1);
  crownTop.position.y = 0.238;

  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.218, 0.044, 18), bandMat);
  hatBand.position.y = 0.112;

  const hatGroup = new THREE.Group();
  hatGroup.rotation.z = -0.08; // jaunty slight tilt
  hatGroup.add(brim, crown, crownTop, hatBand);
  headGroup.add(hatGroup);

  upperBody.add(headGroup);
  angler.add(upperBody);

  return { angler, upperBody, headGroup, armL, armR };
}

/**
 * Builds a single wooden oar with cream blade & warm painted tip
 * Pivot sits at the oarlock (origin): handle extends inward (-side), blade extends outward (+side)
 */
function buildOar(side) {
  const oarPivot = new THREE.Group();

  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd4a45e, roughness: 0.72 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xebd39a, roughness: 0.7 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xc9553b, roughness: 0.72 });

  // Oarlock brass bracket at pivot
  const brassMat = new THREE.MeshStandardMaterial({ color: 0x8f7141, roughness: 0.45, metalness: 0.5 });
  const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), brassMat);
  oarPivot.add(lock);

  // Main shaft extending along Z * side (graceful compact proportions)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.56, 8), shaftMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = side * 0.44;
  shaft.castShadow = true;
  oarPivot.add(shaft);

  // Flared paddle blade near outer end
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.02, 0.46), bladeMat);
  blade.position.z = side * 1.18;
  blade.castShadow = true;
  oarPivot.add(blade);

  // Painted coral-red stripe at paddle tip
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.022, 0.12), tipMat);
  tip.position.z = side * 1.36;
  oarPivot.add(tip);

  return oarPivot;
}

/**
 * Creates the playable wooden rowboat, animated oars, seat mount for the unified PlayerAvatar,
 * and rowing / moored-idle physics controller!
 */
export function createPlayableBoat(scene, playerAvatar = null, initialPose = null) {
  const woodTex = createWoodPlankTexture();

  const boatRoot = new THREE.Group();
  const boatVisual = new THREE.Group();
  boatRoot.add(boatVisual);

  const { hullGroup, lanternLight, restingRod } = buildRowboatHull(woodTex);
  boatVisual.add(hullGroup);

  // Standardized seat mount: rotates standard +Z character forward to align with boat +X bow!
  const seatMount = new THREE.Group();
  seatMount.position.set(-0.1, 0.07, 0);
  seatMount.rotation.y = Math.PI / 2;
  boatVisual.add(seatMount);

  if (playerAvatar) {
    seatMount.add(playerAvatar.root);
    playerAvatar.root.position.set(0, 0, 0);
    playerAvatar.root.rotation.set(0, 0, 0);
  }

  // Port (-Z) and Starboard (+Z) oars mounted on gunwale oarlocks
  const oarLeft = buildOar(-1);
  oarLeft.position.set(0.08, 0.39, -0.61);
  const oarRight = buildOar(1);
  oarRight.position.set(0.08, 0.39, 0.61);
  boatVisual.add(oarLeft, oarRight);

  const state = {
    pos: new THREE.Vector3(initialPose?.x ?? -1.15, 0, initialPose?.z ?? 0.85),
    yaw: initialPose?.yaw ?? 0.42,
    speed: 0,
    angVel: 0,
    rowPhase: 0.4,
    rowEffort: 0,
    occupied: true,
    fishingActive: false,
    moorTargetPos: null,
    moorTargetYaw: null,
  };

  boatRoot.scale.setScalar(0.88);
  boatRoot.position.copy(state.pos);
  boatRoot.rotation.y = state.yaw;
  scene.add(boatRoot);

  // Keyboard input state (WASD + Arrow keys)
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  const onKey = (down) => (e) => {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') keys.forward = down;
    if (code === 'KeyS' || code === 'ArrowDown') keys.backward = down;
    if (code === 'KeyA' || code === 'ArrowLeft') keys.left = down;
    if (code === 'KeyD' || code === 'ArrowRight') keys.right = down;
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  let wasRowing = false;
  let leftInWater = false;
  let rightInWater = false;
  let leftDragTimer = 0;
  let rightDragTimer = 0;
  const oarTipWorld = new THREE.Vector3();

  return {
    root: boatRoot,
    seatMount,
    state,

    setOccupied(occupied) {
      state.occupied = Boolean(occupied);
      if (occupied) {
        state.moorTargetPos = null;
        state.moorTargetYaw = null;
      } else {
        state.speed = 0;
        state.angVel = 0;
        wasRowing = false;
      }
    },

    setFishingActive(active) {
      state.fishingActive = Boolean(active);
      if (restingRod) restingRod.visible = !active;
    },

    moorAt(pos, yaw) {
      state.moorTargetPos = pos.clone();
      state.moorTargetYaw = yaw;
      state.speed = 0;
      state.angVel = 0;
    },

    clearKeys() {
      keys.forward = keys.backward = keys.left = keys.right = false;
    },

    update(dt, elapsedTime, colliders, addRipple, nightGlow = 0.25, controlsEnabled = true) {
      const clampedDt = Math.min(dt, 0.05);

      const canRow = state.occupied && controlsEnabled && !state.fishingActive;
      const throttle = canRow ? (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0) : 0;
      const steer = canRow ? (keys.left ? 1 : 0) - (keys.right ? 1 : 0) : 0;
      const activeInput = Math.abs(throttle) > 0 || Math.abs(steer) > 0;

      if (!state.occupied && state.moorTargetPos) {
        // Gently nestle moored boat right alongside the wooden dock
        state.pos.x = THREE.MathUtils.lerp(state.pos.x, state.moorTargetPos.x, clamp(clampedDt * 3.8, 0, 1));
        state.pos.z = THREE.MathUtils.lerp(state.pos.z, state.moorTargetPos.z, clamp(clampedDt * 3.8, 0, 1));
        if (state.moorTargetYaw !== null) {
          let diff = state.moorTargetYaw - state.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          state.yaw += diff * clamp(clampedDt * 3.8, 0, 1);
        }
        state.speed *= Math.exp(-4.0 * clampedDt);
        state.angVel *= Math.exp(-4.0 * clampedDt);
      } else {
        // Gentle rhythmic rowing acceleration with natural stroke surge & cozy water drag
        const pullBoost = activeInput && Math.cos(state.rowPhase) < 0.15 ? 1.24 : 0.88;
        const accel = (throttle > 0 ? 4.8 : throttle < 0 ? 3.1 : 0) * pullBoost;
        state.speed += throttle * accel * clampedDt;
        state.speed *= Math.exp(-1.52 * clampedDt);
        state.speed = clamp(state.speed, -2.0, 4.1);

        const turnRate = 2.15;
        state.angVel += steer * turnRate * clampedDt * 2.9;
        state.angVel *= Math.exp(-3.4 * clampedDt);
        state.yaw += state.angVel * clampedDt;

        const fwdX = Math.cos(state.yaw);
        const fwdZ = -Math.sin(state.yaw);
        state.pos.x += fwdX * state.speed * clampedDt;
        state.pos.z += fwdZ * state.speed * clampedDt;

        // Keep inside expanded playable lagoon bounds (radius 44)
        const distFromOrigin = Math.hypot(state.pos.x, state.pos.z);
        if (distFromOrigin > 44.0) {
          const nx = state.pos.x / distFromOrigin;
          const nz = state.pos.z / distFromOrigin;
          state.pos.x = nx * 44.0;
          state.pos.z = nz * 44.0;
          state.speed *= 0.85;
        }

        // Smooth coastline & sandy beach collision via terrain elevation gradient
        const elev = getWorldElevation(state.pos.x, state.pos.z);
        if (elev > -0.34) {
          const eps = 0.35;
          const gx = getWorldElevation(state.pos.x + eps, state.pos.z) - getWorldElevation(state.pos.x - eps, state.pos.z);
          const gz = getWorldElevation(state.pos.x, state.pos.z + eps) - getWorldElevation(state.pos.x, state.pos.z - eps);
          const gLen = Math.hypot(gx, gz) || 1;
          const push = (elev + 0.34) * 1.15 + 0.04;
          state.pos.x -= (gx / gLen) * push;
          state.pos.z -= (gz / gLen) * push;
          state.speed *= 0.62;
        }

        // Soft bouncy collision against emergent mossy islets & wooden town pier pilings
        for (const c of colliders) {
          const dx = state.pos.x - c.x;
          const dz = state.pos.z - c.z;
          const d = Math.hypot(dx, dz);
          const minDist = c.radius + 0.88;
          if (d < minDist && d > 0.001) {
            const nx = dx / d;
            const nz = dz / d;
            state.pos.x = c.x + nx * minDist;
            state.pos.z = c.z + nz * minDist;
            state.speed *= 0.65;
          }
        }
      }

      const fwdX = Math.cos(state.yaw);
      const fwdZ = -Math.sin(state.yaw);

      // Buoyant bobbing, gentle roll & pitch
      const bobY =
        Math.sin(elapsedTime * 1.65 + state.pos.x * 0.3) * 0.026 +
        Math.cos(elapsedTime * 1.2 + state.pos.z * 0.3) * 0.016;
      boatRoot.position.set(state.pos.x, bobY, state.pos.z);
      boatRoot.rotation.y = state.yaw;

      const targetRoll = -state.angVel * 0.055 + Math.sin(elapsedTime * 1.35) * 0.022;
      const targetPitch = -state.speed * 0.016 + Math.cos(elapsedTime * 1.55) * 0.018;
      boatVisual.rotation.x = THREE.MathUtils.lerp(boatVisual.rotation.x, targetRoll, clampedDt * 5);
      boatVisual.rotation.z = THREE.MathUtils.lerp(boatVisual.rotation.z, targetPitch, clampedDt * 5);

      lanternLight.intensity =
        0.65 +
        nightGlow * 1.25 +
        Math.sin(elapsedTime * 4.5) * 0.08 +
        Math.cos(elapsedTime * 7.3) * 0.05;

      // Zero-Delay Rowing Stroke Kinematics
      const strokeDir = throttle < 0 ? -1 : 1;
      if (activeInput && !wasRowing) {
        state.rowEffort = Math.max(state.rowEffort, 0.85);
        state.rowPhase = strokeDir > 0 ? 1.95 : -1.95;
        leftInWater = false;
        rightInWater = false;
        leftDragTimer = 0;
        rightDragTimer = 0;
      }
      wasRowing = activeInput;

      const targetEffort = activeInput ? 1.0 : 0.0;
      state.rowEffort = THREE.MathUtils.lerp(
        state.rowEffort,
        targetEffort,
        clamp(clampedDt * (activeInput ? 12.0 : 4.2), 0, 1)
      );

      const strokeSpeed = activeInput ? 4.8 * strokeDir : 0.65;
      state.rowPhase += strokeSpeed * clampedDt;

      const leftPower = clamp(state.rowEffort * (1.0 - steer * 0.48), 0, 1);
      const rightPower = clamp(state.rowEffort * (1.0 + steer * 0.48), 0, 1);

      // Rest oars neatly angled back when unoccupied or fishing!
      if (!state.occupied || state.fishingActive) {
        oarLeft.rotation.y = THREE.MathUtils.lerp(oarLeft.rotation.y, -0.78, clampedDt * 5);
        oarLeft.rotation.x = THREE.MathUtils.lerp(oarLeft.rotation.x, 0.06, clampedDt * 5);
        oarRight.rotation.y = THREE.MathUtils.lerp(oarRight.rotation.y, 0.78, clampedDt * 5);
        oarRight.rotation.x = THREE.MathUtils.lerp(oarRight.rotation.x, -0.06, clampedDt * 5);
      } else {
        const sweepL = Math.sin(state.rowPhase) * 0.58 * leftPower + Math.sin(elapsedTime * 1.2) * 0.035;
        const dipL = -0.25 + Math.cos(state.rowPhase) * 0.17 * leftPower;
        oarLeft.rotation.y = -0.22 + sweepL;
        oarLeft.rotation.x = -dipL;

        const sweepR = Math.sin(state.rowPhase) * 0.58 * rightPower + Math.sin(elapsedTime * 1.2 + 0.5) * 0.035;
        const dipR = -0.25 + Math.cos(state.rowPhase) * 0.17 * rightPower;
        oarRight.rotation.y = 0.22 - sweepR;
        oarRight.rotation.x = dipR;
      }

      boatRoot.updateMatrixWorld(true);

      // Drive seated rowing pose on the unified PlayerAvatar when occupying boat & not casting
      if (playerAvatar && state.occupied && !state.fishingActive && controlsEnabled) {
        playerAvatar.updateAnimation('Sit_Row', clampedDt, elapsedTime, {
          rowPhase: state.rowPhase,
          rowEffort: state.rowEffort,
          steer,
          leftPower,
          rightPower,
        });
      }

      // Instant Organic Oar Blade Eddies
      if (addRipple && state.occupied && !state.fishingActive) {
        const cosPhase = Math.cos(state.rowPhase);

        const leftNowInWater = leftPower > 0.22 && cosPhase < 0.22;
        if (leftNowInWater) {
          leftDragTimer -= clampedDt;
          if (!leftInWater) {
            oarTipWorld.set(0, 0, -1.26);
            oarLeft.localToWorld(oarTipWorld);
            addRipple({
              x: oarTipWorld.x,
              z: oarTipWorld.z,
              dirX: -fwdX,
              dirZ: -fwdZ,
              mode: 0,
              radiusScale: 0.62,
              intensity: 0.85,
            });
            leftDragTimer = 0.15;
          } else if (leftDragTimer <= 0) {
            oarTipWorld.set(0, 0, -1.26);
            oarLeft.localToWorld(oarTipWorld);
            addRipple({
              x: oarTipWorld.x,
              z: oarTipWorld.z,
              dirX: -fwdX,
              dirZ: -fwdZ,
              mode: 0,
              radiusScale: 0.46,
              intensity: 0.64,
            });
            leftDragTimer = 0.16;
          }
        }
        leftInWater = leftNowInWater;

        const rightNowInWater = rightPower > 0.22 && cosPhase < 0.22;
        if (rightNowInWater) {
          rightDragTimer -= clampedDt;
          if (!rightInWater) {
            oarTipWorld.set(0, 0, 1.26);
            oarRight.localToWorld(oarTipWorld);
            addRipple({
              x: oarTipWorld.x,
              z: oarTipWorld.z,
              dirX: -fwdX,
              dirZ: -fwdZ,
              mode: 0,
              radiusScale: 0.62,
              intensity: 0.85,
            });
            rightDragTimer = 0.15;
          } else if (rightDragTimer <= 0) {
            oarTipWorld.set(0, 0, 1.26);
            oarRight.localToWorld(oarTipWorld);
            addRipple({
              x: oarTipWorld.x,
              z: oarTipWorld.z,
              dirX: -fwdX,
              dirZ: -fwdZ,
              mode: 0,
              radiusScale: 0.46,
              intensity: 0.64,
            });
            rightDragTimer = 0.16;
          }
        }
        rightInWater = rightNowInWater;
      }
    },
  };
}
