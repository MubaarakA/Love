import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { soft, REDUCED } from '../lib/motion';
import { HER_NICKNAME } from '../config';

/**
 * The very first screen: a glowing gift box in the dark. Tapping it is the
 * visitor's first interaction (which also lets the music start). The lid
 * flies off, a beam of light rises, and — via onOpen — flowers and her
 * photos burst out of it.
 */
export default function GiftBox({ delay = 0.8, onOpen, onDone }) {
  const root = useRef(null);
  const box = useRef(null);
  const ctx = useRef(null);
  const idle = useRef([]);
  const locked = useRef(true);

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {
      const q = gsap.utils.selector(root);
      gsap.set([q('.gift-eyebrow'), q('.gift-name'), q('.gift-hint'), box.current], { autoAlpha: 0 });
      gsap.set(q('.gift-beam'), { autoAlpha: 0, scaleY: 0 });

      gsap
        .timeline({ delay })
        .fromTo(q('.gift-eyebrow'), soft({ autoAlpha: 0, letterSpacing: '0.7em' }), soft({ autoAlpha: 1, letterSpacing: '0.42em', duration: 1.8, ease: 'power2.out' }))
        .fromTo(
          q('.gift-name'),
          soft({ autoAlpha: 0, y: 12, filter: 'blur(12px)' }),
          soft({ autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.8, ease: 'power3.out', clearProps: 'filter' }),
          '-=1.2',
        )
        .fromTo(
          box.current,
          soft({ autoAlpha: 0, y: 70, scale: 0.85 }),
          soft({ autoAlpha: 1, y: 0, scale: 1, duration: 1.6, ease: REDUCED ? 'power1.out' : 'back.out(1.6)' }),
          '-=1.1',
        )
        .call(() => {
          locked.current = false;
          if (REDUCED) return;
          // Idle: float, breathe, and every few seconds a little wiggle that says "open me".
          idle.current = [
            gsap.to(box.current, { y: -10, duration: 2.2, ease: 'sine.inOut', repeat: -1, yoyo: true }),
            gsap.to(q('.gift-glow'), { scale: 1.18, opacity: 1, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true }),
            gsap
              .timeline({ repeat: -1, repeatDelay: 2.6, delay: 1.5 })
              .to(q('.gift-shape'), { rotation: -5, duration: 0.09, ease: 'power1.inOut' })
              .to(q('.gift-shape'), { rotation: 5, duration: 0.09, ease: 'power1.inOut', repeat: 3, yoyo: true })
              .to(q('.gift-shape'), { rotation: 0, duration: 0.12 }),
          ];
        })
        .fromTo(q('.gift-hint'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, '-=0.4')
        .to(q('.gift-hint'), { opacity: 0.45, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }, root);
    return () => {
      idle.current.forEach((a) => a.kill());
      ctx.current.revert();
    };
  }, [delay]);

  const open = () => {
    if (locked.current) return;
    locked.current = true;
    idle.current.forEach((a) => a.kill());
    ctx.current.add(() => {
      const q = gsap.utils.selector(root);
      const r = q('.gift-lid')[0].getBoundingClientRect();
      const origin = { x: r.left + r.width / 2, y: r.top + r.height };
      gsap
        .timeline({ onComplete: onDone })
        .to(q('.gift-hint'), { autoAlpha: 0, duration: 0.3, overwrite: true }, 0)
        .to(q('.gift-shape'), { rotation: 0, duration: 0.1, overwrite: true }, 0)
        // squash… and pop
        .to(q('.gift-shape'), soft({ scaleY: 0.86, scaleX: 1.08, duration: 0.16, ease: 'power2.in', transformOrigin: '50% 100%' }), 0)
        .to(q('.gift-shape'), soft({ scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }), 0.16)
        .to(q('.gift-lid'), soft({ y: '-55vh', x: '12vw', rotation: -38, duration: 1.1, ease: 'power2.out' }), 0.18)
        .to(q('.gift-lid'), { autoAlpha: 0, duration: 0.5 }, 0.75)
        .fromTo(q('.gift-beam'), { autoAlpha: 0, scaleY: 0 }, { autoAlpha: 1, scaleY: 1, duration: 0.5, ease: 'power3.out' }, 0.2)
        .call(() => onOpen?.(origin), null, 0.24)
        .to([q('.gift-eyebrow'), q('.gift-name')], soft({ autoAlpha: 0, y: -14, filter: 'blur(8px)', duration: 0.9, ease: 'power2.in' }), 0.3)
        .to(q('.gift-beam'), { autoAlpha: 0, scaleX: 2.4, duration: 1.4, ease: 'power2.in' }, 1)
        .to(box.current, soft({ autoAlpha: 0, y: 30, scale: 0.9, duration: 1, ease: 'power2.in' }), 1.1);
    });
  };

  return (
    <section className="stage gift">
      <div className="gift-inner" ref={root}>
        <p className="gift-eyebrow">A gift for</p>
        <h1 className="gift-name">{HER_NICKNAME}</h1>
        <button type="button" className="gift-box" ref={box} onClick={open} aria-label="Open your gift">
          <span className="gift-glow" aria-hidden="true" />
          <span className="gift-beam" aria-hidden="true" />
          <span className="gift-shape" aria-hidden="true">
            <span className="gift-body">
              <span className="gift-ribbon" />
            </span>
            <span className="gift-lid">
              <span className="gift-ribbon" />
              <svg className="gift-bow" viewBox="0 0 120 60">
                <defs>
                  <linearGradient id="bowGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ffe9b8" />
                    <stop offset="0.5" stopColor="#e2b062" />
                    <stop offset="1" stopColor="#a8742e" />
                  </linearGradient>
                </defs>
                <path d="M60 46 C 40 10, 6 8, 10 32 C 13 50, 44 50, 60 46 Z" fill="url(#bowGold)" />
                <path d="M60 46 C 80 10, 114 8, 110 32 C 107 50, 76 50, 60 46 Z" fill="url(#bowGold)" />
                <path d="M60 46 L 44 60 M60 46 L 76 60" stroke="#c99447" strokeWidth="6" strokeLinecap="round" />
                <circle cx="60" cy="45" r="8" fill="#f3cf86" />
              </svg>
            </span>
          </span>
        </button>
        <p className="gift-hint">Tap the gift to open it</p>
      </div>
    </section>
  );
}
