import { useEffect, useImperativeHandle, useRef } from 'react';
import { MemoryEngine } from '../three/engine';
import { detachAll } from '../lib/motion';

const API = ['setMood', 'drift', 'burst', 'flood', 'sparkle', 'pulse', 'dissolve', 'suspend', 'resume'];

/**
 * Hosts the Three.js engine. The engine owns its canvas, render loop and
 * listeners; this component only creates it on mount and tears everything
 * down (GPU resources included) on unmount.
 */
export default function Scene({ ref }) {
  const host = useRef(null);
  const engine = useRef(null);

  useImperativeHandle(
    ref,
    () => detachAll(Object.fromEntries(API.map((name) => [name, (...args) => engine.current?.[name](...args)]))),
    [],
  );

  useEffect(() => {
    const el = host.current;
    let e;
    try {
      e = new MemoryEngine(el);
    } catch (err) {
      // No WebGL: the DOM layers still tell the whole story.
      console.warn('3D effects unavailable:', err);
      el.replaceChildren();
      return undefined;
    }
    engine.current = e;
    return () => {
      e.dispose();
      engine.current = null;
    };
  }, []);

  return <div className="scene" ref={host} aria-hidden="true" />;
}
