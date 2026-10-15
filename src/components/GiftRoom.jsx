import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { soft } from '../lib/motion';
import { HER_NAME } from '../config';
import LoveLetter from './gifts/LoveLetter';
import OpenWhen from './gifts/OpenWhen';
import ReasonsJar from './gifts/ReasonsJar';
import WishCandle from './gifts/WishCandle';

const ICONS = {
  letter: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="12" width="36" height="25" rx="3" />
      <path d="M7 14 L24 27 L41 14" />
      <circle cx="24" cy="27" r="3.6" className="ic-fill" />
    </svg>
  ),
  openwhen: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="16" width="26" height="18" rx="2.5" />
      <path d="M5 17 L17 26 L29 17" />
      <rect x="18" y="10" width="26" height="18" rx="2.5" />
      <path d="M19 11 L31 20 L43 11" />
    </svg>
  ),
  jar: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M15 10 h18 v4 c 4 3, 6 7, 6 12 v 10 c 0 5, -3 7, -8 7 h -14 c -5 0, -8 -2, -8 -7 v -10 c 0 -5, 2 -9, 6 -12 z" />
      <path d="M17 30 l5 -3 l4 4 l5 -4" />
      <rect x="20" y="31" width="7" height="5" rx="1" className="ic-fill" />
    </svg>
  ),
  wish: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="18" y="22" width="12" height="20" rx="2" />
      <path d="M24 22 v -3" />
      <path d="M24 17 c -4 -4, -2 -8, 0 -11 c 2 3, 4 7, 0 11 z" className="ic-fill" />
    </svg>
  ),
};

const GIFTS = [
  { id: 'letter', title: 'A letter', line: 'Sealed, just for you', Component: LoveLetter },
  { id: 'openwhen', title: 'Open when…', line: 'For the days ahead', Component: OpenWhen },
  { id: 'jar', title: 'A jar of reasons', line: 'Why you’re amazing', Component: ReasonsJar },
  { id: 'wish', title: 'Make a wish', line: 'Blow out the candle', Component: WishCandle },
];

/**
 * After the film: a small room of digital gifts — a sealed love letter,
 * "open when" letters, a jar of reasons and a wish candle.
 */
export default function GiftRoom({ fx, onRestart, onReplayVideo }) {
  const root = useRef(null);
  const panel = useRef(null);
  const lastTile = useRef(null);
  const leaving = useRef(false);
  const [openId, setOpenId] = useState(null);
  const open = GIFTS.find((g) => g.id === openId);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({ delay: 0.4 })
        .fromTo('.room-eyebrow', soft({ autoAlpha: 0, letterSpacing: '0.7em' }), soft({ autoAlpha: 1, letterSpacing: '0.42em', duration: 1.6, ease: 'power2.out' }))
        .fromTo('.room-title', soft({ autoAlpha: 0, y: 12, filter: 'blur(10px)' }), soft({ autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power3.out', clearProps: 'filter' }), '-=1.1')
        .fromTo('.gift-tile', soft({ autoAlpha: 0, y: 36, scale: 0.92 }), soft({ autoAlpha: 1, y: 0, scale: 1, duration: 1, ease: 'back.out(1.4)', stagger: 0.12 }), '-=0.8')
        .fromTo('.room-actions .btn', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, stagger: 0.15 }, '-=0.3');
    }, root);
    return () => ctx.revert();
  }, []);

  // The open gift's panel rises in; Escape closes it.
  useLayoutEffect(() => {
    if (!openId) return undefined;
    const tween = gsap.fromTo(panel.current, soft({ autoAlpha: 0, y: 30, scale: 0.97 }), soft({ autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }));
    panel.current.querySelector('.panel-close')?.focus({ preventScroll: true });
    return () => tween.kill();
  }, [openId]);

  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const choose = (g, e) => {
    lastTile.current = e.currentTarget;
    const r = e.currentTarget.getBoundingClientRect();
    fx.sparkle(r.left + r.width / 2, r.top + r.height / 2);
    fx.chime();
    setOpenId(g.id);
  };

  const close = () => {
    gsap.to(panel.current, soft({ autoAlpha: 0, y: 20, duration: 0.35, ease: 'power2.in', onComplete: () => setOpenId(null) }));
    setTimeout(() => lastTile.current?.focus({ preventScroll: true }), 420);
  };

  const leave = (done) => {
    if (leaving.current) return;
    leaving.current = true;
    gsap.to(root.current, soft({ autoAlpha: 0, filter: 'blur(6px)', duration: 1.1, ease: 'power2.in', onComplete: done }));
  };

  return (
    <section className="stage room" ref={root}>
      <div className="room-inner" inert={openId ? true : undefined}>
        <p className="room-eyebrow">A few more gifts</p>
        <h1 className="room-title">For you, {HER_NAME}</h1>
        <div className="room-grid">
          {GIFTS.map((g) => (
            <button type="button" key={g.id} className="gift-tile" onClick={(e) => choose(g, e)}>
              <span className="tile-icon">{ICONS[g.id]}</span>
              <span className="tile-title">{g.title}</span>
              <span className="tile-line">{g.line}</span>
            </button>
          ))}
        </div>
        <div className="room-actions">
          <button type="button" className="btn btn-primary" onClick={() => leave(onRestart)}>
            <span className="btn-label">Watch again</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => leave(onReplayVideo)}>
            <span className="btn-label">Replay the video</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="gift-panel-wrap" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="gift-panel" ref={panel} role="dialog" aria-modal="true" aria-label={open.title}>
            <button type="button" className="panel-close" onClick={close} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <h2 className="panel-title">{open.title}</h2>
            <open.Component fx={fx} />
          </div>
        </div>
      )}
    </section>
  );
}
