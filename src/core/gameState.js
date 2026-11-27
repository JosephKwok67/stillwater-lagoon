/**
 * Centralized Game State & LocalStorage Persistence Manager.
 * Designed to support sailing, walking, indoor aquarium fish keeping,
 * economy, fish compendium records, and future farming plots cleanly.
 */

const SAVE_KEY = 'stillwater_fishing_adventure_save_v1';
export const CURRENT_SAVE_VERSION = 2;

function createDefaultState() {
  return {
    version: CURRENT_SAVE_VERSION,
    day: 1,
    weather: 'sunny', // 'sunny' | 'morning' | 'sunset' | 'overcast'
    playerMode: 'sailing', // 'sailing' | 'walking' | 'fishing' | 'aquarium'
    insideBuildingId: null,
    mooredDockId: 'dock_home',
    coins: 120,
    echoPoints: 0,
    settings: {
      quality: 'auto', // 'auto' | 'high' | 'balanced' | 'low'
      voiceMuted: false,
    },
    equipment: {
      rodId: 'rod_bamboo',
      baitId: 'bait_dough',
      ownedRods: ['rod_bamboo'],
      baitCounts: {
        bait_dough: 15,
        bait_shrimp: 5,
        bait_lure: 2,
        bait_glow: 1,
      },
    },
    /**
     * Universal inventory supporting individual fish instances (with length/grade),
     * plus future seeds, crops, and crafted materials.
     */
    inventory: [],
    /**
     * Live fish swimming inside the player's indoor home aquarium!
     * Pre-stocked with 2 beloved lagoon residents so the aquarium is alive from Day 1.
     */
    aquariumFish: [
      {
        uid: 'starter_koi_1',
        speciesId: 'stillwater_koi',
        lengthCm: 42,
        sizeRatio: 1.05,
        grade: '普通',
        caughtDay: 1,
      },
      {
        uid: 'starter_discus_1',
        speciesId: 'blue_diamond_discus',
        lengthCm: 19,
        sizeRatio: 1.0,
        grade: '普通',
        caughtDay: 1,
      },
      {
        uid: 'starter_tetra_1',
        speciesId: 'cardinal_tetra',
        lengthCm: 5,
        sizeRatio: 1.0,
        grade: '普通',
        caughtDay: 1,
      },
    ],
    /**
     * Per-species compendium stats: { [speciesId]: { caughtCount, maxLengthCm, bestGrade } }
     */
    fishDex: {},
    /**
     * Reserved 12-tile sunny garden plots beside player's house for future Farming system!
     */
    farmPlots: Array.from({ length: 12 }, (_, idx) => ({
      index: idx,
      soilState: 'grass', // 'grass' | 'tilled' | 'watered'
      cropId: null,
      growthStage: 0,
    })),
    /**
     * Saved boat position when quitting so player resumes right where they left off
     */
    boatPose: {
      x: -1.15,
      z: 0.85,
      yaw: 0.42,
    },
  };
}

/**
 * Versioned save schema migration pipeline so older saves upgrade safely
 * as farming, cooking, livestock, and housing features are added in future milestones.
 */
function migrateSaveData(parsed) {
  const base = createDefaultState();
  const rawVersion = Number(parsed.version) || 1;
  const data = {
    ...base,
    ...parsed,
    equipment: {
      ...base.equipment,
      ...(parsed.equipment || {}),
      ownedRods: Array.isArray(parsed.equipment?.ownedRods) && parsed.equipment.ownedRods.length
        ? parsed.equipment.ownedRods
        : [...base.equipment.ownedRods],
      baitCounts: {
        ...base.equipment.baitCounts,
        ...((parsed.equipment && parsed.equipment.baitCounts) || {}),
      },
    },
    settings: {
      ...base.settings,
      ...(parsed.settings || {}),
    },
    boatPose: {
      ...base.boatPose,
      ...(parsed.boatPose || {}),
    },
    inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
    aquariumFish: Array.isArray(parsed.aquariumFish) ? parsed.aquariumFish : base.aquariumFish,
    fishDex: parsed.fishDex && typeof parsed.fishDex === 'object' ? parsed.fishDex : {},
    farmPlots:
      Array.isArray(parsed.farmPlots) && parsed.farmPlots.length === 12
        ? parsed.farmPlots
        : base.farmPlots,
  };

  // v1 -> v2: introduce persisted graphics quality & audio settings
  if (rawVersion < 2) {
    data.settings = {
      quality: data.settings.quality || 'auto',
      voiceMuted: Boolean(data.settings.voiceMuted),
    };
    data.version = 2;
  }

  // Always resume cleanly in sailing or walking (never stuck mid-cast or mid-aquarium modal)
  if (data.playerMode !== 'sailing' && data.playerMode !== 'walking') {
    data.playerMode = 'sailing';
  }
  if (data.playerMode === 'sailing') {
    data.insideBuildingId = null;
  }
  data.version = CURRENT_SAVE_VERSION;
  return data;
}

export function createGameState(eventBus) {
  let state = createDefaultState();

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;
      const oldVer = Number(parsed.version) || 1;
      state = migrateSaveData(parsed);
      if (oldVer < CURRENT_SAVE_VERSION) {
        saveNow();
      }
      return true;
    } catch (err) {
      console.warn('[GameState] Failed to load save, using fresh state:', err);
      state = createDefaultState();
      return false;
    }
  }

  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      saveNow();
    }, 350);
  }

  function saveNow() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[GameState] Save skipped:', err);
    }
  }

  load();

  return {
    get data() {
      return state;
    },

    saveNow,
    scheduleSave,

    reset() {
      state = createDefaultState();
      saveNow();
      eventBus.emit('state:changed', state);
      eventBus.emit('aquarium:updated', state.aquariumFish);
    },

    setPlayerMode(mode) {
      if (state.playerMode === mode) return;
      const prev = state.playerMode;
      state.playerMode = mode;
      eventBus.emit('player:modeChanged', { prev, next: mode });
      eventBus.emit('state:changed', state);
      scheduleSave();
    },

    setInsideBuilding(buildingId) {
      if (state.insideBuildingId === buildingId) return;
      const prev = state.insideBuildingId;
      state.insideBuildingId = buildingId;
      eventBus.emit('building:occupancyChanged', { prev, next: buildingId });
      eventBus.emit('state:changed', state);
    },

    setWeather(presetKey, advanceDay = false) {
      state.weather = presetKey;
      if (advanceDay) state.day += 1;
      eventBus.emit('world:weatherChanged', { weather: presetKey, day: state.day });
      eventBus.emit('state:changed', state);
      scheduleSave();
    },

    setEquipment({ rodId, baitId }) {
      if (rodId) state.equipment.rodId = rodId;
      if (baitId) state.equipment.baitId = baitId;
      eventBus.emit('equipment:changed', state.equipment);
      eventBus.emit('state:changed', state);
      scheduleSave();
    },

    addFishToInventory(fishRecord) {
      const entry = {
        uid: `fish_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        kind: 'fish',
        caughtDay: state.day,
        ...fishRecord,
      };
      state.inventory.push(entry);

      const dex = state.fishDex[entry.speciesId] || {
        caughtCount: 0,
        maxLengthCm: 0,
        bestGrade: '普通',
      };
      dex.caughtCount += 1;
      if (entry.lengthCm > dex.maxLengthCm) dex.maxLengthCm = entry.lengthCm;
      if (entry.grade === '王冠' || (entry.grade === '大物' && dex.bestGrade === '普通')) {
        dex.bestGrade = entry.grade;
      }
      state.fishDex[entry.speciesId] = dex;

      eventBus.emit('inventory:updated', state.inventory);
      eventBus.emit('state:changed', state);
      scheduleSave();
      return entry;
    },

    moveFishToAquarium(fishUid) {
      const idx = state.inventory.findIndex((item) => item.uid === fishUid && item.kind === 'fish');
      if (idx === -1) return false;
      if (state.aquariumFish.length >= 10) return false;
      const [fish] = state.inventory.splice(idx, 1);
      state.aquariumFish.push(fish);
      eventBus.emit('inventory:updated', state.inventory);
      eventBus.emit('aquarium:updated', state.aquariumFish);
      eventBus.emit('state:changed', state);
      scheduleSave();
      return true;
    },

    removeFishFromAquarium(fishUid) {
      const idx = state.aquariumFish.findIndex((f) => f.uid === fishUid);
      if (idx === -1) return false;
      const [fish] = state.aquariumFish.splice(idx, 1);
      state.inventory.push({ ...fish, kind: 'fish' });
      eventBus.emit('inventory:updated', state.inventory);
      eventBus.emit('aquarium:updated', state.aquariumFish);
      eventBus.emit('state:changed', state);
      scheduleSave();
      return true;
    },

    addCoins(delta) {
      state.coins = Math.max(0, state.coins + delta);
      eventBus.emit('state:changed', state);
      scheduleSave();
    },

    addEcho(delta) {
      state.echoPoints = Math.max(0, state.echoPoints + delta);
      eventBus.emit('state:changed', state);
      scheduleSave();
    },

    sellFishFromInventory(fishUid, salePrice) {
      const idx = state.inventory.findIndex((item) => item.uid === fishUid && item.kind === 'fish');
      if (idx === -1) return null;
      const [fish] = state.inventory.splice(idx, 1);
      const earned = Math.max(1, Math.round(salePrice ?? fish.price ?? 20));
      state.coins += earned;
      eventBus.emit('inventory:updated', state.inventory);
      eventBus.emit('state:changed', state);
      scheduleSave();
      return { fish, earned };
    },

    sellAllFishFromInventory(getPriceFn) {
      const fishes = state.inventory.filter((item) => item.kind === 'fish');
      if (!fishes.length) return { count: 0, totalEarned: 0 };
      let totalEarned = 0;
      for (const f of fishes) {
        totalEarned += Math.max(1, Math.round(getPriceFn ? getPriceFn(f) : f.price ?? 20));
      }
      state.inventory = state.inventory.filter((item) => item.kind !== 'fish');
      state.coins += totalEarned;
      eventBus.emit('inventory:updated', state.inventory);
      eventBus.emit('state:changed', state);
      scheduleSave();
      return { count: fishes.length, totalEarned };
    },

    buyRod(rodSpec) {
      if (!rodSpec) return { ok: false, reason: '无效鱼竿' };
      if (state.equipment.ownedRods.includes(rodSpec.id)) {
        state.equipment.rodId = rodSpec.id;
        eventBus.emit('equipment:changed', state.equipment);
        eventBus.emit('state:changed', state);
        scheduleSave();
        return { ok: true, equippedOnly: true };
      }
      if (state.coins < rodSpec.price) {
        return { ok: false, reason: `贝币不足，还需要 ${rodSpec.price - state.coins} 贝币` };
      }
      state.coins -= rodSpec.price;
      state.equipment.ownedRods.push(rodSpec.id);
      state.equipment.rodId = rodSpec.id;
      eventBus.emit('equipment:changed', state.equipment);
      eventBus.emit('state:changed', state);
      scheduleSave();
      return { ok: true, equippedOnly: false };
    },

    buyBaitPack(baitSpec, packSize = 5) {
      if (!baitSpec) return { ok: false, reason: '无效鱼饵' };
      const packPrice = baitSpec.price * packSize;
      if (state.coins < packPrice) {
        return { ok: false, reason: `贝币不足，还需要 ${packPrice - state.coins} 贝币` };
      }
      state.coins -= packPrice;
      state.equipment.baitCounts[baitSpec.id] = (state.equipment.baitCounts[baitSpec.id] || 0) + packSize;
      state.equipment.baitId = baitSpec.id;
      eventBus.emit('equipment:changed', state.equipment);
      eventBus.emit('state:changed', state);
      scheduleSave();
      return { ok: true, packPrice, packSize };
    },

    consumeActiveBait() {
      const id = state.equipment.baitId;
      const cur = state.equipment.baitCounts[id] || 0;
      if (cur > 0) {
        state.equipment.baitCounts[id] = cur - 1;
        eventBus.emit('state:changed', state);
        scheduleSave();
      }
    },

    updateBoatPose(x, z, yaw) {
      state.boatPose.x = Number(x.toFixed(2));
      state.boatPose.z = Number(z.toFixed(2));
      state.boatPose.yaw = Number(yaw.toFixed(3));
      scheduleSave();
    },

    setSetting(key, value) {
      if (!state.settings) state.settings = {};
      if (state.settings[key] === value) return;
      state.settings[key] = value;
      eventBus.emit('settings:changed', state.settings);
      scheduleSave();
    },
  };
}
