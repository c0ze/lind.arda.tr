import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { player, testSongs, tick } from './harness.mjs';

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
  assert.equal(space.defaultPrevented, true, 'Space does not scroll the page');
  assert.equal(p.audio.currentTime, 20, 'Space acts on release, like a native button');
  one.dispatchEvent(new p.w.KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
  assert.equal(p.audio.currentTime, 10);
});

test('holding a key on a lyric line does not seek again on every repeat', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  const two = p.query('.lyric[data-idx="1"]');
  const down = (key, repeat) => {
    const e = new p.w.KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });
    two.dispatchEvent(e);
    return e;
  };
  down('Enter', false);
  assert.equal(p.audio.currentTime, 20);
  p.audio.currentTime = 23;                 // playback moves on
  down('Enter', true);
  assert.equal(p.audio.currentTime, 23, 'a repeated Enter is ignored');
  const held = down(' ', true);
  assert.equal(held.defaultPrevented, true, 'a held Space still does not scroll');
  assert.equal(p.audio.currentTime, 23);
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
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  two.focus();
  assert.equal(p.query('.lyrics__scroller').style.transform, 'translateY(-320px)');
});

function layout(p) {   // line k sits at k*100px, 40px tall, in a 200px window
  const box = p.query('.lyrics');
  if (!Object.hasOwn(box, 'clientHeight')) Object.defineProperty(box, 'clientHeight', { value: 200 });
  p.all('.lyric').forEach((n, k) => {
    Object.defineProperty(n, 'offsetTop', { value: k * 100 });
    Object.defineProperty(n, 'offsetHeight', { value: 40 });
  });
}
function threeLines() {
  const songs = testSongs(['a', 'b']);
  songs[0].sections[0].lines.push({ sin: 'three', en: 'three' });
  return songs;
}
const transform = (p) => p.query('.lyrics__scroller').style.transform;
function playTo(p, seconds) {
  p.audio.currentTime = seconds;
  p.audio.paused = false;
  p.audio.emit('timeupdate');
}

test('while keyboard focus is on a lyric line, the lines stop scrolling under it', async (t) => {
  const p = await player(t, { songs: threeLines() });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  layout(p);
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  p.query('.lyric[data-idx="2"]').focus();
  assert.equal(transform(p), 'translateY(-120px)');   // centred on the focused line
  playTo(p, 21);
  assert.equal(p.query('.lyric[data-idx="1"]').getAttribute('aria-current'), 'true', 'the highlight still moves');
  assert.ok(p.query('.lyric[data-idx="1"]').classList.contains('is-active'));
  assert.equal(transform(p), 'translateY(-120px)', 'but focus stays in view');
  p.query('.btn-play').focus();                        // focus leaves the lyrics
  assert.equal(transform(p), 'translateY(-20px)', 'centring resumes on the active line');
  playTo(p, 31);
  assert.equal(transform(p), 'translateY(-120px)');
});

test('clicking a lyric line with the mouse does not freeze the scrolling', async (t) => {
  const p = await player(t, { songs: threeLines() });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  layout(p);
  const one = p.query('.lyric[data-idx="0"]');
  one.dispatchEvent(new p.w.MouseEvent('mousedown', { bubbles: true }));
  one.focus();
  one.click();
  playTo(p, 21);
  assert.equal(transform(p), 'translateY(-20px)');
  // keyboard focus first, then a mouse click on that same line: scrolling resumes
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  const three = p.query('.lyric[data-idx="2"]');
  three.focus();
  three.dispatchEvent(new p.w.MouseEvent('mousedown', { bubbles: true }));
  three.click();
  playTo(p, 11);
  assert.equal(transform(p), 'translateY(80px)');
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

test('timed lyric buttons are named by their Sindarin and English text in every view', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  for (const line of p.all('.lyric')) {
    const ids = (line.getAttribute('aria-labelledby') || '').split(' ').filter(Boolean);
    assert.equal(ids.length, 2, 'Sindarin, then English');
    const [rom, en] = ids.map((id) => p.w.document.getElementById(id));
    assert.equal(rom, line.querySelector('.lyric__rom'));
    assert.equal(rom.getAttribute('lang'), 'sjn');
    assert.equal(en, line.querySelector('.lyric__en'));
    assert.equal(en.getAttribute('lang'), 'en');
  }
  // the name is referenced, so hiding text in the Tengwar-only view does not empty it
  p.query('.viewtoggle [data-view="teng"]').click();
  assert.ok(p.query('.lyric').getAttribute('aria-labelledby'));
});

test('pressing the mouse on a line does not move the lines before the click lands', async (t) => {
  const p = await player(t, { songs: threeLines() });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  layout(p);
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  p.query('.lyric[data-idx="2"]').focus();           // keyboard hold on line 3
  playTo(p, 11);                                       // active line 1, scroller held on line 3
  assert.equal(transform(p), 'translateY(-120px)');
  const one = p.query('.lyric[data-idx="0"]');
  one.dispatchEvent(new p.w.MouseEvent('pointerdown', { bubbles: true }));
  one.dispatchEvent(new p.w.MouseEvent('mousedown', { bubbles: true }));
  assert.equal(transform(p), 'translateY(-120px)', 'nothing moves under the pointer');
  one.dispatchEvent(new p.w.MouseEvent('mouseup', { bubbles: true }));
  one.click();
  assert.equal(p.audio.currentTime, 10);
  assert.equal(transform(p), 'translateY(80px)', 'centring resumes after the click');
});

test('a pointer press that never becomes a click still resumes centring', async (t) => {
  const p = await player(t, { songs: threeLines() });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  layout(p);
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  p.query('.lyric[data-idx="2"]').focus();
  playTo(p, 11);
  p.query('.lyric[data-idx="0"]').dispatchEvent(new p.w.MouseEvent('mousedown', { bubbles: true }));
  p.w.document.body.dispatchEvent(new p.w.MouseEvent('mouseup', { bubbles: true }));   // dragged off
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(transform(p), 'translateY(80px)');
});

test('changing track releases a keyboard hold on the old lyrics', async (t) => {
  const p = await player(t, { songs: threeLines(), mediaSession: true });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  layout(p);
  p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  p.query('.lyric[data-idx="1"]').focus();
  p.session.handlers.nexttrack();                      // the focused line is removed with the old lyrics
  await p.lyrics(1, '[00:10]one\n[00:20]two');
  layout(p);
  playTo(p, 21);
  assert.equal(transform(p), 'translateY(-20px)', 'the new lyrics follow the song');
});

test('pressing a key on a line focused by the mouse holds it in view', async (t) => {
  const p = await player(t, { songs: threeLines() });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  layout(p);
  const three = p.query('.lyric[data-idx="2"]');
  three.dispatchEvent(new p.w.MouseEvent('mousedown', { bubbles: true }));
  three.focus();
  three.click();                                       // seeks to 30
  playTo(p, 30);
  assert.equal(transform(p), 'translateY(-120px)', 'line 3 is active and centred');
  three.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));   // now on the keyboard
  playTo(p, 11);
  assert.equal(transform(p), 'translateY(-120px)', 'the focused line stays put');
  assert.equal(p.query('.lyric[data-idx="0"]').getAttribute('aria-current'), 'true');
});

test('Space released on a line only activates it if it was pressed there', async (t) => {
  const p = await player(t);
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  const [one, two] = p.all('.lyric');
  const key = (node, type, k = ' ') => node.dispatchEvent(new p.w.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
  key(two, 'keyup');                                   // Space held elsewhere, released here
  assert.equal(p.audio.currentTime, 0);
  assert.equal(p.audio.paused, true);
  key(one, 'keydown');
  one.dispatchEvent(new p.w.FocusEvent('blur'));       // focus moved away while held
  key(one, 'keyup');
  assert.equal(p.audio.currentTime, 0);
  key(two, 'keydown');
  key(two, 'keyup');
  assert.equal(p.audio.currentTime, 20);
});
