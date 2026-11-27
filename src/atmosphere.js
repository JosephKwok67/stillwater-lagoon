import * as THREE from 'three';
import { clamp } from './noise.js';

/**
 * Weather & Time-of-Day presets designed as a clean extensible foundation
 * for future dynamic weather (rain, mist, golden hour, dawn, sunny lagoon).
 */
export const WEATHER_PRESETS = {
  sunny: {
    label: '晴朗午后',
    elevation: 44,
    azimuth: 34,
    sunColor: '#fff1d1',
    sunIntensity: 2.38,
    hemiSky: '#c6eef5',
    hemiGround: '#115165',
    hemiIntensity: 1.2,
    fillColor: '#81d4e0',
    fillIntensity: 0.42,
    skyZenith: '#4ea7c9',
    skyHorizon: '#cdeee9',
    sunGlow: '#fff4cb',
    fogColor: '#84c9d2',
    fogNear: 52,
    fogFar: 138,
    cloudShadow: 0.14,
    sparkleBoost: 1.08,
    exposure: 1.08,
    nightGlow: 0.22,
  },
  morning: {
    label: '清晨微光',
    elevation: 24,
    azimuth: 62,
    sunColor: '#ffe0b3',
    sunIntensity: 2.15,
    hemiSky: '#d9ecf8',
    hemiGround: '#195c6b',
    hemiIntensity: 1.08,
    fillColor: '#9ed6e8',
    fillIntensity: 0.45,
    skyZenith: '#62a4cc',
    skyHorizon: '#f8e6ce',
    sunGlow: '#ffe5b0',
    fogColor: '#b9dcd9',
    fogNear: 44,
    fogFar: 126,
    cloudShadow: 0.10,
    sparkleBoost: 1.18,
    exposure: 1.06,
    nightGlow: 0.45,
  },
  sunset: {
    label: '黄金日落',
    elevation: 15,
    azimuth: -38,
    sunColor: '#ff9f5a',
    sunIntensity: 2.45,
    hemiSky: '#f7b58c',
    hemiGround: '#153b54',
    hemiIntensity: 0.96,
    fillColor: '#6d9ec8',
    fillIntensity: 0.36,
    skyZenith: '#3c5d8a',
    skyHorizon: '#f8ae76',
    sunGlow: '#ffd485',
    fogColor: '#cf9f88',
    fogNear: 46,
    fogFar: 128,
    cloudShadow: 0.12,
    sparkleBoost: 1.32,
    exposure: 1.04,
    nightGlow: 1.0,
  },
  overcast: {
    label: '薄雾微阴',
    elevation: 52,
    azimuth: 18,
    sunColor: '#dcecf0',
    sunIntensity: 1.25,
    hemiSky: '#bed5dc',
    hemiGround: '#184b58',
    hemiIntensity: 1.38,
    fillColor: '#93b9c4',
    fillIntensity: 0.48,
    skyZenith: '#7da1b0',
    skyHorizon: '#c8d9dc',
    sunGlow: '#edf4f5',
    fogColor: '#9ebec4',
    fogNear: 34,
    fogFar: 105,
    cloudShadow: 0.28,
    sparkleBoost: 0.55,
    exposure: 1.02,
    nightGlow: 0.6,
  },
};

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform vec3 uSkyZenith;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunGlowColor;
  uniform float uTime;
  uniform float uCloudStrength;
  varying vec3 vWorldDir;

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
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = p * 2.02 + vec2(13.4, 29.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float up = clamp(dir.y, 0.0, 1.0);

    // Painterly sky vertical gradient
    vec3 col = mix(uSkyHorizon, uSkyZenith, pow(up, 0.62));

    // Warm sun corona, atmospheric scatter & crisp glowing sun disc
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float scatter = pow(sunDot, 5.0) * 0.36;
    float halo = pow(sunDot, 42.0) * 0.62;
    float disc = smoothstep(0.9965, 0.9985, sunDot);

    col += uSunGlowColor * (scatter + halo);
    col = mix(col, vec3(1.0, 0.99, 0.94) * 1.45, disc);

    // Soft Ghibli-like painterly clouds floating across upper sky
    if (dir.y > 0.03) {
      vec2 cloudUV = dir.xz / (dir.y + 0.22) * 1.15 + vec2(uTime * 0.012, -uTime * 0.008);
      float c = fbm(cloudUV * 1.65);
      float cloudMask = smoothstep(0.48, 0.74, c) * smoothstep(0.03, 0.22, dir.y);
      vec3 cloudCol = mix(vec3(0.96, 0.97, 0.98), uSunGlowColor, 0.35 + scatter * 0.6);
      col = mix(col, cloudCol, cloudMask * clamp(0.48 + uCloudStrength * 1.1, 0.0, 0.85));
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Builds the interactive Sun, Sky Dome, Dynamic Lights, Atmospheric Fog, and Weather Foundation
 */
export function createAtmosphereSystem(scene, renderer) {
  const state = {
    presetKey: 'sunny',
    elevation: WEATHER_PRESETS.sunny.elevation,
    azimuth: WEATHER_PRESETS.sunny.azimuth,
    sunDir: new THREE.Vector3(),
    sunColor: new THREE.Color(WEATHER_PRESETS.sunny.sunColor),
    cloudShadow: WEATHER_PRESETS.sunny.cloudShadow,
    sparkleBoost: WEATHER_PRESETS.sunny.sparkleBoost,
    nightGlow: WEATHER_PRESETS.sunny.nightGlow,
  };

  // Hemisphere sky-to-lagoon bounce light
  const hemiLight = new THREE.HemisphereLight(
    WEATHER_PRESETS.sunny.hemiSky,
    WEATHER_PRESETS.sunny.hemiGround,
    WEATHER_PRESETS.sunny.hemiIntensity
  );
  scene.add(hemiLight);

  // Main Sun DirectionalLight with generous shadow frustum covering both lagoon & lakeside town
  const sunLight = new THREE.DirectionalLight(
    WEATHER_PRESETS.sunny.sunColor,
    WEATHER_PRESETS.sunny.sunIntensity
  );
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 110;
  const shadowBound = 34;
  sunLight.shadow.camera.left = -shadowBound;
  sunLight.shadow.camera.right = shadowBound;
  sunLight.shadow.camera.top = shadowBound;
  sunLight.shadow.camera.bottom = -shadowBound;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Light-space basis vectors for exact shadow-map texel snapping (eliminates all shadow crawling/shimmering!)
  const _worldUp = new THREE.Vector3(0, 1, 0);
  const _lightRight = new THREE.Vector3();
  const _lightUp = new THREE.Vector3();
  const _snappedTarget = new THREE.Vector3();
  let shadowTexelSize = (shadowBound * 2) / 2048;

  // Soft counter-fill directional light
  const fillLight = new THREE.DirectionalLight(
    WEATHER_PRESETS.sunny.fillColor,
    WEATHER_PRESETS.sunny.fillIntensity
  );
  fillLight.position.set(16, 12, 16);
  scene.add(fillLight);

  // Subtle horizon atmospheric fog (keeps distant hills/water painterly)
  const fog = new THREE.Fog(
    WEATHER_PRESETS.sunny.fogColor,
    WEATHER_PRESETS.sunny.fogNear,
    WEATHER_PRESETS.sunny.fogFar
  );
  scene.fog = fog;

  // Painterly Sky Dome with glowing sun orb & clouds
  const skyUniforms = {
    uSkyZenith: { value: new THREE.Color(WEATHER_PRESETS.sunny.skyZenith) },
    uSkyHorizon: { value: new THREE.Color(WEATHER_PRESETS.sunny.skyHorizon) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
    uSunGlowColor: { value: new THREE.Color(WEATHER_PRESETS.sunny.sunGlow) },
    uTime: { value: 0 },
    uCloudStrength: { value: WEATHER_PRESETS.sunny.cloudShadow },
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(145, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  skyDome.renderOrder = -10;
  scene.add(skyDome);

  // Shared shader uniforms that water & terrain materials can read directly
  const sharedUniforms = {
    uSunDir: skyUniforms.uSunDir,
    uSunColor: { value: new THREE.Color(WEATHER_PRESETS.sunny.sunColor) },
    uSkyHorizon: skyUniforms.uSkyHorizon,
    uCloudShadow: { value: WEATHER_PRESETS.sunny.cloudShadow },
  };

  function recomputeSunVector() {
    const elev = THREE.MathUtils.degToRad(clamp(state.elevation, 6, 84));
    const azim = THREE.MathUtils.degToRad(state.azimuth);
    // Azimuth 0 = straight north (-Z, behind the town & across the lagoon!)
    // Positive = northeast (+X, -Z), Negative = northwest (-X, -Z)
    state.sunDir
      .set(Math.sin(azim) * Math.cos(elev), Math.sin(elev), -Math.cos(azim) * Math.cos(elev))
      .normalize();

    skyUniforms.uSunDir.value.copy(state.sunDir);

    // Subtle automatic warmth shift when the user lowers the sun manually
    const lowSun = 1.0 - clamp((state.elevation - 10) / 30, 0, 1);
    const preset = WEATHER_PRESETS[state.presetKey];
    const baseSun = new THREE.Color(preset.sunColor);
    const warmAmber = new THREE.Color('#ff964a');
    state.sunColor.copy(baseSun).lerp(warmAmber, lowSun * 0.52);

    sunLight.color.copy(state.sunColor);
    sharedUniforms.uSunColor.value.copy(state.sunColor);

    // Auto-brighten cozy house windows & dock lanterns when sun dips low!
    state.nightGlow = Math.max(preset.nightGlow, lowSun * 0.95);
  }

  function applyPreset(key) {
    const p = WEATHER_PRESETS[key];
    if (!p) return;
    state.presetKey = key;
    state.elevation = p.elevation;
    state.azimuth = p.azimuth;
    state.cloudShadow = p.cloudShadow;
    state.sparkleBoost = p.sparkleBoost;
    state.nightGlow = p.nightGlow;

    sunLight.intensity = p.sunIntensity;
    hemiLight.color.set(p.hemiSky);
    hemiLight.groundColor.set(p.hemiGround);
    hemiLight.intensity = p.hemiIntensity;
    fillLight.color.set(p.fillColor);
    fillLight.intensity = p.fillIntensity;

    skyUniforms.uSkyZenith.value.set(p.skyZenith);
    skyUniforms.uSkyHorizon.value.set(p.skyHorizon);
    skyUniforms.uSunGlowColor.value.set(p.sunGlow);
    skyUniforms.uCloudStrength.value = p.cloudShadow;
    sharedUniforms.uCloudShadow.value = p.cloudShadow;

    fog.color.set(p.fogColor);
    fog.near = p.fogNear;
    fog.far = p.fogFar;
    scene.background = new THREE.Color(p.fogColor);
    renderer.toneMappingExposure = p.exposure;

    recomputeSunVector();
  }

  applyPreset('sunny');

  return {
    state,
    sharedUniforms,
    sunLight,
    applyPreset,
    setShadowQuality(mapSize = 2048) {
      const size = Math.max(512, Math.min(2048, mapSize));
      if (sunLight.shadow.mapSize.x === size && sunLight.shadow.mapSize.y === size) return;
      sunLight.shadow.mapSize.set(size, size);
      if (sunLight.shadow.map) {
        sunLight.shadow.map.dispose();
        sunLight.shadow.map = null;
      }
      shadowTexelSize = (shadowBound * 2) / size;
    },
    setSunAngles(elevationDeg, azimuthDeg) {
      if (typeof elevationDeg === 'number') state.elevation = clamp(elevationDeg, 8, 82);
      if (typeof azimuthDeg === 'number') state.azimuth = clamp(azimuthDeg, -180, 180);
      recomputeSunVector();
    },
    update(elapsedTime, focusTarget) {
      skyUniforms.uTime.value = elapsedTime;
      if (focusTarget) {
        skyDome.position.set(focusTarget.x, 0, focusTarget.z);
        // Quantize shadow target in light-space to exact shadow texel increments while staying on y=0 -> ZERO shadow shimmering!
        _lightRight.crossVectors(_worldUp, state.sunDir).normalize();
        _lightUp.crossVectors(state.sunDir, _lightRight).normalize();
        const rawU = focusTarget.x * _lightRight.x + focusTarget.z * _lightRight.z;
        const rawV = focusTarget.x * _lightUp.x + focusTarget.z * _lightUp.z;
        const snapU = Math.round(rawU / shadowTexelSize) * shadowTexelSize;
        const snapV = Math.round(rawV / shadowTexelSize) * shadowTexelSize;
        // Shift purely along sunDir so _snappedTarget.y === 0 without disturbing (snapU, snapV)!
        const w = -(snapV * _lightUp.y) / Math.max(0.08, state.sunDir.y);
        _snappedTarget
          .copy(_lightRight)
          .multiplyScalar(snapU)
          .addScaledVector(_lightUp, snapV)
          .addScaledVector(state.sunDir, w);

        const sunDist = 54;
        sunLight.position.set(
          _snappedTarget.x + state.sunDir.x * sunDist,
          _snappedTarget.y + state.sunDir.y * sunDist,
          _snappedTarget.z + state.sunDir.z * sunDist
        );
        sunLight.target.position.copy(_snappedTarget);
        sunLight.target.updateMatrixWorld();
      }
    },
  };
}
