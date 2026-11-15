export function createSounds() {
  let ctx = null;
  let masterGain = null;
  // All sounds are procedural: oscillators and filtered noise, no files.
const MASTER_GAIN = 0.5;
  let muted = false;
  let noiseBuffer = null;

  function getContext() {
    if (!ctx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          ctx = new AudioContext();
          masterGain = ctx.createGain();
          masterGain.gain.value = MASTER_GAIN;
          masterGain.connect(ctx.destination);
          
          // Build 1s white noise buffer
          const bufferSize = ctx.sampleRate;
          noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
          }
        }
      } catch (e) {}
    }
    return ctx;
  }

  function makeNoiseSource() {
    if (!noiseBuffer || !ctx) return null;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    return src;
  }

  function safePlay(fn) {
    if (muted) return;
    try {
      const c = getContext();
      if (c) {
        if (c.state === 'suspended') c.resume();
        fn(c);
      }
    } catch (e) {}
  }

  return {
    unlock() {
      safePlay(() => {});
    },
    
    shoot(kind) {
      safePlay(c => {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        const filter = c.createBiquadFilter();
        const noise = makeNoiseSource();
        const noiseGain = c.createGain();
        
        if (!noise) return;
        
        let freq = 150, dur = 0.15, cutoff = 1200;
        if (kind === 'pistol') { freq = 220; dur = 0.1; cutoff = 1800; }
        else if (kind === 'smg') { freq = 200; dur = 0.08; cutoff = 2200; }
        else if (kind === 'sniper') { freq = 80; dur = 0.4; cutoff = 800; }
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + dur);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, t);
        
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        
        osc.connect(filter); filter.connect(gain); gain.connect(masterGain);
        noise.connect(filter); noise.connect(noiseGain); noiseGain.connect(masterGain);
        
        osc.start(t); osc.stop(t + dur);
        noise.start(t); noise.stop(t + dur);
      });
    },

    dry() {
      safePlay(c => {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + 0.03);
      });
    },

    hit(kill) {
      safePlay(c => {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        if (kill) osc.frequency.setValueAtTime(1800, t + 0.05);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (kill ? 0.15 : 0.08));
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + (kill ? 0.15 : 0.08));
      });
    },

    reload() {
      safePlay(c => {
        const t = c.currentTime;
        [0, 0.12].forEach(offset => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(400, t + offset);
          gain.gain.setValueAtTime(0.15, t + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.04);
          osc.connect(gain); gain.connect(masterGain);
          osc.start(t + offset); osc.stop(t + offset + 0.04);
        });
      });
    },

    hurt() {
      safePlay(c => {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + 0.3);
      });
    },

    plantTick(n) {
      safePlay(c => {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400 + n * 100, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(t); osc.stop(t + 0.08);
      });
    },

    explode() {
      safePlay(c => {
        const t = c.currentTime;
        const noise = makeNoiseSource();
        const filter = c.createBiquadFilter();
        const gain = c.createGain();
        const osc = c.createOscillator();
        if (!noise) return;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(30, t + 1.5);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 1.5);
        noise.connect(filter); filter.connect(gain); gain.connect(masterGain);
        osc.connect(gain);
        noise.start(t); noise.stop(t + 1.5);
        osc.start(t); osc.stop(t + 1.5);
      });
    },

    smoke() {
      safePlay(c => {
        const t = c.currentTime;
        const noise = makeNoiseSource();
        const filter = c.createBiquadFilter();
        const gain = c.createGain();
        if (!noise) return;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, t);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        noise.connect(filter); filter.connect(gain); gain.connect(masterGain);
        noise.start(t); noise.stop(t + 1.5);
      });
    },

    win() {
      safePlay(c => {
        const t = c.currentTime;
        [0, 0.15, 0.3].forEach((offset, idx) => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime([523.25, 659.25, 783.99][idx], t + offset);
          gain.gain.setValueAtTime(0.2, t + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.3);
          osc.connect(gain); gain.connect(masterGain);
          osc.start(t + offset); osc.stop(t + offset + 0.3);
        });
      });
    },

    lose() {
      safePlay(c => {
        const t = c.currentTime;
        [0, 0.2].forEach((offset, idx) => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime([300, 200][idx], t + offset);
          gain.gain.setValueAtTime(0.2, t + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.3);
          osc.connect(gain); gain.connect(masterGain);
          osc.start(t + offset); osc.stop(t + offset + 0.3);
        });
      });
    },

    buy() {
      safePlay(c => {
        const t = c.currentTime;
        [0, 0.08].forEach((offset, idx) => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime([880, 1760][idx], t + offset);
          gain.gain.setValueAtTime(0.15, t + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);
          osc.connect(gain); gain.connect(masterGain);
          osc.start(t + offset); osc.stop(t + offset + 0.1);
        });
      });
    },

    step() {
      safePlay(c => {
        const t = c.currentTime;
        const noise = makeNoiseSource();
        const filter = c.createBiquadFilter();
        const gain = c.createGain();
        if (!noise) return;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(filter); filter.connect(gain); gain.connect(masterGain);
        noise.start(t); noise.stop(t + 0.05);
      });
    },

    toggleMute() {
      muted = !muted;
      if (masterGain && ctx) {
        masterGain.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime);
      }
      return muted;
    }
  };
}
