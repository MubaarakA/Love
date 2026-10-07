// Shared choreography, in seconds. Every layer (DOM, SVG, Three.js) keys off
// these so the cinematic beats line up without components talking to each other.
export const INTRO = {
  curtain: 1.6, // cream veil lifts
  dust: 0.2, // glowing particles begin to appear
  petals: 0.9, // petals start drifting in from the sides
  roses: 1.3,
  heroPetals: [2.0, 2.9, 4.1], // close-to-camera petals sweep across
  greeting: 1.5, // "Hey… I have a little question for you"
  greetingHold: 1.5,
};

export const YES = {
  converge: 0.1, // petals and light streaks rush toward the centre
  burst: 1.5, // the bloom
  message: 2.05, // "I knew you would say yes"
  heart: 2.5, // constellation heart draws behind the message
  subline: 3.5, // "I can't wait for our date"
  hint: 6.2,
};
