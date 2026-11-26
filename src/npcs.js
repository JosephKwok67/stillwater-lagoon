import * as THREE from 'three';
import { clamp } from './noise.js';
import { getWorldElevation } from './terrain.js';

/**
 * Builds stylized chibi diorama 3D villagers strictly matching Codex's approved turnaround sheets:
 * - npc_market (渔市老板娘·阿莲): coral-red headscarf, cream blouse, teal apron, dark blue trousers
 * - npc_artisan (渔具工匠·老周): lily-pad green cap, indigo work shirt, honey-brown leather apron w/ spool pocket
 * - npc_lighthouse (灯塔守望者·海伯): peacock-blue jacket, cream knit sweater, coral scarf, grey beard, glowing lantern
 *
 * Standardized coordinate space (+Y up, +Z forward, origin at boot bottom) for seamless future Blender .glb hot-swap!
 */
function createVillagerMesh(kind) {
  const root = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xeeb58c, roughness: 0.76 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xe2836a, roughness: 0.82 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x261a12, roughness: 0.4 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x623d23, roughness: 0.86 });

  let shirtColor = 0xf2e8d5;
  let apronColor = 0x2f8a80;
  let pantsColor = 0x2e4a66;
  let hairColor = 0x5c4637;

  if (kind === 'npc_artisan') {
    shirtColor = 0x35537a;
    apronColor = 0xc87f35;
    pantsColor = 0x2c4361;
    hairColor = 0x6b6159;
  } else if (kind === 'npc_lighthouse') {
    shirtColor = 0x1e607a;
    apronColor = 0xf0e4cb;
    pantsColor = 0x4b4e54;
    hairColor = 0xd6d1c9;
  }

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.84 });
  const apronMat = new THREE.MeshStandardMaterial({ color: apronColor, roughness: 0.84 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.86 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.88 });

  // Legs & boots (origin y = 0 at boot soles!)
  for (const sx of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.24, 5, 8), pantsMat);
    leg.position.set(sx, 0.24, 0);
    leg.castShadow = true;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.095, 0.18), bootMat);
    boot.position.set(sx, 0.05, 0.03);
    boot.castShadow = true;
    bodyRoot.add(leg, boot);
  }

  // Upper body pivot (breathes & nods gently!)
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.42, 0);
  bodyRoot.add(upperBody);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.195, 0.24, 6, 12), shirtMat);
  torso.scale.set(1.12, 1.0, 0.94);
  torso.position.y = 0.21;
  torso.castShadow = true;
  upperBody.add(torso);

  if (kind === 'npc_market' || kind === 'npc_artisan') {
    // Full front apron & tie bow matching Codex's turnarounds!
    const apronFront = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.08), apronMat);
    apronFront.position.set(0, 0.1, 0.15);
    apronFront.castShadow = true;
    upperBody.add(apronFront);

    if (kind === 'npc_market') {
      const pocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.14, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x26746b, roughness: 0.86 })
      );
      pocket.position.set(0, 0.05, 0.195);
      upperBody.add(pocket);
    } else {
      // Old Zhou's side leather tool pocket with tiny wooden spool!
      const sidePocket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.1), apronMat);
      sidePocket.position.set(0.18, 0.04, 0.11);
      const spool = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.07, 8),
        new THREE.MeshStandardMaterial({ color: 0xf4e8ce, roughness: 0.8 })
      );
      spool.position.set(0.18, 0.12, 0.11);
      upperBody.add(sidePocket, spool);
    }
  } else if (kind === 'npc_lighthouse') {
    // Cream knit sweater peeking between peacock-blue jacket lapels + coral-red scarf!
    const sweater = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.06), apronMat);
    sweater.position.set(0, 0.2, 0.165);
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.84 });
    const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.036, 7, 14), scarfMat);
    scarfRing.rotation.x = Math.PI / 2;
    scarfRing.position.set(0, 0.39, 0.01);
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.03), scarfMat);
    scarfTail.position.set(0.06, 0.31, 0.18);
    scarfTail.rotation.z = -0.18;
    upperBody.add(sweater, scarfRing, scarfTail);
  }

  // Articulated arms (for friendly greeting wave & handheld lantern!)
  const makeArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.24, 0.33, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.18, 5, 8), shirtMat);
    sleeve.position.set(side * 0.02, -0.11, 0);
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.056, 8, 6), skinMat);
    hand.position.set(side * 0.02, -0.24, 0.01);
    sh.add(sleeve, hand);
    return sh;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);
  upperBody.add(armL, armR);

  // Uncle Hai's warm glowing lighthouse lantern in right hand!
  if (kind === 'npc_lighthouse') {
    const lantern = new THREE.Group();
    lantern.position.set(0.02, -0.34, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x455866, roughness: 0.55, metalness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffe8a3,
      emissive: 0xffb84d,
      emissiveIntensity: 1.5,
      roughness: 0.25,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.04, 8), frameMat);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 8), glassMat);
    glass.position.y = 0.09;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.07, 8), frameMat);
    top.position.y = 0.19;
    const pt = new THREE.PointLight(0xffcb66, 0.75, 4.5, 1.8);
    pt.position.y = 0.09;
    lantern.add(base, glass, top, pt);
    armR.add(lantern);
  }

  // Head & Iconic Hat / Headscarf Silhouette (distinct from 52° top-down view!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.47, 0);
  upperBody.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), skinMat);
  head.position.y = 0.08;
  head.castShadow = true;
  headGroup.add(head);

  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 7, 6), eyeMat);
    eye.position.set(sx * 0.062, 0.09, 0.166);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.032, 7, 5), cheekMat);
    cheek.scale.set(1.25, 0.7, 0.45);
    cheek.position.set(sx * 0.105, 0.045, 0.148);
    headGroup.add(eye, cheek);
  }

  if (kind === 'npc_market') {
    // Coral-red headscarf + low brown hair bun + bow tails
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xc84b34, roughness: 0.84 });
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.198, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), scarfMat);
    wrap.position.set(0, 0.1, -0.02);
    wrap.rotation.x = -0.22;
    wrap.castShadow = true;
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), hairMat);
    bun.position.set(0, 0.04, -0.19);
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.05), scarfMat);
    bow.position.set(0, 0.08, -0.2);
    headGroup.add(wrap, bun, bow);
  } else if (kind === 'npc_artisan') {
    // Lily-pad green flat work cap + greying hair fringes
    const capMat = new THREE.MeshStandardMaterial({ color: 0x8ebf4e, roughness: 0.84 });
    const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    capDome.scale.set(1.06, 0.78, 1.08);
    capDome.position.set(0, 0.145, 0);
    capDome.castShadow = true;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.028, 14), capMat);
    brim.position.set(0, 0.155, 0.09);
    brim.rotation.x = 0.08;
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.182, 10, 8), hairMat);
    hairBack.position.set(0, 0.08, -0.04);
    headGroup.add(capDome, brim, hairBack);
  } else if (kind === 'npc_lighthouse') {
    // Navy sailor cap + fluffy silver-grey short beard!
    const capMat = new THREE.MeshStandardMaterial({ color: 0x3b5370, roughness: 0.84 });
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.11, 14), capMat);
    capTop.position.set(0, 0.21, -0.01);
    capTop.rotation.x = -0.1;
    capTop.castShadow = true;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.026, 0.14), capMat);
    brim.position.set(0, 0.165, 0.14);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8), hairMat);
    beard.scale.set(1.05, 0.72, 0.82);
    beard.position.set(0, -0.02, 0.065);
    headGroup.add(capTop, brim, beard);
  }

  return { root, bodyRoot, upperBody, headGroup, armL, armR };
}

/**
 * Spawns all 3 core Lakeside Town NPCs (Ah Lian, Old Zhou, Uncle Hai) at their homes/posts!
 */
export function buildTownNpcs(scene, town) {
  const npcs = [];
  const npcColliders = [];

  const workshop = town.enterableBuildings.find((b) => b.id === 'artisan_workshop');
  const artisanPos = workshop
    ? workshop.toWorld(0.25, workshop.dims.floorY + 0.05, -0.35)
    : new THREE.Vector3(-8.4, getWorldElevation(-8.4, -23.6), -23.6);

  // Stand warmly right beside the v2.1 Fish Market Stall's open east transaction nook (100% clear of pier & promenade!)
  const marketX = -6.35;
  const marketZ = -19.25;
  const marketPos = new THREE.Vector3(marketX, town.getWalkableElevation(marketX, marketZ), marketZ);

  // Stand proudly on the dramatic v2.1 Eastern Rocky Lighthouse Cliff plateau beside the 7.8m Lighthouse!
  const lhNpcX = 19.65;
  const lhNpcZ = -14.35;
  const lhNpcPos = new THREE.Vector3(lhNpcX, town.getWalkableElevation(lhNpcX, lhNpcZ), lhNpcZ);

  const specs = [
    {
      id: 'npc_market',
      nameZh: '渔市老板娘 · 阿莲',
      shortName: '阿莲',
      roleLabel: '渔获收购与鱼讯',
      pos: marketPos,
      homeYaw: 0.18,
      buildingId: null,
    },
    {
      id: 'npc_artisan',
      nameZh: '渔具工匠 · 老周',
      shortName: '老周',
      roleLabel: '鱼竿与鱼饵工坊',
      pos: artisanPos,
      homeYaw: workshop ? workshop.rotY : 0.22,
      buildingId: 'artisan_workshop',
    },
    {
      id: 'npc_lighthouse',
      nameZh: '灯塔守望者 · 海伯',
      shortName: '海伯',
      roleLabel: '天气潮汐与巨物传说',
      pos: lhNpcPos,
      homeYaw: -0.55,
      buildingId: null,
    },
  ];

  for (const s of specs) {
    const rig = createVillagerMesh(s.id);
    rig.root.position.copy(s.pos);
    rig.root.rotation.y = s.homeYaw;
    scene.add(rig.root);

    npcColliders.push({ x: s.pos.x, z: s.pos.z, radius: 0.36 });

    npcs.push({
      ...s,
      rig,
      glbAdapter: null,
      yaw: s.homeYaw,
      talking: false,
      phase: npcs.length * 2.1,
      setTalking(v) {
        this.talking = Boolean(v);
      },
      attachGlb(adapter) {
        if (!adapter || !adapter.model) return;
        this.glbAdapter = adapter;
        this.rig.bodyRoot.visible = false;
        this.rig.root.add(adapter.model);
        // Attach a warm golden PointLight directly to Hai Bo's right-hand storm lantern wick!
        if (this.id === 'npc_lighthouse' && adapter.rig && adapter.rig.armR) {
          const lanternGlow = new THREE.PointLight(0xffcb66, 0.95, 5.2, 1.8);
          lanternGlow.position.set(-0.138, -0.467, 0.105);
          adapter.rig.armR.add(lanternGlow);
        }
      },
    });
  }

  return {
    npcs,
    npcColliders,
    getById(id) {
      return npcs.find((n) => n.id === id) || null;
    },
    attachNpcGlb(npcId, adapter) {
      const npc = npcs.find((n) => n.id === npcId);
      if (npc) npc.attachGlb(adapter);
    },
    update(dt, elapsedTime, actorPos) {
      const clampedDt = Math.min(dt, 0.05);
      for (const n of npcs) {
        const dx = actorPos ? actorPos.x - n.pos.x : 0;
        const dz = actorPos ? actorPos.z - n.pos.z : 1;
        const dist = actorPos ? Math.hypot(dx, dz) : 99;
        const near = dist < 3.6;

        // Smoothly turn to greet the player when nearby or chatting!
        const targetYaw = near || n.talking ? Math.atan2(dx, dz) : n.homeYaw;
        let diff = targetYaw - n.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        n.yaw += diff * clamp(clampedDt * 6.0, 0, 1);
        n.rig.root.rotation.y = n.yaw;

        if (n.glbAdapter) {
          n.glbAdapter.playAction(n.talking ? 'Talk' : near ? 'Wave' : 'Idle');
          n.glbAdapter.update(clampedDt);
          const breathe = Math.sin(elapsedTime * 2.2 + n.phase);
          if (n.glbAdapter.hasRig) {
            const rg = n.glbAdapter.rig;
            const k = clamp(clampedDt * 8.0, 0, 1);
            if (rg.torso) {
              rg.torso.rotation.x = THREE.MathUtils.lerp(rg.torso.rotation.x, breathe * 0.025, k);
            }
            if (rg.head) {
              const targetHX = n.talking ? Math.sin(elapsedTime * 7.2) * 0.09 : breathe * 0.03;
              const targetHY = !near ? Math.sin(elapsedTime * 0.75 + n.phase) * 0.2 : 0;
              rg.head.rotation.x = THREE.MathUtils.lerp(rg.head.rotation.x, targetHX, k);
              rg.head.rotation.y = THREE.MathUtils.lerp(rg.head.rotation.y, targetHY, k);
            }
            if (n.id === 'npc_lighthouse') {
              // Right hand gently holds & sways the glowing brass storm lantern; left hand waves!
              if (rg.armR) {
                rg.armR.rotation.x = THREE.MathUtils.lerp(rg.armR.rotation.x, -0.32 + breathe * 0.04, k);
              }
              if (rg.armL) {
                const waveL = n.talking
                  ? -0.42 + Math.sin(elapsedTime * 6.0) * 0.2
                  : near
                    ? -1.65 + Math.sin(elapsedTime * 7.2) * 0.3
                    : breathe * 0.04;
                rg.armL.rotation.x = THREE.MathUtils.lerp(rg.armL.rotation.x, waveL, k);
              }
            } else {
              if (rg.armR) {
                const waveR = n.talking
                  ? -0.45 + Math.sin(elapsedTime * 6.8) * 0.22
                  : near
                    ? -1.85 + Math.sin(elapsedTime * 7.8) * 0.32
                    : breathe * 0.04;
                rg.armR.rotation.x = THREE.MathUtils.lerp(rg.armR.rotation.x, waveR, k);
              }
              if (rg.armL) {
                rg.armL.rotation.x = THREE.MathUtils.lerp(rg.armL.rotation.x, -breathe * 0.04, k);
              }
            }
          } else if (!n.glbAdapter.hasAnimations) {
            n.glbAdapter.model.position.y = Math.sin(elapsedTime * 2.4 + n.phase) * 0.01;
          }
          continue;
        }

        // Lively breathing, talking nod, and friendly welcoming wave!
        const breathe = Math.sin(elapsedTime * 2.2 + n.phase);
        n.rig.bodyRoot.position.y = breathe * 0.012;
        n.rig.headGroup.rotation.x = n.talking ? Math.sin(elapsedTime * 7.5) * 0.08 : breathe * 0.025;
        n.rig.headGroup.rotation.y = !near ? Math.sin(elapsedTime * 0.7 + n.phase) * 0.18 : 0;

        if (n.id === 'npc_lighthouse') {
          // Hold lantern gently forward with right hand
          n.rig.armR.rotation.x = THREE.MathUtils.lerp(n.rig.armR.rotation.x, -0.58, clampedDt * 8);
          n.rig.armL.rotation.x = n.talking
            ? -0.45 + Math.sin(elapsedTime * 6.0) * 0.22
            : near
              ? -1.75 + Math.sin(elapsedTime * 7.2) * 0.35
              : breathe * 0.04;
        } else {
          const waveR = n.talking
            ? -0.48 + Math.sin(elapsedTime * 6.8) * 0.22
            : near
              ? -2.15 + Math.sin(elapsedTime * 8.2) * 0.32
              : breathe * 0.04;
          n.rig.armR.rotation.x = THREE.MathUtils.lerp(n.rig.armR.rotation.x, waveR, clampedDt * 8);
          n.rig.armR.rotation.z = THREE.MathUtils.lerp(n.rig.armR.rotation.z, near && !n.talking ? -0.32 : -0.1, clampedDt * 8);
          n.rig.armL.rotation.x = THREE.MathUtils.lerp(n.rig.armL.rotation.x, -breathe * 0.04, clampedDt * 8);
        }
      }
    },
  };
}
