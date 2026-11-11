import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

/* The shipped content must stay consistent: data/songs.js, the generated
   Tengwar, the audio files, the timed .lrc files and the lyric sheets. */
const root = new URL('../', import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('data/songs.js'), sandbox);
vm.runInNewContext(read('data/tengwar.js'), sandbox);
const SONGS = sandbox.window.ARDA_SONGS;
const TENGWAR = sandbox.window.ARDA_TENGWAR;

test('there are songs and their ids are unique', () => {
  assert.ok(SONGS.length > 0);
  assert.equal(new Set(SONGS.map((s) => s.id)).size, SONGS.length);
});

for (const song of SONGS) {
  const lines = song.sections.flatMap((sec) => sec.lines);

  test(`${song.id}: FLAC, MP3, LRC and lyric sheet all exist`, () => {
    assert.equal(song.audioFlac, `audio/${song.id}.flac`);
    assert.equal(song.audio, `audio/${song.id}.mp3`);
    assert.equal(song.lrc, `lyrics/${song.id}.lrc`);
    for (const f of [song.audioFlac, song.audio, song.lrc, `lyrics/${song.id}.txt`]) {
      assert.ok(fs.existsSync(new URL(f, root)), `${f} is missing`);
    }
  });

  test(`${song.id}: one increasing timestamp per lyric line, all inside the song`, () => {
    const rows = read(song.lrc).split(/\r?\n/).filter((l) => l.trim());
    const times = rows.map((row) => {
      const m = /^\[(\d+):(\d+(?:\.\d+)?)\]/.exec(row);
      assert.ok(m, `not an LRC row: ${JSON.stringify(row)}`);
      return Number(m[1]) * 60 + Number(m[2]);
    });
    assert.equal(times.length, lines.length, 'LRC rows vs lyric lines');
    times.forEach((t, i) => {
      if (i) assert.ok(t > times[i - 1], `row ${i + 1} (${t}s) is not after row ${i} (${times[i - 1]}s)`);
      assert.ok(t < song.duration, `row ${i + 1} (${t}s) is past the end (${song.duration}s)`);
    });
  });

  test(`${song.id}: every line and the title have Tengwar`, () => {
    for (const s of [song.title, ...lines.map((l) => l.sin)]) {
      assert.ok(typeof TENGWAR[s] === 'string' && TENGWAR[s].trim(), `no Tengwar for ${JSON.stringify(s)}`);
    }
    for (const l of lines) assert.ok(l.en && l.en.trim(), `no English for ${JSON.stringify(l.sin)}`);
  });

  test(`${song.id}: lyrics/${song.id}.txt matches data/songs.js`, () => {
    const expected = song.sections.map((sec) => sec.lines.map((l) => l.sin).join('\n')).join('\n\n') + '\n';
    assert.equal(read(`lyrics/${song.id}.txt`), expected, 'run "node scripts/build-lyrics-txt.mjs"');
  });
}
