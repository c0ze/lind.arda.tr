import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function player(t, { blockedStorage = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://lind.example/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  if (w.document.readyState === 'loading') {
    await new Promise((resolve) => w.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  w.document.querySelector('canvas').remove();
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const audio = [];
  w.Audio = class extends w.EventTarget {
    paused = true;
    currentTime = 0;
    duration = 100;
    canPlayType() { return ''; }
    constructor() { super(); audio.push(this); }
    play() { this.paused = false; this.dispatchEvent(new w.Event('play')); return Promise.resolve(); }
    pause() { this.paused = true; this.dispatchEvent(new w.Event('pause')); }
  };
  w.ARDA_SONGS = ['a', 'b'].map((id) => ({
    id, title: id, titleEn: id, audio: `${id}.mp3`, lrc: `${id}.lrc`, duration: 100,
    sections: [{ kind: 'verse', lines: [{ sin: 'one', en: 'one' }, { sin: 'two', en: 'two' }] }],
  }));
  const requests = [];
  w.fetch = (url) => new Promise((resolve) => requests.push({ url, resolve }));
  if (blockedStorage) {
    w.Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
    w.Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  }
  w.eval(source);
  return {
    w, audio: audio[0], requests,
    query: (selector) => w.document.querySelector(selector),
    async lyrics(index, text) {
      requests[index].resolve({ ok: true, text: async () => text });
      await tick();
    },
  };
}

test('clicking a timed lyric starts playback from that line', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  p.query('.lyric').click();
  assert.equal(p.audio.currentTime, 10);
  assert.equal(p.audio.paused, false);
});

test('late lyrics from an old selection cannot change the current track timings', async (t) => {
  const p = await player(t);
  p.query('.track[data-i="1"]').click();
  await p.lyrics(1, '[00:30]one\n[00:40]two');
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  p.query('.lyric').click();
  assert.equal(p.audio.currentTime, 30);
});

test('seeking before the first lyric clears the previous highlight', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  Object.defineProperty(p.query('.lyric[data-idx="1"]'), 'offsetTop', { value: 300 });
  p.audio.currentTime = 25;
  p.audio.dispatchEvent(new p.w.Event('timeupdate'));
  assert.ok(p.query('.lyric.is-active'));
  p.audio.currentTime = 0;
  p.audio.dispatchEvent(new p.w.Event('timeupdate'));
  assert.equal(p.query('.lyric.is-active'), null);
  assert.equal(p.query('.lyric.is-past'), null);
  assert.equal(p.query('.lyrics__scroller').style.transform, 'translateY(0px)');
});

test('returning to a track ignores lyrics from its earlier selection', async (t) => {
  const p = await player(t);
  p.query('.track[data-i="1"]').click();
  p.query('.track[data-i="0"]').click();
  await p.lyrics(2, '[00:30]one\n[00:40]two');
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  p.query('.lyric').click();
  assert.equal(p.audio.currentTime, 30);
});


test('blocked storage does not stop the player or its preference controls', async (t) => {
  const p = await player(t, { blockedStorage: true });
  p.query('[data-theme-name="moonlit"]').click();
  assert.equal(p.query('[data-theme-name="moonlit"]').getAttribute('aria-pressed'), 'true');
  p.query('.btn-loop').click();
  assert.equal(p.query('.btn-loop').getAttribute('aria-pressed'), 'false');
  p.query('.vol__btn').click();
  assert.equal(p.audio.volume, 0);
  p.query('.btn-play').click();
  assert.equal(p.audio.paused, false);
});

test('changing lyric view recenters the active line with its new height', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  const box = p.query('.lyrics');
  const line = p.query('.lyric');
  Object.defineProperty(box, 'clientHeight', { value: 200 });
  Object.defineProperty(line, 'offsetTop', { get: () => box.dataset.view === 'all' ? 100 : 60 });
  Object.defineProperty(line, 'offsetHeight', { get: () => box.dataset.view === 'all' ? 40 : 20 });
  p.audio.currentTime = 15;
  p.audio.dispatchEvent(new p.w.Event('timeupdate'));
  assert.equal(p.query('.lyrics__scroller').style.transform, 'translateY(-20px)');
  p.query('.viewtoggle [data-view="en"]').click();
  assert.equal(p.query('.lyrics__scroller').style.transform, 'translateY(30px)');
});
