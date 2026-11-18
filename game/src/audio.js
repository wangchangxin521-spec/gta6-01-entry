// Sound, all synthesized with WebAudio — no audio files, no network. A tiny synth for
// blips and jingles, a two-tone siren that follows the wanted level, and an engine hum
// whose pitch follows the car's speed. Everything is silent until the first user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine hum: a low sawtooth whose pitch follows speed, always running once started.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function noise(duration, volume, lowpass) {
    if (!ctx || muted) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.25;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    /** Call from any user gesture; also safe to call every frame. */
    ensure,
    get ready() { return ctx !== null; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    click() { tone(660, 0.07, 'triangle', 0.15); },
    punch() { noise(0.12, 0.3, 900); tone(140, 0.1, 'sine', 0.25, 70); },
    crash() { noise(0.25, 0.4, 700); tone(90, 0.25, 'sine', 0.3, 45); },
    pickup() { tone(880, 0.09, 'triangle', 0.2); setTimeout(() => tone(1318, 0.12, 'triangle', 0.2), 90); },
    coin() { tone(1046, 0.08, 'sine', 0.18); setTimeout(() => tone(1568, 0.14, 'sine', 0.18), 70); },
    missionDone() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.16, 'triangle', 0.22), i * 110));
    },
    missionFail() {
      const notes = [392, 330, 262];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.2, 'sawtooth', 0.12), i * 130));
    },
    busted() {
      const notes = [330, 262, 196, 131];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.3, 'sawtooth', 0.15), i * 160));
    },
    /** Engine hum follows the car's speed, 0 when on foot. */
    engine(speed01) {
      if (!ctx || !engineGain || muted) return;
      const target = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(46 + speed01 * 130, ctx.currentTime, 0.08);
    },
    /** Two-tone police siren while any star is showing. */
    siren(on) {
      if (!ctx) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.05;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = true;
        sirenTimer = setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 960 : 720, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        sirenOsc.stop();
        sirenOsc.disconnect();
        sirenOsc = null;
        sirenGain = null;
      }
    },
  };
}
