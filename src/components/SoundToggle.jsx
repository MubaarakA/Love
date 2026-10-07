import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';

/** Appears only after the first interaction; music never starts on its own. */
export default function SoundToggle({ music }) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);

  useLayoutEffect(() => {
    const tween = gsap.fromTo(
      ref.current,
      { autoAlpha: 0, scale: 0.6, y: -8 },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.9, ease: 'back.out(2)', delay: 0.4 },
    );
    // Let the runaway NO button know there's a new thing to avoid.
    window.dispatchEvent(new Event('layoutchange'));
    return () => tween.kill();
  }, []);

  const toggle = () => {
    if (on) music.stop();
    else music.start();
    setOn(!on);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`sound-toggle${on ? ' is-on' : ''}`}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Pause music' : 'Play soft music'}
      title={on ? 'Pause music' : 'Play soft music'}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}
