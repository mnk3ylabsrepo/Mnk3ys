/* BLUP3TS extras (Nov 10 2026, round 3): beat picker, care streak, pet diary stickers, seasonal beats, jam combo,
   Songbook, band builder + jukebox, Community Jam (Saturdays) and Duo band jam.
   Rules: nothing to buy, no loot boxes, no XP. Levels only ever come from feeding. Jam things change mood only.
   Saved like the rest of the game: localStorage 'blup3ts.web.fun' (JSON). Reset clears it with every other blup3ts.web.* key. */
(function () {
  'use strict';
  var A = window.BLUP3TS_APP, H = window.BLUP3TS_HOME; if (!A || !A.jam || !H) return;
  var J = A.jam, CFG = window.BLUP3TS_CONFIG || {}, KEY = 'blup3ts.web.fun';
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function $(id) { return document.getElementById(id); }
  function el(t, c, txt) { var n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; }
  function btn(c, txt, fn, label) { var b = el('button', 'btn ' + (c || ''), txt); b.type = 'button'; if (label) b.setAttribute('aria-label', label); if (fn) b.onclick = fn; return b; }
  function img(src, c, alt) { var i = document.createElement('img'); i.src = src; i.className = c || ''; i.alt = alt || ''; i.loading = 'lazy'; return i; }

  // ---------- save (same pattern as the main save: one JSON value under the blup3ts.web. prefix) ----------
  function blank() { return { v: 1, fed: [], rested: [], streak: 0, best: 0, stickers: {}, newStk: 0, combo: {}, stamps: {}, comm: { week: '', mine: 0, beat: false, joined: [] }, duoJams: 0 }; }
  var F = (function () { try { var o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 1) { var b = blank(); for (var k in b) if (!(k in o)) o[k] = b[k]; return o; } } catch (e) {} return blank(); })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(F)); } catch (e) {} }
  if (A.onReset) { var prevReset = A.onReset; A.onReset = function () { F = blank(); paintBadge(); try { prevReset(); } catch (e) {} }; } else A.onReset = function () { F = blank(); paintBadge(); };

  // ---------- dates (the player's own day for the streak) ----------
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function dayGap(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  function niceDay(s) { try { return parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return s; } }
  function weekKey(s) { var d = parse(s), wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); } // Monday of that week

  // ---------- pet diary stickers ----------
  var STK = [
    ['first_feed', 'First snack', 'Feed your pet a banana.'], ['first_jam', 'First jam', 'Play your first Jam.'], ['first_perfect', 'Perfect tap', 'Get a Perfect in Jam.'],
    ['combo_8', 'On fire', '8 Perfects in a row.'], ['combo_20', 'Combo champ', '20 Perfects in a row.'], ['streak_3', 'Banana chain', '3 care days in a row.'],
    ['streak_7', 'Banana week', '7 care days in a row.'], ['streak_30', 'Banana month', '30 care days in a row.'], ['first_stamp', 'Songbook stamp', 'Earn your first Songbook stamp.'],
    ['band', 'Full band', 'Fill all four band seats.'], ['duo_jam', 'Band buddies', 'Play a Duo band jam with a friend.'], ['seasonal', 'Beat of the month', 'Jam to this month\u2019s beat.'],
    ['level_5', 'Level 5', 'Feed a pet to Level 5.'], ['level_10', 'Level 10', 'Feed a pet to Level 10.'], ['didg', 'Didgeridoo', 'Unlock the Didgeridoo at Level 11.'], ['community', 'Saturday jammer', 'Join a Community Jam.'],
    ['holiday_jingle', 'Festive jam', 'Jam Jingle Lofi with a holiday pet.'], ['holiday_spooky', 'Spooky jam', 'Jam Spooky Funk with a pumpkin pet.'], ['galaxy', 'Galaxy glow', 'Jam with a galaxy pet.']
  ];
  function stickerName(id) { var s = STK.filter(function (x) { return x[0] === id; })[0]; return s ? s[1] : id; }
  function award(id) {
    if (F.stickers[id]) return false; F.stickers[id] = ymd(); F.newStk = (F.newStk || 0) + 1; save(); paintBadge();
    if (J.running() || inJam) { pending.push(id); return true; } // never cover the pet mid-jam: show it when the jam ends
    showSticker(id, 400); return true;
  }
  var pending = [], inJam = false;
  function showSticker(id, ms) { setTimeout(function () { A.jam.toast('📔 New diary sticker: ' + stickerName(id) + '!'); popSticker(id); }, ms); }
  function flushStickers() { pending.splice(0).forEach(function (id, i) { showSticker(id, 2600 + i * 1700); }); }
  function popSticker(id) { // the sticker flies in for a second on the watch screen
    var sc = $('screen'); if (!sc) return; var i = img('assets/stickers/' + id + '.png', 'stkpop', ''); sc.appendChild(i);
    if (i.animate && !reduced.matches) i.animate([{ transform: 'translate(-50%,-50%) scale(.2) rotate(-20deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.1) rotate(4deg)', opacity: 1, offset: .35 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1, offset: .8 }, { transform: 'translate(-50%,-50%) scale(.9)', opacity: 0 }], { duration: 1500, easing: 'ease-out', fill: 'both' }).onfinish = function () { i.remove(); };
    else setTimeout(function () { i.remove(); }, 1200);
  }
  function levelStickers() { var mx = 0; J.pets().forEach(function (p) { mx = Math.max(mx, p.level); }); if (mx >= 5) award('level_5'); if (mx >= 10) award('level_10'); if (mx >= J.instLevel('didg')) award('didg'); }

  // ---------- care streak: one banana a day keeps the chain. One free rest day each week (Mon to Sun). ----------
  function onFed() {
    var t = ymd(); award('first_feed');
    if (F.fed.indexOf(t) >= 0) return;
    var last = F.fed[F.fed.length - 1];
    if (!last) F.streak = 1;
    else {
      var gap = dayGap(last, t);
      if (gap === 1) F.streak++;
      else if (gap === 2) { var miss = addDays(last, 1), wk = weekKey(miss), used = F.rested.some(function (r) { return weekKey(r) === wk; });
        if (!used) { F.rested.push(miss); F.streak++; setTimeout(function () { A.jam.toast('💤 Rest day used. Your banana chain is safe!'); }, 1600); } else F.streak = 1; }
      else F.streak = 1;
    }
    F.fed.push(t); if (F.fed.length > 60) F.fed = F.fed.slice(-60); if (F.rested.length > 20) F.rested = F.rested.slice(-20);
    F.best = Math.max(F.best || 0, F.streak); save();
    if (F.streak >= 3) award('streak_3'); if (F.streak >= 7) award('streak_7'); if (F.streak >= 30) award('streak_30');
    if (F.streak > 1) setTimeout(function () { A.jam.toast('🍌 Care streak: ' + F.streak + ' days!'); }, 900);
  }
  function restLeft() { var wk = weekKey(ymd()); return !F.rested.some(function (r) { return weekKey(r) === wk; }); }
  function streakLive() { var last = F.fed[F.fed.length - 1]; if (!last) return 0; var g = dayGap(last, ymd()); return g <= 1 || (g === 2 && restLeft()) ? F.streak : 0; }

  // ---------- Songbook: a 4 bar song for each instrument on each beat. Tap the notes, rest on the gaps. ----------
  var FAMILY = { drumsticks: 'beat', shaker: 'beat', didg: 'drone', bass: 'groove', guitar: 'strum', keys: 'strum', pad: 'drone', mic: 'tune', keytar: 'tune', horn: 'tune' };
  var PATS = { // one character per beat over 4 bars: x = tap, . = rest. Easy first bar, a little twist after.
    beat: ['xxxxxxxxx.x.xxxx', 'x.xxx.xxx.xxxxxx', 'xx.xxx.xxx.xxxxx'], groove: ['x.x.x.x.x.xxx.x.', 'xx..xx..x.x.xxx.', 'x..xx..xx.x.x.xx'],
    strum: ['x...x...x.x.x...', 'x.x.x...x.x.xx..', 'x...x.x.x...xxx.'], tune: ['x.x.xx..x.x.xxx.', 'xx.x..x.xx.x..xx', 'x..x.xx.x..x.xxx'], drone: ['x...x...x...xxxx', 'x...x.x.x...x.x.', 'x.......x...xxx.']
  };
  var SONG_NAMES = { chip8: 'Arcade Banana', lofi: 'Sleepy Sunday', funk: 'Banana Bounce', island: 'Coconut Breeze', rock: 'Treehouse Rock', acoustic: 'Campfire Tune', community: 'All Together' };
  var LEAD = 4; // one bar to get ready
  function songKey(inst, beat) { return inst + '|' + beat; }
  function baseOf(beatId) { var b = J.beats()[beatId]; return b && b.month ? b.style : beatId; }
  function songFor(inst, beatId) {
    var fam = FAMILY[inst] || 'groove', base = baseOf(beatId), i = ['chip8', 'lofi', 'funk', 'island', 'rock', 'acoustic', 'community'].indexOf(base); if (i < 0) i = 0;
    var pat = PATS[fam][i % 3], b = J.beats()[beatId] || {};
    return { key: songKey(inst, beatId), inst: inst, beat: beatId, pat: pat, notes: pat.split('').filter(function (c) { return c === 'x'; }).length, name: (b.month ? b.name.split(' ')[0] + ' ' : '') + (SONG_NAMES[base] || 'Banana Song') };
  }
  var song = null; // the song being played now
  function startSong(s) {
    if (J.current().id !== s.beat) J.set(s.beat);
    var P = J.period(), secs = Math.ceil(((16 + LEAD + 1) * P) / 1000);
    song = { s: s, hits: {}, rest: 0 }; H.closeSheet(); J.start({ song: s.key, seconds: secs });
  }
  function songLane(on) {
    var ov = $('ov-jam'), ln = $('songLane'); if (!ov) return;
    ov.classList.toggle('songmode', !!on);
    if (!on) { if (ln) ln.hidden = true; return; }
    if (!ln) { ln = el('div', 'songlane'); ln.id = 'songLane'; ln.setAttribute('aria-hidden', 'true'); var mood = ov.querySelector('.jammood'); if (mood) ov.insertBefore(ln, mood); else ov.appendChild(ln); }
    ln.textContent = ''; ln.hidden = false; var t = el('div', 'sltitle', '📖 ' + song.s.name); ln.appendChild(t); var row = el('div', 'slrow'); ln.appendChild(row);
    song.s.pat.split('').forEach(function (c, i) { var b = el('b', c === 'x' ? 'n' : 'r'); if (i % 4 === 0) b.classList.add('bar'); row.appendChild(b); });
  }
  function songTick() {
    if (!song || !J.running()) return; var c = J.clock(); if (!c) return;
    var P = J.period(), cur = Math.floor((c.t - c.lat) / P + 0.5) - LEAD, cells = document.querySelectorAll('#songLane .slrow b'), t = document.querySelector('#songLane .sltitle');
    [].forEach.call(cells, function (b, i) { b.classList.toggle('now', i === cur); b.classList.toggle('hit', !!song.hits[i]); });
    if (t) t.textContent = cur < 0 ? '📖 ' + song.s.name + ' · get ready ' + (-cur) : '📖 ' + song.s.name;
  }
  function songTap(d) {
    if (!song || d.player !== 1 || d.grade === 'miss') return; var i = d.beat - LEAD; if (i < 0 || i > 15) return;
    if (song.s.pat[i] === 'x') song.hits[i] = 1; else song.rest++;
  }
  function songEnd() {
    if (!song) return; var s = song.s, hit = Object.keys(song.hits).length, ok = hit / s.notes >= 0.8 && song.rest <= 2, msg;
    if (ok) { var first = !F.stamps[s.key]; F.stamps[s.key] = ymd(); save(); award('first_stamp'); msg = (first ? '⭐ Songbook stamp: ' : '⭐ Played it again: ') + s.name + '! ' + hit + '/' + s.notes + ' notes'; }
    else msg = '📖 ' + hit + '/' + s.notes + ' notes' + (song.rest > 2 ? ', try resting on the gaps' : '') + '. Play again for the stamp!';
    song = null; songLane(false); setTimeout(function () { A.jam.toast(msg); }, 700);
  }

  // ---------- jam combo: chained Perfects. Every 8: a drum fill and confetti. Best combo saved per instrument. ----------
  var combo = 0, comboBest = 0;
  function comboEl() {
    var c = $('comboMeter'); if (c) return c; var ov = $('ov-jam'); if (!ov) return null;
    c = el('div', 'combometer'); c.id = 'comboMeter'; c.setAttribute('role', 'status'); c.setAttribute('aria-live', 'polite'); ov.appendChild(c); return c;
  }
  function paintCombo() { var c = comboEl(); if (!c) return; c.textContent = ''; c.appendChild(el('b', null, '🔥 ' + combo)); c.appendChild(el('span', null, 'Best ' + comboBest)); c.classList.toggle('hot', combo >= 8); }
  function confetti() {
    var ov = $('ov-jam'); if (!ov || reduced.matches || !ov.animate) return; var cols = ['#ffd84d', '#ff6fae', '#4de3ff', '#7dff8a', '#b38cff'];
    for (var i = 0; i < 26; i++) { var p = el('i', 'confetti'), x = 10 + Math.random() * 80; p.style.left = x + '%'; p.style.background = cols[i % cols.length]; ov.appendChild(p);
      (function (p) { var a = p.animate([{ transform: 'translateY(-20px) rotate(0)', opacity: 1 }, { transform: 'translate(' + ((Math.random() - .5) * 120) + 'px,' + (300 + Math.random() * 200) + 'px) rotate(' + (360 + Math.random() * 360) + 'deg)', opacity: 0 }], { duration: 1200 + Math.random() * 600, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' }); a.onfinish = function () { p.remove(); }; })(p); }
  }
  function comboTap(d) {
    if (d.player !== 1) return;
    if (d.grade === 'perfect') { combo++; award('first_perfect'); } else if (d.grade === 'miss') combo = 0; // Good keeps the chain going
    if (combo > comboBest) comboBest = combo;
    var k = d.inst || 'none'; if (combo > (F.combo[k] || 0)) { F.combo[k] = combo; save(); }
    if (combo && combo % 8 === 0 && d.grade === 'perfect') { J.fill(); confetti(); A.jam.burst('star', 6); }
    if (combo >= 8) award('combo_8'); if (combo >= 20) award('combo_20');
    paintCombo();
  }

  // ---------- band builder: four seats. Each of your pets can fill up to two. Full band = free jukebox. ----------
  var SEATS = [['rhythm', 'Rhythm', ['drumsticks', 'shaker', 'didg']], ['bass', 'Bass', ['bass']], ['harmony', 'Harmony', ['guitar', 'keys', 'pad']], ['lead', 'Lead', ['mic', 'keytar', 'horn']]];
  function band() { // best seating: try every way to seat the pets (4 seats, small search). Crown pets are preferred for Lead (Band Leader badge).
    var pets = J.pets(), best = null;
    (function go(i, used, pick) {
      if (i === SEATS.length) {
        var n = pick.filter(Boolean).length, lead = pick[3], crown = !!(lead && window.BLUP3TS_TRAITS && BLUP3TS_TRAITS.has(lead.pet, 'crown'));
        var score = n + (crown ? 0.5 : 0);
        if (!best || score > best.score) best = { n: n, score: score, seats: pick.slice() }; return;
      }
      var seat = SEATS[i], any = false;
      pets.forEach(function (p) { if ((used[p.id] || 0) >= 2) return; var k = seat[2].filter(function (x) { return p.insts.indexOf(x) >= 0; }).pop(); if (!k) return; any = true; used[p.id] = (used[p.id] || 0) + 1; pick[i] = { pet: p, inst: k }; go(i + 1, used, pick); used[p.id]--; pick[i] = null; });
      pick[i] = null; go(i + 1, used, pick);
    })(0, {}, []);
    best.full = best.n === SEATS.length; if (best.full) award('band'); return best;
  }

  // ---------- Community Jam: Saturdays (America/Halifax). Everyone's Perfect taps fill one goal. ----------
  var CJ = (function () { var c = CFG.COMMUNITY_JAM || {}; return { on: c.ENABLED === true && typeof c.API === 'string' && c.API.length > 0, api: c.API || '', tz: c.TIME_ZONE || 'America/Halifax', day: Number.isInteger(c.DAY) ? c.DAY : 6, goal: Number.isInteger(c.PREVIEW_GOAL) && c.PREVIEW_GOAL > 0 ? c.PREVIEW_GOAL : 300 }; })();
  var forceSat = null, cjStatus = null;
  function tzParts(d) { // weekday + date in the Community Jam time zone
    try { var f = new Intl.DateTimeFormat('en-CA', { timeZone: CJ.tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d || new Date()), o = {}; f.forEach(function (x) { o[x.type] = x.value; });
      return { wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), date: o.year + '-' + o.month + '-' + o.day };
    } catch (e) { var n = d || new Date(); return { wd: n.getDay(), date: ymd(n) }; }
  }
  function isJamDay() { return forceSat !== null ? forceSat : tzParts().wd === CJ.day; }
  function cjWeek() { return tzParts().date; }
  function daysToJam() { var wd = tzParts().wd; return (CJ.day - wd + 7) % 7; }
  function cjFetch(method, body) { // see docs/COMMUNITY_JAM_API.md. Same-site only (the page CSP allows connect-src 'self').
    if (!CJ.on || !window.fetch) return Promise.resolve(null);
    return fetch(CJ.api + (method === 'GET' ? '/status?week=' + encodeURIComponent(cjWeek()) : '/taps'), { method: method, headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {}, body: method === 'POST' ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && typeof j.total === 'number') { cjStatus = j; if (j.unlocked) unlockCommunity(); } return j; }).catch(function () { return null; });
  }
  function cjNow() { // { total, goal, unlocked, live }
    if (CJ.on && cjStatus && cjStatus.week === cjWeek()) return { total: cjStatus.total, goal: cjStatus.goal, unlocked: !!cjStatus.unlocked, live: true };
    var mine = F.comm.week === cjWeek() ? F.comm.mine : 0; return { total: mine, goal: CJ.goal, unlocked: mine >= CJ.goal || F.comm.beat, live: false };
  }
  function unlockCommunity() { if (F.comm.beat) return; F.comm.beat = true; save(); setTimeout(function () { A.jam.toast('🤝 Goal reached! Community Groove beat unlocked for everyone, free'); }, 1200); }
  function cjEnd(d) {
    if (!isJamDay() || d.silent) return; var n = (d.judged && d.judged.perfect) || 0; if (!n) return;
    var wk = cjWeek(); if (F.comm.week !== wk) { F.comm.week = wk; F.comm.mine = 0; }
    F.comm.mine += n; if (F.comm.joined.indexOf(wk) < 0) { F.comm.joined.push(wk); F.comm.joined = F.comm.joined.slice(-12); }
    save(); award('community');
    if (CJ.on) cjFetch('POST', { week: wk, count: n }); else if (F.comm.mine >= CJ.goal) unlockCommunity();
    setTimeout(function () { var s = cjNow(); A.jam.toast('🤝 +' + n + ' Perfects for the Community Jam (' + Math.min(s.total, s.goal) + '/' + s.goal + ')'); }, 1500);
  }
  function cjBanner(on) {
    var ov = $('ov-jam'), b = $('cjBanner'); if (!ov) return;
    if (!on) { if (b) b.hidden = true; return; }
    if (!b) { b = el('div', 'cjbanner'); b.id = 'cjBanner'; ov.appendChild(b); } b.hidden = false; b.textContent = '🤝 Saturday Jam: Perfects count!';
  }

  // ---------- Duo band jam: two players on one phone, one pad on each Duo screen ----------
  var duoOn = false, together = 0, lastHit = { 1: null, 2: null };
  function isDuo() { var g = $('gameView'); return !!(g && g.classList.contains('full') && (g.classList.contains('fold-v') || g.classList.contains('fold-h'))); }
  // Player 1 taps the big picture on the top (Portrait) or left (Horizontal) screen. Player 2 taps the Jam picture on the
  // other screen and can switch instrument. Both on the beat together = band mood bonus (mood only, capped).
  function duoPads(on) {
    var sc = $('screen'), ov = $('ov-jam'), p1 = $('duoP1'), bar = $('duoBar'); if (!sc || !ov) return;
    if (!on) { if (p1) p1.hidden = true; if (bar) bar.hidden = true; return; }
    if (!p1) {
      p1 = btn('duop1', '', null, 'Player 1: tap the big picture on the beat'); p1.id = 'duoP1'; sc.appendChild(p1);
      p1.appendChild(el('span', 'ring')); p1.appendChild(el('span', 'chip'));
      p1.addEventListener('pointerdown', function (e) { if (e.button > 0) return; e.preventDefault(); J.tapP1(); flash(p1); });
      p1.onclick = function (e) { if (e.detail === 0) { J.tapP1(); flash(p1); } }; // keyboard
      bar = el('div', 'duobar'); bar.id = 'duoBar'; ov.appendChild(bar);
    }
    p1.hidden = false; bar.hidden = false; paintPads();
  }
  function flash(n) { n.classList.remove('hitfx'); void n.offsetWidth; n.classList.add('hitfx'); }
  function paintPads() {
    var p1 = $('duoP1'), bar = $('duoBar'); if (!p1 || !bar) return; var k1 = J.equipped(), k2 = J.p2Inst();
    var chip = p1.querySelector('.chip'); chip.textContent = ''; if (k1) chip.appendChild(J.instIcon(k1)); chip.appendChild(el('span', null, 'Player 1 · ' + (k1 ? J.instName(k1) : 'Beat') + ' · tap here'));
    bar.textContent = ''; var who = el('span', 'p2'); if (k2) who.appendChild(J.instIcon(k2)); who.appendChild(el('span', null, 'Player 2 · ' + (k2 ? J.instName(k2) : 'Beat'))); bar.appendChild(who);
    var sw = btn('duoswap', '🔁', function (e) { e.stopPropagation(); var l = J.openInsts(), i = l.indexOf(J.p2Inst()); J.p2Inst(l[(i + 1) % l.length]); paintPads(); }, 'Player 2: change instrument'); bar.appendChild(sw);
    var t = el('span', 'duotogether', '🤝 ' + together + '/' + J.duoMax); t.id = 'duoTogether'; t.setAttribute('aria-label', 'Together on the beat ' + together + ' of ' + J.duoMax); bar.appendChild(t);
  }
  function duoTap(d) {
    if (!duoOn || d.grade === 'miss') return; lastHit[d.player] = d.beat;
    if (lastHit[1] === lastHit[2] && lastHit[1] !== null) { together = Math.min(J.duoMax, together + 1); lastHit[1] = lastHit[2] = null; paintPads(); var t = $('duoTogether'); if (t && t.animate && !reduced.matches) t.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300 }); }
  }

  // ---------- events from app.js ----------
  var tick = null;
  document.addEventListener('blup3ts:fed', onFed);
  document.addEventListener('blup3ts:levelup', function () { levelStickers(); });
  document.addEventListener('blup3ts:jamstart', function (e) {
    var d = e.detail || {}; inJam = true; combo = 0; comboBest = F.combo[d.inst || 'none'] || 0; paintCombo(); award('first_jam');
    if (d.seasonal) award('seasonal');
    duoOn = !!d.duo; together = 0; lastHit = { 1: null, 2: null }; duoPads(duoOn); if (duoOn) { award('duo_jam'); F.duoJams++; save(); }
    if (!d.song) song = null; songLane(!!song);
    cjBanner(isJamDay()); clearInterval(tick); tick = setInterval(songTick, 50);
  });
  document.addEventListener('blup3ts:jamtap', function (e) { var d = e.detail || {}; comboTap(d); songTap(d); duoTap(d); });
  document.addEventListener('blup3ts:jamend', function (e) {
    var d = e.detail || {}; clearInterval(tick); duoPads(false); cjBanner(false); songEnd(); inJam = false; cjEnd(d); flushStickers();
    if (d.duo && !d.silent && d.bandBonus) setTimeout(function () { A.jam.toast('👫 Band bonus: +' + d.bandBonus + ' mood'); }, 1100);
    duoOn = false;
  });

  // ---------- Jam chooser: beat button, Songbook, Duo band jam ----------
  var wantDuo = false, BEAT_TXT = { chip8: 'The original 8-bit groove', lofi: 'Slow and cosy, soft keys and record crackle', funk: 'Bouncy bass and choppy guitar', island: 'Sunny reggae one drop', rock: 'Big drums and power chords', acoustic: 'Gentle strums and brushes', community: 'Unlocked by everyone together on a Saturday' };
  function duoReady() { return (J.openInsts() || []).length >= 2; }
  function duoNeedLevel() { return J.instLevel('guitar') || 3; }
  function paintChooser() {
    var b = J.current(), bb = $('jamBeatBtn'); if (bb) bb.textContent = (b.emoji || '🎵') + ' Beat: ' + b.name + ' ▾';
    var db = $('jamDuoBtn'); if (db) {
      var ok = isDuo(); db.hidden = !ok; if (!ok) wantDuo = false;
      if (wantDuo && !duoReady()) wantDuo = false;
      var locked = ok && !duoReady();
      db.classList.toggle('locked', locked);
      db.classList.toggle('on', wantDuo);
      db.setAttribute('aria-pressed', wantDuo ? 'true' : 'false');
      db.setAttribute('aria-disabled', locked ? 'true' : 'false');
      db.textContent = locked ? ('👫 Duo band jam · Level ' + duoNeedLevel()) : (wantDuo ? '👫 Duo band jam: on' : '👫 Duo band jam');
    }
  }
  document.addEventListener('blup3ts:jamchooser', paintChooser);
  if ($('jamBeatBtn')) $('jamBeatBtn').onclick = function () { beatPicker(); };
  if ($('jamSongBtn')) $('jamSongBtn').onclick = function () { songbook(); };
  if ($('jamDuoBtn')) $('jamDuoBtn').onclick = function () {
    if (!isDuo()) return;
    if (!duoReady()) { A.jam.toast('Duo band jam unlocks at Level ' + duoNeedLevel() + ', when Bass and Guitar are open 🔒'); return; }
    wantDuo = !wantDuo; paintChooser();
  };
  // Quick or Long Jam with Duo band jam on: start with the duo option (wrap the app's buttons, keep their checks)
  (function () {
    function wrap(id, long) {
      var b = $(id); if (!b) return; var orig = b.onclick;
      b.onclick = function (e) {
        if (this.disabled) return;
        if (wantDuo && isDuo() && duoReady()) { J.start({ duo: true, long: !!long }); return; }
        if (orig) orig.call(b, e);
      };
    }
    wrap('jamQuick', false); wrap('jamLongBtn', true);
  })();

  function beatPicker() {
    var list = el('div', 'beatlist'), cur = J.current().id, month = (window.BLUP3TS_TRAITS && BLUP3TS_TRAITS.monthForTest && BLUP3TS_TRAITS.monthForTest()) || (new Date().getMonth() + 1);
    J.list().forEach(function (id) {
      var b = J.beats()[id], row = el('div', 'beatrow' + (id === cur ? ' sel' : '')), pick = btn('beatpickbtn', '', function () { J.set(id); paintChooser(); H.closeSheet(); }, 'Pick ' + b.name);
      pick.appendChild(el('span', 'be', b.emoji || '🎵'));
      var tx = el('span', 'bt'); tx.appendChild(el('b', null, b.name + (id === cur ? ' ✓' : ''))); tx.appendChild(el('small', null, (b.month ? 'Beat of the month · ' : '') + (BEAT_TXT[b.style === 'file' ? 'chip8' : id] || BEAT_TXT[b.style] || '') + ' · ' + b.bpm + ' BPM')); pick.appendChild(tx);
      if (b.month === month) pick.appendChild(el('span', 'tag', 'This month'));
      row.appendChild(pick);
      row.appendChild(btn('beatprev', '▶', function () { if (!J.soundOn()) return A.jam.toast('Turn the sound on to hear a preview 🔊'); J.preview(id); }, 'Hear 4 seconds of ' + b.name));
      list.appendChild(row);
    });
    H.openSheet('Pick a beat', [H.p('Every instrument plays in the key and tempo of the beat you pick. All beats are free.'), list]);
  }

  function songbook() {
    var k = J.equipped(), nodes = [], total = 0, got = 0;
    var beats = J.list(); var all = J.openInsts();
    all.forEach(function (i) { beats.forEach(function (b) { total++; if (F.stamps[songKey(i, b)]) got++; }); });
    nodes.push(H.p('Tap the notes, rest on the gaps. Hit at least 8 in every 10 notes to earn a stamp. Songs are free and only add mood, never levels.'));
    nodes.push(el('div', 'stampcount', '⭐ Stamps: ' + got + ' of ' + total));
    if (!k) { nodes.push(H.p('Pick an instrument in Looks first. The Bass unlocks at Level ' + J.instLevel('bass') + '.')); return H.openSheet('Songbook', nodes); }
    var head = el('div', 'sbhead'); head.appendChild(J.instIcon(k)); head.appendChild(el('b', null, J.instName(k) + ' songs')); nodes.push(head);
    var list = el('div', 'songlist');
    beats.forEach(function (b) {
      var s = songFor(k, b), bd = J.beats()[b], row = el('div', 'songrow');
      var info = el('div', 'si'); info.appendChild(el('b', null, (F.stamps[s.key] ? '⭐ ' : '') + s.name)); info.appendChild(el('small', null, (bd.emoji || '') + ' ' + bd.name));
      var dots = el('div', 'sdots'); s.pat.split('').forEach(function (c, i) { var d = el('i', c === 'x' ? 'n' : 'r'); if (i % 4 === 0) d.classList.add('bar'); dots.appendChild(d); }); info.appendChild(dots);
      row.appendChild(info); row.appendChild(btn('b-pink songplay', '▶ Play', function () { startSong(s); }, 'Play ' + s.name)); list.appendChild(row);
    });
    nodes.push(list); H.openSheet('Songbook', nodes);
  }

  // ---------- Fun hub (side button menu → Fun) ----------
  var TABS = [['streak', '🍌 Streak'], ['diary', '📔 Diary'], ['songs', '📖 Songs'], ['band', '🎸 Band'], ['saturday', '🤝 Saturday']];
  function hub(tab) {
    tab = tab || 'streak'; var nodes = [], bar = el('div', 'funtabs');
    TABS.forEach(function (t) { var b = btn('funtab' + (t[0] === tab ? ' on' : ''), t[1], function () { hub(t[0]); }); b.setAttribute('aria-pressed', t[0] === tab ? 'true' : 'false'); bar.appendChild(b); });
    nodes.push(bar);
    var m = J.beats() && window.BLUP3TS_JAM ? BLUP3TS_JAM.seasonalFor((window.BLUP3TS_TRAITS && BLUP3TS_TRAITS.monthForTest && BLUP3TS_TRAITS.monthForTest()) || (new Date().getMonth() + 1)) : null;
    if (tab === 'streak') {
      var n = streakLive(), card = el('div', 'funcard streakcard'); card.appendChild(el('div', 'big', '🍌 ' + n + (n === 1 ? ' day' : ' days')));
      card.appendChild(el('div', 'fine', 'Feed your pet once a day to grow the banana chain. One free rest day each week keeps it safe. Best: ' + (F.best || 0) + ' days.'));
      var chain = el('div', 'chain'), t = ymd();
      for (var i = 6; i >= 0; i--) { var d = addDays(t, -i), c = el('span', 'link'), wd = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][parse(d).getDay()]; c.appendChild(el('i', null, F.fed.indexOf(d) >= 0 ? '🍌' : F.rested.indexOf(d) >= 0 ? '💤' : d === t ? '❔' : '·')); c.appendChild(el('small', null, wd)); if (d === t) c.classList.add('today'); chain.appendChild(c); }
      card.appendChild(chain); card.appendChild(el('div', 'fine', restLeft() ? '💤 Rest day this week: ready' : '💤 Rest day this week: used'));
      card.appendChild(el('div', 'fine', 'Next stickers at 3, 7 and 30 days. The streak never changes levels.'));
      nodes.push(card);
      if (m) { var sc = el('div', 'funcard'); sc.appendChild(el('b', null, '🗓️ Beat of the month: ' + m.emoji + ' ' + m.name)); sc.appendChild(el('div', 'fine', 'A new free beat every month. Pick it in Jam, under Beat.')); nodes.push(sc); }
    } else if (tab === 'diary') {
      F.newStk = 0; save(); paintBadge();
      var grid = el('div', 'stkgrid'), have = 0;
      STK.forEach(function (s) { var on = !!F.stickers[s[0]]; if (on) have++; var c = el('div', 'stk' + (on ? ' on' : '')); c.appendChild(img('assets/stickers/' + s[0] + '.png', '', '')); c.appendChild(el('b', null, s[1])); c.appendChild(el('small', null, on ? niceDay(F.stickers[s[0]]) : s[2])); c.setAttribute('aria-label', s[1] + (on ? ', earned ' + F.stickers[s[0]] : ', not yet: ' + s[2])); grid.appendChild(c); });
      nodes.push(el('div', 'stampcount', '📔 ' + have + ' of ' + STK.length + ' stickers')); nodes.push(grid);
    } else if (tab === 'songs') {
      setTimeout(songbook, 0); return;
    } else if (tab === 'band') {
      var bd = band(), card2 = el('div', 'funcard bandcard' + (bd.full ? ' full' : ''));
      card2.appendChild(el('b', null, bd.full ? '🎉 Your band is complete!' : '🎸 Band card: ' + bd.n + ' of 4 seats'));
      card2.appendChild(el('div', 'fine', 'Seat your pets in the band. Each pet can play up to two seats, so you need at least two pets. Instruments unlock by feeding.'));
      var seats = el('div', 'seats');
      SEATS.forEach(function (s, i) { var c = el('div', 'seat' + (bd.seats[i] ? ' on' : '')), x = bd.seats[i]; c.appendChild(el('small', null, s[1]));
        if (x) { c.appendChild(J.instIcon(x.inst)); c.appendChild(el('b', null, J.instName(x.inst))); c.appendChild(el('span', 'who', x.pet.name));
          if (s[0] === 'lead' && window.BLUP3TS_TRAITS && BLUP3TS_TRAITS.has(x.pet, 'crown')) { c.classList.add('leader'); c.appendChild(el('span', 'bandleader', '👑 Band Leader')); }
        }
        else { var lv = Math.min.apply(null, s[2].map(J.instLevel)); c.appendChild(el('span', 'empty', '?')); c.appendChild(el('span', 'who', 'Needs a pet at Level ' + lv + '+')); }
        seats.appendChild(c); });
      card2.appendChild(seats);
      if (bd.full) { var jb = btn(J.jukeboxOn() ? 'b-tcyan' : 'b-pink', J.jukeboxOn() ? '⏹ Stop jukebox' : '🎶 Play jukebox · ' + J.current().name, function () { if (J.jukeboxOn()) J.stopJukebox(); else J.jukebox(bd.seats.map(function (x) { return x.inst; }), 32); hub('band'); }); card2.appendChild(jb); card2.appendChild(el('div', 'fine', 'The jukebox is free and just for listening. Change the beat in Jam.')); }
      else card2.appendChild(el('div', 'fine', '🔒 Jukebox: fill all four seats to unlock it, free.'));
      nodes.push(card2);
    } else if (tab === 'saturday') {
      var s2 = cjNow(), card3 = el('div', 'funcard cjcard'), day = isJamDay();
      card3.appendChild(el('b', null, day ? '🤝 Community Jam is on today!' : '🤝 Community Jam: Saturdays'));
      card3.appendChild(el('div', 'fine', day ? 'Every Perfect tap in Jam today adds to one big goal for everyone.' : 'Next one ' + (daysToJam() === 1 ? 'tomorrow' : 'in ' + daysToJam() + ' days') + ' (Saturday, Halifax time). Jam then and your Perfect taps fill the shared goal.'));
      var bar2 = el('div', 'bar big'), f = el('i', 'f-pink'); f.style.width = Math.min(100, Math.round(100 * s2.total / Math.max(1, s2.goal))) + '%'; bar2.appendChild(f); card3.appendChild(bar2);
      card3.appendChild(el('div', 'fine', (s2.live ? 'Everyone: ' : 'Preview, this phone only: ') + Math.min(s2.total, s2.goal) + ' / ' + s2.goal + ' Perfects'));
      card3.appendChild(el('div', 'fine', F.comm.beat ? '✅ Reward unlocked: 🤝 Community Groove beat (free)' : '🎁 Reward: the Community Groove beat, free for everyone'));
      if (!CJ.on) card3.appendChild(el('div', 'fine muted', 'Shared goal goes live when the Community Jam server is switched on. Until then this is a preview.'));
      card3.appendChild(el('div', 'fine', 'Jam days joined: ' + F.comm.joined.length));
      nodes.push(card3); if (CJ.on) cjFetch('GET');
    }
    H.openSheet('Fun', nodes);
  }
  // side button menu row (app.js builds the menu; this adds the badge for new stickers)
  function paintBadge() { var r = document.querySelector('#sideMenu .smrow[data-act="fun"]'); if (r) r.dataset.badge = F.newStk ? String(F.newStk) : ''; }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#sideBtn')) setTimeout(paintBadge, 0); }, true);

  window.BLUP3TS_FUN = {
    open: hub, beatPicker: beatPicker, songbook: songbook, communityBeat: function () { return !!F.comm.beat; }, state: function () { return JSON.parse(JSON.stringify(F)); },
    band: band, songFor: songFor, isJamDay: isJamDay, forceSaturday: function (on) { forceSat = on === null || on === undefined ? null : !!on; }, // preview / tests only
    communityStatus: cjNow, award: award, streakLive: streakLive, _set: function (o) { F = o; save(); } // tests only
  };
  levelStickers(); if (CJ.on && isJamDay()) cjFetch('GET');
})();
