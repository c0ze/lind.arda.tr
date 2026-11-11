import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player } from './harness.mjs';

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

test('with album loop off, a finished track still advances, and the last one stops', async (t) => {
  const p = await player(t, { storage: { 'arda-loop': '0' } });
  p.query('.btn-play').click();
  p.audio.paused = true;
  p.audio.emit('ended');
  assert.equal(p.current(), 1);
  assert.equal(p.audio.paused, false);
  p.audio.paused = true;
  p.audio.emit('ended');
  assert.equal(p.current(), 1);
  assert.equal(p.audio.paused, true);
});

test('with album loop on, the last track wraps to the first', async (t) => {
  const p = await player(t, { storage: { 'arda-loop': '1' } });
  p.query('.track[data-i="1"]').click();
  p.query('.btn-play').click();
  p.audio.paused = true;
  p.audio.emit('ended');
  assert.equal(p.current(), 0);
  assert.equal(p.audio.paused, false);
});
