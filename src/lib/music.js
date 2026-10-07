// A tiny generative music box: soft pad chords under a wandering bell melody,
// all synthesised with Web Audio so there are no audio files to load. The
// AudioContext is only created from a user gesture (the sound toggle).

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Fmaj7 → Em7 → Dm7 → Cmaj7, voiced low for the pad.
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const BEAT = 0.5; // seconds
const BAR = 8; // beats per chord

export function createMusic() {
  let ctx = null;
  let master = null;
  let bus = null;
  let timer = 0;
  let step = 0;
  let next = 0;
  let playing = false;

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    // Dry bus plus a soft filtered echo for space.
    bus = ctx.createGain();
    bus.connect(master);
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    bus.connect(delay);
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(wet).connect(master);
    return true;
  }

  function bell(time, midi, vel = 0.11) {
    const f = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 2.4);
    g.connect(bus);
    [
      [1, 1],
      [2, 0.18],
      [3.01, 0.05],
    ].forEach(([mult, amp]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(time);
      o.stop(time + 2.5);
    });
  }

  function pad(time, notes, dur) {
    notes.forEach((m, i) => {
      const o = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = mtof(m);
      o.detune.value = (i % 2 ? 1 : -1) * 4;
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.028, time + 1.4);
      g.gain.setValueAtTime(0.028, time + dur - 1.2);
      g.gain.linearRampToValueAtTime(0, time + dur + 0.6);
      o.connect(lp).connect(g).connect(master);
      o.start(time);
      o.stop(time + dur + 0.7);
    });
  }

  function schedule() {
    while (next < ctx.currentTime + 0.35) {
      const beat = step % BAR;
      const chord = CHORDS[Math.floor(step / BAR) % CHORDS.length];
      if (beat === 0) pad(next, chord, BAR * BEAT);
      // A gentle arpeggio that sometimes rests and sometimes wanders up.
      const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
      if (Math.random() < (beat % 2 ? 0.55 : 0.85)) {
        const lift = Math.random() < 0.25 ? 24 : 12;
        bell(next, chord[pattern[beat]] + lift, beat === 0 ? 0.13 : 0.09);
      }
      next += BEAT;
      step++;
    }
  }

  return {
    get playing() {
      return playing;
    },
    async start() {
      if (!ctx && !init()) return;
      await ctx.resume();
      playing = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.75, ctx.currentTime, 0.6);
      if (!timer) {
        next = ctx.currentTime + 0.1;
        timer = window.setInterval(schedule, 100);
        schedule();
      }
    },
    stop() {
      if (!ctx) return;
      playing = false;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      window.clearInterval(timer);
      timer = 0;
    },
    /** A rising shimmer for the moment she says yes. */
    chime() {
      if (!ctx || !playing) return;
      const t0 = ctx.currentTime + 0.05;
      [72, 76, 79, 83, 84, 88, 91, 96].forEach((m, i) => bell(t0 + i * 0.075, m, 0.1));
      [60, 64, 67, 71].forEach((m) => bell(t0 + 1.45, m + 12, 0.08));
    },
    dispose() {
      window.clearInterval(timer);
      timer = 0;
      if (ctx) ctx.close();
      ctx = null;
    },
  };
}
