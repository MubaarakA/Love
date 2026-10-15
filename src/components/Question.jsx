import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import SplitText from '../lib/SplitText';
import { soft } from '../lib/motion';

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * A quiet question with two choices. Used for the opening and the
 * confirmation; each choice plays its own exit before handing control back,
 * and a lock makes sure a choice can only ever be taken once.
 *
 *   entrance      'rise'  – words drift up out of the dark, one by one
 *                 'focus' – the whole line pulls from blur into focus
 *   primaryExit   'fade' | 'dissolve' (letters break into motes of light)
 *   eyebrow       optional small credit line above the question
 *   restLines     if set, the secondary choice shows these lines for a moment
 *                 and then returns to the question instead of leaving
 */
export default function Question({
  heading,
  eyebrow = null,
  primary,
  secondary,
  entrance = 'rise',
  primaryExit = 'fade',
  delay = 0,
  restLines = null,
  onBeforePrimary,
  onPrimary,
  onSecondary,
  engineRef,
}) {
  const root = useRef(null);
  const restA = useRef(null);
  const restB = useRef(null);
  const ctx = useRef(null);
  const locked = useRef(true); // opens as soon as the buttons start to appear
  const running = useRef(null); // entrance or "not yet" timeline still playing

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const actions = q('.q-actions .btn');
      gsap.set(actions, { autoAlpha: 0 });
      if (restLines) gsap.set(q('.q-rest'), { autoAlpha: 0 });

      const tl = gsap.timeline({ delay });
      running.current = tl;
      if (eyebrow) {
        tl.fromTo(
          q('.q-eyebrow'),
          soft({ autoAlpha: 0, y: 6, letterSpacing: '0.62em' }),
          soft({ autoAlpha: 1, y: 0, letterSpacing: '0.42em', duration: 2, ease: 'power2.out' }),
        ).addLabel('title', '-=1.1');
      } else {
        tl.addLabel('title');
      }
      if (entrance === 'focus') {
        tl.fromTo(
          q('.q-title'),
          soft({ autoAlpha: 0, filter: 'blur(18px)', scale: 1.04 }),
          soft({ autoAlpha: 1, filter: 'blur(0px)', scale: 1, duration: 2.2, ease: 'power3.out', clearProps: 'filter,scale' }),
          'title',
        );
      } else {
        tl.set(q('.q-title'), { autoAlpha: 1 }, 'title').fromTo(
          q('.q-title .word'),
          soft({ opacity: 0, y: 16, filter: 'blur(8px)' }),
          soft({ opacity: 1, y: 0, filter: 'blur(0px)', duration: 2, ease: 'power2.out', stagger: 0.15, clearProps: 'filter' }),
          'title',
        );
      }
      tl.fromTo(q('.q-rule'), { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.4, ease: 'power2.inOut' }, '-=1.1')
        .addLabel('buttons', '-=0.9')
        .fromTo(actions, soft({ autoAlpha: 0, y: 14 }), soft({ autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.16 }), 'buttons')
        .call(() => (locked.current = false), null, 'buttons+=0.25');
    }, root);
    return () => ctx.current.revert();
  }, [delay, entrance, eyebrow, restLines]);

  const q = (sel) => root.current.querySelectorAll(sel);

  const hideChrome = (tl) =>
    tl
      .to(q('.q-actions .btn'), soft({ autoAlpha: 0, y: 8, duration: 0.6, ease: 'power2.in', stagger: 0.06 }), 0)
      .to(q('.q-rule'), { scaleX: 0, opacity: 0, duration: 0.8, ease: 'power2.in' }, 0);

  const hideEyebrow = (tl) => (eyebrow ? tl.to(q('.q-eyebrow'), { autoAlpha: 0, duration: 0.9, ease: 'power2.in' }, 0) : tl);

  const exitFade = (done) =>
    ctx.current.add(() => {
      hideEyebrow(hideChrome(gsap.timeline({ onComplete: done }))).to(
        q('.q-title .word'),
        soft({ opacity: 0, y: -10, filter: 'blur(10px)', duration: 1.1, ease: 'power2.in', stagger: { each: 0.06, from: 'end' } }),
        0.1,
      );
    });

  // Each letter breaks apart into rising light as it fades.
  const exitDissolve = (done) =>
    ctx.current.add(() => {
      hideEyebrow(hideChrome(gsap.timeline({ onComplete: done }))).to(
        q('.q-title .char'),
        soft({
          opacity: 0,
          y: () => rand(-28, -6),
          x: () => rand(-8, 8),
          filter: 'blur(6px)',
          duration: 0.9,
          ease: 'power2.in',
          stagger: {
            each: 0.022,
            from: 'random',
            onStart() {
              engineRef?.current?.dissolve([this.targets()[0].getBoundingClientRect()]);
            },
          },
        }),
        0.15,
      );
    });

  // "Not yet": acknowledge it gently, then let the question return.
  const rest = () =>
    ctx.current.add(() => {
      restA.current.textContent = restLines[0];
      restB.current.textContent = restLines[1] ?? '';
      running.current = hideChrome(gsap.timeline())
        .to(q('.q-title'), soft({ autoAlpha: 0, filter: 'blur(10px)', duration: 1, ease: 'power2.in' }), 0)
        .fromTo(q('.q-rest'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 1)
        .fromTo(q('.q-rest p'), soft({ opacity: 0, y: 10, filter: 'blur(8px)' }), soft({ opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out', stagger: 0.6 }), 1)
        .to(q('.q-rest p'), soft({ opacity: 0, filter: 'blur(8px)', duration: 1, ease: 'power2.in' }), '+=2')
        .set(q('.q-rest'), { autoAlpha: 0 })
        .to(q('.q-title'), soft({ autoAlpha: 1, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' }))
        .to(q('.q-rule'), { scaleX: 1, opacity: 1, duration: 1.2, ease: 'power2.inOut' }, '-=1')
        .call(() => {
          restA.current.textContent = '';
          restB.current.textContent = '';
        })
        .addLabel('buttons', '-=0.8')
        .to(q('.q-actions .btn'), soft({ autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.14 }), 'buttons')
        .call(() => (locked.current = false), null, 'buttons+=0.25');
    });

  const choose = (which) => {
    if (locked.current) return;
    // Settle the nearly finished entrance so the exit starts from a clean state.
    running.current?.progress(1).kill();
    locked.current = true;
    if (which === 'primary') {
      onBeforePrimary?.(); // runs inside the click, while the browser still counts it as a user gesture
      (primaryExit === 'dissolve' ? exitDissolve : exitFade)(onPrimary);
    } else if (restLines) {
      rest();
    } else {
      exitFade(onSecondary);
    }
  };

  return (
    <section className="stage q" ref={root}>
      <div className="q-inner">
        {eyebrow && <p className="q-eyebrow">{eyebrow}</p>}
        <SplitText as="h1" className="q-title" text={heading} />
        <span className="q-rule" aria-hidden="true" />
        {restLines && (
          <div className="q-rest" role="status">
            <p ref={restA} />
            <p ref={restB} className="q-rest-sub" />
          </div>
        )}
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={() => choose('primary')}>
            <span className="btn-label">{primary}</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => choose('secondary')}>
            <span className="btn-label">{secondary}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
