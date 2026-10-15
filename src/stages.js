// The experience is a small state machine. Every stage change goes through
// `canAdvance`, so a double click or a stale callback can never skip a stage
// or replay a transition that is already running.
export const STAGES = {
  GIFT: 'gift', // a gift box waiting to be opened
  INTRO: 'intro',
  CONFIRM: 'confirm',
  TRANSITION: 'transition',
  LOADING: 'loading',
  VIDEO: 'video',
  ENDING: 'ending',
  GIFTS: 'gifts', // the letter, open-when notes, reasons jar and wish candle
};

const FLOW = {
  gift: ['intro'],
  intro: ['confirm'],
  confirm: ['transition', 'intro'],
  transition: ['loading'],
  loading: ['video'],
  video: ['ending', 'gift'], // 'gift' = "Start over" from the error screen
  ending: ['gifts', 'gift', 'video'], // gifts / "Watch again" / "Replay the video"
  gifts: ['gift', 'video'], // "Watch again" / "Replay the video"
};

export const canAdvance = (from, to) => FLOW[from]?.includes(to) ?? false;
