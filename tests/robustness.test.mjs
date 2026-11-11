import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { html, player, testSongs } from './harness.mjs';

const pressedThemes = (p) => p.all('.themeswitch button')
  .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.themeName);

test('a stored theme that is not one of the three is ignored', async (t) => {
  for (const stored of ['dawn', '"><x', '']) {
    const p = await player(t, { storage: { 'arda-theme': stored } });
    assert.equal(p.w.document.documentElement.getAttribute('data-theme'), 'twilight', stored);
    assert.deepEqual(pressedThemes(p), ['twilight'], stored);
  }
  const ember = await player(t, { storage: { 'arda-theme': 'ember' } });
  assert.equal(ember.w.document.documentElement.getAttribute('data-theme'), 'ember');
  assert.deepEqual(pressedThemes(ember), ['ember']);
});

test('the early theme script in <head> validates the stored theme too', async (t) => {
  const inline = /<script>(try\{[^<]*arda-theme[^<]*)<\/script>/.exec(html);
  assert.ok(inline, 'index.html has the inline theme script');
  for (const [stored, expected] of [['dawn', 'twilight'], ['x" onload="y', 'twilight'], ['moonlit', 'moonlit']]) {
    const dom = new JSDOM(html, { url: 'https://lind.example/', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    dom.window.localStorage.setItem('arda-theme', stored);
    dom.window.eval(inline[1]);
    assert.equal(dom.window.document.documentElement.getAttribute('data-theme'), expected, stored);
  }
});

test('Tengwar and section labels are escaped before they reach innerHTML', async (t) => {
  const songs = testSongs(['a']);
  songs[0].sections[0].kind = '<i>verse</i>';
  const p = await player(t, {
    songs,
    before(w) { w.ARDA_TENGWAR = { one: '<img src="x">', a: '<b>a</b>' }; },
  });
  assert.equal(p.w.document.querySelectorAll('#stage img, #archive img, #archive b, #archive i').length, 0);
  assert.equal(p.query('.lyric__teng').textContent, '<img src="x">');
  assert.equal(p.query('.a-line__teng').textContent, '<img src="x">');
  assert.equal(p.query('.song__teng').textContent, '<b>a</b>');
  assert.equal(p.query('.sect__label').textContent, '<i>verse</i>');
});
