# Synced lyrics (`.lrc`)

Drop one timed `.lrc` file per song here, named by song id:

- `gwannad-i-lu.lrc`
- `i-dhae-odog.lrc`
- `i-dann-haer.lrc`

Produce them with the **lyrics-sync** tool (`~/projects/music/lyrics-sync`):
load the matching audio and the romanized Sindarin lines, tap each line in time
with the spacebar, then export the `.lrc`.

**How sync works.** The page reads the `.lrc` timestamps in order and zips them
to the song's lyric lines **by index** — so the text inside the `.lrc` does not
have to match. Only the count and order of timed lines need to line up with the
lyrics in `../data/songs.js` (Gwannad i-Lû has 23 lines, I Dhae Odog 20, I Dann
Haer 20). When a file is present **and the site is served over http** (GitHub
Pages, or a local server), the stage lights line by line and auto-scrolls. With
no `.lrc`, the lyrics show statically. Sync is pure progressive enhancement.

> Opening `index.html` straight from disk (`file://`) blocks `fetch`, so sync
> only activates when served. Use `python3 -m http.server` locally.
