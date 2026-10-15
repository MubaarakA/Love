// A cinematic score, synthesised live with the Web Audio API — no audio files.
//
// Layers:
//   bed      slow string-like pad (detuned sawtooths through a lowpass filter)
//            on the classic "epic" progression Dm – B♭ – F – C
//   shimmer  soft bell tones picked from the chord, high and reverberant
//   pulse    a heartbeat (lub-dub) that turns into accelerating low drums
//   riser    filtered noise + a rising tone that builds into a big moment
//   impact   sub drop + noise burst + a swelling chord stab
// Everything runs through a generated reverb for a large, filmic space.
//
// Browsers only allow audio after a user gesture, so nothing is created
// until unlock() is called from one. cue(stage) then shapes the music.

import { TRANSITION, LOADING } from '../timing';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);

const PROGRESSION = [
  [38, 50, 57, 62, 65], // D minor
  [34, 46, 53, 58, 62], // B♭ major
  [41, 53, 57, 60, 65], // F major
  [36, 48, 55, 60, 64], // C major
];
const BAR = 4.8; // seconds per chord — slow and spacious
const BEAT = BAR / 8;
const LOOKAHEAD = 0.25;

export function createScore() {
  let ctx = null;
  let master, dry, wet, bedGain, bedFilter, noiseBuf;
  let timer = 0;
  let muted = false;
  let events = [];
  let bedOn = false;
  let nextBar = 0;
  let barIndex = 0;
  let nextBeat = 0;
  let nextPulse = 0;
  let chord = PROGRESSION[0];
  const p = { shimmer: 0, pulse: 0, mode: 'heart', from: 1, to: 1, t0: 0, t1: 0 };

  // ---- setup --------------------------------------------------------------

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    dry = ctx.createGain();
    dry.connect(master);

    // Generated impulse response: stereo noise with a long exponential tail.
    const len = Math.floor(ctx.sampleRate * 4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    wet = ctx.createGain();
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.55;
    wet.connect(reverb).connect(wetOut).connect(master);

    bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.value = 500;
    bedFilter.Q.value = 0.6;
    bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    bedFilter.connect(bedGain);
    bedGain.connect(dry);
    const bedSend = ctx.createGain();
    bedSend.gain.value = 0.6;
    bedGain.connect(bedSend).connect(wet);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const n = noiseBuf.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

    timer = window.setInterval(tick, 50);
    document.addEventListener('visibilitychange', onVisibility);
    return true;
  }

  const now = () => ctx.currentTime;

  /** Ramp an AudioParam from wherever it is right now. */
  function ramp(param, value, dur, exp = false) {
    const t = now();
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
    }
    if (exp) param.exponentialRampToValueAtTime(Math.max(value, 0.0001), t + Math.max(0.03, dur));
    else param.linearRampToValueAtTime(value, t + Math.max(0.03, dur));
  }

  /** Run fn at `delay` seconds from now, on the audio clock. */
  function at(delay, fn) {
    events.push({ t: now() + delay, fn });
  }

  function onVisibility() {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  }

  // ---- scheduler ----------------------------------------------------------

  function tick() {
    const horizon = now() + LOOKAHEAD;
    if (events.length) {
      const due = events.filter((e) => e.t <= horizon);
      events = events.filter((e) => e.t > horizon);
      due.sort((a, b) => a.t - b.t).forEach((e) => e.fn(Math.max(e.t, now())));
    }
    if (bedOn) {
      while (nextBar < horizon) {
        chord = PROGRESSION[barIndex++ % PROGRESSION.length];
        playChord(nextBar, chord);
        nextBar += BAR;
      }
      while (nextBeat < horizon) {
        if (p.shimmer > 0 && Math.random() < 0.25 + p.shimmer * 0.5) {
          const note = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + (Math.random() < 0.3 ? 36 : 24);
          bell(nextBeat, note, 0.035 + p.shimmer * 0.05);
        }
        nextBeat += BEAT;
      }
    }
    if (p.pulse > 0.001) {
      while (nextPulse < horizon) {
        pulse(nextPulse);
        nextPulse += pulseInterval(nextPulse);
      }
    } else {
      nextPulse = horizon;
    }
  }

  function pulseInterval(t) {
    if (t <= p.t0) return p.from;
    if (t >= p.t1) return p.to;
    const k = (t - p.t0) / (p.t1 - p.t0);
    return p.from + (p.to - p.from) * k * k; // accelerates toward the end
  }

  function startBed() {
    if (bedOn) return;
    bedOn = true;
    nextBar = now() + 0.05;
    nextBeat = nextBar;
    barIndex = 0;
  }

  // ---- instruments --------------------------------------------------------

  function voice(type, freq, detune, t, gainNode) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(gainNode);
    o.start(t);
    o.stop(t + BAR + 3);
  }

  function playChord(t, notes) {
    notes.forEach((m, i) => {
      const g = ctx.createGain();
      const peak = i === 0 ? 0.07 : 0.045;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 1.8);
      g.gain.setValueAtTime(peak, t + BAR - 0.2);
      g.gain.linearRampToValueAtTime(0, t + BAR + 2.4);
      g.connect(bedFilter);
      if (i === 0) voice('triangle', mtof(m), 0, t, g);
      voice('sawtooth', mtof(m), -7, t, g);
      voice('sawtooth', mtof(m), 7, t, g);
    });
  }

  function bell(t, midi, vel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.6, 0.6);
    g.connect(pan);
    pan.connect(wet);
    const send = ctx.createGain();
    send.gain.value = 0.35;
    pan.connect(send).connect(dry);
    [
      [1, 1],
      [2.01, 0.22],
      [3, 0.06],
    ].forEach(([mult, amp]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = mtof(midi) * mult;
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 3.5);
    });
  }

  function drum(t, vel) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.32);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(g);
    g.connect(dry);
    const send = ctx.createGain();
    send.gain.value = 0.25;
    g.connect(send).connect(wet);
    o.start(t);
    o.stop(t + 0.8);
    // a soft skin "slap" on top
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(lp).connect(ng).connect(dry);
    n.start(t, Math.random());
    n.stop(t + 0.1);
  }

  function pulse(t) {
    const v = p.pulse;
    if (p.mode === 'heart') {
      drum(t, 0.55 * v);
      drum(t + 0.27, 0.33 * v);
    } else {
      drum(t, (0.6 + Math.random() * 0.15) * v);
    }
  }

  /** Builds tension for `dur` seconds, peaking exactly at the end. */
  function riser(t, dur, size = 1) {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(220, t);
    bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * size, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.08);
    n.connect(bp).connect(g);
    g.connect(dry);
    g.connect(wet);
    n.start(t);
    n.stop(t + dur + 0.1);

    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(45), t);
    o.frequency.exponentialRampToValueAtTime(mtof(74), t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.05 * size, t + dur);
    og.gain.linearRampToValueAtTime(0, t + dur + 0.08);
    o.connect(lp).connect(og);
    og.connect(wet);
    og.connect(dry);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  /** The big moment: sub drop, a burst of air and a swelling chord. */
  function impact(t, size = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(72, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.85 * size, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    o.connect(g).connect(dry);
    o.start(t);
    o.stop(t + 3.1);

    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 2);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4 * size, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    n.connect(lp).connect(ng);
    ng.connect(dry);
    ng.connect(wet);
    n.start(t);
    n.stop(t + 2.3);

    // Resolve to F major — the bright, uplifting chord of the progression.
    [53, 57, 60, 65, 69].forEach((m) => {
      const so = ctx.createOscillator();
      so.type = 'sawtooth';
      so.frequency.value = mtof(m);
      so.detune.value = rand(-6, 6);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
      f.frequency.exponentialRampToValueAtTime(700, t + 4);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, t);
      sg.gain.linearRampToValueAtTime(0.035 * size, t + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      so.connect(f).connect(sg);
      sg.connect(wet);
      sg.connect(dry);
      so.start(t);
      so.stop(t + 4.6);
    });
  }

  function setPulse(level, mode, from, to = from, over = 0) {
    if (p.pulse <= 0.001 && level > 0) nextPulse = now() + 0.1;
    p.pulse = level;
    p.mode = mode;
    p.from = from;
    p.to = to;
    p.t0 = now();
    p.t1 = now() + over;
  }

  function silence(fade) {
    events = [];
    p.pulse = 0;
    p.shimmer = 0;
    ramp(bedGain.gain, 0, fade);
    at(fade + 0.2, () => (bedOn = false));
  }

  // ---- the story ----------------------------------------------------------

  /** A rising bell arpeggio — a little sparkle of sound. */
  function chime(t, size = 1) {
    [65, 69, 72, 77, 81, 84].forEach((m, i) => bell(t + i * 0.07, m + 12, 0.06 * size));
  }

  const CUES = {
    gift() {
      events = [];
      startBed();
      ramp(bedGain.gain, 0.45, 4);
      ramp(bedFilter.frequency, 380, 3, true);
      p.shimmer = 0.15;
      setPulse(0, 'heart', 1);
    },
    intro() {
      startBed();
      ramp(bedGain.gain, 0.7, 4);
      ramp(bedFilter.frequency, 420, 4, true);
      p.shimmer = 0.25;
      setPulse(0, 'heart', 1);
    },
    confirm() {
      startBed();
      ramp(bedGain.gain, 1, 3);
      ramp(bedFilter.frequency, 850, 3, true);
      p.shimmer = 0.4;
      setPulse(0.6, 'heart', 1.05); // a slow heartbeat: anticipation
    },
    transition() {
      const B = TRANSITION.burst;
      startBed();
      ramp(bedGain.gain, 1.15, B);
      ramp(bedFilter.frequency, 2600, B, true);
      setPulse(0.8, 'heart', 0.8, 0.45, B);
      at(0.1, (t) => riser(t, B - 0.1));
      at(B, (t) => {
        impact(t, 1);
        setPulse(0, 'heart', 1);
        p.shimmer = 0.75;
        ramp(bedFilter.frequency, 1700, 2.5, true);
      });
    },
    loading() {
      const D = LOADING.progress;
      startBed();
      p.shimmer = 0.55;
      ramp(bedGain.gain, 1.35, D);
      ramp(bedFilter.frequency, 4200, D, true);
      setPulse(0.75, 'drum', 0.7, 0.24, D); // drums gather pace toward the reveal
      at(D - 2.1, (t) => riser(t, 2.45, 1.2));
      at(D + 0.35, (t) => {
        impact(t, 1.15); // the slit of light opens onto the video
        silence(1.4);
      });
    },
    video() {
      if (bedOn || p.pulse > 0) silence(0.6);
    },
    gifts() {
      CUES.ending();
    },
    ending() {
      events = [];
      setPulse(0, 'heart', 1);
      startBed();
      ramp(bedGain.gain, 0.65, 6);
      ramp(bedFilter.frequency, 650, 4, true);
      p.shimmer = 0.35;
    },
  };

  return {
    get unlocked() {
      return !!ctx;
    },
    /** Must be called from inside a user gesture (click / key press). */
    unlock() {
      if (!ctx && !init()) return false;
      ctx.resume();
      if (!muted) ramp(master.gain, 0.9, 1.2);
      return true;
    },
    cue(stage) {
      if (ctx) CUES[stage]?.();
    },
    /** The gift box bursts open: a soft impact, a rising chime and a swell. */
    open() {
      if (!ctx) return;
      const t = now() + 0.02;
      impact(t, 0.7);
      chime(t + 0.1, 1.2);
      startBed();
      ramp(bedGain.gain, 0.95, 1.5);
      ramp(bedFilter.frequency, 1500, 1.2, true);
      p.shimmer = 0.7;
      at(3, () => {
        ramp(bedFilter.frequency, 520, 5, true);
        p.shimmer = 0.3;
      });
    },
    chime() {
      if (ctx) chime(now() + 0.02);
    },
    get muted() {
      return muted;
    },
    setMuted(on) {
      muted = on;
      if (ctx) ramp(master.gain, on ? 0 : 0.9, 0.5);
    },
    dispose() {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      ctx?.close();
      ctx = null;
    },
  };
}
