import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { soft, REDUCED } from '../../lib/motion';
import { WISH_MESSAGE } from '../../config';

/** Make a wish: tap the flame to blow the candle out. */
export default function WishCandle({ fx }) {
  const root = useRef(null);
  const ctx = useRef(null);
  const flicker = useRef([]);
  const [lit, setLit] = useState(true);
  const busy = useRef(false);

  const startFlicker = () => {
    flicker.current.forEach((a) => a.kill());
    if (REDUCED) return;
    const q = gsap.utils.selector(root);
    flicker.current = [
      gsap.to(q('.flame'), { scaleY: 1.12, scaleX: 0.92, duration: 0.18, ease: 'sine.inOut', repeat: -1, yoyo: true, transformOrigin: '50% 90%' }),
      gsap.to(q('.flame'), { rotation: 3, duration: 0.55, ease: 'sine.inOut', repeat: -1, yoyo: true, transformOrigin: '50% 90%' }),
      gsap.to(q('.flame-glow'), { opacity: 0.75, scale: 1.08, duration: 0.3, ease: 'sine.inOut', repeat: -1, yoyo: true }),
    ];
  };

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {
      gsap.fromTo('.candle', soft({ autoAlpha: 0, y: 30 }), soft({ autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }));
      gsap.set(['.smoke', '.wish-done'], { autoAlpha: 0 });
    }, root);
    startFlicker();
    return () => {
      flicker.current.forEach((a) => a.kill());
      ctx.current.revert();
    };
  }, []);

  const blow = (e) => {
    if (!lit || busy.current) return;
    busy.current = true;
    flicker.current.forEach((a) => a.kill());
    const r = e.currentTarget.getBoundingClientRect();
    ctx.current.add(() => {
      gsap
        .timeline({ onComplete: () => (busy.current = false) })
        .to('.flame', { scaleY: 0.2, scaleX: 1.4, rotation: -30, autoAlpha: 0, duration: 0.45, ease: 'power2.in', transformOrigin: '50% 90%' })
        .to('.flame-glow', { autoAlpha: 0, duration: 0.6 }, 0)
        .call(() => {
          setLit(false);
          fx.chime();
          fx.sparkle(r.left + r.width / 2, r.top + r.height / 2);
        })
        .fromTo(
          '.smoke',
          { autoAlpha: 0.7, y: 0, scale: 0.4 },
          { autoAlpha: 0, y: -90, x: (i) => (i - 1) * 14, scale: 1.8, duration: 2.4, ease: 'power1.out', stagger: 0.2 },
          0.3,
        )
        .fromTo('.wish-ask', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4 }, 0.2)
        .fromTo('.wish-done', soft({ autoAlpha: 0, y: 10, filter: 'blur(8px)' }), soft({ autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out' }), 0.9);
    });
  };

  const relight = () => {
    if (busy.current) return;
    ctx.current.add(() => {
      gsap.to('.wish-done', { autoAlpha: 0, duration: 0.4 });
      gsap.to('.wish-ask', { autoAlpha: 1, duration: 0.6, delay: 0.3 });
      gsap.set('.flame', { rotation: 0 });
      gsap.fromTo('.flame', { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'back.out(2)', transformOrigin: '50% 90%' });
      gsap.to('.flame-glow', { autoAlpha: 1, duration: 0.8 });
    });
    setLit(true);
    setTimeout(startFlicker, 850);
  };

  return (
    <div className="gift-wish" ref={root}>
      <p className="wish-ask">Close your eyes. Make a wish. Then tap the flame.</p>
      <div className="candle">
        <button type="button" className="flame-hit" onClick={blow} aria-label="Blow out the candle" disabled={!lit}>
          <span className="flame-glow" />
          <span className="flame" />
        </button>
        <span className="smoke" />
        <span className="smoke" />
        <span className="smoke" />
        <span className="wick" />
        <span className="wax" />
      </div>
      <div className="wish-done" aria-live="polite">
        <p>{WISH_MESSAGE}</p>
        {!lit && (
          <button type="button" className="btn btn-ghost" onClick={relight}>
            <span className="btn-label">Light it again</span>
          </button>
        )}
      </div>
    </div>
  );
}
