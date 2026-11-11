import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player } from './harness.mjs';

test('lock-screen metadata names the song, the artist and the album', async (t) => {
  const p = await player(t, { mediaSession: true });
  assert.deepEqual({ ...p.session.metadata }, { title: 'a — a', artist: 'Arda', album: 'Arda' });
});

test('play, pause, track and seek actions are all registered', async (t) => {
  const p = await player(t, { mediaSession: true });
  assert.deepEqual(Object.keys(p.session.handlers).sort(),
    ['nexttrack', 'pause', 'play', 'previoustrack', 'seekbackward', 'seekforward', 'seekto']);
});

test('an action the browser rejects does not stop the others from registering', async (t) => {
  const p = await player(t, {
    mediaSession: true,
    before(w) {
      const s = w.navigator.mediaSession, set = s.setActionHandler;
      s.setActionHandler = (action, fn) => {
        if (action === 'play' || action === 'seekto') throw new TypeError(`${action} unsupported`);
        set(action, fn);
      };
    },
  });
  assert.ok(p.session.handlers.pause && p.session.handlers.nexttrack && p.session.handlers.seekforward);
});

test('seek actions move playback and cancel a waiting link time', async (t) => {
  const p = await player(t, { mediaSession: true, hash: '#t=70' });
  const h = p.session.handlers;
  h.seekto({ action: 'seekto', seekTime: 40 });
  assert.equal(p.audio.currentTime, 40);
  h.seekbackward({ action: 'seekbackward' });
  assert.equal(p.audio.currentTime, 30);
  h.seekbackward({ action: 'seekbackward', seekOffset: 50 });
  assert.equal(p.audio.currentTime, 0);
  h.seekforward({ action: 'seekforward', seekOffset: 5 });
  assert.equal(p.audio.currentTime, 5);
  h.seekforward({ action: 'seekforward', seekOffset: 500 });
  assert.equal(p.audio.currentTime, 100);
  p.audio.currentTime = 12;
  h.play();
  assert.equal(p.audio.currentTime, 12, 'the #t=70 link no longer applies');
});

test('the lock-screen position follows metadata, play, pause and seeks', async (t) => {
  const p = await player(t, { mediaSession: true });
  p.audio.emit('loadedmetadata');
  assert.deepEqual({ ...p.session.positions.at(-1) }, { duration: 100, playbackRate: 1, position: 0 });
  p.query('.btn-play').click();
  p.audio.currentTime = 33;
  p.audio.emit('seeked');
  assert.deepEqual({ ...p.session.positions.at(-1) }, { duration: 100, playbackRate: 1, position: 33 });
  p.audio.duration = NaN;
  const n = p.session.positions.length;
  p.audio.emit('seeked');
  assert.equal(p.session.positions.length, n, 'no position without a duration');
});

test('browsers without setPositionState are fine', async (t) => {
  const p = await player(t, { mediaSession: true, before(w) { delete w.navigator.mediaSession.setPositionState; } });
  p.audio.emit('loadedmetadata');
  p.query('.btn-play').click();
  assert.equal(p.audio.paused, false);
});
