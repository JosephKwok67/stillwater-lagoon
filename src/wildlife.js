import * as THREE from 'three';
import { mulberry32, clamp } from './noise.js';
import { getWorldElevation } from './terrain.js';
import { FISH_SPECIES, buildSpeciesGeometry, createSpeciesTexture } from './fishCatalog.js';

/**
 * Builds a custom GPU-animated material tailored to each species' archetype:
 * - Standard / Torpedo / Bream / Baitfish: smooth S-curve caudal tail propulsion
 * - Ribbon (Cutlassfish): multi-wavelength undulating metallic silver blade wave
 * - Squid / Cuttlefish: undulating lateral skirt fin ripple + trailing tentacle sway
 * - Flat / Shrimp: subtle body glide & tail flutter
 */
function createSpeciesMaterial(spec, timeUniform) {
  const map = createSpeciesTexture(spec);

  const isMetallic = ['torpedo', 'ribbon'].includes(spec.archetype);
  const isGlowing = spec.id === 'cardinal_tetra' || spec.id === 'blue_diamond_discus';

  const mat = new THREE.MeshStandardMaterial({
    map,
    vertexColors: true,
    roughness: isMetallic ? 0.34 : 0.48,
    metalness: spec.archetype === 'ribbon' ? 0.45 : isMetallic ? 0.2 : 0.02,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(spec.palette.flank),
    emissiveIntensity: isGlowing ? 0.34 : 0.14,
  });

  const swimMode =
    spec.archetype === 'ribbon'
      ? 1
      : spec.archetype === 'squid'
        ? 2
        : spec.archetype === 'flat' || spec.archetype === 'shrimp'
          ? 3
          : 0;

  const wagFreq =
    spec.behavior === 'school'
      ? 9.2
      : spec.behavior === 'ribbon_drift'
        ? 4.2
        : spec.behavior === 'squid_glide'
          ? 6.4
          : spec.behavior === 'bottom'
            ? 5.0
            : 6.8;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFishTime = timeUniform;
    shader.uniforms.uWagFreq = { value: wagFreq };
    shader.uniforms.uSwimMode = { value: swimMode };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFishTime;
        uniform float uWagFreq;
        uniform int uSwimMode;
        `
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float fishPhase = 0.0;
        #ifdef USE_INSTANCING
          fishPhase = instanceMatrix[3][0] * 1.43 + instanceMatrix[3][2] * 1.97;
        #endif

        if (uSwimMode == 1) {
          // Cutlassfish: graceful multi-wave ribbon undulation along entire length
          float bodyT = clamp((0.45 - transformed.x) / 0.95, 0.0, 1.0);
          transformed.z += sin(uFishTime * uWagFreq + fishPhase + transformed.x * 13.5) * 0.085 * (0.25 + bodyT * 0.95);
        } else if (uSwimMode == 2) {
          // Bigfin Reef Squid & Cuttlefish: rippling lateral skirt fins + gentle trailing tentacles
          float skirtMask = smoothstep(0.06, 0.18, abs(transformed.z));
          transformed.y += sin(uFishTime * uWagFreq + fishPhase + transformed.x * 16.0) * 0.036 * skirtMask;
          float tentMask = smoothstep(-0.20, -0.44, transformed.x);
          transformed.z += sin(uFishTime * 4.5 + fishPhase + transformed.x * 10.0) * 0.035 * tentMask;
        } else if (uSwimMode == 3) {
          // Flathead, Scorpionfish, Shrimp: subtler grounded tail wiggle
          float flex = clamp((0.12 - transformed.x) / 0.48, 0.0, 1.0);
          transformed.z += sin(uFishTime * uWagFreq + fishPhase + transformed.x * 9.5) * 0.042 * flex * flex;
        } else {
          // Classic S-curve fish propulsion (strong tail sweep, steady head)
          float flex = clamp((0.20 - transformed.x) / 0.62, 0.0, 1.0);
          transformed.z += sin(uFishTime * uWagFreq + fishPhase + transformed.x * 10.5) * 0.072 * flex * flex;
        }
        `
      );
  };
  mat.customProgramCacheKey = () => `fish_${spec.id}_${swimMode}`;
  return mat;
}

/**
 * Builds the complete 25-species autonomous underwater ecosystem!
 * Each species has its own procedural 3D silhouette, painted pattern texture,
 * authentic relative size (tiny 0.45x to giant 2.5x Tuna), depth band, and swimming AI.
 */
export function buildAquaticEcosystem(scene) {
  const rng = mulberry32(20261126);
  const fishTimeUniform = { value: 0 };
  const speciesRuntimes = [];
  const speciesById = new Map();

  for (const spec of FISH_SPECIES) {
    const geo = buildSpeciesGeometry(spec);
    const mat = createSpeciesMaterial(spec, fishTimeUniform);
    const agents = [];

    for (let i = 0; i < spec.count; i++) {
      const zone = spec.zones[i % spec.zones.length];
      let x = zone.cx;
      let z = zone.cz;
      let sbY = getWorldElevation(x, z);

      // Search for a safe navigable water spawn inside this species' preferred habitat zone
      for (let attempt = 0; attempt < 24; attempt++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * zone.r;
        const cx = zone.cx + Math.cos(a) * r;
        const cz = zone.cz + Math.sin(a) * r;
        const elev = getWorldElevation(cx, cz);
        if (elev < -0.62) {
          x = cx;
          z = cz;
          sbY = elev;
          break;
        }
      }

      // Rich individual size variety within every species (Small / Normal / Large / Rare Crown Trophy!)
      const roll = rng();
      let sizeVar;
      let grade = '普通';
      if (roll > 0.94) {
        sizeVar = 1.38 + rng() * 0.18;
        grade = '王冠';
      } else if (roll > 0.74) {
        sizeVar = 1.15 + rng() * 0.22;
        grade = '大物';
      } else {
        sizeVar = 0.76 + rng() * 0.38;
      }
      const scale = spec.baseScale * sizeVar;
      const baseLenCm = Math.max(4, Math.round(spec.baseScale * 36));
      const lengthCm = Math.max(3, Math.round(baseLenCm * sizeVar));

      const heading = rng() * Math.PI * 2;
      const speedVar = spec.speed * (0.86 + rng() * 0.28);

      let y;
      if (spec.behavior === 'bottom') {
        y = Math.min(-0.38, sbY + 0.14 + rng() * 0.12);
      } else {
        const dMin = spec.depthRange[0];
        const dMax = spec.depthRange[1];
        const preferred = dMin + rng() * (dMax - dMin);
        y = clamp(preferred, sbY + 0.24, -0.26);
      }

      agents.push({
        speciesId: spec.id,
        zone,
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(Math.cos(heading) * speedVar, 0, Math.sin(heading) * speedVar),
        yaw: heading,
        roll: 0,
        pitch: 0,
        baseSpeed: speedVar,
        targetDepth: y,
        scale,
        sizeRatio: sizeVar,
        lengthCm,
        grade,
        phase: rng() * Math.PI * 2,
        wanderAngle: heading,
        stateTimer: 1.0 + rng() * 3.5,
        modeState: 0, // used for hover/dart, bottom rest/move, squid forward/backward
        spookTimer: 0, // > 0 when startled by boat rowing overhead!
        spookCooldown: 0,
        spookDirX: 1,
        spookDirZ: 0,
      });
    }

    const inst = new THREE.InstancedMesh(geo, mat, agents.length);
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = false; // agents roam across the wide lagoon
    scene.add(inst);

    const runtime = { spec, inst, agents };
    speciesRuntimes.push(runtime);
    speciesById.set(spec.id, runtime);
  }

  const dummy = new THREE.Object3D();
  const desired = new THREE.Vector3();
  const coh = new THREE.Vector3();
  const sep = new THREE.Vector3();
  const ali = new THREE.Vector3();
  let splashRippleCooldown = 0;

  return {
    speciesCatalog: FISH_SPECIES,
    totalCount: speciesRuntimes.reduce((sum, r) => sum + r.agents.length, 0),

    /**
     * Returns the live world position of a specimen of the given species (for the interactive Species Guide camera!)
     */
    getSpeciesFocusPosition(speciesId, index = 0) {
      const rt = speciesById.get(speciesId);
      if (!rt || !rt.agents.length) return null;
      return rt.agents[index % rt.agents.length].pos;
    },

    /**
     * Finds the closest real fish swimming near a fishing bobber (x, z) within radius!
     */
    findClosestFishNear(x, z, maxRadius = 4.6) {
      let best = null;
      let bestDist = maxRadius;
      for (const rt of speciesRuntimes) {
        for (const agent of rt.agents) {
          const d = Math.hypot(agent.pos.x - x, agent.pos.z - z);
          if (d < bestDist) {
            bestDist = d;
            best = { spec: rt.spec, agent, dist: d };
          }
        }
      }
      return best;
    },

    update(dt, elapsedTime, boatState, colliders, addRipple) {
      fishTimeUniform.value = elapsedTime;
      const clampedDt = Math.min(dt, 0.05);
      splashRippleCooldown = Math.max(0, splashRippleCooldown - clampedDt);

      const boatPos = boatState ? boatState.pos : null;
      const boatSpeed = boatState ? Math.abs(boatState.speed) : 0;
      const boatEffort = boatState ? boatState.rowEffort : 0;
      const boatFwdX = boatState ? Math.cos(boatState.yaw) : 1;
      const boatFwdZ = boatState ? -Math.sin(boatState.yaw) : 0;

      for (const rt of speciesRuntimes) {
        const { spec, inst, agents } = rt;
        const isSchooling = spec.behavior === 'school';
        const isBottom = spec.behavior === 'bottom';
        const isDiscus = spec.archetype === 'discus';
        const isRibbon = spec.behavior === 'ribbon_drift';
        const isSquid = spec.behavior === 'squid_glide';
        const isHoverDart = spec.behavior === 'hover_dart';

        // -------------------------------------------------------------------
        // Pass A: Startle Detection when boat rows over / splashes near fish!
        // -------------------------------------------------------------------
        if (boatPos) {
          // Loudness & shadow footprint expands when rowing fast, shrinks when quietly drifting
          const activityBoost = boatSpeed * 0.58 + boatEffort * 0.65;
          const baseRadius = isBottom ? 1.85 : isSchooling ? 2.55 : spec.baseScale > 1.7 ? 2.35 : 2.25;
          const spookRadius = baseRadius + activityBoost;

          for (let i = 0; i < agents.length; i++) {
            const f = agents[i];
            f.spookTimer = Math.max(0, f.spookTimer - clampedDt);
            f.spookCooldown = Math.max(0, f.spookCooldown - clampedDt);

            // Check distance to boat hull (slightly biased forward toward the approaching bow shadow!)
            const shadowX = boatPos.x + boatFwdX * 0.45;
            const shadowZ = boatPos.z + boatFwdZ * 0.45;
            const dx = f.pos.x - shadowX;
            const dz = f.pos.z - shadowZ;
            const distBoat = Math.hypot(dx, dz);

            if (distBoat < spookRadius && (f.spookCooldown <= 0 || distBoat < 1.35)) {
              // Escape radially outward from the boat, fanned slightly sideways so fish split cleanly!
              let ex = distBoat > 0.05 ? dx / distBoat : Math.cos(f.phase);
              let ez = distBoat > 0.05 ? dz / distBoat : Math.sin(f.phase);
              const scatterAngle = Math.sin(i * 17.3 + elapsedTime * 5.0) * 0.48;
              const ca = Math.cos(scatterAngle);
              const sa = Math.sin(scatterAngle);
              f.spookDirX = ex * ca - ez * sa;
              f.spookDirZ = ex * sa + ez * ca;

              const wasCalm = f.spookTimer <= 0.15;
              f.spookTimer = isBottom ? 1.15 : isSchooling ? 1.85 : 2.05;
              f.spookCooldown = 0.55;
              f.wanderAngle = Math.atan2(f.spookDirZ, f.spookDirX);

              // Instant explosive bolt velocity on startle!
              const burstSpd = Math.max(2.6, f.baseSpeed * (isBottom ? 5.2 : 3.9));
              f.vel.x = f.spookDirX * burstSpd;
              f.vel.z = f.spookDirZ * burstSpd;

              // Squid jet-propulsion mode on panic!
              if (isSquid) f.modeState = 2;

              // Spawn a crisp little water-surface flee splash if a shallow/mid-water fish bolts!
              if (wasCalm && addRipple && splashRippleCooldown <= 0 && f.pos.y > -0.95) {
                addRipple({
                  x: f.pos.x,
                  z: f.pos.z,
                  dirX: f.spookDirX,
                  dirZ: f.spookDirZ,
                  mode: 0,
                  radiusScale: clamp(0.32 + spec.baseScale * 0.16, 0.35, 0.72),
                  intensity: 0.62,
                });
                splashRippleCooldown = 0.12;
              }

              // Chain-reaction school panic: nearby schoolmates scatter together!
              if (isSchooling && wasCalm) {
                for (let j = 0; j < agents.length; j++) {
                  if (i === j) continue;
                  const mate = agents[j];
                  if (mate.spookTimer > 0.5) continue;
                  const md = Math.hypot(mate.pos.x - f.pos.x, mate.pos.z - f.pos.z);
                  if (md < 2.8) {
                    const spread = (Math.sin(j * 9.7 + elapsedTime * 4.0)) * 0.42;
                    const cm = Math.cos(spread);
                    const sm = Math.sin(spread);
                    mate.spookDirX = f.spookDirX * cm - f.spookDirZ * sm;
                    mate.spookDirZ = f.spookDirX * sm + f.spookDirZ * cm;
                    mate.spookTimer = 1.55;
                    mate.spookCooldown = 0.65;
                    mate.wanderAngle = Math.atan2(mate.spookDirZ, mate.spookDirX);
                    const mateBurst = Math.max(2.4, mate.baseSpeed * 3.6);
                    mate.vel.x = mate.spookDirX * mateBurst;
                    mate.vel.z = mate.spookDirZ * mateBurst;
                  }
                }
              }
            }
          }
        }

        // -------------------------------------------------------------------
        // Pass B: Steering, Movement, Depth & Transform Update
        // -------------------------------------------------------------------
        for (let i = 0; i < agents.length; i++) {
          const f = agents[i];
          const isSpooked = f.spookTimer > 0.01;
          const spookIntensity = clamp(f.spookTimer / 1.4, 0, 1);

          f.stateTimer -= clampedDt;
          let targetSpeed = f.baseSpeed;

          if (isSpooked) {
            // Sprinting rapidly away from the boat, then smoothly easing down
            const sprintSpeed = Math.max(2.3, f.baseSpeed * (isBottom ? 4.4 : 3.5));
            targetSpeed = THREE.MathUtils.lerp(f.baseSpeed, sprintSpeed, spookIntensity);
            desired.set(f.spookDirX, 0, f.spookDirZ).multiplyScalar(targetSpeed);
          } else {
            if (isBottom) {
              if (f.stateTimer <= 0) {
                f.modeState = f.modeState === 0 ? 1 : 0;
                f.stateTimer = f.modeState === 0 ? 1.8 + ((i * 7) % 3) * 0.9 : 1.1 + ((i * 3) % 2) * 0.8;
                if (f.modeState === 1) {
                  f.wanderAngle += Math.sin(elapsedTime * 2.3 + i * 5.7) * 1.9;
                }
              }
              targetSpeed = f.modeState === 1 ? f.baseSpeed * 1.45 : 0.04;
            } else if (isHoverDart) {
              if (f.stateTimer <= 0) {
                f.modeState = f.modeState === 0 ? 1 : 0;
                f.stateTimer = f.modeState === 0 ? 2.2 + (i % 3) * 0.7 : 0.85;
                if (f.modeState === 1) {
                  f.wanderAngle += Math.sin(elapsedTime * 1.9 + i * 11.1) * 0.9;
                }
              }
              targetSpeed = f.modeState === 1 ? f.baseSpeed * 2.0 : f.baseSpeed * 0.16;
            } else if (isSquid) {
              if (f.stateTimer <= 0) {
                f.modeState = (f.modeState + 1) % 3;
                f.stateTimer = 1.8 + (i % 3) * 0.85;
                f.wanderAngle += Math.sin(elapsedTime * 1.5 + i * 4.3) * 1.1;
              }
              targetSpeed = f.modeState === 0 ? f.baseSpeed : f.modeState === 1 ? 0.12 : -f.baseSpeed * 0.55;
            } else {
              if (f.stateTimer <= 0) {
                f.stateTimer = (isSchooling ? 1.5 : 2.6) + Math.abs(Math.sin(elapsedTime + i * 3.1)) * 2.2;
                f.wanderAngle += Math.sin(i * 13.7 + elapsedTime * 1.7) * (isSchooling ? 1.15 : 1.45);
              }
            }

            desired.set(Math.cos(f.wanderAngle), 0, Math.sin(f.wanderAngle)).multiplyScalar(targetSpeed);

            // Boid schooling forces (only when calm — startled fish scatter cleanly first, then regroup!)
            if (isSchooling && agents.length > 1) {
              coh.set(0, 0, 0);
              sep.set(0, 0, 0);
              ali.set(0, 0, 0);
              let neighbors = 0;
              const senseR = 2.6 + spec.baseScale * 0.8;
              const sepR = 0.55 + spec.baseScale * 0.42;

              for (let j = 0; j < agents.length; j++) {
                if (i === j) continue;
                const o = agents[j];
                const dx = o.pos.x - f.pos.x;
                const dz = o.pos.z - f.pos.z;
                const d2 = dx * dx + dz * dz;
                if (d2 < senseR * senseR && d2 > 0.0001) {
                  const d = Math.sqrt(d2);
                  coh.x += o.pos.x;
                  coh.z += o.pos.z;
                  ali.x += o.vel.x;
                  ali.z += o.vel.z;
                  neighbors++;
                  if (d < sepR) {
                    const push = (sepR - d) / sepR;
                    sep.x -= (dx / d) * push;
                    sep.z -= (dz / d) * push;
                  }
                }
              }

              if (neighbors > 0) {
                coh.multiplyScalar(1 / neighbors).sub(f.pos);
                ali.multiplyScalar(1 / neighbors);
                desired.x += coh.x * 0.32 + ali.x * 0.48 + sep.x * 1.35;
                desired.z += coh.z * 0.32 + ali.z * 0.48 + sep.z * 1.35;
              }
            }

            // Soft tether back to species' natural habitat zone when calm
            const toHomeX = f.zone.cx - f.pos.x;
            const toHomeZ = f.zone.cz - f.pos.z;
            const distHome = Math.hypot(toHomeX, toHomeZ);
            if (distHome > f.zone.r * 0.88) {
              const pull = (distHome - f.zone.r * 0.88) * 0.42;
              desired.x += (toHomeX / (distHome + 0.001)) * pull;
              desired.z += (toHomeZ / (distHome + 0.001)) * pull;
            }
          }

          // Steer cleanly around emergent islets & pier pilings
          for (const c of colliders) {
            const dx = f.pos.x - c.x;
            const dz = f.pos.z - c.z;
            const d = Math.hypot(dx, dz);
            const minR = c.radius + 0.55 + spec.baseScale * 0.22;
            if (d < minR && d > 0.01) {
              const push = (minR - d) * 3.0;
              desired.x += (dx / d) * push;
              desired.z += (dz / d) * push;
            }
          }

          // Snappy responsive steering when fleeing, smooth cruising when calm
          const turnStiffness = isSpooked ? 8.5 : isBottom ? 3.2 : isSchooling ? 3.0 : 2.0;
          f.vel.lerp(desired, clamp(clampedDt * turnStiffness, 0, 1));
          const spd = Math.hypot(f.vel.x, f.vel.z);
          const maxSpd = isSpooked
            ? Math.max(3.6, f.baseSpeed * 4.5)
            : Math.max(0.25, f.baseSpeed * 2.25);
          if (spd > maxSpd) {
            f.vel.x = (f.vel.x / spd) * maxSpd;
            f.vel.z = (f.vel.z / spd) * maxSpd;
          }

          // Advance XZ position while staying strictly inside deep enough navigable water
          const nextX = f.pos.x + f.vel.x * clampedDt;
          const nextZ = f.pos.z + f.vel.z * clampedDt;
          const minRequiredDepth = spec.baseScale > 1.7 ? -0.95 : -0.46;
          const nextSb = getWorldElevation(nextX, nextZ);

          if (nextSb > minRequiredDepth) {
            const eps = 0.5;
            const gx = getWorldElevation(f.pos.x + eps, f.pos.z) - getWorldElevation(f.pos.x - eps, f.pos.z);
            const gz = getWorldElevation(f.pos.x, f.pos.z + eps) - getWorldElevation(f.pos.x, f.pos.z - eps);
            const gLen = Math.hypot(gx, gz) || 1;
            const bounceSpd = Math.max(0.55, spd * 0.8);
            f.vel.x = -(gx / gLen) * bounceSpd;
            f.vel.z = -(gz / gLen) * bounceSpd;
            f.spookDirX = -(gx / gLen);
            f.spookDirZ = -(gz / gLen);
            f.wanderAngle = Math.atan2(f.vel.z, f.vel.x);
          } else {
            f.pos.x = nextX;
            f.pos.z = nextZ;
          }

          // Vertical depth update (startled fish briefly dive slightly deeper out of the boat's shadow!)
          const curSb = Math.min(getWorldElevation(f.pos.x, f.pos.z), -0.5);
          let targetY;
          if (isBottom) {
            targetY = Math.min(-0.34, curSb + 0.13 + Math.sin(elapsedTime * 1.4 + f.phase) * 0.02);
          } else {
            const diveOffset = isSpooked ? -0.42 * spookIntensity : 0;
            targetY = clamp(
              f.targetDepth + diveOffset + Math.sin(elapsedTime * 0.95 + f.phase) * 0.12,
              curSb + 0.22,
              -0.25
            );
          }
          f.pos.y = THREE.MathUtils.lerp(f.pos.y, targetY, clamp(clampedDt * (isSpooked ? 5.0 : 2.8), 0, 1));

          // Smooth heading orientation (snaps quickly when startled!)
          if (spd > 0.06) {
            let desiredYaw = Math.atan2(-f.vel.z, f.vel.x);
            if (isSquid && f.modeState === 2) {
              desiredYaw += Math.PI; // squid jet backward tail-first!
            }
            let diff = desiredYaw - f.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            f.yaw += diff * clamp(clampedDt * (isSpooked ? 11.0 : 5.2), 0, 1);

            const baseTilt = isDiscus ? 0.42 + Math.sin(elapsedTime * 1.1 + f.phase) * 0.14 : 0;
            const bank = clamp(-diff * (isSpooked ? 0.65 : 0.45), -0.48, 0.48);
            f.roll = THREE.MathUtils.lerp(f.roll, baseTilt + bank, clamp(clampedDt * 5.0, 0, 1));
          }

          const targetPitch = isRibbon ? (isSpooked ? 0.12 : 0.52 + Math.sin(elapsedTime * 1.2 + f.phase) * 0.12) : isSpooked ? -0.14 * spookIntensity : 0;
          f.pitch = THREE.MathUtils.lerp(f.pitch, targetPitch, clampedDt * 4.0);

          dummy.position.copy(f.pos);
          dummy.rotation.set(f.roll, f.yaw, f.pitch, 'YXZ');
          dummy.scale.setScalar(f.scale);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }

        inst.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

/**
 * Builds the adorable little brown swimming dog/otter companion paddling beside the boat!
 */
export function buildSwimmingCompanion(scene) {
  const root = new THREE.Group();

  const furMainMat = new THREE.MeshStandardMaterial({
    color: 0x9b6b49,
    roughness: 0.85,
    metalness: 0.0,
  });
  const furLightMat = new THREE.MeshStandardMaterial({
    color: 0xd8b792,
    roughness: 0.82,
    metalness: 0.0,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x261d17,
    roughness: 0.5,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 6, 12), furMainMat);
  body.rotation.z = Math.PI / 2;
  body.scale.set(0.95, 1.0, 0.88);
  body.position.set(-0.04, -0.02, 0);
  body.castShadow = true;
  root.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8), furLightMat);
  chest.position.set(0.16, -0.04, 0);
  chest.scale.set(1.0, 0.88, 0.82);
  root.add(chest);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.28, 0.13, 0);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), furMainMat);
  cranium.scale.set(1.06, 0.96, 0.96);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), furLightMat);
  muzzle.position.set(0.13, -0.03, 0);
  muzzle.scale.set(1.05, 0.78, 0.88);
  headGroup.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), darkMat);
  nose.position.set(0.225, -0.005, 0);
  headGroup.add(nose);

  const eyeGeo = new THREE.SphereGeometry(0.024, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, darkMat);
  eyeL.position.set(0.11, 0.045, -0.088);
  const eyeR = new THREE.Mesh(eyeGeo, darkMat);
  eyeR.position.set(0.11, 0.045, 0.088);
  headGroup.add(eyeL, eyeR);

  const earGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const earL = new THREE.Mesh(earGeo, furMainMat);
  earL.scale.set(0.7, 1.25, 0.45);
  earL.position.set(-0.02, 0.03, -0.145);
  earL.rotation.set(0.28, 0, 0.18);
  const earR = new THREE.Mesh(earGeo, furMainMat);
  earR.scale.set(0.7, 1.25, 0.45);
  earR.position.set(-0.02, 0.03, 0.145);
  earR.rotation.set(-0.28, 0, 0.18);
  headGroup.add(earL, earR);

  root.add(headGroup);

  const pawGeo = new THREE.CapsuleGeometry(0.048, 0.14, 5, 8);
  const pawFL = new THREE.Mesh(pawGeo, furLightMat);
  pawFL.position.set(0.16, -0.11, -0.13);
  const pawFR = new THREE.Mesh(pawGeo, furLightMat);
  pawFR.position.set(0.16, -0.11, 0.13);
  const pawBL = new THREE.Mesh(pawGeo, furLightMat);
  pawBL.position.set(-0.22, -0.1, -0.11);
  const pawBR = new THREE.Mesh(pawGeo, furLightMat);
  pawBR.position.set(-0.22, -0.1, 0.11);
  root.add(pawFL, pawFR, pawBL, pawBR);

  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 5, 8), furMainMat);
  tail.position.set(-0.34, 0.02, 0);
  tail.rotation.z = 1.12;
  root.add(tail);

  // Signature coral-red bandana matching Codex's approved turnaround sheet!
  const bandanaMat = new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.82 });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.036, 7, 14), bandanaMat);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0.26;
  collar.position.set(0.17, 0.03, 0);
  const bib = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.16, 4), bandanaMat);
  bib.rotation.z = Math.PI;
  bib.rotation.y = Math.PI / 4;
  bib.position.set(0.24, -0.065, 0);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.042, 7, 6), bandanaMat);
  knot.position.set(0.09, 0.14, 0);
  root.add(collar, bib, knot);

  const pos = new THREE.Vector3(-1.55, -0.02, -1.45);
  let yaw = 0.42;
  let onLand = false;
  root.scale.setScalar(0.86);
  root.position.copy(pos);
  root.rotation.y = yaw;
  scene.add(root);

  let rippleTimer = 0.25;

  return {
    root,
    pos,
    setVisible(v) {
      root.visible = v;
    },
    teleportNear(x, y, z, landMode) {
      pos.set(x, y, z);
      onLand = Boolean(landMode);
      root.position.set(x, landMode ? y + 0.22 : 0.005, z);
    },
    update(dt, elapsedTime, boatState, addRipple, landContext = null) {
      if (!root.visible) return;
      const clampedDt = Math.min(dt, 0.05);

      const walkingMode = Boolean(landContext && landContext.walking);

      if (walkingMode) {
        // ---- AMPHIBIOUS LAND FOLLOW MODE (Trots cheerfully beside player on piers, town & indoors!) ----
        onLand = true;
        const pPos = landContext.playerPos;
        const pYaw = landContext.playerYaw;
        const backX = -Math.sin(pYaw);
        const backZ = -Math.cos(pYaw);
        const sideX = Math.cos(pYaw);
        const sideZ = -Math.sin(pYaw);

        const targetX = pPos.x + backX * 0.95 + sideX * 0.72;
        const targetZ = pPos.z + backZ * 0.95 + sideZ * 0.72;

        const dx = targetX - pos.x;
        const dz = targetZ - pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 8.5) {
          // Gently warp to pier/beside player if player hopped far onto land
          pos.x = targetX;
          pos.z = targetZ;
        } else if (dist > 0.14) {
          const speed = clamp(dist * 2.5, 0.9, 4.6);
          const step = Math.min(dist, speed * clampedDt);
          const candX = pos.x + (dx / dist) * step;
          const candZ = pos.z + (dz / dist) * step;
          if (!landContext.town || landContext.town.isWalkableLand(candX, candZ)) {
            pos.x = candX;
            pos.z = candZ;
            if (landContext.town) landContext.town.resolveLandCollisions(pos, 0.22);
          }
        }

        const groundY = landContext.town ? landContext.town.getWalkableElevation(pos.x, pos.z) : 0.5;
        const isMoving = dist > 0.22;

        const desiredYaw = isMoving ? Math.atan2(-dz, dx) : Math.atan2(-(pPos.z - pos.z), pPos.x - pos.x);
        let diff = desiredYaw - yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        yaw += diff * clamp(clampedDt * 7.5, 0, 1);

        const trotPhase = elapsedTime * (isMoving ? 11.5 : 3.0);
        const bounce = isMoving ? Math.abs(Math.sin(trotPhase)) * 0.048 : Math.sin(elapsedTime * 2.4) * 0.008;

        pos.y = THREE.MathUtils.lerp(pos.y, groundY, clamp(clampedDt * 12, 0, 1));
        root.position.set(pos.x, pos.y + 0.18 + bounce, pos.z);
        root.rotation.y = yaw;
        root.rotation.x = 0;
        root.rotation.z = isMoving ? Math.sin(trotPhase) * 0.06 : 0;

        headGroup.rotation.y = Math.sin(elapsedTime * 1.6) * 0.16;
        headGroup.rotation.z = isMoving ? 0.05 : 0;

        const legAmp = isMoving ? 0.65 : 0.04;
        pawFL.rotation.z = Math.sin(trotPhase) * legAmp;
        pawFR.rotation.z = -Math.sin(trotPhase) * legAmp;
        pawBL.rotation.z = -Math.sin(trotPhase) * legAmp;
        pawBR.rotation.z = Math.sin(trotPhase) * legAmp;
        tail.rotation.y = Math.sin(elapsedTime * (isMoving ? 12.0 : 8.5)) * 0.48;
        return;
      }

      // ---- SWIMMING COMPANION MODE BESIDE THE BOAT ----
      const fwdX = Math.cos(boatState.yaw);
      const fwdZ = -Math.sin(boatState.yaw);
      const leftX = Math.sin(boatState.yaw);
      const leftZ = Math.cos(boatState.yaw);

      const swimBobOffset = Math.sin(elapsedTime * 0.85) * 0.22;
      const targetX = boatState.pos.x + fwdX * (0.45 + swimBobOffset) - leftX * 2.25;
      const targetZ = boatState.pos.z + fwdZ * (0.45 + swimBobOffset) - leftZ * 2.25;

      if (onLand) {
        onLand = false;
        // Hop smoothly back into the water beside the boat when boarding!
        if (Math.hypot(targetX - pos.x, targetZ - pos.z) > 6.0 || getWorldElevation(pos.x, pos.z) >= -0.15) {
          pos.set(targetX, 0, targetZ);
        }
      }

      const dx = targetX - pos.x;
      const dz = targetZ - pos.z;
      const dist = Math.hypot(dx, dz);

      const followRate = clamp(dist * 1.55, 0.45, 3.8);
      if (dist > 0.05) {
        const candX = pos.x + (dx / dist) * Math.min(dist, followRate * clampedDt);
        const candZ = pos.z + (dz / dist) * Math.min(dist, followRate * clampedDt);
        if (getWorldElevation(candX, candZ) < -0.18) {
          pos.x = candX;
          pos.z = candZ;
        }
      }

      const desiredYaw =
        dist > 0.35 ? Math.atan2(-dz, dx) : boatState.yaw + Math.sin(elapsedTime * 0.9) * 0.14;
      let diff = desiredYaw - yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yaw += diff * clamp(clampedDt * 4.2, 0, 1);

      const paddleFreq = 5.5 + clamp(dist * 2.2, 0, 5.0);
      const paddlePhase = elapsedTime * paddleFreq;

      pos.y = THREE.MathUtils.lerp(pos.y, 0.005, clamp(clampedDt * 8, 0, 1));
      root.position.set(pos.x, pos.y + Math.sin(elapsedTime * 3.1) * 0.018, pos.z);
      root.rotation.y = yaw;
      root.rotation.x = Math.sin(paddlePhase * 0.5) * 0.05;
      root.rotation.z = Math.cos(elapsedTime * 2.4) * 0.04;

      headGroup.rotation.y = Math.sin(elapsedTime * 1.3) * 0.18;
      headGroup.rotation.z = Math.sin(elapsedTime * 2.6) * 0.05;

      pawFL.rotation.z = 0.65 + Math.sin(paddlePhase) * 0.72;
      pawFR.rotation.z = 0.65 + Math.sin(paddlePhase + Math.PI) * 0.72;
      pawBL.rotation.z = 0.75 + Math.sin(paddlePhase + Math.PI) * 0.55;
      pawBR.rotation.z = 0.75 + Math.sin(paddlePhase) * 0.55;

      tail.rotation.y = Math.sin(elapsedTime * 7.5) * 0.35;

      rippleTimer -= clampedDt;
      if (rippleTimer <= 0 && addRipple) {
        rippleTimer = dist > 0.4 ? 0.38 : 0.95;
        addRipple({
          x: pos.x - Math.cos(yaw) * 0.18,
          z: pos.z + Math.sin(yaw) * 0.18,
          dirX: -Math.cos(yaw),
          dirZ: Math.sin(yaw),
          mode: 1,
          radiusScale: 0.34,
          intensity: 0.65,
        });
      }
    },
  };
}
