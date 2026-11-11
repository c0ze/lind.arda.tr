import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { player, tick } from './harness.mjs';

const key = (p, node, k) => node.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

test('Tengwar (private-use glyphs) is hidden from screen readers on the stage', async (t) => {
  const p = await player(t);
  assert.equal(p.query('[data-np="teng"]').getAttribute('aria-hidden'), 'true');
  assert.ok(p.all('.lyric__teng').every((n) => n.getAttribute('aria-hidden') === 'true'));
});

test('Sindarin text is marked lang="sjn" everywhere it appears', async (t) => {
  const p = await player(t);
  for (const sel of ['.lyric__rom', '[data-np="rom"]', '.track__rom', '.song__rom', '.a-line__rom']) {
    const nodes = p.all(sel);
    assert.ok(nodes.length, sel);
    assert.ok(nodes.every((n) => n.getAttribute('lang') === 'sjn'), sel);
  }
  const titles = p.all('.colophon__note em');
  assert.equal(titles.length, 3);
  assert.ok(titles.every((n) => n.getAttribute('lang') === 'sjn'));
});

test('timed lyric lines become keyboard buttons; untimed ones stay plain text', async (t) => {
  const p = await player(t);
  assert.ok(p.all('.lyric').every((n) => !n.hasAttribute('tabindex') && !n.hasAttribute('role')));
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  assert.ok(p.all('.lyric').every((n) => n.getAttribute('role') === 'button' && n.getAttribute('tabindex') === '0'));
  const missing = await player(t);
  missing.requests[0].resolve({ ok: false, status: 404, text: async () => '' });
  await tick();
  assert.ok(missing.all('.lyric').every((n) => !n.hasAttribute('tabindex')));
});

test('Enter or Space on a focused line seeks there and plays', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  const [one, two] = p.all('.lyric');
  key(p, two, 'a');
  assert.equal(p.audio.paused, true);
  key(p, two, 'Enter');
  assert.equal(p.audio.currentTime, 20);
  assert.equal(p.audio.paused, false);
  const space = new p.w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  one.dispatchEvent(space);
  assert.equal(p.audio.currentTime, 10);
  assert.equal(space.defaultPrevented, true, 'Space does not scroll the page');
});

test('the active line carries aria-current', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  p.audio.currentTime = 25;
  p.audio.emit('timeupdate');
  assert.deepEqual(p.all('.lyric').map((n) => n.getAttribute('aria-current')), [null, 'true']);
  p.audio.currentTime = 0;
  p.audio.emit('timeupdate');
  assert.deepEqual(p.all('.lyric').map((n) => n.getAttribute('aria-current')), [null, null]);
});

test('a keyboard-focused line is brought into the window', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  const box = p.query('.lyrics');
  const two = p.query('.lyric[data-idx="1"]');
  Object.defineProperty(box, 'clientHeight', { value: 200 });
  Object.defineProperty(two, 'offsetTop', { value: 400 });
  Object.defineProperty(two, 'offsetHeight', { value: 40 });
  two.focus();
  assert.equal(p.query('.lyrics__scroller').style.transform, 'translateY(-320px)');
});

test('theme buttons keep their text name on narrow screens (clipped, not display:none)', async () => {
  const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');
  const narrow = /@media \(max-width: 760px\) \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.doesNotMatch(narrow, /\.themeswitch \.lbl \{[^}]*display:\s*none/);
  assert.match(narrow, /\.themeswitch \.lbl \{[^}]*clip-path: inset\(50%\)/);
});

test('the seek slider counts seconds and says where it is in words', async (t) => {
  const songs = (await import('./harness.mjs')).testSongs(['a', 'b']);
  songs[0].duration = 226.12; songs[1].duration = 128.56;
  const p = await player(t, { songs, ready: false });
  const scrub = p.query('.scrub');
  assert.equal(scrub.max, '227');
  assert.equal(scrub.step, '1');
  assert.equal(scrub.getAttribute('aria-valuetext'), '0:00 of 3:46');
  p.audio.currentTime = 83.4;
  p.audio.paused = false;
  p.audio.emit('timeupdate');
  assert.equal(scrub.value, '83');
  assert.equal(scrub.getAttribute('aria-valuetext'), '1:23 of 3:46');
  scrub.value = '100';
  scrub.dispatchEvent(new p.w.Event('input'));
  assert.equal(p.audio.currentTime, 100);
  assert.equal(scrub.getAttribute('aria-valuetext'), '1:40 of 3:46');
  p.query('.track[data-i="1"]').click();
  assert.equal(scrub.max, '129');
  assert.equal(scrub.getAttribute('aria-valuetext'), '0:00 of 2:08');
  p.audio.readyState = 1;
  p.audio.duration = 130.2;
  p.audio.emit('loadedmetadata');
  assert.equal(scrub.max, '131');
  assert.equal(scrub.getAttribute('aria-valuetext'), '0:00 of 2:10');
});

test('a waiting share-link time is what the slider announces', async (t) => {
  const p = await player(t, { hash: '#t=42' });
  assert.equal(p.query('.scrub').getAttribute('aria-valuetext'), '0:42 of 1:40');
  assert.equal(p.query('.scrub').value, '42');
});
