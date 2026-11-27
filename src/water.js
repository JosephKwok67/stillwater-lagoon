import * as THREE from 'three';
import { createWaterNormalTexture } from './textures.js';

const MAX_RIPPLES = 40;
const WAKE_POINTS = 22;

const WATER_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec4 vClipPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    // Gentle painterly lagoon surface swell
    float swell =
      sin(worldPos.x * 0.36 + uTime * 1.02) * 0.015 +
      cos(worldPos.z * 0.42 - uTime * 0.86) * 0.013 +
      sin((worldPos.x + worldPos.z) * 0.22 + uTime * 0.62) * 0.009;
    worldPos.y += swell;

    vWorldPos = worldPos.xyz;
    vec4 mvPos = viewMatrix * worldPos;
    vClipPos = projectionMatrix * mvPos;
    gl_Position = vClipPos;
  }
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tSceneColor;
  uniform sampler2D tSceneDepth;
  uniform sampler2D tNormalMap;

  uniform float uTime;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform vec2 uResolution;

  // Dynamic sun & atmosphere uniforms
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyHorizon;
  uniform float uCloudShadow;

  uniform float uWaterClarity;
  uniform float uSparkleIntensity;

  // Live boat state
  uniform vec2 uBoatPos;
  uniform vec2 uBoatForward;
  uniform float uBoatSpeed;

  // Continuous curved boat trajectory spine for realistic Kelvin V-Wake!
  // xy = world XZ point, z = sample timestamp, w = boat speed at that moment
  uniform vec4 uWakeTrail[${WAKE_POINTS}];

  // Organic wave-warped ripples (oar eddies, splash puddles, tiny dog paddle streaks)
  uniform vec4 uRipplePosTime[${MAX_RIPPLES}]; // xy = world xz, z = birthTime, w = maxRadius
  uniform vec4 uRippleMeta[${MAX_RIPPLES}];    // xy = dir, z = mode (0=oar eddy, 1=dog/soft wake), w = intensity

  varying vec3 vWorldPos;
  varying vec4 vClipPos;

  float linearizeDepth(float zBuf) {
    float zNdc = zBuf * 2.0 - 1.0;
    return (2.0 * uCameraNear * uCameraFar) /
           (uCameraFar + uCameraNear - zNdc * (uCameraFar - uCameraNear));
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.03 + vec2(17.1, 31.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    vec3 viewVec = cameraPosition - vWorldPos;
    vec3 viewDir = normalize(viewVec);
    vec3 sunDir = normalize(uSunDir);

    // Precompute organic liquid noise for breaking up every wake & oar ripple so NOTHING looks geometric!
    vec2 liquidWarp = vec2(
      fbm(vWorldPos.xz * 1.45 + vec2(uTime * 0.34, -uTime * 0.24)) - 0.5,
      fbm(vWorldPos.xz * 1.45 + vec2(-uTime * 0.28, uTime * 0.31) + vec2(8.3, 4.7)) - 0.5
    );
    float foamBreakup = fbm(vWorldPos.xz * 2.85 + liquidWarp * 1.6 + vec2(uTime * 0.22, -uTime * 0.18));

    // Boat local coordinates
    vec2 relBoat = vWorldPos.xz - uBoatPos;
    vec2 boatRight = vec2(-uBoatForward.y, uBoatForward.x);
    float bFwd = dot(relBoat, uBoatForward);
    float bSide = dot(relBoat, boatRight);
    float boatHullDist = length(vec2(bFwd / 1.38, bSide / 0.72));
    float outsideBoatMask = smoothstep(0.86, 1.26, boatHullDist);

    // ---------------------------------------------------------------------
    // 1. TRUE OPEN-ENDED HYDRODYNAMIC KELVIN V-WAKE & LIQUID WAVE REFRACTION
    //    (Zero closed back-loop cap! Pure optical wave ridge + airy lacy foam!)
    // ---------------------------------------------------------------------
    float wakeFoam = 0.0;
    float wakeTurbulence = 0.0;
    float wakeWaveShade = 0.0; // optical sunlit crest (+) & deep teal trough (-)
    vec2 rippleSlope = vec2(0.0);

    // 1a. Compute SDF Union of the widening curved boat wake envelope + tangent tracking
    const float WAKE_LIFE = 2.9;
    float minSdf = 999.0;
    float wakeAgeNorm = 1.0;
    float wakeSpeedNorm = 0.0;
    vec2 wakeNormalDir = vec2(0.0, 1.0);
    vec2 wakeTangent = uBoatForward;
    float wakeArcDist = 0.0;

    for (int i = 0; i < ${WAKE_POINTS - 1}; i++) {
      vec4 pA = uWakeTrail[i];
      vec4 pB = uWakeTrail[i + 1];
      float ageA = uTime - pA.z;
      float ageB = uTime - pB.z;
      if (ageA > WAKE_LIFE && ageB > WAKE_LIFE) continue;
      if (pA.w < 0.08 && pB.w < 0.08) continue;

      vec2 ab = pB.xy - pA.xy;
      float abLen2 = dot(ab, ab);
      if (abLen2 < 0.0004) continue;

      float tSeg = clamp(dot(vWorldPos.xz - pA.xy, ab) / abLen2, 0.0, 1.0);
      vec2 closest = pA.xy + ab * tSeg;
      float age = mix(ageA, ageB, tSeg);
      if (age < 0.0 || age > WAKE_LIFE) continue;

      float segSpeed = mix(pA.w, pB.w, tSeg);
      float spdN = clamp(segSpeed / 2.2, 0.0, 1.0);
      if (spdN < 0.06) continue;

      float aN = age / WAKE_LIFE;
      vec2 toPix = vWorldPos.xz - closest;
      float dist = length(toPix);

      // Widening Kelvin cone radius: hugs bow (0.28), clears hull (~0.56), fans smoothly to ~2.1
      float coneR = 0.28 + pow(aN, 0.80) * (1.30 + spdN * 0.52);
      float segSdf = dist - coneR;

      if (segSdf < minSdf) {
        minSdf = segSdf;
        wakeAgeNorm = aN;
        wakeSpeedNorm = spdN;
        wakeNormalDir = dist > 0.001 ? (toPix / dist) : vec2(0.0, 1.0);
        // Tangent points forward along trail (from older pB toward newer pA)
        wakeTangent = normalize(pA.xy - pB.xy);
        wakeArcDist = float(i) + tSeg;
      }
    }

    if (minSdf < 1.8 && wakeSpeedNorm > 0.06) {
      // CRITICAL: Eliminate the artificial closed semicircle back-cap at the oldest trail point!
      // When wakeNormalDir points backward (-wakeTangent), it's the back endcap -> smoothly mask to 0!
      float backAlign = dot(wakeNormalDir, -wakeTangent);
      float openTailMask = 1.0 - smoothstep(0.22, 0.72, backAlign);
      // Also mask out forward-cap except right near the bow itself (wakeAgeNorm < 0.14)
      float frontAlign = dot(wakeNormalDir, wakeTangent);
      float bowCapKeep = 1.0 - smoothstep(0.05, 0.16, wakeAgeNorm);
      float openFrontMask = mix(1.0 - smoothstep(0.28, 0.75, frontAlign), 1.0, bowCapKeep);
      float openEndMask = openTailMask * openFrontMask;

      // Liquid organic wave warping (grows gently as wake ages & mixes with ambient lagoon swell)
      float waveWarp = (liquidWarp.x * 0.15 + liquidWarp.y * 0.13) * (0.20 + wakeAgeNorm * 1.25);
      float warpedSdf = minSdf + waveWarp;

      // Smooth fade along trail length & speed
      float speedRamp = smoothstep(0.06, 0.36, wakeSpeedNorm);
      float trailEnv = smoothstep(0.0, 0.05, wakeAgeNorm) * pow(1.0 - wakeAgeNorm, 1.75) * speedRamp * openEndMask;

      // 1) REAL 3D OPTICAL KELVIN WAVE TRAINS (Primary + Secondary + Faint Tertiary ripples!)
      //    These refract the seabed/fish underneath and catch warm sun + cool teal trough shading!
      float wave1Env = exp(-pow(warpedSdf / 0.17, 2.0)) * trailEnv;
      float wave2Env = exp(-pow((warpedSdf - (0.34 + wakeAgeNorm * 0.16)) / 0.20, 2.0)) * trailEnv * 0.62;
      float wave3Env = exp(-pow((warpedSdf - (0.70 + wakeAgeNorm * 0.28)) / 0.24, 2.0)) * trailEnv * 0.30;

      float waveSlopeMag =
        sin(warpedSdf * 18.0) * wave1Env +
        sin((warpedSdf - (0.34 + wakeAgeNorm * 0.16)) * 15.0) * wave2Env +
        sin((warpedSdf - (0.70 + wakeAgeNorm * 0.28)) * 13.0) * wave3Env;

      rippleSlope += wakeNormalDir * waveSlopeMag * 0.78;
      // Subtle sunlit highlight on sun-facing wave slope & rich teal trough shadow on opposite side!
      float sunSlope = dot(wakeNormalDir, sunDir.xz);
      wakeWaveShade += waveSlopeMag * (0.32 + sunSlope * 0.65);

      // 2) AIRY, STREAKED, LACY SURFACE FOAM (delicate near bow/hull, rapidly feathering into tiny flecks!)
      //    Stretch foam noise along the wake flow so it looks like water streaks, NOT a flat decal!
      vec2 flowUV = vec2(wakeArcDist * 0.75 - uTime * 0.55, warpedSdf * 3.8);
      float lacyNoise = fbm(flowUV * 1.85 + liquidWarp * 2.2) * 0.65 + foamBreakup * 0.35;

      float foamFade = pow(1.0 - wakeAgeNorm, 2.15) * speedRamp * openEndMask;
      float primaryThin = 1.0 - smoothstep(0.0, mix(0.042, 0.095, wakeAgeNorm), abs(warpedSdf));
      float outerThin = (1.0 - smoothstep(0.0, mix(0.048, 0.105, wakeAgeNorm), abs(warpedSdf - (0.34 + wakeAgeNorm * 0.16)))) * 0.38;

      // Crisp broken flecks near bow, progressively more airy/sparse toward tail
      float lacyMask = smoothstep(0.32 + wakeAgeNorm * 0.30, 0.76, lacyNoise + (1.0 - wakeAgeNorm) * 0.16);
      wakeFoam = max(wakeFoam, max(primaryThin, outerThin) * foamFade * lacyMask * 0.48);

      // 3) DELICATE LIQUID SLIPSTREAM STREAKS behind stern (refraction + micro-streaks, NO blurry fog blob!)
      float insideCone = smoothstep(0.02, -0.25, warpedSdf);
      float slipEnv = insideCone * smoothstep(0.05, 0.16, wakeAgeNorm) * pow(1.0 - wakeAgeNorm, 2.6) * speedRamp * openTailMask;
      float microStreaks = smoothstep(0.52, 0.84, fbm(vec2(wakeArcDist * 0.55, warpedSdf * 7.5) + liquidWarp * 1.5));
      rippleSlope += liquidWarp * slipEnv * 0.42;
      wakeTurbulence = max(wakeTurbulence, slipEnv * microStreaks * 0.24);
    }

    // 1b. Subtle Organic Bow-Cut & Hull Waterline Shimmer
    float movingFactor = clamp(uBoatSpeed / 1.4, 0.0, 1.0);
    float warpedHullD = boatHullDist + liquidWarp.x * 0.12;
    float hullHug = 1.0 - smoothstep(0.0, 0.048, abs(warpedHullD - 0.97));
    float hullBroken = smoothstep(0.30, 0.74, foamBreakup);
    // Soft crisp white bow-cut feather right where the pointed bow parts the water
    float bowCut = (1.0 - smoothstep(0.0, 0.22, length(vec2((bFwd - 1.10) * 1.15, bSide * 1.65)))) * movingFactor * (0.4 + 0.6 * foamBreakup);
    // Single delicate idle waterline ripple when resting quietly
    float idleCycle = fract(uTime * 0.22);
    float idleR = 1.02 + idleCycle * 0.26;
    float idleFade = smoothstep(0.0, 0.25, idleCycle) * (1.0 - smoothstep(0.45, 1.0, idleCycle));
    float idleWave = (1.0 - smoothstep(0.0, 0.038, abs(warpedHullD - idleR))) * idleFade * hullBroken * (1.0 - movingFactor * 0.92) * 0.26;

    wakeFoam = max(wakeFoam, hullHug * hullBroken * (0.24 + movingFactor * 0.18));
    wakeFoam = max(wakeFoam, bowCut * 0.46);
    wakeFoam = max(wakeFoam, idleWave);

    // 1c. Soft Liquid Oar Blade Eddies & Tiny Dog Paddle Wake
    const float RIPPLE_LIFE = 1.35;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 rp = uRipplePosTime[i];
      float age = uTime - rp.z;
      if (age < 0.0 || age >= RIPPLE_LIFE) continue;

      vec4 meta = uRippleMeta[i];
      float t = age / RIPPLE_LIFE;
      float mode = meta.z;

      vec2 diff = vWorldPos.xz - rp.xy;
      vec2 warpedDiff = diff + liquidWarp * (0.16 + t * 0.34);
      float dist = length(warpedDiff);
      vec2 radDir = dist > 0.001 ? (warpedDiff / dist) : vec2(1.0, 0.0);

      float lifeFade = smoothstep(0.0, 0.025, t) * pow(1.0 - t, 1.75);

      if (mode < 0.5) {
        // ---- OAR BLADE EDDY: optical liquid wave ring + airy splash droplets ----
        float eddyR = mix(0.14, 0.34, pow(t, 0.55));
        float eddyPatch = (1.0 - smoothstep(0.0, eddyR, dist)) * (1.0 - smoothstep(0.0, 0.58, t));
        float frothySwirl = eddyPatch * smoothstep(0.34, 0.78, foamBreakup) * meta.w * 0.42;
        wakeTurbulence = max(wakeTurbulence, frothySwirl);

        float curR = 0.14 + pow(t, 0.68) * rp.w;
        float signedD = dist - curR;
        float ringDist = abs(signedD);

        float waveEnv = exp(-pow(ringDist / 0.17, 2.0)) * lifeFade * meta.w;
        float oarWave = sin(signedD * 18.0) * waveEnv;
        rippleSlope += radDir * oarWave * 0.58;
        wakeWaveShade += oarWave * 0.25;

        float softRing = (1.0 - smoothstep(0.0, 0.062, ringDist)) * smoothstep(0.40 + t * 0.25, 0.80, foamBreakup);
        wakeFoam = max(wakeFoam, softRing * lifeFade * meta.w * 0.26);
      } else {
        // ---- TINY NATURAL SWIMMING DOG PADDLE WAKE ----
        float curR = 0.08 + pow(t, 0.72) * rp.w;
        float ringDist = abs(dist - curR);
        float align = dot(radDir, meta.xy);
        float arcMask = smoothstep(0.0, 0.65, align);

        float dogRipple = (1.0 - smoothstep(0.0, 0.045, ringDist)) * smoothstep(0.32, 0.78, foamBreakup + 0.08);
        wakeFoam = max(wakeFoam, dogRipple * lifeFade * arcMask * meta.w * 0.32);
        rippleSlope += radDir * sin((dist - curR) * 22.0) * exp(-pow(ringDist / 0.10, 2.0)) * lifeFade * arcMask * 0.28;
      }
    }

    // ---------------------------------------------------------------------
    // 2. Stylized Dual-Layer Animated Water Normal + Dynamic Wake/Oar Slope
    // ---------------------------------------------------------------------
    vec2 uvA = vWorldPos.xz * 0.092 + vec2(uTime * 0.020, uTime * 0.014);
    vec2 uvB = vWorldPos.xz * 0.152 + vec2(-uTime * 0.017, uTime * 0.021);
    vec2 uvC = vWorldPos.xz * 0.050 + vec2(uTime * 0.008, -uTime * 0.010);

    vec3 nA = texture2D(tNormalMap, uvA).xyz * 2.0 - 1.0;
    vec3 nB = texture2D(tNormalMap, uvB).xyz * 2.0 - 1.0;
    vec3 nC = texture2D(tNormalMap, uvC).xyz * 2.0 - 1.0;

    vec2 waveSlope = nA.xy * 0.42 + nB.xy * 0.36 + nC.xy * 0.24 + rippleSlope;
    vec3 waterNormal = normalize(vec3(waveSlope.x * 0.54, 1.0, waveSlope.y * 0.54));

    // ---------------------------------------------------------------------
    // 3. True Depth & Edge-Guarded Refraction (tSceneColor is Linear HDR!)
    // ---------------------------------------------------------------------
    float waterDist = linearizeDepth(gl_FragCoord.z);
    float rawSceneDist = linearizeDepth(texture2D(tSceneDepth, screenUV).x);
    float rawDiff = max(0.0, rawSceneDist - waterDist);

    float refractAmt = 0.0108 * smoothstep(0.02, 0.55, rawDiff);
    vec2 refractedUV = clamp(screenUV + waveSlope * refractAmt, vec2(0.002), vec2(0.998));

    float refSceneDist = linearizeDepth(texture2D(tSceneDepth, refractedUV).x);
    float depthDiff = refSceneDist - waterDist;

    if (depthDiff < 0.01) {
      refractedUV = screenUV;
      depthDiff = rawDiff;
    }

    vec3 underColor = texture2D(tSceneColor, refractedUV).rgb;
    float verticalDepth = max(0.0, depthDiff * abs(viewDir.y));

    // ---------------------------------------------------------------------
    // 4. Sun-Drenched Painterly Lagoon Depth Absorption + Cloud Shadows
    // ---------------------------------------------------------------------
    float cloudNoise = fbm(vWorldPos.xz * 0.036 + vec2(uTime * 0.018, -uTime * 0.012));
    float cloudShade = 1.0 - smoothstep(0.45, 0.78, cloudNoise) * uCloudShadow;

    float sunElevFactor = clamp(sunDir.y * 1.55 + 0.25, 0.45, 1.12);
    vec3 shallowTint = vec3(0.030, 0.255, 0.215) * sunElevFactor;
    vec3 midTint     = vec3(0.010, 0.170, 0.220) * sunElevFactor;
    vec3 deepTint    = vec3(0.004, 0.095, 0.175) * sunElevFactor;

    float transmit = exp(-verticalDepth * uWaterClarity);
    vec3 waterBodyColor = mix(shallowTint, midTint, smoothstep(0.25, 1.45, verticalDepth));
    waterBodyColor = mix(waterBodyColor, deepTint, smoothstep(1.35, 3.10, verticalDepth));

    vec3 filterTint = mix(vec3(1.0), vec3(0.68, 0.96, 0.97), clamp(verticalDepth * 0.36, 0.0, 0.68));
    vec3 waterColor = mix(waterBodyColor, underColor * filterTint, clamp(transmit * 0.88 + 0.10, 0.18, 0.95));
    waterColor *= cloudShade;

    // Crisp sky Fresnel sheen (never washes out the turquoise underwater clarity!)
    float fresnel = pow(1.0 - max(dot(waterNormal, viewDir), 0.0), 4.0);
    vec3 skyReflect = mix(vec3(0.08, 0.34, 0.44), uSkyHorizon * 0.72, 0.45);
    waterColor = mix(waterColor, skyReflect, clamp(fresnel * 0.28, 0.0, 0.24));

    // ---------------------------------------------------------------------
    // 5. Dynamic Sun Reflection Path & Painterly Dappled Sun-Glints!
    // ---------------------------------------------------------------------
    vec2 rippleCoord = vec2(vWorldPos.x * 0.85, vWorldPos.z * 1.48);
    vec2 warp = vec2(
      fbm(rippleCoord * 0.36 + vec2(uTime * 0.16, -uTime * 0.11)),
      fbm(rippleCoord * 0.36 + vec2(-uTime * 0.12, uTime * 0.15) + vec2(7.3, 4.1))
    );

    float fleckMed  = fbm(rippleCoord * 1.45 + warp * 1.75 + vec2(uTime * 0.26, uTime * 0.16));
    float fleckFine = fbm(rippleCoord * 3.15 - warp * 1.25 + vec2(-uTime * 0.34, uTime * 0.24));

    float poolA = fbm(vWorldPos.xz * 0.18 + vec2(uTime * 0.025, -uTime * 0.018) + vec2(2.1, 6.4));
    float poolB = vnoise(vWorldPos.xz * 0.28 - vec2(uTime * 0.02, uTime * 0.028) + vec2(11.2, 1.9));
    float sunPool = smoothstep(0.36, 0.72, poolA * 0.65 + poolB * 0.35);

    vec3 halfVec = normalize(sunDir + viewDir);
    float specBroad = pow(max(dot(waterNormal, halfVec), 0.0), 22.0);
    float specTight = pow(max(dot(waterNormal, halfVec), 0.0), 96.0);
    vec3 reflectDir = reflect(-viewDir, waterNormal);
    float sunPathAlign = pow(max(dot(reflectDir, sunDir), 0.0), 24.0);
    float sunPathSparkle = smoothstep(0.56, 0.74, fleckMed * 0.55 + fleckFine * 0.45) * sunPathAlign;

    float glintSignal =
      fleckMed * 0.42 +
      fleckFine * 0.36 +
      specBroad * 0.36 +
      sunPool * 0.30 +
      length(rippleSlope) * 0.26;

    float thresh = 1.03 - (uSparkleIntensity - 1.0) * 0.10;
    float sparkleCore = smoothstep(thresh, thresh + 0.042, glintSignal);
    float sparkleHalo = smoothstep(thresh - 0.05, thresh + 0.02, glintSignal);

    float openWaterMask = smoothstep(0.04, 0.22, verticalDepth);
    sparkleCore *= openWaterMask * cloudShade;
    sparkleHalo *= openWaterMask * cloudShade;

    vec3 sunGlintTint = mix(vec3(1.0, 1.04, 1.02), uSunColor * 1.45, 0.52);
    waterColor += uSunColor * (sunPathAlign * 0.065 + specTight * 0.42 + sunPathSparkle * 0.62) * openWaterMask * cloudShade * min(uSparkleIntensity, 1.45);
    waterColor = mix(waterColor, mix(vec3(0.45, 0.88, 0.90), uSunColor, 0.32), sparkleHalo * 0.22 * min(uSparkleIntensity, 1.3));
    waterColor = mix(waterColor, sunGlintTint * 1.15, sparkleCore * 0.82 * min(uSparkleIntensity, 1.25));

    // ---------------------------------------------------------------------
    // 6. Delicate Shoreline Waterline & Natural Painterly Rowing Foam/Turbulence
    // ---------------------------------------------------------------------
    float edgeNoise = vnoise(vWorldPos.xz * 2.8 + vec2(uTime * 0.4, -uTime * 0.3));
    float fineContact =
      (1.0 - smoothstep(0.015, 0.12, verticalDepth)) *
      smoothstep(0.002, 0.02, verticalDepth) *
      (0.45 + 0.55 * edgeNoise);
    float outerShimmer =
      smoothstep(0.08, 0.24, verticalDepth) *
      (1.0 - smoothstep(0.24, 0.40, verticalDepth)) *
      smoothstep(0.52, 0.85, sin(verticalDepth * 30.0 - uTime * 2.2 + edgeNoise * 4.2)) * 0.30;

    float rockFoam = clamp((fineContact * 0.56 + outerShimmer) * outsideBoatMask, 0.0, 0.58);
    waterColor = mix(waterColor, mix(vec3(0.78, 0.97, 0.95), uSunColor, 0.2), rockFoam);

    // Optical 3D Kelvin wave lighting: sunlit wave crests glow softly, troughs deepen into cool teal!
    float crestLight = max(0.0, wakeWaveShade);
    float troughDark = max(0.0, -wakeWaveShade);
    waterColor += mix(vec3(0.26, 0.62, 0.66), uSunColor * 0.55, 0.48) * crestLight * 0.34 * cloudShade;
    waterColor *= 1.0 - clamp(troughDark * 0.18, 0.0, 0.20);

    // Delicate airy micro-froth streaks inside slipstream & oar eddies
    vec3 frothTint = mix(vec3(0.46, 0.86, 0.87), uSunColor * 0.92, 0.25);
    waterColor = mix(waterColor, frothTint, clamp(wakeTurbulence, 0.0, 0.32));

    // Feathered painterly white-cyan crest flecks along open V-wake & oar splashes
    vec3 wakeCol = mix(vec3(0.84, 0.97, 0.96), uSunColor * 1.05, 0.22);
    waterColor = mix(waterColor, wakeCol, clamp(wakeFoam, 0.0, 0.56));

    // Smooth atmospheric horizon blend matching scene fog
    float camDist = length(vWorldPos - cameraPosition);
    float fogFactor = smoothstep(54.0, 136.0, camDist);
    waterColor = mix(waterColor, uSkyHorizon * 0.72, fogFactor * 0.75);

    gl_FragColor = vec4(waterColor, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createLagoonWater(scene, renderer, atmosphere) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  let refractionScale = 0.75;
  let lastWidth = Math.max(1, window.innerWidth || size.x);
  let lastHeight = Math.max(1, window.innerHeight || size.y);
  let lastDpr = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;

  const initW = Math.max(1, Math.floor(size.x * refractionScale));
  const initH = Math.max(1, Math.floor(size.y * refractionScale));

  const depthTexture = new THREE.DepthTexture(initW, initH);
  depthTexture.type = THREE.UnsignedIntType;
  depthTexture.format = THREE.DepthFormat;
  depthTexture.minFilter = THREE.NearestFilter;
  depthTexture.magFilter = THREE.NearestFilter;

  const refractionRT = new THREE.WebGLRenderTarget(initW, initH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthTexture,
    depthBuffer: true,
  });

  const normalMap = createWaterNormalTexture();

  const ripplePosTime = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -999, 1));
  const rippleMeta = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(1, 0, 0, 0));
  let rippleCursor = 0;

  // Curved Kelvin V-Wake spine points (0 = live bow/midship, 1..N-1 = trailing history)
  const wakeTrail = Array.from({ length: WAKE_POINTS }, () => new THREE.Vector4(-1.15, 0.85, -999, 0));
  let lastTrailSampleTime = -10;
  let lastTrailX = -1.15;
  let lastTrailZ = 0.85;

  const uniforms = {
    tSceneColor: { value: refractionRT.texture },
    tSceneDepth: { value: depthTexture },
    tNormalMap: { value: normalMap },
    uTime: { value: 0 },
    uCameraNear: { value: 0.5 },
    uCameraFar: { value: 240.0 },
    uResolution: { value: new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)) },
    uSunDir: atmosphere.sharedUniforms.uSunDir,
    uSunColor: atmosphere.sharedUniforms.uSunColor,
    uSkyHorizon: atmosphere.sharedUniforms.uSkyHorizon,
    uCloudShadow: atmosphere.sharedUniforms.uCloudShadow,
    uWaterClarity: { value: 0.34 },
    uSparkleIntensity: { value: 1.08 },
    uBoatPos: { value: new THREE.Vector2(-1.15, 0.85) },
    uBoatForward: { value: new THREE.Vector2(Math.cos(0.45), -Math.sin(0.45)) },
    uBoatSpeed: { value: 0.0 },
    uWakeTrail: { value: wakeTrail },
    uRipplePosTime: { value: ripplePosTime },
    uRippleMeta: { value: rippleMeta },
  };

  const waterGeo = new THREE.PlaneGeometry(196, 196, 84, 84);
  waterGeo.rotateX(-Math.PI / 2);

  const waterMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0;
  waterMesh.renderOrder = 10;
  scene.add(waterMesh);

  let currentTime = 0;

  function addRipple({
    x,
    z,
    dirX = 1,
    dirZ = 0,
    mode = 0, // 0 = organic oar eddy/splash, 1 = tiny dog paddle streak
    radiusScale = 0.65,
    intensity = 0.75,
  }) {
    const len = Math.hypot(dirX, dirZ) || 1;
    ripplePosTime[rippleCursor].set(x, z, currentTime - 0.016, radiusScale);
    rippleMeta[rippleCursor].set(dirX / len, dirZ / len, mode, intensity);
    rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
  }

  const savedVis = [];

  function applyResize(width, height, dpr) {
    lastWidth = Math.max(1, width);
    lastHeight = Math.max(1, height);
    lastDpr = Math.max(0.5, dpr);
    const mainW = Math.max(1, Math.floor(lastWidth * lastDpr));
    const mainH = Math.max(1, Math.floor(lastHeight * lastDpr));
    const rtW = Math.max(1, Math.floor(mainW * refractionScale));
    const rtH = Math.max(1, Math.floor(mainH * refractionScale));
    refractionRT.setSize(rtW, rtH);
    // Keep uResolution synced to main canvas drawing buffer so gl_FragCoord.xy / uResolution maps 0..1 cleanly!
    uniforms.uResolution.value.set(mainW, mainH);
  }

  return {
    waterMesh,
    refractionRT,
    uniforms,
    addRipple,
    resize: applyResize,
    setRefractionScale(scale) {
      const clamped = Math.max(0.4, Math.min(1.0, scale));
      if (Math.abs(clamped - refractionScale) < 0.01) return;
      refractionScale = clamped;
      applyResize(lastWidth, lastHeight, lastDpr);
    },
    update(elapsedTime, camera, boatState) {
      currentTime = elapsedTime;
      uniforms.uTime.value = elapsedTime;
      uniforms.uCameraNear.value = camera.near;
      uniforms.uCameraFar.value = camera.far;

      if (boatState) {
        const fwdX = Math.cos(boatState.yaw);
        const fwdZ = -Math.sin(boatState.yaw);
        const absSpd = Math.abs(boatState.speed);
        uniforms.uBoatPos.value.set(boatState.pos.x, boatState.pos.z);
        uniforms.uBoatForward.value.set(fwdX, fwdZ);
        uniforms.uBoatSpeed.value = absSpd;

        // Keep head of V-wake spine anchored smoothly at the cutting bow shoulder
        const bowX = boatState.pos.x + fwdX * (boatState.speed >= -0.1 ? 0.82 : -0.82);
        const bowZ = boatState.pos.z + fwdZ * (boatState.speed >= -0.1 ? 0.82 : -0.82);
        wakeTrail[0].set(bowX, bowZ, elapsedTime, absSpd);

        // Stamp a new world-space trail node smoothly as the boat glides or turns
        const movedDist = Math.hypot(bowX - lastTrailX, bowZ - lastTrailZ);
        if (elapsedTime - lastTrailSampleTime > 0.14 || movedDist > 0.34) {
          for (let i = WAKE_POINTS - 1; i >= 1; i--) {
            wakeTrail[i].copy(wakeTrail[i - 1]);
          }
          wakeTrail[1].set(bowX, bowZ, elapsedTime, absSpd);
          lastTrailSampleTime = elapsedTime;
          lastTrailX = bowX;
          lastTrailZ = bowZ;
        }
      }
    },
    renderRefractionPass(rendererInstance, targetScene, camera, hiddenObjects = null) {
      waterMesh.visible = false;
      savedVis.length = 0;
      if (hiddenObjects) {
        for (let i = 0; i < hiddenObjects.length; i++) {
          const obj = hiddenObjects[i];
          if (obj) {
            savedVis.push(obj.visible);
            obj.visible = false;
          } else {
            savedVis.push(false);
          }
        }
      }
      rendererInstance.setRenderTarget(refractionRT);
      rendererInstance.clear();
      rendererInstance.render(targetScene, camera);
      rendererInstance.setRenderTarget(null);
      if (hiddenObjects) {
        for (let i = 0; i < hiddenObjects.length; i++) {
          const obj = hiddenObjects[i];
          if (obj) obj.visible = savedVis[i];
        }
      }
      waterMesh.visible = true;
    },
  };
}
