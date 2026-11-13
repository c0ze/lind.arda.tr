import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { player } from './harness.mjs';

const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');

/* The body of every top-level @media block whose query matches `query`. */
function mediaBlocks(query) {
  const out = [];
  const re = /@media ([^{]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1, k = re.lastIndex;
    for (; k < css.length && depth; k++) { if (css[k] === '{') depth++; else if (css[k] === '}') depth--; }
    if (query.test(m[1])) out.push(css.slice(re.lastIndex, k - 1));
    re.lastIndex = k;
  }
  return out;
}

async function revealed(t) {
  const observers = [];
  const p = await player(t, {
    reduce: false,
    before(w) {
      w.IntersectionObserver = class {
        constructor(cb, options) { this.cb = cb; this.options = options || {}; this.targets = []; observers.push(this); }
        observe(el) { this.targets.push(el); }
        unobserve(el) { this.targets = this.targets.filter((x) => x !== el); }
        disconnect() {}
      };
    },
  });
  const io = observers.find((o) => o.targets.some((n) => n.classList.contains('song')));
  return { p, io };
}

test('an archive song is revealed as soon as any of it is on screen, however tall it is', async (t) => {
  const { p, io } = await revealed(t);
  assert.ok(io, 'the archive songs are observed');
  const threshold = [].concat(io.options.threshold ?? 0);
  assert.deepEqual(threshold, [0], 'a 4000px song cannot show 12% of itself in a 390px window');
  const song = p.query('article.song');
  io.cb([{ target: song, isIntersecting: true, intersectionRatio: 0.01 }]);
  assert.ok(song.classList.contains('in'));
});

test('printing shows every revealed block, scrolled to or not', () => {
  const print = mediaBlocks(/\bprint\b/).join('\n');
  assert.match(print, /\.reveal\s*\{[^}]*opacity:\s*1/);
  assert.match(print, /\.reveal\s*\{[^}]*transform:\s*none/);
});

/* The declarations of the first top-level rule for exactly `selector`. */
function rule(selector) {
  const re = new RegExp('(^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  const m = re.exec(css);
  return m ? m[2] : '';
}
const rem = (decls, prop) => {
  const m = new RegExp(prop + ':\\s*([\\d.]+)rem').exec(decls);
  return m ? Number(m[1]) : 0;
};

test('scrolling to an element (focus, anchors, share links) clears the sticky top bar', () => {
  // the bar is about 46-48px; 1rem is 16px at the root
  const padding = rem(rule('html'), 'scroll-padding-top');
  assert.ok(padding * 16 >= 50, 'html scroll-padding-top clears the top bar');
  // the player block adds only a small gap on top of that padding (the two add
  // up), so title, lyrics window and controls still fit a 667px-high phone
  const margin = rem(rule('.player'), 'scroll-margin-top');
  assert.ok(margin > 0 && (padding + margin) * 16 <= 72, `${padding}rem + ${margin}rem`);
});

test('hover styles apply only where there is a real hover (they stick after a tap on touch screens)', () => {
  const hoverBlocks = mediaBlocks(/\(hover:\s*hover\)/);
  assert.ok(hoverBlocks.join('').includes(':hover'));
  let outside = css;
  for (const b of hoverBlocks) outside = outside.replace(b, '');
  const stray = outside.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => l.includes(':hover'));
  assert.deepEqual(stray, []);
  // the tapped lyric line in particular must not stay bright once it is no longer active
  assert.ok(hoverBlocks.some((b) => /\.lyric:hover/.test(b)));
});

test("Firefox's own range track is transparent, so the progress fill behind it shows", () => {
  for (const slider of ['.scrub', '.vol__slider']) {
    const m = new RegExp(slider.replace('.', '\\.') + '::-moz-range-track[^{]*\\{([^}]*)\\}|' +
      '[^{}]*' + slider.replace('.', '\\.') + '::-moz-range-track[^{]*\\{([^}]*)\\}').exec(css);
    assert.ok(m, slider);
    assert.match(m[1] || m[2], /background(-color)?:\s*transparent/, slider);
  }
});
