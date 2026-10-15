// Every cinematic beat, in seconds. Tweak pacing here.

// "I'm sure" → "Some moments stay with us forever."
export const TRANSITION = {
  burst: 1.9, // particles that gathered at the centre bloom outward
  title: 2.4, // the title starts to come into focus
  hold: 1.7, // how long it rests once fully visible
};

// The streaming-style loading screen (~5.7s in total).
export const LOADING = {
  progress: 4.8, // progress line + ring, start to finish
  reveal: 0.9, // the line collapses into a slit of light that opens onto the video
};

// After the video's `ended` event.
export const ENDING = {
  title: 2.4, // "You lived a life that was worth it."
  lines: 4.9, // first of the "Every …" lines
  lineGap: 1.25,
  final: 0.8, // extra pause before "It all mattered."
  blooms: 5.6,
  actions: 12.2, // "Watch again"
};
