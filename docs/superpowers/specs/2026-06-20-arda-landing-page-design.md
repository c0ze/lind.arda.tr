# Arda — landing page design

**Date:** 2026-06-20
**Status:** approved direction, pending spec review
**Location:** `/Users/arda/projects/arda/arda`

## 1. Overview

A landing page for **Arda**, a music project of original songs in Tolkien's
Sindarin (Grey-elven), rendered in the Tengwar script with English
translations. Three finished tracks exist as WAV masters in `songs/`. The page
is an atmospheric single-scroll site whose centrepiece is a **synced-lyrics
"stage"** that illuminates each line as the song reaches it.

### Goals

- Present the project and its three songs with a somber, fading, elvish mood.
- Show every lyric in **Tengwar + romanized Sindarin + English**.
- A synced-lyrics showpiece driven by `.lrc` files from the existing
  `~/projects/music/lyrics-sync` tool.
- Three selectable mood themes.
- Self-contained: vanilla HTML/CSS/JS, no framework, no build step, hostable as
  static files (mirrors the `lyrics-sync` GitHub-Pages pattern).

### Non-goals (YAGNI)

- No CMS, backend, or database.
- No lyric **video** generation (that is the separate next-stage
  `Lyrics-Video-generator` Remotion project).
- No in-browser Tengwar transcription engine — transcription is done **offline**
  at build time and stored as data.
- No streaming-platform / distribution integration.
- No per-word ("karaoke") timing — line-level sync only (matches `.lrc`).

## 2. Information architecture

One page, four stacked sections, plus a fixed-corner theme switcher.

1. **Hero** — "Arda" in Tengwar, a Sindarin + English tagline, a quiet scroll cue.
2. **The Stage** (showpiece) — featured player: a 3-track selector, custom audio
   controls, and immersive synced lyrics. View toggle: Tengwar · Romanized ·
   English · All.
3. **The Archive** — all three songs in full, statically readable (Tengwar +
   Sindarin + English), grouped by verse/chorus/bridge. Satisfies the
   "lyrics & translations" requirement with the sound off.
4. **Colophon** — short note on the tongue (Sindarin) and script (Tengwar,
   Sindarin General mode), plus credits and source links.

**Theme switcher** — a small control (top-right) cycling/selecting the three
moods. Choice persists in `localStorage`. Respects no transition flashing.

## 3. The three themes

Theme = a `data-theme` attribute on `<html>`; all colors are CSS custom
properties so swapping the attribute restyles instantly. Default = `twilight`.

### `twilight` — Twilight Gold (default) — autumn, the light of Anor

| token | hex |
|---|---|
| `--bg` | `#0a0e0d` |
| `--surface` | `#0b100e` |
| `--panel` | `#131a17` |
| `--ink` (primary text) | `#e7e1d3` |
| `--muted` (secondary) | `#8a948c` |
| `--faint` | `#4f5a54` |
| `--accent` (active / Anor) | `#d8b46a` |
| `--accent-bright` | `#e7c97e` |
| `--accent-deep` | `#b8924a` |
| `--accent-2` (moon) | `#9db6c4` |
| `--hair` | `rgba(216,180,106,0.16)` |

### `moonlit` — Moonlit Silver — Ithil, the maiden under the moon

| token | hex |
|---|---|
| `--bg` | `#080b10` |
| `--surface` | `#0b1016` |
| `--panel` | `#121a22` |
| `--ink` | `#dfe6ec` |
| `--muted` | `#8795a0` |
| `--faint` | `#3c4650` |
| `--accent` (active / Ithil) | `#acc6d8` |
| `--accent-bright` | `#d2e4f0` |
| `--accent-deep` | `#7d97a8` |
| `--accent-2` (faint star-gold) | `#c2a86a` |
| `--hair` | `rgba(172,198,216,0.16)` |

### `ember` — Ember / Mourning — funeral, near-black, dying fire

| token | hex |
|---|---|
| `--bg` | `#0a0807` |
| `--surface` | `#0d0a09` |
| `--panel` | `#161210` |
| `--ink` | `#d8cfc6` |
| `--muted` | `#8a8079` |
| `--faint` | `#463f3a` |
| `--accent` (active / ember) | `#b4583e` |
| `--accent-bright` | `#d07a5c` |
| `--accent-deep` | `#8a3b2e` |
| `--accent-2` (cold ash) | `#8d96a0` |
| `--hair` | `rgba(180,88,62,0.18)` |

Active-line "illumination" = `--accent-bright` color + a soft text-shadow in
`--accent`. Under `prefers-reduced-motion` and the high-contrast case, the glow
is dropped to a solid color + weight change.

## 4. Typography

- **Display / titles:** Cinzel (epic Roman caps; matches the `CinzelDecorative`
  already used in the video tool). Self-host or Google Fonts.
- **Body / romanized Sindarin / English:** Cormorant Garamond (literary serif).
- **Tengwar script:** an embedded Tengwar web font (see §6).
- **Meta labels:** Cormorant Garamond, letter-spaced, uppercase-styled via CSS.

## 5. Lyrics data model

A single `data/songs.js` (or `.json`) module is the source of truth.

```
Song = {
  id: "gwannad-i-lu",
  title: "Gwannad i-Lû",          // romanized
  titleEn: "The Fading of Time",
  titleTengwar: "<encoded>",       // §6
  audio: "audio/gwannad-i-lu.mp3",
  lrc:   "lyrics/gwannad-i-lu.lrc", // optional; sync lights up when present
  sections: [
    { kind: "verse" | "chorus" | "bridge" | "outro",
      lines: [ { sin, en, teng } ] }
  ]
}
```

- `teng` (Tengwar) is generated at build time (§6); if missing, the UI falls
  back to showing `sin` in the script slot.
- The synced view flattens `sections[].lines[]` to an ordered array and **zips
  by index** against the parsed `.lrc` timestamps. The `.lrc` text need not
  match `sin` — only line **count and order** must align.
- Durations are read at runtime from the audio element (no hard-coded times).

## 6. Tengwar rendering pipeline (offline, at build time)

1. Fetch a free Tengwar web font + matching charset. Plan: **Tengwar Annatar**
   (freeware, film-style) paired with **Glaemscribe**
   (`github.com/BenTalagan/glaemscribe`, open source) for transcription.
2. Run each `sin` line and each song title through Glaemscribe's **Sindarin
   (general/classical)** mode targeting the Annatar charset → produces the
   font-encoded string stored as `teng`.
3. Subset + convert the font to `woff2`, embed via `@font-face`.
4. **Accuracy gate:** the user eyeballs output against Tecendil (Sindarin
   General mode). Any mismatch is a one-line data fix in `songs.js`.
- Fallbacks if font/transcriber can't be fetched: (a) user supplies the font;
  (b) Tecendil SVG exports; (c) romanized + decorative Tengwar only.

## 7. Audio pipeline

- Transcode each WAV master → web MP3 with `ffmpeg` (~160–192 kbps CBR/VBR),
  output to `audio/`. WAVs stay in `songs/` as masters (git-ignored if large).
- `<audio preload="metadata">`; the active track loads on play, others lazy.

## 8. Synced-lyrics behavior (the Stage)

- Parse `.lrc` → `[{t: seconds, i: lineIndex}]`.
- On `timeupdate` (throttled via `requestAnimationFrame`), find the current line;
  add `.is-active`, mark passed lines `.is-past`, upcoming `.is-future`.
- Auto-scroll the active line to vertical center (smooth; instant under
  reduced-motion).
- Click any line → seek audio to its timestamp.
- **No `.lrc` present** → lyrics render statically (no highlight, no autoscroll);
  everything else still works. Sync is pure progressive enhancement.
- View toggle (Tengwar · Romanized · English · All) sets a class on the stage;
  "All" stacks Tengwar (large) + Sindarin + English per line.

## 9. Accessibility

- `lang="sjn"` on Sindarin text, `lang="en"` on translations; Tengwar nodes get
  `aria-hidden` with the romanized line as the accessible text.
- Every theme's text/background pairings target WCAG AA (AAA for body where
  feasible); verify all three.
- Full keyboard control: play/pause (Space when player focused), seek, track
  switch, theme switch; visible focus rings.
- `prefers-reduced-motion`: no autoscroll animation, no glow pulse, no drifting
  motes.
- Native `<audio>` semantics retained behind the custom UI.

## 10. Performance

- Subset Cinzel / Cormorant to used glyphs; subset Tengwar to used codepoints.
- `font-display: swap`; preload the Tengwar font.
- Inline critical CSS; defer the small JS.
- Target: hero interactive < 1 s on a cold load; total page weight excluding
  audio well under 1 MB.

## 11. File / folder layout

```
arda/
├── index.html
├── assets/
│   ├── app.css
│   ├── app.js
│   └── fonts/            (cinzel, cormorant, tengwar — woff2)
├── data/
│   └── songs.js          (canonical lyrics data, §5)
├── audio/                (mp3, transcoded from songs/)
├── lyrics/               (*.lrc, dropped in from lyrics-sync)
├── songs/                (WAV masters — existing)
├── scripts/
│   ├── transcode-audio.sh
│   └── transcribe-tengwar.mjs
└── docs/superpowers/specs/2026-06-20-arda-landing-page-design.md
```

## 12. Tech stack & deploy

- Vanilla HTML/CSS/JS, no framework, no build step required to *run* (the two
  scripts are one-time asset generators).
- Deploy: same pattern as `lyrics-sync` — static files + `CNAME` + `.nojekyll` +
  a Pages workflow — when the user chooses to host. Domain TBD (e.g.
  `arda.tr` apex or an `arda.*` subdomain).

## 13. Build sequence

1. Scaffold folders + `index.html` shell + theme token CSS (all three themes).
2. Seed `data/songs.js` from the lyrics in §15.
3. `transcode-audio.sh`: WAV → MP3 into `audio/`.
4. Tengwar pipeline: fetch font + Glaemscribe, generate `teng` strings, embed
   font. (Accuracy gate with user.)
5. Build the Archive section (static, full lyrics, all three view modes).
6. Build the Stage: audio controls, track switch, view toggle.
7. Add LRC parsing + sync illumination + autoscroll + click-seek.
8. Hero + colophon + theme switcher + motes/atmosphere.
9. Accessibility + reduced-motion + cross-theme contrast pass.
10. Verify in a browser; adjust.

## 14. Open items to confirm

- Default theme = `twilight` (assumed).
- Hosting now vs later, and the domain (affects `CNAME`).
- Whether to `git init` this folder as its own repo (the sibling `*.arda.tr`
  projects are each their own repo).

## 15. Canonical lyrics (seed data)

### Song I — Gwannad i-Lû · *The Fading of Time*

**Verse 1**
- I laiss vallen dannar na-ceven fimp. — The golden leaves fall to the grey earth.
- I sûl nalla mi 'lyf ring. — The wind cries in the cold branches.
- Idhrinn anann gwanar na-dhae. — Long years fade into the shadow.
- Rhîw dôl na-dhoer en-firiath. — Winter comes to the lands of mortals.

**Verse 2**
- Cair faen dartha mi lond. — The White Ship waits at the harbour.
- Gaear can guren lom. — The Sea calls my weary heart.
- Boe menin athar echor ardhon. — I must go beyond the circles of the world.
- Suilad na-galad Anor. — Farewell to the light of the Sun.

**Chorus**
- Gwanon o-anann. Ú-ben arya Arda! — I leave the long-past. No one inherits Arda!
- Gwanon o-anann. Ú-ben arya Arda! — I leave the long-past. No one inherits Arda!

**Verse 3**
- Faug na-ngalad. Sogon o-eithel Anor. — Thirsty for light. I drink from the well of the Sun.
- Gwanon o-dû. Cuil fîr, dan ú-firin. — I leave the night. Life fades, but I do not fade.
- Faug na-ngalad… — Thirsty for light…

**Verse 4**
- Cennin ernil rissar mi-dhû. — I saw princes torn apart in the darkness.
- Gond danna na-ast. — Stone falls to dust.
- Ross vith danna er henin. — Grey rain falls upon my eyes.
- Athrad i-ngwellu. — Crossing the death-shadow.

**Bridge**
- Luitho naur, luitho lach. — Quench the fire, quench the flame.
- Rif galu, ú-vatha nan. — The bark grows, it feels nothing again.
- Luitho naur… — Quench the fire…

**Chorus** (repeat)
- Gwanon o-anann. Ú-ben arya Arda! — I leave the long-past. No one inherits Arda!
- Gwanon o-anann. Ú-ben arya Arda! — I leave the long-past. No one inherits Arda!

**Outro**
- Arda… Gwanon… — Arda… I leave…

### Song II — I Dhae Odog · *The Seventh Shadow*

**Verse 1**
- Darthon nan-eithel. — I wait by the well.
- Darthon nan-Ithil. — I wait by the Moon.
- Echuiol na-il dae. — Waking at every shadow.
- Aníron den. — I desire him.

**Verse 2**
- Elin firiar. — Stars fade.
- I-chrem glina. — The insects sing.
- Guren danna… — My heart falls…
- Na-i-dhae odog. — At the seventh shadow.

**Chorus**
- Menel nalla. — Heaven weeps.
- Faer nín gwedhinnen. — My soul is bound.
- Calad nín thilia. — My light flickers.
- Na-il glaw en-Ithil. — At every radiance of the Moon.

**Bridge**
- Risto Menel! — Rend the Heavens!
- Hado i-lond dû! — Hurl night at the harbour!
- An-iergon uireb. — For my longing is eternal.
- Dan faer nín… fîr. — But my soul… fades.

**Chorus** (repeat)
- Menel nalla. — Heaven weeps.
- Faer nín gwedhinnen. — My soul is bound.
- Calad nín thilia. — My light flickers.
- Na-il glaw en-Ithil. — At every radiance of the Moon.

### Song III — I Dann Haer · *The Long Defeat*

**Verse 1**
- Renon enith rim. — I remember many names.
- Mellon, gwanur, herves. — Friend, kinsman, spouse.
- Si gwannanner. — Now they have departed.
- Sui hith mi-sûl. — Like mist in the wind.

**Verse 2**
- I thaim thinnar. — The halls grow grey.
- Lalaith nu-dhae. — Laughter is under shadow.
- Laston nan-lam. — I listen for a voice.
- Dan lost… ú-ew. — But empty… no one.

**Chorus**
- Cuil nín, ann. — My life, long.
- Cuil dîn, thent. — Their life, short.
- Darthon erui. — I remain alone.
- Mi-dhû en-Amar. — In the night of the World.

**Verse 3**
- Gwanun matha. — Death feels like—
- Níniel ornoth. — weeping without count.
- Gwanun matha. — Death feels like—
- Firith en-gwaleth. — the fading of torment.

**Bridge**
- Harn nín ú-nestanna. — My wound is not healed.
- Na-dhûr en-ann-gwelu. — By the darkness of long-fading.
- Erui… Erui… — Alone… Alone…

**Outro**
- Amar… Erui… — The World… Alone…
