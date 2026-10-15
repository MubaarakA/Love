import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Atmosphere from './components/Atmosphere';
import Scene from './components/Scene';
import FlowerRain from './components/FlowerRain';
import PhotoOrbit from './components/PhotoOrbit';
import GiftBox from './components/GiftBox';
import Question from './components/Question';
import Anticipation from './components/Anticipation';
import Loader from './components/Loader';
import MemoryVideo from './components/MemoryVideo';
import Ending from './components/Ending';
import GiftRoom from './components/GiftRoom';
import SoundToggle from './components/SoundToggle';
import { createScore } from './lib/score';
import { STAGES, canAdvance } from './stages';
import { HER_NAME, HER_NICKNAME, MEMORY_PHOTOS } from './config';

const { GIFT, INTRO, CONFIRM, TRANSITION, LOADING, VIDEO, ENDING, GIFTS } = STAGES;

const INTRO_CREDIT = `For ${HER_NICKNAME}`;
const NOT_YET = [`That’s alright, ${HER_NAME}.`, 'They’ll be here whenever you’re ready.'];

export default function App() {
  const engineRef = useRef(null);
  const atmoRef = useRef(null);
  const videoRef = useRef(null);
  const flowersRef = useRef(null);
  const photosRef = useRef(null);
  const scoreRef = useRef(null);
  const [stage, setStage] = useState(GIFT);
  const stageRef = useRef(GIFT);
  const prevStage = useRef(null);
  const [soundOn, setSoundOn] = useState(false); // unlocked by the first interaction
  const [muted, setMuted] = useState(false);

  if (!scoreRef.current) scoreRef.current = createScore(); // creates no audio until unlocked

  useEffect(() => {
    const score = scoreRef.current;
    return () => score.dispose();
  }, []);

  // Browsers only allow sound after a gesture: the first click or key press
  // anywhere (normally opening the gift) starts the score.
  useEffect(() => {
    const events = ['click', 'touchend', 'keydown'];
    const unlock = () => {
      if (!scoreRef.current.unlock()) return;
      scoreRef.current.cue(stageRef.current);
      setSoundOn(true);
      events.forEach((e) => window.removeEventListener(e, unlock, true));
    };
    events.forEach((e) => window.addEventListener(e, unlock, true));
    return () => events.forEach((e) => window.removeEventListener(e, unlock, true));
  }, []);

  const toggleSound = useCallback(() => {
    setMuted((m) => {
      scoreRef.current.setMuted(!m);
      return !m;
    });
  }, []);

  // Title, and warm the browser cache so the photos are ready when they appear.
  useEffect(() => {
    document.title = `${HER_NICKNAME} · Memories`;
    const images = MEMORY_PHOTOS.map(({ src }) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      return img;
    });
    return () => images.forEach((img) => (img.src = ''));
  }, []);

  // The single gate for every stage change: it must start from the stage we
  // are actually in and be an allowed move, so repeated clicks or late
  // animation callbacks can't trigger a transition twice.
  const go = useCallback((from, to) => {
    if (stageRef.current !== from || !canAdvance(from, to)) return;
    stageRef.current = to;
    setStage(to);
  }, []);

  // Background layers for each stage. The transition, loading and ending
  // stages choreograph most of their own effects.
  useEffect(() => {
    const engine = engineRef.current;
    const atmo = atmoRef.current;
    const flowers = flowersRef.current;
    const photos = photosRef.current;
    const from = prevStage.current;
    prevStage.current = stage;
    scoreRef.current.cue(stage);

    if (stage === GIFT) {
      engine?.resume();
      engine?.setMood('gift', { duration: 3 });
      atmo?.tone('intro', 3);
    } else if (stage === INTRO) {
      flowers?.drizzle(true);
      if (from === CONFIRM) {
        // "Take me back": the circle loosens back into a scattered wall of photos.
        engine?.setMood('intro', { duration: 3 });
        atmo?.tone('intro', 3);
        photos?.scatter();
      }
    } else if (stage === CONFIRM) {
      engine?.setMood('confirm', { duration: 2.5 });
      atmo?.tone('confirm', 2.2);
      engine?.drift(1, 0.3);
      engine?.drift(-1, 1.9);
    } else if (stage === TRANSITION) {
      flowers?.stop(1.6);
    } else if (stage === VIDEO) {
      engine?.suspend(); // nothing renders behind the film
      flowers?.stop(0.2);
      photos?.hide(0.2);
      atmo?.tone('video', 0.4);
    } else if (stage === GIFTS) {
      engine?.setMood('gifts', { duration: 3 });
      atmo?.tone('ending', 2);
      flowers?.drizzle(true);
    }
  }, [stage]);

  // The gift box bursts open: flowers flood the screen and her photos fly out.
  const onGiftOpen = useCallback(({ x, y }) => {
    engineRef.current?.flood(x, y);
    flowersRef.current?.flood(x, y);
    photosRef.current?.burst(x, y);
    atmoRef.current?.bloom();
    scoreRef.current.open();
  }, []);

  const toIntro = useCallback(() => go(GIFT, INTRO), [go]);
  // "Yes, show me": the scattered photos sweep into a turning circle.
  const formCircle = useCallback(() => photosRef.current?.ring(), []);
  const toConfirm = useCallback(() => go(INTRO, CONFIRM), [go]);
  const backToIntro = useCallback(() => go(CONFIRM, INTRO), [go]);
  // "I'm sure": unlock the video inside the click, and pull the circle into the light.
  const onSure = useCallback(() => {
    videoRef.current?.prime();
    photosRef.current?.collapse(3);
  }, []);
  const toTransition = useCallback(() => go(CONFIRM, TRANSITION), [go]);
  const toLoading = useCallback(() => go(TRANSITION, LOADING), [go]);
  const toVideo = useCallback(() => go(LOADING, VIDEO), [go]);
  const toEnding = useCallback(() => go(VIDEO, ENDING), [go]);
  const openGifts = useCallback(() => go(ENDING, GIFTS), [go]);
  const replayVideo = useCallback(() => go(stageRef.current, VIDEO), [go]);
  const restart = useCallback(() => {
    videoRef.current?.reset();
    photosRef.current?.reset();
    flowersRef.current?.stop(0.4);
    go(stageRef.current, GIFT);
  }, [go]);

  const fx = useMemo(
    () => ({
      sparkle: (x, y) => engineRef.current?.sparkle(x, y),
      chime: () => scoreRef.current.chime(),
    }),
    [],
  );

  return (
    <div className="app" data-stage={stage}>
      <Atmosphere ref={atmoRef} />
      <MemoryVideo ref={videoRef} stage={stage} onEnded={toEnding} onStartOver={restart} />
      <FlowerRain ref={flowersRef} />
      <PhotoOrbit ref={photosRef} />

      {stage === GIFT && <GiftBox onOpen={onGiftOpen} onDone={toIntro} />}
      {stage === INTRO && (
        <Question
          eyebrow={INTRO_CREDIT}
          heading={`${HER_NAME}, do you want to see your memories?`}
          primary="Yes, show me"
          secondary="No, not yet"
          restLines={NOT_YET}
          delay={0.8}
          onBeforePrimary={formCircle}
          onPrimary={toConfirm}
          engineRef={engineRef}
        />
      )}
      {stage === CONFIRM && (
        <Question
          heading={`Are you sure you’re ready, ${HER_NAME}?`}
          primary="I’m sure"
          secondary="Take me back"
          entrance="focus"
          primaryExit="dissolve"
          delay={0.6}
          onBeforePrimary={onSure}
          onPrimary={toTransition}
          onSecondary={backToIntro}
          engineRef={engineRef}
        />
      )}
      {stage === TRANSITION && <Anticipation engineRef={engineRef} atmoRef={atmoRef} onDone={toLoading} />}
      {stage === LOADING && <Loader engineRef={engineRef} atmoRef={atmoRef} onDone={toVideo} />}
      {stage === ENDING && (
        <Ending engineRef={engineRef} atmoRef={atmoRef} onOpenGifts={openGifts} onRestart={restart} onReplayVideo={replayVideo} />
      )}
      {stage === GIFTS && <GiftRoom fx={fx} onRestart={restart} onReplayVideo={replayVideo} />}

      <Scene ref={engineRef} />
      {soundOn && <SoundToggle muted={muted} onToggle={toggleSound} hidden={stage === VIDEO} />}
    </div>
  );
}
