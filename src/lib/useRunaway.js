import { useCallback, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

const EASES = ['expo.out', 'power3.out', 'circ.out', 'power4.inOut'];
const rand = (a, b) => a + Math.random() * (b - a);

function safeInsets() {
  const cs = getComputedStyle(document.documentElement);
  const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
  return { top: px('--sat'), right: px('--sar'), bottom: px('--sab'), left: px('--sal') };
}

function viewport() {
  const vv = window.visualViewport;
  return {
    w: Math.min(document.documentElement.clientWidth || window.innerWidth, vv ? vv.width : Infinity),
    h: Math.min(window.innerHeight, vv ? vv.height : Infinity),
  };
}

const overlapArea = (a, b) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * Choose a new top-left for a w×h box that stays fully inside the viewport
 * (with breathing room), never overlaps an obstacle, and isn't under the
 * pointer. Distance from `from` is deliberately varied — sometimes a hop,
 * sometimes a flight across the screen.
 */
export function pickSpot({ w, h, from, pointer, obstacles, mode = 'any' }) {
  const vp = viewport();
  const inset = safeInsets();
  const m = Math.max(14, Math.min(vp.w, vp.h) * 0.04);
  const minX = m + inset.left;
  const minY = m + inset.top;
  const maxX = Math.max(minX, vp.w - w - m - inset.right);
  const maxY = Math.max(minY, vp.h - h - m - inset.bottom);
  const diag = Math.hypot(vp.w, vp.h);

  const ranges = {
    short: [70, 170],
    medium: [170, Math.max(220, diag * 0.42)],
    far: [diag * 0.42, Infinity],
    any: [0, Infinity],
  };
  const [lo, hi] = ranges[mode] || ranges.any;

  const score = (x, y) => {
    const r = { left: x, top: y, right: x + w, bottom: y + h };
    let overlap = 0;
    for (const o of obstacles) overlap += overlapArea(r, o);
    if (pointer) {
      const pad = 48;
      if (pointer.x > x - pad && pointer.x < x + w + pad && pointer.y > y - pad && pointer.y < y + h + pad) overlap += 1e6;
    }
    return overlap;
  };

  let best = null;
  let fallback = null;
  for (let i = 0; i < 120; i++) {
    const x = rand(minX, maxX);
    const y = rand(minY, maxY);
    const overlap = score(x, y);
    const dist = from ? Math.hypot(x - from.x, y - from.y) : lo;
    if (overlap === 0) {
      if (dist >= lo && dist <= hi && (!from || dist > 40)) return { x, y };
      // Valid but outside the wanted range: keep whichever is closest to it.
      const miss = dist < lo ? lo - dist : dist - hi;
      if (!best || miss < best.miss) best = { x, y, miss };
    } else if (!fallback || overlap < fallback.overlap) {
      fallback = { x, y, overlap };
    }
  }
  if (best) return { x: best.x, y: best.y };

  // Tiny screens: scan a grid for the least-covered spot.
  const steps = 14;
  for (let gy = 0; gy <= steps; gy++) {
    for (let gx = 0; gx <= steps; gx++) {
      const x = minX + ((maxX - minX) * gx) / steps;
      const y = minY + ((maxY - minY) * gy) / steps;
      const overlap = score(x, y);
      if (!fallback || overlap < fallback.overlap) fallback = { x, y, overlap };
    }
  }
  return { x: fallback.x, y: fallback.y };
}

/**
 * A fixed-position button that sits in a layout slot until someone reaches
 * for it, then hops to safe random spots. Returns `escape` so the component
 * can wire it to whatever events make sense for the input type.
 */
export function useRunaway({ buttonRef, slotRef, getObstacles, onEscape }) {
  const st = useRef({ escaped: false, x: 0, y: 0, lockUntil: 0, attempts: 0, enabled: true });

  const obstacles = useCallback(() => {
    const pad = 14;
    return getObstacles()
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad }));
  }, [getObstacles]);

  const isSafe = useCallback(
    (x, y, w, h) => {
      const vp = viewport();
      if (x < 4 || y < 4 || x + w > vp.w - 4 || y + h > vp.h - 4) return false;
      const r = { left: x, top: y, right: x + w, bottom: y + h };
      return obstacles().every((o) => overlapArea(r, o) === 0);
    },
    [obstacles],
  );

  // Before the first escape the button mirrors its slot; afterwards, any
  // layout change (rotation, resize, new UI) re-checks it's still safe.
  const sync = useCallback(() => {
    const btn = buttonRef.current;
    const slot = slotRef.current;
    if (!btn || !slot) return;
    const s = st.current;
    const w = btn.offsetWidth;
    const h = btn.offsetHeight;
    if (!s.escaped) {
      slot.style.width = `${w}px`;
      slot.style.height = `${h}px`;
      const r = slot.getBoundingClientRect();
      s.x = r.left;
      s.y = r.top;
      gsap.set(btn, { x: s.x, y: s.y });
      return;
    }
    if (!isSafe(s.x, s.y, w, h)) {
      const spot = pickSpot({ w, h, from: s, obstacles: obstacles() });
      s.x = spot.x;
      s.y = spot.y;
      gsap.to(btn, { x: s.x, y: s.y, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    }
  }, [buttonRef, slotRef, isSafe, obstacles]);

  useLayoutEffect(() => {
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(document.documentElement);
    if (slotRef.current) ro.observe(slotRef.current.parentElement);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.addEventListener('layoutchange', sync);
    window.visualViewport?.addEventListener('resize', sync);
    document.fonts?.ready.then(sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.removeEventListener('layoutchange', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, [sync, slotRef]);

  const escape = useCallback(
    (pointer) => {
      const s = st.current;
      const btn = buttonRef.current;
      const now = performance.now();
      if (!btn || !s.enabled || now < s.lockUntil) return;
      s.lockUntil = now + 260;

      const w = btn.offsetWidth;
      const h = btn.offsetHeight;
      const from = { x: gsap.getProperty(btn, 'x'), y: gsap.getProperty(btn, 'y') };
      const r = Math.random();
      const mode = r < 0.3 ? 'short' : r < 0.68 ? 'medium' : 'far';
      const spot = pickSpot({ w, h, from, pointer, obstacles: obstacles(), mode });

      // First escape: close the gap it left so YES settles into the centre.
      if (!s.escaped && slotRef.current) {
        const slot = slotRef.current;
        const gap = parseFloat(getComputedStyle(slot.parentElement).columnGap) || 0;
        gsap.to(slot, {
          width: 0,
          marginLeft: -gap,
          duration: 0.7,
          ease: 'power3.inOut',
          onComplete: () => window.dispatchEvent(new Event('layoutchange')),
        });
      }
      s.escaped = true;
      s.x = spot.x;
      s.y = spot.y;
      s.attempts += 1;

      const dist = Math.hypot(spot.x - from.x, spot.y - from.y);
      const duration = Math.min(0.95, 0.42 + dist / 1600);
      gsap.to(btn, { x: spot.x, y: spot.y, duration, ease: EASES[(Math.random() * EASES.length) | 0], overwrite: 'auto' });
      gsap.fromTo(btn, { rotation: rand(6, 12) * (Math.random() < 0.5 ? -1 : 1) }, { rotation: 0, duration: duration + 0.5, ease: 'elastic.out(1, 0.45)' });
      gsap.fromTo(btn, { scaleX: 0.86, scaleY: 1.1 }, { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.35)' });

      onEscape?.(s.attempts, { x: from.x + w / 2, y: from.y + h / 2 });
    },
    [buttonRef, slotRef, obstacles, onEscape],
  );

  const disable = useCallback(() => {
    st.current.enabled = false;
  }, []);

  return { escape, disable, sync };
}
