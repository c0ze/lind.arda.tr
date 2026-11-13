/* Arda — player, synced lyrics, themes. Vanilla, no build step.
   Data: window.ARDA_SONGS (lyrics) + window.ARDA_TENGWAR (script map). */
(function () {
  "use strict";

  var T = window.ARDA_TENGWAR || {};
  var SONGS = window.ARDA_SONGS || [];
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function teng(s) { return T[s] || s; }
  /* index.html loads data/songs.js?v=<hash of data/*.js + lyrics/*.lrc>
     (scripts/stamp-versions.mjs); the same value busts the .lrc cache. */
  var DATA_V = (function () {
    var tag = document.querySelector('script[src*="data/songs.js"]');
    var m = tag && /[?&]v=([^&#]+)/.exec(tag.getAttribute("src"));
    return m ? m[1] : "";
  })();
  function versioned(url) { return DATA_V ? url + (url.indexOf("?") < 0 ? "?" : "&") + "v=" + DATA_V : url; }
  function roman(n) {
    var out = "", table = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
      [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    table.forEach(function (r) { while (n >= r[0]) { out += r[1]; n -= r[0]; } });
    return out;
  }
  function readPreference(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writePreference(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function flatten(song) {
    var out = [];
    song.sections.forEach(function (sec) {
      sec.lines.forEach(function (l) { out.push(l); });
    });
    return out;
  }

  /* --- share links ------------------------------------------------------ */
  /* "#t=TIME[&song=ID]" (either part alone works). TIME is seconds ("42",
     "42.5"), "M:SS", "H:MM:SS" or "1m30s" / "1h2m3s"; ID as in data/songs.js,
     e.g. "#t=1:30&song=i-dhae-odog". Autoplay is blocked, so the seek waits
     until the visitor presses play. */
  function parseTime(v) {
    var m;
    if (/^\d+(?:\.\d+)?$/.test(v)) return parseFloat(v);
    if ((m = /^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(v))) {
      return (m[1] ? +m[1] * 3600 : 0) + +m[2] * 60 + parseFloat(m[3]);
    }
    if (v && (m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(v))) {
      return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (parseFloat(m[3]) || 0);
    }
    return null;
  }
  function readShareLink() {   // -> { i: track index, t: seconds or null } or null
    var t = null, id = null, i = 0;
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) {
      var eq = kv.indexOf("="); if (eq < 0) return;
      var k = kv.slice(0, eq), v = kv.slice(eq + 1);
      try { v = decodeURIComponent(v); } catch (e) {}
      if (k === "t") t = parseTime(v);
      if (k === "song") id = v;
    });
    if (id != null) {
      i = -1;
      SONGS.forEach(function (s, idx) { if (s.id === id) i = idx; });
      if (i < 0) return null;   // unknown song: its time means nothing for the others
    }
    if (t != null && SONGS[i].duration && t >= SONGS[i].duration) t = null;   // past the end
    return t == null && id == null ? null : { i: i, t: t };
  }

  /* --- Tengwar for all static [data-teng] chrome ------------------------ */
  function paintStaticTengwar(root) {
    (root || document).querySelectorAll("[data-teng]").forEach(function (el) {
      el.textContent = teng(el.getAttribute("data-teng"));
    });
  }

  /* --- theme switch ----------------------------------------------------- */
  var THEMES = ["twilight", "moonlit", "ember"];   // also listed in index.html's early <head> script
  function initThemes() {
    var saved = readPreference("arda-theme");
    if (THEMES.indexOf(saved) >= 0) document.documentElement.setAttribute("data-theme", saved);
    var current = document.documentElement.getAttribute("data-theme");
    document.querySelectorAll(".themeswitch button").forEach(function (b) {
      var name = b.getAttribute("data-theme-name");
      b.setAttribute("aria-pressed", String(name === current));
      b.addEventListener("click", function () {
        document.documentElement.setAttribute("data-theme", name);
        writePreference("arda-theme", name);
        document.querySelectorAll(".themeswitch button").forEach(function (x) {
          x.setAttribute("aria-pressed", String(x === b));
        });
      });
    });
  }

  /* --- LRC parsing ------------------------------------------------------ */
  function parseLrc(text) {
    var times = [];
    text.split(/\r?\n/).forEach(function (line) {
      var re = /\[(\d+):(\d+(?:\.\d+)?)\]/g, m;
      while ((m = re.exec(line))) times.push(parseInt(m[1], 10) * 60 + parseFloat(m[2]));
    });
    return times.sort(function (a, b) { return a - b; });
  }
  /* -> times (sorted seconds), MISSING (no timed file for this song) or
     FAILED (the file exists, or may, but did not load) */
  var MISSING = "missing", FAILED = "failed";
  function loadLrc(song) {
    function timed(text) { var times = parseLrc(text || ""); return times.length ? times : MISSING; }
    if (window.ARDA_LRC && window.ARDA_LRC[song.id]) return Promise.resolve(timed(window.ARDA_LRC[song.id]));
    if (!song.lrc) return Promise.resolve(MISSING);
    return fetch(versioned(song.lrc))
      .then(function (r) {
        if (r.ok) return r.text().then(timed);
        return r.status === 404 || r.status === 410 ? MISSING : FAILED;
      })
      .catch(function () { return FAILED; });
  }

  /* --- the stage -------------------------------------------------------- */
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>';
  var VOL_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.8a4 4 0 0 1 0 6.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M19 6.5a7 7 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var VOL_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg>';
  var LOOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="currentColor"/></svg>';
  var SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.5" r="2.4" fill="currentColor"/><circle cx="6" cy="12" r="2.4" fill="currentColor"/><circle cx="18" cy="18.5" r="2.4" fill="currentColor"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.6l4.6 4.6L19 7.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function buildStage() {
    var el = document.getElementById("stage");
    var tracks = SONGS.map(function (s, i) {
      return '<button class="track" type="button" data-i="' + i + '" aria-current="' + (i === 0) + '">' +
        '<span class="track__num">' + roman(i + 1) + '</span>' +
        '<span><span class="track__rom" lang="sjn">' + esc(s.title) + '</span> ' +
        '<span class="track__en">' + esc(s.titleEn) + '</span></span>' +
        '<span class="track__dur">' + fmt(s.duration) + '</span></button>';
    }).join("");

    el.innerHTML =
      '<header class="section-head reveal"><p class="section-kicker">the stage</p>' +
      '<h2>Listen</h2><p class="section-lede">Choose a song. With the sound on, the lyrics light line by line — Tengwar, Sindarin, or English.</p></header>' +
      '<div class="tracklist reveal">' + tracks + '</div>' +
      '<div class="player reveal"><div class="np">' +
        '<div class="np__teng" data-np="teng" aria-hidden="true"></div>' +
        '<div class="np__rom" data-np="rom" lang="sjn"></div>' +
        '<div class="np__en" data-np="en"></div></div>' +
      '<div class="lyrics" data-view="all"><div class="lyrics__scroller"></div></div>' +
      '<p class="lyrics-hint"></p>' +
      '<p class="player-status" role="status"></p>' +
      '<div class="controls">' +
        '<button class="btn-play" type="button" aria-label="Play">' + PLAY + '</button>' +
        '<button class="btn-next" type="button" aria-label="Next track">' + NEXT + '</button>' +
        '<span class="time time--cur">0:00</span>' +
        '<input class="scrub" type="range" min="0" max="1" value="0" step="1" aria-label="Seek" />' +
        '<span class="time time--dur">0:00</span>' +
        '<button class="btn-loop" type="button" aria-label="Loop album" aria-pressed="false">' + LOOP + '</button>' +
        '<button class="btn-share" type="button" aria-label="Copy link to this moment">' + SHARE + '</button>' +
        '<span class="share-status visually-hidden" role="status"></span>' +
        '<div class="vol">' +
          '<button class="vol__btn" type="button" aria-label="Mute"></button>' +
          '<input class="vol__slider" type="range" min="0" max="100" value="100" step="1" aria-label="Volume" />' +
        '</div>' +
      '</div>' +
      '<div class="viewtoggle" role="group" aria-label="Lyric view">' +
        '<button type="button" data-view="teng">Tengwar</button>' +
        '<button type="button" data-view="rom">Romanized</button>' +
        '<button type="button" data-view="en">English</button>' +
        '<button type="button" data-view="all" aria-pressed="true">All</button>' +
      '</div></div>';

    var audio = new Audio();
    audio.preload = "metadata";
    var canFlac = !!(audio.canPlayType("audio/flac") || audio.canPlayType("audio/x-flac"));
    var pickAudio = function (s) { return canFlac && s.audioFlac ? s.audioFlac : s.audio; };
    var scroller = el.querySelector(".lyrics__scroller");
    var lyricsBox = el.querySelector(".lyrics");
    var playBtn = el.querySelector(".btn-play");
    var scrub = el.querySelector(".scrub");
    var curT = el.querySelector(".time--cur");
    var durT = el.querySelector(".time--dur");
    var hint = el.querySelector(".lyrics-hint");
    var statusLine = el.querySelector(".player-status");

    var state = { i: -1, lines: [], times: null, active: -1 };
    var selection = 0;
    /* The visitor's play intent, which is also the play gate: set only by
       startPlay; cleared by a track switch, a refused or failed load, and every
       pause made on the visitor's behalf (pauseByVisitor). A play event while
       it is false is undone. */
    var allowPlay = false;

    /* share links (see readShareLink): the linked moment waits in pendingSeek */
    var pendingSeek = null;          // seconds to start the selected track at, on the next play
    var cancelDeferredSeek = null;   // set while that seek waits for the media to become seekable
    var deferredSeekAt = null;       // ...and the time it waits to seek to
    function dropPendingSeek() {     // the visitor chose a moment themselves: forget the link's
      pendingSeek = null;
      if (cancelDeferredSeek) cancelDeferredSeek();
    }
    function songLength() { return audio.duration || SONGS[state.i].duration || 0; }   // NaN until metadata
    /* Time readout + scrubber, for playback or a waiting link time. The slider
       counts whole seconds (arrow keys move 1 s) and says "1:23 of 3:46";
       the filled part of the track follows the exact time. */
    function showPosition(t) {
      var d = songLength();
      curT.textContent = fmt(t);
      scrub.max = Math.max(1, Math.ceil(d));
      scrub.value = Math.round(Math.max(0, d ? Math.min(t, d) : t));
      scrub.setAttribute("aria-valuetext", fmt(t) + " of " + fmt(d));
      var pct = d ? Math.min(100, (t / d) * 100) : 0;
      scrub.style.backgroundImage = "linear-gradient(to right, var(--accent) " + pct + "%, var(--track) " + pct + "%)";
    }

    function renderLyrics(song) {
      holdScroll = releaseAfterPointer = false;   // the held line goes with the old lyrics (no reliable focusout)
      state.lines = flatten(song);
      scroller.innerHTML = state.lines.map(function (l, idx) {
        return '<div class="lyric" data-idx="' + idx + '">' +
          '<div class="lyric__teng" aria-hidden="true">' + esc(teng(l.sin)) + '</div>' +
          '<div class="lyric__rom" id="lyric-' + idx + '-rom" lang="sjn">' + esc(l.sin) + '</div>' +
          '<div class="lyric__en" id="lyric-' + idx + '-en" lang="en">' + esc(l.en) + '</div></div>';
      }).join("");
      scroller.querySelectorAll(".lyric").forEach(function (node) {
        var idx = +node.getAttribute("data-idx");
        function seekHere() {
          if (state.times && state.times[idx] != null) {
            dropPendingSeek();
            audio.currentTime = state.times[idx];
            startPlay();
          }
        }
        node.addEventListener("click", seekHere);
        /* A timed line is a button (see makeLinesOperable) and acts like a
           native one: Enter on keydown, Space on keyup (only if it went down on
           this line), key repeats ignored, Space never scrolls the page. The
           lines share one tab stop; Up/Down/Home/End move between them. */
        function isSpace(e) { return e.key === " " || e.key === "Spacebar"; }
        var spaceArmed = false;
        node.addEventListener("keydown", function (e) {
          if (!node.hasAttribute("tabindex")) return;
          if (isSpace(e)) { e.preventDefault(); spaceArmed = true; }
          else if (e.key === "Enter") { e.preventDefault(); if (!e.repeat) seekHere(); }
          else if (!e.altKey && !e.ctrlKey && !e.metaKey && LINE_KEYS.indexOf(e.key) >= 0) {
            e.preventDefault();   // the page does not scroll, even at the first or last line
            var lines = timedLines(), at = lines.indexOf(node);
            var to = e.key === "Home" ? lines[0] : e.key === "End" ? lines[lines.length - 1] :
              lines[Math.min(lines.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
            if (to && to !== node) to.focus({ preventScroll: true });   // the focus handler centres it
          }
        });
        node.addEventListener("keyup", function (e) {
          if (!node.hasAttribute("tabindex") || !isSpace(e)) return;
          e.preventDefault();
          if (spaceArmed) { spaceArmed = false; seekHere(); }
        });
        node.addEventListener("blur", function () { spaceArmed = false; });
        node.addEventListener("focus", function () {
          setTabStop(node);
          if (!state.times || !keyboardInput) return;   // a mouse click seeks; the scroll follows the song
          holdScroll = true;         // keyboard focus: keep this line in the window until focus leaves
          lyricsBox.scrollTop = 0;   // focus may scroll the overflow:hidden box; the transform does the moving
          centerOn(node);
        });
      });
    }
    /* While keyboard focus is on a lyric line the automatic centring pauses
       (the highlight and aria-current still move), so the focused line stays
       visible. It resumes when focus leaves the lyrics, after a pointer press
       on them has done its click (never on the press itself, which would move
       the line under the pointer), and when the lyrics are re-rendered. */
    var holdScroll = false, keyboardInput = true, releaseAfterPointer = false;
    document.addEventListener("keydown", function () {
      keyboardInput = true;
      var f = document.activeElement;   // keyboard use begins on a line focused by the pointer
      if (state.times && f && f !== scroller && scroller.contains(f) && f.hasAttribute("tabindex")) holdScroll = true;
    }, true);
    ["mousedown", "pointerdown", "touchstart"].forEach(function (type) {
      document.addEventListener(type, function () { keyboardInput = false; }, true);
      scroller.addEventListener(type, function () { if (holdScroll) releaseAfterPointer = true; });
    });
    scroller.addEventListener("click", function () { if (releaseAfterPointer) releaseScroll(); });
    ["mouseup", "pointerup", "touchend", "touchcancel"].forEach(function (type) {   // a press dragged off: no click
      document.addEventListener(type, function () {
        if (releaseAfterPointer) setTimeout(function () { if (releaseAfterPointer) releaseScroll(); }, 0);
      });
    });
    scroller.addEventListener("focusout", function (e) {
      if (!e.relatedTarget || !scroller.contains(e.relatedTarget)) { releaseScroll(); restTabStop(); }
    });
    function releaseScroll() {
      releaseAfterPointer = false;
      if (!holdScroll) return;
      holdScroll = false;
      if (state.times) centerOn(scroller.children[state.active]);
    }
    /* Roving tabindex: the timed lines are a single tab stop (tabindex 0 on
       one, -1 on the rest), so Tab goes from the track list to one line and on
       to the controls. While focus is in the lyrics the stop is the focused
       line; otherwise it is the active line, or the first before playback. */
    var LINE_KEYS = ["ArrowUp", "ArrowDown", "Home", "End"];
    function timedLines() { return Array.prototype.slice.call(scroller.querySelectorAll(".lyric[tabindex]")); }
    function setTabStop(node) {
      if (!node || !node.hasAttribute("tabindex")) return;
      timedLines().forEach(function (n) { n.setAttribute("tabindex", n === node ? "0" : "-1"); });
    }
    function restTabStop() {
      var active = scroller.children[state.active];
      setTabStop(active && active.hasAttribute("tabindex") ? active : timedLines()[0]);
    }
    function focusInLyrics() { var f = document.activeElement; return !!f && f !== scroller && scroller.contains(f); }
    function makeLinesOperable() {   // once timings exist, each timed line seeks: by click, Enter or Space
      scroller.querySelectorAll(".lyric").forEach(function (node) {
        if (state.times[+node.getAttribute("data-idx")] == null) return;
        var idx = node.getAttribute("data-idx");
        node.setAttribute("role", "button");
        node.setAttribute("tabindex", "-1");
        /* Named by reference, so the name survives the view toggle hiding the
           romanized or English text (the Tengwar is aria-hidden), and each part
           keeps its own lang. */
        node.setAttribute("aria-labelledby", "lyric-" + idx + "-rom" + (node.querySelector(".lyric__en").textContent ? " lyric-" + idx + "-en" : ""));
      });
      restTabStop();
    }
    function centerOn(node) {
      var y = node ? lyricsBox.clientHeight / 2 - (node.offsetTop + node.offsetHeight / 2) : 0;
      scroller.style.transform = "translateY(" + y + "px)";
    }

    function setActive(idx, force) {
      if (idx === state.active && !force) return;
      state.active = idx;
      var nodes = scroller.children;
      for (var k = 0; k < nodes.length; k++) {
        nodes[k].classList.toggle("is-active", k === idx);
        nodes[k].classList.toggle("is-past", k < idx);
        if (k === idx) nodes[k].setAttribute("aria-current", "true"); else nodes[k].removeAttribute("aria-current");
      }
      if (!focusInLyrics()) restTabStop();
      if (holdScroll) return;
      lyricsBox.scrollTop = 0;
      centerOn(nodes[idx]);
    }

    function selectTrack(i, startAt) {
      if (i === state.i) return;
      dropPendingSeek();
      var requestSelection = ++selection;
      state.i = i; state.active = -1; state.times = null;
      var song = SONGS[i];
      Array.prototype.forEach.call(el.querySelectorAll(".track"), function (t) {
        t.setAttribute("aria-current", String(+t.getAttribute("data-i") === i));
      });
      el.querySelector('[data-np="teng"]').textContent = teng(song.title);
      el.querySelector('[data-np="rom"]').textContent = song.title;
      el.querySelector('[data-np="en"]').textContent = song.titleEn;
      durT.textContent = fmt(song.duration);   // data/songs.js matches the files; metadata refines it
      allowPlay = false;
      audio.pause();              // src changes don't reliably fire pause (Safari) and can auto-resume (Chromium)
      audio.src = state.src = pickAudio(song);
      statusLine.textContent = "";
      showPaused();
      updateMediaSession(song);
      if (startAt != null) pendingSeek = startAt;
      showPosition(pendingSeek || 0);
      renderLyrics(song);
      scroller.style.transform = "translateY(0)";
      lyricsBox.classList.remove("is-synced"); lyricsBox.classList.add("is-static");
      hint.textContent = "";
      loadLrc(song).then(function (times) {
        if (requestSelection !== selection) return;
        if (times === FAILED) {
          hint.textContent = "The lyric timings couldn\u2019t be loaded, so the lines won\u2019t follow the song this time.";
        } else if (times === MISSING) {
          hint.textContent = "Lyrics sync follows once a timed .lrc is added.";
        } else {
          state.times = times;
          lyricsBox.classList.add("is-synced"); lyricsBox.classList.remove("is-static");
          makeLinesOperable();
        }
      });
    }

    function pauseByVisitor() { allowPlay = false; audio.pause(); }
    function intendedPosition() {   // a seek still waiting, a link time waiting for Play, or where playback is
      return deferredSeekAt != null ? deferredSeekAt : pendingSeek != null ? pendingSeek : audio.currentTime;
    }
    playBtn.addEventListener("click", function () { if (audio.paused) startPlay(); else pauseByVisitor(); });
    audio.addEventListener("play", function () { if (!allowPlay) { audio.pause(); return; } playBtn.innerHTML = PAUSE; playBtn.setAttribute("aria-label", "Pause"); setPlaybackState("playing"); });
    audio.addEventListener("pause", showPaused);
    function showPaused() { playBtn.innerHTML = PLAY; playBtn.setAttribute("aria-label", "Play"); setPlaybackState("paused"); }

    /* A source that fails to load: a FLAC gets one retry as the song's MP3,
       from the same moment and in the same play state; otherwise say so. */
    audio.addEventListener("error", function () {
      var song = SONGS[state.i];
      if (state.src === song.audioFlac && song.audio && song.audio !== song.audioFlac) {
        var playing = allowPlay;     // false after the visitor paused: stay paused on the MP3
        var at = intendedPosition();
        dropPendingSeek();
        audio.src = state.src = song.audio;
        if (at > 0) pendingSeek = at;
        if (playing) startPlay(); else showPosition(at || 0);
        return;
      }
      var where = intendedPosition();
      dropPendingSeek();
      allowPlay = false;
      audio.pause();
      showPaused();
      if (where > 0) { pendingSeek = where; showPosition(where); }   // Play retries from here
      statusLine.textContent = "This song couldn\u2019t be loaded. Check your connection, then press play to try again.";
    });
    audio.addEventListener("loadedmetadata", function () {
      durT.textContent = fmt(audio.duration);
      showPosition(pendingSeek != null && audio.paused ? pendingSeek : audio.currentTime);
    });
    audio.addEventListener("timeupdate", function () {   // (a src change resets the media to 0)
      showPosition(pendingSeek != null && audio.paused ? pendingSeek : audio.currentTime);
      if (state.times) {
        var a = -1;
        for (var k = 0; k < state.times.length; k++) { if (state.times[k] <= audio.currentTime) a = k; else break; }
        setActive(a);
      }
    });
    scrub.addEventListener("input", function () {
      var d = songLength(), t = +scrub.value;
      dropPendingSeek();
      if (d) t = Math.min(t, d);
      audio.currentTime = t;
      showPosition(t);
    });

    var volSlider = el.querySelector(".vol__slider");
    var volBtn = el.querySelector(".vol__btn");
    var lastVol = 1;
    /* The button mutes (audio.muted); the slider sets the level (audio.volume).
       iOS/iPadOS ignore volume, so muting through it would do nothing there. */
    function paintVol() {
      var v = audio.volume, silent = audio.muted || v <= 0;
      volSlider.value = Math.round(v * 100);
      volSlider.style.backgroundImage = "linear-gradient(to right, var(--accent) " + v * 100 + "%, var(--track) " + v * 100 + "%)";
      volBtn.innerHTML = silent ? VOL_OFF : VOL_ON;
      volBtn.setAttribute("aria-label", silent ? "Unmute" : "Mute");
    }
    function setVolume(v, save) {
      v = Math.min(1, Math.max(0, v));
      audio.volume = v;
      if (v > 0) lastVol = v;
      if (save) writePreference("arda-volume", String(v));
    }
    function setMuted(m, save) {
      audio.muted = m;
      if (save) writePreference("arda-muted", m ? "1" : "0");
    }
    var savedVol = parseFloat(readPreference("arda-volume"));
    setVolume(isNaN(savedVol) ? 1 : savedVol, false);
    setMuted(readPreference("arda-muted") === "1", false);
    paintVol();
    volSlider.addEventListener("input", function () {
      var v = volSlider.value / 100;
      setVolume(v, true);
      if (v > 0 && audio.muted) setMuted(false, true);
      paintVol();
    });
    volBtn.addEventListener("click", function () {
      if (audio.muted || audio.volume <= 0) {
        setMuted(false, true);
        if (audio.volume <= 0) setVolume(lastVol || 1, true);   // a level of 0 (the old mute) gets sound back
      } else {
        setMuted(true, true);
      }
      paintVol();
    });
    audio.addEventListener("volumechange", paintVol);

    el.querySelectorAll(".track").forEach(function (t) {
      t.addEventListener("click", function () { selectTrack(+t.getAttribute("data-i")); });
    });

    el.querySelectorAll(".viewtoggle button").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-view");
        lyricsBox.setAttribute("data-view", v);
        el.querySelectorAll(".viewtoggle button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        if (state.active >= 0) setActive(state.active, true);
      });
    });

    /* --- transport: next / loop / lock-screen (Media Session) ------------- */
    var nextBtn = el.querySelector(".btn-next");
    var loopBtn = el.querySelector(".btn-loop");
    var loopMode = readPreference("arda-loop") !== "0";   // album-loop, default on
    loopBtn.setAttribute("aria-pressed", String(loopMode));

    function applyPendingSeek() {   // deferred "#t=" seek — see the hash comment above
      if (pendingSeek == null) return;
      var t = pendingSeek;
      dropPendingSeek();
      var evs = ["loadedmetadata", "canplay", "progress"];
      function pastEnd() { return isFinite(audio.duration) && t >= audio.duration; }
      function seek() { if (!pastEnd()) audio.currentTime = t; }   // a time past the end would end the track
      function ready() {   // metadata in and the target inside a seekable range (or out of reach)
        if (audio.readyState < 1) return false;
        if (pastEnd()) return true;
        var s = audio.seekable;
        for (var k = 0; k < s.length; k++) { if (t >= s.start(k) && t <= s.end(k)) return true; }
        return false;
      }
      function stop() {
        evs.forEach(function (e) { audio.removeEventListener(e, trySeek); });
        cancelDeferredSeek = deferredSeekAt = null;
      }
      function trySeek() { if (ready()) { stop(); seek(); } }
      if (ready()) { seek(); return; }
      evs.forEach(function (e) { audio.addEventListener(e, trySeek); });
      cancelDeferredSeek = stop;   // selectTrack, a lyric click or the scrubber call it
      deferredSeekAt = t;
    }
    var playRequest = 0;
    function startPlay() {
      allowPlay = true;
      if (audio.error) {   // failed before: reload, then seek back to where the visitor was
        var at = intendedPosition();
        dropPendingSeek();
        statusLine.textContent = "";
        audio.load();
        if (at > 0) pendingSeek = at;
      }
      applyPendingSeek();
      var request = ++playRequest, promise = audio.play();
      if (promise && typeof promise.then === "function") promise.then(null, function (err) {
        if (request !== playRequest || (err && err.name === "AbortError")) return;   // superseded
        if (audio.error) return;   // the error listener retries with the MP3 or explains
        allowPlay = false;         // refused (autoplay policy, lock screen): back to a working Play
        showPaused();
      });
    }
    function playIndex(i) { selectTrack(i); startPlay(); }
    function next() { playIndex((state.i + 1) % SONGS.length); }
    function prev() { playIndex((state.i - 1 + SONGS.length) % SONGS.length); }

    nextBtn.addEventListener("click", next);
    loopBtn.addEventListener("click", function () {
      loopMode = !loopMode;
      writePreference("arda-loop", loopMode ? "1" : "0");
      loopBtn.setAttribute("aria-pressed", String(loopMode));
    });
    audio.addEventListener("ended", function () {   // play the album through; wrap only when looping
      if (state.i < SONGS.length - 1) playIndex(state.i + 1);
      else if (loopMode) playIndex(0);
    });

    function setPlaybackState(s) {
      if ("mediaSession" in navigator) { try { navigator.mediaSession.playbackState = s; } catch (e) {} }
    }
    function updateMediaSession(song) {
      if (!("mediaSession" in navigator) || typeof window.MediaMetadata !== "function") return;
      try {   // no cover image ships with the site, so no artwork entry
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: song.title + " — " + song.titleEn, artist: "Arda", album: "Arda"
        });
      } catch (e) {}
    }
    function updatePositionState() {
      var ms = navigator.mediaSession, d = audio.duration;
      if (!ms || typeof ms.setPositionState !== "function" || !isFinite(d) || d <= 0) return;
      try {
        ms.setPositionState({ duration: d, playbackRate: audio.playbackRate || 1, position: Math.min(Math.max(0, audio.currentTime), d) });
      } catch (e) {}
    }
    ["loadedmetadata", "durationchange", "play", "pause", "seeked", "ratechange"].forEach(function (e) {
      audio.addEventListener(e, updatePositionState);
    });
    function seekFromOutside(t) {   // lock screen, headset, OS media controls
      var d = audio.duration || SONGS[state.i].duration || 0;
      dropPendingSeek();
      audio.currentTime = Math.max(0, d ? Math.min(t, d) : t);
      updatePositionState();
    }
    function onAction(action, fn) {   // browsers reject actions they don't know, one at a time
      try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) {}
    }
    if ("mediaSession" in navigator && navigator.mediaSession && typeof navigator.mediaSession.setActionHandler === "function") {
      onAction("play", function () { startPlay(); });
      onAction("pause", pauseByVisitor);
      onAction("nexttrack", next);
      onAction("previoustrack", prev);
      onAction("seekto", function (d) { if (d && isFinite(d.seekTime)) seekFromOutside(d.seekTime); });
      onAction("seekbackward", function (d) { seekFromOutside(audio.currentTime - ((d && d.seekOffset) || 10)); });
      onAction("seekforward", function (d) { seekFromOutside(audio.currentTime + ((d && d.seekOffset) || 10)); });
    }

    /* --- share: copy a "#t=" link to the current moment -------------------- */
    var shareBtn = el.querySelector(".btn-share");
    var shareStatus = el.querySelector(".share-status");
    var shareTimer = null;
    function shareUrl() {
      var t = pendingSeek != null && audio.paused ? pendingSeek : audio.currentTime;   // a link not yet played on
      return location.origin + location.pathname + location.search +
        "#t=" + Math.max(0, t || 0).toFixed(1) +
        "&song=" + encodeURIComponent(SONGS[state.i].id);
    }
    function copyBySelection(text) {   // older browsers, and a refused clipboard permission
      var ta = document.createElement("textarea"), ok = false;
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { ok = !!document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      return ok;
    }
    function copyText(text) {
      function fallback() { if (!copyBySelection(text)) throw new Error("copy failed"); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try { return navigator.clipboard.writeText(text).then(null, fallback); }
        catch (e) { return Promise.resolve().then(fallback); }
      }
      return Promise.resolve().then(fallback);
    }
    shareBtn.addEventListener("click", function () {
      shareStatus.textContent = "";   // so the same message is announced again
      copyText(shareUrl()).then(function () {
        shareStatus.textContent = "Link copied";
        shareBtn.innerHTML = CHECK; shareBtn.classList.add("is-copied");
        clearTimeout(shareTimer);
        shareTimer = setTimeout(function () {
          shareBtn.innerHTML = SHARE; shareBtn.classList.remove("is-copied");
        }, 1500);
      }, function () {
        shareStatus.textContent = "Couldn\u2019t copy the link";
      });
    });

    /* The block from the now-playing title to the view toggle: what a share
       link or an archive "listen" should land on (its scroll-margin-top and
       the page's scroll-padding-top keep it clear of the sticky top bar). */
    var playerBlock = el.querySelector(".player");
    function showPlayerBlock(opts) {
      /* Reveal it at once, without the slide: the scroll measures the box as
         drawn, and a block still 18px down mid-fade would end up under the bar. */
      if (!playerBlock.classList.contains("in")) {
        playerBlock.style.transition = "none";
        playerBlock.classList.add("in");
        void playerBlock.offsetHeight;
        playerBlock.style.transition = "";
      }
      try { playerBlock.scrollIntoView(opts); }
      catch (e) { playerBlock.scrollIntoView(true); }
    }
    function followShareLink(link, onLoad) {
      if (link.i !== state.i) selectTrack(link.i, link.t);
      else if (link.t != null) {
        dropPendingSeek();
        pendingSeek = link.t;
        if (allowPlay && !audio.paused) applyPendingSeek(); else showPosition(link.t);
      }
      // On page load jump straight there: a smooth scroll (html has
      // scroll-behavior: smooth) can be cut short while the page settles.
      showPlayerBlock(onLoad ? { block: "start", behavior: "instant" } : { block: "start" });
    }
    var link = readShareLink();
    selectTrack(link ? link.i : 0, link && link.t);
    if (link) followShareLink(link, true);
    window.addEventListener("hashchange", function () {
      var next = readShareLink();
      if (next) followShareLink(next);
    });
    window.ardaPlay = function (i) { selectTrack(i); showPlayerBlock({ block: "start" }); startPlay(); };
  }

  /* --- the archive ------------------------------------------------------ */
  function buildArchive() {
    var el = document.getElementById("archive");
    var LISTEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>';
    SONGS.forEach(function (song, i) {
      var sections = song.sections.map(function (sec) {
        var lines = sec.lines.map(function (l) {
          return '<div class="a-line">' +
            '<div class="a-line__teng" aria-hidden="true">' + esc(teng(l.sin)) + '</div>' +
            '<div class="a-line__rom" lang="sjn">' + esc(l.sin) + '</div>' +
            '<div class="a-line__en" lang="en">' + esc(l.en) + '</div></div>';
        }).join("");
        return '<div class="sect sect--' + String(sec.kind).replace(/[^\w-]/g, "") + '"><p class="sect__label">' + esc(sec.kind) + '</p>' + lines + '</div>';
      }).join("");
      var node = document.createElement("article");
      node.className = "song reveal";
      node.innerHTML =
        '<div class="song__head"><div class="song__teng" aria-hidden="true">' + esc(teng(song.title)) + '</div>' +
        '<h3 class="song__rom" lang="sjn">' + esc(song.title) + '</h3>' +
        '<span class="song__en">' + esc(song.titleEn) + '</span>' +
        '<button class="song__listen" type="button" data-play="' + i + '">' + LISTEN + 'listen</button></div>' +
        sections;
      el.appendChild(node);
    });
    el.querySelectorAll("[data-play]").forEach(function (b) {
      b.addEventListener("click", function () { window.ardaPlay(+b.getAttribute("data-play")); });
    });
  }

  /* --- scroll reveal ---------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (n) { n.classList.add("in"); });
      return;
    }
    /* Any part on screen counts (threshold 0): an archive song is thousands of
       pixels tall, more than a short window (a landscape phone, 200% zoom)
       could ever show a fixed share of. The small negative bottom margin keeps
       the fade visible as a block comes up. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0, rootMargin: "0px 0px -5% 0px" });
    items.forEach(function (n) { io.observe(n); });
  }

  /* --- hero motes ------------------------------------------------------- */
  /* Runs only while the hero is on screen in a visible tab. The colour is read
     once per theme, and a resize re-scatters the motes only when the width
     changes (mobile URL bars resize the height while scrolling). */
  function initMotes() {
    var c = document.querySelector(".hero__motes");
    var ctx = c && c.getContext && c.getContext("2d");
    if (!ctx) return;
    var hero = c.parentElement, motes = [], W = 0, H = 0, col = "", frame = 0;
    var inView = !("IntersectionObserver" in window);
    function size() {
      var r = hero.getBoundingClientRect();
      W = c.width = Math.round(r.width); H = c.height = Math.round(r.height);
    }
    function ink() {
      col = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#d8b46a";
    }
    function make() {
      motes = [];
      var n = Math.min(46, Math.round(W / 26));
      for (var i = 0; i < n; i++) motes.push({
        x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.5 + 0.1, vy: -(Math.random() * 0.18 + 0.03), tw: Math.random() * Math.PI * 2
      });
    }
    function paintStill() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = col;
      motes.forEach(function (m) { ctx.globalAlpha = m.a; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    function draw() {
      frame = 0;
      ctx.clearRect(0, 0, W, H);
      motes.forEach(function (m) {
        m.y += m.vy; m.tw += 0.02;
        if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
        ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.tw));
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      schedule();
    }
    function schedule() {
      if (!reduce && inView && !document.hidden) { if (!frame) frame = requestAnimationFrame(draw); }
      else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    }
    size(); make(); ink();
    window.addEventListener("resize", function () {
      var was = W;
      size();                       // resizing the canvas clears it
      if (W !== was) make();
      if (reduce) paintStill();
    });
    if ("MutationObserver" in window) {
      new MutationObserver(function () { ink(); if (reduce) paintStill(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    if (reduce) { paintStill(); return; }
    if (!inView) {
      new IntersectionObserver(function (entries) {
        inView = entries[entries.length - 1].isIntersecting;
        schedule();
      }).observe(hero);
    }
    document.addEventListener("visibilitychange", schedule);
    schedule();
  }

  /* --- boot ------------------------------------------------------------- */
  function boot() {
    paintStaticTengwar(document);
    initThemes();
    if (SONGS.length) { buildStage(); buildArchive(); }
    paintStaticTengwar(document);
    initReveal();
    initMotes();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
