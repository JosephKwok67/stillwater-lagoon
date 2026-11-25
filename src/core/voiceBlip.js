/**
 * Cozy WebAudio Synthesized "Hmm / Mumble" Voice Blips (Animal Crossing / Stardew style).
 * Zero external audio assets required; each NPC has a distinct warm vocal timbre + mute switch.
 */
const VOICE_PROFILES = {
  npc_market: { baseHz: 410, spanHz: 110, type: 'triangle', dur: 0.058, gain: 0.055 }, // 阿莲：爽朗温暖
  npc_artisan: { baseHz: 178, spanHz: 44, type: 'sine', dur: 0.068, gain: 0.068 },     // 老周：沉稳低沉
  npc_lighthouse: { baseHz: 222, spanHz: 58, type: 'triangle', dur: 0.064, gain: 0.058 }, // 海伯：慈祥略沙哑
  player: { baseHz: 330, spanHz: 75, type: 'sine', dur: 0.05, gain: 0.048 },
  dog: { baseHz: 520, spanHz: 140, type: 'triangle', dur: 0.075, gain: 0.052 },
};

export function createVoiceBlip() {
  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (muted) return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    } catch {
      return null;
    }
  }

  return {
    isMuted: () => muted,
    setMuted(val) {
      muted = Boolean(val);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },

    playBlip(speakerId = 'npc_market', charCode = 0) {
      const audio = ensureContext();
      if (!audio) return;
      const p = VOICE_PROFILES[speakerId] || VOICE_PROFILES.npc_market;
      const now = audio.currentTime;

      const osc = audio.createOscillator();
      const filter = audio.createBiquadFilter();
      const env = audio.createGain();

      // Gentle melodic pitch inflection derived from character code so speech feels alive
      const jitter = ((charCode * 37) % 100) / 100;
      const startFreq = p.baseHz + jitter * p.spanHz;
      const endFreq = speakerId === 'dog' ? startFreq * 0.72 : startFreq * (0.94 + jitter * 0.14);

      osc.type = p.type;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(80, endFreq), now + p.dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(speakerId === 'npc_artisan' ? 680 : 1250, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(p.gain, now + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);

      osc.connect(filter);
      filter.connect(env);
      env.connect(audio.destination);

      osc.start(now);
      osc.stop(now + p.dur + 0.015);
    },

    playCoinChime() {
      const audio = ensureContext();
      if (!audio) return;
      const now = audio.currentTime;
      for (const [idx, freq] of [
        [0, 660],
        [1, 880],
      ]) {
        const t0 = now + idx * 0.065;
        const osc = audio.createOscillator();
        const env = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.06, t0 + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        osc.connect(env);
        env.connect(audio.destination);
        osc.start(t0);
        osc.stop(t0 + 0.2);
      }
    },
  };
}
