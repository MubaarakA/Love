import { useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import SplitText from '../lib/SplitText';
import { YES } from '../timing';

const STARS = 28;
const rand = (a, b) => a + Math.random() * (b - a);

/** Classic parametric heart, resampled so points are evenly spaced along it. */
function buildHeart() {
  const dense = [];
  const N = 720;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    dense.push([16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
  }
  // Fit to a 540-unit-wide box centred on the origin.
  const xs = dense.map((p) => p[0]);
  const ys = dense.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = 540 / (maxX - minX);
  const cy = (minY + maxY) / 2;
  const pts = dense.map(([x, y]) => [x * s, (y - cy) * s]);

  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[cum.length - 1];
  const stars = [];
  let j = 0;
  for (let k = 0; k < STARS; k++) {
    const target = (k / STARS) * total;
    while (cum[j + 1] < target) j++;
    stars.push(pts[j]);
  }

  const fmt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  const smooth = `M${pts.filter((_, i) => i % 4 === 0).map(fmt).join(' L')} Z`;
  const poly = `M${stars.map(fmt).join(' L')} Z`;

  // Mirrored pairs make symmetric "string art" across the heart, plus a few diagonals.
  const chords = [];
  for (let i = 2; i <= 12; i += 2) chords.push([stars[i], stars[STARS - i]]);
  [
    [3, 21],
    [7, 25],
    [5, 17],
    [23, 11],
  ].forEach(([a, b]) => chords.push([stars[a], stars[b]]));

  return { smooth, poly, stars, chords };
}

function buildStreaks() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.hypot(W, H) * 0.55;
  return Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2 + rand(-0.2, 0.2);
    const sx = cx + Math.cos(a) * R;
    const sy = cy + Math.sin(a) * R;
    const dx = cx - sx;
    const dy = cy - sy;
    // Same swirl direction as the 3D petals flying in.
    const qx = (sx + cx) / 2 + dy * 0.38;
    const qy = (sy + cy) / 2 - dx * 0.38;
    return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  });
}

export default function Finale() {
  const root = useRef(null);
  const heart = useMemo(buildHeart, []);
  const streaks = useMemo(buildStreaks, []);
  const touch = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const B = YES.burst;

      // Prime every stroke for a draw-on.
      const draw = (els) =>
        els.forEach((el) => {
          const len = el.getTotalLength();
          gsap.set(el, { strokeDasharray: `${len} ${len}`, strokeDashoffset: len });
        });
      draw(q('.heart-soft, .heart-line, .flourish, .chord'));

      // 1. Comet-like light streaks swirl into the centre, arriving with the burst.
      q('.streak').forEach((g) => {
        const paths = g.querySelectorAll('path');
        const len = paths[0].getTotalLength();
        const seg = len * 0.32;
        const delay = YES.converge + rand(0, 0.35);
        gsap.set(paths, { strokeDasharray: `${seg} ${len + seg}`, strokeDashoffset: seg });
        gsap.to(paths, { strokeDashoffset: -len, duration: B - delay + 0.05, delay, ease: 'power2.in' });
      });
      gsap.to(q('.streaks'), { autoAlpha: 0, duration: 0.3, delay: B + 0.05 });

      const tl = gsap.timeline();

      // 2. The answer.
      tl.fromTo(q('.halo'), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 2.4, ease: 'power2.out' }, B)
        .from(
          q('.final-1 .char'),
          {
            opacity: 0,
            y: 40,
            scale: 0.7,
            filter: 'blur(14px)',
            duration: 1.5,
            ease: 'expo.out',
            stagger: 0.035,
            clearProps: 'filter',
          },
          YES.message,
        )

        // 3. Constellation heart draws itself behind the words.
        .to(q('.heart-soft'), { strokeDashoffset: 0, duration: 2.8, ease: 'power2.inOut' }, YES.heart)
        .to(q('.heart-line'), { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut' }, YES.heart + 0.1)
        .from(
          q('.star'),
          { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: 0.7, ease: 'back.out(3)', stagger: { amount: 2.3 } },
          YES.heart + 0.15,
        )
        // Threads of light briefly connect the stars, then fade.
        .to(q('.chord'), { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', stagger: 0.09 }, YES.heart + 2.3)
        .to(q('.chord'), { opacity: 0, duration: 1.4, ease: 'power2.in', stagger: 0.09 }, YES.heart + 3.1)

        // 4. Flourishes and the handwritten second line.
        .to(q('.flourish'), { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut', stagger: 0.12 }, YES.subline - 0.4)
        .fromTo(
          q('.final-2'),
          { clipPath: 'inset(-30% 100% -30% 0%)', y: 8, autoAlpha: 1 },
          { clipPath: 'inset(-30% 0% -30% 0%)', y: 0, duration: 2.4, ease: 'power2.inOut' },
          YES.subline,
        )
        .fromTo(q('.tap-hint'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'power2.out' }, YES.hint);

      // 5. Afterglow — a slow heartbeat and twinkling, nothing restless.
      tl.add(() => {
        gsap.to(q('.heart-group'), {
          scale: 1.035,
          svgOrigin: '0 0',
          duration: 1.3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
        q('.star').forEach((s) =>
          gsap.to(s, {
            opacity: rand(0.25, 0.55),
            duration: rand(1.2, 2.6),
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            delay: rand(0, 2),
          }),
        );
        const chords = q('.chord');
        gsap
          .timeline({ repeat: -1, repeatDelay: 2.5, delay: 1 })
          .set(chords, { strokeDashoffset: (i, el) => el.getTotalLength() })
          .to(chords, { opacity: 0.9, strokeDashoffset: 0, duration: 0.9, ease: 'power2.out', stagger: { each: 0.12, from: 'random' } })
          .to(chords, { opacity: 0, duration: 1.6, ease: 'power2.in', stagger: { each: 0.12, from: 'random' } }, '+=0.6');
      }, YES.heart + 4.6);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section className="finale" ref={root}>
      <svg className="streaks" aria-hidden="true">
        {streaks.map((d, i) => (
          <g className="streak" key={i}>
            <path className="streak-glow" d={d} />
            <path className="streak-core" d={d} />
          </g>
        ))}
      </svg>

      <div className="finale-center">
        <div className="halo" aria-hidden="true" />

        <svg className="heart-art" viewBox="-330 -300 660 600" aria-hidden="true">
          <defs>
            <linearGradient id="roseGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff1e2" />
              <stop offset="0.45" stopColor="#ff9fbb" />
              <stop offset="1" stopColor="#e2557b" />
            </linearGradient>
            <radialGradient id="starGlow">
              <stop offset="0" stopColor="#fff" stopOpacity="1" />
              <stop offset="0.25" stopColor="#fff2f6" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffb3c8" stopOpacity="0" />
            </radialGradient>
          </defs>

          <path className="flourish" d="M-40 238 C -150 280, -292 228, -300 118 C -305 52, -252 20, -214 46 C -186 66, -200 104, -228 98" />
          <path className="flourish" d="M40 238 C 150 280, 292 228, 300 118 C 305 52, 252 20, 214 46 C 186 66, 200 104, 228 98" />

          <g className="heart-group">
            <path className="heart-soft" d={heart.smooth} />
            <path className="heart-line" d={heart.poly} />
            {heart.chords.map(([a, b], i) => (
              <line className="chord" key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
            {heart.stars.map(([x, y], i) => (
              <g className="star" key={i}>
                <circle cx={x} cy={y} r={i % 4 === 0 ? 13 : 9} fill="url(#starGlow)" />
                <circle cx={x} cy={y} r={i % 4 === 0 ? 2.4 : 1.6} fill="#fff" />
              </g>
            ))}
          </g>
        </svg>

        <div className="finale-text">
          <SplitText as="h2" className="final-1" text="I knew you would say yes ❤️" />
          <SplitText as="p" className="final-2" text="I can’t wait for our date 🌹" />
        </div>
      </div>

      <p className="tap-hint">{touch ? 'Tap' : 'Click'} anywhere to make it bloom ✿</p>
    </section>
  );
}
