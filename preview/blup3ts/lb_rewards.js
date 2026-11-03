/* BLUP3TS Monthly #1 rewards + wallet proof (PREVIEW ONLY, Nov 2 2026). Switch: config.js LB_REWARDS_ENABLED (default false).
 * - Reward card on the Ranks sheet: current month (America/Halifax), countdown to month end, reward preview
 *   (winner-only face 'Monthly Champion' f_champion + item 'Golden Crown', both PLACEHOLDER ART). First winner: November 2026,
 *   picked at 2026-12-01T04:00:00Z, then every month. The real snapshot and the winner record live on the server (API_LEADERBOARD.md).
 * - Winner face: never sold. Unlocked only for the connected wallet the server lists as a monthly #1 (LB_REWARDS_ENDPOINT, empty = off).
 * - Wallet proof: shared with the Ranks sheet, see lb_auth.js (nonce from the server, signMessage, server checks the signature).
 *   Off until the dev sets LB_AUTH_ENDPOINT. Only the public address and the signature are sent. Never a seed phrase or private key.
 * All text is set with textContent. */
(function () {
  'use strict';
  var C = window.BLUP3TS_CONFIG || {}, F = window.BLUP3TS_FACES || {};
  var ON = C.LB_REWARDS_ENABLED === true;
  var TZ = 'America/Halifax';
  // TOP 3 every month (Azgog via COS, Nov 2 2026 1:55 AM AT): one winner-only face + one item per place. Item art is a PLACEHOLDER (emoji).
  var PLACES = [
    { rank: 1, face: 'f_champion', label: '#1', item: { id: 'gold_crown', name: 'Gold Crown', icon: '👑' } },
    { rank: 2, face: 'f_second', label: '#2', item: { id: 'silver_medal', name: 'Silver Medal', icon: '🥈' } },
    { rank: 3, face: 'f_third', label: '#3', item: { id: 'bronze_medal', name: 'Bronze Medal', icon: '🥉' } }];
  function place(id) { for (var i = 0; i < PLACES.length; i++) if (PLACES[i].face === id) return PLACES[i]; return null; }
  var EP_RX = /^\/api\/[\w\/-]+$/;
  var nowOverride = null, rewards = { wallet: null, list: [] }, tick = null;
  function now() { return typeof nowOverride === 'number' ? nowOverride : Date.now(); }
  function el(t, cl, tx) { var e = document.createElement(t); if (cl) e.className = cl; if (tx != null) e.textContent = String(tx); return e; }
  function A() { return window.BLUP3TS_APP; } function H() { return window.BLUP3TS_HOME; } function WL() { return window.BLUP3TS_WALLET || null; }
  function ep(k) { var v = C[k]; return typeof v === 'string' && EP_RX.test(v) ? v.replace(/\/+$/, '') : ''; }
  // ---- month maths in Atlantic time ----
  function parts(t) {
    var o = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = Number(p.value); });
    return o;
  }
  function offset(t) { var p = parts(t); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000; }
  function midnight(y, m0) { var g = Date.UTC(y, m0, 1), t = g - offset(g); return g - offset(t); } // local 00:00 on the 1st, as UTC ms
  function month(t) { var p = parts(t); return { y: p.year, m: p.month, key: p.year + '-' + ('0' + p.month).slice(-2), start: midnight(p.year, p.month - 1), end: midnight(p.year, p.month) }; }
  function monthName(key) { var a = key.split('-'); return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(+a[0], +a[1] - 1, 15))); }
  function first() { var s = String(C.LB_REWARDS_FIRST_MONTH || '2026-11'); return /^\d{4}-\d{2}$/.test(s) ? s : '2026-11'; }
  function current() { var m = month(now()), f = first(); if (m.key < f) { var a = f.split('-'); m = { y: +a[0], m: +a[1], key: f, start: midnight(+a[0], +a[1] - 1), end: midnight(+a[0], +a[1]), early: true }; } return m; }
  function countdown(ms) {
    if (ms <= 0) return 'Picking the winner now…';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, mi = Math.floor(s / 60) % 60, se = s % 60;
    return 'Ends in ' + d + 'd ' + h + 'h ' + ('0' + mi).slice(-2) + 'm ' + ('0' + se).slice(-2) + 's';
  }
  function endLabel(t) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: TZ }).format(new Date(t)); }
  // ---- who is connected ----
  function owner() { var a = A(), w = WL(); if (!a || a.state().mode !== 'wallet' || !w) return null; return (w.state() || {}).pubkey || null; }
  function realToken() { var w = WL(); return !!(w && w.playToken && w.playToken() === 'blunana'); }
  function good(r, pl) { return r && pl && r.faceId === pl.face && Number(r.rank) === pl.rank && r.token === 'blunana'; } // BLUTEST never wins
  function isWinner(id) {
    var o = owner(), pl = place(id); if (!ON || !o || !pl || rewards.wallet !== o) return false;
    return rewards.list.some(function (r) { return good(r, pl); });
  }
  function wins() { var o = owner(); if (!o || rewards.wallet !== o) return []; return rewards.list.filter(function (r) { return good(r, place(r && r.faceId)); }); }
  function loadRewards() { // server list of rewards for this wallet. Off until the dev sets LB_REWARDS_ENDPOINT.
    var e = ep('LB_REWARDS_ENDPOINT'), o = owner(); if (!ON || !e || !o) return Promise.resolve(false);
    return fetch(e + '?wallet=' + encodeURIComponent(o), { credentials: 'same-origin', headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (owner() !== o) return false; rewards = { wallet: o, list: Array.isArray(j && j.rewards) ? j.rewards.filter(function (x) { return x && /^\d{4}-\d{2}$/.test(x.month); }) : [] }; refresh(); return true; })
      .catch(function () { return false; });
  }
  // ---- wallet proof (signMessage): one shared flow in lb_auth.js (BLUP3TS_LBAUTH), also used by the Ranks sheet ----
  function LA() { return window.BLUP3TS_LBAUTH || null; }
  function proved() { var l = LA(); return !!(l && l.proved()); }
  function canSign() { var l = LA(); return !!(l && l.canSign()); }
  function prove() { var l = LA(); return l ? l.prove() : Promise.resolve(false); }
  function askProve() { var l = LA(); if (l) l.askProve('To count on the ranks and win a monthly top 3 reward, your wallet signs a short message. It is free, it is not a transaction, and it cannot move anything.'); }
  if (LA()) LA().onChange(function () { refresh(); if (proved()) loadRewards(); });
  // ---- UI ----
  var cards = [];
  function refresh() { cards = cards.filter(function (c) { return c.isConnected; }); cards.forEach(function (c) { fill(c); }); var a = A(); if (a && a.render) a.render(); }
  function fill(box) {
    var a = A(), h = H(), m = current(), o = owner(), f = first().split('-');
    box.textContent = '';
    box.appendChild(el('p', 'lbrh', '🏆 Monthly top 3 rewards'));
    box.appendChild(el('p', 'lbrm', monthName(m.key)));
    var cd = el('p', 'lbrc', m.early ? 'Starts ' + endLabel(m.start) : countdown(m.end - now())); cd.dataset.end = String(m.end); box.appendChild(cd);
    var row = el('div', 'lbrrow');
    PLACES.forEach(function (pl) {
      var won = isWinner(pl.face), col = el('div', 'lbrprev'); col.dataset.face = pl.face; col.dataset.rank = String(pl.rank);
      col.appendChild(el('b', 'lbrplace', pl.label));
      var pv = a && a.casePreviews ? (a.casePreviews(a.petDef()) || []).filter(function (x) { return x.id === pl.face; })[0] : null;
      if (pv && h && h.miniWatch) col.appendChild(h.miniWatch(Object.assign({}, pv, { locked: !won })));
      col.appendChild(el('span', null, (won ? '✅ ' : '🔒 ') + (F[pl.face] ? F[pl.face].name : pl.label) + ' face'));
      col.appendChild(el('span', 'lbritem', pl.item.icon)); col.appendChild(el('span', null, pl.item.name));
      row.appendChild(col);
    });
    box.appendChild(row);
    box.appendChild(el('span', 'lbrtag', 'ITEM ART IS A PLACEHOLDER'));
    var w = wins();
    box.appendChild(el('p', 'lbrstate ' + (w.length ? 'won' : 'lock'), w.length ? '🎉 ' + w.map(function (r) { return 'You were ' + place(r.faceId).label + ' in ' + monthName(r.month); }).join('. ') + '! Your winner face and item are unlocked.' : 'Only the top 3 players of the month get these. They can\'t be bought.'));
    box.appendChild(el('p', 'lbrfine', 'At the end of each month (Atlantic time) the board is saved, the top 3 players get their rewards, and a fresh month starts. The first winners are picked on ' + endLabel(midnight(+f[0], +f[1])) + '.'));
    box.appendChild(el('p', 'lbrfine', 'Only real $BLUNANA feeds from a proved wallet count. Pretend play and BLUTEST test feeds are not counted.'));
    if (ep('LB_AUTH_ENDPOINT')) {
      if (!o) { var c = el('button', 'sbtn', 'Connect a wallet to join'); c.dataset.lbr = 'connect'; c.onclick = function () { A().play('tap'); var w = WL(); if (w && w.onConnectClick) w.onConnectClick(); }; box.appendChild(c); }
      else if (proved()) box.appendChild(el('p', 'lbrstate won', '✔ Wallet proved'));
      else { var b = el('button', 'sbtn primary', '✍️ Prove my wallet'); b.dataset.lbr = 'prove'; b.disabled = (LA() && LA().busy()) || !canSign(); b.onclick = function () { A().play('tap'); askProve(); }; box.appendChild(b); }
      if (o && !realToken()) box.appendChild(el('p', 'lbrfine', 'You are on BLUTEST right now. Switch to $BLUNANA for your feeds to count.'));
    }
  }
  function card() {
    var box = el('div', 'lbr'); box.id = 'lbRewardCard'; fill(box); cards.push(box);
    if (!tick) tick = setInterval(function () {
      cards = cards.filter(function (c) { return c.isConnected; });
      if (!cards.length) { clearInterval(tick); tick = null; return; }
      cards.forEach(function (c) { var p = c.querySelector('.lbrc'); if (!p || !p.dataset.end) return; var cur = current(); if (String(cur.end) !== p.dataset.end) fill(c); else if (!cur.early) p.textContent = countdown(Number(p.dataset.end) - now()); });
    }, 1000);
    return box;
  }
  function lockedSheet(id) { // tapping a winner face when it is locked
    var h = H(), a = A(), pl = place(id) || PLACES[0]; if (!h) return;
    var nodes = [], nm = F[pl.face] ? F[pl.face].name : pl.label, pv = (a.casePreviews(a.petDef()) || []).filter(function (x) { return x.id === pl.face; })[0];
    if (pv && h.miniWatch) { var bx = el('div', 'fuprev'); bx.appendChild(h.miniWatch(Object.assign({}, pv, { locked: false }))); nodes.push(bx); }
    nodes.push(el('p', 'funame', nm + ' watch face'));
    nodes.push(el('p', 'fuconnect', '🏆 Monthly ' + pl.label + ' only'));
    nodes.push(h.p('This face goes to the ' + pl.label + ' player of the month, together with the ' + pl.item.name + '. It is never sold, so it can\'t be bought or unlocked any other way.'));
    nodes.push(h.p('Feed your pets with real $BLUNANA from a proved wallet to climb the ranks.'));
    var r = el('button', 'sbtn primary', '🏆 See the ranks'); r.onclick = function () { a.play('tap'); h.closeSheet(); if (window.BLUP3TS_LEADERBOARD) BLUP3TS_LEADERBOARD.open('str'); };
    var no = el('button', 'sbtn', 'OK'); no.onclick = function () { a.play('tap'); h.closeSheet(); };
    nodes.push(r, no); h.openSheet(nm, nodes);
  }
  // reload the reward list when the wallet changes (cheap check of the public address; no network unless the endpoint is set)
  var lastOwner = null;
  if (ON) setInterval(function () { var o = owner(); if (o !== lastOwner) { lastOwner = o; if (rewards.wallet !== o) rewards = { wallet: null, list: [] }; loadRewards(); } }, 1500);
  window.BLUP3TS_LBREWARDS = Object.freeze({
    enabled: ON, places: PLACES, place: place, isWinner: isWinner, card: ON ? card : function () { return null; }, lockedSheet: lockedSheet,
    prove: prove, askProve: askProve, proved: proved, proofMessage: function (a, n, i) { var l = LA(); return l ? l.proofMessage(a, n, i) : ''; }, current: function () { return current(); }, monthName: monthName,
    _test: { b58: function (x) { var l = LA(); return l ? l._b58(x) : ''; }, setNow: function (ms) { nowOverride = typeof ms === 'number' ? ms : null; refresh(); }, loadRewards: loadRewards } // tests only; remove before shipping
  });
})();
