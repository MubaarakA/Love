import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { soft } from '../lib/motion';
import { LOADING } from '../timing';
import { HER_NAME, HER_NICKNAME, MEMORY_PHOTOS } from '../config';

const MESSAGES = [`Preparing your memories, ${HER_NAME}…`, 'Gathering the little moments…', 'Some memories never fade.'];
// Enough posters to fill the rail on wide screens, whatever the photo count.
const RAIL = Array.from({ length: Math.max(10, MEMORY_PHOTOS.length * 2) }, (_, i) => MEMORY_PHOTOS[i % MEMORY_PHOTOS.length]).filter(Boolean);
const hideBroken = (e) => (e.currentTarget.style.display = 'none');
const R = 26;
const C = 2 * Math.PI * R;

/**
 * An original streaming-style loading screen. One progress value drives the
 * line, the ring and the ARIA value, so it only ever moves forward. At the
 * end the line collapses into a slit of light that opens onto the video.
 */
export default function Loader({ engineRef, atmoRef, onDone }) {
  const root = useRef(null);

  useLayoutEffect(() => {
    const engine = engineRef.current;
    const atmo = atmoRef.current;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const [line, head, arc, bar] = [q('.ld-line')[0], q('.ld-head')[0], q('.ld-arc')[0], root.current];
      const msgs = q('.ld-msg');
      const D = LOADING.progress;
      const slot = D / MESSAGES.length;
      const prog = { v: 0 };

      gsap.set(msgs, { autoAlpha: 0 });
      gsap.set(arc, { strokeDasharray: C, strokeDashoffset: C });
      gsap.set(line, { scaleX: 0, transformOrigin: '0% 50%' });
      gsap.set(q('.ld-slit'), { autoAlpha: 0 });
      gsap.set([q('.ld-card'), q('.ld-titlecard > *')], { autoAlpha: 0 });

      let lastPct = -1;
      const render = () => {
        const v = prog.v;
        gsap.set(line, { scaleX: v });
        gsap.set(head, { x: v * line.offsetWidth, autoAlpha: v > 0 && v < 1 ? 1 : 0 });
        arc.style.strokeDashoffset = C * (1 - v);
        const pct = Math.round(v * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          bar.setAttribute('aria-valuenow', pct);
        }
      };

      const tl = gsap.timeline({ onComplete: onDone });
      tl.call(
        () => {
          engine?.setMood('loading', { duration: 1.6 });
          atmo?.tone('loading', 1.4);
        },
        null,
        0,
      )
        .fromTo(q('.ld-ring'), soft({ autoAlpha: 0, scale: 0.85 }), soft({ autoAlpha: 1, scale: 1, duration: 0.9, ease: 'power3.out' }), 0)
        .fromTo(q('.ld-track'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0)
        // Streaming-style title card and a slow rail of memory posters.
        .fromTo(q('.ld-titlecard > *'), soft({ autoAlpha: 0, y: 8 }), soft({ autoAlpha: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.2 }), 0.15)
        .fromTo(q('.ld-card'), soft({ autoAlpha: 0, y: 24 }), soft({ autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.07 }), 0.35)
        .fromTo(q('.ld-rail-track'), { xPercent: 0 }, soft({ xPercent: -14, duration: D + 1.2, ease: 'none' }), 0)
        .to(prog, { v: 1, duration: D, ease: 'power1.inOut', onUpdate: render }, 0)
        .call(() => atmo?.sweep({ count: 1, duration: 1.8, tone: 'red', opacity: 0.7 }), null, 0.5)
        .call(() => atmo?.sweep({ count: 1, duration: 1.8, tone: 'warm', from: 'right', opacity: 0.6 }), null, 2.6);

      msgs.forEach((m, i) => {
        const at = 0.2 + i * slot;
        tl.fromTo(m, soft({ autoAlpha: 0, y: 8, filter: 'blur(8px)' }), soft({ autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' }), at);
        if (i < msgs.length - 1) {
          tl.to(m, soft({ autoAlpha: 0, y: -6, filter: 'blur(6px)', duration: 0.5, ease: 'power2.in' }), at + slot - 0.55);
          tl.call(() => engine?.pulse('red'), null, at + slot - 0.7);
        }
      });

      // The reveal: everything drains into a vertical slit of light that opens up.
      tl.to([q('.ld-ring'), msgs, q('.ld-track'), q('.ld-titlecard'), q('.ld-rail')], { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, D)
        .set(line, { transformOrigin: '50% 50%' }, D)
        .to(line, { scaleX: 0, duration: 0.45, ease: 'power3.in' }, D)
        .fromTo(q('.ld-slit'), { autoAlpha: 1, scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: 'power3.out' }, D + 0.35)
        .to(q('.ld-slit'), { scaleX: 80, autoAlpha: 0, duration: LOADING.reveal - 0.35, ease: 'power2.in' }, D + 0.6);
    }, root);
    return () => ctx.revert();
  }, [engineRef, atmoRef, onDone]);

  return (
    <section
      className="stage ld"
      ref={root}
      role="progressbar"
      aria-label="Loading your memories"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div className="ld-titlecard">
        <p className="ld-eyebrow">A memory film for</p>
        <p className="ld-name">{HER_NICKNAME}</p>
      </div>
      <div className="ld-center">
        <svg className="ld-ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle className="ld-ring-track" cx="32" cy="32" r={R} />
          <circle className="ld-arc" cx="32" cy="32" r={R} transform="rotate(-90 32 32)" />
        </svg>
        <div className="ld-msgs" aria-live="polite">
          {MESSAGES.map((m) => (
            <p className="ld-msg" key={m}>
              {m}
            </p>
          ))}
        </div>
      </div>
      <div className="ld-track" aria-hidden="true">
        <div className="ld-line" />
        <div className="ld-head" />
      </div>
      <div className="ld-rail" aria-hidden="true">
        <div className="ld-rail-track">
          {RAIL.map((p, i) => (
            <figure className="ld-card" key={i}>
              <img src={p.src} alt="" decoding="async" onError={hideBroken} />
            </figure>
          ))}
        </div>
      </div>
      <div className="ld-slit" aria-hidden="true" />
    </section>
  );
}
