import { useImperativeHandle, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { REDUCED, detachAll } from '../lib/motion';

const SVG_NS = 'http://www.w3.org/2000/svg';
const rand = (a, b) => a + Math.random() * (b - a);

// Light levels of the painted layers for each stage.
const TONES = {
  intro: { base: 1, glow: 0.34, glowScale: 1, red: 0 },
  confirm: { base: 0.5, glow: 0.16, glowScale: 0.85, red: 0 },
  transition: { base: 0.12, glow: 0.08, glowScale: 0.6, red: 0 },
  loading: { base: 0.22, glow: 0.1, glowScale: 0.8, red: 0.6 },
  video: { base: 0, glow: 0, glowScale: 0.8, red: 0 },
  ending: { base: 0.55, glow: 0.9, glowScale: 1.1, red: 0 },
};

const TRAIL_COLORS = {
  warm: { core: '#fff3e8', glow: '#f2b2a4' },
  red: { core: '#ffe0e0', glow: '#e3333f' },
};

/**
 * The painted layers around the WebGL canvas: a near-black base with a faint
 * warm centre, the expanding central glow, sweeping light trails, a red
 * streaming-screen tint, plus vignette, film grain and flash above it all.
 */
export default function Atmosphere({ ref }) {
  const base = useRef(null);
  const glow = useRef(null);
  const red = useRef(null);
  const trails = useRef(null);
  const flash = useRef(null);
  const live = useRef(new Set());

  // Tracks running animations so unmounting can kill them; finished ones are pruned.
  const keep = (anim) => {
    live.current.forEach((a) => a.progress() === 1 && live.current.delete(a));
    live.current.add(anim);
    return anim;
  };

  useLayoutEffect(() => {
    gsap.set([base.current, glow.current, red.current, flash.current], { autoAlpha: 0 });
    const anims = live.current;
    const trailLayer = trails.current;
    return () => {
      anims.forEach((a) => a.kill());
      anims.clear();
      trailLayer.replaceChildren();
    };
  }, []);

  useImperativeHandle(
    ref,
    () =>
      detachAll({
      /** Glide the painted layers to a stage's light level. */
      tone(name, duration = 2) {
        const t = TONES[name];
        if (!t) return;
        const v = { duration, ease: 'sine.inOut', overwrite: 'auto' };
        keep(gsap.to(base.current, { autoAlpha: t.base, ...v }));
        keep(gsap.to(glow.current, { autoAlpha: t.glow, scale: t.glowScale, ...v }));
        keep(gsap.to(red.current, { autoAlpha: t.red, ...v }));
      },

      /** A soft light that swells from the centre and settles. */
      bloom() {
        const tl = gsap
          .timeline()
          .fromTo(glow.current, { scale: 0.25, autoAlpha: 0.2 }, { scale: 1.9, autoAlpha: 1, duration: 0.9, ease: 'expo.out', overwrite: 'auto' })
          .to(glow.current, { scale: 1.2, autoAlpha: 0.18, duration: 2.2, ease: 'sine.inOut' });
        if (!REDUCED) {
          tl.fromTo(flash.current, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 0.75, scale: 1, duration: 0.18, ease: 'power2.out' }, 0).to(
            flash.current,
            { autoAlpha: 0, scale: 1.6, duration: 1.4, ease: 'power2.out' },
            0.18,
          );
        }
        keep(tl);
      },

      /** Comet-like light trails sweeping across the frame. */
      sweep({ count = 2, duration = 1.6, tone = 'warm', from = 'left', stagger = 0.22, opacity = 1 } = {}) {
        if (REDUCED) return;
        const svg = trails.current;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const colors = TRAIL_COLORS[tone];
        for (let k = 0; k < count; k++) {
          const dir = from === 'right' ? -1 : 1;
          const x0 = dir > 0 ? -W * 0.1 : W * 1.1;
          const x1 = dir > 0 ? W * 1.1 : -W * 0.1;
          const y0 = H * rand(0.15, 0.85);
          const y1 = Math.min(H * 0.95, Math.max(H * 0.05, y0 + H * rand(-0.4, 0.4)));
          const d = `M${x0} ${y0} C ${W * (dir > 0 ? 0.35 : 0.65)} ${y0 + H * rand(-0.35, 0.35)}, ${W * (dir > 0 ? 0.65 : 0.35)} ${
            y1 + H * rand(-0.35, 0.35)
          }, ${x1} ${y1}`;

          const g = document.createElementNS(SVG_NS, 'g');
          g.style.opacity = opacity;
          const layers = [
            { width: 7, color: colors.glow, alpha: 0.16, seg: 0.42 },
            { width: 2.2, color: colors.glow, alpha: 0.45, seg: 0.26 },
            { width: 1, color: colors.core, alpha: 0.95, seg: 0.12 },
          ].map((L) => {
            const p = document.createElementNS(SVG_NS, 'path');
            p.setAttribute('d', d);
            p.setAttribute('stroke', L.color);
            p.setAttribute('stroke-width', L.width);
            p.setAttribute('stroke-opacity', L.alpha);
            g.appendChild(p);
            return { p, seg: L.seg };
          });
          svg.appendChild(g);

          const len = layers[0].p.getTotalLength();
          const longest = len * layers[0].seg;
          layers.forEach((L) => {
            L.len = len * L.seg;
            L.p.style.strokeDasharray = `${L.len} ${len + longest + L.len}`;
          });
          // Drive one "front" position so every layer's head stays aligned.
          const front = { f: 0 };
          const render = () => layers.forEach((L) => (L.p.style.strokeDashoffset = L.len - front.f));
          render();
          keep(
            gsap.to(front, {
              f: len + longest,
              duration: duration * rand(0.9, 1.15),
              delay: k * stagger,
              ease: 'power1.inOut',
              onUpdate: render,
              onComplete: () => g.remove(),
            }),
          );
        }
      },
    }),
    [],
  );

  return (
    <>
      <div className="atmo atmo-base" ref={base} aria-hidden="true" />
      <div className="atmo atmo-red" ref={red} aria-hidden="true" />
      <div className="atmo atmo-glow" ref={glow} aria-hidden="true" />
      <svg className="atmo atmo-trails" ref={trails} aria-hidden="true" />
      <div className="atmo atmo-vignette" aria-hidden="true" />
      <div className="atmo atmo-grain" aria-hidden="true" />
      <div className="atmo atmo-flash" ref={flash} aria-hidden="true" />
    </>
  );
}
