// Files in /public must be addressed through Vite's base URL so they also work
// when the site is hosted in a subfolder (GitHub Pages: /Love/). Full URLs
// (https://…, YouTube links) are left untouched.
const asset = (path) => (/^[a-z]+:\/\//i.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\//, ''));

// ─────────────────────────────────────────────────────────────────────────────
//  Your memory video.
//
//  A file in /public (e.g. "/video/memories.mp4"), a direct .mp4/.webm URL,
//  or a YouTube link (watch, youtu.be, shorts or embed URLs all work — the
//  video must allow embedding), e.g. "https://www.youtube.com/watch?v=H5ExSyGTgt4".
// ─────────────────────────────────────────────────────────────────────────────
export const MEMORY_VIDEO_URL = asset("/video/memories.mp4");

// Who this is for. Used everywhere in the experience, so it stays consistent.
export const HER_NAME = 'Zeynab';
export const HER_NICKNAME = 'Zeynab_For_Real';
// Optional: your name, used to sign the love letter. Leave empty to sign "Always yours".
export const FROM_NAME = '';

// ─────────────────────────────────────────────────────────────────────────────
//  Her photos, in /public/photos. They burst out of the gift box, circle the
//  question, flash by in the transition, line the loading screen and drift
//  behind the final message. Add or remove entries freely.
// ─────────────────────────────────────────────────────────────────────────────
export const MEMORY_PHOTOS = [
  { src: asset('/photos/zeynab-1.jpg'), alt: `${HER_NAME}, smiling with her hand on her cheek` },
  { src: asset('/photos/zeynab-2.jpg'), alt: `${HER_NAME}, chin in her hand` },
  { src: asset('/photos/zeynab-3.jpg'), alt: `${HER_NAME} in a pink hijab` },
  { src: asset('/photos/zeynab-4.jpg'), alt: `${HER_NAME}, her face cupped in her hands` },
  { src: asset('/photos/zeynab-5.jpg'), alt: `${HER_NAME} in a lilac hijab` },
];

// ─────────────────────────────────────────────────────────────────────────────
//  The gifts she can open after the film. Edit the words to make them yours.
// ─────────────────────────────────────────────────────────────────────────────
export const LOVE_LETTER = [
  `Dear ${HER_NAME},`,
  'Some people pass through our lives quietly, and some people change the light in every room they walk into. You are the second kind.',
  'Every little moment with you has become a memory I keep close — the laughs that came out of nowhere, the quiet talks, even the ordinary days that turned out to be the best ones.',
  'I made this so you could see yourself the way I see you: brave, beautiful, and so much more than you know.',
  'Thank you for being you. Never stop.',
];

export const OPEN_WHEN = [
  { title: 'you miss me', message: `Close your eyes and remember the last time we laughed together. I’m right there, ${HER_NAME}, closer than you think.` },
  { title: 'you can’t sleep', message: 'Breathe in slowly. Count the stars you can’t see. Somewhere, someone is thinking about you and smiling.' },
  { title: 'you need a smile', message: `Remember: you are ${HER_NICKNAME}. The real one. The one and only. That alone should make you grin.` },
  { title: 'you doubt yourself', message: 'Look how far you’ve already come. Every hard day you’ve had, you survived. You are stronger than every doubt.' },
];

export const REASONS = [
  'The way you light up when you talk about something you love.',
  'Your laugh — the real one, the one you can’t stop.',
  'How kind you are, even when nobody is watching.',
  'You make ordinary days feel like memories.',
  'Your strength, quiet and unbreakable.',
  'The way you care for the people around you.',
  'You are beautiful, inside and out.',
  'You never give up, even when it’s hard.',
  'You make the world softer just by being in it.',
  'Because you are you — and that is more than enough.',
];

export const WISH_MESSAGE = `Your wish is on its way, ${HER_NAME}. May every one of them come true.`;
