import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player, testSongs } from './harness.mjs';

const long = testSongs(['a', 'b'], 5000);

test('share-link times: seconds, M:SS, H:MM:SS and 1m30s forms', async (t) => {
  const cases = [
    ['#t=42.5&song=b', 1, 42.5],
    ['#t=42', 0, 42],
    ['#t=1:30', 0, 90],
    ['#t=01:30.5', 0, 90.5],
    ['#t=1:02:03', 0, 3723],
    ['#t=1m30s', 0, 90],
    ['#t=90s', 0, 90],
    ['#t=2m', 0, 120],
    ['#t=1h2m3s', 0, 3723],
    ['#song=b&t=7', 1, 7],
    ['#t=%31%30&song=b', 1, 10],
    ['#t=1e3', 0, 0],
    ['#t=0x10', 0, 0],
    ['#t=-5', 0, 0],
    ['#t=Infinity', 0, 0],
    ['#t=abc', 0, 0],
    ['#t=', 0, 0],
    ['#t=1:2:3:4', 0, 0],
    ['#t=%E0%A4%A&song=b', 1, 0],
  ];
  for (const [hash, track, seconds] of cases) {
    const p = await player(t, { hash, songs: long });
    p.audio.duration = 5000;
    assert.equal(p.current(), track, `${hash} track`);
    p.query('.btn-play').click();
    assert.equal(p.audio.currentTime, seconds, `${hash} time`);
  }
});

test('a time past the end of the song is ignored instead of ending the track', async (t) => {
  const p = await player(t, { hash: '#t=99999&song=b' });
  assert.equal(p.current(), 1);
  p.query('.btn-play').click();
  assert.equal(p.audio.currentTime, 0);
  assert.equal(p.audio.paused, false);
});

test('a time inside the data duration but past the real media end is ignored too', async (t) => {
  const p = await player(t, { hash: '#t=500', songs: testSongs(['a', 'b'], 1000) });
  p.query('.btn-play').click();   // fake media says 100 s
  assert.equal(p.audio.currentTime, 0);
});

test('an unknown song id drops the time instead of seeking the first track', async (t) => {
  const p = await player(t, { hash: '#t=30&song=nope' });
  assert.equal(p.current(), 0);
  p.query('.btn-play').click();
  assert.equal(p.audio.currentTime, 0);
  assert.equal(p.scrolled.length, 0);
});

test('a share link brings the player into view and shows the linked time', async (t) => {
  const p = await player(t, { hash: '#t=1:30&song=b' });
  assert.ok(p.scrolled.includes(p.query('#stage')));
  assert.equal(p.query('.time--cur').textContent, '1:30');
});

test('plain section anchors do not count as share links', async (t) => {
  const p = await player(t, { hash: '#archive' });
  assert.equal(p.scrolled.length, 0);
  assert.equal(p.query('.time--cur').textContent, '0:00');
});

test('a share link followed after load switches song and time', async (t) => {
  const p = await player(t);
  p.w.history.replaceState(null, '', '#t=42&song=b');
  p.w.dispatchEvent(new p.w.HashChangeEvent('hashchange'));
  assert.equal(p.current(), 1);
  assert.equal(p.query('.time--cur').textContent, '0:42');
  assert.ok(p.scrolled.includes(p.query('#stage')));
  p.query('.btn-play').click();
  assert.equal(p.audio.currentTime, 42);
});

test('a share link for the playing song seeks it at once', async (t) => {
  const p = await player(t);
  p.query('.btn-play').click();
  p.w.history.replaceState(null, '', '#t=30&song=a');
  p.w.dispatchEvent(new p.w.HashChangeEvent('hashchange'));
  assert.equal(p.audio.currentTime, 30);
  assert.equal(p.audio.paused, false);
});

test('navigating to a section anchor leaves the player alone', async (t) => {
  const p = await player(t, { hash: '#t=42&song=b' });
  p.w.history.replaceState(null, '', '#archive');
  p.w.dispatchEvent(new p.w.HashChangeEvent('hashchange'));
  assert.equal(p.current(), 1);
  p.query('.btn-play').click();
  assert.equal(p.audio.currentTime, 42);
});

test('the reset to 0 after a src change does not hide the waiting link time', async (t) => {
  const p = await player(t);
  p.w.history.replaceState(null, '', '#t=42&song=b');
  p.w.dispatchEvent(new p.w.HashChangeEvent('hashchange'));
  p.audio.currentTime = 0;
  p.audio.emit('timeupdate');
  assert.equal(p.query('.time--cur').textContent, '0:42');
});
