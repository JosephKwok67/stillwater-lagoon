import * as THREE from 'three';
import { clamp } from './noise.js';
import { underwaterSharedUniforms } from './underwaterMaterial.js';
import { createAtmosphereSystem, WEATHER_PRESETS } from './atmosphere.js';
import { buildLagoonEnvironment } from './environment.js';
import { buildLakesideTown } from './town.js';
import { buildMeadowGrass } from './grass.js';
import { buildAquaticEcosystem, buildSwimmingCompanion } from './wildlife.js';
import { buildTownNpcs } from './npcs.js';
import { createPlayableBoat } from './boat.js';
import { createLagoonWater } from './water.js';
import { createPlayerAvatar } from './player.js';
import { createEventBus } from './core/eventBus.js';
import { createGameState } from './core/gameState.js';
import { createInteractionSystem } from './core/interactionSystem.js';
import { createPlayerController } from './core/playerController.js';
import { createFishingSystem } from './core/fishingSystem.js';
import { createVoiceBlip } from './core/voiceBlip.js';
import { createDialogueSystem } from './core/dialogueSystem.js';
import { createCameraDirector } from './core/cameraDirector.js';
import { createSleepSequence } from './core/sleepSequence.js';
import { createShopAndModals } from './ui/shopAndModals.js';
import {
  BAIT_CATALOG,
  PORTRAITS,
  MODEL_PATHS,
  syncDeliveredFishIcons,
  getFishIconUrl,
  getRodSpec,
  getBaitSpec,
} from './core/assetRegistry.js';
import { fetchAssetManifest, loadCharacterGlb, loadBuildingGlb } from './core/glbLoader.js';

// ---------------------------------------------------------------------------
// 1. Core Foundation Systems
// ---------------------------------------------------------------------------
const eventBus = createEventBus();
const gameState = createGameState(eventBus);
const interactionSystem = createInteractionSystem(eventBus);
const voiceBlip = createVoiceBlip();
const dialogueSystem = createDialogueSystem({ voiceBlip, eventBus });

const QUALITY_PROFILES = {
  high: { maxDpr: 2.0, shadowSize: 2048, refractionScale: 0.75, grassScale: 1.0 },
  balanced: { maxDpr: 1.5, shadowSize: 1024, refractionScale: 0.55, grassScale: 0.75 },
  low: { maxDpr: 1.25, shadowSize: 1024, refractionScale: 0.45, grassScale: 0.48 },
};

function detectDefaultQuality() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
  return /Android|iPhone|iPad|Mobile/i.test(ua) || cores <= 4 ? 'balanced' : 'high';
}

let activeQualityKey =
  QUALITY_PROFILES[gameState.data.settings?.quality] ? gameState.data.settings.quality : detectDefaultQuality();

// ---------------------------------------------------------------------------
// 2. Renderer & Scene Setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY_PROFILES[activeQualityKey].maxDpr));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.2, 240);

// ---------------------------------------------------------------------------
// 3. World, Enterable Town, Meadow, 3 Town NPCs, Ecosystem, Avatar, Boat & Water
// ---------------------------------------------------------------------------
const atmosphere = createAtmosphereSystem(scene, renderer);
const environment = buildLagoonEnvironment(scene);
const town = buildLakesideTown(scene);
const meadow = buildMeadowGrass(scene, { town });
const townNpcs = buildTownNpcs(scene, town);
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
  companion,
  gameState,
  eventBus,
});

const fishingSystem = createFishingSystem({
  scene,
  playerAvatar,
  boat,
  town,
  ecosystem,
  playerController,
  gameState,
  eventBus,
});

const specMap = new Map(ecosystem.speciesCatalog.map((sp) => [sp.id, sp]));
town.syncHomeAquarium(gameState.data.aquariumFish);
atmosphere.applyPreset(gameState.data.weather);

// Objects strictly inland (never underwater): skipped in water's off-screen refraction pass!
const refractionHiddenObjects = [town.inlandVisualGroup, townNpcs.root];

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

// Async zero-404 hot-swap for Blender .glb characters, dog, seamless walk-in buildings & new fish PNGs
fetchAssetManifest().then(async (manifest) => {
  if (!manifest) return;

  if (Array.isArray(manifest.fishIconsDelivered)) {
    syncDeliveredFishIcons(manifest.fishIconsDelivered);
    document.querySelectorAll('.species-item').forEach((el) => {
      const id = el.dataset.speciesId;
      const sp = specMap.get(id);
      const img = el.querySelector('img.species-thumb');
      if (sp && img) {
        img.src = getFishIconUrl(id, sp) || img.src;
      }
    });
  }

  const charFlags = manifest.characters || {};
  if (charFlags.player) {
    loadCharacterGlb(MODEL_PATHS.characters.player, { targetHeight: 1.24 })
      .then((adapter) => playerAvatar.attachGlb(adapter))
      .catch((err) => console.warn('[GLB] player.glb load failed:', err));
  }
  if (charFlags.dog) {
    loadCharacterGlb(MODEL_PATHS.characters.dog, { targetHeight: 0.65, isQuadruped: true })
      .then((adapter) => companion.attachGlb(adapter))
      .catch((err) => console.warn('[GLB] dog.glb load failed:', err));
  }
  for (const npcId of ['npc_market', 'npc_artisan', 'npc_lighthouse']) {
    if (charFlags[npcId]) {
      loadCharacterGlb(MODEL_PATHS.characters[npcId], { targetHeight: 1.26 })
        .then((adapter) => townNpcs.attachNpcGlb(npcId, adapter))
        .catch((err) => console.warn(`[GLB] ${npcId}.glb load failed:`, err));
    }
  }

  const bldFlags = manifest.buildings || {};
  for (const bId of ['player_home', 'artisan_workshop', 'neighbor_east']) {
    if (bldFlags[bId]) {
      loadBuildingGlb(MODEL_PATHS.buildings[bId])
        .then((data) => town.attachBuildingGlb(bId, data))
        .catch((err) => console.warn(`[GLB] ${bId} load failed:`, err));
    }
  }
  for (const lmId of ['market_stall', 'lighthouse']) {
    if (bldFlags[lmId] && MODEL_PATHS.buildings[lmId] && town.attachLandmarkGlb) {
      loadBuildingGlb(MODEL_PATHS.buildings[lmId])
        .then((data) => town.attachLandmarkGlb(lmId, data))
        .catch((err) => console.warn(`[GLB] ${lmId} load failed:`, err));
    }
  }
});

// ---------------------------------------------------------------------------
// 4. DOM References, Toast & Weather/Quality Sync
// ---------------------------------------------------------------------------
const btnTown = document.getElementById('btn-focus-town');
const btnVoice = document.getElementById('btn-toggle-voice');
const pitchSlider = document.getElementById('ctrl-pitch');
const sunElevSlider = document.getElementById('ctrl-sun-elev');
const sunAzimSlider = document.getElementById('ctrl-sun-azim');
const sparkleSlider = document.getElementById('ctrl-sparkle');
const tweakPanel = document.getElementById('tweak-panel');
const fishPanel = document.getElementById('fish-panel');
const basketModal = document.getElementById('basket-modal');
const interactPromptEl = document.getElementById('interact-prompt');
const interactKeyEl = document.getElementById('interact-key');
const interactTextEl = document.getElementById('interact-text');
const toastEl = document.getElementById('toast-banner');
const toastImgEl = document.getElementById('toast-portrait');
const toastMsgEl = document.getElementById('toast-msg');

const biteAlertEl = document.getElementById('bite-alert');
const reelHudEl = document.getElementById('fishing-reel-hud');
const reelFishLabelEl = document.getElementById('reel-fish-label');
const reelMoodPillEl = document.getElementById('reel-mood-pill');
const reelProgressFillEl = document.getElementById('reel-progress-fill');
const reelProgressPctEl = document.getElementById('reel-progress-pct');
const reelTensionFillEl = document.getElementById('reel-tension-fill');
const reelTensionPctEl = document.getElementById('reel-tension-pct');
const btnReelHold = document.getElementById('btn-reel-hold');
const btnCastAction = document.getElementById('btn-cast-action');
const btnCastLabel = document.getElementById('btn-cast-label');

const catchModalEl = document.getElementById('catch-modal');
const catchBadgesEl = document.getElementById('catch-badges');
const catchFishImgEl = document.getElementById('catch-fish-img');
const catchFishFallbackEl = document.getElementById('catch-fish-fallback');
const catchFishNameEl = document.getElementById('catch-fish-name');
const catchFishMetaEl = document.getElementById('catch-fish-meta');
const catchReleaseLabelEl = document.getElementById('catch-release-label');

let toastTimeout = null;
function showToast({ text, portrait = 'player', mood = 'neutral' }) {
  if (!toastEl || !toastMsgEl) return;
  toastMsgEl.textContent = text;
  if (toastImgEl) {
    toastImgEl.src = (PORTRAITS[portrait] && PORTRAITS[portrait][mood]) || PORTRAITS.player.neutral;
  }
  toastEl.classList.remove('hidden');
  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 4200);
}
eventBus.on('ui:toast', showToast);

const weatherButtons = document.querySelectorAll('.weather-btn[data-weather]');
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

const qualityButtons = document.querySelectorAll('.quality-btn[data-quality]');
function applyQualityPreset(key, persist = true) {
  const profile = QUALITY_PROFILES[key] || QUALITY_PROFILES.high;
  activeQualityKey = QUALITY_PROFILES[key] ? key : 'high';
  qualityButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.quality === activeQualityKey));

  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  water.setRefractionScale(profile.refractionScale);
  water.resize(w, h, dpr);
  atmosphere.setShadowQuality(profile.shadowSize);
  meadow.setQualityScale(profile.grassScale);
  town.setQuality(activeQualityKey);

  if (persist) {
    gameState.setSetting('quality', activeQualityKey);
  }
}
applyQualityPreset(activeQualityKey, false);

if (gameState.data.settings?.voiceMuted) {
  voiceBlip.setMuted(true);
  if (btnVoice) btnVoice.textContent = '拟声: 关';
}

// ---------------------------------------------------------------------------
// 5. Camera Director, Sleep Sequence & Village Modals/Shop
// ---------------------------------------------------------------------------
let uiModals = null;
const cameraDirector = createCameraDirector({
  camera,
  canvas,
  playerAvatar,
  initialMode: gameState.data.playerMode === 'walking' ? 'walking' : 'boat',
  btnTown,
  pitchSlider,
  onSpeciesHighlight: (id) => uiModals?.highlightSelectedSpecies(id),
  onFishingActionDown: () => fishingSystem.onActionDown(water.addRipple),
  getFishingPhase: () => fishingSystem.state.phase,
});

const sleepSequence = createSleepSequence({
  camera,
  town,
  playerAvatar,
  playerController,
  atmosphere,
  gameState,
  syncWeatherUI,
  showToast,
});

uiModals = createShopAndModals({
  gameState,
  ecosystem,
  specMap,
  playerAvatar,
  playerController,
  dialogueSystem,
  voiceBlip,
  atmosphere,
  cameraDirector,
  syncWeatherUI,
  showToast,
});

eventBus.on('aquarium:updated', (list) => {
  town.syncHomeAquarium(list);
  uiModals.renderAquariumModal();
  uiModals.renderBasketModal();
});
eventBus.on('inventory:updated', () => {
  uiModals.renderAquariumModal();
  uiModals.renderBasketModal();
  if (uiModals.isShopOpen()) uiModals.renderShopContent();
});

// ---------------------------------------------------------------------------
// 6. Register World Interactables (Docks, Boat, Doors, Aquarium, Bed, NPCs, Farm)
// ---------------------------------------------------------------------------
const isBusyModalOrSeq = () =>
  fishingSystem.isActive() || dialogueSystem.isOpen() || uiModals.isShopOpen() || sleepSequence.isActive();

for (const dock of town.docks) {
  interactionSystem.register({
    id: `disembark_${dock.id}`,
    modes: ['sailing'],
    radius: 4.3,
    priority: 3,
    promptYOffset: 1.55,
    getPosition: () => dock.triggerPos,
    canInteract: () => !isBusyModalOrSeq(),
    getLabel: () => `停船上岸 · ${dock.nameZh}`,
    onInteract: () => {
      fishingSystem.cancel();
      playerController.disembarkAtDock(dock);
      cameraDirector.setMode('walking');
    },
  });
}

interactionSystem.register({
  id: 'board_boat',
  modes: ['walking'],
  radius: 3.3,
  priority: 3,
  promptYOffset: 1.15,
  getPosition: () => boat.state.pos,
  canInteract: () => !gameState.data.insideBuildingId && !isBusyModalOrSeq(),
  getLabel: () => '登船出海',
  onInteract: () => {
    fishingSystem.cancel();
    playerController.boardBoat();
    cameraDirector.setMode('boat');
  },
});

for (const b of town.enterableBuildings) {
  interactionSystem.register({
    id: `door_${b.id}`,
    modes: ['walking'],
    radius: 1.85,
    priority: 5,
    promptYOffset: 1.45,
    getPosition: () => b.doorWorldPos,
    canInteract: () => !isBusyModalOrSeq(),
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

for (const npc of townNpcs.npcs) {
  interactionSystem.register({
    id: `talk_${npc.id}`,
    modes: ['walking'],
    radius: 2.35,
    priority: 6,
    promptYOffset: 1.55,
    getPosition: () => npc.pos,
    canInteract: () => {
      if (isBusyModalOrSeq()) return false;
      if (npc.buildingId && gameState.data.insideBuildingId !== npc.buildingId) return false;
      return true;
    },
    getLabel: () => `对话 · ${npc.nameZh}`,
    onInteract: () => uiModals.startNpcConversation(npc),
  });
}

if (town.playerHome?.worldAnchors?.aquarium) {
  interactionSystem.register({
    id: 'home_aquarium',
    modes: ['walking'],
    radius: 1.65,
    priority: 4,
    promptYOffset: 0.85,
    getPosition: () => town.playerHome.worldAnchors.aquarium,
    canInteract: () => gameState.data.insideBuildingId === 'player_home' && !isBusyModalOrSeq(),
    getLabel: () => `观赏 / 管理家里鱼缸（${gameState.data.aquariumFish.length}/10）`,
    onInteract: () => uiModals.openAquariumView(),
  });
}

if (town.playerHome?.worldAnchors?.bed) {
  interactionSystem.register({
    id: 'home_bed',
    modes: ['walking'],
    radius: 1.55,
    priority: 4,
    promptYOffset: 0.75,
    getPosition: () => town.playerHome.worldAnchors.bed,
    canInteract: () => gameState.data.insideBuildingId === 'player_home' && !isBusyModalOrSeq(),
    getLabel: () => '上床小憩（躺下睡觉切换时段）',
    onInteract: () => sleepSequence.start(),
  });
}

interactionSystem.register({
  id: 'future_farm_plot',
  modes: ['walking'],
  radius: 2.15,
  priority: 2,
  promptYOffset: 0.75,
  getPosition: () => town.farmPlotAnchor,
  canInteract: () => !gameState.data.insideBuildingId && !isBusyModalOrSeq(),
  getLabel: () => '查看向阳菜地（种田预留）',
  onInteract: () => {
    eventBus.emit('ui:toast', {
      text: '已预留 12 块向阳菜地，未来将与畜牧牧场、厨房做饭一起解锁！',
      portrait: 'player',
      mood: 'happy',
    });
  },
});

// ---------------------------------------------------------------------------
// 7. HUD, Fishing Events & Keyboard/UI Bindings
// ---------------------------------------------------------------------------
btnVoice?.addEventListener('click', () => {
  const muted = voiceBlip.toggleMute();
  btnVoice.textContent = muted ? '拟声: 关' : '拟声: 开';
  gameState.setSetting('voiceMuted', muted);
});

eventBus.on('fishing:stateChanged', ({ phase, spec }) => {
  if (phase === 'idle') {
    biteAlertEl?.classList.add('hidden');
    reelHudEl?.classList.add('hidden');
    catchModalEl?.classList.add('hidden');
    if (btnCastLabel) btnCastLabel.innerHTML = '蓄力抛竿 <em>Space</em>';
  } else if (phase === 'charging') {
    if (btnCastLabel) btnCastLabel.innerHTML = '松开抛竿！ <em>Space</em>';
  } else if (phase === 'waiting') {
    biteAlertEl?.classList.add('hidden');
    if (btnCastLabel) btnCastLabel.innerHTML = '静候咬钩 / 收竿 <em>Space</em>';
  } else if (phase === 'bite') {
    biteAlertEl?.classList.remove('hidden');
    if (btnCastLabel) btnCastLabel.innerHTML = '立刻提竿！ <em>Space</em>';
  } else if (phase === 'fighting') {
    biteAlertEl?.classList.add('hidden');
    reelHudEl?.classList.remove('hidden');
    if (reelFishLabelEl) {
      reelFishLabelEl.textContent = spec ? `正在遛鱼 · 感觉不小！` : '正在遛鱼...';
    }
    if (btnCastLabel) btnCastLabel.innerHTML = '按住收线 <em>Space</em>';
  } else if (phase === 'landing') {
    reelHudEl?.classList.add('hidden');
    biteAlertEl?.classList.add('hidden');
  }
});

eventBus.on('fishing:fightTick', ({ progress, tension, fishMood }) => {
  const pPct = Math.round(progress * 100);
  const tPct = Math.round(tension * 100);
  if (reelProgressFillEl) reelProgressFillEl.style.width = `${pPct}%`;
  if (reelProgressPctEl) reelProgressPctEl.textContent = `${pPct}%`;
  if (reelTensionFillEl) {
    reelTensionFillEl.style.width = `${tPct}%`;
    reelTensionFillEl.classList.toggle('danger', tension > 0.78);
  }
  if (reelTensionPctEl) reelTensionPctEl.textContent = `${tPct}%`;
  if (reelMoodPillEl) {
    const thrash = fishMood === 'thrashing';
    reelMoodPillEl.textContent = thrash ? '猛烈挣扎 · 松手卸力！' : '游累了 · 按住收线！';
    reelMoodPillEl.className = `reel-mood-pill ${thrash ? 'mood-thrashing' : 'mood-tired'}`;
  }
});

eventBus.on('fishing:caught', (info) => {
  if (!catchModalEl || !info) return;
  gameState.consumeActiveBait();
  voiceBlip.playBlip('dog', 66);

  const { spec, lengthCm, grade, price, echo, isNewSpecies, isNewRecord } = info;
  const iconUrl = getFishIconUrl(spec.id, spec);

  if (catchBadgesEl) {
    const badges = [];
    if (isNewSpecies) badges.push('<span class="catch-pill catch-pill-new">NEW 新图鉴</span>');
    else if (isNewRecord) badges.push('<span class="catch-pill catch-pill-new">新体长纪录</span>');
    const gradeCls =
      grade === '王冠' ? 'catch-pill-crown' : grade === '大物' ? 'catch-pill-large' : 'catch-pill-normal';
    badges.push(`<span class="catch-pill ${gradeCls}">${grade}</span>`);
    badges.push(`<span class="catch-pill catch-pill-normal">${spec.category}</span>`);
    catchBadgesEl.innerHTML = badges.join('');
  }

  if (iconUrl && catchFishImgEl && catchFishFallbackEl) {
    catchFishImgEl.src = iconUrl;
    catchFishImgEl.alt = spec.nameZh;
    catchFishImgEl.classList.remove('hidden');
    catchFishFallbackEl.classList.add('hidden');
  }

  if (catchFishNameEl) catchFishNameEl.textContent = spec.nameZh;
  if (catchFishMetaEl) {
    catchFishMetaEl.textContent = `体长 ${lengthCm} cm · ${grade} · 渔市估价约 ${price} 贝币`;
  }
  if (catchReleaseLabelEl) {
    catchReleaseLabelEl.innerHTML = `温柔放生 (+${echo} 回响) <em>2</em>`;
  }

  catchModalEl.classList.remove('hidden');
});

document.getElementById('btn-catch-keep')?.addEventListener('click', () => {
  fishingSystem.resolveCatchChoice('keep', water.addRipple);
});
document.getElementById('btn-catch-release')?.addEventListener('click', () => {
  fishingSystem.resolveCatchChoice('release', water.addRipple);
});
biteAlertEl?.addEventListener('click', () => fishingSystem.onActionDown(water.addRipple));

btnCastAction?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (dialogueSystem.isOpen() || uiModals.isShopOpen() || sleepSequence.isActive()) return;
  fishingSystem.onActionDown(water.addRipple);
});
window.addEventListener('pointerup', () => fishingSystem.onActionUp());
btnReelHold?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  fishingSystem.onActionDown(water.addRipple);
});

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

  const fishCount = s.inventory.filter((i) => i.kind === 'fish').length;
  if (coinsEl) coinsEl.textContent = String(s.coins);
  if (echoEl) echoEl.textContent = String(s.echoPoints);
  if (basketEl) basketEl.textContent = `${fishCount}`;
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
  const baitQty = s.equipment.baitCounts[bait.id] || 0;
  if (rodImg) rodImg.src = rod.icon;
  if (rodName) rodName.textContent = rod.nameZh;
  if (baitImg) baitImg.src = bait.icon;
  if (baitName) baitName.textContent = `${bait.nameZh} ×${baitQty}`;
}
eventBus.on('state:changed', syncHudState);
syncHudState();

document.getElementById('btn-cycle-rod')?.addEventListener('click', () => {
  if (isBusyModalOrSeq()) return;
  const owned = gameState.data.equipment.ownedRods;
  if (owned.length <= 1) {
    showToast({
      text: '目前只有初始竹竿，推门进渔市后面的「老周渔具工坊」可以购买进阶鱼竿哦！',
      portrait: 'npc_artisan',
      mood: 'happy',
    });
    return;
  }
  const idx = owned.indexOf(gameState.data.equipment.rodId);
  const next = getRodSpec(owned[(idx + 1) % owned.length]);
  gameState.setEquipment({ rodId: next.id });
  playerAvatar.setRodStyle(next.id);
  showToast({ text: `已切换鱼竿：${next.nameZh}`, portrait: 'player', mood: 'happy' });
});

document.getElementById('btn-cycle-bait')?.addEventListener('click', () => {
  if (isBusyModalOrSeq()) return;
  const idx = BAIT_CATALOG.findIndex((b) => b.id === gameState.data.equipment.baitId);
  const next = BAIT_CATALOG[(idx + 1) % BAIT_CATALOG.length];
  gameState.setEquipment({ baitId: next.id });
  const qty = gameState.data.equipment.baitCounts[next.id] || 0;
  showToast({
    text: `已切换鱼饵：${next.nameZh}（余 ${qty} 份 · 吸引：${next.targetHint}）`,
    portrait: 'player',
    mood: 'neutral',
  });
});

document.getElementById('btn-warp-home')?.addEventListener('click', () => {
  if (sleepSequence.isActive()) return;
  fishingSystem.cancel();
  dialogueSystem.close();
  uiModals.closeShop();
  uiModals.closeAquariumView();
  playerController.warpToHomeDock();
  cameraDirector.setMode(gameState.data.playerMode === 'walking' ? 'walking' : 'boat');
});

window.addEventListener('keydown', (e) => {
  if (e.repeat || sleepSequence.isActive()) return;

  if (uiModals.isShopOpen()) {
    if (e.code === 'Escape') uiModals.closeShop();
    return;
  }

  if (dialogueSystem.isOpen()) {
    if (e.code === 'Escape') dialogueSystem.close();
    else if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
      e.preventDefault();
      dialogueSystem.advance();
    }
    return;
  }

  if (fishingSystem.state.phase === 'modal') {
    if (e.code === 'Digit1' || e.code === 'Enter' || e.code === 'KeyE') {
      e.preventDefault();
      fishingSystem.resolveCatchChoice('keep', water.addRipple);
    } else if (e.code === 'Digit2') {
      e.preventDefault();
      fishingSystem.resolveCatchChoice('release', water.addRipple);
    }
    return;
  }

  if (e.code === 'Escape') {
    if (fishingSystem.isActive()) {
      fishingSystem.cancel();
      return;
    }
    uiModals.closeAquariumView();
    uiModals.closeSidePanels();
    return;
  }

  if (e.code === 'KeyB') {
    if (cameraDirector.state.mode === 'aquarium' || fishingSystem.isActive()) return;
    document.getElementById('btn-open-basket')?.click();
    return;
  }

  if (e.code === 'KeyE') {
    if (cameraDirector.state.mode === 'aquarium') {
      uiModals.closeAquariumView();
      return;
    }
    if (!fishingSystem.isActive()) {
      interactionSystem.trigger({ mode: gameState.data.playerMode });
    }
    return;
  }

  if (e.code === 'Space' || e.code === 'KeyF') {
    if (cameraDirector.state.mode === 'aquarium') return;
    e.preventDefault();
    fishingSystem.onActionDown(water.addRipple);
    return;
  }

  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    if (cameraDirector.state.mode === 'town' || cameraDirector.state.mode === 'fish') {
      cameraDirector.setMode(
        gameState.data.insideBuildingId ? 'indoor' : gameState.data.playerMode === 'walking' ? 'walking' : 'boat'
      );
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'KeyF') {
    fishingSystem.onActionUp();
  }
});

btnTown?.addEventListener('click', () => {
  if (cameraDirector.state.mode === 'town' || cameraDirector.state.mode === 'fish') {
    cameraDirector.setMode(
      gameState.data.insideBuildingId ? 'indoor' : gameState.data.playerMode === 'walking' ? 'walking' : 'boat'
    );
  } else {
    cameraDirector.setMode('town');
  }
});

document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
  uiModals.closeAquariumView();
  cameraDirector.state.targetYawDeg = 0;
  cameraDirector.setMode(
    gameState.data.insideBuildingId ? 'indoor' : gameState.data.playerMode === 'walking' ? 'walking' : 'boat'
  );
});

document.getElementById('btn-toggle-fish')?.addEventListener('click', () => {
  const willShow = fishPanel?.classList.contains('hidden');
  tweakPanel?.classList.add('hidden');
  basketModal?.classList.add('hidden');
  fishPanel?.classList.toggle('hidden', !willShow);
});
document.getElementById('btn-close-fish')?.addEventListener('click', () => fishPanel?.classList.add('hidden'));

document.getElementById('btn-toggle-panel')?.addEventListener('click', () => {
  const willShow = tweakPanel?.classList.contains('hidden');
  fishPanel?.classList.add('hidden');
  basketModal?.classList.add('hidden');
  tweakPanel?.classList.toggle('hidden', !willShow);
});
document.getElementById('btn-close-panel')?.addEventListener('click', () => tweakPanel?.classList.add('hidden'));

weatherButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.weather;
    atmosphere.applyPreset(key);
    syncWeatherUI(key);
    gameState.setWeather(key, false);
  });
});

qualityButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.quality;
    applyQualityPreset(key, true);
    const label = key === 'high' ? '高画质' : key === 'balanced' ? '均衡' : '省电流畅';
    showToast({ text: `已切换画质档位：${label}`, portrait: 'player', mood: 'neutral' });
  });
});

sunElevSlider?.addEventListener('input', (e) => atmosphere.setSunAngles(parseFloat(e.target.value), undefined));
sunAzimSlider?.addEventListener('input', (e) => atmosphere.setSunAngles(undefined, parseFloat(e.target.value)));
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
  cameraDirector.state.targetPitchDeg = parseFloat(e.target.value);
});
document.getElementById('ctrl-companion')?.addEventListener('change', (e) => {
  companion.setVisible(e.target.checked);
});

cameraDirector.setMode(cameraDirector.state.mode);
cameraDirector.updateImmediate();

// ---------------------------------------------------------------------------
// 8. Resize & Main Render Loop
// ---------------------------------------------------------------------------
function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, QUALITY_PROFILES[activeQualityKey].maxDpr);
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
  const fishingActive = fishingSystem.isActive();
  const inputLocked =
    cameraDirector.state.mode === 'aquarium' ||
    fishingSystem.state.phase === 'modal' ||
    dialogueSystem.isOpen() ||
    uiModals.isShopOpen() ||
    sleepSequence.isActive();

  underwaterSharedUniforms.uTime.value = elapsed;

  // 1. Update Boat, Land Walking (or Bed Sleeping Animation), Fishing & Dialogue
  boat.update(
    dt,
    elapsed,
    allWaterColliders,
    water.addRipple,
    atmosphere.state.nightGlow,
    !inputLocked && !fishingActive
  );

  const sleepingNow = sleepSequence.update(dt, elapsed);
  if (!sleepingNow) {
    playerController.update(
      dt,
      elapsed,
      cameraDirector.state.yawDeg,
      inputLocked,
      fishingActive,
      townNpcs.npcColliders
    );
  }
  fishingSystem.update(dt, elapsed, water.addRipple);
  dialogueSystem.update(dt);

  // 2. Update Town & 3 Interactive Town NPCs
  const insideBuilding = town.update(
    dt,
    elapsed,
    atmosphere.state.nightGlow,
    isWalking ? playerController.walkerState.pos : null
  );
  const newInsideId = insideBuilding ? insideBuilding.id : null;
  if (newInsideId !== gameState.data.insideBuildingId) {
    gameState.setInsideBuilding(newInsideId);
    const m = cameraDirector.state.mode;
    if (m !== 'aquarium' && m !== 'dialogue' && m !== 'town' && m !== 'fish') {
      cameraDirector.setMode(newInsideId ? 'indoor' : 'walking');
    }
  }

  playerController.getActorWorldPos(actorPosTmp);
  townNpcs.update(dt, elapsed, actorPosTmp);

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

  savePoseTimer += dt;
  if (savePoseTimer > 2.5 && !isWalking) {
    savePoseTimer = 0;
    gameState.updateBoatPose(boat.state.pos.x, boat.state.pos.z, boat.state.yaw);
  }

  // 4. Smart Camera Director, Atmosphere & Wind Meadow
  cameraDirector.update(dt, {
    boat,
    town,
    townNpcs,
    ecosystem,
    playerController,
    fishingSystem,
    insideBuilding,
    isWalking,
  });

  atmosphere.update(elapsed, cameraDirector.state.target);
  meadow.update(elapsed, camera, {
    dt,
    walkerPos: isWalking ? playerController.walkerState.pos : null,
    dogPos: companion.root.visible ? companion.pos : null,
    weatherKey: atmosphere.state.presetKey,
    nightGlow: atmosphere.state.nightGlow,
  });

  // 5. Update World-Anchored [E] Interaction Prompt & Bite Alert Position
  if (cameraDirector.state.mode === 'aquarium' || isBusyModalOrSeq()) {
    interactPromptEl?.classList.add('hidden');
  } else {
    interactionSystem.update(
      actorPosTmp,
      { mode: gameState.data.playerMode, insideBuildingId: gameState.data.insideBuildingId },
      camera,
      interactPromptEl,
      interactKeyEl,
      interactTextEl
    );
  }

  if (fishingSystem.state.phase === 'bite' && biteAlertEl) {
    const pt = fishingSystem.getBobberScreenPos(camera);
    if (pt) {
      biteAlertEl.style.left = `${clamp(pt.x, 120, window.innerWidth - 120).toFixed(1)}px`;
      biteAlertEl.style.top = `${clamp(pt.y, 88, window.innerHeight - 130).toFixed(1)}px`;
    }
  }

  // 6. Render Optimized Underwater-Only Refraction Pass + Final Frame
  water.update(elapsed, camera, boat.state);
  water.renderRefractionPass(renderer, scene, camera, refractionHiddenObjects);
  renderer.render(scene, camera);
}

animate();
