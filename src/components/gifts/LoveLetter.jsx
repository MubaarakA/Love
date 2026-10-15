import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { soft } from '../../lib/motion';
import { FROM_NAME, HER_NAME, LOVE_LETTER } from '../../config';

/** A sealed envelope: break the wax seal, the flap opens and the letter rises out. */
export default function LoveLetter({ fx }) {
  const root = useRef(null);
  const ctx = useRef(null);
  const [opened, setOpened] = useState(false);

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {
      gsap.fromTo('.env', soft({ autoAlpha: 0, y: 24, scale: 0.94 }), soft({ autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out' }));
      gsap.to('.env-seal', { scale: 1.06, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }, root);
    return () => ctx.current.revert();
  }, []);

  const open = (e) => {
    if (opened) return;
    setOpened(true);
    fx.chime();
    const r = e.currentTarget.getBoundingClientRect();
    fx.sparkle(r.left + r.width / 2, r.top + r.height / 2);
    ctx.current.add(() => {
      gsap
        .timeline()
        .to('.env-seal', { scale: 1.4, autoAlpha: 0, rotation: 25, duration: 0.45, ease: 'power2.in', overwrite: true })
        .to('.env-flap', { rotationX: 180, duration: 0.8, ease: 'power2.inOut' }, 0.25)
        .set('.env-flap', { zIndex: 0 }, 0.65)
        .fromTo('.env-paper', { yPercent: 0 }, { yPercent: -70, duration: 0.9, ease: 'power2.out' }, 0.9)
        .to('.env', soft({ autoAlpha: 0, y: 40, scale: 0.92, duration: 0.6, ease: 'power2.in' }), 1.7)
        .set('.env', { display: 'none' })
        .fromTo('.letter', soft({ autoAlpha: 0, y: 30, scale: 0.97 }), soft({ autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out' }))
        .fromTo(
          '.letter-line',
          soft({ autoAlpha: 0, y: 10, filter: 'blur(6px)' }),
          soft({ autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out', stagger: 0.9, clearProps: 'filter' }),
          '-=0.3',
        )
        .fromTo('.letter-sign', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, '+=0.2');
    });
  };

  return (
    <div className="gift-letter" ref={root}>
      <button type="button" className="env" onClick={open} aria-label="Break the seal and open the letter" disabled={opened}>
        <span className="env-back" />
        <span className="env-paper" />
        <span className="env-front" />
        <span className="env-flap" />
        <span className="env-seal" aria-hidden="true">
          {HER_NAME.charAt(0)}
        </span>
      </button>
      {!opened && <p className="gift-prompt">Tap the seal</p>}
      <article className="letter" aria-live="polite">
        {LOVE_LETTER.map((line, i) => (
          <p key={i} className={`letter-line${i === 0 ? ' letter-greeting' : ''}`}>
            {line}
          </p>
        ))}
        <p className="letter-sign">{FROM_NAME ? `— ${FROM_NAME}` : 'Always yours'}</p>
      </article>
    </div>
  );
}
