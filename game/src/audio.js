// Sound, synthesized with WebAudio only — no audio files. Engine hum follows car
// speed, a two-tone siren follows the nearest police car, gunshots and punches are
// short noise bursts, pickups and UI are sine blips. Everything starts on the
// first user gesture (the Start button); M toggles mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
      // Shared 1s white-noise buffer for gunshots, punches and skids.
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Engine: sawtooth through a lowpass, gain driven by speed each frame.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: square wave alternating 720/960 Hz.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    /** Call from a user gesture (Start click) so the context is allowed to run. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.6;
      return muted;
    },
    isMuted() { return muted; },
    /** Per-frame: speed 0..1 while driving (0 on foot), siren 0..1 by police proximity. */
    update(dt, speedNorm, sirenLevel) {
      if (!ctx) return;
      if (engineGain) {
        const target = muted ? 0 : speedNorm * 0.09;
        engineGain.gain.value += (target - engineGain.gain.value) * Math.min(1, dt * 8);
        engineOsc.frequency.value = 50 + speedNorm * 130;
      }
      if (sirenGain) {
        sirenTimer += dt;
        if (sirenTimer > 0.42) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.value = sirenHigh ? 960 : 720;
        }
        const target = muted ? 0 : sirenLevel * 0.035;
        sirenGain.gain.value += (target - sirenGain.gain.value) * Math.min(1, dt * 4);
      }
    },
    gunshot() { noise(0.16, 0.5, 3200); },
    punch() { noise(0.09, 0.35, 700); },
    crash(strength) { noise(0.25, Math.min(0.6, 0.2 + strength * 0.5), 900); },
    pickup() { blip(880, 0.12, 'sine', 0.3); blip(1320, 0.18, 'sine', 0.25, 0.08); },
    mission() { blip(523, 0.14, 'triangle', 0.3); blip(659, 0.14, 'triangle', 0.3, 0.12); blip(784, 0.24, 'triangle', 0.3, 0.24); },
    click() { blip(660, 0.06, 'sine', 0.2); },
    busted() { blip(392, 0.3, 'sawtooth', 0.2); blip(311, 0.45, 'sawtooth', 0.2, 0.28); },
    wasted() { blip(220, 0.5, 'sawtooth', 0.25); blip(165, 0.7, 'sawtooth', 0.25, 0.4); },
  };
}
