import * as THREE from 'three';
import { clamp } from './noise.js';
import { underwaterSharedUniforms } from './underwaterMaterial.js';
import { createAtmosphereSystem, WEATHER_PRESETS } from './atmosphere.js';
import { buildLagoonEnvironment } from './environment.js';
import { buildLakesideTown } from './town.js';
import { buildAquaticEcosystem, buildSwimmingCompanion } from './wildlife.js';
import { createPlayableBoat } from './boat.js';
import { createLagoonWater } from './water.js';
import { createPlayerAvatar } from './player.js';
import { createEventBus } from './core/eventBus.js';
import { createGameState } from './core/gameState.js';
import { createInteractionSystem } from './core/interactionSystem.js';
import { createPlayerController } from './core/playerController.js';
import {
  ROD_CATALOG,
  BAIT_CATALOG,
  PORTRAITS,
  getFishIconUrl,
  getRodSpec,
  getBaitSpec,
} from './core/assetRegistry.js';

// ---------------------------------------------------------------------------
// 1. Core Foundation Systems (EventBus, Persistent GameState, InteractionSystem)
// ---------------------------------------------------------------------------
const eventBus = createEventBus();
const gameState = createGameState(eventBus);
const interactionSystem = createInteractionSystem(eventBus);

// ---------------------------------------------------------------------------
// 2. Renderer & Scene Setup
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
  0.2,
  240
);

// ---------------------------------------------------------------------------
// 3. Dynamic Atmosphere, Lagoon World, Enterable Town, Ecosystem, Avatar & Boat
// ---------------------------------------------------------------------------
const atmosphere = createAtmosphereSystem(scene, renderer);
const environment = buildLagoonEnvironment(scene);
const town = buildLakesideTown(scene);
const ecosystem = buildAquaticEcosystem(scene);
const companion = buildSwimmingCompanion(scene);

const playerAvatar = createPlayerAvatar();
playerAvatar.setRodStyle(gameState.data.equipment.rodId);

const boat = createPlayableBoat(scene, playerAvatar, gameState.data.boatPose);
const water = createLagoonWater(scene, renderer, atmosphere);

const playerController = createPlayerController({
  scene,
  playerAvatar,
  boat,
  town,
  ecosystem,
  companion,
  gameState,
  eventBus,
});

// Sync indoor Home Aquarium live 3D fish with saved state!
town.syncHomeAquarium(gameState.data.aquariumFish);
eventBus.on('aquarium:updated', (list) => {
  town.syncHomeAquarium(list);
  renderAquariumModal();
});

// Apply saved weather preset on boot
atmosphere.applyPreset(gameState.data.weather);

// If save resumed in walking mode, place player neatly on their last moored dock
if (gameState.data.playerMode === 'walking') {
  const dock = town.docks.find((d) => d.id === gameState.data.mooredDockId) || town.docks[0];
  scene.add(playerAvatar.root);
  playerController.walkerState.pos.copy(dock.disembarkPos);
  playerController.walkerState.yaw = Math.PI;
  playerAvatar.root.position.copy(dock.disembarkPos);
  playerAvatar.root.rotation.set(0, Math.PI, 0);
  boat.setOccupied(false);
  boat.state.pos.copy(dock.boatMoorPos);
  boat.state.yaw = dock.boatMoorYaw;
  companion.teleportNear(dock.disembarkPos.x + 0.55, dock.disembarkPos.y, dock.disembarkPos.z + 0.35, true);
}

const allWaterColliders = [...environment.isletColliders, ...town.townColliders];
water.addRipple({ x: -1.65, z: -1.45, dirX: -0.9, dirZ: 0.42, mode: 1, radiusScale: 0.34, intensity: 0.55 });

// ---------------------------------------------------------------------------
// 4. Smart Camera Director (Boat / Walking / Indoor Cutaway / Aquarium / Town / Fish)
// ---------------------------------------------------------------------------
const camState = {
  mode: gameState.data.playerMode === 'walking' ? 'walking' : 'boat',
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
    Math.max(1.1, camState.target.y + vert),
    camState.target.z + Math.cos(yaw) * horiz
  );
  camera.lookAt(camState.target);
}

function setCameraMode(mode, speciesId = null) {
  camState.mode = mode;
  camState.watchSpeciesId = speciesId;
  highlightSelectedSpecies(speciesId);

  if (mode === 'town') {
    camState.targetDistance = 31.8;
    camState.targetPitchDeg = 24;
    camState.targetYawDeg = -6;
    if (btnTown) btnTown.textContent = '回到主角';
  } else if (mode === 'fish') {
    camState.targetDistance = 12.2;
    camState.targetPitchDeg = 56;
    if (btnTown) btnTown.textContent = '回到主角';
  } else if (mode === 'aquarium') {
    camState.targetDistance = 2.45;
    camState.targetPitchDeg = 12;
    camState.targetYawDeg = 3;
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

// ---------------------------------------------------------------------------
// 5. Register World Interactables (Docks, Moored Boat, Openable Doors, Aquarium, Bed, Farm)
// ---------------------------------------------------------------------------
// A. Wooden Piers -> Disembark when boating close
for (const dock of town.docks) {
  interactionSystem.register({
    id: `disembark_${dock.id}`,
    modes: ['sailing'],
    radius: 4.3,
    priority: 3,
    promptYOffset: 1.55,
    getPosition: () => dock.triggerPos,
    getLabel: () => `停船上岸 · ${dock.nameZh}`,
    onInteract: () => {
      playerController.disembarkAtDock(dock);
      setCameraMode('walking');
    },
  });
}

// B. Moored Boat -> Board back onto the water when walking nearby
interactionSystem.register({
  id: 'board_boat',
  modes: ['walking'],
  radius: 3.3,
  priority: 3,
  promptYOffset: 1.15,
  getPosition: () => boat.state.pos,
  canInteract: () => !gameState.data.insideBuildingId,
  getLabel: () => '登船出海',
  onInteract: () => {
    playerController.boardBoat();
    setCameraMode('boat');
  },
});

// C. Seamless Openable Hinged Doors on ALL Enterable Buildings!
for (const b of town.enterableBuildings) {
  interactionSystem.register({
    id: `door_${b.id}`,
    modes: ['walking'],
    radius: 1.85,
    priority: 5,
    promptYOffset: 1.45,
    getPosition: () => b.doorWorldPos,
    getLabel: () => (b.isDoorOpen ? `关上门 · ${b.nameZh}` : `推开门进入 · ${b.nameZh}`),
    onInteract: () => {
      const opened = b.toggleDoor();
      playerAvatar.triggerInteractPulse();
      eventBus.emit('ui:toast', {
        text: opened ? `已推开「${b.nameZh}」的木门，直接走进去吧！` : `已轻轻关上「${b.nameZh}」的木门`,
        portrait: 'player',
        mood: opened ? 'happy' : 'neutral',
      });
    },
  });
}

// D. Indoor Home Aquarium Inspection!
const aquariumModal = document.getElementById('aquarium-modal');
function openAquariumView() {
  if (aquariumModal) aquariumModal.classList.remove('hidden');
  renderAquariumModal();
  setCameraMode('aquarium');
  playerController.clearKeys();
}
function closeAquariumView() {
  if (aquariumModal) aquariumModal.classList.add('hidden');
  if (camState.mode === 'aquarium') {
    setCameraMode(gameState.data.insideBuildingId ? 'indoor' : 'walking');
  }
}

if (town.playerHome?.worldAnchors?.aquarium) {
  interactionSystem.register({
    id: 'home_aquarium',
    modes: ['walking'],
    radius: 1.65,
    priority: 4,
    promptYOffset: 0.85,
    getPosition: () => town.playerHome.worldAnchors.aquarium,
    canInteract: () => gameState.data.insideBuildingId === 'player_home',
    getLabel: () => `观赏家里鱼缸（${gameState.data.aquariumFish.length} 条）`,
    onInteract: () => openAquariumView(),
  });
}

// E. Indoor Cozy Bed -> Relaxing Nap to Cycle Time/Weather (Advances Day on new morning!)
const WEATHER_CYCLE = ['morning', 'sunny', 'sunset', 'overcast'];
const WEATHER_NAMES = {
  morning: '清晨微光',
  sunny: '晴朗午后',
  sunset: '黄金日落',
  overcast: '薄雾微阴',
};

if (town.playerHome?.worldAnchors?.bed) {
  interactionSystem.register({
    id: 'home_bed',
    modes: ['walking'],
    radius: 1.45,
    priority: 4,
    promptYOffset: 0.75,
    getPosition: () => town.playerHome.worldAnchors.bed,
    canInteract: () => gameState.data.insideBuildingId === 'player_home',
    getLabel: () => '小憩片刻（切换时段）',
    onInteract: () => {
      const curIdx = WEATHER_CYCLE.indexOf(gameState.data.weather);
      const nextIdx = (curIdx + 1) % WEATHER_CYCLE.length;
      const nextWeather = WEATHER_CYCLE[nextIdx];
      const newDay = nextIdx === 0;
      atmosphere.applyPreset(nextWeather);
      syncWeatherUI(nextWeather);
      gameState.setWeather(nextWeather, newDay);
      eventBus.emit('ui:toast', {
        text: newDay
          ? `美美睡了一觉，迎来了第 ${gameState.data.day} 天的${WEATHER_NAMES[nextWeather]}！`
          : `小憩片刻，窗外已是「${WEATHER_NAMES[nextWeather]}」时分`,
        portrait: 'player',
        mood: 'happy',
      });
    },
  });
}

// F. Artisan Workshop Workbench (inside Old Zhou's enterable workshop!)
const workshopBuilding = town.enterableBuildings.find((b) => b.id === 'artisan_workshop');
if (workshopBuilding?.worldAnchors?.workbench) {
  interactionSystem.register({
    id: 'artisan_workbench',
    modes: ['walking'],
    radius: 1.75,
    priority: 4,
    promptYOffset: 0.85,
    getPosition: () => workshopBuilding.worldAnchors.workbench,
    canInteract: () => gameState.data.insideBuildingId === 'artisan_workshop',
    getLabel: () => '查看老周的制竿工作台',
    onInteract: () => {
      eventBus.emit('ui:toast', {
        text: '老周：「等下一批鱼图鉴和对话接好，就能在这里给你打造新鱼竿和鱼饵啦！」',
        portrait: 'npc_artisan',
        mood: 'happy',
      });
    },
  });
}

// G. Reserved Sunny Garden Farm Plot beside Player's Cottage!
interactionSystem.register({
  id: 'future_farm_plot',
  modes: ['walking'],
  radius: 2.15,
  priority: 2,
  promptYOffset: 0.75,
  getPosition: () => town.farmPlotAnchor,
  canInteract: () => !gameState.data.insideBuildingId,
  getLabel: () => '查看向阳菜地（种田预留）',
  onInteract: () => {
    eventBus.emit('ui:toast', {
      text: '已预留 12 块向阳肥沃菜地，后续版本将开放翻土、播种、浇水与自制谷物鱼饵！',
      portrait: 'player',
      mood: 'happy',
    });
  },
});

// ---------------------------------------------------------------------------
// 6. HUD, Codex Art Binding, Controls & Toast System
// ---------------------------------------------------------------------------
const btnTown = document.getElementById('btn-focus-town');
const pitchSlider = document.getElementById('ctrl-pitch');
const sunElevSlider = document.getElementById('ctrl-sun-elev');
const sunAzimSlider = document.getElementById('ctrl-sun-azim');
const sparkleSlider = document.getElementById('ctrl-sparkle');
const tweakPanel = document.getElementById('tweak-panel');
const fishPanel = document.getElementById('fish-panel');
const fishListContainer = document.getElementById('fish-catalog-list');
const interactPromptEl = document.getElementById('interact-prompt');
const interactKeyEl = document.getElementById('interact-key');
const interactTextEl = document.getElementById('interact-text');
const toastEl = document.getElementById('toast-banner');
const toastImgEl = document.getElementById('toast-portrait');
const toastMsgEl = document.getElementById('toast-msg');

let toastTimeout = null;
function showToast({ text, portrait = 'player', mood = 'neutral' }) {
  if (!toastEl || !toastMsgEl) return;
  toastMsgEl.textContent = text;
  if (toastImgEl) {
    const src = (PORTRAITS[portrait] && PORTRAITS[portrait][mood]) || PORTRAITS.player.neutral;
    toastImgEl.src = src;
  }
  toastEl.classList.remove('hidden');
  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 4200);
}
eventBus.on('ui:toast', showToast);

// Sync Player Status Bar (Portrait, Day, Mode, Coins, Echo, Basket, Active Rod & Bait)
function syncHudState() {
  const s = gameState.data;
  const coinsEl = document.getElementById('hud-coins');
  const echoEl = document.getElementById('hud-echo');
  const basketEl = document.getElementById('hud-basket');
  const dayEl = document.getElementById('hud-day-badge');
  const modeEl = document.getElementById('hud-mode-badge');
  const rodImg = document.getElementById('btn-rod-img');
  const rodName = document.getElementById('btn-rod-name');
  const baitImg = document.getElementById('btn-bait-img');
  const baitName = document.getElementById('btn-bait-name');

  if (coinsEl) coinsEl.textContent = String(s.coins);
  if (echoEl) echoEl.textContent = String(s.echoPoints);
  if (basketEl) basketEl.textContent = `${s.inventory.length}`;
  if (dayEl) dayEl.textContent = `第 ${s.day} 天`;
  if (modeEl) {
    if (s.insideBuildingId) {
      const b = town.enterableBuildings.find((item) => item.id === s.insideBuildingId);
      modeEl.textContent = `屋内 · ${b ? b.nameZh : '小屋'}`;
    } else if (s.playerMode === 'walking') {
      modeEl.textContent = '小镇漫步';
    } else {
      modeEl.textContent = '划船出海';
    }
  }

  const rod = getRodSpec(s.equipment.rodId);
  const bait = getBaitSpec(s.equipment.baitId);
  if (rodImg) rodImg.src = rod.icon;
  if (rodName) rodName.textContent = rod.nameZh;
  if (baitImg) baitImg.src = bait.icon;
  if (baitName) baitName.textContent = bait.nameZh;
}
eventBus.on('state:changed', syncHudState);
syncHudState();

// Render Home Aquarium Inspection Modal
function renderAquariumModal() {
  const listEl = document.getElementById('aquarium-fish-list');
  if (!listEl) return;
  const specMap = new Map(ecosystem.speciesCatalog.map((sp) => [sp.id, sp]));
  listEl.innerHTML = '';

  const fishes = gameState.data.aquariumFish;
  if (!fishes.length) {
    listEl.innerHTML = '<div class="aq-empty">鱼缸目前空着，去湖里钓几条喜欢的鱼带回家养吧！</div>';
    return;
  }

  for (const rec of fishes) {
    const sp = specMap.get(rec.speciesId);
    const iconUrl = getFishIconUrl(rec.speciesId);
    const row = document.createElement('div');
    row.className = 'aq-fish-row';
    row.innerHTML = `
      <div class="aq-fish-thumb">
        ${iconUrl ? `<img src="${iconUrl}" alt="${sp?.nameZh || ''}" />` : `<span class="species-swatch" style="background:${sp?.swatch || '#6fd3c4'}"></span>`}
      </div>
      <div class="aq-fish-info">
        <div class="aq-fish-name">${sp?.nameZh || rec.speciesId} <span class="aq-grade">${rec.grade || '普通'}</span></div>
        <div class="aq-fish-sub">体长 ${rec.lengthCm} cm · 第 ${rec.caughtDay || 1} 天入缸</div>
      </div>
    `;
    listEl.appendChild(row);
  }
}

document.getElementById('btn-close-aquarium')?.addEventListener('click', closeAquariumView);

// Quick Gear Switchers (showcasing all 4 Codex Rods & 4 Baits right in the action bar!)
document.getElementById('btn-cycle-rod')?.addEventListener('click', () => {
  const idx = ROD_CATALOG.findIndex((r) => r.id === gameState.data.equipment.rodId);
  const next = ROD_CATALOG[(idx + 1) % ROD_CATALOG.length];
  gameState.setEquipment({ rodId: next.id });
  playerAvatar.setRodStyle(next.id);
  showToast({ text: `已切换鱼竿：${next.nameZh}（${next.desc}）`, portrait: 'player', mood: 'happy' });
});

document.getElementById('btn-cycle-bait')?.addEventListener('click', () => {
  const idx = BAIT_CATALOG.findIndex((b) => b.id === gameState.data.equipment.baitId);
  const next = BAIT_CATALOG[(idx + 1) % BAIT_CATALOG.length];
  gameState.setEquipment({ baitId: next.id });
  showToast({ text: `已切换鱼饵：${next.nameZh}（偏好：${next.targetHint}）`, portrait: 'player', mood: 'neutral' });
});

document.getElementById('btn-cast-action')?.addEventListener('click', () => {
  playerController.toggleCastAction(water.addRipple);
});

document.getElementById('btn-warp-home')?.addEventListener('click', () => {
  closeAquariumView();
  playerController.warpToHomeDock();
  setCameraMode(gameState.data.playerMode === 'walking' ? 'walking' : 'boat');
});

// Keyboard shortcuts: E (Interact), Space/F (Cast/Reel), Esc (Close overlays), WASD returns focus
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (e.code === 'Escape') {
    closeAquariumView();
    fishPanel?.classList.add('hidden');
    tweakPanel?.classList.add('hidden');
    return;
  }

  if (e.code === 'KeyE') {
    if (camState.mode === 'aquarium') {
      closeAquariumView();
      return;
    }
    interactionSystem.trigger({ mode: gameState.data.playerMode });
    return;
  }

  if (e.code === 'Space' || e.code === 'KeyF') {
    if (camState.mode === 'aquarium') return;
    e.preventDefault();
    playerController.toggleCastAction(water.addRipple);
    return;
  }

  if (
    ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
  ) {
    if (camState.mode === 'town' || camState.mode === 'fish') {
      setCameraMode(
        gameState.data.insideBuildingId
          ? 'indoor'
          : gameState.data.playerMode === 'walking'
            ? 'walking'
            : 'boat'
      );
    }
  }
});

// Pointer camera orbit & scroll zoom
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const minDist = camState.mode === 'aquarium' ? 2.4 : camState.mode === 'indoor' ? 6.2 : 7.5;
    camState.targetDistance = clamp(camState.targetDistance + e.deltaY * 0.015, minDist, 42.0);
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
  camState.targetPitchDeg = clamp(camState.targetPitchDeg + dy * 0.18, 12, 76);
  if (pitchSlider) pitchSlider.value = String(Math.round(camState.targetPitchDeg));
});

// Populate interactive 25-species Fish Guide drawer (displaying Codex's watercolor cards!)
function highlightSelectedSpecies(activeId) {
  document.querySelectorAll('.species-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.speciesId === activeId);
  });
}

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
      const iconUrl = getFishIconUrl(sp.id);
      const btn = document.createElement('button');
      btn.className = 'species-item';
      btn.dataset.speciesId = sp.id;
      btn.innerHTML = `
        ${
          iconUrl
            ? `<img class="species-thumb" src="${iconUrl}" alt="${sp.nameZh}" />`
            : `<span class="species-swatch" style="background:${sp.swatch}"></span>`
        }
        <span class="species-name">${sp.nameZh}</span>
        <span class="species-meta">${sp.sizeLabel} ×${sp.count}</span>
      `;
      btn.addEventListener('click', () => {
        if (camState.mode === 'fish' && camState.watchSpeciesId === sp.id) {
          setCameraMode(gameState.data.playerMode === 'walking' ? 'walking' : 'boat');
        } else {
          setCameraMode('fish', sp.id);
        }
      });
      fishListContainer.appendChild(btn);
    }
  }
}

btnTown?.addEventListener('click', () => {
  if (camState.mode === 'town' || camState.mode === 'fish') {
    setCameraMode(
      gameState.data.insideBuildingId
        ? 'indoor'
        : gameState.data.playerMode === 'walking'
          ? 'walking'
          : 'boat'
    );
  } else {
    setCameraMode('town');
  }
});

document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
  closeAquariumView();
  camState.targetYawDeg = 0;
  setCameraMode(
    gameState.data.insideBuildingId
      ? 'indoor'
      : gameState.data.playerMode === 'walking'
        ? 'walking'
        : 'boat'
  );
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
syncWeatherUI(gameState.data.weather);

weatherButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.weather;
    atmosphere.applyPreset(key);
    syncWeatherUI(key);
    gameState.setWeather(key, false);
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

// Set initial camera cleanly
setCameraMode(camState.mode);
updateCameraImmediate();

// ---------------------------------------------------------------------------
// 7. Resize & Main Render Loop
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
const actorPosTmp = new THREE.Vector3();
let savePoseTimer = 0;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const isWalking = gameState.data.playerMode === 'walking';
  const inputLocked = camState.mode === 'aquarium';

  underwaterSharedUniforms.uTime.value = elapsed;

  // 1. Update Boat & Unified Player Controller (Walk / Board / Cast)
  boat.update(dt, elapsed, allWaterColliders, water.addRipple, atmosphere.state.nightGlow, !inputLocked);
  playerController.update(dt, elapsed, camState.yawDeg, water.addRipple, inputLocked);

  // 2. Update Town (Openable Doors, Seamless Roof Cutaway, Live 3D Indoor Aquarium!)
  const insideBuilding = town.update(
    dt,
    elapsed,
    atmosphere.state.nightGlow,
    isWalking ? playerController.walkerState.pos : null
  );
  const newInsideId = insideBuilding ? insideBuilding.id : null;
  if (newInsideId !== gameState.data.insideBuildingId) {
    gameState.setInsideBuilding(newInsideId);
    if (camState.mode !== 'aquarium' && camState.mode !== 'town' && camState.mode !== 'fish') {
      setCameraMode(newInsideId ? 'indoor' : 'walking');
    }
  }

  // 3. Update Amphibious Dog Companion, Lily Pads & 25-Species Fish Ecosystem
  companion.update(dt, elapsed, boat.state, water.addRipple, {
    walking: isWalking,
    playerPos: playerController.walkerState.pos,
    playerYaw: playerController.walkerState.yaw,
    town,
  });
  environment.update(
    dt,
    elapsed,
    boat.state,
    companion.root.visible && !isWalking ? companion.pos : null
  );
  ecosystem.update(dt, elapsed, boat.state, allWaterColliders, water.addRipple);

  // Periodic lightweight boat position persistence
  savePoseTimer += dt;
  if (savePoseTimer > 2.5 && !isWalking) {
    savePoseTimer = 0;
    gameState.updateBoatPose(boat.state.pos.x, boat.state.pos.z, boat.state.yaw);
  }

  // 4. Smart Camera Director Tracking
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
    desiredTargetX = aq.x;
    desiredTargetY = aq.y + 0.02;
    desiredTargetZ = aq.z;
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

  camState.target.x = THREE.MathUtils.lerp(camState.target.x, desiredTargetX, clamp(dt * 4.2, 0, 1));
  camState.target.y = THREE.MathUtils.lerp(camState.target.y, desiredTargetY, clamp(dt * 4.2, 0, 1));
  camState.target.z = THREE.MathUtils.lerp(camState.target.z, desiredTargetZ, clamp(dt * 4.2, 0, 1));
  camState.distance = THREE.MathUtils.lerp(camState.distance, camState.targetDistance, clamp(dt * 5.2, 0, 1));
  camState.pitchDeg = THREE.MathUtils.lerp(camState.pitchDeg, camState.targetPitchDeg, clamp(dt * 5.2, 0, 1));
  camState.yawDeg = THREE.MathUtils.lerp(camState.yawDeg, camState.targetYawDeg, clamp(dt * 5.2, 0, 1));

  updateCameraImmediate();
  atmosphere.update(elapsed, camState.target);

  // 5. Update World-Anchored [E] Interaction Prompt
  if (camState.mode === 'aquarium') {
    interactPromptEl?.classList.add('hidden');
  } else {
    playerController.getActorWorldPos(actorPosTmp);
    interactionSystem.update(
      actorPosTmp,
      { mode: gameState.data.playerMode, insideBuildingId: gameState.data.insideBuildingId },
      camera,
      interactPromptEl,
      interactKeyEl,
      interactTextEl
    );
  }

  // 6. Render Refraction Water + Final Frame
  water.update(elapsed, camera, boat.state);
  water.renderRefractionPass(renderer, scene, camera);
  renderer.render(scene, camera);
}

animate();
