import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { html, player, testSongs, tick } from './harness.mjs';

const pressedThemes = (p) => p.all('.themeswitch button')
  .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.themeName);

test('a stored theme that is not one of the three is ignored', async (t) => {
  for (const stored of ['dawn', '"><x', '']) {
    const p = await player(t, { storage: { 'arda-theme': stored } });
    assert.equal(p.w.document.documentElement.getAttribute('data-theme'), 'twilight', stored);
    assert.deepEqual(pressedThemes(p), ['twilight'], stored);
  }
  const ember = await player(t, { storage: { 'arda-theme': 'ember' } });
  assert.equal(ember.w.document.documentElement.getAttribute('data-theme'), 'ember');
  assert.deepEqual(pressedThemes(ember), ['ember']);
});

test('the early theme script in <head> validates the stored theme too', async (t) => {
  const inline = /<script>(try\{[^<]*arda-theme[^<]*)<\/script>/.exec(html);
  assert.ok(inline, 'index.html has the inline theme script');
  for (const [stored, expected] of [['dawn', 'twilight'], ['x" onload="y', 'twilight'], ['moonlit', 'moonlit']]) {
    const dom = new JSDOM(html, { url: 'https://lind.example/', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    dom.window.localStorage.setItem('arda-theme', stored);
    dom.window.eval(inline[1]);
    assert.equal(dom.window.document.documentElement.getAttribute('data-theme'), expected, stored);
  }
});

test('Tengwar and section labels are escaped before they reach innerHTML', async (t) => {
  const songs = testSongs(['a']);
  songs[0].sections[0].kind = '<i>verse</i>';
  const p = await player(t, {
    songs,
    before(w) { w.ARDA_TENGWAR = { one: '<img src="x">', a: '<b>a</b>' }; },
  });
  assert.equal(p.w.document.querySelectorAll('#stage img, #archive img, #archive b, #archive i').length, 0);
  assert.equal(p.query('.lyric__teng').textContent, '<img src="x">');
  assert.equal(p.query('.a-line__teng').textContent, '<img src="x">');
  assert.equal(p.query('.song__teng').textContent, '<b>a</b>');
  assert.equal(p.query('.sect__label').textContent, '<i>verse</i>');
});

const FAILED = /couldn.t be loaded/;
const MISSING = 'Lyrics sync follows once a timed .lrc is added.';

test('a failed lyrics fetch gets visitor copy, not the developer note', async (t) => {
  const offline = await player(t);
  offline.requests[0].reject(new TypeError('Failed to fetch'));
  await tick();
  assert.match(offline.query('.lyrics-hint').textContent, FAILED);
  const broken = await player(t);
  broken.requests[0].resolve({ ok: false, status: 503, text: async () => '' });
  await tick();
  assert.match(broken.query('.lyrics-hint').textContent, FAILED);
});

test('a genuinely missing .lrc keeps the original note', async (t) => {
  const p = await player(t);
  p.requests[0].resolve({ ok: false, status: 404, text: async () => '' });
  await tick();
  assert.equal(p.query('.lyrics-hint').textContent, MISSING);
  const songs = testSongs(['a']);
  delete songs[0].lrc;
  const none = await player(t, { songs });
  await tick();
  assert.equal(none.query('.lyrics-hint').textContent, MISSING);
});

function clipboard(w, writeText) {
  Object.defineProperty(w.navigator, 'clipboard', { value: writeText && { writeText }, configurable: true });
}

test('Share copies a link to the current moment and says so', async (t) => {
  const p = await player(t);
  let copied = null;
  clipboard(p.w, async (text) => { copied = text; });
  p.query('.track[data-i="1"]').click();
  p.audio.currentTime = 12.34;
  p.query('.btn-share').click();
  await tick();
  assert.equal(copied, 'https://lind.example/#t=12.3&song=b');
  const status = p.query('.share-status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.ok(status.classList.contains('visually-hidden'));
  assert.equal(status.textContent, 'Link copied');
  assert.ok(p.query('.btn-share').classList.contains('is-copied'));
});

test('Share before playing a share link passes the linked moment on', async (t) => {
  const p = await player(t, { hash: '#t=1:30&song=b' });
  let copied = null;
  clipboard(p.w, async (text) => { copied = text; });
  p.query('.btn-share').click();
  await tick();
  assert.equal(copied, 'https://lind.example/#t=90.0&song=b');
});

test('a refused clipboard falls back to a selection copy', async (t) => {
  const p = await player(t);
  clipboard(p.w, () => Promise.reject(new Error('denied')));
  const commands = [];
  p.w.document.execCommand = (cmd) => { commands.push(cmd); return true; };
  p.query('.btn-share').click();
  await tick(); await tick();
  assert.deepEqual(commands, ['copy']);
  assert.equal(p.query('.share-status').textContent, 'Link copied');
  assert.equal(p.w.document.querySelector('textarea'), null, 'the helper textarea is removed');
});

test('when no copy works, Share says it could not copy', async (t) => {
  const p = await player(t);
  clipboard(p.w, () => Promise.reject(new Error('denied')));
  p.w.document.execCommand = () => false;
  p.query('.btn-share').click();
  await tick(); await tick();
  assert.equal(p.query('.share-status').textContent, 'Couldn’t copy the link');
  assert.ok(!p.query('.btn-share').classList.contains('is-copied'));
});

test('without the async clipboard API the selection copy is used', async (t) => {
  const p = await player(t);
  clipboard(p.w, null);
  p.w.document.execCommand = () => true;
  p.query('.btn-share').click();
  await tick(); await tick();
  assert.equal(p.query('.share-status').textContent, 'Link copied');
});

test('the selection copy gives keyboard focus back to the Share button', async (t) => {
  const p = await player(t, {
    before(w) { w.HTMLTextAreaElement.prototype.select = function () { this.focus(); }; },   // as Chromium does
  });
  clipboard(p.w, () => Promise.reject(new Error('denied')));
  p.w.document.execCommand = () => true;
  const share = p.query('.btn-share');
  share.focus();
  let scrolled = null;
  const focus = share.focus;
  share.focus = function (opts) { scrolled = opts; return focus.call(this, opts); };
  share.click();
  await tick(); await tick();
  assert.equal(p.query('.share-status').textContent, 'Link copied');
  assert.equal(p.w.document.activeElement, share);
  assert.equal(scrolled?.preventScroll, true, "without scrolling the page");
});
