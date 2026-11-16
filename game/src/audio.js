// Sable Station — sound: every effect is synthesized with WebAudio, no
// audio files. Shots differ per weapon class, and distance to the listener
// shapes volume and filtering.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer() {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  let sharedNoise = null;

  function burst({ dur = 0.12, freq = 1200, gain = 0.5, type = 'lowpass', sweepTo = null }) {
    if (!ensure() || muted) return;
    if (ctx.state === 'suspended') ctx.resume();
    sharedNoise ??= noiseBuffer();
    const src = ctx.createBufferSource();
    src.buffer = sharedNoise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(master);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  function tone({ freq = 440, dur = 0.15, gain = 0.2, type = 'sine', sweepTo = null }) {
    if (!ensure() || muted) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  const shotProfiles = {
    pick: { dur: 0.06, freq: 900, gain: 0.15 },
    pika: { dur: 0.09, freq: 1800, gain: 0.3 },
    squall: { dur: 0.08, freq: 1500, gain: 0.34 },
    longwinter: { dur: 0.13, freq: 1100, gain: 0.45 },
    aurora: { dur: 0.3, freq: 700, gain: 0.6, sweepTo: 120 },
  };

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    /** Play the sounds for one tick of simulation events. */
    playEvents(state, events, listener) {
      if (!ensure() || muted) return;
      for (const ev of events) {
        const dist = ev.x !== undefined && listener
          ? Math.hypot(ev.x - listener.x, ev.z - listener.z)
          : 0;
        const vol = Math.max(0.08, 1 - dist / 55);
        if (ev.type === 'shot') {
          const shooter = state.fighters.find((f) => f.id === ev.id);
          const profile = shotProfiles[ev.weapon] ?? shotProfiles.pika;
          const mine = shooter?.isPlayer;
          burst({
            ...profile,
            gain: profile.gain * (mine ? 1 : vol),
            freq: profile.freq * (mine ? 1 : Math.max(0.5, 1 - dist / 90)),
          });
          if (mine && ev.weapon === 'aurora') tone({ freq: 160, dur: 0.25, gain: 0.25, type: 'triangle', sweepTo: 60 });
        } else if (ev.type === 'hit') {
          const target = state.fighters.find((f) => f.id === ev.target);
          const attacker = state.fighters.find((f) => f.id === ev.attacker);
          if (attacker?.isPlayer) tone({ freq: ev.head ? 1320 : 880, dur: 0.05, gain: 0.15, type: 'square' });
          if (target?.isPlayer) burst({ dur: 0.08, freq: 500, gain: 0.3 });
        } else if (ev.type === 'kill') {
          const attacker = state.fighters.find((f) => f.id === ev.attacker);
          if (attacker?.isPlayer) {
            tone({ freq: 660, dur: 0.09, gain: 0.18, type: 'square' });
            setTimeout(() => tone({ freq: 990, dur: 0.12, gain: 0.18, type: 'square' }), 70);
          }
        } else if (ev.type === 'reload') {
          const f = state.fighters.find((t) => t.id === ev.id);
          if (f?.isPlayer) burst({ dur: 0.05, freq: 2400, gain: 0.12, type: 'highpass' });
        } else if (ev.type === 'boom') {
          if (ev.kind === 'frag') burst({ dur: 0.5, freq: 300, gain: 0.7 * vol, sweepTo: 60 });
          else tone({ freq: 2400, dur: 0.3, gain: 0.2 * vol, type: 'sine', sweepTo: 3200 });
        } else if (ev.type === 'planted') {
          tone({ freq: 1046, dur: 0.12, gain: 0.25, type: 'square' });
          setTimeout(() => tone({ freq: 1046, dur: 0.12, gain: 0.25, type: 'square' }), 160);
        } else if (ev.type === 'defused') {
          tone({ freq: 784, dur: 0.15, gain: 0.25, type: 'square' });
        } else if (ev.type === 'detonate') {
          burst({ dur: 1.1, freq: 200, gain: 0.9, sweepTo: 40 });
        } else if (ev.type === 'pickup') {
          const f = state.fighters.find((t) => t.id === ev.id);
          if (f?.isPlayer) tone({ freq: 520, dur: 0.07, gain: 0.15, type: 'square' });
        }
      }
    },
  };
}
