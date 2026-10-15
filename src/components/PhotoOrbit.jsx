import { useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { MEMORY_PHOTOS } from '../config';
import { REDUCED, detachAll } from '../lib/motion';

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const MIN_CARDS = 10; // repeat photos so the circle never looks sparse
const hideBroken = (e) => (e.currentTarget.style.visibility = 'hidden');

/**
 * Her photos as glowing cards. They burst out of the gift box and scatter
 * across the screen, then — when she says yes — sweep into a slowly turning
 * ring around the question (a tilted circle: cards at the front are larger
 * and brighter, cards at the back smaller and dimmer). On "I'm sure" the ring
 * spins up and collapses into the light.
 *
 * All motion is computed per frame from a few tweened values, so scattered →
 * ring → collapse blend smoothly into each other.
 */
export default function PhotoOrbit({ ref }) {
  const root = useRef(null);
  const g = useRef({ blend: 0, spin: 0, omega: 0, radius: 1, alpha: 0, scale: 1 });
  const cards = useRef([]);
  const running = useRef(false);
  const anims = useRef([]);

  const list = useMemo(() => {
    if (!MEMORY_PHOTOS.length) return [];
    const n = Math.max(MIN_CARDS, MEMORY_PHOTOS.length);
    return Array.from({ length: n }, (_, i) => MEMORY_PHOTOS[i % MEMORY_PHOTOS.length]);
  }, []);

  const track = (a) => {
    anims.current.push(a);
    return a;
  };
  const killAnims = () => {
    anims.current.forEach((a) => a.kill());
    anims.current = [];
  };

  // Lay out every card from the shared values. Runs on GSAP's ticker.
  const render = (time) => {
    const s = g.current;
    s.spin += s.omega * gsap.ticker.deltaRatio(60) * (1 / 60);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const rx = Math.min(W * 0.4, 640) * s.radius;
    const ry = Math.min(H * 0.36, 340) * s.radius;
    const n = cards.current.length;
    cards.current.forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 + s.spin;
      const depth = Math.cos(a); // 1 = front (bottom of the ring), -1 = back
      const bob = REDUCED ? 0 : Math.sin(time * 0.6 + i * 1.7) * 6;
      const ringX = Math.sin(a) * rx;
      const ringY = depth * ry;
      const ringScale = 0.78 + 0.24 * depth;
      const b = s.blend;
      const x = lerp(c.sx, ringX, b);
      const y = lerp(c.sy + bob, ringY, b);
      const scale = lerp(c.ss, ringScale, b) * s.scale;
      const rotation = lerp(c.sr, -Math.sin(a) * 6, b);
      const rotationY = lerp(0, -Math.sin(a) * 26, b);
      const light = lerp(1, 0.5 + 0.5 * (depth + 1) * 0.5, b);
      gsap.set(c.el, {
        x,
        y,
        scale,
        rotation,
        rotationY,
        zIndex: Math.round(100 + lerp(i, depth * 50, b)),
        opacity: s.alpha * c.a * light,
      });
    });
  };

  const start = () => {
    if (running.current) return;
    running.current = true;
    gsap.ticker.add(render);
  };
  const stop = () => {
    running.current = false;
    gsap.ticker.remove(render);
  };

  useLayoutEffect(() => {
    cards.current = [...root.current.children].map((el) => ({ el, sx: 0, sy: 0, sr: 0, ss: 1, a: 0 }));
    gsap.set(root.current.children, { opacity: 0, transformPerspective: 900 });
    return () => {
      stop();
      killAnims();
    };
  }, []);

  // Scatter targets around the edges, keeping the centre free for the words.
  const scatterTargets = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const n = cards.current.length;
    // A squircle hugs the edges of the screen, leaving the middle clear.
    const edge = (v) => Math.sign(v) * Math.sqrt(Math.abs(v));
    return cards.current.map((_, i) => {
      const a = (i / n) * Math.PI * 2 + rand(-0.12, 0.12);
      return {
        sx: edge(Math.sin(a)) * W * rand(0.38, 0.43),
        sy: edge(Math.cos(a)) * H * rand(0.35, 0.39),
        sr: rand(-14, 14),
        ss: rand(0.95, 1.15),
      };
    });
  };

  useImperativeHandle(
    ref,
    () =>
      detachAll({
      /** Fly out of the opened box (screen point) and scatter. */
      burst(ox, oy) {
        killAnims();
        const s = g.current;
        Object.assign(s, { blend: 0, spin: rand(0, Math.PI * 2), omega: 0, radius: 1, alpha: 1, scale: 1 });
        const W = window.innerWidth;
        const H = window.innerHeight;
        const targets = scatterTargets();
        cards.current.forEach((c, i) => {
          Object.assign(c, { sx: ox - W / 2, sy: oy - H / 2, sr: rand(-180, 180), ss: 0.1, a: 0 });
          track(
            gsap.to(c, {
              ...targets[i],
              a: 1,
              duration: REDUCED ? 1.2 : 1.5,
              delay: 0.15 + i * 0.07,
              ease: REDUCED ? 'power1.out' : 'back.out(1.1)',
            }),
          );
        });
        start();
      },
      /** Sweep into the turning circle. */
      ring() {
        killAnims();
        const s = g.current;
        s.alpha = 1;
        cards.current.forEach((c) => (c.a = 1));
        track(gsap.to(s, { blend: 1, radius: 1, scale: 1, duration: 2.2, ease: 'power3.inOut' }));
        track(gsap.to(s, { omega: REDUCED ? 0.05 : 0.22, duration: 2.5, ease: 'sine.inOut' }));
        start();
      },
      /** Back from the circle to the scattered wall (e.g. "Take me back"). */
      scatter() {
        killAnims();
        const s = g.current;
        const targets = scatterTargets();
        cards.current.forEach((c, i) => Object.assign(c, targets[i], { a: 1 }));
        track(gsap.to(s, { blend: 0, omega: 0, alpha: 1, radius: 1, scale: 1, duration: 1.8, ease: 'power3.inOut' }));
        start();
      },
      /** Spin up and fall into the centre of the frame. */
      collapse(duration = 1.9) {
        killAnims();
        const s = g.current;
        track(gsap.to(s, { blend: 1, duration: 0.6, ease: 'power2.out' }));
        track(gsap.to(s, { omega: REDUCED ? 0.4 : 5, duration: duration * 0.75, ease: 'power2.in' }));
        track(gsap.to(s, { radius: 0.04, scale: 0.4, duration, ease: 'power3.in' }));
        track(gsap.to(s, { alpha: 0, duration: 0.5, delay: duration - 0.45, ease: 'power1.in', onComplete: stop }));
        start();
      },
      hide(duration = 0.8) {
        killAnims();
        track(gsap.to(g.current, { alpha: 0, duration, onComplete: stop }));
      },
      reset() {
        killAnims();
        stop();
        Object.assign(g.current, { blend: 0, spin: 0, omega: 0, radius: 1, alpha: 0, scale: 1 });
        gsap.set(root.current.children, { opacity: 0 });
      },
    }),
    [],
  );

  return (
    <div className="photo-orbit" ref={root} aria-hidden="true">
      {list.map((p, i) => (
        <figure className="orbit-card" key={i}>
          <img src={p.src} alt="" decoding="async" draggable="false" onError={hideBroken} />
        </figure>
      ))}
    </div>
  );
}
