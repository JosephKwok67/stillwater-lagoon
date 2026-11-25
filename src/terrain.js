import { fbm2D, smoothstep, clamp } from './noise.js';

/**
 * Computes shoreline distance & continuous world elevation across the expanded 160x160 lagoon + coastal village peninsula.
 * - Negative values (< 0) = submerged lagoon seabed
 * - Zero (= 0) = waterline
 * - Positive values (> 0) = sandy beach, flat coastal village terraces, and rolling painterly hills
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
  // 2. Sculpted Lakeside Town Peninsula & Curved Bay (North / Northeast shore: z < -14)
  //    Rowing forward-right from the starting boat leads directly to your house & pier!
  // -------------------------------------------------------------------------
  // Organic curving coastline curve zShore(x) around z ≈ -15 to -23
  const coastNoise = (fbm2D(x * 0.065 + 9.2, z * 0.065 - 4.1, 3) - 0.5) * 3.8;
  // Gentle semicircular bay cradling the player's cove at x ≈ +3.5, curving forward at headlands x ≈ -17 and x ≈ +21
  const coveCurve =
    -17.2 +
    Math.exp(-Math.pow((x - 3.5) / 10.5, 2)) * -1.4 + // cozy cove indentation at player's house & dock
    Math.exp(-Math.pow((x - 20.0) / 7.8, 2)) * 4.2 + // eastern lighthouse headland jutting south
    Math.exp(-Math.pow((x + 17.5) / 9.0, 2)) * 3.8 + // western wooded bluff
    coastNoise * 0.55;

  // Distance inland from the curved northern shoreline (positive = inland)
  const inland = coveCurve - z;

  // Lateral fade so the town peninsula tapers naturally back into open lagoon far east/west
  const penMask =
    smoothstep(-48, -24, x) * (1.0 - smoothstep(26, 52, x)) * smoothstep(-68, -48, z);

  if (inland > -7.5 && penMask > 0.001) {
    // Smooth sandy underwater shoal sloping gently up to beach (inland = 0) and green village terrace
    const shoalBlend = smoothstep(-7.2, 0.0, inland);
    const beachRise = smoothstep(-1.2, 1.8, inland) * 0.65;
    // Lower village plateau (flat enough for charming cottages & cobblestone path)
    const terrace1 = smoothstep(1.2, 4.8, inland) * 1.15;
    // Upper scenic hillside terrace behind the village
    const terrace2 = smoothstep(9.5, 16.5, inland) * 2.35;
    // Rolling painterly hills in the back
    const backHills =
      smoothstep(15.0, 30.0, inland) *
      (2.4 + fbm2D(x * 0.075 + 2.5, z * 0.075 + 1.8, 3) * 3.6);

    // Extra scenic rocky promontory for the eastern lighthouse
    const lhDist = Math.hypot((x - 17.2) / 5.2, (z + 16.2) / 4.2);
    const lighthouseKnoll = Math.exp(-lhDist * lhDist) * 1.95;

    const landHeight = -0.32 + beachRise + terrace1 + terrace2 + backHills + lighthouseKnoll;
    const blended = elevation * (1.0 - shoalBlend) + landHeight * shoalBlend;
    elevation = elevation * (1.0 - penMask) + blended * penMask;
  }

  // Softly flatten a clean terrace pad right under the Player's Own Waterside House & Sunny Garden Plot
  const houseDist = Math.hypot((x - 2.6) / 5.4, (z + 20.8) / 3.8);
  if (houseDist < 1.6) {
    const padWeight = 1.0 - smoothstep(0.68, 1.55, houseDist);
    elevation = elevation * (1.0 - padWeight) + 1.15 * padWeight;
  }

  // Softly flatten a cozy central village square pad around Fish Market & Artisan Workshop (-4.8, -21.2)
  const squareDist = Math.hypot((x + 5.0) / 5.6, (z + 21.4) / 4.2);
  if (squareDist < 1.6) {
    const padWeight = 1.0 - smoothstep(0.68, 1.55, squareDist);
    elevation = elevation * (1.0 - padWeight) + 1.38 * padWeight;
  }

  // Softly flatten east cottage terrace around (10.6, -21.0)
  const eastHouseDist = Math.hypot((x - 10.6) / 3.4, (z + 21.0) / 3.0);
  if (eastHouseDist < 1.5) {
    const padWeight = 1.0 - smoothstep(0.6, 1.45, eastHouseDist);
    elevation = elevation * (1.0 - padWeight) + 1.28 * padWeight;
  }

  // Softly flatten a lighthouse plateau at (x = 17.2, z = -16.2)
  const lhPad = Math.hypot((x - 17.2) / 3.0, (z + 16.2) / 3.0);
  if (lhPad < 1.5) {
    const padWeight = 1.0 - smoothstep(0.55, 1.45, lhPad);
    elevation = elevation * (1.0 - padWeight) + 2.15 * padWeight;
  }

  // Distant scenic outer emerald islands far south/west/east so the expanded world feels alive
  const farEast = Math.hypot((x - 34) / 7.5, (z - 14) / 6.0);
  if (farEast < 1.7) {
    const h = (1.0 - smoothstep(0.3, 1.6, farEast)) * 3.2;
    elevation = Math.max(elevation, -0.5 + h);
  }
  const farWest = Math.hypot((x + 34) / 8.0, (z - 12) / 6.5);
  if (farWest < 1.7) {
    const h = (1.0 - smoothstep(0.3, 1.6, farWest)) * 2.8;
    elevation = Math.max(elevation, -0.5 + h);
  }

  return clamp(elevation, -4.5, 9.0);
}

/**
 * Returns true if the water at (x, z) is safely deep enough for boating
 */
export function isNavigableWater(x, z, minWaterDepth = 0.24) {
  return getWorldElevation(x, z) < -minWaterDepth;
}
