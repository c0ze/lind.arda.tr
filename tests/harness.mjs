/* Shared jsdom harness for the player tests: loads index.html, swaps in a
   scriptable fake <audio>, fake lyrics fetches and test songs, then runs
   assets/app.js against it. Not a test file itself (no .test.mjs suffix). */
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

export const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
export const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
export const tick = () => new Promise((resolve) => setImmediate(resolve));

export function testSongs(ids = ['a', 'b'], duration = 100) {
  return ids.map((id) => ({
    id, title: id, titleEn: id, audio: `${id}.mp3`, audioFlac: `${id}.flac`, lrc: `${id}.lrc`, duration,
    sections: [{ kind: 'verse', lines: [{ sin: 'one', en: 'one' }, { sin: 'two', en: 'two' }] }],
  }));
}

/* Options:
   hash            location hash at load ("#t=…&song=…")
   storage         localStorage entries set before the app runs
   blockedStorage  every localStorage call throws
   flac            what canPlayType("audio/flac") answers ("" or "probably")
   ready           fake audio starts with metadata loaded (readyState 4) or not (0)
   playRejects     play() rejects with a DOMException of this name
   mediaSession    install a recording navigator.mediaSession + MediaMetadata
   reduce          prefers-reduced-motion answer (default true: no animation)
   keepCanvas      keep the hero canvas (the motes tests stub it themselves)
   songs           window.ARDA_SONGS
   before(w)       runs just before app.js, for extra stubs */
export async function player(t, opts = {}) {
  const {
    hash = '', storage = {}, blockedStorage = false, flac = '', ready = true, playRejects = null,
    mediaSession = false, reduce = true, keepCanvas = false, songs = testSongs(), before,
  } = opts;
  const dom = new JSDOM(html, { url: 'https://lind.example/' + hash, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  if (w.document.readyState === 'loading') {
    await new Promise((resolve) => w.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  if (!keepCanvas) w.document.querySelector('canvas').remove();
  w.matchMedia = () => ({ matches: reduce });
  const scrolled = [];
  w.HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this); };
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  if (blockedStorage) {
    w.Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
    w.Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  }
  const audio = [];
  w.Audio = class extends w.EventTarget {
    paused = true;
    currentTime = 0;
    duration = 100;
    volume = 1;
    muted = false;
    playbackRate = 1;
    src = '';
    error = null;
    readyState = ready ? 4 : 0;
    constructor() { super(); audio.push(this); }
    get seekable() {
      const d = this.duration, on = this.readyState >= 1;
      return { length: on ? 1 : 0, start: () => 0, end: () => d };
    }
    canPlayType(type) { return type === 'audio/flac' ? flac : ''; }
    play() {
      if (playRejects) return Promise.reject(new w.DOMException('play() failed', playRejects));
      this.paused = false;
      this.dispatchEvent(new w.Event('play'));
      return Promise.resolve();
    }
    pause() { this.paused = true; this.dispatchEvent(new w.Event('pause')); }
    emit(type) { this.dispatchEvent(new w.Event(type)); }
    load() { this.readyState = 4; this.emit('loadedmetadata'); }
    fail(code = 4) { this.error = { code }; this.paused = true; this.emit('error'); }
  };
  let session = null;
  if (mediaSession) {
    const handlers = {};
    const positions = [];
    session = {
      metadata: null, playbackState: 'none', handlers, positions,
      setActionHandler(action, fn) { handlers[action] = fn; },
      setPositionState(state) { positions.push(state); },
    };
    Object.defineProperty(w.navigator, 'mediaSession', { value: session, configurable: true });
    w.MediaMetadata = class { constructor(o) { Object.assign(this, o); } };
  }
  w.ARDA_SONGS = songs;
  const requests = [];
  w.fetch = (url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject }));
  if (before) before(w);
  w.eval(source);
  const query = (selector) => w.document.querySelector(selector);
  return {
    w, audio: audio[0], audios: audio, requests, session, scrolled, query,
    all: (selector) => [...w.document.querySelectorAll(selector)],
    current: () => [...w.document.querySelectorAll('.track')].findIndex((x) => x.getAttribute('aria-current') === 'true'),
    async lyrics(index, text) {
      requests[index].resolve({ ok: true, status: 200, text: async () => text });
      await tick();
    },
  };
}
