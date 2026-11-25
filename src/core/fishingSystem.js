import * as THREE from 'three';
import { clamp } from '../noise.js';
import { getWorldElevation } from '../terrain.js';
import { buildSpeciesGeometry, createSpeciesTexture } from '../fishCatalog.js';
import { getRodSpec, getBaitSpec } from './assetRegistry.js';

function estimateFishValue(spec, sizeRatio, grade) {
  let base = 24;
  if (spec.category === '大型远洋鱼') base = 115;
  else if (spec.category === '奇特鱼类') base = 85;
  else if (spec.category === '礁石鱼类') base = 58;
  else if (spec.category === '头足与虾类') base = spec.baseScale < 0.7 ? 28 : 68;
  else if (spec.category === '彩绘淡水鱼') base = spec.baseScale < 0.7 ? 24 : 72;
  else if (spec.category === '底栖生物') base = 54;
  else if (spec.category === '群游鱼类') base = 26;

  if (spec.id === 'yellowfin_tuna') base = 240;
  if (spec.id === 'stillwater_koi') base = 95;

  const gradeMult = grade === '王冠' ? 2.1 : grade === '大物' ? 1.42 : 1.0;
  const price = Math.max(8, Math.round(base * (0.75 + sizeRatio * 0.45) * gradeMult));
  const echo = grade === '王冠' ? 40 : grade === '大物' ? 20 : 10;
  return { price, echo };
}

/**
 * Complete 6-Stage Cozy Tactile Fishing System:
 *   idle -> charging (Aim + Water Target Ring) -> casting -> waiting/approaching (Real 3D Fish swims to bobber!)
 *   -> bite (Timely Hook-Set!) -> fighting (Tension & Progress Reeling!) -> landing (3D Fish Leap + Catch Card!)
 *
 * Works seamlessly both while seated in the rowboat AND while standing on wooden piers or beaches!
 */
export function createFishingSystem({
  scene,
  playerAvatar,
  boat,
  town,
  ecosystem,
  playerController,
  gameState,
  eventBus,
}) {
  const state = {
    phase: 'idle', // 'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'fighting' | 'landing' | 'reeling_empty' | 'modal'
    timer: 0,
    duration: 0.45,
    charge: 0.55,
    chargeDir: 1,
    castOrigin: new THREE.Vector3(),
    castDirX: 1,
    castDirZ: 0,
    targetPos: new THREE.Vector3(),
    bobberPos: new THREE.Vector3(),
    fightPos: new THREE.Vector3(),
    hooked: null, // { spec, agent }
    nibbleCount: 0,
    nibbleTimer: 0,
    biteWindow: 2.3,
    // Reeling tension mini-game state
    progress: 0.24,
    tension: 0.16,
    pulling: false,
    fishMood: 'tired', // 'tired' | 'thrashing'
    moodTimer: 2.0,
    rippleTimer: 0,
    pendingCatch: null,
  };

  // ---- 3D Visuals: Glowing Water Target Ring (during Aim/Charge) ----
  const targetRingGroup = new THREE.Group();
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.44, 28),
    new THREE.MeshBasicMaterial({
      color: 0xf7e7a1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  outerRing.rotation.x = -Math.PI / 2;
  const innerDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 16),
    new THREE.MeshBasicMaterial({
      color: 0xc84b34,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  innerDot.rotation.x = -Math.PI / 2;
  targetRingGroup.add(outerRing, innerDot);
  targetRingGroup.visible = false;
  scene.add(targetRingGroup);

  // ---- 3D Visuals: Painted Red-and-Cream Floating Bobber ----
  const bobberGroup = new THREE.Group();
  const bobTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.5 })
  );
  const bobBot = new THREE.Mesh(
    new THREE.SphereGeometry(0.088, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf4ead5, roughness: 0.62 })
  );
  const bobStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.019, 0.15, 6),
    new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.58 })
  );
  bobStem.position.y = 0.095;
  bobberGroup.add(bobTop, bobBot, bobStem);
  bobberGroup.visible = false;
  scene.add(bobberGroup);

  // ---- 3D Visuals: Graceful Catenary Fishing Line ----
  const LINE_SEGMENTS = 18;
  const linePositions = new Float32Array((LINE_SEGMENTS + 1) * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xf8f4e8,
    transparent: true,
    opacity: 0.84,
  });
  const fishingLine = new THREE.Line(lineGeo, lineMat);
  fishingLine.visible = false;
  fishingLine.frustumCulled = false;
  scene.add(fishingLine);

  // ---- 3D Visuals: Temporary Leaping Caught Fish Preview ----
  let leapFishMesh = null;
  const leapStart = new THREE.Vector3();
  const leapEnd = new THREE.Vector3();

  function clearLeapFish() {
    if (leapFishMesh) {
      scene.remove(leapFishMesh);
      leapFishMesh.geometry?.dispose?.();
      leapFishMesh.material?.dispose?.();
      leapFishMesh = null;
    }
  }

  function spawnLeapFish(spec, sizeRatio, fromPos, toPos) {
    clearLeapFish();
    const geo = buildSpeciesGeometry(spec);
    const tex = createSpeciesTexture(spec);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      vertexColors: true,
      roughness: 0.4,
      emissive: new THREE.Color(spec.palette.flank),
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    });
    leapFishMesh = new THREE.Mesh(geo, mat);
    leapFishMesh.scale.setScalar(clamp(spec.baseScale * sizeRatio * 0.55, 0.28, 0.92));
    leapStart.copy(fromPos);
    leapEnd.copy(toPos);
    leapFishMesh.position.copy(fromPos);
    scene.add(leapFishMesh);
  }

  function updateFishingLine(tipPos, endPos, sag = 0.26) {
    const arr = lineGeo.attributes.position.array;
    for (let i = 0; i <= LINE_SEGMENTS; i++) {
      const t = i / LINE_SEGMENTS;
      const x = THREE.MathUtils.lerp(tipPos.x, endPos.x, t);
      const z = THREE.MathUtils.lerp(tipPos.z, endPos.z, t);
      const linY = THREE.MathUtils.lerp(tipPos.y, endPos.y, t);
      const droop = Math.sin(t * Math.PI) * sag;
      arr[i * 3] = x;
      arr[i * 3 + 1] = Math.max(0.02, linY - droop);
      arr[i * 3 + 2] = z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  /**
   * Finds a valid casting direction over navigable water from either the boat or a pier/beach!
   */
  function findWaterCastDirection() {
    const mode = gameState.data.playerMode;
    const rod = getRodSpec(gameState.data.equipment.rodId);
    let originX, originZ, dirX, dirZ;
    if (mode === 'sailing') {
      originX = boat.state.pos.x;
      originZ = boat.state.pos.z;
      dirX = Math.cos(boat.state.yaw);
      dirZ = -Math.sin(boat.state.yaw);
    } else {
      originX = playerController.walkerState.pos.x;
      originZ = playerController.walkerState.pos.z;
      dirX = Math.sin(playerController.walkerState.yaw);
      dirZ = Math.cos(playerController.walkerState.yaw);
    }

    const angleOffsets = [0, 0.35, -0.35, 0.72, -0.72, Math.PI * 0.5, -Math.PI * 0.5, Math.PI];
    for (const aOff of angleOffsets) {
      const ca = Math.cos(aOff);
      const sa = Math.sin(aOff);
      const dx = dirX * ca - dirZ * sa;
      const dz = dirX * sa + dirZ * ca;
      // Check mid-range distance is open water
      const tx = originX + dx * (rod.castRange * 0.62);
      const tz = originZ + dz * (rod.castRange * 0.62);
      if (getWorldElevation(tx, tz) < -0.35 && !town.isWalkableDeck(tx, tz)) {
        return { originX, originZ, dx, dz, faceYaw: Math.atan2(dx, dz) };
      }
    }
    return null;
  }

  function computeChargeLanding(chargeFrac) {
    const rod = getRodSpec(gameState.data.equipment.rodId);
    const desiredDist = rod.castRange * (0.36 + clamp(chargeFrac, 0, 1) * 0.64);
    // Walk back slightly if maximum charge hits a distant shoreline or pier
    for (let scale = 1.0; scale >= 0.4; scale -= 0.12) {
      const d = desiredDist * scale;
      const tx = state.castOrigin.x + state.castDirX * d;
      const tz = state.castOrigin.z + state.castDirZ * d;
      if (getWorldElevation(tx, tz) < -0.34 && !town.isWalkableDeck(tx, tz)) {
        return { x: tx, z: tz };
      }
    }
    return {
      x: state.castOrigin.x + state.castDirX * (rod.castRange * 0.55),
      z: state.castOrigin.z + state.castDirZ * (rod.castRange * 0.55),
    };
  }

  function isActive() {
    return state.phase !== 'idle';
  }

  function isMovementLocked() {
    return state.phase !== 'idle';
  }

  function resetToIdle(releaseHooked = true) {
    if (releaseHooked && state.hooked?.agent) {
      ecosystem.setFishHookState(state.hooked.agent, 'free');
    }
    state.phase = 'idle';
    state.hooked = null;
    state.pulling = false;
    state.pendingCatch = null;
    targetRingGroup.visible = false;
    bobberGroup.visible = false;
    fishingLine.visible = false;
    clearLeapFish();
    boat.setFishingActive(false);
    eventBus.emit('fishing:stateChanged', { phase: 'idle' });
  }

  function onActionDown(addRipple) {
    const mode = gameState.data.playerMode;
    if (mode !== 'sailing' && mode !== 'walking') return false;
    if (playerController.isTransitioning()) return false;

    if (state.phase === 'modal') return false;

    if (state.phase === 'idle') {
      if (gameState.data.insideBuildingId) {
        eventBus.emit('ui:toast', { text: '屋里不能抛竿哦，推开门到栈桥或船上甩竿吧！', portrait: 'player', mood: 'neutral' });
        return false;
      }
      const aim = findWaterCastDirection();
      if (!aim) {
        eventBus.emit('ui:toast', { text: '离水面有点远，走到码头栈桥边或划船到水面上再抛竿吧！', portrait: 'player', mood: 'neutral' });
        return false;
      }
      if (mode === 'walking') {
        playerController.walkerState.yaw = aim.faceYaw;
      } else {
        boat.setFishingActive(true);
      }

      playerAvatar.setRodStyle(gameState.data.equipment.rodId);
      state.phase = 'charging';
      state.timer = 0;
      state.charge = 0.28;
      state.chargeDir = 1;
      state.castOrigin.set(aim.originX, 0, aim.originZ);
      state.castDirX = aim.dx;
      state.castDirZ = aim.dz;
      const land = computeChargeLanding(state.charge);
      state.targetPos.set(land.x, 0.04, land.z);
      targetRingGroup.position.copy(state.targetPos);
      targetRingGroup.visible = true;
      eventBus.emit('fishing:stateChanged', { phase: 'charging' });
      return true;
    }

    if (state.phase === 'waiting') {
      // Early reel-in before bite
      if (state.hooked?.agent) {
        ecosystem.setFishHookState(state.hooked.agent, 'free');
        state.hooked = null;
      }
      state.phase = 'reeling_empty';
      state.timer = 0;
      state.duration = 0.42;
      if (addRipple) {
        addRipple({ x: state.bobberPos.x, z: state.bobberPos.z, dirX: 0, dirZ: 1, mode: 0, radiusScale: 0.42, intensity: 0.65 });
      }
      eventBus.emit('fishing:stateChanged', { phase: 'reeling_empty' });
      return true;
    }

    if (state.phase === 'bite') {
      // TIMELY HOOK SET!! Enter live tension reeling mini-game!
      state.phase = 'fighting';
      state.timer = 0;
      state.progress = 0.24;
      state.tension = 0.22;
      state.pulling = true;
      state.fishMood = 'tired';
      state.moodTimer = 1.9 + Math.random() * 0.9;
      state.fightPos.set(state.bobberPos.x, -0.18, state.bobberPos.z);

      if (state.hooked?.agent) {
        ecosystem.setFishHookState(state.hooked.agent, 'hooked', state.fightPos);
      }
      if (addRipple) {
        addRipple({ x: state.bobberPos.x, z: state.bobberPos.z, dirX: 0, dirZ: 1, mode: 0, radiusScale: 0.78, intensity: 1.0 });
      }
      eventBus.emit('fishing:stateChanged', {
        phase: 'fighting',
        spec: state.hooked?.spec,
        agent: state.hooked?.agent,
      });
      return true;
    }

    if (state.phase === 'fighting') {
      state.pulling = true;
      return true;
    }

    return false;
  }

  function onActionUp() {
    if (state.phase === 'charging') {
      // Quick-tap friendliness: ensure at least 55% distance so a short tap still casts nicely!
      const effectiveCharge = Math.max(0.55, state.charge);
      const land = computeChargeLanding(effectiveCharge);
      state.targetPos.set(land.x, 0.02, land.z);
      state.bobberPos.copy(state.targetPos);
      targetRingGroup.visible = false;

      state.phase = 'casting';
      state.timer = 0;
      state.duration = 0.44;
      bobberGroup.visible = true;
      fishingLine.visible = true;
      eventBus.emit('fishing:stateChanged', { phase: 'casting' });
      return true;
    }

    if (state.phase === 'fighting') {
      state.pulling = false;
      return true;
    }

    return false;
  }

  /**
   * Resolves player's choice on the Catch Settlement Card: 'keep' (to Basket) or 'release' (for Echo)
   */
  function resolveCatchChoice(choice, addRipple) {
    const info = state.pendingCatch;
    if (!info) {
      resetToIdle(false);
      return;
    }

    if (choice === 'keep') {
      gameState.addFishToInventory({
        speciesId: info.spec.id,
        lengthCm: info.lengthCm,
        sizeRatio: info.sizeRatio,
        grade: info.grade,
        price: info.price,
      });
      eventBus.emit('ui:toast', {
        text: `已将「${info.spec.nameZh}（${info.lengthCm}cm · ${info.grade}）」收入随身鱼护！带回家可以放进大鱼缸饲养哦`,
        portrait: 'dog',
        mood: 'excited',
      });
    } else {
      gameState.addEcho(info.echo);
      if (addRipple) {
        addRipple({
          x: state.castOrigin.x + state.castDirX * 1.8,
          z: state.castOrigin.z + state.castDirZ * 1.8,
          dirX: state.castDirX,
          dirZ: state.castDirZ,
          mode: 0,
          radiusScale: 0.55,
          intensity: 0.8,
        });
      }
      eventBus.emit('ui:toast', {
        text: `温柔放生了「${info.spec.nameZh}」，收获 +${info.echo} 放生回响灵气！`,
        portrait: 'player',
        mood: 'happy',
      });
    }

    resetToIdle(false);
  }

  const projVec = new THREE.Vector3();

  return {
    state,
    isActive,
    isMovementLocked,
    onActionDown,
    onActionUp,
    resolveCatchChoice,
    cancel: () => resetToIdle(true),

    /**
     * Projects the live bobber/bite position to screen coordinates for floating `! 咬钩了` alert
     */
    getBobberScreenPos(camera) {
      if (!bobberGroup.visible) return null;
      projVec.copy(bobberGroup.position);
      projVec.y += 0.55;
      projVec.project(camera);
      if (projVec.z > 1) return null;
      return {
        x: (projVec.x * 0.5 + 0.5) * window.innerWidth,
        y: (-projVec.y * 0.5 + 0.5) * window.innerHeight,
      };
    },

    update(dt, elapsedTime, addRipple) {
      if (state.phase === 'idle') return;
      const clampedDt = Math.min(dt, 0.05);
      const seated = gameState.data.playerMode === 'sailing';
      const tip = playerAvatar.getRodTipWorldPosition();

      // 1. CHARGING / AIMING
      if (state.phase === 'charging') {
        state.timer += clampedDt;
        state.charge += state.chargeDir * clampedDt * 0.85;
        if (state.charge >= 1.0) {
          state.charge = 1.0;
          state.chargeDir = -1;
        } else if (state.charge <= 0.24) {
          state.charge = 0.24;
          state.chargeDir = 1;
        }
        const land = computeChargeLanding(state.charge);
        state.targetPos.set(land.x, 0.04, land.z);
        targetRingGroup.position.copy(state.targetPos);
        const pulse = 1.0 + Math.sin(elapsedTime * 8.0) * 0.08;
        targetRingGroup.scale.setScalar(pulse);

        playerAvatar.updateAnimation('Fish_Aim', clampedDt, elapsedTime, {
          seated,
          charge: state.charge,
        });
        return;
      }

      // 2. CASTING ARC
      if (state.phase === 'casting') {
        state.timer += clampedDt;
        const t = clamp(state.timer / state.duration, 0, 1);
        const arcY = Math.sin(t * Math.PI) * 1.85;
        bobberGroup.position.set(
          THREE.MathUtils.lerp(tip.x, state.targetPos.x, t),
          THREE.MathUtils.lerp(tip.y, 0.02, t) + arcY,
          THREE.MathUtils.lerp(tip.z, state.targetPos.z, t)
        );
        updateFishingLine(tip, bobberGroup.position, 0.14);
        playerAvatar.updateAnimation('Fish_Cast', clampedDt, elapsedTime, { seated, castProgress: t });

        if (t >= 1) {
          state.phase = 'waiting';
          state.timer = 0;
          state.rippleTimer = 0.85;
          state.nibbleCount = 0;
          state.nibbleTimer = 0.9;
          bobberGroup.position.set(state.bobberPos.x, 0.02, state.bobberPos.z);

          if (addRipple) {
            addRipple({
              x: state.bobberPos.x,
              z: state.bobberPos.z,
              dirX: 0,
              dirZ: 1,
              mode: 0,
              radiusScale: 0.58,
              intensity: 0.92,
            });
          }

          // Summon a REAL nearby underwater fish toward the floating bobber!
          const baitId = gameState.data.equipment.baitId;
          const attracted = ecosystem.attractFishToBobber(state.bobberPos.x, state.bobberPos.z, baitId);
          state.hooked = attracted;
          eventBus.emit('fishing:stateChanged', {
            phase: 'waiting',
            spec: attracted?.spec || null,
          });
        }
        return;
      }

      // 3. WAITING & REAL FISH APPROACHING / NIBBLING
      if (state.phase === 'waiting') {
        state.timer += clampedDt;
        let bobDip = Math.sin(elapsedTime * 2.8) * 0.022;

        if (!state.hooked) {
          // Retry attracting if a fish swims into range
          if (state.timer > 1.2) {
            state.hooked = ecosystem.attractFishToBobber(
              state.bobberPos.x,
              state.bobberPos.z,
              gameState.data.equipment.baitId
            );
          }
        } else {
          const fish = state.hooked.agent;
          const d = Math.hypot(fish.pos.x - state.bobberPos.x, fish.pos.z - state.bobberPos.z);

          // Once the real fish arrives under the bobber, do 1-2 playful nibbles then BITE!
          if (d < 0.78 || state.timer > 3.6) {
            if (fish.hookState !== 'nibbling') {
              ecosystem.setFishHookState(fish, 'nibbling', {
                x: state.bobberPos.x,
                y: -0.2,
                z: state.bobberPos.z,
              });
              state.nibbleTimer = 0.55;
            }
            state.nibbleTimer -= clampedDt;
            if (state.nibbleTimer <= 0) {
              state.nibbleCount += 1;
              if (state.nibbleCount <= 1) {
                // First playful nibble dip!
                bobDip = -0.07;
                state.nibbleTimer = 0.65 + Math.random() * 0.45;
                if (addRipple) {
                  addRipple({
                    x: state.bobberPos.x,
                    z: state.bobberPos.z,
                    dirX: 0,
                    dirZ: 1,
                    mode: 0,
                    radiusScale: 0.36,
                    intensity: 0.62,
                  });
                }
              } else {
                // FULL BITE!! Plunge bobber under water!
                state.phase = 'bite';
                state.timer = 0;
                state.biteWindow = 2.4;
                if (addRipple) {
                  addRipple({
                    x: state.bobberPos.x,
                    z: state.bobberPos.z,
                    dirX: 0,
                    dirZ: 1,
                    mode: 0,
                    radiusScale: 0.72,
                    intensity: 1.0,
                  });
                }
                eventBus.emit('fishing:stateChanged', {
                  phase: 'bite',
                  spec: state.hooked.spec,
                });
                return;
              }
            }
          }
        }

        bobberGroup.position.set(state.bobberPos.x, 0.02 + bobDip, state.bobberPos.z);
        bobberGroup.rotation.z = Math.sin(elapsedTime * 2.3) * 0.1;
        updateFishingLine(tip, bobberGroup.position, 0.34);
        playerAvatar.updateAnimation('Fish_Idle', clampedDt, elapsedTime, { seated });

        state.rippleTimer -= clampedDt;
        if (state.rippleTimer <= 0 && addRipple) {
          state.rippleTimer = 1.45;
          addRipple({
            x: state.bobberPos.x,
            z: state.bobberPos.z,
            dirX: 1,
            dirZ: 0,
            mode: 1,
            radiusScale: 0.3,
            intensity: 0.38,
          });
        }
        return;
      }

      // 4. BITE WINDOW (Timely Hook-Set!)
      if (state.phase === 'bite') {
        state.timer += clampedDt;
        // Bobber plunging & dancing aggressively under surface!
        const plunge = -0.095 + Math.sin(elapsedTime * 26.0) * 0.035;
        bobberGroup.position.set(
          state.bobberPos.x + Math.sin(elapsedTime * 19.0) * 0.04,
          plunge,
          state.bobberPos.z + Math.cos(elapsedTime * 17.0) * 0.04
        );
        updateFishingLine(tip, bobberGroup.position, 0.06);
        playerAvatar.updateAnimation('Fish_Bite', clampedDt, elapsedTime, { seated });

        state.rippleTimer -= clampedDt;
        if (state.rippleTimer <= 0 && addRipple) {
          state.rippleTimer = 0.28;
          addRipple({
            x: state.bobberPos.x,
            z: state.bobberPos.z,
            dirX: 0,
            dirZ: 1,
            mode: 0,
            radiusScale: 0.56,
            intensity: 0.85,
          });
        }

        if (state.timer >= state.biteWindow) {
          eventBus.emit('ui:toast', {
            text: '鱼儿松口游走了～ 下次看到「咬钩了！」立刻按 Space 提竿哦！',
            portrait: 'player',
            mood: 'surprised',
          });
          resetToIdle(true);
        }
        return;
      }

      // 5. LIVE TENSION REELING FIGHT!
      if (state.phase === 'fighting') {
        const rod = getRodSpec(gameState.data.equipment.rodId);
        const spec = state.hooked?.spec;
        const agent = state.hooked?.agent;
        // Difficulty scales smoothly with fish size & trophy grade (always forgiving & joyful!)
        const fishWeight = clamp((spec ? spec.baseScale : 1.0) * (agent ? agent.sizeRatio : 1.0), 0.55, 2.5);
        const powerRatio = clamp((rod.power * 1.15) / (0.65 + fishWeight * 0.45), 0.65, 1.85);

        state.moodTimer -= clampedDt;
        if (state.moodTimer <= 0) {
          state.fishMood = state.fishMood === 'tired' ? 'thrashing' : 'tired';
          state.moodTimer =
            state.fishMood === 'tired'
              ? 2.1 + Math.random() * 1.0
              : 1.0 + Math.random() * 0.65;
        }

        const isThrashing = state.fishMood === 'thrashing';

        if (state.pulling) {
          if (isThrashing) {
            state.progress += clampedDt * 0.11 * powerRatio;
            state.tension += clampedDt * (0.58 + fishWeight * 0.14);
          } else {
            state.progress += clampedDt * 0.34 * powerRatio;
            state.tension += clampedDt * 0.2;
          }
        } else {
          state.tension -= clampedDt * 0.68;
          state.progress -= clampedDt * (isThrashing ? 0.065 : 0.025);
        }

        state.progress = clamp(state.progress, 0.04, 1.0);
        state.tension = clamp(state.tension, 0.0, 1.0);

        // Compute fighting fish 3D world position moving smoothly closer to angler as progress -> 1!
        const actorPos = playerController.getActorWorldPos();
        const pullT = clamp(state.progress * 0.78, 0.08, 0.82);
        const baseX = THREE.MathUtils.lerp(state.bobberPos.x, actorPos.x + state.castDirX * 1.35, pullT);
        const baseZ = THREE.MathUtils.lerp(state.bobberPos.z, actorPos.z + state.castDirZ * 1.35, pullT);

        // Lateral darting weave perpendicular to line!
        const perpX = -state.castDirZ;
        const perpZ = state.castDirX;
        const dartAmp = isThrashing ? 0.75 : 0.24;
        const dartFreq = isThrashing ? 7.2 : 2.6;
        const lateral = Math.sin(elapsedTime * dartFreq) * dartAmp;

        state.fightPos.set(baseX + perpX * lateral, isThrashing ? -0.1 : -0.2, baseZ + perpZ * lateral);
        bobberGroup.position.set(state.fightPos.x, isThrashing ? -0.02 : 0.02, state.fightPos.z);

        if (agent) {
          ecosystem.setFishHookState(agent, 'hooked', state.fightPos);
        }

        updateFishingLine(tip, state.fightPos, state.pulling ? 0.03 : 0.22);
        playerAvatar.updateAnimation('Fish_Reel', clampedDt, elapsedTime, {
          seated,
          tension: state.tension,
          pulling: state.pulling,
        });

        state.rippleTimer -= clampedDt;
        if (state.rippleTimer <= 0 && addRipple) {
          state.rippleTimer = isThrashing ? 0.18 : 0.36;
          addRipple({
            x: state.fightPos.x,
            z: state.fightPos.z,
            dirX: perpX * Math.sign(Math.cos(elapsedTime * dartFreq) || 1),
            dirZ: perpZ * Math.sign(Math.cos(elapsedTime * dartFreq) || 1),
            mode: 0,
            radiusScale: isThrashing ? 0.66 : 0.44,
            intensity: isThrashing ? 0.96 : 0.62,
          });
        }

        eventBus.emit('fishing:fightTick', {
          progress: state.progress,
          tension: state.tension,
          fishMood: state.fishMood,
          pulling: state.pulling,
        });

        // Line Snap check
        if (state.tension >= 0.995) {
          eventBus.emit('ui:toast', {
            text: '哎呀！鱼线拉力过载崩断了，下次鱼猛烈挣扎时记得松手卸力哦～',
            portrait: 'player',
            mood: 'surprised',
          });
          resetToIdle(true);
          return;
        }

        // CATCH SUCCESS!!
        if (state.progress >= 1.0) {
          const caughtSpec = spec || ecosystem.speciesCatalog[0];
          const caughtLen = agent ? agent.lengthCm : Math.round(caughtSpec.baseScale * 36);
          const caughtRatio = agent ? agent.sizeRatio : 1.0;
          const caughtGrade = agent ? agent.grade : '普通';
          const { price, echo } = estimateFishValue(caughtSpec, caughtRatio, caughtGrade);

          const prevDex = gameState.data.fishDex[caughtSpec.id];
          const isNewSpecies = !prevDex || prevDex.caughtCount === 0;
          const isNewRecord = !prevDex || caughtLen > prevDex.maxLengthCm;

          state.pendingCatch = {
            spec: caughtSpec,
            lengthCm: caughtLen,
            sizeRatio: caughtRatio,
            grade: caughtGrade,
            price,
            echo,
            isNewSpecies,
            isNewRecord,
          };

          // Respawn the lagoon agent gracefully & launch the joyful 3D leaping fish arc!
          const jumpFrom = state.fightPos.clone();
          if (agent) ecosystem.respawnCaughtFish(agent, caughtSpec);
          state.hooked = null;

          const actorNow = playerController.getActorWorldPos();
          const jumpTo = new THREE.Vector3(actorNow.x, actorNow.y + 1.05, actorNow.z);
          spawnLeapFish(caughtSpec, caughtRatio, jumpFrom, jumpTo);

          bobberGroup.visible = false;
          fishingLine.visible = false;
          state.phase = 'landing';
          state.timer = 0;
          state.duration = 0.68;

          if (addRipple) {
            addRipple({
              x: jumpFrom.x,
              z: jumpFrom.z,
              dirX: 0,
              dirZ: 1,
              mode: 0,
              radiusScale: 0.85,
              intensity: 1.0,
            });
          }
          eventBus.emit('fishing:stateChanged', { phase: 'landing', catchInfo: state.pendingCatch });
        }
        return;
      }

      // 6. JOYFUL 3D FISH LEAP -> OPEN CATCH SETTLEMENT CARD!
      if (state.phase === 'landing') {
        state.timer += clampedDt;
        const t = clamp(state.timer / state.duration, 0, 1);
        if (leapFishMesh) {
          leapFishMesh.position.lerpVectors(leapStart, leapEnd, t);
          leapFishMesh.position.y += Math.sin(t * Math.PI) * 1.45;
          leapFishMesh.rotation.y = elapsedTime * 6.5;
          leapFishMesh.rotation.z = Math.sin(t * Math.PI) * 0.65;
        }
        playerAvatar.updateAnimation('Fish_Catch', clampedDt, elapsedTime, { seated });

        if (t >= 1) {
          clearLeapFish();
          state.phase = 'modal';
          eventBus.emit('fishing:caught', state.pendingCatch);
        }
        return;
      }

      // 7. MODAL OPEN (Hold celebratory pose cleanly while player chooses Keep / Release)
      if (state.phase === 'modal') {
        playerAvatar.updateAnimation('Fish_Catch', clampedDt, elapsedTime, { seated });
        return;
      }

      // 8. EARLY REEL-IN (Empty retrieve)
      if (state.phase === 'reeling_empty') {
        state.timer += clampedDt;
        const t = clamp(state.timer / state.duration, 0, 1);
        bobberGroup.position.lerpVectors(state.bobberPos, tip, t);
        bobberGroup.position.y += Math.sin(t * Math.PI) * 0.5;
        updateFishingLine(tip, bobberGroup.position, 0.08);
        playerAvatar.updateAnimation('Fish_Reel', clampedDt, elapsedTime, { seated, tension: 0.2 });
        if (t >= 1) {
          resetToIdle(false);
        }
      }
    },
  };
}
