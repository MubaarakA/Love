import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import SplitText from '../lib/SplitText';
import { soft } from '../lib/motion';
import { TRANSITION as T } from '../timing';
import { HER_NICKNAME, MEMORY_PHOTOS } from '../config';

const FLASHES = MEMORY_PHOTOS.slice(0, 5);
const hideBroken = (e) => (e.currentTarget.style.display = 'none');
// Where each memory surfaces, as offsets from the centre (vw / vh, degrees).
const SPOTS = [
  [-14, -6, -3],
  [13, 4, 2.5],
  [-6, 8, 1.5],
  [9, -9, -2],
  [0, 0, 0],
];

/**
 * "I'm sure" → the frame falls toward black, light gathers to the centre and
 * memories flicker up out of the dark, trails sweep across, a glow blooms
 * outward, and a single title holds the moment before the loading screen.
 */
export default function Anticipation({ engineRef, atmoRef, onDone }) {
  const root = useRef(null);

  useLayoutEffect(() => {
    const engine = engineRef.current;
    const atmo = atmoRef.current;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      gsap.set([q('.ant-title'), q('.ant-credit'), q('.ant-flash')], { autoAlpha: 0 });

      const tl = gsap
        .timeline({ onComplete: onDone })
        .call(
          () => {
            engine?.setMood('transition', { duration: 1.7, ease: 'power2.in' });
            atmo?.tone('transition', 1.4);
          },
          null,
          0,
        )
        .call(() => atmo?.sweep({ count: 2, duration: 1.7 }), null, 0.3)
        .call(() => atmo?.sweep({ count: 3, duration: 1.4, from: 'right' }), null, 0.95);

      // Memories flicker up, each a little faster than the last, as the light gathers.
      q('.ant-flash').forEach((img, i) => {
        const [x, y, r] = SPOTS[i % SPOTS.length];
        const at = 0.25 + i * 0.3 - i * i * 0.012;
        tl.fromTo(
          img,
          soft({ autoAlpha: 0, x: `${x}vw`, y: `${y}vh`, rotation: r, scale: 1.14, filter: 'blur(14px)' }),
          soft({ autoAlpha: 0.5, scale: 1.04, filter: 'blur(1.5px)', duration: 0.32, ease: 'power2.out' }),
          at,
        ).to(img, soft({ autoAlpha: 0, scale: 0.96, filter: 'blur(10px)', duration: 0.5, ease: 'power2.in' }), at + 0.36);
      });

      tl.call(
        () => {
          engine?.burst();
          atmo?.bloom();
        },
        null,
        T.burst,
      )
        .call(() => engine?.setMood('afterglow', { duration: 2.4 }), null, T.burst + 0.15)
        .set(q('.ant-title'), { autoAlpha: 1 }, T.title)
        .fromTo(
          q('.ant-title .word'),
          soft({ opacity: 0, y: 10, filter: 'blur(14px)' }),
          soft({ opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.8, ease: 'power3.out', stagger: 0.12 }),
          T.title,
        )
        .fromTo(
          q('.ant-credit'),
          soft({ autoAlpha: 0, letterSpacing: '0.6em' }),
          soft({ autoAlpha: 1, letterSpacing: '0.4em', duration: 1.6, ease: 'power2.out' }),
          T.title + 1,
        )
        .to(
          [q('.ant-title'), q('.ant-credit')],
          soft({ autoAlpha: 0, filter: 'blur(10px)', duration: 1.2, ease: 'power2.in' }),
          `+=${T.hold}`,
        );
    }, root);
    return () => ctx.revert();
  }, [engineRef, atmoRef, onDone]);

  return (
    <section className="stage ant" ref={root}>
      <div className="ant-flashes" aria-hidden="true">
        {FLASHES.map((p) => (
          <img key={p.src} className="ant-flash" src={p.src} alt="" decoding="async" onError={hideBroken} />
        ))}
      </div>
      <div className="ant-inner">
        <SplitText as="h1" className="ant-title" text="Some moments stay with us forever." />
        <p className="ant-credit">The memories of {HER_NICKNAME}</p>
      </div>
    </section>
  );
}
