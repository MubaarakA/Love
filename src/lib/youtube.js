// YouTube support for the memory video, via the official IFrame Player API.

/** Returns the video id for any common YouTube link, or null for other URLs. */
export function parseYouTubeId(url) {
  try {
    const u = new URL(url, window.location.href);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{6,})/);
      return m ? m[2] : null;
    }
  } catch {
    // not a URL at all
  }
  return null;
}

let apiPromise = null;

/** Loads https://www.youtube.com/iframe_api once and resolves with window.YT. */
export function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error('The YouTube player could not be loaded.'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

// YT.PlayerState values, named.
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
