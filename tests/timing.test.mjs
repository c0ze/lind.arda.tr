import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player, testSongs } from './harness.mjs';

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
