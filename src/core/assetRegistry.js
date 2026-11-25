/**
 * Central Art & 3D Model Asset Registry synced with Codex's ART_ASSET_MANIFEST.md.
 * Automatically tracks delivered 2D portraits/icons and future Blender .glb models
 * with graceful fallback when an asset is not delivered yet.
 */

export const DELIVERED_FISH_ICONS = new Set([
  'stillwater_koi',
  'yellowfin_tuna',
  'red_sea_bream',
  'seabass',
  'blue_diamond_discus',
  'cutlassfish',
  'bigfin_reef_squid',
  'red_bee_shrimp',
]);

export const ROD_CATALOG = [
  {
    id: 'rod_bamboo',
    nameZh: '初始竹竿',
    icon: '/assets/icons/rods/rod_bamboo.png',
    castRange: 6.4,
    power: 1.0,
    price: 0,
    desc: '轻巧顺手的老竹竿，适合在浅滩和码头慢悠悠甩竿。',
  },
  {
    id: 'rod_maple',
    nameZh: '枫木溪流竿',
    icon: '/assets/icons/rods/rod_maple.png',
    castRange: 8.2,
    power: 1.35,
    price: 180,
    desc: '老周打磨的柔韧枫木竿，应对礁石大鲷游刃有余。',
  },
  {
    id: 'rod_ocean',
    nameZh: '远洋海钓竿',
    icon: '/assets/icons/rods/rod_ocean.png',
    castRange: 10.6,
    power: 1.85,
    price: 520,
    desc: '深蓝海钓强竿，能稳稳抗住黄鳍金枪鱼的爆发拉扯。',
  },
  {
    id: 'rod_starlight',
    nameZh: '静水秘制竿',
    icon: '/assets/icons/rods/rod_starlight.png',
    castRange: 11.4,
    power: 2.1,
    price: 980,
    desc: '嵌着星徽金轮的传说钓竿，提升王冠大鱼与放生回响概率。',
  },
];

export const BAIT_CATALOG = [
  {
    id: 'bait_dough',
    nameZh: '面团香饵',
    icon: '/assets/icons/baits/bait_dough.png',
    price: 6,
    targetHint: '淡水鱼 / 锦鲤 / 小型群游鱼',
  },
  {
    id: 'bait_shrimp',
    nameZh: '鲜甜虾仁',
    icon: '/assets/icons/baits/bait_shrimp.png',
    price: 14,
    targetHint: '礁石鲷鱼 / 底栖鱼 / 软丝鱿鱼',
  },
  {
    id: 'bait_lure',
    nameZh: '彩绘拟饵',
    icon: '/assets/icons/baits/bait_lure.png',
    price: 26,
    targetHint: '远洋掠食鱼 / 海鲈 / 黄鳍金枪鱼',
  },
  {
    id: 'bait_glow',
    nameZh: '夜光诱饵',
    icon: '/assets/icons/baits/bait_glow.png',
    price: 34,
    targetHint: '日落深水 / 银带鱼 / 软丝鱿鱼 / 稀有种',
  },
];

export const UI_ICONS = {
  coin: '/assets/icons/ui/coin.png',
  echoLeaf: '/assets/icons/ui/echo_leaf.png',
  basket: '/assets/icons/ui/basket.png',
  bobber: '/assets/icons/ui/bobber.png',
};

export const PORTRAITS = {
  player: {
    neutral: '/assets/portraits/player/neutral.png',
    happy: '/assets/portraits/player/happy.png',
    surprised: '/assets/portraits/player/surprised.png',
  },
  dog: {
    happy: '/assets/portraits/dog/happy.png',
    excited: '/assets/portraits/dog/excited.png',
  },
  npc_market: {
    neutral: '/assets/portraits/npc_market/neutral.png',
    happy: '/assets/portraits/npc_market/happy.png',
    surprised: '/assets/portraits/npc_market/surprised.png',
  },
  npc_artisan: {
    neutral: '/assets/portraits/npc_artisan/neutral.png',
    happy: '/assets/portraits/npc_artisan/happy.png',
    thinking: '/assets/portraits/npc_artisan/thinking.png',
  },
  npc_lighthouse: {
    neutral: '/assets/portraits/npc_lighthouse/neutral.png',
    happy: '/assets/portraits/npc_lighthouse/happy.png',
    mysterious: '/assets/portraits/npc_lighthouse/mysterious.png',
  },
};

/**
 * Future Blender .glb drop-in paths. When Codex exports any of these files,
 * CharacterAvatar & Town builders can seamlessly hot-swap procedural meshes.
 */
export const MODEL_PATHS = {
  characters: {
    player: '/assets/models/characters/player.glb',
    dog: '/assets/models/characters/dog.glb',
    npc_market: '/assets/models/characters/npc_market.glb',
    npc_artisan: '/assets/models/characters/npc_artisan.glb',
    npc_lighthouse: '/assets/models/characters/npc_lighthouse.glb',
  },
  buildings: {
    player_home: '/assets/models/environment/house_player.glb',
    artisan_workshop: '/assets/models/environment/house_artisan.glb',
    neighbor_east: '/assets/models/environment/house_neighbor_east.glb',
  },
};

export function getFishIconUrl(speciesId) {
  if (DELIVERED_FISH_ICONS.has(speciesId)) {
    return `/assets/icons/fish/${speciesId}.png`;
  }
  return null;
}

export function getRodSpec(rodId) {
  return ROD_CATALOG.find((r) => r.id === rodId) || ROD_CATALOG[0];
}

export function getBaitSpec(baitId) {
  return BAIT_CATALOG.find((b) => b.id === baitId) || BAIT_CATALOG[0];
}
