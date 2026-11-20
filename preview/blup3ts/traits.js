/* BLUP3TS trait reactions + trait charms (PREVIEW, Nov 11 2026).
   Cosmetic or mood only. No level effects. Nothing new to buy.
   Trait names are matched with the same FNV-1a helper as rarity.js and filter.js.
   Preview test pets are injected here so every reaction and charm can be seen. */
(function () {
  'use strict';
  var A = window.BLUP3TS_APP, H = window.BLUP3TS_HOME, Filt = window.BLUP3TS_FILTER;
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var monthOverride = null, lastTap = 0, TAP_COOL = 800, bellTimer = null, pendingFlourish = false;

  function hash(s) {
    var x = 0x811c9dc5, b = new TextEncoder().encode(String(s).trim().toLowerCase());
    for (var i = 0; i < b.length; i++) { x ^= b[i]; x = Math.imul(x, 0x01000193) >>> 0; }
    return x.toString(16);
  }
  function pair(type, value) { return hash(type) + ':' + hash(value); }

  // Hashed type:value pairs (FNV-1a, lowercased). Kept as hashes so this file stays family friendly.
  var G = {
    holiday_christmas: ['b4db8b42:f06a4614','a710dc3c:d7239cd2','1a83051b:17b45581','4babd89d:a32f7d0b','a710dc3c:e0ec5f9b'],
    holiday_halloween: ['6f332041:3ec681f3','1a83051b:f0640ed8'],
    crown: ['a710dc3c:34ea9c90','a710dc3c:bd609fa8','a710dc3c:a16a4c8d','a710dc3c:1ae203c','a710dc3c:872bdd62','1a83051b:632e0be8','d8f0957c:cfcaa9c9'],
    ruby: ['a710dc3c:872bdd62'],
    galaxy: ['8c246a63:7efbbb11','1b2d687d:47cc85fa'],
    laser: ['456d61d9:fbedc68a','456d61d9:4628821e','456d61d9:2b770e9f','456d61d9:35bf7b02','456d61d9:8e06329c','456d61d9:76444899','456d61d9:a5e98288','456d61d9:99b0e736'],
    wings: ['6f332041:be24b1e6','6f332041:5fe08db0','6f332041:7cb2d819','6f332041:2b7f4ed9','1514f29a:e8c38d8f','1514f29a:521aa41','1514f29a:a113bfb4']
  };
  var WING_VAL = { be24b1e6:1, '5fe08db0':1, '7cb2d819':1, '2b7f4ed9':1, e8c38d8f:1, '521aa41':1, a113bfb4:1 };
  var LASER_COL = { 'dark laser':'#6b3bff', 'yellow laser':'#ffe14d', 'red laser':'#ff3b3b', 'blue laser':'#4da3ff', 'thirdeye laser':'#ff7ad9', 'orangie laser':'#ff8a3d', 'laser mecha':'#9fe8ff', 'laser eyes':'#7cff3a' };

  function petOf(x) {
    if (!x) return null;
    if (x.traits || x.rawTraits) return x;
    var id = typeof x === 'string' ? x : x.id, list = (A && A.pets) ? A.pets() : ((window.BLUP3TS_DATA || {}).pets || []);
    return list.filter(function (p) { return p.id === id; })[0] || null;
  }
  function rowsOf(p) {
    p = petOf(p); if (!p) return [];
    var out = [], seen = {};
    function add(t, typ, val) {
      typ = String(typ || '').trim(); val = String(val == null ? '' : val).trim();
      if (!typ || !val) return;
      var k = typ.toLowerCase() + '|' + val.toLowerCase(); if (seen[k]) return; seen[k] = 1;
      out.push({ type: typ, value: val });
    }
    (p.traits || []).forEach(function (t) {
      if (!t) return;
      add(t, t.origType || t.type, t.orig || t.value);
      if (t.value && t.orig && t.value !== t.orig) add(t, t.type, t.value);
    });
    (p.rawTraits || []).forEach(function (t) { if (t) add(t, t.type, t.value); });
    return out;
  }
  function has(p, group) {
    if (group === 'holiday') return has(p, 'holiday_christmas') || has(p, 'holiday_halloween');
    if (group === 'any_trait') return ['holiday_christmas','holiday_halloween','crown','galaxy','laser','wings'].some(function (g) { return has(p, g); });
    var list = G[group]; if (!list) return false;
    return rowsOf(p).some(function (t) { return list.indexOf(pair(t.type, t.value)) >= 0 || (group === 'wings' && isWing(t.type, t.value)); });
  }
  function groupsOf(p) {
    return Object.keys(G).concat(['holiday','any_trait']).filter(function (g) { return has(p, g); });
  }
  function isWing(type, value) {
    if (Filt && Filt.isWing) return Filt.isWing(type, value);
    var t = String(type || '').trim().toLowerCase(), v = String(value || '').trim().toLowerCase();
    if (t === 'wing') return !/^(blank|none)$/.test(v);
    return t === 'weapon' && !!WING_VAL[hash(v)];
  }
  function laserColor(p) {
    var c = '#ff4d4d';
    rowsOf(p).forEach(function (t) {
      var k = String(t.value || '').trim().toLowerCase();
      if (LASER_COL[k]) c = LASER_COL[k];
    });
    return c;
  }

  function normalizePet(p) {
    if (!p || !Array.isArray(p.traits)) return p;
    p.traits.forEach(function (t) {
      var typ = t.origType || t.type, val = t.orig || t.value;
      if (!isWing(typ, val)) return;
      if (t.slot === 'hand') delete t.slot;
      if (/^weapon$/i.test(t.type) && !t.hidden) { t.type = 'Wing'; if (t.orig && !t.value) t.value = t.orig; }
    });
    return p;
  }
  function normalizeAll() {
    var D = window.BLUP3TS_DATA; if (D && Array.isArray(D.pets)) D.pets.forEach(normalizePet);
  }

  // ---------- audio: always through the shared mix (eat master / jam limiter), never straight to the speaker ----------
  function mixNode() {
    // Always the eat.js master gain. That node then feeds the shared DynamicsCompressor limiter.
    // Connecting to the limiter itself would skip the game volume.
    var E = window.BLUP3TS_EAT;
    if (E && typeof E.out === 'function') return E.out();
    return null;
  }
  function audioOk() {
    var E = window.BLUP3TS_EAT;
    if (!A || !A.soundOn || !A.soundOn()) return false;
    if (E && E.unlockAudio) E.unlockAudio();
    return !!(E && E.ctx && E.ctx());
  }
  function ctxNow() { var E = window.BLUP3TS_EAT; return E && E.ctx ? E.ctx() : null; }
  function tone(type, f0, f1, t0, dur, vol) {
    var ctx = ctxNow(), dest = mixNode(); if (!ctx || !dest) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'triangle';
      o.frequency.setValueAtTime(f0, t0);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }
  function noise(t0, dur, freq, q, vol, type) {
    var ctx = ctxNow(), dest = mixNode(); if (!ctx || !dest) return;
    try {
      var len = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0), i;
      for (i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 0.8;
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(dest); src.start(t0); src.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  function playSfx(kind) {
    if (!audioOk()) return false;
    var ctx = ctxNow(), t = ctx.currentTime + 0.008;
    if (kind === 'crown') { tone('sawtooth', 392, 392, t, 0.14, 0.07); tone('sawtooth', 523, 523, t + 0.1, 0.16, 0.07); tone('sawtooth', 784, 784, t + 0.22, 0.28, 0.08); }
    else if (kind === 'galaxy') { tone('sine', 1047, 1568, t, 0.18, 0.06); tone('sine', 1568, 2093, t + 0.08, 0.28, 0.05); tone('triangle', 2093, 2637, t + 0.16, 0.4, 0.035); }
    else if (kind === 'laser') { tone('square', 1400, 420, t, 0.16, 0.05); tone('square', 980, 220, t + 0.05, 0.14, 0.04); }
    else if (kind === 'wings') { noise(t, 0.16, 1800, 0.6, 0.08, 'highpass'); tone('triangle', 520, 720, t, 0.12, 0.04); tone('triangle', 720, 480, t + 0.1, 0.14, 0.04); }
    else if (kind === 'santa') { [659, 784, 988, 1175].forEach(function (f, i) { tone('triangle', f, f, t + i * 0.07, 0.14, 0.05); }); noise(t, 0.22, 6000, 0.7, 0.04, 'highpass'); }
    else if (kind === 'ruby') { tone('sine', 1175, 1175, t, 0.12, 0.06); tone('sine', 1568, 1760, t + 0.07, 0.22, 0.05); tone('triangle', 2349, 2349, t + 0.1, 0.18, 0.03); }
    else if (kind === 'note') { tone('triangle', 659, 659, t, 0.16, 0.07); tone('sine', 988, 988, t + 0.08, 0.22, 0.05); tone('triangle', 1319, 1319, t + 0.16, 0.2, 0.04); }
    else if (kind === 'pumpkin') { tone('triangle', 180, 140, t, 0.16, 0.08); tone('square', 220, 110, t + 0.04, 0.14, 0.03); }
    else if (kind === 'flourish') { tone('sawtooth', 392, 392, t, 0.16, 0.06); tone('sawtooth', 494, 494, t + 0.12, 0.16, 0.06); tone('sawtooth', 587, 587, t + 0.24, 0.18, 0.07); tone('sawtooth', 784, 784, t + 0.36, 0.32, 0.08); }
    else if (kind === 'bell') { tone('sine', 1319, 1976, t, 0.35, 0.045); tone('triangle', 1976, 2637, t + 0.02, 0.4, 0.03); }
    else return false;
    return true;
  }

  // ---------- charms ----------
  var CHARMS = [
    { id: 'charm_crown', name: 'Mini Crown', art: 'store/charm_crown.png', traitGroup: 'crown', fx: 'crown',
      lines: ['Crown time!', 'You lead the band!', 'Sparkle like a king!', 'Ready for the show!'] },
    { id: 'charm_galaxy', name: 'Galaxy Star', art: 'store/charm_galaxy.png', traitGroup: 'galaxy', fx: 'galaxy',
      lines: ['Stars for you!', 'Cosmic high five!', 'Glow like a galaxy!', 'Wish upon me!'] },
    { id: 'charm_laser', name: 'Laser Beam', art: 'store/charm_laser.png', traitGroup: 'laser', fx: 'laser',
      lines: ['Pew pew!', 'Lights on!', 'Beam team!', 'Colour blast!'] },
    { id: 'charm_wings', name: 'Little Wings', art: 'store/charm_wings.png', traitGroup: 'wings', fx: 'wings',
      lines: ['Flap flap!', 'Up we go!', 'Ready to fly!', 'Whee!'] },
    { id: 'charm_santa', name: 'Santa Hat', art: 'store/charm_santa.png', traitGroup: 'holiday_christmas', fx: 'santa',
      lines: ['Ho ho ho!', 'Snow time!', 'Jingle jam!', 'Happy holidays!'] },
    { id: 'charm_ruby', name: 'Ruby Gem', art: 'store/charm_ruby.png', traitGroup: 'ruby', fx: 'ruby',
      lines: ['Shine bright!', 'Ruby ready!', 'Look at that glint!', 'Treasure time!'] },
    { id: 'charm_note', name: 'Gold Note', art: 'store/charm_note.png', traitGroup: 'any_trait', fx: 'note',
      lines: ['Hit it!', 'Make some music!', 'Golden groove!', 'One more note!'] },
    { id: 'charm_pumpkin', name: 'Pumpkin', art: 'store/charm_pumpkin.png', traitGroup: 'holiday_halloween', fx: 'pumpkin',
      lines: ['Boo, friend!', 'Happy harvest!', 'Grin with me!', 'Spooky cute!'] }
  ];
  var GROUP_NAME = { crown: 'crown', galaxy: 'galaxy', laser: 'laser', wings: 'wing', holiday_christmas: 'holiday', ruby: 'ruby crown', any_trait: 'trait', holiday_halloween: 'pumpkin' };
  function charmOf(id) { return CHARMS.filter(function (c) { return c.id === id; })[0] || null; }

  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

  function placeBubble(b, w, st) {
    if (!b || !w || !st) return;
    b.style.left = ''; b.style.top = ''; b.style.maxWidth = '';
    b.classList.remove('left', 'right', 'below');
    var sw = st.clientWidth || 452, sh = st.clientHeight || 660;
    var sr = st.getBoundingClientRect(), wr = w.getBoundingClientRect();
    var scale = sr.width / Math.max(1, sw); // how much the stage is shrunk on screen (Duo Horizontal can be ~0.3)
    // Keep the spoken words about 16px on a 390-wide phone, and no smaller than that when the stage shrinks.
    var boost = (scale > 0) ? Math.min(2.5, Math.max(1, 16 / (16 * scale))) : 1;
    b.style.setProperty('--charm-boost', String(boost));
    var maxW = Math.min(220, Math.max(110, (sw - 24) / boost));
    b.style.maxWidth = maxW + 'px';
    var cx = (wr.left - sr.left) / scale, cy = (wr.top - sr.top) / scale;
    var cw = wr.width / scale, ch = wr.height / scale;
    var bw = b.offsetWidth * boost, bh = b.offsetHeight * boost; // visual size in stage units
    var left = cx + cw + 8, top = Math.max(4, cy - 4), side = 'right';
    if (left + bw > sw - 8) { left = cx - bw - 8; side = 'left'; }
    if (left < 8 || left + bw > sw - 8) {
      side = 'below';
      left = Math.max(8, Math.min(sw - bw - 8, cx + cw / 2 - bw / 2));
      top = cy + ch + 6;
    }
    if (top + bh > sh - 8) top = Math.max(4, sh - bh - 8);
    if (left < 8) left = 8;
    if (left + bw > sw - 8) left = Math.max(8, sw - bw - 8);
    // map visual-left to CSS left: right-origin grows left; below (center origin) grows both ways
    if (side === 'left') left = left + (bw / boost) * (boost - 1);
    if (side === 'below') left = left + (bw / boost) * (boost - 1) / 2;
    b.style.left = Math.round(left) + 'px';
    b.style.top = Math.round(top) + 'px';
    b.classList.add(side);
  }
  function showBubble(w, text) {
    var st = (w && (w.closest ? w.closest('#stage') : null)) || $('stage') || (w && w.parentNode);
    if (!st) return;
    var b = $('charmBubble');
    if (!b) { b = el('span', 'charmbubble'); b.id = 'charmBubble'; b.setAttribute('role', 'status'); st.appendChild(b); }
    else if (b.parentNode !== st) st.appendChild(b);
    b.textContent = text;
    b.hidden = false;
    b.classList.remove('show', 'left', 'right', 'below');
    void b.offsetWidth;
    placeBubble(b, w, st);
    b.classList.add('show');
    clearTimeout(b.__t);
    b.__t = setTimeout(function () { b.hidden = true; b.classList.remove('show'); }, 3400);
  }
  function clearFx(w) {
    if (!w) return;
    w.className = (w.className || '').split(/\s+/).filter(function (c) { return c && c.indexOf('fx-') !== 0 && c !== 'tapped'; }).join(' ');
    [].forEach.call(w.querySelectorAll('.charmfx'), function (n) { n.remove(); });
    var ov = $('stage') && $('stage').querySelectorAll('.traitfx-overlay');
    if (ov) [].forEach.call(ov, function (n) { if (n.dataset.kind === 'charm') n.remove(); });
  }
  function sparkleBits(host, n, cls) {
    if (reduced.matches) return;
    for (var i = 0; i < n; i++) {
      var s = el('i', 'charmfx ' + (cls || 'bit')); s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--a', (i / n * 360) + 'deg'); s.style.setProperty('--d', (80 + Math.random() * 80) + 'ms');
      host.appendChild(s);
      (function (s) { setTimeout(function () { s.remove(); }, 1200); })(s);
    }
  }
  function snow(host, n) {
    if (reduced.matches) { sparkleBits(host, 3, 'bit'); return; }
    var st = $('stage') || host;
    for (var i = 0; i < n; i++) {
      var s = el('i', 'charmfx flake'); s.setAttribute('aria-hidden', 'true');
      s.style.left = (12 + Math.random() * 76) + '%'; s.style.setProperty('--t', (800 + Math.random() * 700) + 'ms');
      st.appendChild(s);
      (function (s) { setTimeout(function () { s.remove(); }, 1600); })(s);
    }
  }
  function notesBurst(host, n) {
    var st = $('stage') || host;
    for (var i = 0; i < n; i++) {
      var s = el('i', 'charmfx gnote'); s.textContent = i % 2 ? '♪' : '♫'; s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--x', ((Math.random() - 0.5) * 160) + 'px');
      st.appendChild(s);
      (function (s) { setTimeout(function () { s.remove(); }, 1300); })(s);
    }
  }
  function tapGlow(color) {
    if (reduced.matches) return;
    var o = overlay('charmglow', 1100, 'charm'); if (!o) return;
    o.style.setProperty('--glow', color || '#ffe27a');
  }
  function onCharmTap(w, it) {
    var now = Date.now(); if (now - lastTap < TAP_COOL) return false; lastTap = now;
    var ch = charmOf(it && it.id);
    var lines = (ch && ch.lines) || (it && it.lines) || ['Nice!'];
    var fx = (ch && ch.fx) || 'spark';
    clearFx(w);
    w.classList.add('tapped', 'fx-' + fx);
    var glow = { crown: '#ffe27a', galaxy: '#c9a8ff', laser: '#ff6b6b', wings: '#ffe9c4', santa: '#ff7a7a', ruby: '#ff6fae', note: '#ffd65a', pumpkin: '#ff8a3d' };
    if (fx === 'crown') { sparkleBits(w, 16, 'bit gold'); tapGlow(glow.crown); }
    else if (fx === 'galaxy') { sparkleBits(w, 18, 'bit star'); tapGlow(glow.galaxy); }
    else if (fx === 'laser') { sparkleBits(w, 14, 'bit beam'); tapGlow(laserColor(A.petDef()) || glow.laser); sweep(laserColor(A.petDef()), 1000, true); }
    else if (fx === 'wings') { sparkleBits(w, 14, 'bit'); tapGlow(glow.wings); }
    else if (fx === 'santa') { snow(w, 18); tapGlow(glow.santa); }
    else if (fx === 'ruby') { sparkleBits(w, 14, 'bit ruby'); tapGlow(glow.ruby); }
    else if (fx === 'note') { notesBurst(w, 10); tapGlow(glow.note); }
    else if (fx === 'pumpkin') { sparkleBits(w, 12, 'bit orange'); tapGlow(glow.pumpkin); }
    else { sparkleBits(w, 12, 'bit'); tapGlow(glow.crown); }
    var line = lines[(w.__n || 0) % lines.length]; w.__n = (w.__n || 0) + 1;
    showBubble(w, line);
    playSfx(fx);
    setTimeout(function () { if (w) w.classList.remove('fx-' + fx, 'tapped'); }, 1250);
    return true;
  }

  // ---------- stage overlays (lasers, crown sparkle, galaxy stars) ----------
  function overlay(cls, ms, kind) {
    var st = $('stage'); if (!st) return null;
    var o = el('div', 'traitfx-overlay ' + (cls || '')); o.dataset.kind = kind || 'fx'; o.setAttribute('aria-hidden', 'true');
    st.appendChild(o); setTimeout(function () { o.remove(); }, ms || 900);
    return o;
  }
  function sweep(color, ms, fromCharm) {
    var o = overlay('laser-show' + (fromCharm ? ' fromcharm' : ''), ms || 900, fromCharm ? 'charm' : 'jam');
    if (!o) return;
    o.style.setProperty('--laser', color || '#ff4d4d');
    for (var i = 0; i < 6; i++) {
      var b = el('i', 'lbeam'); b.style.setProperty('--i', i); b.style.background = color || '#ff4d4d'; o.appendChild(b);
    }
  }
  function crownSparkle() {
    var o = overlay('crown-spark', 900, 'spark'); if (!o) return;
    for (var i = 0; i < 8; i++) { var s = el('i', 'cspk'); s.style.setProperty('--a', (i / 8 * 360) + 'deg'); o.appendChild(s); }
    playSfx('crown');
  }
  function galaxySparkle(where) {
    var host = $(where) || $('stage') || $('fx'); if (!host) return;
    if (A && A.jam && A.jam.burst) A.jam.burst('star', 6);
    for (var i = 0; i < 8; i++) {
      var s = el('i', 'galaxyspk'); s.setAttribute('aria-hidden', 'true');
      s.style.left = (20 + Math.random() * 60) + '%'; s.style.top = (20 + Math.random() * 50) + '%';
      host.appendChild(s);
      (function (s) { setTimeout(function () { s.remove(); }, 800); })(s);
    }
  }
  function clearHopFx() {
    [].forEach.call(document.querySelectorAll('.wing-shadow, .wingflap, .feather'), function (n) { n.remove(); });
  }
  function wingHop(delay) {
    // Wait one beat so the combo-8 star burst can play first, then take off on its own beat.
    var wait = delay == null ? 560 : delay;
    setTimeout(function () {
      var w = $('petWrap'), host = w && w.parentNode; if (!w) return;
      clearHopFx();
      w.classList.remove('chomp', 'hop', 'shake', 'winghop'); void w.offsetWidth; w.classList.add('winghop');
      if (host && !(reduced && reduced.matches)) {
        var sh = el('i', 'wing-shadow'); sh.setAttribute('aria-hidden', 'true');
        sh.style.left = w.offsetLeft + 'px';
        sh.style.top = (w.offsetTop + w.offsetHeight - 10) + 'px';
        sh.style.width = w.offsetWidth + 'px';
        host.appendChild(sh);
        var fl = el('i', 'wingflap left'), fr = el('i', 'wingflap right');
        fl.setAttribute('aria-hidden', 'true'); fr.setAttribute('aria-hidden', 'true');
        w.appendChild(fl); w.appendChild(fr);
        for (var i = 0; i < 12; i++) {
          var f = el('i', 'feather'); f.setAttribute('aria-hidden', 'true');
          var ang = (i / 12) * 360;
          f.style.left = (w.offsetLeft + w.offsetWidth * 0.5 - 5) + 'px';
          f.style.top = (w.offsetTop + w.offsetHeight * 0.35) + 'px';
          f.style.setProperty('--a', ang + 'deg');
          f.style.setProperty('--dx', Math.round(Math.cos(ang * Math.PI / 180) * (50 + Math.random() * 40)) + 'px');
          f.style.setProperty('--dy', Math.round(-30 - Math.random() * 70) + 'px');
          f.style.setProperty('--d', (40 + i * 40) + 'ms');
          host.appendChild(f);
        }
      }
      if (audioOk()) playSfx('wings');
      setTimeout(function () { w.classList.remove('winghop'); clearHopFx(); }, 1450);
    }, wait);
  }

  function curPet() { return A && A.petDef ? A.petDef() : null; }
  function award(id) { var F = window.BLUP3TS_FUN; if (F && F.award) return F.award(id); return false; }
  function calMonth() { return monthOverride || (new Date().getMonth() + 1); }

  function holidayBeat(p) {
    if (has(p, 'holiday_christmas')) return 'jingle';
    if (has(p, 'holiday_halloween')) return 'spooky';
    return null;
  }

  function startBells() {
    stopBells();
    function tick() {
      if (!A || !A.jam || !A.jam.running()) return stopBells();
      if (audioOk()) playSfx('bell');
      var p = (A.jam.period && A.jam.period()) || 500;
      bellTimer = setTimeout(tick, Math.max(400, p * 4));
    }
    tick();
  }
  function stopBells() { if (bellTimer) { clearTimeout(bellTimer); bellTimer = null; } }

  // ---------- events ----------
  document.addEventListener('blup3ts:jamstart', function (e) {
    var d = e.detail || {}, p = curPet();
    pendingFlourish = false;
    if (has(p, 'crown')) { pendingFlourish = true; setTimeout(function () { if (pendingFlourish) playSfx('flourish'); }, 180); }
    if (has(p, 'galaxy')) { startBells(); award('galaxy'); }
    var want = holidayBeat(p);
    if (want && d.beat === want) award(want === 'jingle' ? 'holiday_jingle' : 'holiday_spooky');
  });
  document.addEventListener('blup3ts:jamtap', function (e) {
    var d = e.detail || {}, p = curPet();
    if (d.player && d.player !== 1) return;
    if (d.grade === 'perfect' && has(p, 'galaxy')) galaxySparkle('ov-jam');
    if (d.grade === 'perfect' && d.combo) { /* combo handled below if provided */ }
  });
  document.addEventListener('blup3ts:jamend', function () { stopBells(); pendingFlourish = false; });
  document.addEventListener('blup3ts:pat', function () {
    var p = curPet(); if (has(p, 'galaxy')) galaxySparkle('fx');
  });
  document.addEventListener('blup3ts:levelup', function () {
    if (has(curPet(), 'crown')) setTimeout(crownSparkle, 400);
  });
  document.addEventListener('blup3ts:fed', function () {
    var F = window.BLUP3TS_FUN; if (!F || !F.streakLive) return;
    if (F.streakLive() > 0 && has(curPet(), 'crown')) setTimeout(crownSparkle, 700);
  });

  // Hook combo 8 / 20 from extras by wrapping award + watching the meter, and by listening after extras paints.
  function onCombo(n, d) {
    var p = curPet();
    if (!n || n % 8 !== 0) return;
    if (has(p, 'wings')) wingHop();
    if (has(p, 'laser') && (n === 8 || n === 20 || n % 8 === 0) && (n === 8 || n === 20 || n >= 8)) {
      if (n === 8 || n === 20) sweep(laserColor(p), n === 20 ? 1200 : 900, false);
    }
  }
  // extras.js comboTap already fires fill at every 8. We watch jamtap and count locally during a jam.
  var localCombo = 0;
  document.addEventListener('blup3ts:jamstart', function () { localCombo = 0; });
  document.addEventListener('blup3ts:jamtap', function (e) {
    var d = e.detail || {}; if (d.player && d.player !== 1) return;
    if (d.grade === 'perfect') localCombo++; else if (d.grade === 'miss') localCombo = 0;
    if (d.grade === 'perfect' && localCombo && localCombo % 8 === 0) onCombo(localCombo, d);
  });

  // ---------- preview test pets (not added in the go-live pack) ----------
  var PREVIEW_PETS = [
    { id: 'preview-holiday', name: 'Preview Holiday', collection: 'MNK3YS', img: 'assets/mnk3y_1579.png',
      traits: [{ type: 'Fur', value: 'Santa Beard', share: 0.44 }, { type: 'Clothes', value: 'Santa Coat', share: 0.18 }, { type: 'Top', value: 'Golden Reindeer', share: 0.12 }, { type: 'Background', value: 'Christmas Morning', share: 0.1 }] },
    { id: 'preview-crown', name: 'Preview Crown', collection: 'MNK3YS', img: 'assets/mnk3y_1579.png',
      traits: [{ type: 'Top', value: 'Kings Crown', share: 0.58 }, { type: 'Clothes', value: 'Kings Robes', share: 0.62 }, { type: 'Front Weapon', value: 'Kings Staff', share: 0.64 }] },
    { id: 'preview-ruby', name: 'Preview Ruby', collection: 'ZMB3YS', img: 'pets/zmb3y_1885.webp', round: false,
      traits: [{ type: 'Top', value: 'Ruby Crown', share: 0.34 }, { type: 'Zmb3y', value: 'Glowing Zmb3y', share: 2.47 }] },
    { id: 'preview-galaxy', name: 'Preview Galaxy', collection: 'MNK3YS', img: 'assets/mnk3y_1579.png',
      traits: [{ type: 'MNK3Y', value: 'Galaxy', share: 2.71 }] },
    { id: 'preview-laser', name: 'Preview Laser', collection: 'MNK3YS', img: 'assets/mnk3y_1579.png',
      traits: [{ type: 'Accessory', value: 'Red Laser', share: 1.91 }] },
    { id: 'preview-wings', name: 'Preview Wings', collection: 'MNK3YS', img: 'assets/mnk3y_1579.png',
      traits: [{ type: 'Weapon', value: 'White Wing', share: 0.42 }] },
    { id: 'preview-pumpkin', name: 'Preview Pumpkin', collection: 'MNK3YS', img: 'assets/mnk3y_1579.png',
      traits: [{ type: 'Clothes', value: 'Pumpkin Suit', share: 0.06 }, { type: 'Weapon', value: 'Jack O Lantern', share: 0.24 }] }
  ];
  function isPreviewPetId(id) { return typeof id === 'string' && id.indexOf('preview-') === 0; }
  function installPreviewPets() {
    // Go-live: these pets were only for the preview build. They used to start at very high strength, which opened collection cases and instruments for every pet. They stay out of the playable list. Trait charms still unlock on a real pet that has the matching trait.
    var D = window.BLUP3TS_DATA; if (!D || !Array.isArray(D.pets)) return;
    D.pets = D.pets.filter(function (p) { return p && !isPreviewPetId(p.id); });
    if (A && A.state) {
      var st = A.state();
      if (st && st.pets) Object.keys(st.pets).forEach(function (id) { if (isPreviewPetId(id)) delete st.pets[id]; });
      if (st && st.looks) Object.keys(st.looks).forEach(function (id) { if (isPreviewPetId(id)) delete st.looks[id]; });
      if (st && isPreviewPetId(st.active) && D.pets[0]) st.active = D.pets[0].id;
      if (A.save) A.save();
    }
  }

  function autoEquip(pd) {
    var S = window.BLUP3TS_STORE; if (!S || !pd) return;
    var m = null;
    try { m = JSON.parse(localStorage.getItem('blup3ts.web.charms') || '{}'); } catch (e) { m = {}; }
    if (m[pd.id]) return;
    var pick = CHARMS.filter(function (c) { return has(pd, c.traitGroup); })[0];
    if (pick && S.equip) S.equip(pd, pick.id);
  }

  window.BLUP3TS_TRAITS = {
    has: has, groups: groupsOf, isWing: isWing, laserColor: laserColor, charms: function () { return CHARMS.map(function (c) { return { id: c.id, kind: 'item', name: c.name, art: c.art, traitGroup: c.traitGroup, collection: 'MNK3YS', token: 'blunana', price: 0, lines: c.lines, fx: c.fx }; }); },
    charmMeta: charmOf, groupName: function (g) { return GROUP_NAME[g] || g; }, onCharmTap: onCharmTap, showBubble: showBubble, placeBubble: placeBubble,
    playSfx: playSfx, mixNode: mixNode, sweep: sweep, crownSparkle: crownSparkle, galaxySparkle: galaxySparkle, wingHop: wingHop,
    monthForTest: function (n) { if (arguments.length) monthOverride = (n >= 1 && n <= 12) ? n : null; return monthOverride; },
    installPreviewPets: installPreviewPets, normalizePet: normalizePet, autoEquip: autoEquip,
    cooldown: TAP_COOL, previewPets: PREVIEW_PETS
  };

  normalizeAll();
  installPreviewPets();
  if (A && A.addPets) {
    var prev = A.addPets;
    A.addPets = function (list) { if (Array.isArray(list)) list.forEach(normalizePet); var r = prev.apply(this, arguments); installPreviewPets(); return r; };
  }
  if (A && A.setActive) {
    var prevSet = A.setActive;
    A.setActive = function (id) {
      var r = prevSet.apply(this, arguments);
      try {
        var b = document.getElementById('charmBubble'); if (b) { b.hidden = true; b.classList.remove('show'); }
        autoEquip(A.petDef());
        if (window.BLUP3TS_STORE && BLUP3TS_STORE.paintCharm) BLUP3TS_STORE.paintCharm(A.petDef());
      } catch (e) {}
      return r;
    };
  }
  if (A && A.render) { try { A.render(); } catch (e) {} }
  try { autoEquip(A && A.petDef && A.petDef()); } catch (e) {}
  if (window.BLUP3TS_STORE && BLUP3TS_STORE.paintCharm) { try { BLUP3TS_STORE.paintCharm(A && A.petDef && A.petDef()); } catch (e) {} }
})();
