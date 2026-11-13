import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player as harness, testSongs } from './harness.mjs';

/* jsdom reports a hidden document unless told otherwise */
const player = (t, opts = {}) => harness(t, {
  ...opts,
  before(w) {
    Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => false });
    if (opts.before) opts.before(w);
  },
});

function threeLines() {
  const songs = testSongs(['a', 'b']);
  songs[0].sections[0].lines.push({ sin: 'three', en: 'three' });
  return songs;
}
const active = (p) => p.all('.lyric').findIndex((n) => n.getAttribute('aria-current') === 'true');

/* --- "Buffering…" after a stall ------------------------------------------ */

test('a stall of 2s while playing says "Buffering…"; playing again clears it', async (t) => {
  const p = await player(t, { clock: true });
  const status = p.query('.player-status');
  p.query('.btn-play').click();
  p.audio.emit('waiting');
  p.clock.advance(1999);
  assert.equal(status.textContent, '');
  p.clock.advance(1);
  assert.equal(status.textContent, 'Buffering…');
  assert.equal(status.getAttribute('role'), 'status');
  p.audio.emit('playing');
  assert.equal(status.textContent, '');
});

test('a short wait says nothing, and pause, seeked or a track change clear the message', async (t) => {
  const p = await player(t, { clock: true });
  const status = p.query('.player-status');
  p.query('.btn-play').click();
  p.audio.emit('waiting');
  p.clock.advance(500);
  p.audio.emit('playing');
  p.clock.advance(5000);
  assert.equal(status.textContent, '', 'a short wait is not worth a message');
  for (const clear of [
    () => p.audio.emit('seeked'),
    () => p.query('.btn-play').click(),               // pause
    () => p.query('.track[data-i="1"]').click(),
  ]) {
    if (p.audio.paused) p.query('.btn-play').click();
    p.audio.emit('waiting');
    p.clock.advance(2000);
    assert.equal(status.textContent, 'Buffering…');
    clear();
    assert.equal(status.textContent, '');
  }
});

test('a load error replaces "Buffering…" and is not overwritten by it', async (t) => {
  const p = await player(t, { clock: true });
  const status = p.query('.player-status');
  p.query('.btn-play').click();
  p.audio.emit('waiting');
  p.clock.advance(1000);
  p.audio.fail();
  p.clock.advance(5000);
  assert.match(status.textContent, /couldn.t be loaded/);
});

test('waiting while paused (preloading) says nothing', async (t) => {
  const p = await player(t, { clock: true });
  p.audio.emit('waiting');
  p.clock.advance(5000);
  assert.equal(p.query('.player-status').textContent, '');
});

/* --- the active line switches on time, not on the next timeupdate --------- */

test('while playing, the next line lights at its time without waiting for timeupdate', async (t) => {
  const p = await player(t, { songs: threeLines(), clock: true });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  p.query('.btn-play').click();
  p.audio.currentTime = 12;
  p.audio.emit('timeupdate');
  assert.equal(active(p), 0);
  assert.deepEqual(p.clock.pending(), [8000]);
  p.audio.currentTime = 20;                            // the media clock moves on
  p.clock.advance(8000);
  assert.equal(active(p), 1);
  assert.deepEqual(p.clock.pending(), [10000], 'armed for the line after');
  p.audio.currentTime = 30;
  p.clock.advance(10000);
  assert.equal(active(p), 2);
  assert.deepEqual(p.clock.pending(), [], 'nothing after the last line');
});

test('a timer that fires a little early re-arms instead of switching twice', async (t) => {
  const p = await player(t, { songs: threeLines(), clock: true });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  p.query('.btn-play').click();
  p.audio.currentTime = 12;
  p.audio.emit('timeupdate');
  const switches = [];
  new p.w.MutationObserver((m) => switches.push(...m.filter((x) => x.attributeName === 'aria-current' && x.target.getAttribute('aria-current'))))
    .observe(p.query('.lyrics__scroller'), { attributes: true, subtree: true, attributeFilter: ['aria-current'] });
  p.audio.currentTime = 19.995;                        // the media clock lags the timer a hair
  p.clock.advance(8000);
  assert.equal(active(p), 0);
  assert.equal(p.clock.pending().length, 1);
  assert.ok(p.clock.pending()[0] > 0);
  p.audio.currentTime = 20.02;
  p.clock.advance(p.clock.pending()[0]);
  p.audio.emit('timeupdate');
  await new Promise((r) => setImmediate(r));
  assert.equal(active(p), 1);
  assert.equal(switches.length, 1, 'one switch, not two');
});

test('the line timer follows seeks and the playback rate', async (t) => {
  const p = await player(t, { songs: threeLines(), clock: true });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  p.query('.btn-play').click();
  p.audio.currentTime = 25;
  p.audio.emit('seeked');
  assert.equal(active(p), 1);
  assert.deepEqual(p.clock.pending(), [5000]);
  p.audio.playbackRate = 2;
  p.audio.emit('ratechange');
  assert.deepEqual(p.clock.pending(), [2500]);
});

test('no line timer runs while paused, stalled, ended, failed or hidden', async (t) => {
  let hidden = false;
  const p = await player(t, {
    songs: threeLines(), clock: true,
    before(w) { Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden }); },
  });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  const play = () => { if (p.audio.paused) p.query('.btn-play').click(); p.audio.currentTime = 12; p.audio.emit('timeupdate'); };
  play();
  assert.deepEqual(p.clock.pending(), [8000]);
  p.query('.btn-play').click();                        // pause
  assert.deepEqual(p.clock.pending(), []);
  p.audio.emit('timeupdate');                          // a paused timeupdate does not arm it
  assert.deepEqual(p.clock.pending(), []);
  play();
  hidden = true;
  p.w.document.dispatchEvent(new p.w.Event('visibilitychange'));
  assert.deepEqual(p.clock.pending(), []);
  p.audio.emit('timeupdate');
  assert.deepEqual(p.clock.pending(), [], 'not while hidden either');
  hidden = false;
  p.w.document.dispatchEvent(new p.w.Event('visibilitychange'));
  assert.deepEqual(p.clock.pending(), [8000]);
  p.audio.emit('waiting');                             // stalled: only the 2s buffering timer
  assert.deepEqual(p.clock.pending(), [2000]);
  p.audio.emit('playing');
  assert.deepEqual(p.clock.pending(), [8000]);
  p.audio.paused = true;
  p.audio.emit('ended');
  assert.deepEqual(p.clock.pending(), []);
  play();
  p.audio.fail();
  assert.deepEqual(p.clock.pending(), []);
});

test('changing track drops the old line timer', async (t) => {
  const p = await player(t, { songs: threeLines(), clock: true });
  await p.lyrics(0, '[00:10]one\n[00:20]two\n[00:30]three');
  p.query('.btn-play').click();
  p.audio.currentTime = 12;
  p.audio.emit('timeupdate');
  p.query('.track[data-i="1"]').click();
  assert.deepEqual(p.clock.pending(), []);
});
