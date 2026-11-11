/* Cache-busting for a site with no build step. GitHub Pages lets browsers
 * cache files for hours, so index.html asks for each file with a ?v= that is
 * a short hash of its content:
 *
 *   assets/app.css?v=<hash of app.css>
 *   assets/app.js?v=<hash of app.js>
 *   data/songs.js?v=<data hash>, data/tengwar.js?v=<data hash>
 *
 * The data hash covers data/*.js and lyrics/*.lrc; app.js reads it from the
 * songs.js tag and adds it to every .lrc request, so it is the one version
 * constant for the lyrics too. tests/versions.test.mjs fails when a value is
 * stale. After editing any of those files, run:
 *
 *   node scripts/stamp-versions.mjs
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function hash(files) {
  const h = createHash('sha256');
  for (const f of files) h.update(f + '\0').update(fs.readFileSync(path.join(ROOT, f))).update('\0');
  return h.digest('hex').slice(0, 8);
}

export function expectedVersions() {
  const lrc = fs.readdirSync(path.join(ROOT, 'lyrics')).filter((f) => f.endsWith('.lrc')).sort().map((f) => 'lyrics/' + f);
  const data = hash(['data/songs.js', 'data/tengwar.js', ...lrc]);
  return {
    'assets/app.css': hash(['assets/app.css']),
    'assets/app.js': hash(['assets/app.js']),
    'data/songs.js': data,
    'data/tengwar.js': data,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  for (const [asset, v] of Object.entries(expectedVersions())) {
    const re = new RegExp('(["\'])' + asset.replace(/[.]/g, '\\.') + '(?:\\?v=[^"\']*)?\\1', 'g');
    if (!re.test(html)) throw new Error(`index.html does not reference ${asset}`);
    html = html.replace(re, (m, q) => `${q}${asset}?v=${v}${q}`);
    console.log(`  ${asset}?v=${v}`);
  }
  fs.writeFileSync(file, html);
}
