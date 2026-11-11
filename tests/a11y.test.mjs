import assert from 'node:assert/strict';
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
