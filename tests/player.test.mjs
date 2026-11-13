import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player, testSongs } from './harness.mjs';

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
  assert.equal(p.audio.muted, true);
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

test('a lyric click before the media is ready wins over a pending #t= seek', async (t) => {
  const p = await player(t, { hash: '#t=50&song=a', ready: false });
  await p.lyrics(0, '[00:10]one\n[00:20]two');
  p.query('.btn-play').click();          // metadata not in yet: the #t= seek waits
  p.query('.lyric').click();             // the visitor jumps to line 1
  assert.equal(p.audio.currentTime, 10);
  p.audio.readyState = 4;
  p.audio.emit('progress');
  p.audio.emit('canplay');
  assert.equal(p.audio.currentTime, 10);
});

test('scrubbing before the first play wins over a pending #t= seek', async (t) => {
  const p = await player(t, { hash: '#t=50&song=a' });
  const scrub = p.query('.scrub');
  scrub.value = String(scrub.max * 0.2);  // 20 s of 100
  scrub.dispatchEvent(new p.w.Event('input'));
  p.query('.btn-play').click();
  assert.equal(p.audio.currentTime, 20);
});

test('scrubbing while a #t= seek waits for metadata cancels it', async (t) => {
  const p = await player(t, { hash: '#t=50&song=a', ready: false });
  p.query('.btn-play').click();
  const scrub = p.query('.scrub');
  scrub.value = String(scrub.max * 0.2);
  scrub.dispatchEvent(new p.w.Event('input'));
  p.audio.readyState = 4;
  p.audio.emit('loadedmetadata');
  assert.equal(p.audio.currentTime, 20);
});

test('choosing another track drops the link moment and its waiting listeners', async (t) => {
  const p = await player(t, { hash: '#t=50&song=a', ready: false });
  p.query('.btn-play').click();
  p.query('.track[data-i="1"]').click();
  p.audio.readyState = 4;
  p.audio.emit('loadedmetadata');
  assert.equal(p.audio.currentTime, 0);
  p.query('.btn-play').click();
  assert.equal(p.audio.currentTime, 0);
});

test('durations come from the data: one audio element, no metadata probes', async (t) => {
  const songs = testSongs(['a', 'b']);
  songs[0].duration = 226.12; songs[1].duration = 128.56;
  const p = await player(t, { songs, ready: false });
  assert.equal(p.audios.length, 1);
  assert.deepEqual(p.all('.track__dur').map((n) => n.textContent), ['3:46', '2:08']);
  assert.equal(p.query('.time--dur').textContent, '3:46');
  p.query('.track[data-i="1"]').click();
  assert.equal(p.query('.time--dur').textContent, '2:08');
});

test('the mute button toggles muted (iOS ignores volume) and keeps the volume', async (t) => {
  const p = await player(t, { storage: { 'arda-volume': '0.6' } });
  const btn = p.query('.vol__btn');
  assert.equal(p.audio.volume, 0.6);
  btn.click();
  assert.equal(p.audio.muted, true);
  assert.equal(p.audio.volume, 0.6);
  assert.equal(btn.getAttribute('aria-label'), 'Unmute');
  assert.equal(p.w.localStorage.getItem('arda-muted'), '1');
  btn.click();
  assert.equal(p.audio.muted, false);
  assert.equal(btn.getAttribute('aria-label'), 'Mute');
  assert.equal(p.w.localStorage.getItem('arda-muted'), '0');
});

test('a stored mute comes back on the next visit', async (t) => {
  const p = await player(t, { storage: { 'arda-muted': '1', 'arda-volume': '0.4' } });
  assert.equal(p.audio.muted, true);
  assert.equal(p.audio.volume, 0.4);
  assert.equal(p.query('.vol__btn').getAttribute('aria-label'), 'Unmute');
});

test('moving the volume slider unmutes', async (t) => {
  const p = await player(t, { storage: { 'arda-muted': '1' } });
  const slider = p.query('.vol__slider');
  slider.value = '30';
  slider.dispatchEvent(new p.w.Event('input'));
  assert.equal(p.audio.muted, false);
  assert.equal(p.audio.volume, 0.3);
  assert.equal(p.w.localStorage.getItem('arda-volume'), '0.3');
});

test('a volume stored as 0 by the old mute reads as muted, and unmuting restores sound', async (t) => {
  const p = await player(t, { storage: { 'arda-volume': '0' } });
  const btn = p.query('.vol__btn');
  assert.equal(btn.getAttribute('aria-label'), 'Unmute');
  btn.click();
  assert.equal(p.audio.muted, false);
  assert.equal(p.audio.volume, 1);
});

test('corrupt stored preferences fall back to sane values', async (t) => {
  const cases = [
    [{ 'arda-volume': 'loud' }, 1, false, 'true'],
    [{ 'arda-volume': '-3' }, 0, false, 'true'],
    [{ 'arda-volume': '7' }, 1, false, 'true'],
    [{ 'arda-muted': 'yes' }, 1, false, 'true'],
    [{ 'arda-loop': 'false' }, 1, false, 'true'],
    [{ 'arda-loop': '0' }, 1, false, 'false'],
  ];
  for (const [storage, volume, muted, loop] of cases) {
    const p = await player(t, { storage });
    const label = JSON.stringify(storage);
    assert.equal(p.audio.volume, volume, label);
    assert.equal(p.audio.muted, muted, label);
    assert.equal(p.query('.btn-loop').getAttribute('aria-pressed'), loop, label);
  }
});

test('choosing a theme applies it, remembers it and presses only its button', async (t) => {
  const p = await player(t);
  p.query('[data-theme-name="ember"]').click();
  assert.equal(p.w.document.documentElement.getAttribute('data-theme'), 'ember');
  assert.equal(p.w.localStorage.getItem('arda-theme'), 'ember');
  assert.deepEqual(p.all('.themeswitch button').map((b) => b.getAttribute('aria-pressed')), ['false', 'false', 'true']);
});

test('the play gate stops playback the visitor did not ask for', async (t) => {
  const p = await player(t);
  p.audio.paused = false;
  p.audio.emit('play');                 // e.g. Chromium resuming after a src change
  assert.equal(p.audio.paused, true);
  assert.equal(p.query('.btn-play').getAttribute('aria-label'), 'Play');
  p.query('.btn-play').click();
  assert.equal(p.query('.btn-play').getAttribute('aria-label'), 'Pause');
  p.query('.track[data-i="1"]').click(); // switching tracks closes the gate again
  p.audio.paused = false;
  p.audio.emit('play');
  assert.equal(p.audio.paused, true);
});

test('the play button pauses while playing, and Next wraps around', async (t) => {
  const p = await player(t);
  p.query('.btn-play').click();
  p.query('.btn-play').click();
  assert.equal(p.audio.paused, true);
  p.query('.btn-next').click();
  assert.equal(p.current(), 1);
  assert.equal(p.audio.paused, false);
  p.query('.btn-next').click();
  assert.equal(p.current(), 0);
});

test('paused, then ended (a seek to the very end): the next track does not start', async (t) => {
  const p = await player(t, { storage: { 'arda-loop': '1' } });
  const scrub = p.query('.scrub');
  p.query('.btn-play').click();
  p.query('.btn-play').click();                        // the visitor pauses
  scrub.value = scrub.max;                             // End, or a drag to the right edge
  scrub.dispatchEvent(new p.w.Event('input'));
  assert.equal(p.audio.currentTime, 100);
  p.audio.emit('ended');                               // Firefox and Safari fire it while paused
  assert.equal(p.current(), 0);
  assert.equal(p.audio.paused, true);
  assert.equal(p.query('.btn-play').getAttribute('aria-label'), 'Play');
  // never played at all: the same
  const fresh = await player(t);
  fresh.audio.currentTime = 100;
  fresh.audio.emit('ended');
  assert.equal(fresh.current(), 0);
  assert.equal(fresh.audio.paused, true);
});

test('where the volume cannot be set (iPadOS), the slider is hidden and mute still works', async (t) => {
  const p = await player(t, {
    storage: { 'arda-volume': '0.4' },
    before(w) {
      const Base = w.Audio;
      w.Audio = class extends Base {   // iPadOS: audio.volume is always 1, writes are ignored
        constructor() { super(); Object.defineProperty(this, 'volume', { get: () => 1, set: () => {}, configurable: true }); }
      };
    },
  });
  const slider = p.query('.vol__slider');
  assert.equal(slider.hidden, true);
  assert.equal(p.w.localStorage.getItem('arda-volume'), '0.4', 'the stored level is left alone');
  p.query('.vol__btn').click();
  assert.equal(p.audio.muted, true);
  assert.equal(p.query('.vol__btn').getAttribute('aria-label'), 'Unmute');
  // where it can be set, the slider stays and the probe leaves the level as it was
  const normal = await player(t, { storage: { 'arda-volume': '0.4' } });
  assert.equal(normal.query('.vol__slider').hidden, false);
  assert.equal(normal.audio.volume, 0.4);
});
