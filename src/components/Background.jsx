import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { INTRO, YES } from '../timing';

/**
 * Painterly DOM layers around the WebGL canvas: the gradient sky and soft
 * aurora below it, lens flare / vignette / flash above it, and the cream
 * veil that lifts at the start.
 */
export default function Background({ phase }) {
  const root = useRef(null);
  const fx = useRef(null);
  const curtain = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(curtain.current, { autoAlpha: 0, duration: INTRO.curtain, delay: 0.15, ease: 'power2.inOut' });
      gsap.from('.aurora', { autoAlpha: 0, scale: 1.15, duration: 4.5, ease: 'sine.out', stagger: 0.5 });
      gsap.to('.aurora-a', { xPercent: 7, yPercent: -5, duration: 19, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.aurora-b', { xPercent: -9, yPercent: 6, duration: 23, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }, root);

    // Light-touch parallax for the flare and a soft glow that trails the cursor.
    const fctx = gsap.context(() => {
      gsap.fromTo('.flare', { autoAlpha: 0 }, { autoAlpha: 1, duration: 4, delay: 1.4, ease: 'sine.inOut' });
      const flare = fx.current.querySelector('.flare-rig');
      const glow = root.current.querySelector('.cursor-glow');
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      const fxTo = gsap.quickTo(flare, 'x', { duration: 1.4, ease: 'power3.out' });
      const fyTo = gsap.quickTo(flare, 'y', { duration: 1.4, ease: 'power3.out' });
      const gx = gsap.quickTo(glow, 'x', { duration: 0.6, ease: 'power3.out' });
      const gy = gsap.quickTo(glow, 'y', { duration: 0.6, ease: 'power3.out' });
      let shown = false;
      const move = (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        fxTo(-nx * 46);
        fyTo(-ny * 32);
        if (fine) {
          gx(e.clientX);
          gy(e.clientY);
          if (!shown) {
            shown = true;
            gsap.set(glow, { x: e.clientX, y: e.clientY });
            gsap.to(glow, { autoAlpha: 1, duration: 1 });
          }
        }
      };
      window.addEventListener('pointermove', move, { passive: true });
      return () => window.removeEventListener('pointermove', move);
    }, fx);

    return () => {
      ctx.revert();
      fctx.revert();
    };
  }, []);

  useLayoutEffect(() => {
    if (phase !== 'yes') return undefined;
    const ctx = gsap.context(() => {
      const B = YES.burst;
      gsap
        .timeline()
        .to('.bg-glow', { autoAlpha: 1, duration: B, ease: 'power2.in' }, 0)
        .to('.flare', { scale: 1.25, duration: B, ease: 'power2.in' }, 0)
        .fromTo('.flash', { autoAlpha: 0, scale: 0.35 }, { autoAlpha: 1, scale: 1, duration: 0.14, ease: 'power2.out' }, B)
        .to('.flash', { autoAlpha: 0, scale: 1.7, duration: 1.5, ease: 'power2.out' }, B + 0.14)
        .fromTo('.sweep', { xPercent: -160, autoAlpha: 1 }, { xPercent: 260, duration: 1.6, ease: 'power2.inOut' }, B - 0.1)
        .to('.bg-glow', { opacity: 0.7, duration: 3, ease: 'sine.inOut' }, B + 0.6)
        .to('.flare', { scale: 1, duration: 3, ease: 'sine.inOut' }, B + 0.6);
    });
    return () => ctx.revert();
  }, [phase]);

  return (
    <>
      <div className="bg" ref={root} aria-hidden="true">
        <div className="bg-base" />
        <div className="aurora aurora-a" />
        <div className="aurora aurora-b" />
        <div className="bg-glow" />
        <div className="cursor-glow" />
      </div>

      <div className="fx" ref={fx} aria-hidden="true">
        <div className="flare-rig">
          <div className="flare">
            <i className="flare-sun" />
            <i className="flare-ghost g1" />
            <i className="flare-ghost g2" />
            <i className="flare-ghost g3" />
          </div>
        </div>
        <div className="vignette" />
        <div className="sweep" />
        <div className="flash" />
      </div>

      <div className="curtain" ref={curtain} aria-hidden="true" />
    </>
  );
}
