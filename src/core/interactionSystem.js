import * as THREE from 'three';

/**
 * Universal Proximity Interaction System.
 * Evaluates registered world interactables (docks, moored boat, house doors,
 * indoor aquarium, bed, workshop bench, future farm plots, NPCs) and displays
 * a crisp floating world-anchored [E] prompt for the highest-priority target.
 */
export function createInteractionSystem(eventBus) {
  const interactables = new Map();
  let activeTarget = null;
  const projVec = new THREE.Vector3();

  return {
    register(item) {
      // item: { id, getPosition(), radius, priority, modes, getLabel(ctx), canInteract?(ctx), onInteract(ctx) }
      interactables.set(item.id, item);
      return () => interactables.delete(item.id);
    },

    unregister(id) {
      interactables.delete(id);
      if (activeTarget && activeTarget.id === id) {
        activeTarget = null;
      }
    },

    getActive() {
      return activeTarget;
    },

    /**
     * Evaluates the closest valid interactable for the actor's current world position & mode
     */
    update(actorPos, context, camera, promptEl, promptKeyEl, promptTextEl) {
      let best = null;
      let bestScore = Infinity;

      for (const item of interactables.values()) {
        if (item.modes && !item.modes.includes(context.mode)) continue;
        if (item.canInteract && !item.canInteract(context)) continue;

        const pos = item.getPosition();
        if (!pos) continue;
        const dist = Math.hypot(actorPos.x - pos.x, actorPos.z - pos.z);
        if (dist > item.radius) continue;

        // Higher priority lowers effective score so doors/boat feel crisp and unambiguous
        const prio = item.priority ?? 0;
        const score = dist - prio * 0.45;
        if (score < bestScore) {
          bestScore = score;
          best = { item, pos, dist };
        }
      }

      activeTarget = best ? best.item : null;

      if (!promptEl) return;
      if (!best) {
        promptEl.classList.add('hidden');
        return;
      }

      const label =
        typeof best.item.getLabel === 'function' ? best.item.getLabel(context) : best.item.label || '交互';
      const keyName = best.item.key || 'E';

      if (promptKeyEl) promptKeyEl.textContent = keyName;
      if (promptTextEl) promptTextEl.textContent = label;

      // Project world anchor slightly above the object onto screen space
      projVec.set(best.pos.x, best.pos.y + (best.item.promptYOffset ?? 1.45), best.pos.z);
      projVec.project(camera);

      if (projVec.z > 1.0) {
        promptEl.classList.add('hidden');
        return;
      }

      const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
      const clampedX = Math.max(96, Math.min(window.innerWidth - 96, sx));
      const clampedY = Math.max(76, Math.min(window.innerHeight - 108, sy));

      promptEl.style.left = `${clampedX.toFixed(1)}px`;
      promptEl.style.top = `${clampedY.toFixed(1)}px`;
      promptEl.classList.remove('hidden');
    },

    trigger(context) {
      if (!activeTarget) return false;
      if (activeTarget.canInteract && !activeTarget.canInteract(context)) return false;
      activeTarget.onInteract(context);
      eventBus.emit('interaction:triggered', { id: activeTarget.id, context });
      return true;
    },
  };
}
