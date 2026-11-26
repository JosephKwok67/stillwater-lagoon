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
    icon: './assets/icons/rods/rod_bamboo.png',
    castRange: 6.4,
    power: 1.0,
    price: 0,
    desc: '轻巧顺手的老竹竿，适合在浅滩和码头慢悠悠甩竿。',
  },
  {
    id: 'rod_maple',
    nameZh: '枫木溪流竿',
    icon: './assets/icons/rods/rod_maple.png',
    castRange: 8.2,
    power: 1.35,
    price: 180,
    desc: '老周打磨的柔韧枫木竿，应对礁石大鲷游刃有余。',
  },
  {
    id: 'rod_ocean',
    nameZh: '远洋海钓竿',
    icon: './assets/icons/rods/rod_ocean.png',
    castRange: 10.6,
    power: 1.85,
    price: 520,
    desc: '深蓝海钓强竿，能稳稳抗住黄鳍金枪鱼的爆发拉扯。',
  },
  {
    id: 'rod_starlight',
    nameZh: '静水秘制竿',
    icon: './assets/icons/rods/rod_starlight.png',
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
    icon: './assets/icons/baits/bait_dough.png',
    price: 6,
    targetHint: '淡水鱼 / 锦鲤 / 小型群游鱼',
  },
  {
    id: 'bait_shrimp',
    nameZh: '鲜甜虾仁',
    icon: './assets/icons/baits/bait_shrimp.png',
    price: 14,
    targetHint: '礁石鲷鱼 / 底栖鱼 / 软丝鱿鱼',
  },
  {
    id: 'bait_lure',
    nameZh: '彩绘拟饵',
    icon: './assets/icons/baits/bait_lure.png',
    price: 26,
    targetHint: '远洋掠食鱼 / 海鲈 / 黄鳍金枪鱼',
  },
  {
    id: 'bait_glow',
    nameZh: '夜光诱饵',
    icon: './assets/icons/baits/bait_glow.png',
    price: 34,
    targetHint: '日落深水 / 银带鱼 / 软丝鱿鱼 / 稀有种',
  },
];

export const UI_ICONS = {
  coin: './assets/icons/ui/coin.png',
  echoLeaf: './assets/icons/ui/echo_leaf.png',
  basket: './assets/icons/ui/basket.png',
  bobber: './assets/icons/ui/bobber.png',
};

export const PORTRAITS = {
  player: {
    neutral: './assets/portraits/player/neutral.png',
    happy: './assets/portraits/player/happy.png',
    surprised: './assets/portraits/player/surprised.png',
  },
  dog: {
    happy: './assets/portraits/dog/happy.png',
    excited: './assets/portraits/dog/excited.png',
  },
  npc_market: {
    neutral: './assets/portraits/npc_market/neutral.png',
    happy: './assets/portraits/npc_market/happy.png',
    surprised: './assets/portraits/npc_market/surprised.png',
  },
  npc_artisan: {
    neutral: './assets/portraits/npc_artisan/neutral.png',
    happy: './assets/portraits/npc_artisan/happy.png',
    thinking: './assets/portraits/npc_artisan/thinking.png',
  },
  npc_lighthouse: {
    neutral: './assets/portraits/npc_lighthouse/neutral.png',
    happy: './assets/portraits/npc_lighthouse/happy.png',
    mysterious: './assets/portraits/npc_lighthouse/mysterious.png',
  },
};

/**
 * Future Blender .glb drop-in paths. When Codex exports any of these files,
 * CharacterAvatar & Town builders can seamlessly hot-swap procedural meshes.
 */
export const MODEL_PATHS = {
  characters: {
    player: './assets/models/characters/player.glb',
    dog: './assets/models/characters/dog.glb',
    npc_market: './assets/models/characters/npc_market.glb',
    npc_artisan: './assets/models/characters/npc_artisan.glb',
    npc_lighthouse: './assets/models/characters/npc_lighthouse.glb',
  },
  buildings: {
    player_home: './assets/models/environment/house_player.glb',
    artisan_workshop: './assets/models/environment/house_artisan.glb',
    neighbor_east: './assets/models/environment/house_neighbor_east.glb',
  },
};

const fallbackFishCardCache = new Map();

/**
 * Generates a crisp, cozy painted Canvas 2D fish illustration (facing LEFT just like Codex's watercolor cards!)
 * for any of the remaining 17 species whose hand-painted PNG is still in production by Codex.
 * Guarantees players NEVER see an empty colored dot when catching any of the 25 species!
 */
function buildPaintedFishFallback(spec) {
  if (!spec) return null;
  if (fallbackFishCardCache.has(spec.id)) return fallbackFishCardCache.get(spec.id);

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext('2d');
  const rawPal = spec.palette || {};
  const pal = {
    dorsal: rawPal.back || rawPal.dorsal || spec.swatch || '#3d7a8a',
    flank: rawPal.flank || spec.swatch || '#7ec4cf',
    belly: rawPal.belly || '#f2eadc',
    fin: rawPal.fin || rawPal.flank || spec.swatch || '#e8a86b',
    accent: rawPal.accent || rawPal.back || '#c84b34',
  };

  ctx.save();
  ctx.translate(128, 96);

  // Subtle soft gouache drop shadow
  ctx.shadowColor = 'rgba(12, 46, 58, 0.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;

  const arch = spec.archetype || 'torpedo';

  if (arch === 'squid') {
    // Tentacles on left (-X), mantle & undulating skirt fins on right (+X)
    ctx.strokeStyle = pal.fin || pal.flank;
    ctx.lineCap = 'round';
    for (let t = -3; t <= 3; t++) {
      ctx.lineWidth = Math.abs(t) === 3 ? 4.5 : 5.5;
      ctx.beginPath();
      ctx.moveTo(-26, t * 5);
      ctx.quadraticCurveTo(-62, t * 9 + Math.sin(t) * 8, -96 + Math.abs(t) * 6, t * 7);
      ctx.stroke();
    }
    // Fin skirt
    ctx.fillStyle = pal.fin || pal.flank;
    ctx.beginPath();
    ctx.ellipse(38, 0, 56, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mantle body
    const g = ctx.createLinearGradient(0, -24, 0, 24);
    g.addColorStop(0, pal.dorsal);
    g.addColorStop(0.55, pal.flank);
    g.addColorStop(1, pal.belly);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-36, 0);
    ctx.quadraticCurveTo(18, -32, 92, 0);
    ctx.quadraticCurveTo(18, 32, -36, 0);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8ea';
    ctx.beginPath();
    ctx.arc(-28, -4, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#201814';
    ctx.beginPath();
    ctx.arc(-30, -4, 5.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (arch === 'shrimp') {
    // Antennae on left
    ctx.strokeStyle = pal.accent || '#e25138';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-64, -6);
    ctx.quadraticCurveTo(-96, -42, -32, -52);
    ctx.moveTo(-66, 0);
    ctx.quadraticCurveTo(-104, -18, -72, -38);
    ctx.stroke();
    // Segmented body
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? pal.accent || '#d94832' : '#fff8ee';
      ctx.beginPath();
      ctx.ellipse(-44 + i * 21, Math.sin(i * 0.45) * 6, 15, 19 - i * 1.4, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tail fan
    ctx.fillStyle = pal.accent || '#d94832';
    ctx.beginPath();
    ctx.moveTo(64, 8);
    ctx.lineTo(96, -8);
    ctx.lineTo(92, 22);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1b1614';
    ctx.beginPath();
    ctx.arc(-56, -6, 3.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Classic fish silhouette tailored by archetype (discus / bream / ribbon / flat / torpedo / baitfish)
    const rx = arch === 'discus' ? 62 : arch === 'bream' ? 68 : arch === 'ribbon' ? 92 : 76;
    const ry = arch === 'discus' ? 58 : arch === 'bream' ? 44 : arch === 'ribbon' ? 17 : arch === 'flat' ? 24 : 30;

    // Tail fin (right side, +X, since head faces LEFT!)
    ctx.fillStyle = pal.fin || pal.dorsal;
    ctx.beginPath();
    if (arch === 'ribbon') {
      ctx.moveTo(rx - 14, -10);
      ctx.lineTo(rx + 24, 0);
      ctx.lineTo(rx - 14, 10);
    } else {
      ctx.moveTo(rx - 16, 0);
      ctx.quadraticCurveTo(rx + 18, -ry * 0.95, rx + 34, -ry * 0.78);
      ctx.quadraticCurveTo(rx + 12, 0, rx + 34, ry * 0.78);
      ctx.quadraticCurveTo(rx + 18, ry * 0.95, rx - 16, 0);
    }
    ctx.closePath();
    ctx.fill();

    // Dorsal & Ventral fins
    ctx.beginPath();
    ctx.moveTo(-rx * 0.25, -ry * 0.8);
    ctx.quadraticCurveTo(rx * 0.15, -ry * 1.45, rx * 0.52, -ry * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, ry * 0.72);
    ctx.quadraticCurveTo(rx * 0.25, ry * 1.25, rx * 0.48, ry * 0.55);
    ctx.closePath();
    ctx.fill();

    // Main body gradient (dorsal -> flank -> warm cream belly)
    const grad = ctx.createLinearGradient(0, -ry, 0, ry);
    grad.addColorStop(0, pal.dorsal);
    grad.addColorStop(0.52, pal.flank);
    grad.addColorStop(1, pal.belly);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-rx, 2);
    ctx.quadraticCurveTo(-rx * 0.25, -ry * 1.25, rx * 0.92, -ry * 0.16);
    ctx.lineTo(rx * 0.92, ry * 0.16);
    ctx.quadraticCurveTo(-rx * 0.25, ry * 1.25, -rx, 2);
    ctx.closePath();
    ctx.fill();

    // Decorative species markings (stripes / neon / bars / mackerel waves / spots)
    ctx.save();
    ctx.clip();
    ctx.shadowBlur = 0;
    const pat = String(spec.pattern || '');
    if (pat.includes('neon') || pat.includes('stripe_h') || pat.includes('yellow')) {
      ctx.fillStyle = pal.accent;
      ctx.fillRect(-rx, -6, rx * 2, 10);
      if (pat.includes('neon') || spec.id === 'cardinal_tetra') {
        ctx.fillStyle = '#e83a30';
        ctx.fillRect(-rx * 0.1, 4, rx * 1.1, 14);
      }
    } else if (pat.includes('stripe') || pat.includes('bar') || pat.includes('mackerel') || pat.includes('wave')) {
      ctx.strokeStyle = pal.accent || pal.dorsal;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.52;
      for (let bx = -rx * 0.55; bx < rx * 0.65; bx += 18) {
        ctx.beginPath();
        ctx.moveTo(bx, -ry);
        ctx.quadraticCurveTo(bx + 6, -ry * 0.2, bx - 4, ry * 0.35);
        ctx.stroke();
      }
    } else if (pat.includes('spot') || pat.includes('koi') || pat.includes('mottle')) {
      ctx.fillStyle = pal.accent || '#fff5e4';
      ctx.globalAlpha = 0.72;
      for (const [sx, sy, sr] of [
        [-22, -8, 13],
        [8, -12, 15],
        [32, -4, 11],
        [-4, 6, 10],
      ]) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Pectoral side fin
    ctx.shadowBlur = 0;
    ctx.fillStyle = pal.fin || pal.flank;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.26, ry * 0.24, 17, 9, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Bright expressive eye on LEFT head end
    const eyeX = -rx * 0.68;
    const eyeY = -ry * 0.14;
    ctx.fillStyle = '#fff9ee';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1916';
    ctx.beginPath();
    ctx.arc(eyeX - 1.5, eyeY, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX - 3, eyeY - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  const dataUrl = c.toDataURL('image/png');
  fallbackFishCardCache.set(spec.id, dataUrl);
  return dataUrl;
}

export function syncDeliveredFishIcons(ids) {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    if (typeof id === 'string' && id) {
      DELIVERED_FISH_ICONS.add(id);
    }
  }
}

export function getFishIconUrl(speciesId, spec = null) {
  if (DELIVERED_FISH_ICONS.has(speciesId)) {
    return `./assets/icons/fish/${speciesId}.png`;
  }
  if (spec) {
    return buildPaintedFishFallback(spec);
  }
  return null;
}

export function getRodSpec(rodId) {
  return ROD_CATALOG.find((r) => r.id === rodId) || ROD_CATALOG[0];
}

export function getBaitSpec(baitId) {
  return BAIT_CATALOG.find((b) => b.id === baitId) || BAIT_CATALOG[0];
}
