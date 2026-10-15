import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { soft } from '../../lib/motion';
import { OPEN_WHEN } from '../../config';

const KEY = 'memories.openWhen.opened';

const loadOpened = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
};

/** "Open when…" letters: sealed cards that flip open to reveal a note. */
export default function OpenWhen({ fx }) {
  const root = useRef(null);
  const ctx = useRef(null);
  const [opened, setOpened] = useState(loadOpened);
  const [flipped, setFlipped] = useState(null);

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {
      gsap.fromTo('.ow-card', soft({ autoAlpha: 0, y: 26, rotation: (i) => (i % 2 ? 3 : -3) }), soft({ autoAlpha: 1, y: 0, rotation: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }));
    }, root);
    return () => ctx.current.revert();
  }, []);

  const toggle = (i, e) => {
    const open = flipped !== i;
    setFlipped(open ? i : null);
    if (open && !opened.has(i)) {
      const next = new Set(opened).add(i);
      setOpened(next);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        // storage unavailable — it just won't be remembered
      }
      fx.chime();
      const r = e.currentTarget.getBoundingClientRect();
      fx.sparkle(r.left + r.width / 2, r.top + r.height / 2);
    }
    ctx.current.add(() => {
      root.current.querySelectorAll('.ow-inner').forEach((el, k) => {
        gsap.to(el, { rotationY: (open && k === i) ? 180 : 0, duration: 0.8, ease: 'power3.inOut', overwrite: true });
      });
    });
  };

  return (
    <div className="gift-openwhen" ref={root}>
      <div className="ow-grid">
        {OPEN_WHEN.map((l, i) => (
          <button
            type="button"
            key={l.title}
            className={`ow-card${opened.has(i) ? ' is-opened' : ''}`}
            onClick={(e) => toggle(i, e)}
            aria-expanded={flipped === i}
            aria-label={`Open when ${l.title}`}
          >
            <span className="ow-inner">
              <span className="ow-face ow-front">
                <span className="ow-seal" aria-hidden="true" />
                <span className="ow-label">Open when</span>
                <span className="ow-title">{l.title}</span>
              </span>
              <span className="ow-face ow-back">
                <span className="ow-message">{l.message}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="gift-prompt">Tap a letter to open it — tap again to close it</p>
    </div>
  );
}
