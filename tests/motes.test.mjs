import assert from 'node:assert/strict';
import { test } from 'node:test';
import { player, tick } from './harness.mjs';

/* The hero's drifting motes: a canvas animation that should only run while
   it can be seen, without per-frame style lookups or resize re-randomising. */
async function motes(t, { width = 800 } = {}) {
  const env = { frames: new Map(), nextId: 1, observers: [], styleReads: 0, randoms: 0, accent: '#d8b46a', width, fills: [] };
  const p = await player(t, {
    keepCanvas: true,
    reduce: false,
    before(w) {
      w.HTMLCanvasElement.prototype.getContext = function () {
        return {
          clearRect() {}, beginPath() {}, arc() {}, fill() { env.fills.push(this.fillStyle); },
          globalAlpha: 1, fillStyle: '',
        };
      };
      w.HTMLElement.prototype.getBoundingClientRect = function () {
        return { width: this.classList.contains('hero') ? env.width : 0, height: 600, top: 0, left: 0 };
      };
      w.requestAnimationFrame = (fn) => { const id = env.nextId++; env.frames.set(id, fn); return id; };
      w.cancelAnimationFrame = (id) => { env.frames.delete(id); };
      w.IntersectionObserver = class {
        constructor(cb) { this.cb = cb; this.targets = []; env.observers.push(this); }
        observe(el) { this.targets.push(el); }
        unobserve() {}
        disconnect() {}
      };
      const gcs = w.getComputedStyle.bind(w);
      w.getComputedStyle = (el) => {
        if (el === w.document.documentElement) {
          env.styleReads++;
          return { getPropertyValue: (k) => (k === '--accent' ? env.accent : '') };
        }
        return gcs(el);
      };
      const random = w.Math.random;
      w.Math.random = () => { env.randoms++; return random(); };
      Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => env.hidden === true });
    },
  });
  const heroObserver = env.observers.find((o) => o.targets.includes(p.query('.hero')));
  env.inView = (on) => heroObserver.cb([{ target: p.query('.hero'), isIntersecting: on }]);
  env.runFrames = (n = 1) => {
    for (let k = 0; k < n; k++) {
      const pending = [...env.frames.entries()];
      env.frames.clear();
      pending.forEach(([, fn]) => fn(0));
    }
  };
  return { p, env };
}

test('motes animate only while the hero is in view', async (t) => {
  const { env } = await motes(t);
  assert.equal(env.frames.size, 0, 'nothing runs before the hero is known to be visible');
  env.inView(true);
  assert.equal(env.frames.size, 1);
  env.runFrames(3);
  assert.equal(env.frames.size, 1, 'one frame at a time');
  env.inView(false);
  assert.equal(env.frames.size, 0);
  env.inView(true);
  env.inView(true);
  assert.equal(env.frames.size, 1, 'no duplicate loops');
});

test('motes stop in a hidden tab and resume when it is shown', async (t) => {
  const { p, env } = await motes(t);
  env.inView(true);
  env.hidden = true;
  p.w.document.dispatchEvent(new p.w.Event('visibilitychange'));
  assert.equal(env.frames.size, 0);
  env.hidden = false;
  p.w.document.dispatchEvent(new p.w.Event('visibilitychange'));
  assert.equal(env.frames.size, 1);
});

test('the ink colour is read once and again on a theme change, not every frame', async (t) => {
  const { p, env } = await motes(t);
  env.inView(true);
  const reads = env.styleReads;
  env.runFrames(10);
  assert.equal(env.styleReads, reads);
  env.accent = '#acc6d8';
  p.query('[data-theme-name="moonlit"]').click();
  await tick();
  env.fills.length = 0;
  env.runFrames(1);
  assert.ok(env.fills.length > 0);
  assert.ok(env.fills.every((f) => f === '#acc6d8'));
});

test('resizing re-scatters the motes only when the width changes', async (t) => {
  const { p, env } = await motes(t);
  const before = env.randoms;
  p.w.dispatchEvent(new p.w.Event('resize'));   // a mobile URL bar showing/hiding: same width
  assert.equal(env.randoms, before);
  env.width = 600;
  p.w.dispatchEvent(new p.w.Event('resize'));
  assert.ok(env.randoms > before);
});
