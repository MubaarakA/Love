import { useCallback, useEffect, useRef, useState } from 'react';
import Background from './components/Background';
import Scene from './components/Scene';
import Question from './components/Question';
import Finale from './components/Finale';
import SoundToggle from './components/SoundToggle';
import { createMusic } from './lib/music';

export default function App() {
  const sceneRef = useRef(null);
  const musicRef = useRef(null);
  const [phase, setPhase] = useState('ask'); // 'ask' → 'yes'
  const [interacted, setInteracted] = useState(false);

  if (!musicRef.current) musicRef.current = createMusic();

  useEffect(() => {
    const music = musicRef.current;
    return () => music.dispose();
  }, []);

  useEffect(() => {
    const first = () => setInteracted(true);
    window.addEventListener('pointerdown', first, { once: true });
    window.addEventListener('keydown', first, { once: true });
    return () => {
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
    };
  }, []);

  const saidYes = useRef(false);
  const handleYes = useCallback(() => {
    if (saidYes.current) return;
    saidYes.current = true;
    sceneRef.current?.celebrate();
    musicRef.current.chime();
    setPhase('yes');
  }, []);

  return (
    <>
      <Background phase={phase} />
      <Scene ref={sceneRef} />
      <Question phase={phase} onYes={handleYes} engineRef={sceneRef} />
      {phase === 'yes' && <Finale />}
      {interacted && <SoundToggle music={musicRef.current} />}
    </>
  );
}
