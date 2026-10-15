import { useId, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import SplitText from '../lib/SplitText';
import { REDUCED, soft } from '../lib/motion';
import { ENDING as E } from '../timing';
import { HER_NAME, HER_NICKNAME, MEMORY_PHOTOS } from '../config';

const hideBroken = (e) => (e.currentTarget.style.display = 'none');
const PHOTO_HOLD = 6; // seconds each memory rests behind the message

const LINES = ['Every little moment.', 'Every laugh.', 'Every tear.', 'Every memory.'];
const PETAL = 'M0 0 C -10 -9, -12 -29, 0 -42 C 12 -29, 10 -9, 0 0 Z';
const INNER = 'M0 0 C -7 -6, -8 -19, 0 -27 C 8 -19, 7 -6, 0 0 Z';

/** A fine-lined blossom whose petals unfold from the centre. */
function Blossom({ className, petals = 6 }) {
  const id = useId().replace(/:/g, '');
  const step = 360 / petals;
  return (
    <svg className={`bloom ${className}`} viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`pf${id}`} cx="0" cy="0" r="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe9de" stopOpacity="0.75" />
          <stop offset="0.55" stopColor="#e7a4ab" stopOpacity="0.32" />
          <stop offset="1" stopColor="#b4566a" stopOpacity="0.08" />
        </radialGradient>
      </defs>
      <g className="bloom-body">
        {Array.from({ length: petals }, (_, i) => (
          <path key={`o${i}`} className="bloom-petal" d={PETAL} fill={`url(#pf${id})`} transform={`rotate(${i * step})`} />
        ))}
        {Array.from({ length: petals }, (_, i) => (
          <path key={`i${i}`} className="bloom-petal bloom-inner" d={INNER} fill={`url(#pf${id})`} transform={`rotate(${i * step + step / 2})`} />
        ))}
        <circle className="bloom-core" r="3.4" />
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return <circle key={`s${i}`} className="bloom-stamen" cx={Math.cos(a) * 6.5} cy={Math.sin(a) * 6.5} r="0.9" />;
        })}
      </g>
    </svg>
  );
}

/**
 * After the video's `ended` event: the picture fades to black, the last
 * petals drift by, a warm glow gathers, and the message arrives line by line
 * with flowers unfolding around it. It stays — nothing restarts on its own.
 */
export default function Ending({ engineRef, atmoRef, onOpenGifts, onRestart, onReplayVideo }) {
  const root = useRef(null);
  const ctx = useRef(null);
  const locked = useRef(true);

  useLayoutEffect(() => {
    const engine = engineRef.current;
    const atmo = atmoRef.current;
    const forever = []; // endless afterglow animations, killed explicitly on unmount
    ctx.current = gsap.context(() => {
      const q = gsap.utils.selector(root);
      gsap.set([q('.end-title'), q('.end-line'), q('.end-final'), q('.end-sign'), q('.end-actions .btn'), q('.end-photo')], { autoAlpha: 0 });
      gsap.set(q('.bloom-petal'), { scale: 0, rotation: -35, svgOrigin: '0 0' });
      gsap.set(q('.bloom-core, .bloom-stamen'), { autoAlpha: 0 });

      const tl = gsap.timeline();
      tl.call(
        () => {
          engine?.resume();
          engine?.setMood('ending', { duration: 4.5 });
          atmo?.tone('ending', 4);
        },
        null,
        0.6,
      )
        .call(() => engine?.drift(1), null, 1.4)
        .call(() => engine?.drift(-1), null, 4.4)
        .call(() => atmo?.sweep({ count: 2, duration: 2.6, opacity: 0.55 }), null, 3.2)

        // "You lived a life that was worth it."
        .set(q('.end-title'), { autoAlpha: 1 }, E.title)
        .fromTo(
          q('.end-title .word'),
          soft({ opacity: 0, y: 14, filter: 'blur(12px)' }),
          soft({ opacity: 1, y: 0, filter: 'blur(0px)', duration: 2.2, ease: 'power2.out', stagger: 0.2, clearProps: 'filter' }),
          E.title,
        );

      // "Every little moment. Every laugh. Every tear. Every memory."
      q('.end-line').forEach((line, i) => {
        tl.fromTo(
          line,
          soft({ autoAlpha: 0, y: 10, filter: 'blur(8px)' }),
          soft({ autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out', clearProps: 'filter' }),
          E.lines + i * E.lineGap,
        );
      });
      const finalAt = E.lines + LINES.length * E.lineGap + E.final;
      tl.fromTo(
        q('.end-final'),
        soft({ autoAlpha: 0, y: 8, filter: 'blur(10px)', letterSpacing: '0.2em' }),
        soft({ autoAlpha: 1, y: 0, filter: 'blur(0px)', letterSpacing: '0.04em', duration: 2.4, ease: 'power3.out', clearProps: 'filter' }),
        finalAt,
      )
        .fromTo(q('.end-rule'), { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.8, ease: 'power2.inOut' }, finalAt + 0.4)
        .fromTo(
          q('.end-sign'),
          soft({ autoAlpha: 0, letterSpacing: '0.6em' }),
          soft({ autoAlpha: 1, letterSpacing: '0.38em', duration: 2, ease: 'power2.out' }),
          finalAt + 1.4,
        );

      // Her memories drift slowly behind the words, one dissolving into the next.
      const photos = q('.end-photo');
      if (photos.length) {
        const slides = gsap.timeline({ repeat: -1, delay: E.title - 0.8 });
        photos.forEach((img, i) => {
          const at = i * PHOTO_HOLD;
          slides
            .fromTo(img, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.6, ease: 'sine.inOut' }, at)
            .fromTo(img, soft({ scale: 1.1 }), soft({ scale: 1, duration: PHOTO_HOLD + 2.6, ease: 'none' }), at)
            .to(img, { autoAlpha: 0, duration: 2.6, ease: 'sine.inOut' }, at + PHOTO_HOLD);
        });
        forever.push(slides);
      }

      // Blossoms unfold around the words, one after another.
      q('.bloom').forEach((b, i) => {
        const at = E.blooms + i * 1.15;
        tl.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, at)
          .to(b.querySelectorAll('.bloom-petal:not(.bloom-inner)'), { scale: 1, rotation: 0, duration: 2.6, ease: 'power3.out', stagger: 0.09 }, at)
          .to(b.querySelectorAll('.bloom-inner'), { scale: 1, rotation: 0, duration: 2.2, ease: 'power3.out', stagger: 0.08 }, at + 0.5)
          .to(b.querySelectorAll('.bloom-core, .bloom-stamen'), { autoAlpha: 1, duration: 1.2, stagger: 0.05 }, at + 1);
      });

      tl.fromTo(
        q('.end-actions .btn'),
        soft({ autoAlpha: 0, y: 10 }),
        soft({ autoAlpha: 1, y: 0, duration: 1.4, ease: 'power3.out', stagger: 0.2 }),
        E.actions,
      ).call(() => (locked.current = false), null, E.actions + 0.3);

      // Afterglow: the blossoms breathe and light occasionally drifts through.
      if (!REDUCED) {
        tl.call(
          () => {
            q('.bloom-body').forEach((b, i) =>
              forever.push(
                gsap.to(b, { rotation: i % 2 ? -8 : 8, scale: 1.04, svgOrigin: '0 0', duration: 7 + i, ease: 'sine.inOut', repeat: -1, yoyo: true }),
              ),
            );
            forever.push(gsap.to(q('.end-glow'), { scale: 1.08, opacity: 0.85, duration: 4.5, ease: 'sine.inOut', repeat: -1, yoyo: true }));
            const loop = () => {
              atmo?.sweep({ count: 1, duration: 3, opacity: 0.4, from: Math.random() < 0.5 ? 'left' : 'right' });
              forever.push(gsap.delayedCall(9 + Math.random() * 4, loop));
            };
            forever.push(gsap.delayedCall(1, loop));
          },
          null,
          E.blooms + 5,
        );
      }
    }, root);
    return () => {
      forever.forEach((a) => a.kill());
      ctx.current.revert();
    };
  }, [engineRef, atmoRef]);

  const leave = (done) => {
    if (locked.current) return;
    locked.current = true;
    ctx.current.add(() => {
      gsap.to(root.current, soft({ autoAlpha: 0, filter: 'blur(6px)', duration: 1.3, ease: 'power2.in', onComplete: done }));
    });
  };

  return (
    <section className="stage end" ref={root}>
      <div className="end-photos" aria-hidden="true">
        {MEMORY_PHOTOS.map((p) => (
          <img key={p.src} className="end-photo" src={p.src} alt="" decoding="async" onError={hideBroken} />
        ))}
      </div>
      <div className="end-glow" aria-hidden="true" />
      <div className="end-inner">
        <Blossom className="bloom-a" petals={6} />
        <Blossom className="bloom-b" petals={5} />
        <Blossom className="bloom-c" petals={7} />
        <Blossom className="bloom-d" petals={5} />
        <Blossom className="bloom-e" petals={6} />

        <SplitText as="h1" className="end-title" text={`${HER_NAME}, you lived a life that was worth it.`} />
        <p className="end-lines">
          {LINES.map((l) => (
            <span className="end-line" key={l}>
              {l}
            </span>
          ))}
        </p>
        <p className="end-final">It all mattered.</p>
        <span className="end-rule" aria-hidden="true" />
        <p className="end-sign">Forever, for {HER_NICKNAME}</p>
      </div>

      <div className="end-actions">
        <button type="button" className="btn btn-primary btn-gift" onClick={() => leave(onOpenGifts)}>
          <span className="btn-label">Open your gifts</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => leave(onRestart)}>
          <span className="btn-label">Watch again</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => leave(onReplayVideo)}>
          <span className="btn-label">Replay the video</span>
        </button>
      </div>
    </section>
  );
}
