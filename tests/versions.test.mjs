import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedVersions } from '../scripts/stamp-versions.mjs';
import { html, player, testSongs } from './harness.mjs';

test('index.html asks for every script and stylesheet by its current content version', () => {
  for (const [asset, v] of Object.entries(expectedVersions())) {
    const found = new RegExp(`["']${asset.replace(/[.]/g, '\\.')}\\?v=([^"']*)["']`).exec(html);
    assert.ok(found, `index.html should load ${asset}?v=…`);
    assert.equal(found[1], v, `${asset} changed: run "node scripts/stamp-versions.mjs"`);
  }
});

test('lyric timings are fetched with the data version', async (t) => {
  const p = await player(t);
  const v = /data\/songs\.js\?v=([^"']+)/.exec(html)[1];
  assert.equal(p.requests[0].url, `a.lrc?v=${v}`);
});

test('track numerals continue past five', async (t) => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];
  const p = await player(t, { songs: testSongs(ids) });
  const nums = p.all('.track__num').map((n) => n.textContent);
  assert.deepEqual(nums, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']);
});
