import * as three from 'three';

export function createSounds() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;

  const init = () => {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // All sounds are procedural: oscillators and filtered noise, no files.
const MASTER_GAIN = 0.5;
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);

      const len = ctx.sampleRate * 1;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {}
  };

  const playTone = (freq, type, dur, gainVal = 0.1) => {
    try {
      init(); if (!ctx || muted) return;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(gainVal, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch(e){}
  };

  const playNoise = (filterFreq, dur, gainVal = 0.2, q = 1) => {
    try {
      init(); if (!ctx || muted || !noiseBuf) return;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainVal, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(); s.stop(ctx.currentTime + dur);
    } catch(e){}
  };

  return {
    unlock() { try { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); } catch(e){} },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    shoot(kind) {
      if (kind === 'sniper') { playNoise(800, 0.4, 0.5, 3); playTone(60, 'sawtooth', 0.4, 0.3); }
      else if (kind === 'rifle') { playNoise(1500, 0.15, 0.3); playTone(120, 'square', 0.15, 0.15); }
      else { playNoise(2200, 0.1, 0.2); playTone(200, 'square', 0.1, 0.1); }
    },
    dry() { playTone(800, 'sine', 0.03, 0.05); },
    hit(kill) {
      playTone(1200, 'sine', 0.05, 0.1);
      if (kill) setTimeout(() => playTone(1800, 'sine', 0.08, 0.15), 60);
    },
    reload() { playTone(400, 'triangle', 0.05, 0.1); setTimeout(() => playTone(600, 'triangle', 0.05, 0.1), 120); },
    hurt() { playNoise(300, 0.3, 0.4, 2); playTone(80, 'sawtooth', 0.3, 0.3); },
    plantTick(n) { const k = (typeof n === 'number' ? n : 0); playTone(600 + k * 150, 'sine', 0.08, 0.1); },
    explode() { playNoise(180, 1.5, 0.8, 5); playTone(30, 'sawtooth', 1.5, 0.6); },
    win() { playTone(523.25, 'sine', 0.15, 0.1); setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 150); setTimeout(() => playTone(783.99, 'sine', 0.3, 0.15), 300); },
    lose() { playTone(300, 'sawtooth', 0.2, 0.15); setTimeout(() => playTone(200, 'sawtooth', 0.3, 0.2), 200); },
    buy() { playTone(900, 'sine', 0.06, 0.08); setTimeout(() => playTone(1200, 'sine', 0.1, 0.1), 80); },
    step() { playNoise(1000, 0.04, 0.03, 0.5); },
    impact() { playNoise(600, 0.2, 0.4, 2); },
    throw() { playNoise(1200, 0.3, 0.2, 1); }
  };
}
