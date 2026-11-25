import * as THREE from 'three';
import { clamp } from './noise.js';
import { createStrawHatTexture } from './textures.js';

const ROD_COLORS = {
  rod_bamboo: 0xd4a45e,
  rod_maple: 0xc86b3a,
  rod_ocean: 0x26698e,
  rod_starlight: 0x3b9d8f,
};

/**
 * Unified Stylized Angler Character Avatar & Procedural Action Pack.
 * Coordinates follow our Blender .glb standard:
 *   +Y Up | +Z Forward | Origin (0,0,0) at bottom of boots | Total height ~1.22m
 *
 * Actions supported:
 *   Idle | Walk | Run | Sit_Row | Board_Boat | Fish_Aim | Fish_Cast | Fish_Idle | Fish_Reel | Fish_Catch | Interact
 *
 * Ready for future hot-swap with Codex's Blender `public/assets/models/characters/player.glb`
 * via AnimationMixer using the exact same action names!
 */
export function createPlayerAvatar() {
  const strawTex = createStrawHatTexture();
  const root = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  // Materials matching Codex's approved player turnaround palette!
  const denimMat = new THREE.MeshStandardMaterial({ color: 0x3f678c, roughness: 0.84 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0x5c7f9e, roughness: 0.86 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.82 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0be96, roughness: 0.74 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xe89074, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x7a4927, roughness: 0.86 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x5b3b24, roughness: 0.86 });
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xebb144, roughness: 0.65 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.4 });
  const hatMat = new THREE.MeshStandardMaterial({
    map: strawTex,
    color: 0xf5df8e,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x6f4324, roughness: 0.82 });

  // Pelvis sits at y = 0.44 when standing (boots touch y = 0)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.44, 0);
  bodyRoot.add(pelvis);

  // ---- Articulated Legs (Hip -> Thigh -> Knee -> Shin -> Cuff -> Boot) ----
  const buildLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, 0, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.14, 6, 10), denimMat);
    thigh.position.set(0, -0.1, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.2, 0);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.11, 5, 8), denimMat);
    shin.position.set(0, -0.075, 0);
    shin.castShadow = true;
    knee.add(shin);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.08, 0.055, 10), cuffMat);
    cuff.position.set(0, -0.135, 0);
    knee.add(cuff);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.095, 0.175), bootMat);
    boot.position.set(0, -0.195, 0.032);
    boot.castShadow = true;
    knee.add(boot);

    hip.add(knee);
    return { hip, knee };
  };

  const legL = buildLeg(-1);
  const legR = buildLeg(1);
  pelvis.add(legL.hip, legR.hip);

  // ---- Upper Body & Overalls ----
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.03, 0);
  pelvis.add(upperBody);

  // Cream long-sleeve undershirt torso
  const shirtTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.22, 6, 12), shirtMat);
  shirtTorso.scale.set(1.06, 1.0, 0.88);
  shirtTorso.position.set(0, 0.2, 0);
  shirtTorso.castShadow = true;
  upperBody.add(shirtTorso);

  // Denim overalls bib + waist + front pocket + two yellow buttons
  const overallLower = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.168, 0.18, 12), denimMat);
  overallLower.scale.set(1.06, 1.0, 0.9);
  overallLower.position.set(0, 0.08, 0);
  overallLower.castShadow = true;
  upperBody.add(overallLower);

  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.18, 0.06), denimMat);
  bib.position.set(0, 0.24, 0.12);
  upperBody.add(bib);

  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.025), cuffMat);
  pocket.position.set(0, 0.21, 0.155);
  upperBody.add(pocket);

  for (const sx of [-0.075, 0.075]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.16, 0.27), denimMat);
    strap.position.set(sx, 0.31, 0);
    upperBody.add(strap);

    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.015, 8), buttonMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(sx, 0.3, 0.155);
    upperBody.add(btn);
  }

  // ---- Articulated Arms ----
  const buildArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.205, 0.33, 0);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.2, 5, 8), shirtMat);
    sleeve.position.set(side * 0.02, -0.12, 0);
    sleeve.castShadow = true;
    shoulder.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.054, 8, 6), skinMat);
    hand.position.set(side * 0.025, -0.25, 0.01);
    hand.castShadow = true;
    shoulder.add(hand);

    return { shoulder, hand };
  };

  const armL = buildArm(-1);
  const armR = buildArm(1);
  upperBody.add(armL.shoulder, armR.shoulder);

  // ---- Hand-held Fishing Rod (mounted in right hand, visible during Fish_* actions!) ----
  const rodGroup = new THREE.Group();
  rodGroup.position.set(0.025, -0.25, 0.03);
  rodGroup.visible = false;

  const rodMat = new THREE.MeshStandardMaterial({ color: ROD_COLORS.rod_bamboo, roughness: 0.68 });
  const rodHandleMat = new THREE.MeshStandardMaterial({ color: 0x7d532b, roughness: 0.85 });
  const rodShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.022, 1.95, 7), rodMat);
  rodShaft.rotation.x = Math.PI / 2;
  rodShaft.position.set(0, 0.02, 0.92);
  rodShaft.castShadow = true;
  const rodGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.026, 0.32, 7), rodHandleMat);
  rodGrip.rotation.x = Math.PI / 2;
  rodGrip.position.set(0, 0.02, 0.06);
  const rodReel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.036, 10),
    new THREE.MeshStandardMaterial({ color: 0xd9a84b, roughness: 0.45, metalness: 0.45 })
  );
  rodReel.rotation.z = Math.PI / 2;
  rodReel.position.set(0.035, -0.02, 0.24);
  const rodTipAnchor = new THREE.Object3D();
  rodTipAnchor.position.set(0, 0.02, 1.9);
  rodGroup.add(rodShaft, rodGrip, rodReel, rodTipAnchor);
  armR.shoulder.add(rodGroup);

  // ---- Head, Hair, Cute Face & Iconic Woven Straw Hat ----
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.46, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), skinMat);
  head.position.y = 0.07;
  head.castShadow = true;
  headGroup.add(head);

  // Fluffy brown hair tufts framing the face under the hat
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.184, 12, 10), hairMat);
  hairBack.position.set(0, 0.095, -0.035);
  headGroup.add(hairBack);
  for (const [hx, hy, hz, hr] of [
    [-0.12, 0.13, 0.08, 0.068],
    [0.12, 0.13, 0.08, 0.068],
    [0.0, 0.16, 0.13, 0.065],
    [-0.065, 0.15, 0.12, 0.056],
    [0.065, 0.15, 0.12, 0.056],
  ]) {
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(hr, 8, 6), hairMat);
    tuft.position.set(hx, hy, hz);
    headGroup.add(tuft);
  }

  // Warm eyes & rosy cheeks facing +Z
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat);
    eye.position.set(sx * 0.062, 0.075, 0.162);
    headGroup.add(eye);

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.028, 7, 5), cheekMat);
    cheek.scale.set(1.2, 0.7, 0.4);
    cheek.position.set(sx * 0.105, 0.038, 0.145);
    headGroup.add(cheek);
  }

  // Gently wavy wide straw hat brim + crown + dark brown ribbon band
  const brimGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.026, 28, 1, false);
  const bPos = brimGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const vx = bPos.getX(i);
    const vy = bPos.getY(i);
    const vz = bPos.getZ(i);
    const r = Math.hypot(vx, vz);
    const a = Math.atan2(vz, vx);
    const droop = Math.pow(r / 0.44, 2) * (-0.058 + Math.sin(a * 2.0 + 0.4) * 0.022);
    bPos.setY(i, vy + droop);
  }
  brimGeo.computeVertexNormals();
  const brim = new THREE.Mesh(brimGeo, hatMat);
  brim.position.y = 0.175;
  brim.castShadow = true;
  brim.receiveShadow = true;

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.165, 18), hatMat);
  crown.position.y = 0.255;
  crown.castShadow = true;

  const crownTop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8), hatMat);
  crownTop.scale.set(1, 0.36, 1);
  crownTop.position.y = 0.33;

  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.224, 0.046, 18), bandMat);
  hatBand.position.y = 0.198;

  const hatGroup = new THREE.Group();
  hatGroup.rotation.x = -0.05;
  hatGroup.add(brim, crown, crownTop, hatBand);
  headGroup.add(hatGroup);

  upperBody.add(headGroup);

  // Animation state
  let walkCycle = 0;
  let interactTimer = 0;
  let currentAction = 'Idle';
  let glbAdapter = null;
  const glbWrap = new THREE.Group();
  root.add(glbWrap);
  const tipWorld = new THREE.Vector3();

  function attachGlb(adapter) {
    if (!adapter || !adapter.model) return;
    glbAdapter = adapter;
    bodyRoot.visible = false;
    glbWrap.clear();
    glbWrap.add(adapter.model);
    // Keep hand-held fishing rod visible beside character when fishing if GLB has no built-in rod
    rodGroup.position.set(0.24, 0.72, 0.14);
    glbWrap.add(rodGroup);
  }

  function setRodStyle(rodId) {
    rodMat.color.setHex(ROD_COLORS[rodId] || ROD_COLORS.rod_bamboo);
  }

  function triggerInteractPulse() {
    interactTimer = 0.36;
  }

  /**
   * Drives the character rig for any action in the Action Pack.
   * Automatically routes to Blender AnimationMixer when `player.glb` is attached!
   */
  function updateAnimation(action, dt, elapsedTime, params = {}) {
    currentAction = action;
    const clampedDt = Math.min(dt, 0.05);

    if (glbAdapter) {
      glbAdapter.playAction(action);
      glbAdapter.update(clampedDt);

      // Gentle procedural root polish for non-baked poses (bed sleep, walk bounce, boat seat)
      const isSleep = action === 'Sleep_Bed';
      const isMove = action === 'Walk' || action === 'Run';
      const isFish = action.startsWith('Fish_');
      const k = clamp(clampedDt * 12.0, 0, 1);
      glbWrap.rotation.x = THREE.MathUtils.lerp(glbWrap.rotation.x, isSleep ? Math.PI * 0.5 : 0, k);
      const bounce = !glbAdapter.hasAnimations && isMove ? Math.abs(Math.sin(elapsedTime * 10.0)) * 0.045 : 0;
      const seatOff = action === 'Sit_Row' ? -0.14 : 0;
      glbWrap.position.y = THREE.MathUtils.lerp(glbWrap.position.y, bounce + seatOff, k);
      rodGroup.visible = isFish;
      if (isFish) {
        const pitch = action === 'Fish_Aim' ? -0.65 : action === 'Fish_Reel' ? -0.45 : -0.18;
        rodGroup.rotation.x = THREE.MathUtils.lerp(rodGroup.rotation.x, pitch, k);
      }
      return;
    }

    const k = clamp(clampedDt * 12.0, 0, 1);

    interactTimer = Math.max(0, interactTimer - clampedDt);

    let targetPelvisY = 0.44;
    let targetBodyY = 0;
    let targetBodyPitch = 0;
    let targetTorsoX = 0;
    let targetTorsoY = 0;
    let targetHeadY = 0;
    let targetHeadX = 0;

    let legLX = 0, kneeLX = 0;
    let legRX = 0, kneeRX = 0;
    let armLX = 0, armLZ = 0.12;
    let armRX = 0, armRZ = -0.12;
    let showRod = false;
    let rodPitch = -0.25;

    if (action === 'Sleep_Bed') {
      // Cozy horizontal lying pose on the wooden bed, head resting on white pillow, gentle breathing!
      const breathe = Math.sin(elapsedTime * 1.9);
      targetPelvisY = 0.44;
      targetBodyY = 0.08 + breathe * 0.014;
      targetBodyPitch = Math.PI * 0.5; // lie flat back-down facing the ceiling!
      targetHeadY = Math.sin(elapsedTime * 0.7) * 0.08;
      targetHeadX = 0.12;
      legLX = 0.06;
      legRX = -0.04;
      kneeLX = 0.08;
      kneeRX = 0.12;
      armLX = -0.35 + breathe * 0.04;
      armLZ = 0.22;
      armRX = -0.28 - breathe * 0.04;
      armRZ = -0.22;
    } else if (action === 'Sit_Row') {
      const rowPhase = params.rowPhase ?? 0;
      const rowEffort = params.rowEffort ?? 0;
      const steer = params.steer ?? 0;
      const leftPower = params.leftPower ?? rowEffort;
      const rightPower = params.rightPower ?? rowEffort;

      targetPelvisY = 0.25;
      // Seated thighs pointing forward (+Z), knees bent down onto floorboards
      legLX = -1.32;
      kneeLX = 1.25;
      legRX = -1.32;
      kneeRX = 1.25;

      // Lean back & forth harmoniously with oar strokes!
      targetTorsoX = Math.sin(rowPhase) * 0.2 * rowEffort + Math.sin(elapsedTime * 1.8) * 0.025;
      targetHeadY = steer * 0.28;

      // Arms reaching forward/out toward oar handles
      armLX = -0.82 - Math.sin(rowPhase) * 0.26 * leftPower;
      armLZ = 0.28;
      armRX = -0.82 - Math.sin(rowPhase) * 0.26 * rightPower;
      armRZ = -0.28;
    } else if (action === 'Walk' || action === 'Run') {
      const speed = params.speed ?? (action === 'Run' ? 4.2 : 2.6);
      const isRun = action === 'Run';
      walkCycle += clampedDt * (isRun ? 11.8 : 8.2) * clamp(speed / (isRun ? 3.8 : 2.5), 0.55, 1.35);

      const s = Math.sin(walkCycle);
      const c = Math.cos(walkCycle);
      const stride = isRun ? 0.74 : 0.52;

      targetBodyY = Math.abs(s) * (isRun ? 0.055 : 0.032);
      targetTorsoX = isRun ? 0.16 : 0.06;
      targetTorsoY = -s * 0.09;

      legLX = s * stride;
      kneeLX = Math.max(0, -c) * (isRun ? 0.72 : 0.42);
      legRX = -s * stride;
      kneeRX = Math.max(0, c) * (isRun ? 0.72 : 0.42);

      armLX = -s * (stride * 0.85);
      armRX = s * (stride * 0.85);
      armLZ = 0.14;
      armRZ = -0.14;
    } else if (action === 'Board_Boat') {
      const hopT = clamp(params.progress ?? 0.5, 0, 1);
      const arch = Math.sin(hopT * Math.PI);
      targetPelvisY = 0.44 - hopT * 0.1;
      legLX = -0.45 * arch;
      kneeLX = 0.65 * arch;
      legRX = 0.25 * arch;
      kneeRX = 0.45 * arch;
      armLX = -0.4 * arch;
      armLZ = 0.48 * arch + 0.12;
      armRX = -0.4 * arch;
      armRZ = -0.48 * arch - 0.12;
      targetTorsoX = 0.12 * arch;
    } else if (
      action === 'Fish_Aim' ||
      action === 'Fish_Cast' ||
      action === 'Fish_Idle' ||
      action === 'Fish_Bite' ||
      action === 'Fish_Reel' ||
      action === 'Fish_Catch'
    ) {
      showRod = true;
      const seated = Boolean(params.seated);
      if (seated) {
        targetPelvisY = 0.25;
        legLX = -1.32;
        kneeLX = 1.25;
        legRX = -1.32;
        kneeRX = 1.25;
      }

      if (action === 'Fish_Aim') {
        const charge = clamp(params.charge ?? 0.5, 0, 1);
        targetTorsoX = -0.18 * charge;
        armRX = -1.45 - 0.55 * charge;
        armRZ = -0.18;
        armLX = -0.55;
        rodPitch = -0.45 - 0.45 * charge;
      } else if (action === 'Fish_Cast') {
        const t = clamp(params.castProgress ?? 0.5, 0, 1);
        const whip = Math.sin(t * Math.PI);
        targetTorsoX = -0.18 + t * 0.36;
        armRX = -1.8 + t * 1.15;
        armLX = -0.45 + whip * 0.2;
        rodPitch = -0.8 + t * 0.72;
      } else if (action === 'Fish_Idle') {
        const sway = Math.sin(elapsedTime * 1.9) * 0.04;
        targetTorsoX = 0.05;
        armRX = -0.78 + sway;
        armLX = -0.52;
        armRZ = -0.1;
        armLZ = 0.22;
        rodPitch = -0.22 + sway * 0.6;
      } else if (action === 'Fish_Bite') {
        const jolt = Math.sin(elapsedTime * 22.0) * 0.14;
        targetTorsoX = -0.1;
        armRX = -0.95 + jolt;
        armLX = -0.75;
        rodPitch = -0.05 + jolt;
      } else if (action === 'Fish_Reel') {
        const tension = clamp(params.tension ?? 0.35, 0, 1);
        const tug = Math.sin(elapsedTime * (params.pulling ? 14.0 : 8.0)) * (0.08 + tension * 0.16);
        targetTorsoX = -0.16 - tension * 0.22 + tug * 0.25;
        armRX = -1.12 - tension * 0.28 + tug;
        armLX = -0.88 + Math.cos(elapsedTime * 12.0) * (params.pulling ? 0.24 : 0.08);
        rodPitch = -0.35 - tension * 0.28 + tug * 0.65;
      } else if (action === 'Fish_Catch') {
        targetBodyY = Math.abs(Math.sin(elapsedTime * 7.0)) * 0.05;
        armRX = -2.15;
        armLX = -1.95;
        armRZ = -0.35;
        armLZ = 0.35;
        rodPitch = -0.35;
      }
    } else {
      // Gentle Idle
      const breathe = Math.sin(elapsedTime * 2.1);
      targetBodyY = breathe * 0.012;
      targetHeadY = Math.sin(elapsedTime * 0.7) * 0.14;
      armLX = breathe * 0.03;
      armRX = -breathe * 0.03;
    }

    // Brief friendly reach pulse when opening/closing doors or interacting
    if (interactTimer > 0 && !showRod) {
      const p = Math.sin((interactTimer / 0.36) * Math.PI);
      armRX = THREE.MathUtils.lerp(armRX, -0.95, p);
      targetTorsoX += 0.1 * p;
    }

    // Smoothly interpolate all rig joints
    pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, targetPelvisY, k);
    bodyRoot.position.y = THREE.MathUtils.lerp(bodyRoot.position.y, targetBodyY, k);
    bodyRoot.rotation.x = THREE.MathUtils.lerp(bodyRoot.rotation.x, targetBodyPitch, k);
    upperBody.rotation.x = THREE.MathUtils.lerp(upperBody.rotation.x, targetTorsoX, k);
    upperBody.rotation.y = THREE.MathUtils.lerp(upperBody.rotation.y, targetTorsoY, k);
    headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetHeadY, k);
    headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetHeadX, k);

    legL.hip.rotation.x = THREE.MathUtils.lerp(legL.hip.rotation.x, legLX, k);
    legL.knee.rotation.x = THREE.MathUtils.lerp(legL.knee.rotation.x, kneeLX, k);
    legR.hip.rotation.x = THREE.MathUtils.lerp(legR.hip.rotation.x, legRX, k);
    legR.knee.rotation.x = THREE.MathUtils.lerp(legR.knee.rotation.x, kneeRX, k);

    armL.shoulder.rotation.x = THREE.MathUtils.lerp(armL.shoulder.rotation.x, armLX, k);
    armL.shoulder.rotation.z = THREE.MathUtils.lerp(armL.shoulder.rotation.z, armLZ, k);
    armR.shoulder.rotation.x = THREE.MathUtils.lerp(armR.shoulder.rotation.x, armRX, k);
    armR.shoulder.rotation.z = THREE.MathUtils.lerp(armR.shoulder.rotation.z, armRZ, k);

    rodGroup.visible = showRod;
    rodGroup.rotation.x = THREE.MathUtils.lerp(rodGroup.rotation.x, rodPitch, k);
  }

  function getRodTipWorldPosition(out = tipWorld) {
    root.updateMatrixWorld(true);
    rodTipAnchor.getWorldPosition(out);
    return out;
  }

  return {
    root,
    get currentAction() {
      return currentAction;
    },
    attachGlb,
    setRodStyle,
    triggerInteractPulse,
    updateAnimation,
    getRodTipWorldPosition,
  };
}
