/* BLUP3TS ranks. Opens in the same sheet as FAQ and Settings.
 * Scores come from the server. Text is set with textContent, never innerHTML.
 */
(function () {
  'use strict';
  var CFG = window.BLUP3TS_CONFIG || {};
  var ENABLED = CFG.LEADERBOARD_ENABLED === true;
  var ENDPOINT = CFG.LEADERBOARD_ENDPOINT || '/api/blup3ts-leaderboard';
  var LOGIN_URL = CFG.LEADERBOARD_DISCORD_LOGIN_URL || '';
  var BOARDS = [
    { id: 'str', label: 'STR', unit: 'STR' },
    { id: 'jam', label: 'Jams', unit: 'jams' },
    { id: 'level', label: 'Level', unit: 'Level' }
  ];
  var PERIODS = [{ id: 'week', label: 'Weekly' }, { id: 'all', label: 'Overall' }];
  var CACHE_MS = 60000, TIMEOUT_MS = 25000;
  var cache = {}, box = null, board = 'str', period = 'all', reqId = 0;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function num(n) { n = Number(n); return isFinite(n) ? Math.round(n).toLocaleString('en-US') : '–'; }
  function boardInfo(id) { for (var i = 0; i < BOARDS.length; i++) if (BOARDS[i].id === id) return BOARDS[i]; return BOARDS[0]; }
  function key() { return board + '|' + period; }
  function safeImg(src) {
    if (typeof src !== 'string' || !src) return '';
    if (/^https:\/\//i.test(src)) return src;
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.indexOf('//') === 0) return '';
    return src;
  }
  function label(name) {
    var s = String(name || 'Player');
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) ? s.slice(0, 4) + '…' + s.slice(-4) : s;
  }
  function weekText(w) {
    if (period === 'all') return 'Overall · saved progress for everyone who has played';
    if (!w || !w.start) return 'This week · resets Sunday. Overall keeps your full total.';
    var s = String(w.start), d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00Z' : s);
    if (isNaN(d)) return 'This week · resets Sunday. Overall keeps your full total.';
    return 'Week of ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' · resets Sunday';
  }
  function seg(items, current, attr, pick) {
    var g = el('div', 'modeseg'); g.setAttribute('role', 'group');
    items.forEach(function (item) {
      var b = el('button', current === item.id ? 'a' : '', item.label); b.type = 'button';
      b.setAttribute('aria-pressed', current === item.id ? 'true' : 'false');
      b.addEventListener('click', function () { pick(item.id); });
      g.appendChild(b);
    });
    return g;
  }
  function row(e, unit, isMe) {
    var r = Number(e.rank);
    var li = el(isMe ? 'div' : 'li', 'rankrow' + (isMe ? ' me' : ''));
    li.appendChild(el('span', 'rankn', r > 0 ? num(r) : '–'));
    var pic = el('span', 'rankpic'), src = safeImg(e.petImage);
    if (src) {
      var img = el('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false; img.src = src;
      img.addEventListener('error', function () { img.remove(); pic.textContent = '🐵'; });
      pic.appendChild(img);
    } else pic.textContent = '🐵';
    li.appendChild(pic);
    var who = el('span', 'rankwho');
    var nm = el('b', null, isMe ? 'You' : label(e.name)); if (e.name) nm.title = String(e.name); who.appendChild(nm);
    var bits = [];
    if (e.petName) bits.push(String(e.petName));
    if (e.level != null && unit !== 'Level') bits.push('Lv ' + num(e.level));
    if (e.walletCount > 1) bits.push(num(e.walletCount) + ' wallets');
    who.appendChild(el('span', 'ranksub', bits.join(' · ')));
    li.appendChild(who);
    var sc = el('span', 'rankscore');
    sc.appendChild(el('b', null, num(e.score))); sc.appendChild(el('small', null, unit));
    li.appendChild(sc);
    return li;
  }
  function note(text, retry) {
    var d = el('div', 'ranknote');
    d.appendChild(el('p', null, text));
    if (retry) {
      var b = el('button', 'sbtn', 'Try again'); b.type = 'button';
      b.addEventListener('click', function () { delete cache[key()]; show(board); });
      d.appendChild(b);
    }
    return d;
  }
  function render(data) {
    if (!box) return;
    var info = boardInfo(board);
    box.textContent = '';
    box.appendChild(seg(PERIODS, period, 'period', function (id) { period = id; show(board); }));
    box.appendChild(seg(BOARDS, board, 'board', function (id) { show(id); }));
    box.appendChild(el('p', 'ranknote', weekText(data && data.week)));
    if (data === 'loading') { box.appendChild(note('Loading ranks…')); return; }
    if (data === 'error') { box.appendChild(note('Could not load ranks. Try again.', true)); return; }
    var list = Array.isArray(data.entries) ? data.entries : [];
    if (!list.length) box.appendChild(note(period === 'week' ? 'No scores this week yet. Overall still has saved progress.' : 'No scores yet.'));
    else {
      var ol = el('div', 'ranklist');
      list.forEach(function (e) { ol.appendChild(row(e, info.unit, false)); });
      box.appendChild(ol);
    }
    if (data && data.me && typeof data.me === 'object') box.appendChild(row(data.me, info.unit, true));
    else if (data && data.signedIn) box.appendChild(el('p', 'ranknote', 'Play a pet to join the board'));
    else if (data && LOGIN_URL) {
      var a = el('a', 'sbtn', 'Sign in with Discord'); a.href = LOGIN_URL; a.rel = 'noopener';
      box.appendChild(a);
    }
  }
  function load() {
    var k = key(), c = cache[k];
    if (c && Date.now() - c.t < CACHE_MS) return Promise.resolve(c.d);
    var url = ENDPOINT + (ENDPOINT.indexOf('?') < 0 ? '?' : '&') + 'board=' + encodeURIComponent(board) + '&period=' + encodeURIComponent(period);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { clearTimeout(timer); if (!d || d.ok === false) throw new Error('bad data'); cache[k] = { t: Date.now(), d: d }; return d; },
            function (err) { clearTimeout(timer); throw err; });
  }
  function show(id) {
    board = boardInfo(id).id;
    var home = window.BLUP3TS_HOME;
    if (!home || !home.openSheet) return;
    if (!box || !box.isConnected) { box = el('div', 'ranks'); home.openSheet('Ranks', [box]); }
    var my = ++reqId; render('loading');
    load().then(function (d) { if (my === reqId) render(d); }, function () { if (my === reqId) render('error'); });
  }
  function open(id) {
    if (!ENABLED) return false;
    show(id || board);
    return true;
  }
  function close() { if (window.BLUP3TS_HOME && window.BLUP3TS_HOME.closeSheet) window.BLUP3TS_HOME.closeSheet(); }
  function wire() {
    [].forEach.call(document.querySelectorAll('[data-open-leaderboard]'), function (b) {
      if (!ENABLED) { b.hidden = true; return; }
      b.hidden = false;
      b.addEventListener('click', function (e) { e.preventDefault(); if (window.BLUP3TS_APP && BLUP3TS_APP.play) BLUP3TS_APP.play('tap'); open(b.getAttribute('data-open-leaderboard') || 'str'); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.BLUP3TS_LEADERBOARD = { open: open, close: close, enabled: ENABLED, refresh: function () { cache = {}; if (box && box.isConnected) show(board); } };
})();
