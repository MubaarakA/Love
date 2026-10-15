// Picks particle budgets up front from cheap device hints. The engine also
// watches real frame times and steps down further if the device struggles.
const PRESETS = {
  high: {
    dust: 720,
    bokeh: 40,
    petalPool: 260,
    ambientPetals: 44,
    burstPetals: 70,
    sparkPool: 1600,
    maxDpr: 2,
  },
  mid: {
    dust: 420,
    bokeh: 28,
    petalPool: 170,
    ambientPetals: 30,
    burstPetals: 44,
    sparkPool: 1000,
    maxDpr: 1.75,
  },
  low: {
    dust: 220,
    bokeh: 16,
    petalPool: 100,
    ambientPetals: 18,
    burstPetals: 24,
    sparkPool: 560,
    maxDpr: 1.25,
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
    antialias: true, // MSAA is cheap on tile-based mobile GPUs; DPR is the real cost
    dpr: Math.min(window.devicePixelRatio || 1, preset.maxDpr),
  };
}
