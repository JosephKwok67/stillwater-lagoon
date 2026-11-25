import * as THREE from 'three';
import { clamp, mulberry32 } from './noise.js';

/**
 * Rich 24-species aquatic catalog inspired by Nachat's Aquarium (cda-social.github.io/aquarium/)
 * combined with Stillwater's signature painterly lagoon Koi.
 *
 * Every species defines:
 * - Distinct 3D silhouette archetype (8 bespoke procedural geometries)
 * - Painterly top-down & side-readable skin pattern texture
 * - Authentic relative scale (from tiny 0.42x Anchovies/Tetras/Shrimp up to giant 2.55x Yellowfin Tuna!)
 * - Dedicated habitat zones, depth bands, and autonomous swimming behavior
 */
export const FISH_SPECIES = [
  // =========================================================================
  // 1. SALTWATER & LAGOON FISH (Inspired by Nachat's Aquarium Saltwater Tank)
  // =========================================================================
  {
    id: 'yellowfin_tuna',
    nameZh: '黄鳍金枪鱼',
    nameEn: 'Yellowfin Tuna',
    category: '大型远洋鱼',
    archetype: 'torpedo',
    sizeLabel: '巨型',
    baseScale: 2.45,
    aspect: [1.18, 1.08, 1.05],
    speed: 1.35,
    behavior: 'cruise',
    depthRange: [-1.45, -2.35],
    count: 7,
    swatch: '#264b7c',
    palette: { back: '#1a3866', flank: '#6f9cc4', belly: '#dce9f2', fin: '#f5cb38', accent: '#ffe159' },
    pattern: 'yellowfin',
    zones: [
      { cx: 10.5, cz: -3.5, r: 9.5 },
      { cx: -14.0, cz: 15.0, r: 11.0 },
      { cx: 24.5, cz: 4.5, r: 10.5 },
      { cx: -24.0, cz: -5.5, r: 10.0 },
      { cx: 4.0, cz: 26.5, r: 12.0 },
    ],
  },
  {
    id: 'red_sea_bream',
    nameZh: '真鲷',
    nameEn: 'Red Sea Bream',
    category: '礁石鱼类',
    archetype: 'bream',
    sizeLabel: '大型',
    baseScale: 1.55,
    aspect: [1.0, 1.18, 0.82],
    speed: 0.72,
    behavior: 'cruise',
    depthRange: [-0.75, -1.45],
    count: 9,
    swatch: '#e87478',
    palette: { back: '#df5c62', flank: '#f29596', belly: '#f9e6e4', fin: '#ee7f84', accent: '#bfe8ff' },
    pattern: 'spots',
    zones: [
      { cx: 5.5, cz: -9.5, r: 6.5 },
      { cx: 19.5, cz: -7.5, r: 8.0 },
      { cx: -21.5, cz: 6.5, r: 8.5 },
      { cx: 16.0, cz: 20.5, r: 8.5 },
    ],
  },
  {
    id: 'black_sea_bream',
    nameZh: '黑鲷',
    nameEn: 'Black Sea Bream',
    category: '礁石鱼类',
    archetype: 'bream',
    sizeLabel: '中大型',
    baseScale: 1.42,
    aspect: [1.0, 1.15, 0.8],
    speed: 0.68,
    behavior: 'cruise',
    depthRange: [-0.85, -1.55],
    count: 9,
    swatch: '#5d6b78',
    palette: { back: '#3d4a57', flank: '#8898a6', belly: '#cfd9e0', fin: '#4d5b68', accent: '#27323d' },
    pattern: 'stripes_v',
    zones: [
      { cx: -1.5, cz: -10.5, r: 6.0 },
      { cx: -24.5, cz: 15.5, r: 8.5 },
      { cx: 24.5, cz: -8.5, r: 8.0 },
      { cx: -5.5, cz: 23.0, r: 8.5 },
    ],
  },
  {
    id: 'seabass',
    nameZh: '海鲈鱼',
    nameEn: 'Seabass',
    category: '大型远洋鱼',
    archetype: 'torpedo',
    sizeLabel: '大型',
    baseScale: 1.72,
    aspect: [1.32, 0.88, 0.82],
    speed: 0.92,
    behavior: 'cruise',
    depthRange: [-0.85, -1.65],
    count: 8,
    swatch: '#7c949c',
    palette: { back: '#4d656d', flank: '#b9cad0', belly: '#edf4f6', fin: '#6f858d', accent: '#364a52' },
    pattern: 'solid',
    zones: [
      { cx: -13.5, cz: -3.5, r: 8.0 },
      { cx: 15.5, cz: -9.5, r: 8.0 },
      { cx: -27.5, cz: 4.0, r: 9.0 },
      { cx: 26.5, cz: 19.5, r: 9.0 },
    ],
  },
  {
    id: 'yellowtail',
    nameZh: '鰤鱼',
    nameEn: 'Yellowtail',
    category: '大型远洋鱼',
    archetype: 'torpedo',
    sizeLabel: '大型',
    baseScale: 1.85,
    aspect: [1.26, 0.96, 0.94],
    speed: 1.12,
    behavior: 'cruise',
    depthRange: [-1.05, -1.85],
    count: 8,
    swatch: '#5a8f88',
    palette: { back: '#3d6f6e', flank: '#b8d1d4', belly: '#eef5f6', fin: '#e6c854', accent: '#edd45e' },
    pattern: 'stripes_h',
    zones: [
      { cx: 14.5, cz: 4.5, r: 8.5 },
      { cx: -17.5, cz: 14.5, r: 9.5 },
      { cx: 29.0, cz: -3.5, r: 9.5 },
      { cx: 7.5, cz: 29.5, r: 10.0 },
    ],
  },
  {
    id: 'kingfish',
    nameZh: '黄尾鰤',
    nameEn: 'Kingfish',
    category: '大型远洋鱼',
    archetype: 'torpedo',
    sizeLabel: '大型',
    baseScale: 1.78,
    aspect: [1.28, 0.92, 0.88],
    speed: 1.18,
    behavior: 'cruise',
    depthRange: [-0.95, -1.75],
    count: 6,
    swatch: '#468a98',
    palette: { back: '#2d6d82', flank: '#a8ced8', belly: '#e9f6f8', fin: '#f2d349', accent: '#f7dc54' },
    pattern: 'stripes_h',
    zones: [
      { cx: 3.5, cz: -6.5, r: 8.0 },
      { cx: 27.5, cz: 8.5, r: 9.5 },
      { cx: -25.5, cz: 20.5, r: 9.5 },
    ],
  },
  {
    id: 'spanish_mackerel',
    nameZh: '马鲛鱼',
    nameEn: 'Spanish Mackerel',
    category: '大型远洋鱼',
    archetype: 'torpedo',
    sizeLabel: '大型',
    baseScale: 1.62,
    aspect: [1.45, 0.8, 0.72],
    speed: 1.25,
    behavior: 'cruise',
    depthRange: [-0.85, -1.5],
    count: 7,
    swatch: '#4a7ea6',
    palette: { back: '#2e5d87', flank: '#afc8db', belly: '#edf5fa', fin: '#648aa8', accent: '#234566' },
    pattern: 'spots',
    zones: [
      { cx: -6.5, cz: -8.5, r: 7.5 },
      { cx: 19.5, cz: 0.5, r: 8.5 },
      { cx: -29.0, cz: -9.5, r: 9.0 },
      { cx: -11.5, cz: 27.5, r: 9.5 },
    ],
  },
  {
    id: 'mackerel',
    nameZh: '青花鲭鱼',
    nameEn: 'Mackerel',
    category: '群游鱼类',
    archetype: 'torpedo',
    sizeLabel: '中型',
    baseScale: 1.05,
    aspect: [1.22, 0.84, 0.78],
    speed: 1.08,
    behavior: 'school',
    depthRange: [-0.55, -1.05],
    count: 18,
    swatch: '#3a8ea3',
    palette: { back: '#1f6e86', flank: '#a9d0db', belly: '#eff7f9', fin: '#7ca7b5', accent: '#123e54' },
    pattern: 'mackerel_wave',
    zones: [
      { cx: 5.5, cz: -3.2, r: 5.2 },
      { cx: -14.5, cz: 5.5, r: 6.5 },
      { cx: 23.5, cz: 10.5, r: 6.5 },
      { cx: -3.5, cz: 22.0, r: 7.0 },
    ],
  },
  {
    id: 'horse_mackerel',
    nameZh: '竹荚鱼',
    nameEn: 'Horse Mackerel',
    category: '群游鱼类',
    archetype: 'torpedo',
    sizeLabel: '小型',
    baseScale: 0.84,
    aspect: [1.14, 0.88, 0.78],
    speed: 0.92,
    behavior: 'school',
    depthRange: [-0.5, -0.95],
    count: 18,
    swatch: '#84a68e',
    palette: { back: '#5f8772', flank: '#c5d6cc', belly: '#eff5f2', fin: '#d8c97a', accent: '#2e473c' },
    pattern: 'stripes_h',
    zones: [
      { cx: 3.2, cz: -12.5, r: 4.5 },
      { cx: -19.5, cz: -6.5, r: 6.0 },
      { cx: 25.5, cz: -12.0, r: 6.0 },
      { cx: 14.5, cz: 22.5, r: 6.5 },
    ],
  },
  {
    id: 'cutlassfish',
    nameZh: '银带鱼',
    nameEn: 'Cutlassfish',
    category: '奇特鱼类',
    archetype: 'ribbon',
    sizeLabel: '细长大型',
    baseScale: 2.05,
    aspect: [1.65, 0.78, 0.34],
    speed: 0.45,
    behavior: 'ribbon_drift',
    depthRange: [-1.15, -1.85],
    count: 8,
    swatch: '#d6e5ee',
    palette: { back: '#c8dce8', flank: '#edf6fb', belly: '#ffffff', fin: '#d7edf7', accent: '#8fb4c9' },
    pattern: 'solid',
    zones: [
      { cx: 2.5, cz: -4.2, r: 6.0 },
      { cx: 14.5, cz: -10.5, r: 6.5 },
      { cx: -21.5, cz: 11.5, r: 7.5 },
      { cx: 19.5, cz: 14.5, r: 7.5 },
    ],
  },
  {
    id: 'barracuda',
    nameZh: '尖嘴梭鱼',
    nameEn: 'Barracuda',
    category: '奇特鱼类',
    archetype: 'torpedo',
    sizeLabel: '中大型',
    baseScale: 1.48,
    aspect: [1.68, 0.68, 0.64],
    speed: 1.15,
    behavior: 'hover_dart',
    depthRange: [-0.6, -1.1],
    count: 7,
    swatch: '#9cb0b8',
    palette: { back: '#5c7580', flank: '#c8d6dc', belly: '#f0f5f7', fin: '#8a9ea6', accent: '#3d525c' },
    pattern: 'stripes_v',
    zones: [
      { cx: 9.5, cz: -7.5, r: 6.0 },
      { cx: -16.2, cz: 4.2, r: 6.5 },
      { cx: 27.0, cz: 3.0, r: 7.5 },
      { cx: -14.5, cz: 24.5, r: 7.5 },
    ],
  },
  {
    id: 'rockfish',
    nameZh: '眼张鱼',
    nameEn: 'Rockfish',
    category: '礁石鱼类',
    archetype: 'bream',
    sizeLabel: '中型',
    baseScale: 1.08,
    aspect: [0.95, 1.12, 0.88],
    speed: 0.52,
    behavior: 'cruise',
    depthRange: [-0.85, -1.35],
    count: 10,
    swatch: '#8f6a47',
    palette: { back: '#6b492b', flank: '#a8825a', belly: '#d9c2a3', fin: '#7a5838', accent: '#3b2615' },
    pattern: 'stripes_v',
    zones: [
      { cx: -7.8, cz: -2.5, r: 4.5 },
      { cx: 11.2, cz: 1.2, r: 5.0 },
      { cx: -26.5, cz: 11.5, r: 6.5 },
      { cx: 26.5, cz: 14.5, r: 6.5 },
      { cx: 2.5, cz: 19.5, r: 6.0 },
    ],
  },
  {
    id: 'scorpionfish',
    nameZh: '石狗公',
    nameEn: 'Scorpionfish',
    category: '底栖生物',
    archetype: 'flat',
    sizeLabel: '中型',
    baseScale: 1.12,
    aspect: [0.98, 0.92, 1.28],
    speed: 0.34,
    behavior: 'bottom',
    depthRange: [-1.2, -2.6],
    count: 10,
    swatch: '#b85b3a',
    palette: { back: '#9e4429', flank: '#cf744c', belly: '#e3b996', fin: '#b55635', accent: '#4a2114' },
    pattern: 'mottled',
    zones: [
      { cx: -5.5, cz: -1.8, r: 5.0 },
      { cx: 7.5, cz: 4.2, r: 5.5 },
      { cx: 20.5, cz: -10.5, r: 6.0 },
      { cx: -25.5, cz: 6.5, r: 6.5 },
      { cx: 24.5, cz: 14.0, r: 6.5 },
    ],
  },
  {
    id: 'flathead',
    nameZh: '沙鲬',
    nameEn: 'Flathead',
    category: '底栖生物',
    archetype: 'flat',
    sizeLabel: '中大型',
    baseScale: 1.48,
    aspect: [1.38, 0.54, 1.32],
    speed: 0.38,
    behavior: 'bottom',
    depthRange: [-1.1, -2.4],
    count: 9,
    swatch: '#bfa074',
    palette: { back: '#b39062', flank: '#cfb48a', belly: '#ebe0cc', fin: '#a38458', accent: '#6b5134' },
    pattern: 'mottled',
    zones: [
      { cx: -3.5, cz: -13.5, r: 5.5 },
      { cx: 9.5, cz: -13.2, r: 5.0 },
      { cx: -26.5, cz: 15.0, r: 6.5 },
      { cx: 26.0, cz: 11.5, r: 6.5 },
      { cx: -9.5, cz: 19.5, r: 6.5 },
    ],
  },
  {
    id: 'chicken_grunt',
    nameZh: '伊佐木',
    nameEn: 'Chicken Grunt',
    category: '礁石鱼类',
    archetype: 'bream',
    sizeLabel: '中型',
    baseScale: 1.06,
    aspect: [1.08, 1.0, 0.8],
    speed: 0.72,
    behavior: 'school',
    depthRange: [-0.65, -1.15],
    count: 12,
    swatch: '#9ca870',
    palette: { back: '#72824c', flank: '#c5cf9d', belly: '#eef2dc', fin: '#b8ba6c', accent: '#566134' },
    pattern: 'stripes_h',
    zones: [
      { cx: 10.8, cz: -3.2, r: 5.5 },
      { cx: -12.5, cz: 13.5, r: 6.0 },
      { cx: 21.5, cz: 18.5, r: 6.5 },
    ],
  },
  {
    id: 'star_snapper',
    nameZh: '星笛鲷',
    nameEn: 'Star Snapper',
    category: '礁石鱼类',
    archetype: 'bream',
    sizeLabel: '中大型',
    baseScale: 1.32,
    aspect: [1.02, 1.12, 0.84],
    speed: 0.66,
    behavior: 'cruise',
    depthRange: [-0.85, -1.45],
    count: 7,
    swatch: '#b5634a',
    palette: { back: '#8c422f', flank: '#c77a5c', belly: '#ebd0bd', fin: '#a8553d', accent: '#fff4d6' },
    pattern: 'spots',
    zones: [
      { cx: 9.8, cz: -1.6, r: 5.5 },
      { cx: 24.0, cz: -6.5, r: 6.5 },
      { cx: -19.5, cz: 19.5, r: 7.0 },
    ],
  },
  {
    id: 'anchovy',
    nameZh: '银鳀鱼群',
    nameEn: 'Anchovy',
    category: '群游鱼类',
    archetype: 'baitfish',
    sizeLabel: '迷你',
    baseScale: 0.48,
    aspect: [1.28, 0.72, 0.65],
    speed: 1.12,
    behavior: 'school',
    depthRange: [-0.36, -0.78],
    count: 26,
    swatch: '#b8d7e6',
    palette: { back: '#5b96b0', flank: '#d5eaf2', belly: '#ffffff', fin: '#c9e2ed', accent: '#3d7491' },
    pattern: 'solid',
    zones: [
      { cx: 2.2, cz: -1.8, r: 3.8 },
      { cx: -13.5, cz: -8.5, r: 4.5 },
      { cx: 22.5, cz: 6.5, r: 5.0 },
      { cx: -18.5, cz: 21.5, r: 5.0 },
    ],
  },

  // =========================================================================
  // 2. COLORFUL FRESHWATER & LAGOON JEWELS (Nachat's Freshwater + Stillwater Koi)
  // =========================================================================
  {
    id: 'stillwater_koi',
    nameZh: '静水锦鲤',
    nameEn: 'Stillwater Koi',
    category: '彩绘淡水鱼',
    archetype: 'baitfish',
    sizeLabel: '中型',
    baseScale: 1.02,
    aspect: [1.06, 0.96, 1.08],
    speed: 0.64,
    behavior: 'school',
    depthRange: [-0.36, -0.78],
    count: 26,
    swatch: '#f26a2c',
    palette: { back: '#eb5523', flank: '#fa943a', belly: '#ffe3b3', fin: '#ffe8bd', accent: '#fff6e3' },
    pattern: 'koi_calico',
    zones: [
      { cx: 1.8, cz: 1.9, r: 3.0 },
      { cx: 5.2, cz: -13.0, r: 3.0 },
      { cx: -16.5, cz: -2.0, r: 4.5 },
      { cx: 25.5, cz: 13.5, r: 5.0 },
      { cx: -25.5, cz: 11.5, r: 5.0 },
      { cx: 4.5, cz: 17.5, r: 5.0 },
    ],
  },
  {
    id: 'cardinal_tetra',
    nameZh: '宝莲灯鱼',
    nameEn: 'Cardinal Tetra',
    category: '彩绘淡水鱼',
    archetype: 'baitfish',
    sizeLabel: '迷你',
    baseScale: 0.45,
    aspect: [1.05, 0.85, 0.72],
    speed: 0.82,
    behavior: 'school',
    depthRange: [-0.32, -0.68],
    count: 24,
    swatch: '#27c4ff',
    palette: { back: '#14b4ff', flank: '#36dcff', belly: '#f0293d', fin: '#d9f6ff', accent: '#ff2b44' },
    pattern: 'neon_split',
    zones: [
      { cx: -5.8, cz: 2.4, r: 3.2 },
      { cx: -23.5, cz: 8.5, r: 4.5 },
      { cx: 24.5, cz: 18.5, r: 4.5 },
      { cx: -11.5, cz: -12.5, r: 4.0 },
    ],
  },
  {
    id: 'blue_diamond_discus',
    nameZh: '蓝钻七彩神仙',
    nameEn: 'Blue Diamond Discus',
    category: '彩绘淡水鱼',
    archetype: 'discus',
    sizeLabel: '中型',
    baseScale: 1.16,
    aspect: [0.92, 1.35, 0.56],
    speed: 0.42,
    behavior: 'glide',
    depthRange: [-0.52, -1.05],
    count: 8,
    swatch: '#2b88f0',
    palette: { back: '#1c6bd6', flank: '#3aa4ff', belly: '#52beff', fin: '#2c8ae6', accent: '#ff4747' },
    pattern: 'solid',
    zones: [
      { cx: -6.8, cz: 0.8, r: 4.0 },
      { cx: 1.2, cz: -12.2, r: 3.8 },
      { cx: -24.5, cz: 16.5, r: 5.5 },
      { cx: 22.5, cz: 12.5, r: 5.5 },
    ],
  },
  {
    id: 'red_turquoise_discus',
    nameZh: '红松石七彩神仙',
    nameEn: 'Red Turquoise Discus',
    category: '彩绘淡水鱼',
    archetype: 'discus',
    sizeLabel: '中型',
    baseScale: 1.18,
    aspect: [0.92, 1.35, 0.56],
    speed: 0.42,
    behavior: 'glide',
    depthRange: [-0.55, -1.05],
    count: 8,
    swatch: '#d94d3b',
    palette: { back: '#c43e2d', flank: '#df5942', belly: '#c43e2d', fin: '#e36348', accent: '#3de8e2' },
    pattern: 'discus_wave',
    zones: [
      { cx: -3.8, cz: 3.2, r: 4.0 },
      { cx: 7.2, cz: -11.4, r: 3.8 },
      { cx: 17.5, cz: 19.5, r: 5.5 },
      { cx: -22.5, cz: -3.5, r: 5.5 },
    ],
  },
  {
    id: 'pale_chub',
    nameZh: '宽鳍鱲（婚姻色）',
    nameEn: 'Pale Chub (Male)',
    category: '彩绘淡水鱼',
    archetype: 'baitfish',
    sizeLabel: '小型',
    baseScale: 0.78,
    aspect: [1.12, 0.88, 0.76],
    speed: 0.88,
    behavior: 'school',
    depthRange: [-0.38, -0.82],
    count: 15,
    swatch: '#3eb8ad',
    palette: { back: '#2b9c96', flank: '#64d1c2', belly: '#ff7d6b', fin: '#ff967d', accent: '#1e7885' },
    pattern: 'stripes_v',
    zones: [
      { cx: -4.2, cz: -11.8, r: 4.2 },
      { cx: -15.5, cz: -11.5, r: 4.8 },
      { cx: 15.5, cz: -12.0, r: 4.8 },
      { cx: -26.0, cz: 10.0, r: 5.5 },
    ],
  },

  // =========================================================================
  // 3. SQUID, CUTTLEFISH & SHRIMP (Nachat's Cephalopods & Crustaceans!)
  // =========================================================================
  {
    id: 'bigfin_reef_squid',
    nameZh: '软丝鱿鱼',
    nameEn: 'Bigfin Reef Squid',
    category: '头足与虾类',
    archetype: 'squid',
    sizeLabel: '中大型',
    baseScale: 1.38,
    aspect: [1.22, 0.62, 1.05],
    speed: 0.55,
    behavior: 'squid_glide',
    depthRange: [-0.62, -1.25],
    count: 10,
    swatch: '#d6a67e',
    palette: { back: '#c99067', flank: '#e6be9c', belly: '#f7e6d5', fin: '#e8d0ba', accent: '#75462b' },
    pattern: 'mottled',
    zones: [
      { cx: 4.5, cz: -8.2, r: 5.0 },
      { cx: 18.5, cz: -2.5, r: 6.5 },
      { cx: -19.5, cz: 6.5, r: 6.5 },
      { cx: 8.5, cz: 23.5, r: 7.0 },
    ],
  },
  {
    id: 'golden_cuttlefish',
    nameZh: '金乌贼',
    nameEn: 'Golden Cuttlefish',
    category: '头足与虾类',
    archetype: 'squid',
    sizeLabel: '中型',
    baseScale: 1.15,
    aspect: [0.98, 0.56, 1.24],
    speed: 0.4,
    behavior: 'squid_glide',
    depthRange: [-0.95, -1.65],
    count: 8,
    swatch: '#d1ac69',
    palette: { back: '#ba924c', flank: '#dec081', belly: '#f2e4c2', fin: '#e8d4a2', accent: '#6e4f23' },
    pattern: 'mottled',
    zones: [
      { cx: 1.5, cz: -13.2, r: 4.5 },
      { cx: -12.2, cz: 7.8, r: 5.5 },
      { cx: 25.5, cz: 15.5, r: 6.0 },
      { cx: -24.5, cz: 15.5, r: 6.0 },
    ],
  },
  {
    id: 'red_bee_shrimp',
    nameZh: '水晶红白虾',
    nameEn: 'Red Bee Shrimp',
    category: '头足与虾类',
    archetype: 'shrimp',
    sizeLabel: '迷你',
    baseScale: 0.52,
    aspect: [1.0, 0.85, 0.9],
    speed: 0.28,
    behavior: 'bottom',
    depthRange: [-0.9, -2.0],
    count: 16,
    swatch: '#e83838',
    palette: { back: '#e83535', flank: '#ffffff', belly: '#f7dfdf', fin: '#ffffff', accent: '#c71e26' },
    pattern: 'bee_bands',
    zones: [
      { cx: -5.2, cz: 3.0, r: 3.8 },
      { cx: 3.5, cz: -13.8, r: 3.2 },
      { cx: 26.5, cz: 12.5, r: 4.5 },
      { cx: -26.5, cz: 11.0, r: 4.5 },
      { cx: 14.5, cz: -13.0, r: 4.2 },
    ],
  },
];

/**
 * Generates a vibrant painterly Canvas 2D skin texture for a species.
 * UV convention across all fish archetypes:
 *   u ∈ [0, 1] -> tail tip (0) to snout tip (1)
 *   v ∈ [0, 1] -> ventral belly (0) to dorsal back ridge (1)
 * Notice: from top-down camera, v ∈ [0.6, 1.0] (dorsal back + upper flanks) is most visible,
 * so every pattern paints crisp, high-contrast painterly markings along the dorsal & upper flanks!
 */
export function createSpeciesTexture(spec) {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(spec.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const { back, flank, belly, accent } = spec.palette;

  // Base vertical gradient: top of canvas (y=0) corresponds to v=1 (dorsal back) in Three.js CanvasTexture
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, back);
  grad.addColorStop(0.45, flank);
  grad.addColorStop(0.82, belly);
  grad.addColorStop(1.0, belly);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Species-specific characteristic markings
  switch (spec.pattern) {
    case 'mackerel_wave': {
      // Classic wavy dark-blue tiger bars across dorsal back (super readable from top-down!)
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      for (let x = 28; x < w - 34; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x - 6, h * 0.16, x + 8, h * 0.30, x - 3, h * 0.46);
        ctx.stroke();
      }
      break;
    }
    case 'yellowfin': {
      // Dark navy dorsal sheen + luminous bright gold lateral stripe & golden tail/finlets tint
      ctx.fillStyle = accent;
      ctx.fillRect(14, h * 0.32, w * 0.72, h * 0.12);
      ctx.fillStyle = back;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(0, 0, w, h * 0.28);
      ctx.globalAlpha = 1;
      break;
    }
    case 'stripes_v': {
      // Bold vertical dark/teal bars across upper body (Black Sea Bream, Rockfish, Barracuda, Pale Chub)
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.56;
      for (let i = 0; i < 6; i++) {
        const bx = 54 + i * 27;
        ctx.beginPath();
        ctx.roundRect(bx, 0, 12, h * 0.68, 6);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'stripes_h': {
      // Crisp golden/dark horizontal lateral stripe (Yellowtail, Kingfish, Chicken Grunt, Horse Mackerel)
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.82;
      ctx.fillRect(18, h * 0.28, w - 42, h * 0.14);
      ctx.globalAlpha = 0.45;
      ctx.fillRect(24, h * 0.14, w - 58, h * 0.08);
      ctx.globalAlpha = 1;
      break;
    }
    case 'spots': {
      // Luminous spots along dorsal flanks (Red Sea Bream pale blue-white spots, Spanish Mackerel, Star Snapper)
      ctx.fillStyle = accent;
      for (let i = 0; i < 28; i++) {
        const sx = 42 + rng() * (w - 86);
        const sy = 6 + rng() * (h * 0.46);
        const sr = 2.5 + rng() * 3.8;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'mottled': {
      // Painterly seabed camouflage blotches (Scorpionfish, Flathead, Reef Squid, Cuttlefish)
      for (let i = 0; i < 65; i++) {
        const sx = rng() * w;
        const sy = rng() * h * 0.72;
        const rx = 6 + rng() * 18;
        const ry = 4 + rng() * 12;
        ctx.fillStyle = i % 3 === 0 ? accent : i % 3 === 1 ? belly : back;
        ctx.globalAlpha = 0.34 + rng() * 0.25;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'neon_split': {
      // Cardinal Tetra: glowing electric cyan-blue upper half + vivid crimson lower half!
      ctx.fillStyle = back;
      ctx.fillRect(0, 0, w, h * 0.44);
      ctx.fillStyle = flank;
      ctx.fillRect(12, h * 0.16, w - 22, h * 0.22);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h * 0.44, w, h * 0.56);
      break;
    }
    case 'discus_wave': {
      // Red Turquoise Discus: rich terracotta base with electric turquoise wavy horizontal stripes!
      ctx.fillStyle = back;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6.5;
      for (let row = 10; row < h - 8; row += 17) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const y = row + Math.sin(x * 0.08 + row * 0.3) * 4.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'bee_bands': {
      // Red Bee Shrimp: crisp ornamental red-and-white vertical body bands!
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = back;
      const bands = [
        [0, 48],
        [92, 54],
        [182, 52],
      ];
      for (const [bx, bw] of bands) {
        ctx.fillRect(bx, 0, bw, h);
      }
      break;
    }
    case 'koi_calico': {
      // Classic Stillwater vermilion-orange Koi with subtle cream calico dorsal patches!
      ctx.fillStyle = accent;
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.ellipse(75 + i * 38, 18 + (i % 2) * 16, 16, 11, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    default:
      break;
  }

  // Soft painterly scale/brush shimmer
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.ellipse(rng() * w, rng() * h * 0.55, 8 + rng() * 14, 3 + rng() * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Expressive eye near snout (u ≈ 0.84 -> x ≈ w * 0.84, y ≈ h * 0.36)
  const eyeX = w * 0.84;
  const eyeY = h * 0.36;
  ctx.fillStyle = spec.archetype === 'discus' ? '#ff4433' : '#f4eed8';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141920';
  ctx.beginPath();
  ctx.arc(eyeX + 1.1, eyeY, 3.8, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Helper to merge sub-geometries (preserving position, normal, uv, and vertex color tint for fins vs body)
 */
function mergeFishParts(parts) {
  const positions = [];
  const uvs = [];
  const colors = [];

  for (const { geo, tint } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position;
    const u = g.attributes.uv;
    const col = new THREE.Color(tint);
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      if (u) {
        uvs.push(u.getX(i), u.getY(i));
      } else {
        uvs.push(0.5, 0.5);
      }
      colors.push(col.r, col.g, col.b);
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

/**
 * Creates a clean sculpted ellipsoid fish body along X (head at +halfL, tail base at -halfL)
 * with consistent side+top UVs: u = 0..1 (tail->head), v = 0..1 (belly->back)
 */
function buildSculptedBody({
  halfLen = 0.28,
  halfH = 0.11,
  halfW = 0.08,
  tailPinch = 0.82,
  headTaper = 0.35,
  dorsalArch = 0.0,
  flatBelly = 0.0,
  segU = 12,
  segV = 8,
}) {
  const geo = new THREE.SphereGeometry(1, segU, segV);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); // -1..1
    let y = pos.getY(i); // -1..1
    let z = pos.getZ(i); // -1..1

    const u = clamp(x * 0.5 + 0.5, 0, 1); // 0 = tail, 1 = snout
    let profileH = 1.0;
    let profileW = 1.0;

    if (x < 0) {
      const t = clamp(-x, 0, 1);
      profileH = 1.0 - Math.pow(t, 1.35) * tailPinch;
      profileW = 1.0 - Math.pow(t, 1.15) * Math.min(0.92, tailPinch + 0.08);
    } else {
      const t = clamp(x, 0, 1);
      profileH = 1.0 - Math.pow(t, 1.6) * headTaper;
      profileW = 1.0 - Math.pow(t, 1.45) * (headTaper * 0.9);
    }

    let vy = y * halfH * profileH;
    if (y > 0) vy += Math.sin(u * Math.PI) * dorsalArch;
    if (y < 0 && flatBelly > 0) vy *= 1.0 - flatBelly;

    const vx = x * halfLen;
    const vz = z * halfW * profileW;
    pos.setXYZ(i, vx, vy, vz);

    // Map UV cleanly: u along length (tail->snout), v along height (belly->back)
    const vCoord = clamp(y * 0.5 + 0.5, 0.02, 0.98);
    uv.setXY(i, u, vCoord);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Helper to build a double-sided flat fin triangle/quad mesh with UV mapped to solid fin color
 */
function buildFinMesh(tris, uvX = 0.15, uvY = 0.55) {
  const positions = [];
  const uvs = [];
  for (let i = 0; i < tris.length; i += 9) {
    // Front face
    positions.push(
      tris[i], tris[i + 1], tris[i + 2],
      tris[i + 3], tris[i + 4], tris[i + 5],
      tris[i + 6], tris[i + 7], tris[i + 8]
    );
    // Back face (reversed winding for double-sided visibility)
    positions.push(
      tris[i], tris[i + 1], tris[i + 2],
      tris[i + 6], tris[i + 7], tris[i + 8],
      tris[i + 3], tris[i + 4], tris[i + 5]
    );
    for (let k = 0; k < 6; k++) uvs.push(uvX, uvY);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

/**
 * Builds the bespoke 3D BufferGeometry for a given species based on its archetype, aspect, and fin color!
 * Oriented facing +X (head at +X, tail at -X) so yaw aligns seamlessly with velocity.
 */
export function buildSpeciesGeometry(spec) {
  const [ax, ay, az] = spec.aspect || [1, 1, 1];
  const finTint = spec.palette.fin || '#d8e6eb';
  const parts = [];

  if (spec.archetype === 'torpedo') {
    // Sleek pelagic cruiser / Tuna / Mackerel / Yellowtail / Seabass / Barracuda
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.30 * ax,
        halfH: 0.105 * ay,
        halfW: 0.088 * az,
        tailPinch: 0.86,
        headTaper: 0.42,
      }),
      tint: '#ffffff',
    });

    const tailX = -0.28 * ax;
    const tipX = -0.48 * ax;
    const forkH = 0.16 * ay;
    // Crescent forked tail fin
    parts.push({
      geo: buildFinMesh([
        tailX, 0.01, 0, tipX, forkH, 0.015, tailX - 0.10 * ax, 0, 0,
        tailX, -0.01, 0, tailX - 0.10 * ax, 0, 0, tipX, -forkH, 0.015,
      ]),
      tint: finTint,
    });
    // Swept dorsal & ventral sickle fins (iconic on Yellowfin Tuna & Mackerel!)
    parts.push({
      geo: buildFinMesh([
        0.04 * ax, 0.08 * ay, 0, -0.14 * ax, 0.21 * ay, 0, -0.10 * ax, 0.06 * ay, 0,
        -0.02 * ax, -0.07 * ay, 0, -0.14 * ax, -0.17 * ay, 0, -0.12 * ax, -0.05 * ay, 0,
      ]),
      tint: finTint,
    });
    // Swept pectoral side fins (great top-down silhouette!)
    const pw = 0.08 * az;
    const pSpan = 0.21 * az;
    parts.push({
      geo: buildFinMesh([
        0.09 * ax, -0.01, pw, -0.09 * ax, -0.03, pSpan, -0.05 * ax, -0.01, pw * 0.7,
        0.09 * ax, -0.01, -pw, -0.05 * ax, -0.01, -pw * 0.7, -0.09 * ax, -0.03, -pSpan,
      ]),
      tint: finTint,
    });
  } else if (spec.archetype === 'bream') {
    // Deep oval sea bream / snapper / rockfish / grunt
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.25 * ax,
        halfH: 0.145 * ay,
        halfW: 0.082 * az,
        tailPinch: 0.78,
        headTaper: 0.32,
        dorsalArch: 0.028 * ay,
      }),
      tint: '#ffffff',
    });

    const tailX = -0.22 * ax;
    parts.push({
      geo: buildFinMesh([
        tailX, 0.015, 0, -0.39 * ax, 0.14 * ay, 0.012, -0.32 * ax, 0, 0,
        tailX, -0.015, 0, -0.32 * ax, 0, 0, -0.39 * ax, -0.13 * ay, 0.012,
      ]),
      tint: finTint,
    });
    // Continuous spiny dorsal crest
    parts.push({
      geo: buildFinMesh([
        0.10 * ax, 0.12 * ay, 0, -0.14 * ax, 0.21 * ay, 0, -0.15 * ax, 0.07 * ay, 0,
        0.10 * ax, 0.12 * ay, 0, 0.02 * ax, 0.20 * ay, 0, -0.14 * ax, 0.21 * ay, 0,
      ]),
      tint: finTint,
    });
    // Broad pectoral fins
    parts.push({
      geo: buildFinMesh([
        0.06 * ax, -0.02, 0.07 * az, -0.08 * ax, -0.04, 0.19 * az, -0.05 * ax, -0.02, 0.06 * az,
        0.06 * ax, -0.02, -0.07 * az, -0.05 * ax, -0.02, -0.06 * az, -0.08 * ax, -0.04, -0.19 * az,
      ]),
      tint: finTint,
    });
  } else if (spec.archetype === 'discus') {
    // Tall circular ornamental Discus with sweeping fins (slightly tilted in top-down view so full vibrant disc shows!)
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.21 * ax,
        halfH: 0.19 * ay,
        halfW: 0.068 * az,
        tailPinch: 0.65,
        headTaper: 0.25,
      }),
      tint: '#ffffff',
    });
    // Wide sweeping dorsal & anal veil fins wrapping the disc
    parts.push({
      geo: buildFinMesh([
        0.08 * ax, 0.15 * ay, 0, -0.20 * ax, 0.24 * ay, 0, -0.19 * ax, 0.05 * ay, 0,
        0.08 * ax, -0.15 * ay, 0, -0.19 * ax, -0.05 * ay, 0, -0.20 * ax, -0.24 * ay, 0,
        // Delicate translucent-looking fan tail
        -0.19 * ax, 0.03, 0, -0.31 * ax, 0.09 * ay, 0, -0.31 * ax, -0.09 * ay, 0,
        -0.19 * ax, 0.03, 0, -0.31 * ax, -0.09 * ay, 0, -0.19 * ax, -0.03, 0,
      ]),
      tint: finTint,
    });
  } else if (spec.archetype === 'ribbon') {
    // Long mirror-silver blade-like Cutlassfish tapering to a whip tail + continuous dorsal fin
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.44 * ax,
        halfH: 0.085 * ay,
        halfW: 0.042 * az,
        tailPinch: 0.94,
        headTaper: 0.36,
        segU: 20,
        segV: 6,
      }),
      tint: '#ffffff',
    });
    // Long undulating dorsal fin ribbon along the whole spine
    const ribbonTris = [];
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const x0 = (0.30 - (i / segs) * 0.68) * ax;
      const x1 = (0.30 - ((i + 1) / segs) * 0.68) * ax;
      const h0 = (0.075 * (1 - (i / segs) * 0.6)) * ay;
      const h1 = (0.075 * (1 - ((i + 1) / segs) * 0.6)) * ay;
      ribbonTris.push(
        x0, h0 * 0.65, 0, x0, h0 * 1.45, 0, x1, h1 * 1.45, 0,
        x0, h0 * 0.65, 0, x1, h1 * 1.45, 0, x1, h1 * 0.65, 0
      );
    }
    parts.push({ geo: buildFinMesh(ribbonTris), tint: finTint });
  } else if (spec.archetype === 'flat') {
    // Broad dorso-ventrally flattened bottom-dweller (Flathead & Scorpionfish) with big fan pectorals!
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.28 * ax,
        halfH: 0.078 * ay,
        halfW: 0.125 * az,
        tailPinch: 0.84,
        headTaper: 0.18,
        flatBelly: 0.45,
      }),
      tint: '#ffffff',
    });
    // Wide fanned horizontal pectoral wings (unmistakable from top-down!)
    parts.push({
      geo: buildFinMesh([
        0.12 * ax, -0.01, 0.09 * az, 0.02 * ax, -0.01, 0.25 * az, -0.10 * ax, -0.01, 0.21 * az,
        0.12 * ax, -0.01, 0.09 * az, -0.10 * ax, -0.01, 0.21 * az, -0.08 * ax, -0.01, 0.07 * az,
        0.12 * ax, -0.01, -0.09 * az, -0.10 * ax, -0.01, -0.21 * az, 0.02 * ax, -0.01, -0.25 * az,
        0.12 * ax, -0.01, -0.09 * az, -0.08 * ax, -0.01, -0.07 * az, -0.10 * ax, -0.01, -0.21 * az,
        // Rounded horizontal-ish spade tail
        -0.24 * ax, 0, 0.02, -0.39 * ax, 0.04, 0.10 * az, -0.39 * ax, -0.02, -0.10 * az,
      ]),
      tint: finTint,
    });
  } else if (spec.archetype === 'squid') {
    // Bigfin Reef Squid / Golden Cuttlefish: broad oval mantle + wide rippling lateral skirt fins + tentacles!
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.26 * ax,
        halfH: 0.075 * ay,
        halfW: 0.115 * az,
        tailPinch: 0.42,
        headTaper: 0.58,
        segU: 14,
        segV: 8,
      }),
      tint: '#ffffff',
    });
    // Wide oval lateral undulating fin skirt framing almost the whole mantle (classic Bigfin Reef Squid look!)
    const skirtTris = [];
    const sSegs = 6;
    for (let i = 0; i < sSegs; i++) {
      const t0 = i / sSegs;
      const t1 = (i + 1) / sSegs;
      const x0 = (-0.24 + t0 * 0.42) * ax;
      const x1 = (-0.24 + t1 * 0.42) * ax;
      const w0 = (0.11 + Math.sin(t0 * Math.PI) * 0.13) * az;
      const w1 = (0.11 + Math.sin(t1 * Math.PI) * 0.13) * az;
      const inner0 = 0.065 * az;
      const inner1 = 0.065 * az;
      // Right skirt (+Z) & Left skirt (-Z)
      skirtTris.push(
        x0, 0, inner0, x0, 0.01, w0, x1, 0.01, w1,
        x0, 0, inner0, x1, 0.01, w1, x1, 0, inner1,
        x0, 0, -inner0, x1, 0.01, -w1, x0, 0.01, -w0,
        x0, 0, -inner0, x1, 0, -inner1, x1, 0.01, -w1
      );
    }
    parts.push({ geo: buildFinMesh(skirtTris), tint: finTint });

    // Trailing cluster of 4 graceful tentacles extending from the head side (-X / +X)
    const tentTris = [];
    for (const tz of [-0.045, -0.015, 0.015, 0.045]) {
      tentTris.push(
        -0.21 * ax, 0, tz * az,
        -0.44 * ax, -0.015, tz * 1.45 * az,
        -0.21 * ax, 0.01, (tz + 0.016) * az
      );
    }
    parts.push({ geo: buildFinMesh(tentTris), tint: spec.palette.flank });
  } else if (spec.archetype === 'shrimp') {
    // Segmented cute Red Bee Shrimp with sweeping long white antennae & tail fan!
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.24 * ax,
        halfH: 0.088 * ay,
        halfW: 0.072 * az,
        tailPinch: 0.72,
        headTaper: 0.45,
        dorsalArch: 0.032,
      }),
      tint: '#ffffff',
    });
    // Sweeping slender white antennae + tiny fan tail
    parts.push({
      geo: buildFinMesh([
        0.22 * ax, 0.02, 0.02, 0.44 * ax, 0.03, 0.14, 0.22 * ax, 0.01, 0.032,
        0.22 * ax, 0.02, -0.02, 0.22 * ax, 0.01, -0.032, 0.44 * ax, 0.03, -0.14,
        -0.22 * ax, -0.01, 0, -0.32 * ax, -0.02, 0.08, -0.32 * ax, -0.02, -0.08,
      ]),
      tint: finTint,
    });
  } else {
    // Default 'baitfish': Koi / Cardinal Tetra / Anchovy / Pale Chub (plump streamlined with flowing forked tail & side fins)
    parts.push({
      geo: buildSculptedBody({
        halfLen: 0.25 * ax,
        halfH: 0.098 * ay,
        halfW: 0.082 * az,
        tailPinch: 0.78,
        headTaper: 0.28,
      }),
      tint: '#ffffff',
    });
    parts.push({
      geo: buildFinMesh([
        -0.21 * ax, 0.01, 0, -0.42 * ax, 0.11 * ay, 0.015, -0.34 * ax, 0, 0,
        -0.21 * ax, -0.01, 0, -0.34 * ax, 0, 0, -0.42 * ax, -0.10 * ay, 0.015,
        // Flowing side pectorals
        0.07 * ax, -0.015, 0.06 * az, -0.07 * ax, -0.03, 0.17 * az, -0.05 * ax, -0.015, 0.05 * az,
        0.07 * ax, -0.015, -0.06 * az, -0.05 * ax, -0.015, -0.05 * az, -0.07 * ax, -0.03, -0.17 * az,
      ]),
      tint: finTint,
    });
  }

  return mergeFishParts(parts);
}
