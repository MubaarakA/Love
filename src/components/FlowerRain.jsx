import { useId, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { REDUCED, detachAll } from '../lib/motion';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Deep rose, blush, ivory, peach, plum — a bouquet, not candy.
const PALETTE = [
  ['#ffd6dd', '#e46f8a'],
  ['#fff3ea', '#e9b7a4'],
  ['#f9c6d0', '#b8475f'],
  ['#ffe2c4', '#e0956b'],
  ['#f6d3ee', '#a65a95'],
  ['#ffeef2', '#f08aa2'],
  ['#ffd0c2', '#c4505a'],
];

const PETAL = 'M0 0 C -9 -7, -11 -24, 0 -34 C 11 -24, 9 -7, 0 0 Z';

function Flower({ petals, colors, gid }) {
  const step = 360 / petals;
  return (
    <svg viewBox="-40 -40 80 80" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="0" cy="0" r="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </radialGradient>
      </defs>
      {Array.from({ length: petals }, (_, i) => (
        <path key={i} d={PETAL} fill={`url(#${gid})`} transform={`rotate(${i * step})`} />
      ))}
      {Array.from({ length: petals }, (_, i) => (
        <path key={`i${i}`} d={PETAL} fill={`url(#${gid})`} opacity="0.7" transform={`rotate(${i * step + step / 2}) scale(0.62)`} />
      ))}
      <circle r="4.6" fill="#ffe7b0" />
      <circle r="2.2" fill="#f5b85c" />
    </svg>
  );
}

/**
 * A layer of blossoms. `flood(x, y)` throws them all out from a point (the
 * opened gift) so they arc up and rain down across the screen; `drizzle()`
 * keeps a few falling gently afterwards; `stop()` lets them fade away.
 */
export default function FlowerRain({ ref }) {
  const root = useRef(null);
  const live = useRef([]);
  const drizzling = useRef(false);
  const uid = useId().replace(/:/g, '');

  const flowers = useMemo(() => {
    const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;
    const n = REDUCED ? 10 : small ? 22 : 38;
    return Array.from({ length: n }, (_, i) => ({ id: i, petals: Math.random() < 0.5 ? 5 : 6, colors: pick(PALETTE), size: rand(22, small ? 50 : 68) }));
  }, []);

  const els = () => [...root.current.children];
  const keep = (a) => {
    live.current.push(a);
    return a;
  };
  const killAll = () => {
    live.current.forEach((a) => a.kill());
    live.current = [];
  };

  useLayoutEffect(() => {
    gsap.set(els(), { autoAlpha: 0 });
    return killAll;
  }, []);

  // One gentle fall from above the screen, then (while drizzling) again.
  const fall = (el, delay) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dur = rand(9, 15) * (REDUCED ? 1.4 : 1);
    gsap.set(el, { x: rand(-0.05, 1) * W, y: -80, rotation: rand(0, 360), scale: rand(0.6, 1), autoAlpha: 0 });
    keep(
      gsap
        .timeline({ delay, onComplete: () => (drizzling.current ? fall(el, rand(0, 4)) : gsap.set(el, { autoAlpha: 0 })) })
        .to(el, { autoAlpha: rand(0.55, 0.9), duration: 1.2 }, 0)
        .to(el, { y: H + 80, duration: dur, ease: 'none' }, 0)
        .to(el, { x: `+=${rand(-0.18, 0.18) * W}`, rotation: `+=${rand(-200, 200)}`, duration: dur, ease: 'sine.inOut' }, 0),
    );
  };

  useImperativeHandle(
    ref,
    () =>
      detachAll({
      flood(ox, oy) {
        killAll();
        const W = window.innerWidth;
        const H = window.innerHeight;
        els().forEach((el, i) => {
          const tx = rand(-0.05, 1.05) * W;
          const peak = rand(-0.08, 0.45) * H;
          const out = rand(0.9, 1.5);
          const down = rand(3.5, 7);
          gsap.set(el, { x: ox, y: oy, rotation: rand(0, 360), scale: 0.15, autoAlpha: 1 });
          keep(
            gsap
              .timeline({ delay: i * 0.018, onComplete: () => drizzling.current && i % 3 === 0 && fall(el, rand(0, 6)) })
              // burst out of the box…
              .to(el, { x: tx, y: peak, scale: rand(0.7, 1.15), rotation: `+=${rand(-260, 260)}`, duration: out, ease: 'power3.out' })
              // …then rain down past the bottom of the screen
              .to(el, { y: H + 90, duration: down, ease: 'power1.in' })
              .to(el, { x: `+=${rand(-0.15, 0.15) * W}`, rotation: `+=${rand(-240, 240)}`, duration: down, ease: 'sine.inOut' }, '<')
              .to(el, { autoAlpha: 0, duration: 0.6 }, '>-0.6'),
          );
        });
      },
      /** Keep a few blossoms falling softly. */
      drizzle(on = true) {
        if (on === drizzling.current) return;
        drizzling.current = on;
        if (!on) return;
        els()
          .filter((_, i) => i % 3 === 1)
          .forEach((el) => !gsap.isTweening(el) && fall(el, rand(0, 8)));
      },
      stop(fade = 1) {
        drizzling.current = false;
        killAll();
        keep(gsap.to(els(), { autoAlpha: 0, duration: fade, ease: 'power1.out' }));
      },
    }),
    [],
  );

  return (
    <div className="flower-rain" ref={root} aria-hidden="true">
      {flowers.map((f) => (
        <div className="rain-flower" key={f.id} style={{ width: f.size, height: f.size }}>
          <Flower petals={f.petals} colors={f.colors} gid={`fl${uid}${f.id}`} />
        </div>
      ))}
    </div>
  );
}
