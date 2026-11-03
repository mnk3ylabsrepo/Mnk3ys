// BLUP3TS face unlocks (PREVIEW). Extra watch faces (faces_mock.js, ids f_*) unlock once per owner and work on all of that owner's pets.
// CONNECTED WALLETS ONLY (Azgog, Nov 2 2026): owner = the connected wallet (payment: BLUP3TS_WALLET.payFace, the feed payment
// path with memo 'blup3ts:face:<id>'). Pretend mode can't buy paid faces: it shows the price plus 'Connect a wallet to unlock'.
// Faces free by date (Christmas) stay free for everyone, wallet or not. Free by date: config.js FACE_FREE_FROM. Switch: FACE_UNLOCKS_ENABLED.
// Ownership is kept in localStorage 'blup3ts.web.faces.<owner>' for now. That is per device and can be edited by hand:
// real ownership needs the server record described in API_FACES.md (wallet + verified tx signature, signature UNIQUE).
(function () {
  var C = window.BLUP3TS_CONFIG || {}, A = window.BLUP3TS_APP, H = window.BLUP3TS_HOME, F = window.BLUP3TS_FACES || {};
  if (!A || !H) return;
  var KEY = 'blup3ts.web.faces.', nowOverride = null;
  try { localStorage.removeItem(KEY + 'pretend'); } catch (e) {} // old preview: pretend unlocks are gone, clear the leftover key
  function WL() { return window.BLUP3TS_WALLET || null; }
  function now() { return typeof nowOverride === 'number' ? nowOverride : Date.now(); } // tests can set the clock with setNowForTest
  function isFace(id) { return !!(F[id] && F[id].face === true); }
  function on() { return C.FACE_UNLOCKS_ENABLED === true; }
  function freeFrom(id) { var s = (C.FACE_FREE_FROM || {})[id], t = typeof s === 'string' ? Date.parse(s) : NaN; return isFinite(t) ? t : null; }
  function basePrice(id) { var p = (C.FACE_PRICES || {})[id]; return Number.isInteger(p) && p > 0 ? p : null; }
  function wallet() { return A.state().mode === 'wallet'; }
  function owner() { if (!wallet()) return null; var w = WL(), pk = w && w.state && w.state().pubkey; return pk || null; }
  function tokenKind() { if (!wallet()) return null; var w = WL(); return w && w.playToken ? w.playToken() : 'test'; }
  function word() { if (!wallet()) return '$BLUNANA'; var w = WL(); return w && w.payWord ? w.payWord() : '$BLUNANA'; }
  function price(id) { // shown price: Pretend shows the config price (COST_SCALE, like the old label), Wallet uses the real amount (COST_SCALE x LIVE_COST_SCALE)
    var p = basePrice(id), S = window.BLUP3TS_SOL; if (p == null) return null;
    if (!wallet()) return S && S.scaleCost ? S.scaleCost(p, C) : p;
    var w = WL(), a = w && w.faceAmount ? w.faceAmount(id) : null; return a || (S && S.realCost ? S.realCost(p, C) : p);
  }
  function load(o) { try { var v = JSON.parse(localStorage.getItem(KEY + o) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } }
  function store(o, m) { try { localStorage.setItem(KEY + o, JSON.stringify(m)); } catch (e) {} }
  function owned(id) { var o = owner(); if (!o) return false; var r = load(o)[id]; return !!(r && r.token === tokenKind()); }
  function dateLocked(id) { var t = freeFrom(id); return t != null && now() < t; }
  function winnerOnly(id) { return !!(F[id] && F[id].winnerOnly === true); } // LB REWARDS: Monthly Champion, never sold
  function open(id) {
    if (!isFace(id)) return false;
    if (winnerOnly(id)) return !!(window.BLUP3TS_LBREWARDS && BLUP3TS_LBREWARDS.isWinner(id)); // only the server-listed monthly #1 wallet
    var t = freeFrom(id); if (t != null) return now() >= t; // free for everyone from that moment
    if (!on() || basePrice(id) == null) return false;
    return owned(id);
  }
  function dayLabel(id) { var t = freeFrom(id); try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Halifax' }).format(new Date(t)); } catch (e) { return 'Dec 1'; } }
  function label(id) {
    if (winnerOnly(id)) return '🏆 Monthly #' + (F[id].rank || 1) + ' only';
    if (freeFrom(id) != null) return '🔒 Unlocks ' + dayLabel(id);
    if (!on() || basePrice(id) == null) return '🔒 Coming soon';
    return '🍌 ' + A.fmt(price(id)) + ' ' + (wallet() ? word() : '$BLUNANA');
  }
  function note() {
    if (!on()) return 'More watch faces are coming soon.';
    return 'Extra faces are a one-time unlock with ' + word() + ' from a connected wallet. Once unlocked, a face works on all your pets. Christmas Morning is free for everyone from Dec 1.';
  }
  function grant(id, rec) { var o = owner(); if (!o) return false; var m = load(o); m[id] = rec; store(o, m); return true; }
  function tellServer(id, r) { // OFF until the dev sets FACE_UNLOCK_ENDPOINT (see API_FACES.md)
    var ep = C.FACE_UNLOCK_ENDPOINT; if (typeof ep !== 'string' || !/^\/api\/[\w\/-]+$/.test(ep)) return;
    fetch(ep, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ wallet: r.wallet, faceId: id, signature: r.sig, token: r.token, quoteId: r.quoteId || null }), keepalive: true, cache: 'no-store' }).catch(function () {});
  }
  function done(id, after) {
    var d = A.petDef(); A.setCase(id, d); A.render(); H.closeSheet();
    A.toast((F[id].name || 'Face') + ' unlocked! It works on all your pets ✨');
    if (after) setTimeout(after, 0);
  }
  function tap(id, after) {
    var c = F[id]; if (!c) return;
    if (winnerOnly(id)) { if (window.BLUP3TS_LBREWARDS) BLUP3TS_LBREWARDS.lockedSheet(id); return; } // never for sale
    if (dateLocked(id)) { A.toast(c.name + ' is free for everyone from ' + dayLabel(id) + ' 🎄'); return; }
    if (!on() || basePrice(id) == null) { A.toast('More watch faces are coming soon 🔒'); return; }
    if (!owner()) return needWallet(id); // Pretend mode, or Wallet mode with no wallet connected
    ask(id, after);
  }
  function needWallet(id) { // price + 'Connect a wallet to unlock'. Nothing is spent and nothing is saved here.
    var c = F[id], d = A.petDef(), nodes = [], w = WL(), el = function (t, cl, tx) { var e = document.createElement(t); if (cl) e.className = cl; if (tx != null) e.textContent = tx; return e; };
    var pv = (A.casePreviews(d) || []).filter(function (x) { return x.id === id; })[0];
    if (pv && H.miniWatch) { var box = el('div', 'fuprev'); box.appendChild(H.miniWatch(Object.assign({}, pv, { locked: false }))); nodes.push(box); }
    nodes.push(el('p', 'funame', c.name + ' watch face'));
    nodes.push(el('p', 'fuprice', '🍌 ' + A.fmt(price(id)) + ' $BLUNANA'));
    nodes.push(el('p', 'fuconnect', 'Connect a wallet to unlock 🔒'));
    nodes.push(H.p('Watch faces can only be unlocked with $BLUNANA from a connected wallet. Pretend $BLUNANA can\'t unlock them.'));
    nodes.push(H.p('Christmas Morning is free for everyone from Dec 1, no wallet needed 🎄'));
    var no = el('button', 'sbtn', 'Not now');
    no.onclick = function () { A.play('tap'); H.closeSheet(); };
    if (w && typeof w.onConnectClick === 'function') {
      var go = el('button', 'sbtn primary', 'Connect wallet');
      go.onclick = function () { A.play('tap'); H.closeSheet(); var x = WL(); if (x && x.onConnectClick) x.onConnectClick(); };
      nodes.push(go);
    } else nodes.push(H.p('Wallet connect is coming soon.'));
    nodes.push(no);
    H.openSheet(c.name, nodes);
  }
  function ask(id, after) { // real $BLUNANA: get the server's SOL fee quote first. No quote = blocked (fail closed), no sheet, no tx.
    if (winnerOnly(id) || basePrice(id) == null) return; // winner-only faces are never sold
    if (!owner()) return needWallet(id);
    if (tokenKind() === 'blunana' && C.PAID_FACE_REAL_UNLOCKS_ENABLED !== true) return A.toast('Unlocking with $BLUNANA is coming soon 🔒'); // paused until the dev's SOL quote endpoint exists; paid face unlocks keep the 5-cent SOL fee
    var w = WL(); if (!w || !w.faceFeeOn || !w.faceFeeOn()) return sheet(id, after, null); // BLUTEST: no SOL fee
    w.faceFeeQuote(id).then(function (q) { if (!owner()) return; if (!q) return A.toast('Price unavailable, try again shortly'); sheet(id, after, q); });
  }
  function sheet(id, after, fee) {
    if (!owner()) return needWallet(id); // connected wallets only, no pretend spend
    var c = F[id], amt = price(id), d = A.petDef(), nodes = [], el = function (t, cl, tx) { var e = document.createElement(t); if (cl) e.className = cl; if (tx != null) e.textContent = tx; return e; };
    var pv = (A.casePreviews(d) || []).filter(function (x) { return x.id === id; })[0];
    if (pv && H.miniWatch) { var box = el('div', 'fuprev'); box.appendChild(H.miniWatch(Object.assign({}, pv, { locked: false }))); nodes.push(box); }
    nodes.push(el('p', 'funame', c.name + ' watch face'));
    nodes.push(el('p', 'fuprice', '🍌 ' + A.fmt(amt) + ' ' + word()));
    var go = el('button', 'sbtn primary', 'Unlock'), no = el('button', 'sbtn', 'Cancel'), short = 0;
    if (tokenKind() === 'test') {
      nodes.push(H.p(word() + ' is a test token. It is not $BLUNANA and has no value. It goes to the test reserve.'));
      nodes.push(H.p('Your wallet will ask you to approve. Solana also charges a tiny network fee in SOL.'));
    } else {
      nodes.push(H.p('Your $BLUNANA goes back into the project: new pets, styles, features and community events.'));
      nodes.push(H.p('Your wallet will show the same amount before you approve. Solana also charges a tiny network fee in SOL.'));
      var tb = WL() && WL().tokenBalance ? WL().tokenBalance() : null; if (tb != null) short = Math.max(0, amt - tb);
    }
    if (fee) { // SOL fee line (exact wording), plus the exact amount from the server quote (the same lamports the tx sends)
      nodes.push(el('p', 'fusolfee', 'A small SOL fee that supports BLUP3TS development.'));
      nodes.push(el('p', 'fusolamt', 'SOL fee: ' + WL().solExact(fee.lamports) + ' SOL'));
    }
    nodes.push(H.p('Yours forever in this wallet, on any of your pets. Just for looks: your NFT never changes.'));
    if (short > 0) { go.disabled = true; go.textContent = 'Not enough ' + word(); nodes.push(el('p', 'fushort', 'You need ' + A.fmt(short) + ' more ' + word() + ' for this face.')); }
    no.onclick = function () { A.play('tap'); H.closeSheet(); };
    go.onclick = function () {
      if (go.disabled) return; go.disabled = true; A.play('tap');
      if (!owner()) { H.closeSheet(); return needWallet(id); } // wallet went away while the sheet was open
      var w2 = WL(); H.closeSheet(); if (!w2 || !w2.payFace) { A.toast('Unlocking is not ready yet.'); return; }
      w2.payFace(id, fee).then(function (r) {
        if (!r) return;
        grant(id, { token: r.token, price: r.amount, solFee: r.feeLamports || 0, sig: r.sig, memo: r.memo, at: new Date().toISOString() }); tellServer(id, r); done(id, after);
      });
    };
    nodes.push(go, no);
    H.openSheet('Unlock ' + c.name + '?', nodes);
  }
  // Reset progress no longer touches faces: only wallet unlocks exist, and those are kept.
  window.BLUP3TS_FACEPAY = Object.freeze({ isFace: isFace, open: open, owned: owned, label: label, note: note, tap: tap, ask: ask, needWallet: needWallet, price: price, owner: owner,
    setNowForTest: function (ms) { nowOverride = typeof ms === 'number' ? ms : null; A.render(); }, key: function () { var o = owner(); return o ? KEY + o : null; } });
  A.render(); // faces saved on a pet can only be applied once ownership is known
})();
