import { fbm2D, smoothstep, clamp } from './noise.js';

/**
 * Exact v2.1 Crescent Bay shoreline Z-coordinate as a function of world X.
 * - Village crescent spans x ∈ [-15, +15], bowing northward inland to z ≈ -18.2m at cove center (x=0)
 * - Eastern rocky lighthouse promontory juts gracefully south to z ≈ -11.4m around x ≈ +22.5
 * - Western wooded bluff frames the cove on the left around x ≈ -19.5
 * Exported so `src/town.js` aligns the curved stone retaining quay wall, cobblestone promenade,
 * shoreline boulders, and 3 crisp 5-step timber piers to the exact millimeter!
 */
export function getShoreZ(x) {
  const normX = clamp(x / 14.5, -1.65, 1.85);
  // Concave crescent bay (3.6m deep curve across 29m chord): z = -18.2 at x=0, z = -14.6 at x=±14.5
  const crescent = -14.6 - 3.6 * Math.max(-1.1, 1.0 - normX * normX);
  // Dramatic eastern rocky lighthouse headland jutting south into the lagoon
  const eastHeadland = 4.4 * Math.exp(-Math.pow((x - 22.0) / 6.8, 2));
  // Western wooded bluff framing the left cove
  const westBluff = 3.4 * Math.exp(-Math.pow((x + 19.5) / 7.2, 2));
  return crescent + eastHeadland + westBluff;
}

/**
 * Computes shoreline distance & continuous world elevation across the expanded 160x160 lagoon + v2.1 coastal village.
 * Unified v2.1 Elevation Profile (GPT-6.2-Astra Ultra spec):
 * - Water surface: Y = 0.00m
 * - Pier decks: Y = +0.44m (connected via 5 crisp 0.14m wooden steps!)
 * - Flat Village Promenade & Front Cottage Lots: exact Y = +1.14m (zero jagged slopes or floating porches!)
 * - Back-row Hillside Terraces: +2.05m .. +2.90m rising smoothly into rolling Ghibli hills
 * - Eastern Rocky Lighthouse Cliff Plateau: +2.25m overlooking the bay at (21.8, -15.2)
 */
export function getWorldElevation(x, z) {
  // -------------------------------------------------------------------------
  // 1. Base Lagoon Seabed Depth (preserves iconic Stillwater starting lagoon around (0,0)!)
  // -------------------------------------------------------------------------
  const macro = fbm2D(x * 0.042 + 3.1, z * 0.042 - 2.4, 4);
  const detail = fbm2D(x * 0.13 - 7.3, z * 0.13 + 5.2, 3);

  let depth = 1.98 + (macro - 0.5) * 1.4 + (detail - 0.5) * 0.34;

  // Curated deep sapphire-teal basin in upper-center & upper-right of starting view
  const deepDx = (x - 1.6) / 7.8;
  const deepDz = (z + 4.2) / 5.0;
  depth += Math.exp(-(deepDx * deepDx + deepDz * deepDz)) * 1.52;

  // Curated shallow luminous shelf along left & bottom-left
  const s1Dx = (x + 6.4) / 7.5;
  const s1Dz = (z - 2.6) / 6.2;
  depth -= Math.exp(-(s1Dx * s1Dx + s1Dz * s1Dz)) * 0.7;

  // Curated shallow shelf in lower-right
  const s2Dx = (x - 7.2) / 6.2;
  const s2Dz = (z - 3.0) / 5.6;
  depth -= Math.exp(-(s2Dx * s2Dx + s2Dz * s2Dz)) * 0.54;

  // Shallow rise under hero upper-left islets
  const isletDx = (x + 8.3) / 4.2;
  const isletDz = (z + 5.0) / 3.6;
  depth -= Math.exp(-(isletDx * isletDx + isletDz * isletDz)) * 0.82;

  let elevation = -clamp(depth, 0.78, 4.2);

  // -------------------------------------------------------------------------
  // 2. v2.1 Sculpted Crescent Bay Village Peninsula & Segmented Shoreline
  // -------------------------------------------------------------------------
  const zShore = getShoreZ(x);
  // Subtle organic coast variation ONLY outside the central stone quay so seawall hugs shore seamlessly
  const quayMask = smoothstep(-9.8, -8.2, x) * (1.0 - smoothstep(10.0, 11.8, x));
  const coastMicro = (fbm2D(x * 0.075 + 9.2, z * 0.075 - 4.1, 3) - 0.5) * 1.8 * (1.0 - quayMask);
  const inland = zShore + coastMicro - z; // positive = inland (north, smaller z)

  // Lateral fade so the town peninsula tapers naturally back into open lagoon far east/west
  const penMask =
    smoothstep(-48, -26, x) * (1.0 - smoothstep(32, 56, x)) * smoothstep(-74, -52, z);

  if (inland > -7.5 && penMask > 0.001) {
    const shoalBlend = smoothstep(-7.2, 0.0, inland);

    // Segmented shoreline rise:
    // - Central Quay (x ∈ [-8.8, +10.8]): crisp stone retaining seawall rise right at inland = 0!
    // - West Cove (x < -8.8) & East Rocky Shore (x > +10.8): natural sloped coastal beach/rocks!
    const riseNatural = smoothstep(-2.4, 1.4, inland) * 1.46;
    const riseQuay = smoothstep(-0.35, 0.45, inland) * 1.46;
    const shoreRise = riseNatural * (1.0 - quayMask) + riseQuay * quayMask;

    // Upper hillside terrace behind enlarged front-row cottages (inland > 11.5m!)
    const terrace2 = smoothstep(11.4, 17.5, inland) * 1.75;

    // Lush rolling Ghibli backdrop hills behind the back-row cottages
    const backHills =
      smoothstep(18.5, 36.0, inland) *
      (3.4 + fbm2D(x * 0.07 + 2.5, z * 0.07 + 1.8, 3) * 3.8);

    // Western wooded bluff elevation
    const wBluffD = Math.hypot((x + 20.5) / 6.5, (z + 17.0) / 5.5);
    const westBluffLift = Math.exp(-wBluffD * wBluffD) * 1.85;

    const landHeight = -0.32 + shoreRise + terrace2 + backHills + westBluffLift;
    const blended = elevation * (1.0 - shoalBlend) + landHeight * shoalBlend;
    elevation = elevation * (1.0 - penMask) + blended * penMask;
  }

  // Exact flat Y = +1.14m village terrace across continuous curved promenade, fish market square,
  // fenced garden plot, and ALL 3 enlarged front-row cottages (x ∈ [-15.5, +15.8], inland ∈ [0.3, 11.6])!
  if (x > -17.0 && x < 17.2 && inland > 0.0 && inland < 13.5) {
    const xFlat = smoothstep(-16.8, -13.6, x) * (1.0 - smoothstep(13.8, 17.0, x));
    const zFlat = smoothstep(0.15, 0.95, inland) * (1.0 - smoothstep(10.8, 12.8, inland));
    const flatW = xFlat * zFlat;
    elevation = elevation * (1.0 - flatW) + 1.14 * flatW;
  }

  // Dramatic Two-Tiered Eastern Rocky Cliff Promontory for the 7.8m Lighthouse & Hai Bo (21.8, -15.2)!
  const lhDist = Math.hypot((x - 21.8) / 5.4, (z + 15.2) / 4.6);
  if (lhDist < 1.85) {
    const tier1 = (1.0 - smoothstep(0.75, 1.55, lhDist)) * 1.35;
    const tier2 = (1.0 - smoothstep(0.32, 0.92, lhDist)) * 1.25;
    const cliffTarget = -0.35 + tier1 + tier2;
    elevation = Math.max(elevation, cliffTarget);
    // Smooth flat cliff crown plateau right at Y = +2.25m for Lighthouse + Keeper Shed + Hai Bo!
    if (lhDist < 0.85) {
      const crownW = 1.0 - smoothstep(0.45, 0.85, lhDist);
      elevation = elevation * (1.0 - crownW) + 2.25 * crownW;
    }
  }

  // Gentle walkable stone coastal path ramp linking East Cottage (+14.5, -16.5 @ 1.14m) up to Lighthouse Cliff (+19.2, -14.8 @ 2.15m)!
  const pathT = clamp((x - 14.0) / 5.4, 0, 1);
  const pathCenterZ = -16.2 + pathT * 1.4;
  const pathDist = Math.abs(z - pathCenterZ);
  if (x >= 13.2 && x <= 20.4 && pathDist < 2.6) {
    const pw = (1.0 - smoothstep(1.1, 2.5, pathDist)) * smoothstep(13.2, 14.5, x) * (1.0 - smoothstep(19.0, 20.4, x));
    const targetPathY = 1.14 + smoothstep(0, 1, pathT) * 1.08;
    elevation = elevation * (1.0 - pw * 0.85) + targetPathY * (pw * 0.85);
  }

  // Distant scenic outer emerald islands far south/west/east so the expanded world feels alive
  const farEast = Math.hypot((x - 36) / 7.5, (z - 14) / 6.0);
  if (farEast < 1.7) {
    const h = (1.0 - smoothstep(0.3, 1.6, farEast)) * 3.2;
    elevation = Math.max(elevation, -0.5 + h);
  }
  const farWest = Math.hypot((x + 36) / 8.0, (z - 12) / 6.5);
  if (farWest < 1.7) {
    const h = (1.0 - smoothstep(0.3, 1.6, farWest)) * 2.8;
    elevation = Math.max(elevation, -0.5 + h);
  }

  return clamp(elevation, -4.5, 9.5);
}

/**
 * Returns true if the water at (x, z) is safely deep enough for boating
 */
export function isNavigableWater(x, z, minWaterDepth = 0.24) {
  return getWorldElevation(x, z) < -minWaterDepth;
}
