import * as THREE from 'three';
import { clamp } from './noise.js';
import { underwaterSharedUniforms } from './underwaterMaterial.js';
import { createAtmosphereSystem, WEATHER_PRESETS } from './atmosphere.js';
import { buildLagoonEnvironment } from './environment.js';
import { buildLakesideTown } from './town.js';
import { buildAquaticEcosystem, buildSwimmingCompanion } from './wildlife.js';
import { createPlayableBoat } from './boat.js';
import { createLagoonWater } from './water.js';

// ---------------------------------------------------------------------------
// 1. Renderer & Scene Setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.5,
  240
);

// ---------------------------------------------------------------------------
// 2. Dynamic Sun, Sky Dome, Lights & Extensible Weather System
// ---------------------------------------------------------------------------
const atmosphere = createAtmosphereSystem(scene, renderer);

// ---------------------------------------------------------------------------
// 3. Build Expanded Lagoon, Lakeside Town, 25-Species Ecosystem, Boat & Water
// ---------------------------------------------------------------------------
const environment = buildLagoonEnvironment(scene);
const town = buildLakesideTown(scene);
const ecosystem = buildAquaticEcosystem(scene);
const companion = buildSwimmingCompanion(scene);
const boat = createPlayableBoat(scene);
const water = createLagoonWater(scene, renderer, atmosphere);

const allColliders = [...environment.isletColliders, ...town.townColliders];

// Seed a gentle welcoming ripple beside the swimming companion on launch
water.addRipple({ x: -1.65, z: -1.45, dirX: -0.9, dirZ: 0.42, mode: 1, radiusScale: 0.34, intensity: 0.55 });

// ---------------------------------------------------------------------------
// 4. Camera Rig (Follow Boat / Town Panorama / Live Fish Species Observer!)
// ---------------------------------------------------------------------------
const camState = {
  mode: 'boat', // 'boat' | 'town' | 'fish'
  watchSpeciesId: null,
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

function updateCameraImmediate() {
  const pitch = THREE.MathUtils.degToRad(camState.pitchDeg);
  const yaw = THREE.MathUtils.degToRad(camState.yawDeg);
  const horiz = Math.cos(pitch) * camState.distance;
  const vert = Math.sin(pitch) * camState.distance;
  camera.position.set(
    camState.target.x + Math.sin(yaw) * horiz,
    Math.max(1.2, camState.target.y + vert),
    camState.target.z + Math.cos(yaw) * horiz
  );
  camera.lookAt(camState.target);
}
updateCameraImmediate();

// Pressing any rowing key smoothly returns camera focus back to the boat!
window.addEventListener('keydown', (e) => {
  if (
    ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
      e.code
    ) &&
    camState.mode !== 'boat'
  ) {
    setCameraMode('boat');
  }
});

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    camState.targetDistance = clamp(camState.targetDistance + e.deltaY * 0.015, 7.5, 42.0);
  },
  { passive: false }
);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
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
  camState.targetPitchDeg = clamp(camState.targetPitchDeg + dy * 0.18, 14, 76);
  const pitchSlider = document.getElementById('ctrl-pitch');
  if (pitchSlider) pitchSlider.value = String(Math.round(camState.targetPitchDeg));
});

// ---------------------------------------------------------------------------
// 5. Look-Dev, Town Tour, Weather & Interactive 25-Species Fish Guide UI
// ---------------------------------------------------------------------------
const btnTown = document.getElementById('btn-focus-town');
const pitchSlider = document.getElementById('ctrl-pitch');
const sunElevSlider = document.getElementById('ctrl-sun-elev');
const sunAzimSlider = document.getElementById('ctrl-sun-azim');
const sparkleSlider = document.getElementById('ctrl-sparkle');
const tweakPanel = document.getElementById('tweak-panel');
const fishPanel = document.getElementById('fish-panel');
const fishListContainer = document.getElementById('fish-catalog-list');

function highlightSelectedSpecies(activeId) {
  document.querySelectorAll('.species-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.speciesId === activeId);
  });
}

function setCameraMode(mode, speciesId = null) {
  camState.mode = mode;
  camState.watchSpeciesId = speciesId;
  highlightSelectedSpecies(speciesId);

  if (mode === 'town') {
    camState.targetDistance = 31.8;
    camState.targetPitchDeg = 22;
    camState.targetYawDeg = -8;
    if (btnTown) btnTown.textContent = '回到小船';
  } else if (mode === 'fish') {
    camState.targetDistance = 12.2;
    camState.targetPitchDeg = 56;
    if (btnTown) btnTown.textContent = '回到小船';
  } else {
    camState.targetDistance = 23.6;
    camState.targetPitchDeg = 52;
    camState.targetYawDeg = 0;
    if (btnTown) btnTown.textContent = '看岸边小镇';
  }
  if (pitchSlider) pitchSlider.value = String(Math.round(camState.targetPitchDeg));
}

// Populate interactive 25-species Fish Guide drawer
if (fishListContainer) {
  const countBadge = document.getElementById('fish-total-badge');
  if (countBadge) {
    countBadge.textContent = `${ecosystem.speciesCatalog.length} 种 · ${ecosystem.totalCount} 只`;
  }

  const grouped = new Map();
  for (const sp of ecosystem.speciesCatalog) {
    if (!grouped.has(sp.category)) grouped.set(sp.category, []);
    grouped.get(sp.category).push(sp);
  }

  for (const [category, list] of grouped.entries()) {
    const catHeader = document.createElement('div');
    catHeader.className = 'species-cat';
    catHeader.textContent = category;
    fishListContainer.appendChild(catHeader);

    for (const sp of list) {
      const btn = document.createElement('button');
      btn.className = 'species-item';
      btn.dataset.speciesId = sp.id;
      btn.innerHTML = `
        <span class="species-swatch" style="background:${sp.swatch}"></span>
        <span class="species-name">${sp.nameZh}</span>
        <span class="species-meta">${sp.sizeLabel} ×${sp.count}</span>
      `;
      btn.addEventListener('click', () => {
        if (camState.mode === 'fish' && camState.watchSpeciesId === sp.id) {
          setCameraMode('boat');
        } else {
          setCameraMode('fish', sp.id);
        }
      });
      fishListContainer.appendChild(btn);
    }
  }
}

btnTown?.addEventListener('click', () => {
  setCameraMode(camState.mode === 'boat' ? 'town' : 'boat');
});

document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
  setCameraMode('boat');
});

document.getElementById('btn-toggle-fish')?.addEventListener('click', () => {
  const willShow = fishPanel?.classList.contains('hidden');
  tweakPanel?.classList.add('hidden');
  if (willShow) fishPanel?.classList.remove('hidden');
  else fishPanel?.classList.add('hidden');
});
document.getElementById('btn-close-fish')?.addEventListener('click', () => {
  fishPanel?.classList.add('hidden');
});

document.getElementById('btn-toggle-panel')?.addEventListener('click', () => {
  const willShow = tweakPanel?.classList.contains('hidden');
  fishPanel?.classList.add('hidden');
  if (willShow) tweakPanel?.classList.remove('hidden');
  else tweakPanel?.classList.add('hidden');
});
document.getElementById('btn-close-panel')?.addEventListener('click', () => {
  tweakPanel?.classList.add('hidden');
});

const weatherButtons = document.querySelectorAll('.weather-btn');
function syncWeatherUI(presetKey) {
  const p = WEATHER_PRESETS[presetKey];
  if (!p) return;
  weatherButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.weather === presetKey);
  });
  if (sunElevSlider) sunElevSlider.value = String(p.elevation);
  if (sunAzimSlider) sunAzimSlider.value = String(p.azimuth);
  if (sparkleSlider) sparkleSlider.value = String(p.sparkleBoost);
  water.uniforms.uSparkleIntensity.value = p.sparkleBoost;
}

weatherButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.weather;
    atmosphere.applyPreset(key);
    syncWeatherUI(key);
  });
});

sunElevSlider?.addEventListener('input', (e) => {
  atmosphere.setSunAngles(parseFloat(e.target.value), undefined);
});
sunAzimSlider?.addEventListener('input', (e) => {
  atmosphere.setSunAngles(undefined, parseFloat(e.target.value));
});

document.getElementById('ctrl-clarity')?.addEventListener('input', (e) => {
  water.uniforms.uWaterClarity.value = parseFloat(e.target.value);
});
sparkleSlider?.addEventListener('input', (e) => {
  water.uniforms.uSparkleIntensity.value = parseFloat(e.target.value);
});
document.getElementById('ctrl-caustics')?.addEventListener('input', (e) => {
  underwaterSharedUniforms.uCausticsIntensity.value = parseFloat(e.target.value);
});
pitchSlider?.addEventListener('input', (e) => {
  camState.targetPitchDeg = parseFloat(e.target.value);
});
document.getElementById('ctrl-companion')?.addEventListener('change', (e) => {
  companion.setVisible(e.target.checked);
});

// ---------------------------------------------------------------------------
// 6. Resize & Main Render Loop
// ---------------------------------------------------------------------------
function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  water.resize(w, h, dpr);
}
window.addEventListener('resize', handleResize);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  underwaterSharedUniforms.uTime.value = elapsed;

  // Update simulation
  boat.update(dt, elapsed, allColliders, water.addRipple, atmosphere.state.nightGlow);
  companion.update(dt, elapsed, boat.state, water.addRipple);
  environment.update(dt, elapsed, boat.state, companion.root.visible ? companion.pos : null);
  town.update(dt, elapsed, atmosphere.state.nightGlow);
  ecosystem.update(dt, elapsed, boat.state, allColliders, water.addRipple);

  // Smooth camera tracking: boat / town panorama / live fish specimen observer!
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
  }

  camState.target.x = THREE.MathUtils.lerp(camState.target.x, desiredTargetX, clamp(dt * 3.6, 0, 1));
  camState.target.y = THREE.MathUtils.lerp(camState.target.y, desiredTargetY, clamp(dt * 3.6, 0, 1));
  camState.target.z = THREE.MathUtils.lerp(camState.target.z, desiredTargetZ, clamp(dt * 3.6, 0, 1));
  camState.distance = THREE.MathUtils.lerp(camState.distance, camState.targetDistance, clamp(dt * 5.0, 0, 1));
  camState.pitchDeg = THREE.MathUtils.lerp(camState.pitchDeg, camState.targetPitchDeg, clamp(dt * 5.0, 0, 1));
  camState.yawDeg = THREE.MathUtils.lerp(camState.yawDeg, camState.targetYawDeg, clamp(dt * 5.0, 0, 1));

  updateCameraImmediate();
  atmosphere.update(elapsed, camState.target);

  water.update(elapsed, camera, boat.state);
  water.renderRefractionPass(renderer, scene, camera);
  renderer.render(scene, camera);
}

animate();
