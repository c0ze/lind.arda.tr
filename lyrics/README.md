# Synced lyrics (`.lrc`)

Drop one timed `.lrc` file per song here, named by song id:

- `gwannad-i-lu.lrc`
- `i-dhae-odog.lrc`
- `i-dann-haer.lrc`

Produce them with the **lyrics-sync** tool (`~/projects/music/lyrics-sync`):

1. Load the song's audio (`../audio/<id>.mp3` or the WAV master).
2. Load the matching ready-made text sheet from this folder: `<id>.txt`
   (`gwannad-i-lu.txt`, `i-dhae-odog.txt`, `i-dann-haer.txt`) — one romanized
   Sindarin line per lyric line, section-spaced (the tool skips blank lines).
3. Play, and tap **Space** as each line lands.
4. **Stamp every line** — the tool only exports lines that got a timestamp, so a
   skipped line would shift everything after it out of alignment.
5. Export the `.lrc` and save it here as `<id>.lrc`.

The `.txt` sheets are generated from `../data/songs.js` by
`node ../scripts/build-lyrics-txt.mjs` — regenerate them if you edit the lyrics.

**How sync works.** The page reads the `.lrc` timestamps in order and zips them
to the song's lyric lines **by index** — so the text inside the `.lrc` does not
have to match. Only the count and order of timed lines need to line up with the
lyrics in `../data/songs.js` (Gwannad i-Lû has 23 lines, I Dhae Odog 20, I Dann
Haer 20). When a file is present **and the site is served over http** (GitHub
Pages, or a local server), the stage lights line by line and auto-scrolls. With
no `.lrc`, the lyrics show statically. Sync is pure progressive enhancement.

> Opening `index.html` straight from disk (`file://`) blocks `fetch`, so sync
> only activates when served. Use `python3 -m http.server` locally.
