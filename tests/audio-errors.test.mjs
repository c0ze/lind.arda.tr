import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player, tick } from './harness.mjs';

function trackUnhandled(t) {
  const seen = [];
  const h = (reason) => seen.push(reason);
  process.on('unhandledRejection', h);
  t.after(() => process.off('unhandledRejection', h));
  return seen;
}

test('FLAC is chosen where the browser can play it, MP3 otherwise', async (t) => {
  const withFlac = await player(t, { flac: 'probably' });
  assert.equal(withFlac.audio.src, 'a.flac');
  const without = await player(t, { flac: '' });
  assert.equal(without.audio.src, 'a.mp3');
  const noFlacFile = await player(t, { flac: 'probably', songs: [{ ...withFlac.w.ARDA_SONGS[0], audioFlac: undefined }] });
  assert.equal(noFlacFile.audio.src, 'a.mp3');
});

test('a refused play() is caught and leaves a working Play button', async (t) => {
  const unhandled = trackUnhandled(t);
  const p = await player(t, { playRejects: 'NotAllowedError' });
  p.query('.btn-play').click();
  await tick(); await tick();
  assert.equal(unhandled.length, 0);
  assert.equal(p.query('.btn-play').getAttribute('aria-label'), 'Play');
  p.audio.paused = false;
  p.audio.emit('play');   // a stray play later is still held by the play gate
  assert.equal(p.audio.paused, true);
});

test('an aborted play() (a newer load replaced it) is ignored quietly', async (t) => {
  const unhandled = trackUnhandled(t);
  const p = await player(t, { playRejects: 'AbortError' });
  p.query('.btn-play').click();
  await tick(); await tick();
  assert.equal(unhandled.length, 0);
  assert.equal(p.query('.player-status').textContent, '');
});

test('a FLAC that fails while playing is retried once as MP3 from the same moment', async (t) => {
  const p = await player(t, { flac: 'probably' });
  p.query('.btn-play').click();
  p.audio.currentTime = 30;
  p.audio.fail();
  assert.equal(p.audio.src, 'a.mp3');
  assert.equal(p.audio.currentTime, 30);
  assert.equal(p.audio.paused, false);
  assert.equal(p.query('.player-status').textContent, '');
});

test('a FLAC that fails before Play keeps the link time and stays paused on MP3', async (t) => {
  const p = await player(t, { flac: 'probably', hash: '#t=42' });
  p.audio.fail();
  assert.equal(p.audio.src, 'a.mp3');
  assert.equal(p.audio.paused, true);
  assert.equal(p.query('.time--cur').textContent, '0:42');
  p.query('.btn-play').click();
  assert.equal(p.audio.currentTime, 42);
});

test('a FLAC failing while a link seek waits keeps that target for the MP3', async (t) => {
  const p = await player(t, { flac: 'probably', hash: '#t=42', ready: false });
  p.query('.btn-play').click();   // seek deferred: no metadata yet
  p.audio.fail();
  assert.equal(p.audio.src, 'a.mp3');
  p.audio.readyState = 4;
  p.audio.emit('loadedmetadata');
  assert.equal(p.audio.currentTime, 42);
});

test('the first play() rejecting after the MP3 retry does not undo it', async (t) => {
  const unhandled = trackUnhandled(t);
  const p = await player(t, { flac: 'probably' });
  const realPlay = p.audio.play;
  let rejectFirst;
  p.audio.play = function () {
    p.audio.play = realPlay;
    this.paused = false; this.emit('play');
    return new Promise((resolve, reject) => { rejectFirst = reject; });
  };
  p.query('.btn-play').click();
  p.audio.fail();                       // error event first, as browsers order it
  rejectFirst(new p.w.DOMException('no source', 'NotSupportedError'));
  await tick(); await tick();
  assert.equal(unhandled.length, 0);
  assert.equal(p.audio.src, 'a.mp3');
  assert.equal(p.query('.btn-play').getAttribute('aria-label'), 'Pause');
});

test('when no source loads, a status message says so and Play resets', async (t) => {
  const p = await player(t, { flac: 'probably' });
  p.query('.btn-play').click();
  p.audio.fail();                       // FLAC -> MP3
  p.audio.fail();                       // MP3 too
  const status = p.query('.player-status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.match(status.textContent, /couldn.t be loaded/);
  assert.equal(p.query('.btn-play').getAttribute('aria-label'), 'Play');
  assert.equal(p.audio.paused, true);
  p.query('.track[data-i="1"]').click();
  assert.equal(status.textContent, '');
});

test('an MP3-only browser gets the message straight away', async (t) => {
  const p = await player(t, { flac: '' });
  p.query('.btn-play').click();
  p.audio.fail();
  assert.equal(p.audio.src, 'a.mp3');
  assert.match(p.query('.player-status').textContent, /couldn.t be loaded/);
});

test('pressing Play after a failure retries the load', async (t) => {
  const p = await player(t, { flac: '' });
  p.query('.btn-play').click();
  p.audio.fail();
  let loads = 0;
  p.audio.load = function () { loads++; this.error = null; };
  p.query('.btn-play').click();
  assert.equal(loads, 1);
  assert.equal(p.audio.paused, false);
  assert.equal(p.query('.player-status').textContent, '');
});
