import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

/** Appears once sound is unlocked; the score never starts on its own. */
export default function SoundToggle({ muted, onToggle, hidden }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const tween = gsap.to(ref.current, { autoAlpha: hidden ? 0 : 1, duration: hidden ? 0.4 : 1.2, ease: 'power2.out', delay: hidden ? 0 : 0.6 });
    return () => tween.kill();
  }, [hidden]);

  return (
    <button
      ref={ref}
      type="button"
      className="sound-toggle"
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn music on' : 'Turn music off'}
      title={muted ? 'Music off' : 'Music on'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="st-speaker" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
        {muted ? (
          <path className="st-line" d="M16 9.5l5 5M21 9.5l-5 5" />
        ) : (
          <>
            <path className="st-line" d="M15.5 9.2a4 4 0 0 1 0 5.6" />
            <path className="st-line st-wave" d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
          </>
        )}
      </svg>
    </button>
  );
}
