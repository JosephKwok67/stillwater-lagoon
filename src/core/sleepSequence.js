import * as THREE from 'three';
import { clamp } from '../noise.js';

export const WEATHER_CYCLE = ['morning', 'sunny', 'sunset', 'overcast'];
export const WEATHER_NAMES = {
  morning: '清晨微光',
  sunny: '晴朗午后',
  sunset: '黄金日落',
  overcast: '薄雾微阴',
};

/**
 * Cozy Bed Sleeping Animation Sequence (Hop in -> Zzz breathing -> Twilight Fade -> Wake up!)
 */
export function createSleepSequence({
  camera,
  town,
  playerAvatar,
  playerController,
  atmosphere,
  gameState,
  syncWeatherUI,
  showToast,
}) {
  const sleepZzzEl = document.getElementById('sleep-zzz');
  const sleepOverlayEl = document.getElementById('sleep-overlay');
  const sleepOverlayTextEl = document.getElementById('sleep-overlay-text');

  const sleepSeq = {
    active: false,
    elapsed: 0,
    swappedWeather: false,
    startPos: new THREE.Vector3(),
    bedPos: new THREE.Vector3(),
    wakePos: new THREE.Vector3(),
    bedYaw: 0,
    nextWeather: 'morning',
    newDay: false,
  };

  const zzzProj = new THREE.Vector3();

  function start() {
    if (sleepSeq.active || !town.playerHome?.worldAnchors?.bedLie) return;
    const curIdx = WEATHER_CYCLE.indexOf(gameState.data.weather);
    const nextIdx = (curIdx + 1) % WEATHER_CYCLE.length;
    sleepSeq.nextWeather = WEATHER_CYCLE[nextIdx];
    sleepSeq.newDay = nextIdx === 0;
    sleepSeq.active = true;
    sleepSeq.elapsed = 0;
    sleepSeq.swappedWeather = false;
    sleepSeq.startPos.copy(playerController.walkerState.pos);
    sleepSeq.bedPos.copy(town.playerHome.worldAnchors.bedLie);
    sleepSeq.wakePos.copy(town.playerHome.worldAnchors.bedWake);
    sleepSeq.bedYaw = town.playerHome.rotY;

    playerController.clearKeys();
    if (sleepOverlayTextEl) {
      sleepOverlayTextEl.textContent = sleepSeq.newDay
        ? `美美睡上一觉 · 静候第 ${gameState.data.day + 1} 天的${WEATHER_NAMES[sleepSeq.nextWeather]}...`
        : `小憩片刻 · 窗外渐渐迎来「${WEATHER_NAMES[sleepSeq.nextWeather]}」...`;
    }
  }

  function update(dt, elapsedTime) {
    if (!sleepSeq.active) return false;
    sleepSeq.elapsed += dt;
    const t = sleepSeq.elapsed;

    // Stage 1: Hop smoothly onto bed
    if (t < 0.45) {
      const p = clamp(t / 0.45, 0, 1);
      const arc = Math.sin(p * Math.PI) * 0.42;
      playerAvatar.root.position.set(
        THREE.MathUtils.lerp(sleepSeq.startPos.x, sleepSeq.bedPos.x, p),
        THREE.MathUtils.lerp(sleepSeq.startPos.y, sleepSeq.bedPos.y, p) + arc,
        THREE.MathUtils.lerp(sleepSeq.startPos.z, sleepSeq.bedPos.z, p)
      );
      playerAvatar.root.rotation.y = sleepSeq.bedYaw;
      playerAvatar.updateAnimation('Board_Boat', dt, elapsedTime, { progress: p });
      return true;
    }

    // Stage 2: Peaceful sleep + Zzz + twilight curtain fade
    if (t < 2.15) {
      playerAvatar.root.position.copy(sleepSeq.bedPos);
      playerAvatar.root.rotation.y = sleepSeq.bedYaw;
      playerAvatar.updateAnimation('Sleep_Bed', dt, elapsedTime);

      if (sleepZzzEl) {
        zzzProj.set(sleepSeq.bedPos.x, sleepSeq.bedPos.y + 0.62, sleepSeq.bedPos.z - 0.15);
        zzzProj.project(camera);
        const sx = (zzzProj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-zzzProj.y * 0.5 + 0.5) * window.innerHeight;
        sleepZzzEl.style.left = `${sx.toFixed(1)}px`;
        sleepZzzEl.style.top = `${sy.toFixed(1)}px`;
        sleepZzzEl.classList.remove('hidden');
      }

      if (t >= 0.85 && t < 1.8) {
        sleepOverlayEl?.classList.remove('hidden');
        requestAnimationFrame(() => sleepOverlayEl?.classList.add('visible'));
      }

      if (t >= 1.38 && !sleepSeq.swappedWeather) {
        sleepSeq.swappedWeather = true;
        atmosphere.applyPreset(sleepSeq.nextWeather);
        syncWeatherUI(sleepSeq.nextWeather);
        gameState.setWeather(sleepSeq.nextWeather, sleepSeq.newDay);
      }

      if (t >= 1.78) {
        sleepOverlayEl?.classList.remove('visible');
      }
      return true;
    }

    // Stage 3: Hop out of bed onto rug
    sleepZzzEl?.classList.add('hidden');
    if (t < 2.62) {
      const p = clamp((t - 2.15) / 0.47, 0, 1);
      const arc = Math.sin(p * Math.PI) * 0.36;
      playerAvatar.root.position.set(
        THREE.MathUtils.lerp(sleepSeq.bedPos.x, sleepSeq.wakePos.x, p),
        THREE.MathUtils.lerp(sleepSeq.bedPos.y, sleepSeq.wakePos.y, p) + arc,
        THREE.MathUtils.lerp(sleepSeq.bedPos.z, sleepSeq.wakePos.z, p)
      );
      playerAvatar.root.rotation.y = sleepSeq.bedYaw + Math.PI * 0.35;
      playerAvatar.updateAnimation('Board_Boat', dt, elapsedTime, { progress: p });
      return true;
    }

    sleepSeq.active = false;
    sleepOverlayEl?.classList.add('hidden');
    playerController.walkerState.pos.copy(sleepSeq.wakePos);
    playerController.walkerState.yaw = sleepSeq.bedYaw + Math.PI * 0.35;
    playerAvatar.root.position.copy(sleepSeq.wakePos);
    showToast({
      text: sleepSeq.newDay
        ? `精神饱满！迎来了第 ${gameState.data.day} 天的${WEATHER_NAMES[sleepSeq.nextWeather]}，渔市高价鱼也刷新啦！`
        : `小憩醒来，窗外已是「${WEATHER_NAMES[sleepSeq.nextWeather]}」时分`,
      portrait: 'player',
      mood: 'happy',
    });
    return false;
  }

  return {
    start,
    update,
    isActive: () => sleepSeq.active,
  };
}
