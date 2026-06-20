/* Arda — player, synced lyrics, themes. Vanilla, no build step.
   Data: window.ARDA_SONGS (lyrics) + window.ARDA_TENGWAR (script map). */
(function () {
  "use strict";

  var T = window.ARDA_TENGWAR || {};
  var SONGS = window.ARDA_SONGS || [];
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function teng(s) { return T[s] || s; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
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

  /* --- Tengwar for all static [data-teng] chrome ------------------------ */
  function paintStaticTengwar(root) {
    (root || document).querySelectorAll("[data-teng]").forEach(function (el) {
      el.textContent = teng(el.getAttribute("data-teng"));
    });
  }

  /* --- theme switch ----------------------------------------------------- */
  function initThemes() {
    var saved = localStorage.getItem("arda-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    var current = document.documentElement.getAttribute("data-theme");
    document.querySelectorAll(".themeswitch button").forEach(function (b) {
      var name = b.getAttribute("data-theme-name");
      b.setAttribute("aria-pressed", String(name === current));
      b.addEventListener("click", function () {
        document.documentElement.setAttribute("data-theme", name);
        localStorage.setItem("arda-theme", name);
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
  function loadLrc(song) {
    if (window.ARDA_LRC && window.ARDA_LRC[song.id]) {
      return Promise.resolve(parseLrc(window.ARDA_LRC[song.id]));
    }
    if (!song.lrc) return Promise.resolve(null);
    return fetch(song.lrc)
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (t) { return t ? parseLrc(t) : null; })
      .catch(function () { return null; });
  }

  /* --- the stage -------------------------------------------------------- */
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>';
  var VOL_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.8a4 4 0 0 1 0 6.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M19 6.5a7 7 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var VOL_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function buildStage() {
    var el = document.getElementById("stage");
    var tracks = SONGS.map(function (s, i) {
      var roman = ["I", "II", "III", "IV", "V"][i] || (i + 1);
      return '<button class="track" type="button" data-i="' + i + '" aria-current="' + (i === 0) + '">' +
        '<span class="track__num">' + roman + '</span>' +
        '<span><span class="track__rom">' + esc(s.title) + '</span> ' +
        '<span class="track__en">' + esc(s.titleEn) + '</span></span>' +
        '<span class="track__dur" data-dur="' + i + '">' + fmt(s.duration) + '</span></button>';
    }).join("");

    el.innerHTML =
      '<header class="section-head reveal"><p class="section-kicker">the stage</p>' +
      '<h2>Listen</h2><p class="section-lede">Choose a song. With the sound on, the lyrics light line by line — Tengwar, Sindarin, or English.</p></header>' +
      '<div class="tracklist reveal">' + tracks + '</div>' +
      '<div class="reveal"><div class="np">' +
        '<div class="np__teng" data-np="teng"></div>' +
        '<div class="np__rom" data-np="rom"></div>' +
        '<div class="np__en" data-np="en"></div></div>' +
      '<div class="lyrics" data-view="all"><div class="lyrics__scroller"></div></div>' +
      '<p class="lyrics-hint"></p>' +
      '<div class="controls">' +
        '<button class="btn-play" type="button" aria-label="Play">' + PLAY + '</button>' +
        '<span class="time time--cur">0:00</span>' +
        '<input class="scrub" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" />' +
        '<span class="time time--dur">0:00</span>' +
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
    var scroller = el.querySelector(".lyrics__scroller");
    var lyricsBox = el.querySelector(".lyrics");
    var playBtn = el.querySelector(".btn-play");
    var scrub = el.querySelector(".scrub");
    var curT = el.querySelector(".time--cur");
    var durT = el.querySelector(".time--dur");
    var hint = el.querySelector(".lyrics-hint");

    var state = { i: -1, lines: [], times: null, active: -1 };

    function renderLyrics(song) {
      state.lines = flatten(song);
      scroller.innerHTML = state.lines.map(function (l, idx) {
        return '<div class="lyric" data-idx="' + idx + '">' +
          '<div class="lyric__teng">' + teng(l.sin) + '</div>' +
          '<div class="lyric__rom">' + esc(l.sin) + '</div>' +
          '<div class="lyric__en">' + esc(l.en) + '</div></div>';
      }).join("");
      scroller.querySelectorAll(".lyric").forEach(function (node) {
        node.addEventListener("click", function () {
          var idx = +node.getAttribute("data-idx");
          if (state.times && state.times[idx] != null) { audio.currentTime = state.times[idx]; audio.play(); }
        });
      });
    }

    function setActive(idx) {
      if (idx === state.active) return;
      state.active = idx;
      var nodes = scroller.children;
      for (var k = 0; k < nodes.length; k++) {
        nodes[k].classList.toggle("is-active", k === idx);
        nodes[k].classList.toggle("is-past", k < idx);
      }
      var node = nodes[idx];
      if (node) {
        var y = lyricsBox.clientHeight / 2 - (node.offsetTop + node.offsetHeight / 2);
        scroller.style.transform = "translateY(" + y + "px)";
      }
    }

    function selectTrack(i) {
      if (i === state.i) return;
      state.i = i; state.active = -1; state.times = null;
      var song = SONGS[i];
      Array.prototype.forEach.call(el.querySelectorAll(".track"), function (t) {
        t.setAttribute("aria-current", String(+t.getAttribute("data-i") === i));
      });
      el.querySelector('[data-np="teng"]').textContent = teng(song.title);
      el.querySelector('[data-np="rom"]').textContent = song.title;
      el.querySelector('[data-np="en"]').textContent = song.titleEn;
      audio.src = song.audio;
      renderLyrics(song);
      scroller.style.transform = "translateY(0)";
      lyricsBox.classList.remove("is-synced"); lyricsBox.classList.add("is-static");
      hint.textContent = "";
      loadLrc(song).then(function (times) {
        if (times && times.length) {
          state.times = times;
          lyricsBox.classList.add("is-synced"); lyricsBox.classList.remove("is-static");
        } else {
          hint.textContent = "Lyrics sync follows once a timed .lrc is added.";
        }
      });
    }

    playBtn.addEventListener("click", function () { audio.paused ? audio.play() : audio.pause(); });
    audio.addEventListener("play", function () { playBtn.innerHTML = PAUSE; playBtn.setAttribute("aria-label", "Pause"); });
    audio.addEventListener("pause", function () { playBtn.innerHTML = PLAY; playBtn.setAttribute("aria-label", "Play"); });
    audio.addEventListener("loadedmetadata", function () { durT.textContent = fmt(audio.duration); });
    audio.addEventListener("timeupdate", function () {
      var d = audio.duration || SONGS[state.i].duration || 0;
      curT.textContent = fmt(audio.currentTime);
      var pct = d ? (audio.currentTime / d) * 100 : 0;
      scrub.value = pct * 10;
      scrub.style.background = "linear-gradient(to right, var(--accent) " + pct + "%, var(--hair) " + pct + "%)";
      if (state.times) {
        var a = -1;
        for (var k = 0; k < state.times.length; k++) { if (state.times[k] <= audio.currentTime) a = k; else break; }
        if (a >= 0) setActive(a);
      }
    });
    scrub.addEventListener("input", function () {
      var d = audio.duration || 0;
      if (d) audio.currentTime = (scrub.value / 1000) * d;
    });

    var volSlider = el.querySelector(".vol__slider");
    var volBtn = el.querySelector(".vol__btn");
    var lastVol = 1;
    function applyVol(v, save) {
      v = Math.min(1, Math.max(0, v));
      audio.volume = v;
      if (v > 0) lastVol = v;
      volSlider.value = Math.round(v * 100);
      volSlider.style.background = "linear-gradient(to right, var(--accent) " + v * 100 + "%, var(--hair) " + v * 100 + "%)";
      volBtn.innerHTML = v <= 0 ? VOL_OFF : VOL_ON;
      volBtn.setAttribute("aria-label", v <= 0 ? "Unmute" : "Mute");
      if (save) localStorage.setItem("arda-volume", String(v));
    }
    var savedVol = parseFloat(localStorage.getItem("arda-volume"));
    applyVol(isNaN(savedVol) ? 1 : savedVol, false);
    volSlider.addEventListener("input", function () { applyVol(volSlider.value / 100, true); });
    volBtn.addEventListener("click", function () { applyVol(audio.volume > 0 ? 0 : lastVol || 1, true); });

    el.querySelectorAll(".track").forEach(function (t) {
      t.addEventListener("click", function () { selectTrack(+t.getAttribute("data-i")); });
      var i = +t.getAttribute("data-i");
      var a = new Audio(); a.preload = "metadata"; a.src = SONGS[i].audio;
      a.addEventListener("loadedmetadata", function () {
        el.querySelector('[data-dur="' + i + '"]').textContent = fmt(a.duration);
      });
    });

    el.querySelectorAll(".viewtoggle button").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-view");
        lyricsBox.setAttribute("data-view", v);
        el.querySelectorAll(".viewtoggle button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        if (state.active >= 0) setActive(state.active);
      });
    });

    selectTrack(0);
    window.ardaPlay = function (i) { selectTrack(i); document.getElementById("stage").scrollIntoView(); audio.play(); };
  }

  /* --- the archive ------------------------------------------------------ */
  function buildArchive() {
    var el = document.getElementById("archive");
    var LISTEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>';
    SONGS.forEach(function (song, i) {
      var sections = song.sections.map(function (sec) {
        var lines = sec.lines.map(function (l) {
          return '<div class="a-line">' +
            '<div class="a-line__teng" aria-hidden="true">' + teng(l.sin) + '</div>' +
            '<div class="a-line__rom" lang="sjn">' + esc(l.sin) + '</div>' +
            '<div class="a-line__en" lang="en">' + esc(l.en) + '</div></div>';
        }).join("");
        return '<div class="sect sect--' + sec.kind + '"><p class="sect__label">' + sec.kind + '</p>' + lines + '</div>';
      }).join("");
      var node = document.createElement("article");
      node.className = "song reveal";
      node.innerHTML =
        '<div class="song__head"><div class="song__teng" aria-hidden="true">' + teng(song.title) + '</div>' +
        '<h3 class="song__rom">' + esc(song.title) + '</h3>' +
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
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* --- hero motes ------------------------------------------------------- */
  function initMotes() {
    var c = document.querySelector(".hero__motes");
    if (!c) return;
    var ctx = c.getContext("2d"), motes = [], W, H;
    function size() {
      var r = c.parentElement.getBoundingClientRect();
      W = c.width = r.width; H = c.height = r.height;
    }
    function ink() {
      return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#d8b46a";
    }
    function make() {
      motes = [];
      var n = Math.min(46, Math.round(W / 26));
      for (var i = 0; i < n; i++) motes.push({
        x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.5 + 0.1, vy: -(Math.random() * 0.18 + 0.03), tw: Math.random() * Math.PI * 2
      });
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var col = ink();
      motes.forEach(function (m) {
        m.y += m.vy; m.tw += 0.02;
        if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
        ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.tw));
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    size(); make();
    window.addEventListener("resize", function () { size(); make(); });
    if (reduce) {
      var col = ink(); ctx.fillStyle = col;
      motes.forEach(function (m) { ctx.globalAlpha = m.a; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    } else { draw(); }
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
