/* Emit one plain-text lyric sheet per song into lyrics/<id>.txt, for loading
 * into the lyrics-sync tool (~/projects/music/lyrics-sync).
 *
 * One romanized Sindarin line per lyric line, in the exact order of
 * data/songs.js, with a blank line between sections (the sync tool skips empty
 * lines, so the queue still has exactly N lines). This keeps the eventual .lrc
 * aligned line-for-line with the page, which zips timestamps to lines by index:
 *   gwannad-i-lu 23 · i-dhae-odog 20 · i-dann-haer 20
 *
 * Regenerate after editing lyrics:  node scripts/build-lyrics-txt.mjs
 */
import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data/songs.js"), "utf8"), sb);
const songs = sb.window.ARDA_SONGS;

let total = 0;
for (const s of songs) {
  const body = s.sections.map((sec) => sec.lines.map((l) => l.sin).join("\n")).join("\n\n") + "\n";
  const n = s.sections.reduce((a, sec) => a + sec.lines.length, 0);
  fs.writeFileSync(path.join(ROOT, "lyrics", s.id + ".txt"), body);
  console.log(`  ${s.id}.txt — ${n} lines`);
  total += n;
}
console.log(`Wrote ${songs.length} lyric sheets (${total} lines) to lyrics/.`);
