import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { meadowUniforms } from '../grass.js';
import { applyLagoonMaterialShader } from '../underwaterMaterial.js';

const loader = new GLTFLoader();

/**
 * Fetches `/assets/models/manifest.json` so the engine knows which Codex Blender .glb
 * models (and newly finished watercolor fish icons) are ready, avoiding any 404 console noise!
 */
export async function fetchAssetManifest() {
  try {
    const res = await fetch('./assets/models/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Prepares shadows and matte painterly material defaults cleanly on any loaded Blender GLB.
 */
function configureLoadedModel(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.isMeshStandardMaterial) {
          const isGlass = m.transparent || (typeof m.opacity === 'number' && m.opacity < 0.99);
          const isGlossyEye = /eye|catchlight|brass|gold|metal|glass|aqua/i.test(m.name || '');
          if (isGlass) {
            m.transparent = true;
            m.depthWrite = false;
            m.roughness = Math.min(m.roughness ?? 0.18, 0.22);
          } else if (!isGlossyEye) {
            m.roughness = Math.max(m.roughness ?? 0.82, 0.76);
            m.metalness = Math.min(m.metalness ?? 0.0, 0.08);
          }
        }
      }
    }
  });
}

/**
 * Loads a Blender .glb character/dog model, auto-normalizes scale/grounding if needed,
 * binds AnimationMixer to standard clip names (Idle/Walk/Run/Sit_Row/Fish_* / Wave/Talk/Swim/Happy),
 * and returns a clean controller adapter!
 */
export function loadCharacterGlb(url, { targetHeight = 1.24, isQuadruped = false } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        configureLoadedModel(model);

        // Auto-normalize height & foot grounding so minor Blender export scale offsets never float/sink!
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const curDim = isQuadruped ? Math.max(size.x, size.z) : size.y;
        if (curDim > 0.05 && Math.abs(curDim - targetHeight) > 0.25) {
          const s = targetHeight / curDim;
          model.scale.multiplyScalar(s);
          box.setFromObject(model);
        }
        // Rest lowest vertex cleanly at y = 0
        if (Math.abs(box.min.y) > 0.01) {
          model.position.y -= box.min.y;
        }

        const mixer = gltf.animations?.length ? new THREE.AnimationMixer(model) : null;
        const actions = new Map();
        if (mixer) {
          for (const clip of gltf.animations) {
            const action = mixer.clipAction(clip);
            actions.set(clip.name.toLowerCase(), action);
          }
        }

        let currentAction = null;
        let currentName = '';

        function playAction(name) {
          if (!mixer || !actions.size) return false;
          const lower = String(name || 'idle').toLowerCase();
          if (lower === currentName) return true;

          // Flexible clip matching (exact -> fallback map -> idle)
          const fallbacks = [
            lower,
            lower === 'run' ? 'walk' : null,
            lower === 'fish_aim' ? 'fish_cast' : null,
            lower === 'fish_reel' ? 'fish_bite' : null,
            lower === 'board_boat' ? 'walk' : null,
            lower === 'sleep_bed' ? 'idle' : null,
            'idle',
          ].filter(Boolean);

          let nextAction = null;
          for (const key of fallbacks) {
            if (actions.has(key)) {
              nextAction = actions.get(key);
              break;
            }
          }
          if (!nextAction) return false;

          nextAction.reset().fadeIn(0.2).play();
          if (currentAction && currentAction !== nextAction) {
            currentAction.fadeOut(0.2);
          }
          currentAction = nextAction;
          currentName = lower;
          return true;
        }

        // Extract standardized anatomical Rig_* pivot nodes exported by Antigravity Blender pipeline
        // so the live 60fps Action Pack (Walk, Run, Sit_Row, Fish_*, Sleep_Bed, Wave, Talk, Dog Trot/Swim/Wag)
        // drives real baked GLB limbs cleanly!
        const rig = {};
        model.traverse((obj) => {
          const n = obj.name || '';
          if (n === 'Rig_Torso') rig.torso = obj;
          else if (n === 'Rig_Head') rig.head = obj;
          else if (n === 'Rig_ArmL') rig.armL = obj;
          else if (n === 'Rig_ArmR') rig.armR = obj;
          else if (n === 'Rig_LegL') rig.legL = obj;
          else if (n === 'Rig_LegR') rig.legR = obj;
          else if (n === 'Rig_Body') rig.body = obj;
          else if (n === 'Rig_Tail') rig.tail = obj;
          else if (n === 'Rig_PawFL') rig.pawFL = obj;
          else if (n === 'Rig_PawFR') rig.pawFR = obj;
          else if (n === 'Rig_PawBL') rig.pawBL = obj;
          else if (n === 'Rig_PawBR') rig.pawBR = obj;
        });
        const hasRig = Boolean(rig.torso || rig.body);

        resolve({
          model,
          mixer,
          rig,
          hasRig,
          hasAnimations: actions.size > 0,
          playAction,
          update(dt) {
            if (mixer) mixer.update(dt);
          },
        });
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Loads a Blender seamless walk-in Building .glb (`house_player.glb`, `house_artisan.glb`, `house_neighbor_east.glb`)
 * and automatically extracts standardized nodes:
 *   - `Roof_Cutaway` (faded smoothly when walking inside)
 *   - `Door_Hinge` (rotated 0 -> -92° smoothly when pressing [E])
 *   - `Anchor_Aquarium` / `Anchor_Bed` / `Anchor_Workbench` (exact interactive/fish-tank anchors)
 */
export function loadBuildingGlb(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        configureLoadedModel(model);

        let roofNode = null;
        let doorHinge = null;
        const anchors = {};

        model.traverse((obj) => {
          const n = (obj.name || '').toLowerCase();
          if (!roofNode && (n === 'roof_cutaway' || n.includes('roof_cutaway'))) {
            roofNode = obj;
          }
          if (!doorHinge && (n === 'door_hinge' || n.includes('door_hinge'))) {
            doorHinge = obj;
          }
          if (n === 'anchor_aquarium') anchors.aquarium = obj;
          if (n === 'anchor_bed') anchors.bed = obj;
          if (n === 'anchor_workbench') anchors.workbench = obj;
        });

        // Clone cutaway materials so roof fades independently without side effects
        const cutawayMaterials = [];
        if (roofNode) {
          const seen = new Map();
          roofNode.traverse((child) => {
            if (!child.isMesh || !child.material) return;
            const orig = child.material;
            if (!seen.has(orig)) {
              const cloned = orig.clone();
              seen.set(orig, cloned);
              cutawayMaterials.push(cloned);
            }
            child.material = seen.get(orig);
          });
        }

        resolve({
          model,
          roofNode,
          cutawayMaterials,
          doorHinge,
          anchors,
        });
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Loads a GPU-instanceable Coastal Tree GLB (`tree_pine.glb`, `tree_fir.glb`, `tree_alder.glb`)
 * containing `Tree_Wood` and `Tree_Foliage` meshes, and injects gentle coastal wind sway
 * synchronized with `meadowUniforms` onto the foliage canopy material!
 */
export function loadTreeGlb(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        let woodMesh = null;
        let foliageMesh = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          if (!obj.isMesh) return;
          const n = (obj.name || '').toLowerCase();
          if (n.includes('foliage') || n.includes('leaf') || n.includes('canopy')) {
            foliageMesh = obj;
          } else if (n.includes('wood') || n.includes('trunk') || n.includes('bark')) {
            woodMesh = obj;
          } else if (!woodMesh) {
            woodMesh = obj;
          } else if (!foliageMesh) {
            foliageMesh = obj;
          }
        });

        const prepMat = (rawMat, isFoliage) => {
          const m = (rawMat ? rawMat.clone() : new THREE.MeshStandardMaterial({ color: 0xffffff }));
          if (m.isMeshStandardMaterial) {
            m.roughness = isFoliage ? 0.88 : 0.90;
            m.metalness = 0.0;
          }
          if (isFoliage) {
            m.onBeforeCompile = (shader) => {
              shader.uniforms.uTime = meadowUniforms.uTime;
              shader.uniforms.uWindDir = meadowUniforms.uWindDir;
              shader.uniforms.uWindStrength = meadowUniforms.uWindStrength;
              shader.vertexShader = shader.vertexShader
                .replace(
                  '#include <common>',
                  `#include <common>
                  uniform float uTime;
                  uniform vec2 uWindDir;
                  uniform float uWindStrength;
                  `
                )
                .replace(
                  '#include <begin_vertex>',
                  `#include <begin_vertex>
                  {
                    float tW = clamp((position.y - 0.8) * 0.35, 0.0, 1.0);
                    float tPhase = 0.0;
                    #ifdef USE_INSTANCING
                      tPhase = instanceMatrix[3][0] * 0.27 + instanceMatrix[3][2] * 0.31;
                    #endif
                    float gust = sin(uTime * 1.15 + tPhase) * 0.65 + sin(uTime * 2.4 + tPhase * 1.9 + position.x * 1.6) * 0.35;
                    float amp = 0.065 * uWindStrength * tW * tW;
                    transformed.x += uWindDir.x * gust * amp;
                    transformed.z += uWindDir.y * gust * amp;
                  }
                  `
                );
            };
            m.customProgramCacheKey = () => 'coastal_tree_foliage_sway_v1';
          }
          return m;
        };

        const bakeGeo = (mesh) => {
          if (!mesh) return null;
          const g = mesh.geometry.clone();
          g.applyMatrix4(mesh.matrixWorld);
          return g;
        };

        resolve({
          woodGeo: bakeGeo(woodMesh),
          woodMat: woodMesh ? prepMat(woodMesh.material, false) : null,
          foliageGeo: bakeGeo(foliageMesh),
          foliageMat: foliageMesh ? prepMat(foliageMesh.material, true) : null,
        });
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Loads a scenic backdrop environment GLB (`backdrop_mountain.glb`) configured with
 * matte Ghibli shading, atmospheric fog support, and zero shadow-pass overhead.
 */
export function loadEnvironmentGlb(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.castShadow = false;
          obj.receiveShadow = false;
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              if (m.isMeshStandardMaterial) {
                m.roughness = 0.92;
                m.metalness = 0.0;
                m.fog = true;
                // Gentle painted gouache sky-bounce so backlit north mountain cliffs stay warm & readable
                if (m.map) {
                  m.emissiveMap = m.map;
                  m.emissive = new THREE.Color('#dfe8d8');
                  m.emissiveIntensity = 0.26;
                }
              }
            }
          }
        });
        resolve({ model });
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Loads a GPU-instanceable sculpted Ghibli Coastal Rock or Mossy Islet GLB
 * (`rock_shore_wide.glb`, `rock_cliff_crag.glb`, `islet_plateau.glb`, `islet_peak.glb`)
 * and hooks our real-time lagoon waterline darkening + underwater caustics shader onto
 * its baked gouache material (fully compatible with InstancedMesh!).
 */
export function loadLagoonRockGlb(url, { causticsScale = 0.85, wetline = true } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        let targetMesh = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          if (!targetMesh && obj.isMesh) targetMesh = obj;
        });
        if (!targetMesh) {
          reject(new Error(`No mesh found in lagoon rock GLB: ${url}`));
          return;
        }
        const geo = targetMesh.geometry.clone();
        geo.applyMatrix4(targetMesh.matrixWorld);
        const rawMat = Array.isArray(targetMesh.material) ? targetMesh.material[0] : targetMesh.material;
        const mat = rawMat ? rawMat.clone() : new THREE.MeshStandardMaterial({ color: 0xffffff });
        if (mat.isMeshStandardMaterial) {
          mat.roughness = 0.90;
          mat.metalness = 0.0;
          mat.fog = true;
        }
        applyLagoonMaterialShader(mat, {
          causticsScale,
          wetline,
          isEmergentIslet: false,
        });
        resolve({ geo, mat });
      },
      undefined,
      (err) => reject(err)
    );
  });
}
