import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { html } from './harness.mjs';

const doc = new JSDOM(html).window.document;
const meta = (sel) => doc.querySelector(sel)?.getAttribute('content');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../data/songs.js', import.meta.url), 'utf8'), sandbox);
const SONGS = sandbox.window.ARDA_SONGS;
const SITE = 'https://lind.arda.tr/';
const CNAME = fs.readFileSync(new URL('../CNAME', import.meta.url), 'utf8').trim();

function iso(seconds) {
  const s = Math.round(seconds);
  return `PT${Math.floor(s / 60)}M${s % 60}S`;
}

test('canonical URL and share-card meta point at the site', () => {
  assert.equal(SITE, `https://${CNAME}/`);
  assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), SITE);
  assert.equal(meta('meta[property="og:url"]'), SITE);
  assert.equal(meta('meta[property="og:site_name"]'), 'Arda');
  assert.equal(meta('meta[name="twitter:card"]'), 'summary');
  assert.match(meta('meta[name="theme-color"]') ?? '', /^#[0-9a-f]{6}$/i);
});

test('the JSON-LD album lists exactly the songs in data/songs.js', () => {
  const node = doc.querySelector('script[type="application/ld+json"]');
  assert.ok(node, 'index.html has JSON-LD');
  const album = JSON.parse(node.textContent);
  assert.equal(album['@context'], 'https://schema.org');
  assert.equal(album['@type'], 'MusicAlbum');
  assert.equal(album.url, SITE);
  assert.equal(album.numTracks, SONGS.length);
  assert.deepEqual(album.creator, {
    '@type': 'Person',
    '@id': 'https://arda.tr/#person',
    name: 'Arda Karaduman',
    url: 'https://arda.tr/',
  });
  assert.deepEqual(album.track, Array.from(SONGS, (s) => ({
    '@type': 'MusicRecording',
    name: s.title,
    alternateName: s.titleEn,
    duration: iso(s.duration),
    inLanguage: 'sjn',
    url: `${SITE}#song=${s.id}`,
  })));
});
