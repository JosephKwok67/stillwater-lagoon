import * as THREE from 'three';
import { clamp } from '../noise.js';

/**
 * Unified Player Land Movement & Seamless Boat Boarding/Disembarking Controller.
 * (Casting & reeling live cleanly in `fishingSystem.js`.)
 */
export function createPlayerController({
  scene,
  playerAvatar,
  boat,
  town,
  companion,
  gameState,
  eventBus,
}) {
  const walkerState = {
    pos: new THREE.Vector3(3.6, 0.5, -13.5),
    yaw: Math.PI,
    speed: 0,
    running: false,
    isMoving: false,
  };

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

  const keys = { w: false, s: false, a: false, d: false, shift: false };
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

  function disembarkAtDock(dock) {
    if (transition.active) return;

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
    transition.endYaw = Math.PI;

    walkerState.pos.copy(dock.disembarkPos);
    walkerState.yaw = Math.PI;
    gameState.setPlayerMode('walking');

    if (companion) {
      companion.teleportNear(dock.disembarkPos.x + 0.55, dock.disembarkPos.y, dock.disembarkPos.z + 0.35, true);
    }

    eventBus.emit('ui:toast', {
      text: `已停靠「${dock.nameZh}」，WASD 漫步小镇 · 靠近房门按 E 推门进屋`,
      portrait: 'dog',
      mood: 'happy',
    });
  }

  function boardBoat() {
    if (transition.active) return;

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
      text: '已登船出海！按住 Space 蓄力抛竿钓鱼 · 靠码头按 E 上岸',
      portrait: 'player',
      mood: 'happy',
    });
  }

  function warpToHomeDock() {
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

  function getActorWorldPos(out = new THREE.Vector3()) {
    if (gameState.data.playerMode === 'walking' || transition.active) {
      return out.copy(playerAvatar.root.position);
    }
    return out.copy(boat.state.pos);
  }

  return {
    walkerState,
    isTransitioning: () => transition.active,
    disembarkAtDock,
    boardBoat,
    warpToHomeDock,
    clearKeys,
    getActorWorldPos,

    update(dt, elapsedTime, cameraYawDeg, inputLocked = false, fishingActive = false, extraColliders = null) {
      const clampedDt = Math.min(dt, 0.05);

      if (transition.active) {
        transition.elapsed += clampedDt;
        const t = clamp(transition.elapsed / transition.duration, 0, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const arcY = Math.sin(t * Math.PI) * 0.55;

        playerAvatar.root.position.set(
          THREE.MathUtils.lerp(transition.startPos.x, transition.endPos.x, ease),
          THREE.MathUtils.lerp(transition.startPos.y, transition.endPos.y, ease) + arcY,
          THREE.MathUtils.lerp(transition.startPos.z, transition.endPos.z, ease)
        );

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

      if (gameState.data.playerMode !== 'walking') return;

      let moveX = 0;
      let moveZ = 0;
      if (!inputLocked && !fishingActive) {
        const inX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        const inZ = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
        const len = Math.hypot(inX, inZ);
        if (len > 0.01) {
          const nx = inX / len;
          const nz = inZ / len;
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

        if (town.isWalkableLand(tryX, tryZ)) {
          walkerState.pos.x = tryX;
          walkerState.pos.z = tryZ;
        } else if (town.isWalkableLand(tryX, walkerState.pos.z)) {
          walkerState.pos.x = tryX;
        } else if (town.isWalkableLand(walkerState.pos.x, tryZ)) {
          walkerState.pos.z = tryZ;
        }

        town.resolveLandCollisions(walkerState.pos, 0.27, extraColliders);
      }

      const targetY = town.getWalkableElevation(walkerState.pos.x, walkerState.pos.z);
      walkerState.pos.y = THREE.MathUtils.lerp(walkerState.pos.y, targetY, clamp(clampedDt * 16, 0, 1));

      playerAvatar.root.position.copy(walkerState.pos);
      playerAvatar.root.rotation.set(0, walkerState.yaw, 0);

      if (!fishingActive) {
        const act = moving ? (walkerState.running ? 'Run' : 'Walk') : 'Idle';
        playerAvatar.updateAnimation(act, clampedDt, elapsedTime, { speed: walkerState.speed });
      }
    },
  };
}
