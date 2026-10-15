import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { soft, REDUCED } from '../../lib/motion';
import { HER_NAME, REASONS } from '../../config';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const NOTE_COLORS = ['#f6c9d1', '#fde7d6', '#e9d3f2', '#ffd9c7', '#f3e3b5', '#d9e8f5'];

/** A glass jar of folded notes — pull one out and it unfolds into a reason. */
export default function ReasonsJar({ fx }) {
  const root = useRef(null);
  const ctx = useRef(null);
  const busy = useRef(false);
  const order = useRef(shuffle(REASONS));
  const [count, setCount] = useState(0);
  const [reason, setReason] = useState(null);

  // Little folded notes resting inside the jar.
  const notes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: 22 + ((i * 37) % 56),
        y: 98 - Math.floor(i / 4) * 15 - ((i * 13) % 7),
        r: ((i * 47) % 70) - 35,
        c: NOTE_COLORS[i % NOTE_COLORS.length],
      })),
    [],
  );

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {
      gsap.fromTo('.jar', soft({ autoAlpha: 0, y: 30, scale: 0.9 }), soft({ autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: 'back.out(1.5)' }));
      gsap.set('.jar-note-out', { autoAlpha: 0 });
    }, root);
    return () => ctx.current.revert();
  }, []);

  const pick = () => {
    if (busy.current) return;
    busy.current = true;
    if (order.current.length === 0) order.current = shuffle(REASONS);
    const next = order.current.pop();
    const n = count + 1;
    ctx.current.add(() => {
      const tl = gsap.timeline({ onComplete: () => (busy.current = false) });
      if (reason) tl.to('.jar-note-out', soft({ autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in' }));
      tl.call(() => {
        setReason(next);
        setCount(n);
        fx.chime();
      });
      if (!REDUCED) {
        tl.to('.jar', { rotation: -6, duration: 0.08, ease: 'power1.inOut' })
          .to('.jar', { rotation: 6, duration: 0.08, repeat: 3, yoyo: true, ease: 'power1.inOut' })
          .to('.jar', { rotation: 0, duration: 0.15 });
      }
      tl.fromTo(
        '.jar-note-out',
        soft({ autoAlpha: 1, y: 60, scaleY: 0.08, scaleX: 0.4, rotation: -8 }),
        soft({ autoAlpha: 1, y: 0, scaleY: 1, scaleX: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.4)' }),
      ).call(() => {
        const r = root.current.querySelector('.jar-note-out').getBoundingClientRect();
        fx.sparkle(r.left + r.width / 2, r.top + r.height / 2);
      });
    });
  };

  const total = REASONS.length;
  return (
    <div className="gift-jar" ref={root}>
      <div className="jar-note-out" aria-live="polite">
        {reason && (
          <>
            <span className="jar-note-count">
              Reason {((count - 1) % total) + 1} of {total}
            </span>
            <span className="jar-note-text">{reason}</span>
          </>
        )}
      </div>
      <button type="button" className="jar" onClick={pick} aria-label={`Pick a reason why ${HER_NAME} is amazing`}>
        <svg viewBox="0 0 100 130" aria-hidden="true">
          <defs>
            <linearGradient id="jarGlass" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="0.25" stopColor="rgba(255,255,255,0.04)" />
              <stop offset="0.8" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.16)" />
            </linearGradient>
          </defs>
          {notes.map((nt, i) => (
            <rect key={i} x={nt.x - 7} y={nt.y - 5} width="14" height="10" rx="1.5" fill={nt.c} opacity="0.85" transform={`rotate(${nt.r} ${nt.x} ${nt.y})`} />
          ))}
          <path d="M22 22 h56 v8 c 10 6, 14 16, 14 28 v 50 c 0 12, -8 18, -20 18 h -44 c -12 0, -20 -6, -20 -18 v -50 c 0 -12, 4 -22, 14 -28 z" fill="url(#jarGlass)" stroke="rgba(255,240,232,0.55)" strokeWidth="1.2" />
          <rect x="20" y="12" width="60" height="11" rx="3" fill="#c99447" />
          <rect x="20" y="12" width="60" height="3" rx="1.5" fill="#f3cf86" />
          <path d="M30 40 q -6 30, 0 62" stroke="rgba(255,255,255,0.35)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="btn btn-primary" onClick={pick}>
        <span className="btn-label">{count === 0 ? 'Pick a reason' : 'Another one'}</span>
      </button>
    </div>
  );
}
