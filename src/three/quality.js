// Picks particle budgets up front from cheap device hints. The engine also
// watches real frame times and steps down further if the device struggles.
const PRESETS = {
  high: {
    dust: 900,
    bokeh: 64,
    petalPool: 760,
    ambientPetals: 80,
    burstPetals: 320,
    convergePetals: 90,
    heartPool: 240,
    ambientHearts: 7,
    burstHearts: 64,
    roses: 6,
    burstRoses: 4,
    sparkPool: 1400,
    maxDpr: 2,
    antialias: true,
  },
  mid: {
    dust: 520,
    bokeh: 42,
    petalPool: 460,
    ambientPetals: 50,
    burstPetals: 190,
    convergePetals: 60,
    heartPool: 150,
    ambientHearts: 5,
    burstHearts: 40,
    roses: 4,
    burstRoses: 3,
    sparkPool: 900,
    maxDpr: 1.75,
    antialias: true,
  },
  low: {
    dust: 240,
    bokeh: 24,
    petalPool: 240,
    ambientPetals: 28,
    burstPetals: 90,
    convergePetals: 34,
    heartPool: 80,
    ambientHearts: 3,
    burstHearts: 22,
    roses: 3,
    burstRoses: 2,
    sparkPool: 480,
    maxDpr: 1.25,
    antialias: true, // MSAA is cheap on tile-based mobile GPUs; DPR is the real cost
  },
};

export function detectQuality() {
  const mm = (q) => window.matchMedia?.(q).matches ?? false;
  const coarse = mm('(pointer: coarse)');
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const reduced = mm('(prefers-reduced-motion: reduce)');
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;

  let tier = 'high';
  if (coarse || small) tier = 'mid';
  if (cores <= 4 || memory <= 2) tier = coarse || small ? 'low' : 'mid';
  if (reduced) tier = 'low';

  const preset = PRESETS[tier];
  return {
    tier,
    mobile: coarse || small,
    reduced,
    ...preset,
    dpr: Math.min(window.devicePixelRatio || 1, preset.maxDpr),
  };
}
