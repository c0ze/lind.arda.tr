import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

/* scripts/dev-server.mjs against a throwaway folder on a free port. */
async function serve(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lind-dev-'));
  fs.writeFileSync(path.join(root, 'empty.txt'), '');
  fs.writeFileSync(path.join(root, 'ten.txt'), '0123456789');
  fs.writeFileSync(path.join(root, 'songs.txt'), 'public');
  // internals the server must never hand out, in both cases (on a
  // case-insensitive disk the two spellings are the same file)
  for (const name of ['.env', '.ENV', 'node_modules/x.js', 'NODE_MODULES/x.js', 'songs/a.wav', 'Songs/a.wav']) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), 'secret');
  }
  const child = spawn(process.execPath, [new URL('../scripts/dev-server.mjs', import.meta.url).pathname, '0', root], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill(); fs.rmSync(root, { recursive: true, force: true }); });
  const port = await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { const m = /:(\d+)\//.exec(String(d)); if (m) resolve(Number(m[1])); });
    child.on('exit', (code) => reject(new Error(`server exited (${code})`)));
  });
  const get = async (p, headers = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers });
    return { status: r.status, body: await r.text(), range: r.headers.get('content-range'), length: r.headers.get('content-length') };
  };
  return { get, child };
}

test('byte ranges are served as 206 partial content', async (t) => {
  const s = await serve(t);
  assert.deepEqual(await s.get('/ten.txt', { Range: 'bytes=2-4' }), { status: 206, body: '234', range: 'bytes 2-4/10', length: '3' });
  assert.deepEqual(await s.get('/ten.txt', { Range: 'bytes=-3' }), { status: 206, body: '789', range: 'bytes 7-9/10', length: '3' });
  assert.equal((await s.get('/ten.txt', { Range: 'bytes=20-' })).status, 416);
});

test('an empty file is served without crashing the server', async (t) => {
  const s = await serve(t);
  assert.deepEqual(await s.get('/empty.txt'), { status: 200, body: '', range: null, length: '0' });
  assert.equal((await s.get('/empty.txt', { Range: 'bytes=0-' })).status, 200);
  assert.equal((await s.get('/ten.txt')).body, '0123456789', 'still serving');
});

test('a range with no bounds ("bytes=-") is ignored, not treated as a partial response', async (t) => {
  const s = await serve(t);
  assert.deepEqual(await s.get('/ten.txt', { Range: 'bytes=-' }), { status: 200, body: '0123456789', range: null, length: '10' });
});

test('dotfiles, node_modules and the songs/ masters are hidden in any letter case', async (t) => {
  const s = await serve(t);
  for (const p of ['/.env', '/.ENV', '/.Env', '/node_modules/x.js', '/NODE_MODULES/x.js', '/Node_Modules/x.js',
    '/songs/a.wav', '/Songs/a.wav', '/SONGS/a.wav']) {
    assert.equal((await s.get(p)).status, 404, p);
  }
  assert.equal((await s.get('/songs.txt')).body, 'public', 'a file merely named like a hidden folder is served');
});
