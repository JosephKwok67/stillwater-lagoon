import * as THREE from 'three';
import { clamp } from '../noise.js';

/**
 * Smart Camera Director: manages smooth target tracking, distance/pitch/yaw transitions,
 * pointer orbit/zoom controls, and mode switching (boat / walking / indoor / town / fish / aquarium / dialogue).
 */
export function createCameraDirector({
  camera,
  canvas,
  playerAvatar,
  initialMode = 'boat',
  btnTown,
  pitchSlider,
  onSpeciesHighlight,
  onFishingActionDown,
  getFishingPhase,
}) {
  const camState = {
    mode: initialMode,
    watchSpeciesId: null,
    focusNpcId: null,
    target: new THREE.Vector3(-0.35, 0, 0.1),
    distance: 23.6,
    targetDistance: 23.6,
    pitchDeg: 52,
    targetPitchDeg: 52,
    yawDeg: 0,
    targetYawDeg: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  function updateImmediate() {
    const pitch = THREE.MathUtils.degToRad(camState.pitchDeg);
    const yaw = THREE.MathUtils.degToRad(camState.yawDeg);
    const horiz = Math.cos(pitch) * camState.distance;
    const vert = Math.sin(pitch) * camState.distance;
    camera.position.set(
      camState.target.x + Math.sin(yaw) * horiz,
      Math.max(1.1, camState.target.y + vert),
      camState.target.z + Math.cos(yaw) * horiz
    );
    camera.lookAt(camState.target);
  }

  function setMode(mode, extraId = null) {
    camState.mode = mode;
    camState.watchSpeciesId = mode === 'fish' ? extraId : null;
    camState.focusNpcId = mode === 'dialogue' ? extraId : null;
    if (onSpeciesHighlight) onSpeciesHighlight(camState.watchSpeciesId);

    playerAvatar.root.visible = mode !== 'aquarium';

    if (mode === 'town') {
      camState.targetDistance = 39.5;
      camState.targetPitchDeg = 11.5;
      camState.targetYawDeg = -3;
      if (btnTown) btnTown.textContent = '回到主角';
    } else if (mode === 'fish') {
      camState.targetDistance = 12.2;
      camState.targetPitchDeg = 56;
      if (btnTown) btnTown.textContent = '回到主角';
    } else if (mode === 'aquarium') {
      camState.targetDistance = 2.68;
      camState.targetPitchDeg = 8;
      camState.targetYawDeg = 0;
      if (btnTown) btnTown.textContent = '看岸边小镇';
    } else if (mode === 'dialogue') {
      camState.targetDistance = 9.4;
      camState.targetPitchDeg = 36;
      if (btnTown) btnTown.textContent = '看岸边小镇';
    } else if (mode === 'indoor') {
      camState.targetDistance = 10.6;
      camState.targetPitchDeg = 49;
      if (btnTown) btnTown.textContent = '看岸边小镇';
    } else if (mode === 'walking') {
      camState.targetDistance = 15.6;
      camState.targetPitchDeg = 44;
      if (btnTown) btnTown.textContent = '看岸边小镇';
    } else {
      camState.targetDistance = 23.6;
      camState.targetPitchDeg = 52;
      if (btnTown) btnTown.textContent = '看岸边小镇';
    }
    if (pitchSlider) pitchSlider.value = String(Math.round(camState.targetPitchDeg));
  }

  // Pointer orbit & scroll zoom controls on canvas
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const minDist = camState.mode === 'aquarium' ? 1.85 : camState.mode === 'indoor' ? 6.2 : 7.5;
      camState.targetDistance = clamp(camState.targetDistance + e.deltaY * 0.015, minDist, 42.0);
    },
    { passive: false }
  );

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    const phase = getFishingPhase ? getFishingPhase() : 'idle';
    if (e.button === 0 && (phase === 'bite' || phase === 'fighting')) {
      if (onFishingActionDown) onFishingActionDown();
      return;
    }
    camState.dragging = true;
    camState.lastX = e.clientX;
    camState.lastY = e.clientY;
  });

  window.addEventListener('pointerup', () => {
    camState.dragging = false;
  });

  window.addEventListener('pointermove', (e) => {
    if (!camState.dragging) return;
    const dx = e.clientX - camState.lastX;
    const dy = e.clientY - camState.lastY;
    camState.lastX = e.clientX;
    camState.lastY = e.clientY;

    camState.targetYawDeg = clamp(camState.targetYawDeg - dx * 0.25, -180, 180);
    camState.targetPitchDeg = clamp(camState.targetPitchDeg + dy * 0.18, 10, 76);
    if (pitchSlider) pitchSlider.value = String(Math.round(camState.targetPitchDeg));
  });

  function update(dt, { boat, town, townNpcs, ecosystem, playerController, fishingSystem, insideBuilding, isWalking }) {
    let desiredTargetX = boat.state.pos.x + 0.8;
    let desiredTargetY = 0.0;
    let desiredTargetZ = boat.state.pos.z - 0.65;

    if (camState.mode === 'town') {
      desiredTargetX = town.homeViewTarget.x;
      desiredTargetY = town.homeViewTarget.y;
      desiredTargetZ = town.homeViewTarget.z;
    } else if (camState.mode === 'fish' && camState.watchSpeciesId) {
      const fishPos = ecosystem.getSpeciesFocusPosition(camState.watchSpeciesId, 0);
      if (fishPos) {
        desiredTargetX = fishPos.x;
        desiredTargetY = -0.2;
        desiredTargetZ = fishPos.z;
      }
    } else if (camState.mode === 'aquarium' && town.playerHome?.worldAnchors?.aquarium) {
      const aq = town.playerHome.worldAnchors.aquarium;
      desiredTargetX = aq.x + 0.28;
      desiredTargetY = aq.y;
      desiredTargetZ = aq.z;
    } else if (camState.mode === 'dialogue' && camState.focusNpcId) {
      const npc = townNpcs.getById(camState.focusNpcId);
      if (npc) {
        desiredTargetX = THREE.MathUtils.lerp(npc.pos.x, playerController.walkerState.pos.x, 0.35);
        desiredTargetY = npc.pos.y + 0.82;
        desiredTargetZ = THREE.MathUtils.lerp(npc.pos.z, playerController.walkerState.pos.z, 0.35);
      }
    } else if (camState.mode === 'indoor' && insideBuilding) {
      desiredTargetX = THREE.MathUtils.lerp(
        insideBuilding.interiorCenterWorld.x,
        playerController.walkerState.pos.x,
        0.38
      );
      desiredTargetY = insideBuilding.interiorCenterWorld.y + 0.25;
      desiredTargetZ = THREE.MathUtils.lerp(
        insideBuilding.interiorCenterWorld.z,
        playerController.walkerState.pos.z,
        0.38
      );
    } else if (isWalking) {
      desiredTargetX = playerController.walkerState.pos.x;
      desiredTargetY = playerController.walkerState.pos.y + 0.65;
      desiredTargetZ = playerController.walkerState.pos.z;
    }

    const fishingActive = fishingSystem.isActive();
    if (
      fishingActive &&
      camState.mode !== 'town' &&
      camState.mode !== 'fish' &&
      camState.mode !== 'aquarium' &&
      ['charging', 'casting', 'waiting', 'bite', 'fighting'].includes(fishingSystem.state.phase)
    ) {
      const focusPt =
        fishingSystem.state.phase === 'fighting'
          ? fishingSystem.state.fightPos
          : fishingSystem.state.phase === 'charging'
            ? fishingSystem.state.targetPos
            : fishingSystem.state.bobberPos;
      desiredTargetX = THREE.MathUtils.lerp(desiredTargetX, focusPt.x, 0.36);
      desiredTargetZ = THREE.MathUtils.lerp(desiredTargetZ, focusPt.z, 0.36);
    }

    camState.target.x = THREE.MathUtils.lerp(camState.target.x, desiredTargetX, clamp(dt * 4.2, 0, 1));
    camState.target.y = THREE.MathUtils.lerp(camState.target.y, desiredTargetY, clamp(dt * 4.2, 0, 1));
    camState.target.z = THREE.MathUtils.lerp(camState.target.z, desiredTargetZ, clamp(dt * 4.2, 0, 1));
    camState.distance = THREE.MathUtils.lerp(camState.distance, camState.targetDistance, clamp(dt * 5.2, 0, 1));
    camState.pitchDeg = THREE.MathUtils.lerp(camState.pitchDeg, camState.targetPitchDeg, clamp(dt * 5.2, 0, 1));
    camState.yawDeg = THREE.MathUtils.lerp(camState.yawDeg, camState.targetYawDeg, clamp(dt * 5.2, 0, 1));

    updateImmediate();
  }

  return {
    state: camState,
    setMode,
    updateImmediate,
    update,
  };
}
