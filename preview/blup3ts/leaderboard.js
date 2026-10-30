/* BLUP3TS Leaderboard. Vanilla JS, no libraries, CSP safe (no inline code or styles).
 * Reads window.BLUP3TS_CONFIG:
 *   LEADERBOARD_ENABLED            false = hidden. true = the screen can open.
 *   LEADERBOARD_ENDPOINT           default '/api/blup3ts-leaderboard'  (GET ?board=str|jam|level&period=week|all)
 *   LEADERBOARD_DISCORD_LOGIN_URL  link for the 'Sign in with Discord to join' button (hidden if empty)
 * Open it with: any element that has data-open-leaderboard, or window.BLUP3TS_LEADERBOARD.open('str').
 * Names and scores come from the server. Text is set with textContent, never innerHTML.
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
  var CACHE_MS = 60000, TIMEOUT_MS = 8000;
  var cache = {}, root = null, board = 'str', period = 'week', reqId = 0, lastFocus = null;

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
  function weekText(w) {
    if (period === 'all') return 'Overall · every player who has played';
    if (!w || !w.start) return 'This week · resets Sunday';
    var s = String(w.start), d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00Z' : s);
    if (isNaN(d)) return 'This week · resets Sunday';
    return 'Week of ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' · resets Sunday';
  }

  function build() {
    root = el('section', 'lb-view'); root.id = 'lbView'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'lbTitle');
    var inner = el('div', 'lb-inner');
    var top = el('div', 'lb-top');
    var back = el('button', 'lb-back', '‹ Back'); back.type = 'button'; back.setAttribute('aria-label', 'Close leaderboard');
    back.addEventListener('click', close);
    var head = el('div', 'lb-head');
    var h = el('h2', 'lb-title'); h.id = 'lbTitle';
    h.appendChild(el('span', 'lb-trophy', '🏆')).setAttribute('aria-hidden', 'true'); h.appendChild(document.createTextNode(' LEADERBOARD'));
    head.appendChild(h); head.appendChild(el('p', 'lb-week', 'This week · resets Sunday'));
    top.appendChild(back); top.appendChild(head); inner.appendChild(top);

    var per = el('div', 'lb-period'); per.setAttribute('role', 'group'); per.setAttribute('aria-label', 'Time range');
    PERIODS.forEach(function (p) {
      var b = el('button', 'lb-period-btn', p.label); b.type = 'button'; b.dataset.period = p.id;
      b.addEventListener('click', function () { period = p.id; show(board); });
      per.appendChild(b);
    });
    inner.appendChild(per);

    var tabs = el('div', 'lb-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Leaderboard type');
    BOARDS.forEach(function (b) {
      var t = el('button', 'lb-tab', b.label); t.type = 'button'; t.setAttribute('role', 'tab'); t.dataset.board = b.id;
      t.addEventListener('click', function () { show(b.id); });
      tabs.appendChild(t);
    });
    tabs.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = BOARDS.map(function (b) { return b.id; }).indexOf(board);
      i = (i + (e.key === 'ArrowRight' ? 1 : BOARDS.length - 1)) % BOARDS.length;
      show(BOARDS[i].id); var nb = tabs.querySelector('[data-board="' + BOARDS[i].id + '"]'); if (nb) nb.focus();
    });
    inner.appendChild(tabs);

    var body = el('div', 'lb-body'); body.setAttribute('role', 'tabpanel'); body.setAttribute('aria-live', 'polite');
    inner.appendChild(body);
    inner.appendChild(el('div', 'lb-me'));
    inner.appendChild(el('p', 'lb-foot', 'Top 3 get a gold badge'));
    root.appendChild(inner);
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(root);
  }

  function row(e, unit, isMe) {
    var r = Number(e.rank);
    var li = el(isMe ? 'div' : 'li', 'lb-row' + (r >= 1 && r <= 3 ? ' lb-r' + r : '') + (isMe ? ' lb-mine' : ''));
    var medal = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '';
    var rk = el('span', 'lb-rank', medal || (r > 0 ? num(r) : '–')); if (medal) rk.setAttribute('aria-label', 'Rank ' + r);
    li.appendChild(rk);
    var pic = el('span', 'lb-pic'), src = safeImg(e.petImage);
    if (src) {
      var img = el('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false; img.src = src;
      img.addEventListener('error', function () { img.remove(); pic.textContent = '🐵'; });
      pic.appendChild(img);
    } else pic.textContent = '🐵';
    li.appendChild(pic);
    var who = el('span', 'lb-who');
    var nm = el('span', 'lb-name', isMe ? 'You' : (e.name || 'Player')); if (e.name) nm.title = String(e.name); who.appendChild(nm);
    var bits = [];
    if (e.petName) bits.push(String(e.petName));
    var tag = e.collection ? String(e.collection) + (e.petNumber != null && e.petNumber !== '' ? ' #' + e.petNumber : '') : '';
    if (tag && String(e.petName || '').indexOf(tag) < 0) bits.push(tag);
    if (e.level != null && unit !== 'Level') bits.push('Lv ' + num(e.level));
    if (e.walletCount > 1) bits.push(num(e.walletCount) + ' wallets');
    who.appendChild(el('span', 'lb-sub', bits.join(' · ')));
    li.appendChild(who);
    var sc = el('span', 'lb-score');
    sc.appendChild(el('b', null, num(e.score))); sc.appendChild(el('small', null, unit));
    li.appendChild(sc);
    return li;
  }

  function stateMsg(cls, emoji, text, retry) {
    var d = el('div', 'lb-state ' + cls); d.appendChild(el('div', 'lb-state-emo', emoji)).setAttribute('aria-hidden', 'true');
    d.appendChild(el('p', null, text));
    if (retry) { var b = el('button', 'lb-retry', 'Try again'); b.type = 'button'; b.addEventListener('click', function () { delete cache[key()]; show(board); }); d.appendChild(b); }
    return d;
  }

  function render(data) {
    var body = root.querySelector('.lb-body'), me = root.querySelector('.lb-me'), info = boardInfo(board);
    body.textContent = ''; me.textContent = '';
    [].forEach.call(root.querySelectorAll('.lb-period-btn'), function (b) {
      var on = b.dataset.period === period; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    root.querySelector('.lb-week').textContent = weekText(data && data.week);
    if (data === 'loading') { body.appendChild(stateMsg('lb-loading', '⏳', 'Loading the leaderboard…')); body.setAttribute('aria-busy', 'true'); return; }
    body.removeAttribute('aria-busy');
    if (data === 'error') { body.appendChild(stateMsg('lb-error', '😴', 'Leaderboard is taking a nap, try again soon', true)); return; }
    var list = Array.isArray(data.entries) ? data.entries : [];
    if (!list.length) body.appendChild(stateMsg('lb-empty', '🌱', period === 'week' ? 'No scores yet this week. Play to be the first!' : 'No scores yet. Play to be the first!'));
    else { var ol = el('ol', 'lb-list'); list.forEach(function (e) { ol.appendChild(row(e, info.unit, false)); }); body.appendChild(ol); }
    if (data.me && typeof data.me === 'object') me.appendChild(row(data.me, info.unit, true));
    else if (data.signedIn) me.appendChild(el('p', 'lb-join', 'Play a pet to join the board'));
    else if (LOGIN_URL) {
      var a = el('a', 'lb-discord', 'Sign in with Discord to join'); a.href = LOGIN_URL; a.rel = 'noopener';
      me.appendChild(a);
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
      .then(function (d) { clearTimeout(timer); if (!d || typeof d !== 'object') throw new Error('bad data'); cache[k] = { t: Date.now(), d: d }; return d; },
            function (err) { clearTimeout(timer); throw err; });
  }

  function show(id) {
    board = boardInfo(id).id;
    [].forEach.call(root.querySelectorAll('.lb-tab'), function (t) {
      var on = t.dataset.board === board; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
    });
    var my = ++reqId; render('loading');
    load().then(function (d) { if (my === reqId) render(d); }, function () { if (my === reqId) render('error'); });
  }

  function open(id) {
    if (!ENABLED) return false;
    if (!root) build();
    lastFocus = document.activeElement;
    root.hidden = false; document.documentElement.classList.add('lb-open');
    show(id || board);
    var b = root.querySelector('.lb-back'); if (b) b.focus();
    return true;
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true; document.documentElement.classList.remove('lb-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function wire() {
    [].forEach.call(document.querySelectorAll('[data-open-leaderboard]'), function (b) {
      if (!ENABLED) { b.hidden = true; return; }
      b.hidden = false;
      b.addEventListener('click', function (e) { e.preventDefault(); open(b.getAttribute('data-open-leaderboard') || 'str'); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

  window.BLUP3TS_LEADERBOARD = { open: open, close: close, enabled: ENABLED, refresh: function () { cache = {}; if (root && !root.hidden) show(board); } };
})();
