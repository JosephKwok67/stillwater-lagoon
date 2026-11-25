import * as THREE from 'three';

/**
 * Shared uniform state for all underwater materials (seabed, rocks, corals, kelp, islets)
 * so animated caustics, wet waterline darkening, and gentle flora sway stay synchronized.
 */
export const underwaterSharedUniforms = {
  uTime: { value: 0 },
  uCausticsIntensity: { value: 0.75 },
};

/**
 * Enhances a MeshStandardMaterial with:
 * 1. Organic domain-warped underwater water caustics below y = 0
 * 2. Subtle wet waterline darkening around y = 0 on emergent rocks/islets
 * 3. Optional gentle underwater current sway for corals & kelp
 * 4. Painterly mossy flanks + warm sunlit sandy-stone cap on emergent islets
 */
export function applyLagoonMaterialShader(
  material,
  {
    causticsScale = 1.0,
    swayAmount = 0.0,
    swaySpeed = 1.4,
    isEmergentIslet = false,
    wetline = true,
  } = {}
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = underwaterSharedUniforms.uTime;
    shader.uniforms.uCausticsIntensity = underwaterSharedUniforms.uCausticsIntensity;
    shader.uniforms.uCausticsScale = { value: causticsScale };
    shader.uniforms.uSwayAmount = { value: swayAmount };
    shader.uniforms.uSwaySpeed = { value: swaySpeed };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uSwayAmount;
        uniform float uSwaySpeed;
        varying vec3 vLagoonWorldPos;
        varying vec3 vLagoonWorldNormal;
        `
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (uSwayAmount > 0.0001) {
          float tipWeight = clamp(position.y * 1.15, 0.0, 1.5);
          float worldPhase = 0.0;
          #ifdef USE_INSTANCING
            worldPhase = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.9;
          #endif
          float swayX = sin(uTime * uSwaySpeed + worldPhase + position.y * 2.4) * uSwayAmount * tipWeight;
          float swayZ = cos(uTime * uSwaySpeed * 0.82 + worldPhase * 1.3 + position.y * 1.8) * uSwayAmount * 0.7 * tipWeight;
          transformed.x += swayX;
          transformed.z += swayZ;
        }
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 lagoonWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          lagoonWp = instanceMatrix * lagoonWp;
        #endif
        lagoonWp = modelMatrix * lagoonWp;
        vLagoonWorldPos = lagoonWp.xyz;

        vec3 lagoonWn = objectNormal;
        #ifdef USE_INSTANCING
          lagoonWn = mat3(instanceMatrix) * lagoonWn;
        #endif
        vLagoonWorldNormal = normalize(mat3(modelMatrix) * lagoonWn);
        `
      );

    const isletSnippet = isEmergentIslet
      ? `
        // Emergent rocky islets: lush mossy olive flanks, warm sunlit sandy-beige rock tops
        float upDot = clamp(vLagoonWorldNormal.y, 0.0, 1.0);
        float heightAbove = vLagoonWorldPos.y;
        float mossNoise = sin(vLagoonWorldPos.x * 2.4 + vLagoonWorldPos.z * 1.9) * 0.5
                        + cos(vLagoonWorldPos.x * 5.1 - vLagoonWorldPos.z * 4.2) * 0.3;
        float mossBand = smoothstep(-0.02, 0.16, heightAbove) * (1.0 - smoothstep(0.42, 0.85, heightAbove + mossNoise * 0.18));
        float slopeMoss = smoothstep(0.28, 0.74, 1.0 - upDot * 0.8);
        float mossMask = clamp(mossBand * (0.62 + slopeMoss * 0.65) + smoothstep(0.02, 0.25, heightAbove) * (1.0 - smoothstep(0.72, 0.92, upDot)) * 0.62, 0.0, 0.92);
        vec3 mossCol = mix(vec3(0.16, 0.30, 0.10), vec3(0.30, 0.44, 0.15), clamp(mossNoise * 0.5 + 0.5, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, mossMask);

        // Submerged base of islet transitions smoothly to cool mossy-teal stone
        float subBlend = smoothstep(0.06, -0.32, heightAbove);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.36, 0.36), subBlend * 0.72);
      `
      : '';

    const wetlineSnippet = wetline
      ? `
        // Subtle darkened wet stone/sand ring right along the waterline
        float wetBand = smoothstep(-0.18, 0.02, vLagoonWorldPos.y) * (1.0 - smoothstep(0.05, 0.24, vLagoonWorldPos.y));
        diffuseColor.rgb *= mix(1.0, 0.72, wetBand * 0.85);
        // Subtle painterly gouache grass & soil brushstroke variation on land terrain
        if (vLagoonWorldPos.y > 0.25) {
          float brush1 = sin(vLagoonWorldPos.x * 1.9 + cos(vLagoonWorldPos.z * 1.7)) * cos(vLagoonWorldPos.z * 2.1 - sin(vLagoonWorldPos.x * 1.4));
          float brush2 = sin(vLagoonWorldPos.x * 5.2 - vLagoonWorldPos.z * 4.3);
          float landBlend = smoothstep(0.25, 0.75, vLagoonWorldPos.y);
          diffuseColor.rgb *= 1.0 + (brush1 * 0.075 + brush2 * 0.035) * landBlend;
        }
      `
      : '';

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uCausticsIntensity;
        uniform float uCausticsScale;
        varying vec3 vLagoonWorldPos;
        varying vec3 vLagoonWorldNormal;

        // Organic non-grid domain-warped caustic shimmer
        float causticPattern(vec2 uv, float t) {
          vec2 warp = vec2(
            sin(uv.y * 0.75 + t * 0.45) + cos(uv.x * 0.62 - t * 0.38),
            cos(uv.x * 0.81 + t * 0.41) - sin(uv.y * 0.58 + t * 0.33)
          ) * 0.48;
          vec2 p1 = uv * 0.56 + warp + vec2(t * 0.14, t * 0.09);
          vec2 p2 = mat2(0.76, -0.65, 0.65, 0.76) * (uv * 0.71 - warp * 0.85) + vec2(-t * 0.11, t * 0.15);

          float a = sin(p1.x * 1.9 + sin(p1.y * 1.7 + t * 0.6)) * cos(p1.y * 2.1 + cos(p1.x * 1.5 - t * 0.5));
          float b = sin(p2.x * 2.2 - cos(p2.y * 1.8 - t * 0.7)) * cos(p2.y * 1.9 + sin(p2.x * 2.1 + t * 0.4));
          float ridge1 = pow(clamp(1.0 - abs(a), 0.0, 1.0), 4.2);
          float ridge2 = pow(clamp(1.0 - abs(b), 0.0, 1.0), 4.2);
          return clamp((ridge1 * 0.55 + ridge2 * 0.52) * 1.12 - 0.22, 0.0, 1.0);
        }
        `
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${isletSnippet}
        ${wetlineSnippet}
        `
      )
      .replace(
        '#include <dithering_fragment>',
        `
        // Delicate animated underwater caustics in linear space
        if (vLagoonWorldPos.y < 0.02 && uCausticsScale > 0.001) {
          float subDepth = max(0.0, -vLagoonWorldPos.y);
          float depthFade = smoothstep(0.0, 0.22, subDepth) * exp(-subDepth * 0.42);
          float upFacing = smoothstep(0.0, 0.78, vLagoonWorldNormal.y);
          float c = causticPattern(vLagoonWorldPos.xz, uTime);
          vec3 causticColor = vec3(0.28, 0.85, 0.80);
          gl_FragColor.rgb += causticColor * c * depthFade * upFacing * 0.22 * uCausticsIntensity * uCausticsScale;
        }
        #include <dithering_fragment>
        `
      );
  };

  material.customProgramCacheKey = () =>
    `lagoon_v2_${causticsScale}_${swayAmount}_${isEmergentIslet ? 1 : 0}_${wetline ? 1 : 0}`;

  return material;
}
