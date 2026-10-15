import gsap from 'gsap';

// Respect prefers-reduced-motion: keep the fades and the pacing, drop the
// movement (translation, scale, blur, rotation) from text animations.
export const REDUCED =
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

const MOTION_KEYS = ['x', 'y', 'xPercent', 'yPercent', 'scale', 'rotation', 'rotationX', 'filter', 'letterSpacing'];

/** Strips movement from a GSAP vars object when the visitor prefers reduced motion. */
export function soft(vars) {
  if (!REDUCED) return vars;
  const out = { ...vars };
  MOTION_KEYS.forEach((k) => delete out[k]);
  return out;
}

/**
 * Runs fn outside whichever gsap.context() is active. Shared layers (the 3D
 * scene, atmosphere, flowers, photos) are driven from other components'
 * timeline callbacks, and GSAP records animations created in a callback into
 * that component's context — reverting them when it unmounts. Detaching keeps
 * those animations alive.
 */
export function detached(fn) {
  const active = gsap.context();
  if (!active) return fn();
  let result;
  active.ignore(() => {
    result = fn();
  });
  return result;
}

/** Wraps every method of an imperative API with detached(). */
export const detachAll = (api) =>
  Object.fromEntries(Object.entries(api).map(([k, f]) => [k, (...args) => detached(() => f(...args))]));
