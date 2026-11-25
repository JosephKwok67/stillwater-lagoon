import * as THREE from 'three';
import { clamp } from '../noise.js';
import { getWorldElevation } from '../terrain.js';
import { getRodSpec } from './assetRegistry.js';

/**
 * Unified Player Movement, Seamless Boarding/Disembarking, and Rod Casting Action Pack Controller.
 * Supports:
 * - Screen-relative WASD/Arrow walking & Shift jogging on piers, paths, and inside open-door houses
 * - Smooth parabolic Board_Boat hop between wooden docks and the rowboat seat
 * - Boat & shore/pier fishing rod casting with painted red-white 3D bobber, catenary fishing line, and water ripples
 */
export function createPlayerController({
  scene,
  playerAvatar,
  boat,
  town,
  ecosystem,
  companion,
  gameState,
  eventBus,
}) {
  const walkerState = {
    pos: new THREE.Vector3(3.6, 0.5, -13.5),
    yaw: Math.PI, // facing north (-Z) toward cottage on initial disembark
    speed: 0,
    running: false,
    isMoving: false,
  };

  // Parabolic hop transition between boat <-> dock
  const transition = {
    active: false,
    toMode: 'walking',
    elapsed: 0,
    duration: 0.42,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startYaw: 0,
    endYaw: 0,
  };

  // Interactive Fishing Action Rig (Bobber + Catenary Fishing Line)
  const castState = {
    phase: 'none', // 'none' | 'casting' | 'waiting' | 'reeling'
    timer: 0,
    duration: 0.42,
    startPos: new THREE.Vector3(),
    bobberPos: new THREE.Vector3(),
    rippleTimer: 0,
    nearbyFishName: '',
  };

  // Build cute painted 3D red-and-cream fishing bobber (matches Codex's bobber.png!)
  const bobberGroup = new THREE.Group();
  const bobTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.55 })
  );
  const bobBot = new THREE.Mesh(
    new THREE.SphereGeometry(0.084, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf4ead5, roughness: 0.65 })
  );
  const bobStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.14, 6),
    new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.6 })
  );
  bobStem.position.y = 0.09;
  bobberGroup.add(bobTop, bobBot, bobStem);
  bobberGroup.visible = false;
  scene.add(bobberGroup);

  // Graceful catenary fishing line connecting rod tip to floating bobber
  const LINE_SEGMENTS = 18;
  const linePositions = new Float32Array((LINE_SEGMENTS + 1) * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xf7f4eb,
    transparent: true,
    opacity: 0.78,
  });
  const fishingLine = new THREE.Line(lineGeo, lineMat);
  fishingLine.visible = false;
  fishingLine.frustumCulled = false;
  scene.add(fishingLine);

  // Walking keyboard state
  const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    shift: false,
  };

  const onKey = (down) => (e) => {
    const c = e.code;
    if (c === 'KeyW' || c === 'ArrowUp') keys.w = down;
    if (c === 'KeyS' || c === 'ArrowDown') keys.s = down;
    if (c === 'KeyA' || c === 'ArrowLeft') keys.a = down;
    if (c === 'KeyD' || c === 'ArrowRight') keys.d = down;
    if (c === 'ShiftLeft' || c === 'ShiftRight') keys.shift = down;
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  function clearKeys() {
    keys.w = keys.s = keys.a = keys.d = keys.shift = false;
    boat.clearKeys();
  }

  function cancelCast() {
    castState.phase = 'none';
    bobberGroup.visible = false;
    fishingLine.visible = false;
    boat.setFishingActive(false);
  }

  /**
   * Computes forward water cast target from either seated boat or standing pier/shore
   */
  function findCastWaterTarget() {
    const mode = gameState.data.playerMode;
    const rod = getRodSpec(gameState.data.equipment.rodId);
    const maxDist = rod.castRange;

    let originX, originZ, dirX, dirZ;
    if (mode === 'sailing') {
      originX = boat.state.pos.x;
      originZ = boat.state.pos.z;
      dirX = Math.cos(boat.state.yaw);
      dirZ = -Math.sin(boat.state.yaw);
    } else {
      originX = walkerState.pos.x;
      originZ = walkerState.pos.z;
      dirX = Math.sin(walkerState.yaw);
      dirZ = Math.cos(walkerState.yaw);
    }

    // Try along facing direction first, then probe nearby angles toward water if standing on pier/shore
    const angleOffsets = [0, 0.35, -0.35, 0.75, -0.75, Math.PI * 0.5, -Math.PI * 0.5, Math.PI];
    for (const aOff of angleOffsets) {
      const ca = Math.cos(aOff);
      const sa = Math.sin(aOff);
      const dx = dirX * ca - dirZ * sa;
      const dz = dirX * sa + dirZ * ca;
      for (const distFrac of [0.78, 0.58, 0.95, 0.42]) {
        const d = maxDist * distFrac;
        const tx = originX + dx * d;
        const tz = originZ + dz * d;
        if (getWorldElevation(tx, tz) < -0.35 && !town.isWalkableDeck(tx, tz)) {
          return { x: tx, z: tz, faceYaw: Math.atan2(dx, dz) };
        }
      }
    }
    return null;
  }

  function toggleCastAction(addRipple) {
    if (transition.active) return false;
    const mode = gameState.data.playerMode;
    if (mode !== 'sailing' && mode !== 'walking') return false;
    if (gameState.data.insideBuildingId) {
      eventBus.emit('ui:toast', { text: '屋里不能甩竿哦，推开门到码头或船上试试吧！', portrait: 'player', mood: 'neutral' });
      return false;
    }

    if (castState.phase === 'waiting') {
      // Reel back cleanly!
      castState.phase = 'reeling';
      castState.timer = 0;
      castState.duration = 0.52;
      if (addRipple) {
        addRipple({
          x: castState.bobberPos.x,
          z: castState.bobberPos.z,
          dirX: 0,
          dirZ: 1,
          mode: 0,
          radiusScale: 0.42,
          intensity: 0.75,
        });
      }
      return true;
    }

    if (castState.phase !== 'none') return false;

    const target = findCastWaterTarget();
    if (!target) {
      eventBus.emit('ui:toast', { text: '这里离水面太远了，走到栈桥边或划船再甩竿吧！', portrait: 'player', mood: 'neutral' });
      return false;
    }

    if (mode === 'walking') {
      walkerState.yaw = target.faceYaw;
    } else {
      boat.setFishingActive(true);
    }

    playerAvatar.setRodStyle(gameState.data.equipment.rodId);
    castState.phase = 'casting';
    castState.timer = 0;
    castState.duration = 0.46;
    castState.startPos.copy(playerAvatar.getRodTipWorldPosition());
    castState.bobberPos.set(target.x, 0.02, target.z);
    castState.rippleTimer = 0;
    castState.nearbyFishName = '';

    bobberGroup.visible = true;
    fishingLine.visible = true;
    eventBus.emit('fishing:castStarted', { target });
    return true;
  }

  /**
   * Seamless Disembark from Boat onto any Wooden Pier!
   */
  function disembarkAtDock(dock) {
    if (transition.active) return;
    cancelCast();

    // Capture current world transform of player before detaching from boat
    const worldPos = new THREE.Vector3();
    playerAvatar.root.getWorldPosition(worldPos);
    const startYaw = boat.state.yaw + Math.PI / 2;

    scene.add(playerAvatar.root);
    playerAvatar.root.position.copy(worldPos);
    playerAvatar.root.rotation.set(0, startYaw, 0);

    boat.setOccupied(false);
    boat.moorAt(dock.boatMoorPos, dock.boatMoorYaw);
    gameState.data.mooredDockId = dock.id;

    transition.active = true;
    transition.toMode = 'walking';
    transition.elapsed = 0;
    transition.duration = 0.42;
    transition.startPos.copy(worldPos);
    transition.endPos.copy(dock.disembarkPos);
    transition.startYaw = startYaw;
    transition.endYaw = Math.PI; // face north toward town & cottages

    walkerState.pos.copy(dock.disembarkPos);
    walkerState.yaw = Math.PI;
    gameState.setPlayerMode('walking');

    // Bring companion dog onto the pier right beside us!
    if (companion) {
      companion.teleportNear(dock.disembarkPos.x + 0.55, dock.disembarkPos.y, dock.disembarkPos.z + 0.35, true);
    }

    eventBus.emit('ui:toast', {
      text: `已停靠「${dock.nameZh}」，WASD 漫步小镇 · Shift 小跑 · 靠近房门按 E 推门进屋`,
      portrait: 'dog',
      mood: 'happy',
    });
  }

  /**
   * Seamless Boarding from Pier/Shore back into the Moored Rowboat!
   */
  function boardBoat() {
    if (transition.active) return;
    cancelCast();

    const targetPos = new THREE.Vector3();
    boat.seatMount.getWorldPosition(targetPos);

    transition.active = true;
    transition.toMode = 'sailing';
    transition.elapsed = 0;
    transition.duration = 0.4;
    transition.startPos.copy(walkerState.pos);
    transition.endPos.copy(targetPos);
    transition.startYaw = walkerState.yaw;
    transition.endYaw = boat.state.yaw + Math.PI / 2;

    gameState.setInsideBuilding(null);
    gameState.setPlayerMode('sailing');
    eventBus.emit('ui:toast', {
      text: '已登船出海！WASD 划船 · Space 甩竿 · 靠码头按 E 上岸',
      portrait: 'player',
      mood: 'happy',
    });
  }

  /**
   * Safety teleport back to player's home pier (unstuck / quick home button)
   */
  function warpToHomeDock() {
    cancelCast();
    transition.active = false;
    const homeDock = town.docks[0];
    boat.state.pos.copy(homeDock.boatMoorPos);
    boat.state.yaw = homeDock.boatMoorYaw;
    boat.state.speed = 0;
    boat.state.angVel = 0;

    if (gameState.data.playerMode === 'walking') {
      walkerState.pos.copy(homeDock.disembarkPos);
      walkerState.yaw = Math.PI;
      playerAvatar.root.position.copy(walkerState.pos);
      playerAvatar.root.rotation.set(0, walkerState.yaw, 0);
      gameState.setInsideBuilding(null);
      if (companion) {
        companion.teleportNear(homeDock.disembarkPos.x + 0.5, homeDock.disembarkPos.y, homeDock.disembarkPos.z + 0.3, true);
      }
    } else {
      boat.setOccupied(true);
      boat.seatMount.add(playerAvatar.root);
      playerAvatar.root.position.set(0, 0, 0);
      playerAvatar.root.rotation.set(0, 0, 0);
    }

    eventBus.emit('ui:toast', { text: '已回到自家小屋码头', portrait: 'player', mood: 'neutral' });
  }

  function updateFishingLine(tipPos, bobPos, sag = 0.25) {
    const arr = lineGeo.attributes.position.array;
    for (let i = 0; i <= LINE_SEGMENTS; i++) {
      const t = i / LINE_SEGMENTS;
      const x = THREE.MathUtils.lerp(tipPos.x, bobPos.x, t);
      const z = THREE.MathUtils.lerp(tipPos.z, bobPos.z, t);
      const linearY = THREE.MathUtils.lerp(tipPos.y, bobPos.y, t);
      const droop = Math.sin(t * Math.PI) * sag;
      arr[i * 3] = x;
      arr[i * 3 + 1] = Math.max(0.02, linearY - droop);
      arr[i * 3 + 2] = z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  function getActorWorldPos(out = new THREE.Vector3()) {
    if (gameState.data.playerMode === 'walking' || transition.active) {
      return out.copy(playerAvatar.root.position);
    }
    return out.copy(boat.state.pos);
  }

  return {
    walkerState,
    castState,
    disembarkAtDock,
    boardBoat,
    warpToHomeDock,
    toggleCastAction,
    cancelCast,
    clearKeys,
    getActorWorldPos,

    update(dt, elapsedTime, cameraYawDeg, addRipple, inputLocked = false) {
      const clampedDt = Math.min(dt, 0.05);

      // 1. Handle smooth parabolic Board_Boat hop transition
      if (transition.active) {
        transition.elapsed += clampedDt;
        const t = clamp(transition.elapsed / transition.duration, 0, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const arcY = Math.sin(t * Math.PI) * 0.55;

        const curX = THREE.MathUtils.lerp(transition.startPos.x, transition.endPos.x, ease);
        const curY = THREE.MathUtils.lerp(transition.startPos.y, transition.endPos.y, ease) + arcY;
        const curZ = THREE.MathUtils.lerp(transition.startPos.z, transition.endPos.z, ease);
        playerAvatar.root.position.set(curX, curY, curZ);

        let diff = transition.endYaw - transition.startYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        playerAvatar.root.rotation.y = transition.startYaw + diff * ease;

        playerAvatar.updateAnimation('Board_Boat', clampedDt, elapsedTime, { progress: t });

        if (t >= 1) {
          transition.active = false;
          if (transition.toMode === 'sailing') {
            boat.seatMount.add(playerAvatar.root);
            playerAvatar.root.position.set(0, 0, 0);
            playerAvatar.root.rotation.set(0, 0, 0);
            boat.setOccupied(true);
          } else {
            walkerState.pos.copy(transition.endPos);
            playerAvatar.root.position.copy(walkerState.pos);
            playerAvatar.root.rotation.set(0, walkerState.yaw, 0);
          }
        }
        return;
      }

      const mode = gameState.data.playerMode;

      // 2. Walking Movement on Land, Piers & Inside Open-Door Houses!
      if (mode === 'walking') {
        const isCasting = castState.phase !== 'none';
        let moveX = 0;
        let moveZ = 0;
        if (!inputLocked && !isCasting) {
          const inX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
          const inZ = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
          const len = Math.hypot(inX, inZ);
          if (len > 0.01) {
            const nx = inX / len;
            const nz = inZ / len;
            // Screen-relative movement rotated by current camera yaw!
            const yawRad = THREE.MathUtils.degToRad(cameraYawDeg);
            const cosY = Math.cos(yawRad);
            const sinY = Math.sin(yawRad);
            moveX = nx * cosY + nz * sinY;
            moveZ = -nx * sinY + nz * cosY;
          }
        }

        const moving = Math.hypot(moveX, moveZ) > 0.01;
        walkerState.isMoving = moving;
        walkerState.running = moving && keys.shift && !gameState.data.insideBuildingId;
        const maxSpeed = walkerState.running ? 4.35 : gameState.data.insideBuildingId ? 2.15 : 2.85;
        const targetSpeed = moving ? maxSpeed : 0;
        walkerState.speed = THREE.MathUtils.lerp(walkerState.speed, targetSpeed, clamp(clampedDt * 12, 0, 1));

        if (moving) {
          const desiredYaw = Math.atan2(moveX, moveZ);
          let diff = desiredYaw - walkerState.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          walkerState.yaw += diff * clamp(clampedDt * 13.0, 0, 1);

          const step = walkerState.speed * clampedDt;
          const tryX = walkerState.pos.x + moveX * step;
          const tryZ = walkerState.pos.z + moveZ * step;

          // Smooth axis-separated shoreline & walkway sliding so player never snags!
          if (town.isWalkableLand(tryX, tryZ)) {
            walkerState.pos.x = tryX;
            walkerState.pos.z = tryZ;
          } else if (town.isWalkableLand(tryX, walkerState.pos.z)) {
            walkerState.pos.x = tryX;
          } else if (town.isWalkableLand(walkerState.pos.x, tryZ)) {
            walkerState.pos.z = tryZ;
          }

          // Resolve walls, closed doors, interior furniture, trees, stall & lighthouse!
          town.resolveLandCollisions(walkerState.pos, 0.27);
        }

        // Smooth ground/pier/floor elevation tracking
        const targetY = town.getWalkableElevation(walkerState.pos.x, walkerState.pos.z);
        walkerState.pos.y = THREE.MathUtils.lerp(walkerState.pos.y, targetY, clamp(clampedDt * 16, 0, 1));

        playerAvatar.root.position.copy(walkerState.pos);
        playerAvatar.root.rotation.set(0, walkerState.yaw, 0);

        if (!isCasting) {
          const act = moving ? (walkerState.running ? 'Run' : 'Walk') : 'Idle';
          playerAvatar.updateAnimation(act, clampedDt, elapsedTime, { speed: walkerState.speed });
        }
      }

      // 3. Fishing Action Rig Update (Cast Arc -> Floating Bobber + Ripples -> Reel Back)
      if (castState.phase !== 'none') {
        const seated = mode === 'sailing';
        castState.timer += clampedDt;
        const tip = playerAvatar.getRodTipWorldPosition();

        if (castState.phase === 'casting') {
          const t = clamp(castState.timer / castState.duration, 0, 1);
          const arcY = Math.sin(t * Math.PI) * 1.65;
          const bx = THREE.MathUtils.lerp(tip.x, castState.bobberPos.x, t);
          const by = THREE.MathUtils.lerp(tip.y, 0.02, t) + arcY;
          const bz = THREE.MathUtils.lerp(tip.z, castState.bobberPos.z, t);
          bobberGroup.position.set(bx, by, bz);
          updateFishingLine(tip, bobberGroup.position, 0.12);
          playerAvatar.updateAnimation('Fish_Cast', clampedDt, elapsedTime, { seated, castProgress: t });

          if (t >= 1) {
            castState.phase = 'waiting';
            castState.timer = 0;
            castState.rippleTimer = 0.9;
            if (addRipple) {
              addRipple({
                x: castState.bobberPos.x,
                z: castState.bobberPos.z,
                dirX: 0,
                dirZ: 1,
                mode: 0,
                radiusScale: 0.56,
                intensity: 0.92,
              });
            }
            const near = ecosystem.findClosestFishNear(castState.bobberPos.x, castState.bobberPos.z, 5.2);
            if (near) {
              castState.nearbyFishName = `${near.spec.nameZh}（${near.agent.lengthCm}cm）`;
              eventBus.emit('ui:toast', {
                text: `浮标落水！附近游动着：${castState.nearbyFishName} · 再按 Space 收竿`,
                portrait: 'dog',
                mood: 'excited',
              });
            } else {
              eventBus.emit('ui:toast', {
                text: '浮标已落水，静候水下鱼群靠近 · 再按 Space 收竿',
                portrait: 'player',
                mood: 'neutral',
              });
            }
          }
        } else if (castState.phase === 'waiting') {
          const bobY = 0.02 + Math.sin(elapsedTime * 2.8) * 0.026;
          bobberGroup.position.set(castState.bobberPos.x, bobY, castState.bobberPos.z);
          bobberGroup.rotation.z = Math.sin(elapsedTime * 2.1) * 0.1;
          updateFishingLine(tip, bobberGroup.position, 0.34);
          playerAvatar.updateAnimation('Fish_Idle', clampedDt, elapsedTime, { seated });

          castState.rippleTimer -= clampedDt;
          if (castState.rippleTimer <= 0 && addRipple) {
            castState.rippleTimer = 1.6;
            addRipple({
              x: castState.bobberPos.x,
              z: castState.bobberPos.z,
              dirX: 1,
              dirZ: 0,
              mode: 1,
              radiusScale: 0.32,
              intensity: 0.42,
            });
          }
        } else if (castState.phase === 'reeling') {
          const t = clamp(castState.timer / castState.duration, 0, 1);
          bobberGroup.position.lerpVectors(castState.bobberPos, tip, t);
          bobberGroup.position.y += Math.sin(t * Math.PI) * 0.55;
          updateFishingLine(tip, bobberGroup.position, 0.08);
          playerAvatar.updateAnimation('Fish_Reel', clampedDt, elapsedTime, { seated });

          if (t >= 1) {
            cancelCast();
          }
        }
      }
    },
  };
}
