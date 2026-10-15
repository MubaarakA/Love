import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { MEMORY_VIDEO_URL } from '../config';
import { loadYouTubeAPI, parseYouTubeId, YT_STATE } from '../lib/youtube';

const PLACEHOLDER = 'YOUR_VIDEO_URL_HERE';
const SOURCE = typeof MEMORY_VIDEO_URL === 'string' ? MEMORY_VIDEO_URL.trim() : '';
const YT_ID = SOURCE && SOURCE !== PLACEHOLDER ? parseYouTubeId(SOURCE) : null;
const KIND = !SOURCE || SOURCE === PLACEHOLDER ? 'missing' : YT_ID ? 'youtube' : 'file';
const IDLE_MS = 2800;
const BLOCKED_AFTER_MS = 3500; // YouTube gives no error when autoplay is refused; it just never starts

// ---------------------------------------------------------------------------
// Two interchangeable backends behind one small interface. Both report
// 'playing' | 'paused' | 'waiting' | 'ended' | 'blocked' | 'error' via emit().
// ---------------------------------------------------------------------------

/** A direct video file (.mp4 / .webm …) in a <video> element. */
function createFileBackend(v, emit) {
  const attach = () => {
    if (!v.getAttribute('src')) {
      v.preload = 'auto';
      v.src = SOURCE;
    }
  };
  const handlers = {
    playing: () => emit('playing'),
    pause: () => !v.ended && emit('paused'),
    waiting: () => emit('waiting'),
    ended: () => emit('ended'),
    error: () => emit('error', 'load'),
  };
  Object.entries(handlers).forEach(([type, fn]) => v.addEventListener(type, fn));
  return {
    // Inside the "I'm sure" click: a silent play/pause unlocks sound for later
    // (iOS needs this) and starts buffering during the transition.
    prime() {
      attach();
      v.muted = true;
      v.play()?.catch(() => {});
      v.pause();
      v.muted = false;
    },
    play() {
      attach();
      if (v.error) return emit('error', 'load');
      v.muted = false;
      v.play()?.catch((err) => {
        if (err.name === 'NotAllowedError') emit('blocked');
        else if (err.name !== 'AbortError') emit('error', 'load');
      });
    },
    pause: () => v.pause(),
    paused: () => v.paused || v.ended,
    restart: () => v.readyState > 0 && (v.currentTime = 0),
    retry: () => v.load(),
    stop() {
      v.pause();
      if (v.readyState > 0) v.currentTime = 0;
    },
    setControls: (on) => (v.controls = on),
    destroy() {
      Object.entries(handlers).forEach(([type, fn]) => v.removeEventListener(type, fn));
      v.pause();
    },
  };
}

/** A YouTube video through the official IFrame Player API. */
function createYouTubeBackend(wrap, id, emit) {
  let player = null;
  let ready = false;
  let wantPlay = false;
  let destroyed = false;
  let blockTimer = 0;

  const host = document.createElement('div'); // YouTube replaces this node with its iframe
  wrap.appendChild(host);

  const start = () => {
    player.unMute();
    player.setVolume(100);
    player.playVideo();
    clearTimeout(blockTimer);
    blockTimer = setTimeout(() => {
      const s = player?.getPlayerState?.();
      if (wantPlay && (s === YT_STATE.UNSTARTED || s === YT_STATE.CUED)) emit('blocked');
    }, BLOCKED_AFTER_MS);
  };

  loadYouTubeAPI()
    .then((YT) => {
      if (destroyed) return;
      player = new YT.Player(host, {
        videoId: id,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1, // shown only when the visitor asks for controls (see .mv-shield)
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ready = true;
            if (wantPlay) start();
          },
          onStateChange: ({ data }) => {
            if (data === YT_STATE.PLAYING) {
              clearTimeout(blockTimer);
              emit('playing');
            } else if (data === YT_STATE.PAUSED) emit('paused');
            else if (data === YT_STATE.BUFFERING) emit('waiting');
            else if (data === YT_STATE.ENDED) emit('ended');
          },
          onError: ({ data }) => emit('error', data),
        },
      });
      if (import.meta.env.DEV) window.__memoryPlayer = player; // handy for testing
    })
    .catch(() => emit('error', 'api'));

  return {
    prime() {}, // creating the player already started loading it
    play() {
      wantPlay = true;
      if (ready) start();
      else emit('waiting');
    },
    pause() {
      wantPlay = false;
      player?.pauseVideo?.();
    },
    paused() {
      const s = player?.getPlayerState?.();
      return s !== YT_STATE.PLAYING && s !== YT_STATE.BUFFERING;
    },
    restart: () => ready && player.seekTo(0, true),
    retry: () => ready && player.loadVideoById(id),
    stop() {
      wantPlay = false;
      clearTimeout(blockTimer);
      // stopVideo, not seekTo: seeking an ended video makes YouTube start playing it.
      if (ready) player.stopVideo();
    },
    setControls() {}, // YouTube's own controls are revealed by lifting the shield instead
    destroy() {
      destroyed = true;
      clearTimeout(blockTimer);
      player?.destroy?.();
      wrap.replaceChildren();
    },
  };
}

const ERRORS = {
  missing: ['The memory video hasn’t been added yet.', null],
  api: ['The video player couldn’t load.', 'Please check the internet connection and try again.'],
  load: ['This memory couldn’t be loaded.', 'Please check the connection or the video link, and try again.'],
  2: ['This video link doesn’t look right.', 'Please check MEMORY_VIDEO_URL in src/config.js.'],
  5: ['This video couldn’t be played here.', 'Please try again, or watch it on YouTube.'],
  100: ['This video is no longer available.', 'It may have been removed or made private.'],
  101: ['This video can’t be played inside the page.', 'Its owner only allows it to be watched on YouTube.'],
  150: ['This video can’t be played inside the page.', 'Its owner only allows it to be watched on YouTube.'],
};
const RETRYABLE = new Set(['api', 'load', 5]);

/**
 * The main event: a full-viewport video — a direct file or a YouTube link.
 * It stays mounted for the whole experience so it can be primed inside the
 * visitor's "I'm sure" click and load while the transition plays.
 *
 * status: idle | waiting | playing | paused | blocked | error | ended
 */
export default function MemoryVideo({ ref, stage, onEnded, onStartOver }) {
  const wrap = useRef(null);
  const video = useRef(null);
  const ytWrap = useRef(null);
  const backend = useRef(null);
  const stageRef = useRef(stage);
  const onEndedRef = useRef(onEnded);
  const idleTimer = useRef(0);
  const [status, setStatus] = useState('idle');
  const [errorCode, setErrorCode] = useState(null);
  const [nativeControls, setNativeControls] = useState(false);
  const [chromeAwake, setChromeAwake] = useState(true);
  const [fit, setFit] = useState('cover');
  const ambient = useRef(null);

  const active = stage === 'video';
  const media = () => (KIND === 'youtube' ? ytWrap.current : video.current);

  useLayoutEffect(() => {
    stageRef.current = stage;
    onEndedRef.current = onEnded;
  }, [stage, onEnded]);

  useLayoutEffect(() => {
    gsap.set(wrap.current, { autoAlpha: 0 });
    gsap.set(media(), { opacity: 0 });
    return () => {
      backend.current?.destroy();
      backend.current = null;
    };
  }, []);

  // Everything the player reports only matters while the video stage is on screen.
  const emit = useCallback((s, detail) => {
    if (stageRef.current !== 'video') return;
    if (s === 'playing') {
      setStatus('playing');
      gsap.to(media(), { opacity: 1, duration: 1.6, ease: 'power2.out', overwrite: 'auto' });
    } else if (s === 'ended') {
      setStatus('ended');
      onEndedRef.current();
    } else if (s === 'error') {
      setErrorCode(detail ?? 'load');
      setStatus('error');
    } else {
      setStatus(s);
    }
  }, []);

  const getBackend = useCallback(() => {
    if (KIND === 'missing') return null;
    backend.current ??= KIND === 'youtube' ? createYouTubeBackend(ytWrap.current, YT_ID, emit) : createFileBackend(video.current, emit);
    return backend.current;
  }, [emit]);

  useImperativeHandle(
    ref,
    () => ({
      /** Call from inside a click handler: unlocks playback and starts loading. */
      prime: () => getBackend()?.prime(),
      reset() {
        backend.current?.stop();
        setNativeControls(false);
        setStatus('idle');
        gsap.killTweensOf([wrap.current, media()]);
        gsap.set(wrap.current, { autoAlpha: 0 });
        gsap.set(media(), { opacity: 0 });
      },
    }),
    [getBackend],
  );

  // React to the story: play in the video stage, fade to black for the ending.
  useEffect(() => {
    if (stage === 'video') {
      gsap.killTweensOf([wrap.current, media()]);
      gsap.set(wrap.current, { autoAlpha: 1 });
      gsap.set(media(), { opacity: 0 });
      setChromeAwake(true);
      const be = getBackend();
      if (!be) {
        setErrorCode('missing');
        setStatus('error');
        return;
      }
      be.restart(); // also covers "Replay the video"
      setStatus('waiting');
      be.play();
    } else if (stage === 'ending') {
      setNativeControls(false);
      gsap.to(wrap.current, { autoAlpha: 0, duration: 2.6, ease: 'power2.inOut' });
    }
  }, [stage, getBackend]);

  useEffect(() => {
    backend.current?.setControls(nativeControls);
  }, [nativeControls]);

  // Fill the screen when the video's shape is close to the screen's; otherwise
  // (e.g. a portrait phone video on a wide screen) show the whole frame.
  useEffect(() => {
    if (KIND !== 'file') return undefined;
    const v = video.current;
    const update = () => {
      if (!v.videoWidth) return;
      const ratio = v.videoWidth / v.videoHeight / (window.innerWidth / window.innerHeight);
      setFit(Math.abs(Math.log(ratio)) > 0.35 ? 'contain' : 'cover');
    };
    v.addEventListener('loadedmetadata', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      v.removeEventListener('loadedmetadata', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // In "contain" mode, a tiny blurred copy of the picture glows behind it.
  useEffect(() => {
    if (!active || fit !== 'contain' || !ambient.current) return undefined;
    const v = video.current;
    const c = ambient.current;
    const g = c.getContext('2d');
    let raf = 0;
    let last = 0;
    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 100 || v.readyState < 2) return; // ~10 fps is plenty for a glow
      last = t;
      c.width = 48;
      c.height = Math.round((48 * v.videoHeight) / v.videoWidth) || 27;
      g.drawImage(v, 0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, fit]);

  const togglePlay = useCallback(() => {
    const be = backend.current;
    if (!be) return;
    if (be.paused()) be.play();
    else be.pause();
  }, []);

  // Our controls fade away while the film plays and return on any movement.
  useEffect(() => {
    if (!active) return undefined;
    const wake = () => {
      setChromeAwake(true);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setChromeAwake(false), IDLE_MS);
    };
    const onKey = (e) => {
      wake();
      if ((e.key === ' ' || e.key === 'k') && !e.target.closest?.('button, video, a')) {
        e.preventDefault();
        togglePlay();
      }
    };
    wake();
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, togglePlay]);

  const retry = () => {
    setStatus('waiting');
    backend.current?.retry();
    backend.current?.play();
  };

  const showChrome = active && ['playing', 'paused', 'waiting'].includes(status);
  const playing = status === 'playing' || status === 'waiting';
  const idle = active && status === 'playing' && !chromeAwake;
  const [errTitle, errSub] = ERRORS[errorCode] ?? ERRORS.load;

  return (
    <div className={`mv${idle ? ' is-idle' : ''}`} ref={wrap} aria-hidden={!active}>
      {KIND === 'youtube' ? (
        <div className="mv-yt" ref={ytWrap} />
      ) : (
        <>
          {fit === 'contain' && <canvas className="mv-ambient" ref={ambient} aria-hidden="true" />}
          <video ref={video} className={`mv-video${fit === 'contain' ? ' is-contain' : ''}`} playsInline preload="none" />
        </>
      )}
      {/* Keeps YouTube's own interface out of the way until controls are asked for. */}
      {KIND === 'youtube' && !nativeControls && <div className="mv-shield" onClick={togglePlay} />}

      {active && status === 'waiting' && <div className="mv-buffering" aria-label="Loading video" role="status" />}

      {showChrome && (
        <div className={`mv-chrome${chromeAwake || status !== 'playing' ? ' is-awake' : ''}`}>
          <button type="button" className="mv-btn" onClick={togglePlay} aria-label={playing ? 'Pause video' : 'Play video'}>
            {playing ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="7" y="5.5" width="3" height="13" rx="1" />
                <rect x="14" y="5.5" width="3" height="13" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.8-6.2a.8.8 0 0 0 0-1.4L9.2 5.1A.8.8 0 0 0 8 5.8Z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="mv-btn"
            onClick={() => setNativeControls((on) => !on)}
            aria-pressed={nativeControls}
            aria-label={nativeControls ? 'Hide video controls' : 'Show video controls'}
            title={nativeControls ? 'Hide controls' : 'Show controls'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="mv-icon-line">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
        </div>
      )}

      {active && status === 'blocked' && (
        <div className="mv-overlay">
          <button type="button" className="btn btn-primary" onClick={() => backend.current?.play()}>
            <span className="btn-label">Play the memory</span>
          </button>
        </div>
      )}

      {active && status === 'error' && (
        <div className="mv-overlay" role="alert">
          <p className="mv-msg">{errTitle}</p>
          <p className="mv-sub">
            {errorCode === 'missing' ? (
              <>
                Set <code>MEMORY_VIDEO_URL</code> in <code>src/config.js</code>.
              </>
            ) : (
              errSub
            )}
          </p>
          <div className="mv-actions">
            {RETRYABLE.has(errorCode) && (
              <button type="button" className="btn btn-primary" onClick={retry}>
                <span className="btn-label">Try again</span>
              </button>
            )}
            {KIND === 'youtube' && (
              <a className="btn btn-ghost" href={SOURCE} target="_blank" rel="noopener noreferrer">
                <span className="btn-label">Watch on YouTube</span>
              </a>
            )}
            <button type="button" className="btn btn-ghost" onClick={onStartOver}>
              <span className="btn-label">Start over</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
