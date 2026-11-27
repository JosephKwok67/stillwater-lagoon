import { getShoreZ } from '../terrain.js';

/**
 * Single Source of Truth for Stillwater Lagoon's v2.1 Coastal Village layout.
 * Consumed by `town.js`, `town/*`, and `grass.js` so buildings, piers, promenade,
 * flagstones, garden plot, landmarks, and foliage exclusion zones NEVER drift out of sync!
 */

export const HOME_SPEC = {
  id: 'player_home',
  nameZh: '我的临水小屋',
  x: 3.2,
  z: -24.5,
  rotY: 0.04,
  width: 5.4,
  depth: 4.4,
  wallHeight: 2.08,
  roofHeight: 1.62,
  floorY: 0.28,
  doorX: -0.95,
  doorW: 1.12,
  doorH: 1.75,
  porchD: 1.48,
};

export const FARM_PLOT_SPEC = {
  x: -2.2,
  z: -24.0,
  plotW: 2.95,
  plotD: 2.35,
};

export const MARKET_STALL_SPEC = {
  x: -8.05,
  z: -19.55,
  rotY: 0.16,
  colliderRadius: 1.35,
  exclusionRadius: 1.82,
  rackX: -10.4,
  rackZ: -19.85,
  rackRadius: 0.65,
  rackExclusionRadius: 0.85,
};

export const LIGHTHOUSE_SPEC = {
  x: 21.8,
  z: -15.2,
  colliderRadius: 1.65,
  exclusionRadius: 2.38,
  shedX: 21.8 - 2.05,
  shedZ: -15.2 - 0.62,
  shedColliderRadius: 1.15,
  shedExclusionRadius: 1.52,
};

export const QUAY_SPEC = {
  startX: -10.2,
  endX: 11.8,
  segs: 28,
};

export const PROMENADE_SPEC = {
  startX: -13.0,
  endX: 13.3,
  width: 2.65,
  frontOffset: 0.28,
  pts: 36,
  y: 1.152,
};

export const PIER_SPECS = [
  {
    id: 'dock_home',
    nameZh: '自家小屋码头',
    pierX: 4.2,
    shoreZOffset: -0.15,
    pierEndZ: -11.6,
    pierY: 0.44,
    quayY: 1.14,
    pierW: 2.35,
    decorations: true,
    grassHalfW: 1.32,
    grassBackOffset: -0.45,
  },
  {
    id: 'dock_market',
    nameZh: '渔市集码头',
    pierX: -6.8,
    shoreZOffset: -0.15,
    pierEndZ: -11.8,
    pierY: 0.44,
    quayY: 1.14,
    pierW: 2.15,
    decorations: false,
    grassHalfW: 1.22,
    grassBackOffset: -0.45,
  },
  {
    id: 'dock_lighthouse',
    nameZh: '东海角灯塔栈桥',
    pierX: 14.2,
    shoreZOffset: 0.12,
    pierEndZ: -9.6,
    pierY: 0.44,
    quayY: 1.14,
    pierW: 1.95,
    decorations: false,
    grassHalfW: 1.18,
    grassBackOffset: -0.55,
  },
];

export const VILLAGE_HOUSE_SPECS = [
  {
    id: 'artisan_workshop',
    nameZh: '老周渔具工坊',
    x: -8.4,
    z: -23.6,
    rot: 0.16,
    w: 4.6,
    d: 3.8,
    h: 2.02,
    rh: 1.08,
    floorY: 0.24,
    doorX: 0.68,
    doorW: 1.22,
    doorH: 1.78,
    porchD: 1.25,
    wallKey: 'ochre',
    roofKey: 'slate',
    shutterKey: 'blue',
    porch: true,
    dormer: false,
    enterable: true,
    interiorTheme: 'artisan_workshop',
  },
  {
    id: 'neighbor_east',
    nameZh: '东岸木屋',
    x: 10.8,
    z: -22.8,
    rot: -0.2,
    w: 4.3,
    d: 3.6,
    h: 2.02,
    rh: 1.23,
    floorY: 0.28,
    doorX: -0.78,
    doorW: 1.06,
    doorH: 1.7,
    porchD: 1.05,
    wallKey: 'cream',
    roofKey: 'terracotta',
    shutterKey: 'green',
    porch: true,
    dormer: false,
    enterable: true,
    interiorTheme: 'neighbor',
  },
  // West flank cottage + 5 staggered multi-tier hillside back-row cottages
  { x: -14.8, z: -21.2, rot: 0.34, w: 3.4, d: 2.8, h: 1.85, rh: 1.22, wallKey: 'sage', roofKey: 'slate', shutterKey: 'teal', porch: false, dormer: false },
  { x: -12.6, z: -29.6, rot: 0.24, w: 3.8, d: 3.0, h: 2.0, rh: 1.25, wallKey: 'cream', roofKey: 'terracotta', shutterKey: 'green', porch: false, dormer: false },
  { x: -3.2, z: -31.2, rot: 0.08, w: 4.2, d: 3.2, h: 2.1, rh: 1.38, wallKey: 'peach', roofKey: 'red', shutterKey: 'teal', porch: false, dormer: true },
  { x: 6.4, z: -31.6, rot: -0.1, w: 3.9, d: 3.1, h: 2.02, rh: 1.32, wallKey: 'ochre', roofKey: 'slate', shutterKey: 'blue', porch: false, dormer: false },
  { x: 15.8, z: -27.2, rot: -0.35, w: 3.6, d: 2.9, h: 1.9, rh: 1.24, wallKey: 'peach', roofKey: 'red', shutterKey: 'teal', porch: false, dormer: false },
];

export const LANE_POINTS = [
  [-12.5, -18.5],
  [-8.5, -18.8],
  [-4.5, -19.2],
  [0.0, -19.5],
  [4.2, -19.2],
  [9.2, -18.2],
  [13.4, -16.4],
  [15.8, -15.7],
  [18.0, -15.0],
  [19.8, -14.5],
];

// East stepping-stone flagstone lane climbing up to the Lighthouse Cliff
export const FLAGSTONE_LANE = LANE_POINTS.slice(6);

export const SHORE_BOULDERS = [
  [-12.2, 0.4, 0.85], [-10.8, 0.2, 0.72], [-9.2, 0.45, 0.62],
  [-3.6, 0.48, 0.56], [-1.2, 0.42, 0.68], [1.4, 0.45, 0.54],
  [7.4, 0.46, 0.64], [9.6, 0.42, 0.72], [11.8, 0.35, 0.86],
  [13.0, 0.5, 0.78], [16.2, 0.3, 0.95], [17.8, 0.1, 1.15],
];

export const CLIFF_ROCKS = [
  [24.2, -12.4, 2.05], [25.6, -15.4, 2.25], [22.2, -11.4, 1.85],
  [19.2, -11.8, 1.55], [24.4, -18.2, 1.95], [17.4, -12.8, 1.35],
  [26.2, -13.2, 1.65], [20.6, -10.6, 1.32],
];

export const CURATED_TREE_SPOTS = [
  [7.2, -22.2],
  [13.6, -20.6],
  [-13.5, -19.2],
  [-16.2, -17.5],
  [-18.0, -21.5],
  [-12.8, -24.5],
  [17.6, -19.8],
  [23.2, -19.5],
  [2.5, -25.6],
  [11.5, -26.2],
];

export function getLanternPostSpots() {
  return [
    [-10.4, getShoreZ(-10.4) - 2.2],
    [-3.8, getShoreZ(-3.8) - 2.2],
    [0.6, getShoreZ(0.6) - 2.2],
    [7.8, getShoreZ(7.8) - 2.2],
    [14.2, getShoreZ(14.2) - 2.1],
    [18.0, -15.1],
  ];
}
