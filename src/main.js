import * as THREE from 'three';
import { clamp } from './noise.js';
import { underwaterSharedUniforms } from './underwaterMaterial.js';
import { createAtmosphereSystem, WEATHER_PRESETS } from './atmosphere.js';
import { buildLagoonEnvironment } from './environment.js';
import { buildLakesideTown } from './town.js';
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
import {
  ROD_CATALOG,
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
// 3. World, Enterable Town, 3 Town NPCs, Ecosystem, Avatar, Boat & Fishing
// ---------------------------------------------------------------------------
const atmosphere = createAtmosphereSystem(scene, renderer);
const environment = buildLagoonEnvironment(scene);
const town = buildLakesideTown(scene);
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
eventBus.on('aquarium:updated', (list) => {
  town.syncHomeAquarium(list);
  renderAquariumModal();
  renderBasketModal();
});
eventBus.on('inventory:updated', () => {
  renderAquariumModal();
  renderBasketModal();
  if (shopState.open) renderShopContent();
});

atmosphere.applyPreset(gameState.data.weather);

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

// Async zero-404 hot-swap for Codex's Blender .glb characters, dog, seamless walk-in buildings & new fish PNGs!
fetchAssetManifest().then(async (manifest) => {
  if (!manifest) return;

  if (Array.isArray(manifest.fishIconsDelivered)) {
    syncDeliveredFishIcons(manifest.fishIconsDelivered);
    // Refresh any rendered fish thumbnails in the guide drawer automatically
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
// 4. Smart Camera Director
// ---------------------------------------------------------------------------
const camState = {
  mode: gameState.data.playerMode === 'walking' ? 'walking' : 'boat',
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

function setCameraMode(mode, extraId = null) {
  camState.mode = mode;
  camState.watchSpeciesId = mode === 'fish' ? extraId : null;
  camState.focusNpcId = mode === 'dialogue' ? extraId : null;
  highlightSelectedSpecies(camState.watchSpeciesId);

  playerAvatar.root.visible = mode !== 'aquarium';

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

// ---------------------------------------------------------------------------
// 5. Cozy Bed Sleeping Animation Sequence (Lie down -> Zzz -> Twilight Fade -> Wake!)
// ---------------------------------------------------------------------------
const WEATHER_CYCLE = ['morning', 'sunny', 'sunset', 'overcast'];
const WEATHER_NAMES = {
  morning: '清晨微光',
  sunny: '晴朗午后',
  sunset: '黄金日落',
  overcast: '薄雾微阴',
};

const sleepZzzEl = document.getElementById('sleep-zzz');
const sleepOverlayEl = document.getElementById('sleep-overlay');
const sleepOverlayTextEl = document.getElementById('sleep-overlay-text');

const sleepSeq = {
  active: false,
  elapsed: 0,
  swappedWeather: false,
  startPos: new THREE.Vector3(),
  bedPos: new THREE.Vector3(),
  wakePos: new THREE.Vector3(),
  bedYaw: 0,
  nextWeather: 'morning',
  newDay: false,
};

function startCozyBedSleep() {
  if (sleepSeq.active || !town.playerHome?.worldAnchors?.bedLie) return;
  const curIdx = WEATHER_CYCLE.indexOf(gameState.data.weather);
  const nextIdx = (curIdx + 1) % WEATHER_CYCLE.length;
  sleepSeq.nextWeather = WEATHER_CYCLE[nextIdx];
  sleepSeq.newDay = nextIdx === 0;
  sleepSeq.active = true;
  sleepSeq.elapsed = 0;
  sleepSeq.swappedWeather = false;
  sleepSeq.startPos.copy(playerController.walkerState.pos);
  sleepSeq.bedPos.copy(town.playerHome.worldAnchors.bedLie);
  sleepSeq.wakePos.copy(town.playerHome.worldAnchors.bedWake);
  sleepSeq.bedYaw = town.playerHome.rotY;

  playerController.clearKeys();
  if (sleepOverlayTextEl) {
    sleepOverlayTextEl.textContent = sleepSeq.newDay
      ? `美美睡上一觉 · 静候第 ${gameState.data.day + 1} 天的${WEATHER_NAMES[sleepSeq.nextWeather]}...`
      : `小憩片刻 · 窗外渐渐迎来「${WEATHER_NAMES[sleepSeq.nextWeather]}」...`;
  }
}

const zzzProj = new THREE.Vector3();
function updateBedSleepSequence(dt, elapsedTime) {
  if (!sleepSeq.active) return false;
  sleepSeq.elapsed += dt;
  const t = sleepSeq.elapsed;

  // Stage 1 (0.0 -> 0.45s): Hop smoothly onto the red-quilt wooden bed
  if (t < 0.45) {
    const p = clamp(t / 0.45, 0, 1);
    const arc = Math.sin(p * Math.PI) * 0.42;
    playerAvatar.root.position.set(
      THREE.MathUtils.lerp(sleepSeq.startPos.x, sleepSeq.bedPos.x, p),
      THREE.MathUtils.lerp(sleepSeq.startPos.y, sleepSeq.bedPos.y, p) + arc,
      THREE.MathUtils.lerp(sleepSeq.startPos.z, sleepSeq.bedPos.z, p)
    );
    playerAvatar.root.rotation.y = sleepSeq.bedYaw;
    playerAvatar.updateAnimation('Board_Boat', dt, elapsedTime, { progress: p });
    return true;
  }

  // Stage 2 (0.45 -> 2.15s): Lie peacefully in bed with Sleep_Bed breathing, Zzz bubbles, and twilight fade!
  if (t < 2.15) {
    playerAvatar.root.position.copy(sleepSeq.bedPos);
    playerAvatar.root.rotation.y = sleepSeq.bedYaw;
    playerAvatar.updateAnimation('Sleep_Bed', dt, elapsedTime);

    // Float Zzz bubbles right above the pillow!
    if (sleepZzzEl) {
      zzzProj.set(sleepSeq.bedPos.x, sleepSeq.bedPos.y + 0.62, sleepSeq.bedPos.z - 0.15);
      zzzProj.project(camera);
      const sx = (zzzProj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-zzzProj.y * 0.5 + 0.5) * window.innerHeight;
      sleepZzzEl.style.left = `${sx.toFixed(1)}px`;
      sleepZzzEl.style.top = `${sy.toFixed(1)}px`;
      sleepZzzEl.classList.remove('hidden');
    }

    // Dreamy twilight curtain fade (0.85s -> 1.85s)
    if (t >= 0.85 && t < 1.8) {
      sleepOverlayEl?.classList.remove('hidden');
      requestAnimationFrame(() => sleepOverlayEl?.classList.add('visible'));
    }

    // Apply weather/day switch smoothly right at the peak of the dreamy fade!
    if (t >= 1.38 && !sleepSeq.swappedWeather) {
      sleepSeq.swappedWeather = true;
      atmosphere.applyPreset(sleepSeq.nextWeather);
      syncWeatherUI(sleepSeq.nextWeather);
      gameState.setWeather(sleepSeq.nextWeather, sleepSeq.newDay);
    }

    if (t >= 1.78) {
      sleepOverlayEl?.classList.remove('visible');
    }
    return true;
  }

  // Stage 3 (2.15 -> 2.62s): Hop cheerfully out of bed onto the braided rug!
  sleepZzzEl?.classList.add('hidden');
  if (t < 2.62) {
    const p = clamp((t - 2.15) / 0.47, 0, 1);
    const arc = Math.sin(p * Math.PI) * 0.36;
    playerAvatar.root.position.set(
      THREE.MathUtils.lerp(sleepSeq.bedPos.x, sleepSeq.wakePos.x, p),
      THREE.MathUtils.lerp(sleepSeq.bedPos.y, sleepSeq.wakePos.y, p) + arc,
      THREE.MathUtils.lerp(sleepSeq.bedPos.z, sleepSeq.wakePos.z, p)
    );
    playerAvatar.root.rotation.y = sleepSeq.bedYaw + Math.PI * 0.35;
    playerAvatar.updateAnimation('Board_Boat', dt, elapsedTime, { progress: p });
    return true;
  }

  // Finished waking up cleanly!
  sleepSeq.active = false;
  sleepOverlayEl?.classList.add('hidden');
  playerController.walkerState.pos.copy(sleepSeq.wakePos);
  playerController.walkerState.yaw = sleepSeq.bedYaw + Math.PI * 0.35;
  playerAvatar.root.position.copy(sleepSeq.wakePos);
  showToast({
    text: sleepSeq.newDay
      ? `精神饱满！迎来了第 ${gameState.data.day} 天的${WEATHER_NAMES[sleepSeq.nextWeather]}，渔市高价鱼也刷新啦！`
      : `小憩醒来，窗外已是「${WEATHER_NAMES[sleepSeq.nextWeather]}」时分`,
    portrait: 'player',
    mood: 'happy',
  });
  return false;
}

// ---------------------------------------------------------------------------
// 6. Village Economy: Daily Hot Fish, Market Selling & Old Zhou Tackle Shop!
// ---------------------------------------------------------------------------
const shopModalEl = document.getElementById('shop-modal');
const shopNpcPortraitEl = document.getElementById('shop-npc-portrait');
const shopTitleEl = document.getElementById('shop-title');
const shopSubtitleEl = document.getElementById('shop-subtitle');
const shopCoinsEl = document.getElementById('shop-coins');
const shopContentEl = document.getElementById('shop-content');
const shopFooterEl = document.getElementById('shop-footer');

const shopState = {
  open: false,
  mode: 'market', // 'market' | 'artisan'
};

function getDailyHotSpeciesIds() {
  const day = gameState.data.day || 1;
  const list = ecosystem.speciesCatalog;
  const i1 = (day * 7 + 2) % list.length;
  const i2 = (day * 13 + 9) % list.length;
  return new Set([list[i1].id, list[i2 === i1 ? (i2 + 1) % list.length : i2].id]);
}

function getFishSellPrice(fishRec) {
  const base = fishRec.price || 28;
  const hot = getDailyHotSpeciesIds().has(fishRec.speciesId);
  return hot ? Math.round(base * 1.5) : base;
}

function openShop(mode) {
  shopState.open = true;
  shopState.mode = mode;
  shopModalEl?.classList.remove('hidden');
  playerController.clearKeys();
  renderShopContent();
}

function closeShop() {
  if (!shopState.open) return;
  shopState.open = false;
  shopModalEl?.classList.add('hidden');
}

function renderShopContent() {
  if (!shopContentEl || !shopFooterEl) return;
  if (shopCoinsEl) shopCoinsEl.textContent = String(gameState.data.coins);
  shopContentEl.innerHTML = '';
  shopFooterEl.innerHTML = '';

  if (shopState.mode === 'market') {
    const hotIds = getDailyHotSpeciesIds();
    const hotNames = Array.from(hotIds)
      .map((id) => specMap.get(id)?.nameZh || id)
      .join('、');

    if (shopNpcPortraitEl) shopNpcPortraitEl.src = PORTRAITS.npc_market.happy;
    if (shopTitleEl) shopTitleEl.textContent = '阿莲渔市收购摊';
    if (shopSubtitleEl) shopSubtitleEl.textContent = `第 ${gameState.data.day} 天行情 · 高价鱼享受 1.5 倍溢价`;

    const banner = document.createElement('div');
    banner.className = 'shop-hot-banner';
    banner.textContent = `🔥 今日高价收购鱼（1.5x）：${hotNames}`;
    shopContentEl.appendChild(banner);

    const fishes = gameState.data.inventory.filter((i) => i.kind === 'fish');
    if (!fishes.length) {
      const empty = document.createElement('div');
      empty.className = 'shop-empty';
      empty.textContent = '随身鱼护里暂时没有鱼哦！先去湖里甩几竿，钓到鱼再带给阿莲估价吧～';
      shopContentEl.appendChild(empty);
    } else {
      let totalAll = 0;
      for (const f of fishes) {
        const sp = specMap.get(f.speciesId);
        const isHot = hotIds.has(f.speciesId);
        const salePrice = getFishSellPrice(f);
        totalAll += salePrice;
        const iconUrl = getFishIconUrl(f.speciesId, sp);

        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `
          <img class="shop-item-img" src="${iconUrl || ''}" alt="${sp?.nameZh || ''}" />
          <div class="shop-item-info">
            <div class="shop-item-name">
              ${sp?.nameZh || f.speciesId}
              <span class="aq-grade">${f.grade || '普通'}</span>
              ${isHot ? '<span class="shop-hot-tag">今日 1.5x</span>' : ''}
            </div>
            <div class="shop-item-desc">体长 ${f.lengthCm} cm · 收购价 ${salePrice} 贝币</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = 'shop-buy-btn sell';
        btn.textContent = `卖出 +${salePrice}`;
        btn.addEventListener('click', () => {
          const res = gameState.sellFishFromInventory(f.uid, salePrice);
          if (res) {
            voiceBlip.playCoinChime();
            showToast({
              text: `阿莲收下了「${sp?.nameZh}」，入账 +${res.earned} 贝币！`,
              portrait: 'npc_market',
              mood: 'happy',
            });
            renderShopContent();
          }
        });
        row.appendChild(btn);
        shopContentEl.appendChild(row);
      }

      const summary = document.createElement('span');
      summary.className = 'shop-item-desc';
      summary.textContent = `共 ${fishes.length} 条渔获 · 合计可售 ${totalAll} 贝币`;
      const btnAll = document.createElement('button');
      btnAll.className = 'shop-buy-btn sell';
      btnAll.textContent = `一键全部卖出 (+${totalAll} 贝币)`;
      btnAll.addEventListener('click', () => {
        const res = gameState.sellAllFishFromInventory(getFishSellPrice);
        if (res.count > 0) {
          voiceBlip.playCoinChime();
          showToast({
            text: `阿莲：「好丰收！共收下 ${res.count} 条新鲜渔获，给你 ${res.totalEarned} 贝币！」`,
            portrait: 'npc_market',
            mood: 'surprised',
          });
          renderShopContent();
        }
      });
      shopFooterEl.append(summary, btnAll);
    }
  } else {
    // Old Zhou's Tackle & Bait Workshop Shop!
    if (shopNpcPortraitEl) shopNpcPortraitEl.src = PORTRAITS.npc_artisan.happy;
    if (shopTitleEl) shopTitleEl.textContent = '老周渔具工坊商店';
    if (shopSubtitleEl) shopSubtitleEl.textContent = '手工鱼竿与特制鱼饵，钓大鱼更得心应手';

    const rodHeader = document.createElement('div');
    rodHeader.className = 'shop-section-title';
    rodHeader.textContent = '🎣 手工钓竿（购买后自动装备，底部可随时切换）';
    shopContentEl.appendChild(rodHeader);

    for (const rod of ROD_CATALOG) {
      const owned = gameState.data.equipment.ownedRods.includes(rod.id);
      const equipped = gameState.data.equipment.rodId === rod.id;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <img class="shop-item-img" src="${rod.icon}" alt="${rod.nameZh}" />
        <div class="shop-item-info">
          <div class="shop-item-name">${rod.nameZh}</div>
          <div class="shop-item-desc">射程 ${rod.castRange}m · 拉力 ×${rod.power} · ${rod.desc}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = `shop-buy-btn ${equipped ? 'equipped' : ''}`;
      btn.textContent = equipped ? '已装备' : owned ? '装备' : `${rod.price} 贝币购买`;
      btn.addEventListener('click', () => {
        const res = gameState.buyRod(rod);
        if (!res.ok) {
          showToast({ text: res.reason, portrait: 'npc_artisan', mood: 'thinking' });
          return;
        }
        playerAvatar.setRodStyle(rod.id);
        voiceBlip.playCoinChime();
        showToast({
          text: res.equippedOnly
            ? `已换上「${rod.nameZh}」！`
            : `老周：「好眼光！这根「${rod.nameZh}」我已经帮你配好线轮装上了！」`,
          portrait: 'npc_artisan',
          mood: 'happy',
        });
        renderShopContent();
      });
      row.appendChild(btn);
      shopContentEl.appendChild(row);
    }

    const baitHeader = document.createElement('div');
    baitHeader.className = 'shop-section-title';
    baitHeader.textContent = '🪱 特制鱼饵（每包 5 份，吸引对应水层鱼群）';
    shopContentEl.appendChild(baitHeader);

    for (const bait of BAIT_CATALOG) {
      const curQty = gameState.data.equipment.baitCounts[bait.id] || 0;
      const packPrice = bait.price * 5;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <img class="shop-item-img" src="${bait.icon}" alt="${bait.nameZh}" />
        <div class="shop-item-info">
          <div class="shop-item-name">${bait.nameZh} <span class="aq-grade">持有 ${curQty}</span></div>
          <div class="shop-item-desc">吸引：${bait.targetHint}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'shop-buy-btn';
      btn.textContent = `${packPrice} 贝币 / 5份`;
      btn.addEventListener('click', () => {
        const res = gameState.buyBaitPack(bait, 5);
        if (!res.ok) {
          showToast({ text: res.reason, portrait: 'npc_artisan', mood: 'thinking' });
          return;
        }
        voiceBlip.playCoinChime();
        showToast({
          text: `购买了 5 份「${bait.nameZh}」，已顺手装上鱼钩！`,
          portrait: 'npc_artisan',
          mood: 'happy',
        });
        renderShopContent();
      });
      row.appendChild(btn);
      shopContentEl.appendChild(row);
    }

    const tip = document.createElement('span');
    tip.className = 'shop-item-desc';
    tip.textContent = '提示：赚够贝币升级远洋海钓竿，挑战东海黄鳍金枪鱼更轻松！';
    shopFooterEl.appendChild(tip);
  }
}

document.getElementById('btn-close-shop')?.addEventListener('click', closeShop);

// ---------------------------------------------------------------------------
// 7. NPC Dialogue Scripts (Subtitle + Dynamic Mood Portraits + Voice Blips!)
// ---------------------------------------------------------------------------
function startNpcConversation(npc) {
  playerController.clearKeys();
  npc.setTalking(true);
  setCameraMode('dialogue', npc.id);

  const restoreCamera = () => {
    npc.setTalking(false);
    if (!shopState.open) {
      setCameraMode(gameState.data.insideBuildingId ? 'indoor' : 'walking');
    }
  };

  if (npc.id === 'npc_market') {
    const hotNames = Array.from(getDailyHotSpeciesIds())
      .map((id) => specMap.get(id)?.nameZh || id)
      .join('」和「');
    const fishCount = gameState.data.inventory.filter((i) => i.kind === 'fish').length;

    dialogueSystem.open(
      {
        speakerId: 'npc_market',
        speakerName: '渔市老板娘 · 阿莲',
        role: '渔获收购与鱼讯',
        lines: [
          {
            mood: 'happy',
            text:
              fishCount > 0
                ? `哟，小渔夫回来啦！看你鱼护沉甸甸的，今天装了 ${fishCount} 条新鲜渔获呢！`
                : '早安呀小渔夫！今天泻湖水面亮堂堂的，正适合划着红木小船出去转转。',
          },
          {
            mood: 'neutral',
            text: `偷偷告诉你，今天镇上酒馆最抢手的是「${hotNames}」，钓到了拿来我这儿，直接按 1.5 倍高价收！`,
          },
        ],
        choices: [
          {
            label: `🐟 出售鱼护里的渔获（${fishCount} 条）`,
            primary: true,
            onSelect: () => openShop('market'),
          },
          {
            label: '💬 聊聊大房子和镇上近况',
            onSelect: () => {
              dialogueSystem.open(
                {
                  speakerId: 'npc_market',
                  speakerName: '渔市老板娘 · 阿莲',
                  role: '渔获收购与鱼讯',
                  lines: [
                    {
                      mood: 'happy',
                      text: '等你多攒些贝币，听说镇里以后还会开放更大的带厨房木屋呢！到时候自己煎条真鲷，想想都香～',
                    },
                    {
                      mood: 'surprised',
                      text: '对了，最稀有的王冠大鱼别急着全卖了，留几条放进自家屋里的大鱼缸养着，每天回家看一眼可治愈了！',
                    },
                  ],
                },
                restoreCamera
              );
            },
          },
          { label: '👋 一会儿再来', onSelect: () => {} },
        ],
      },
      restoreCamera
    );
  } else if (npc.id === 'npc_artisan') {
    dialogueSystem.open(
      {
        speakerId: 'npc_artisan',
        speakerName: '渔具工匠 · 老周',
        role: '鱼竿与鱼饵工坊',
        lines: [
          {
            mood: 'neutral',
            text: '嗯……欢迎来我这间小工坊。手里的竹竿用得还顺手吗？',
          },
          {
            mood: 'thinking',
            text: '浅滩小鱼用面团香饵和竹竿就够了；但要是想去东边灯塔外海拉黄鳍金枪鱼，最好换一根更柔韧的枫木竿或远洋海钓竿。',
          },
        ],
        choices: [
          {
            label: '🎣 逛逛老周渔具商店（买竿 / 买饵）',
            primary: true,
            onSelect: () => openShop('artisan'),
          },
          {
            label: '💬 请教不同鱼饵的秘密',
            onSelect: () => {
              dialogueSystem.open(
                {
                  speakerId: 'npc_artisan',
                  speakerName: '渔具工匠 · 老周',
                  role: '鱼竿与鱼饵工坊',
                  lines: [
                    {
                      mood: 'happy',
                      text: '面团香饵最讨静水锦鲤和宝莲灯喜欢；鲜甜虾仁专攻礁石边的真鲷、黑鲷和石狗公。',
                    },
                    {
                      mood: 'neutral',
                      text: '彩绘拟饵是远洋大鱼的克星，至于我手削的夜光木虾诱饵……黄昏日落时甩出去，银带鱼和软丝鱿鱼准会凑过来！',
                    },
                  ],
                },
                restoreCamera
              );
            },
          },
          { label: '👋 下次再来', onSelect: () => {} },
        ],
      },
      restoreCamera
    );
  } else if (npc.id === 'npc_lighthouse') {
    dialogueSystem.open(
      {
        speakerId: 'npc_lighthouse',
        speakerName: '灯塔守望者 · 海伯',
        role: '天气潮汐与巨物传说',
        lines: [
          {
            mood: 'happy',
            text: '哈哈，年轻人，海风把你吹到东海角灯塔来啦！这儿的浪花和远景最解乏。',
          },
          {
            mood: 'mysterious',
            text: '我在这灯塔守了三十年，见过比你那条小红船还长的黄鳍金枪鱼，就在灯塔东南外海的深蓝水沟里巡游……',
          },
        ],
        choices: [
          {
            label: '🌅 请海伯观潮换个好时辰（切换天气）',
            primary: true,
            onSelect: () => {
              const curIdx = WEATHER_CYCLE.indexOf(gameState.data.weather);
              const nextWeather = WEATHER_CYCLE[(curIdx + 1) % WEATHER_CYCLE.length];
              atmosphere.applyPreset(nextWeather);
              syncWeatherUI(nextWeather);
              gameState.setWeather(nextWeather, false);
              showToast({
                text: `海伯提灯望向海平线，天色渐渐转为了「${WEATHER_NAMES[nextWeather]}」`,
                portrait: 'npc_lighthouse',
                mood: 'happy',
              });
            },
          },
          {
            label: '🌊 听听静水泻湖的巨物传说',
            onSelect: () => {
              dialogueSystem.open(
                {
                  speakerId: 'npc_lighthouse',
                  speakerName: '灯塔守望者 · 海伯',
                  role: '天气潮汐与巨物传说',
                  lines: [
                    {
                      mood: 'mysterious',
                      text: '划船经过浅滩时动作轻一点，猛划桨会把胆小的鱼群吓散；静静漂着靠近，才能钓到真正罕见的「王冠」体型！',
                    },
                    {
                      mood: 'happy',
                      text: '要是偶尔把钓上的鱼温柔放生，泻湖会记住你的善意——积攒下的放生回响灵气，迟早会带来意想不到的好运气。',
                    },
                  ],
                },
                restoreCamera
              );
            },
          },
          { label: '👋 谢谢海伯，我去钓鱼啦', onSelect: () => {} },
        ],
      },
      restoreCamera
    );
  }
}

// ---------------------------------------------------------------------------
// 8. Register World Interactables (Docks, Boat, Doors, Aquarium, Bed, NPCs, Farm)
// ---------------------------------------------------------------------------
const isBusyModalOrSeq = () =>
  fishingSystem.isActive() || dialogueSystem.isOpen() || shopState.open || sleepSeq.active;

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
      setCameraMode('walking');
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
    setCameraMode('boat');
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

// Register all 3 Town NPCs!
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
    onInteract: () => startNpcConversation(npc),
  });
}

const aquariumModal = document.getElementById('aquarium-modal');
const basketModal = document.getElementById('basket-modal');

function openAquariumView() {
  basketModal?.classList.add('hidden');
  fishPanel?.classList.add('hidden');
  tweakPanel?.classList.add('hidden');
  aquariumModal?.classList.remove('hidden');
  renderAquariumModal();
  setCameraMode('aquarium');
  playerController.clearKeys();
}
function closeAquariumView() {
  aquariumModal?.classList.add('hidden');
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
    canInteract: () => gameState.data.insideBuildingId === 'player_home' && !isBusyModalOrSeq(),
    getLabel: () => `观赏 / 管理家里鱼缸（${gameState.data.aquariumFish.length}/10）`,
    onInteract: () => openAquariumView(),
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
    onInteract: () => startCozyBedSleep(),
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
// 9. HUD, Fishing UI, Catch Card, Basket & Aquarium Management
// ---------------------------------------------------------------------------
const btnTown = document.getElementById('btn-focus-town');
const btnVoice = document.getElementById('btn-toggle-voice');
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

btnVoice?.addEventListener('click', () => {
  const muted = voiceBlip.toggleMute();
  btnVoice.textContent = muted ? '拟声: 关' : '拟声: 开';
});

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
  // Always returns either Codex's watercolor PNG or a species-accurate painted fish illustration!
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
  if (dialogueSystem.isOpen() || shopState.open || sleepSeq.active) return;
  fishingSystem.onActionDown(water.addRipple);
});
window.addEventListener('pointerup', () => {
  fishingSystem.onActionUp();
});

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

function buildFishRowHtml(rec) {
  const sp = specMap.get(rec.speciesId);
  const iconUrl = getFishIconUrl(rec.speciesId, sp);
  return `
    <div class="aq-fish-thumb">
      <img src="${iconUrl || ''}" alt="${sp?.nameZh || ''}" />
    </div>
    <div class="aq-fish-info">
      <div class="aq-fish-name">${sp?.nameZh || rec.speciesId} <span class="aq-grade">${rec.grade || '普通'}</span></div>
      <div class="aq-fish-sub">体长 ${rec.lengthCm} cm${rec.price ? ` · 约 ${rec.price} 贝币` : ''}</div>
    </div>
  `;
}

function renderBasketModal() {
  const listEl = document.getElementById('basket-fish-list');
  const countBadge = document.getElementById('basket-count-badge');
  if (!listEl) return;
  const fishes = gameState.data.inventory.filter((i) => i.kind === 'fish');
  if (countBadge) countBadge.textContent = `${fishes.length} 条`;
  listEl.innerHTML = '';

  if (!fishes.length) {
    listEl.innerHTML = '<div class="aq-empty">随身鱼护还是空的，划船或到码头按 Space 钓几条鱼吧！</div>';
    return;
  }

  for (const rec of fishes) {
    const row = document.createElement('div');
    row.className = 'aq-fish-row';
    row.innerHTML = buildFishRowHtml(rec);
    listEl.appendChild(row);
  }
}

function renderAquariumModal() {
  const tankListEl = document.getElementById('aquarium-fish-list');
  const basketListEl = document.getElementById('aquarium-basket-list');
  const capBadge = document.getElementById('aq-cap-badge');
  if (!tankListEl || !basketListEl) return;

  const tankFish = gameState.data.aquariumFish;
  const basketFish = gameState.data.inventory.filter((i) => i.kind === 'fish');
  if (capBadge) capBadge.textContent = `${tankFish.length} / 10`;

  tankListEl.innerHTML = '';
  if (!tankFish.length) {
    tankListEl.innerHTML = '<div class="aq-empty">鱼缸目前空着，从下方随身鱼护挑一条放进来吧！</div>';
  } else {
    for (const rec of tankFish) {
      const sp = specMap.get(rec.speciesId);
      const row = document.createElement('div');
      row.className = 'aq-fish-row';
      row.innerHTML = buildFishRowHtml(rec);
      const btnOut = document.createElement('button');
      btnOut.className = 'aq-action-btn btn-out';
      btnOut.textContent = '捞回鱼护';
      btnOut.addEventListener('click', () => {
        if (gameState.removeFishFromAquarium(rec.uid)) {
          showToast({
            text: `已将「${sp?.nameZh || rec.speciesId}」捞回随身鱼护`,
            portrait: 'player',
            mood: 'neutral',
          });
        }
      });
      row.appendChild(btnOut);
      tankListEl.appendChild(row);
    }
  }

  basketListEl.innerHTML = '';
  if (!basketFish.length) {
    basketListEl.innerHTML = '<div class="aq-empty">随身鱼护暂无活鱼，快去湖里钓一条带回家吧！</div>';
  } else {
    for (const rec of basketFish) {
      const sp = specMap.get(rec.speciesId);
      const row = document.createElement('div');
      row.className = 'aq-fish-row';
      row.innerHTML = buildFishRowHtml(rec);
      const btnIn = document.createElement('button');
      btnIn.className = 'aq-action-btn';
      btnIn.textContent = '放入鱼缸';
      btnIn.addEventListener('click', () => {
        if (gameState.data.aquariumFish.length >= 10) {
          showToast({
            text: '当前小屋鱼缸已满 10 条啦！以后买大房子就能换更大的巨型鱼缸哦',
            portrait: 'player',
            mood: 'surprised',
          });
          return;
        }
        if (gameState.moveFishToAquarium(rec.uid)) {
          showToast({
            text: `已将「${sp?.nameZh || rec.speciesId}（${rec.lengthCm}cm）」放进家里的大生态鱼缸！`,
            portrait: 'dog',
            mood: 'excited',
          });
        }
      });
      row.appendChild(btnIn);
      basketListEl.appendChild(row);
    }
  }
}

document.getElementById('btn-close-aquarium')?.addEventListener('click', closeAquariumView);
document.getElementById('btn-open-basket')?.addEventListener('click', () => {
  if (camState.mode === 'aquarium' || shopState.open || dialogueSystem.isOpen()) return;
  const willShow = basketModal?.classList.contains('hidden');
  fishPanel?.classList.add('hidden');
  tweakPanel?.classList.add('hidden');
  if (willShow) {
    renderBasketModal();
    basketModal?.classList.remove('hidden');
  } else {
    basketModal?.classList.add('hidden');
  }
});
document.getElementById('btn-close-basket')?.addEventListener('click', () => {
  basketModal?.classList.add('hidden');
});

// Gear Cycle Buttons (Cycles owned rods; prompts visiting Old Zhou's Workshop if only bamboo is owned!)
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
  const nextId = owned[(idx + 1) % owned.length];
  const next = getRodSpec(nextId);
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
  if (sleepSeq.active) return;
  fishingSystem.cancel();
  dialogueSystem.close();
  closeShop();
  closeAquariumView();
  playerController.warpToHomeDock();
  setCameraMode(gameState.data.playerMode === 'walking' ? 'walking' : 'boat');
});

// Keyboard handling
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (sleepSeq.active) return;

  if (shopState.open) {
    if (e.code === 'Escape') closeShop();
    return;
  }

  if (dialogueSystem.isOpen()) {
    if (e.code === 'Escape') {
      dialogueSystem.close();
    } else if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
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
    closeAquariumView();
    basketModal?.classList.add('hidden');
    fishPanel?.classList.add('hidden');
    tweakPanel?.classList.add('hidden');
    return;
  }

  if (e.code === 'KeyB') {
    if (camState.mode === 'aquarium' || fishingSystem.isActive()) return;
    document.getElementById('btn-open-basket')?.click();
    return;
  }

  if (e.code === 'KeyE') {
    if (camState.mode === 'aquarium') {
      closeAquariumView();
      return;
    }
    if (!fishingSystem.isActive()) {
      interactionSystem.trigger({ mode: gameState.data.playerMode });
    }
    return;
  }

  if (e.code === 'Space' || e.code === 'KeyF') {
    if (camState.mode === 'aquarium') return;
    e.preventDefault();
    fishingSystem.onActionDown(water.addRipple);
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

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'KeyF') {
    fishingSystem.onActionUp();
  }
});

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
  if (e.button === 0 && (fishingSystem.state.phase === 'bite' || fishingSystem.state.phase === 'fighting')) {
    fishingSystem.onActionDown(water.addRipple);
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

// Interactive 25-Species Fish Guide Drawer (ALL 25 species show painted fish icons!)
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
      const iconUrl = getFishIconUrl(sp.id, sp);
      const btn = document.createElement('button');
      btn.className = 'species-item';
      btn.dataset.speciesId = sp.id;
      btn.innerHTML = `
        <img class="species-thumb" src="${iconUrl || ''}" alt="${sp.nameZh}" />
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
  basketModal?.classList.add('hidden');
  if (willShow) fishPanel?.classList.remove('hidden');
  else fishPanel?.classList.add('hidden');
});
document.getElementById('btn-close-fish')?.addEventListener('click', () => {
  fishPanel?.classList.add('hidden');
});

document.getElementById('btn-toggle-panel')?.addEventListener('click', () => {
  const willShow = tweakPanel?.classList.contains('hidden');
  fishPanel?.classList.add('hidden');
  basketModal?.classList.add('hidden');
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

setCameraMode(camState.mode);
updateCameraImmediate();

// ---------------------------------------------------------------------------
// 10. Resize & Main Render Loop
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
  const fishingActive = fishingSystem.isActive();
  const inputLocked =
    camState.mode === 'aquarium' ||
    fishingSystem.state.phase === 'modal' ||
    dialogueSystem.isOpen() ||
    shopState.open ||
    sleepSeq.active;

  underwaterSharedUniforms.uTime.value = elapsed;

  // 1. Update Boat, Land Walking (or Bed Sleeping Animation!), Fishing & Dialogue
  boat.update(
    dt,
    elapsed,
    allWaterColliders,
    water.addRipple,
    atmosphere.state.nightGlow,
    !inputLocked && !fishingActive
  );

  const sleepingNow = updateBedSleepSequence(dt, elapsed);
  if (!sleepingNow) {
    playerController.update(
      dt,
      elapsed,
      camState.yawDeg,
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
    if (
      camState.mode !== 'aquarium' &&
      camState.mode !== 'dialogue' &&
      camState.mode !== 'town' &&
      camState.mode !== 'fish'
    ) {
      setCameraMode(newInsideId ? 'indoor' : 'walking');
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
    // Slight +X target offset shifts the glass tank left-of-center so it sits cleanly clear of the right UI drawer!
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

  updateCameraImmediate();
  atmosphere.update(elapsed, camState.target);

  // 5. Update World-Anchored [E] Interaction Prompt & Bite Alert Position
  if (camState.mode === 'aquarium' || isBusyModalOrSeq()) {
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

  // 6. Render Refraction Water Pass + Final Frame
  water.update(elapsed, camera, boat.state);
  water.renderRefractionPass(renderer, scene, camera);
  renderer.render(scene, camera);
}

animate();
