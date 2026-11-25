/**
 * Lightweight Pub/Sub Event Bus decoupling Three.js 3D world modules from gameplay & UI layers.
 */
export function createEventBus() {
  const listeners = new Map();

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => this.off(event, handler);
    },

    off(event, handler) {
      const set = listeners.get(event);
      if (set) set.delete(handler);
    },

    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const handler of Array.from(set)) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err);
        }
      }
    },
  };
}
