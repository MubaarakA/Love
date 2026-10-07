import { useCallback, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import SplitText from '../lib/SplitText';
import { useRunaway } from '../lib/useRunaway';
import { INTRO } from '../timing';

const PLEAS = [
  'Are you sure? 🥺',
  'Really? 🌸',
  'You might want to reconsider… 😭',
  'The flowers are begging you 🌷',
  'I’ll bring dessert… 🍰',
  'Just one tiny yes? 💗',
  // After the scripted run, gently cycle through these.
  'That button is shy anyway 🙈',
  'Yes is right there ✨',
  'Pretty please? 💞',
];

const ACCENT = ['date'];
const pleaFor = (n) => (n <= 6 ? PLEAS[n - 1] : PLEAS[6 + ((n - 7) % 3)]);
const rand = (a, b) => a + Math.random() * (b - a);

export default function Question({ phase, onYes, engineRef }) {
  const root = useRef(null);
  const greetRef = useRef(null);
  const askRef = useRef(null);
  const ornamentRef = useRef(null);
  const yesRef = useRef(null);
  const haloRef = useRef(null);
  const ringRef = useRef(null);
  const noRef = useRef(null);
  const slotRef = useRef(null);
  const hintRef = useRef(null);
  const introTl = useRef(null);
  const pulses = useRef([]);
  const plea = useRef({ n: 0, at: -1e9 });

  const getObstacles = useCallback(
    () => [
      askRef.current?.querySelector('.question'),
      ornamentRef.current,
      yesRef.current,
      hintRef.current?.textContent ? hintRef.current : null,
      document.querySelector('.sound-toggle'),
    ],
    [],
  );

  const onEscape = useCallback(
    (_attempts, from) => {
      engineRef.current?.puff(from.x, from.y);
      // Rapid-fire attempts still escape, but each plea stays up long enough to be read.
      const now = performance.now();
      if (now - plea.current.at < 650) return;
      plea.current = { n: plea.current.n + 1, at: now };
      const n = plea.current.n;
      const hint = hintRef.current;
      gsap
        .timeline()
        .to(hint, { autoAlpha: 0, y: -8, duration: 0.18, ease: 'power2.in' })
        .call(() => {
          hint.textContent = pleaFor(n);
          window.dispatchEvent(new Event('layoutchange'));
        })
        .fromTo(hint, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out' });
      // YES quietly gets a little more irresistible each time.
      gsap.to(yesRef.current, {
        scale: 1 + Math.min(n, 6) * 0.03,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
        onComplete: () => window.dispatchEvent(new Event('layoutchange')),
      });
      gsap.to(haloRef.current, { '--glow': Math.min(1, 0.55 + n * 0.08), duration: 0.6 });
    },
    [engineRef],
  );

  const { escape, disable } = useRunaway({ buttonRef: noRef, slotRef, getObstacles, onEscape });

  // Touch: escape on finger-down, before a click can ever register. React's
  // touch listeners are passive, so this one is attached natively.
  useLayoutEffect(() => {
    const btn = noRef.current;
    const onTouch = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      escape(t ? { x: t.clientX, y: t.clientY } : null);
    };
    btn.addEventListener('touchstart', onTouch, { passive: false });
    return () => btn.removeEventListener('touchstart', onTouch);
  }, [escape]);

  // Opening sequence.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const greetChars = greetRef.current.querySelectorAll('.char');
      const qWords = askRef.current.querySelectorAll('.question .word');
      const lines = ornamentRef.current.querySelectorAll('.ornament-line');
      lines.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.set([yesRef.current, noRef.current], { autoAlpha: 0 });

      pulses.current = [
        gsap.to(haloRef.current, { opacity: 1, scale: 1.08, duration: 1.7, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true }),
        gsap.fromTo(
          ringRef.current,
          { scale: 1, opacity: 0.6 },
          { scale: 1.5, opacity: 0, duration: 2.2, ease: 'power2.out', repeat: -1, repeatDelay: 0.5, paused: true },
        ),
      ];

      const tl = gsap.timeline({ delay: INTRO.greeting });
      tl.set(greetRef.current, { autoAlpha: 1 })
        .from(greetChars, {
          opacity: 0,
          y: 18,
          filter: 'blur(8px)',
          duration: 1.2,
          ease: 'power3.out',
          stagger: 0.032,
          clearProps: 'filter',
        })
        .to(greetRef.current, { autoAlpha: 0, y: -28, filter: 'blur(8px)', duration: 0.9, ease: 'power2.in' }, `+=${INTRO.greetingHold}`)
        .set(askRef.current, { autoAlpha: 1 })
        .from(
          qWords,
          {
            opacity: 0,
            yPercent: 70,
            rotationX: -65,
            transformPerspective: 700,
            filter: 'blur(12px)',
            duration: 1.4,
            ease: 'expo.out',
            stagger: 0.085,
            clearProps: 'filter',
          },
          '-=0.15',
        )
        .to(lines, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, '-=1.0')
        .from(
          ornamentRef.current.querySelector('.ornament-heart'),
          { scale: 0, opacity: 0, svgOrigin: '120 12', duration: 0.9, ease: 'back.out(2.4)' },
          '-=1.0',
        )
        .fromTo(
          yesRef.current,
          { autoAlpha: 0, y: 28, scale: 0.8 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: 'back.out(1.7)' },
          '-=1.1',
        )
        .fromTo(noRef.current, { autoAlpha: 0, yPercent: 90 }, { autoAlpha: 1, yPercent: 0, duration: 1, ease: 'power3.out' }, '<0.14')
        .call(() => pulses.current.forEach((p) => p.play()));
      introTl.current = tl;

      // Impatient? A tap fast-forwards the opening (never skips it).
      const hurry = () => {
        if (tl.progress() < 1) tl.timeScale(2.4);
      };
      window.addEventListener('pointerdown', hurry, { once: true });
      return () => window.removeEventListener('pointerdown', hurry);
    }, root);
    return () => ctx.revert();
  }, []);

  // Subtle magnetic pull on YES for mouse users.
  useLayoutEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const btn = yesRef.current;
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3.out' });
    const move = (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerleave', leave);
    return () => {
      btn.removeEventListener('pointermove', move);
      btn.removeEventListener('pointerleave', leave);
    };
  }, []);

  // She said yes: dissolve the question.
  useLayoutEffect(() => {
    if (phase !== 'yes') return;
    disable();
    introTl.current?.kill();
    pulses.current.forEach((p) => p.kill());
    const ctx = gsap.context(() => {
      const chars = askRef.current.querySelectorAll('.question .char');
      gsap
        .timeline()
        .to(greetRef.current, { autoAlpha: 0, duration: 0.3 }, 0)
        .to(yesRef.current, { scale: '-=0.08', duration: 0.12, ease: 'power2.out' }, 0)
        .to(yesRef.current, { scale: 1.3, autoAlpha: 0, filter: 'blur(8px)', duration: 0.75, ease: 'power2.out' }, 0.12)
        .to(noRef.current, { autoAlpha: 0, scale: 0.4, rotation: -25, duration: 0.55, ease: 'back.in(2)' }, 0)
        .to(
          chars,
          {
            autoAlpha: 0,
            y: () => rand(-60, -20),
            x: () => rand(-24, 24),
            rotation: () => rand(-30, 30),
            filter: 'blur(10px)',
            duration: 0.95,
            ease: 'power2.in',
            stagger: { each: 0.016, from: 'center' },
          },
          0.05,
        )
        .to([ornamentRef.current, hintRef.current], { autoAlpha: 0, y: -12, duration: 0.6, ease: 'power2.in' }, 0)
        .set([askRef.current, noRef.current], { display: 'none' });
    }, root);
    return () => ctx.revert();
  }, [phase, disable]);

  const disabled = phase === 'yes';

  return (
    <main className="stage" ref={root}>
      <div className="greeting" ref={greetRef}>
        <SplitText as="p" text="Hey… I have a little question for you 🌸" />
      </div>

      <section className="ask" ref={askRef}>
        <SplitText as="h1" className="question" text="will you go on a date with me Zeynab?" accent={ACCENT} />

        <svg className="ornament" ref={ornamentRef} viewBox="0 0 240 24" aria-hidden="true">
          <path className="ornament-line" d="M6 12 C 40 3, 78 21, 106 12" />
          <path className="ornament-line" d="M234 12 C 200 3, 162 21, 134 12" />
          <path
            className="ornament-heart"
            d="M120 17.5 C 113 12.5, 112.5 8.6, 115.6 7.3 C 117.6 6.5, 119.3 7.6, 120 9.2 C 120.7 7.6, 122.4 6.5, 124.4 7.3 C 127.5 8.6, 127 12.5, 120 17.5 Z"
          />
        </svg>

        <div className="buttons">
          <button ref={yesRef} type="button" className="btn btn-yes" onClick={onYes} disabled={disabled}>
            <span className="yes-ring" ref={ringRef} aria-hidden="true" />
            <span className="yes-halo" ref={haloRef} aria-hidden="true" />
            <span className="btn-face">
              YES <span className="emoji">❤️</span>
            </span>
          </button>
          <span className="no-slot" ref={slotRef} aria-hidden="true" />
        </div>

        <p className="hint" ref={hintRef} aria-live="polite" />
      </section>

      <button
        ref={noRef}
        type="button"
        className="btn btn-no"
        disabled={disabled}
        onPointerEnter={(e) => e.pointerType === 'mouse' && escape({ x: e.clientX, y: e.clientY })}
        onPointerDown={(e) => {
          e.preventDefault();
          escape({ x: e.clientX, y: e.clientY });
        }}
        onClick={(e) => {
          e.preventDefault();
          escape(null);
        }}
      >
        <span className="btn-face">
          NO <span className="emoji">😭</span>
        </span>
      </button>
    </main>
  );
}
