/* Local static server for the site, with HTTP Range support so seeking,
 * share links (#t=) and lyric click-to-seek work the way they do on GitHub
 * Pages. (python3 -m http.server ignores Range, so browsers cannot seek
 * audio it serves.) Zero dependencies, read-only, localhost only.
 *
 *   node scripts/dev-server.mjs            # http://127.0.0.1:8777
 *   node scripts/dev-server.mjs 0          # any free port (printed)
 *   PORT=9000 node scripts/dev-server.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8777);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.lrc': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
// Never serve repo internals, secrets or the git-ignored masters.
const HIDDEN = /(^|\/)(\.[^/]*|node_modules|songs)(\/|$)/;

function send(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return send(res, 400, 'bad url'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || HIDDEN.test(path.relative(ROOT, file))) return send(res, 404, 'not found');
  let stat;
  try { stat = fs.statSync(file); } catch { return send(res, 404, 'not found'); }
  if (!stat.isFile()) return send(res, 404, 'not found');

  const size = stat.size;
  const headers = {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
  let start = 0, end = size - 1, code = 200;
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') { start = Math.max(0, size - Number(m[2])); }            // last N bytes
      else { start = Number(m[1]); if (m[2] !== '') end = Math.min(Number(m[2]), size - 1); }
    }
    if (!m || start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    code = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(code, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Serving ${ROOT} at http://127.0.0.1:${server.address().port}/ (Ctrl-C to stop)`);
});
