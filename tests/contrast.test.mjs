import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* WCAG contrast from the theme tokens in app.css. The dimmed lyric lines
   (--faint at reduced opacity) are the design's core effect and are not
   checked here on purpose. */
const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');

function tokens(theme) {
  const block = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css)[1];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const theme of ['twilight', 'moonlit', 'ember']) {
  test(`${theme}: text and control colours meet WCAG AA`, () => {
    const t = tokens(theme);
    for (const [fg, bg, min] of [
      ['ink', 'bg', 4.5], ['muted', 'bg', 4.5], ['muted', 'panel', 4.5], ['muted', 'surface', 4.5],
      ['accent', 'bg', 4.5], ['accent', 'panel', 4.5], ['accent', 'surface', 4.5], ['accent-bright', 'bg', 4.5],
      ['accent-2', 'bg', 4.5], ['track', 'bg', 3],
    ]) {
      const r = ratio(t[fg], t[bg]);
      assert.ok(r >= min, `${theme} --${fg} on --${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
    }
  });
}

test('static text is never set in --faint (only the dimmed lyric lines use it)', () => {
  const users = [...css.matchAll(/([^{}]+)\{[^}]*color:\s*var\(--faint\)/g)].map((m) => m[1].trim());
  assert.deepEqual(users, ['.lyric']);
});

test('the slider track uses its own 3:1 token, not the hairline colour', async () => {
  const js = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /var\(--hair\)/);
  assert.match(css, /\.scrub, \.vol__slider \{[^}]*background-color: var\(--track\)/);
});
