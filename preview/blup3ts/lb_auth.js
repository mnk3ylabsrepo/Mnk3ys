/* BLUP3TS ranks security (build Nov 2 2026). Switch: config.js LB_SECURE_ENABLED + LB_AUTH_ENDPOINT.
 * 1. Wallet proof: the server gives a one-time nonce, the wallet SIGNS A MESSAGE (signMessage, never a transaction),
 *    the server checks the ed25519 signature and sets an HttpOnly session cookie for that wallet.
 *    Only the public address and the signature are sent. Never a seed phrase or private key.
 * 2. Feed receipts: after a real feed confirms, the tx signature goes to FEED_RECEIPT_ENDPOINT. The server only counts it
 *    once the tx is FINALIZED on chain and matches (signature unique, mint, amount, recipient, memo, fee payer = proved wallet).
 *    Not final yet / not proved yet = kept in a small per-wallet queue (public tx signatures only) and sent again later.
 * The message text below must match server/api/lib/lb-core.js proofMessage() exactly. All text is set with textContent. */
(function () {
  'use strict';
  var C = window.BLUP3TS_CONFIG || {};
  var EP_RX = /^\/api\/[\w\/-]+$/;
  function ep(k) { var v = C[k]; return typeof v === 'string' && EP_RX.test(v) ? v.replace(/\/+$/, '') : ''; }
  var ON = C.LB_SECURE_ENABLED === true && !!ep('LB_AUTH_ENDPOINT');
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', KEY_RX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, SIG_RX = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
  var QKEY = 'blup3ts.web.feedq.', proof = { wallet: null, until: 0 }, busy = false, listeners = [], flushing = false, retryT = null;
  function A() { return window.BLUP3TS_APP; } function H() { return window.BLUP3TS_HOME; } function WL() { return window.BLUP3TS_WALLET || null; }
  function el(t, cl, tx) { var e = document.createElement(t); if (cl) e.className = cl; if (tx != null) e.textContent = String(tx); return e; }
  function b58(bytes) {
    var d = [0], i, j, c, out = '';
    for (i = 0; i < bytes.length; i++) { c = bytes[i]; for (j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } }
    for (i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1';
    for (i = d.length - 1; i >= 0; i--) out += B58[d[i]];
    return out;
  }
  function owner() { var a = A(), w = WL(); if (!a || a.state().mode !== 'wallet' || !w) return null; var k = (w.state() || {}).pubkey; return KEY_RX.test(k || '') ? k : null; }
  function site() { return location.host || 'blup3ts-local'; }
  function proofMessage(addr, nonce, issuedAt) { // keep in step with server/api/lib/lb-core.js
    return 'BLUP3TS ranks: this wallet is mine.\n\n' +
      'I am signing to add this wallet to the BLUP3TS ranks. This is free. It is not a transaction and it cannot move anything.\n\n' +
      'Wallet: ' + addr + '\nSite: ' + site() + '\nNonce: ' + nonce + '\nIssued At: ' + issuedAt;
  }
  function proved() { var o = owner(); return !!(o && proof.wallet === o && proof.until > Date.now()); }
  function canSign() { var w = WL(), W = w && w.state && w.state(); if (!W) return false; return !!((W.std && W.std.features && W.std.features['solana:signMessage']) || (W.provider && typeof W.provider.signMessage === 'function')); }
  function walletSign(bytes) { // signMessage only. This file never builds, signs or sends a transaction.
    var W = WL().state();
    if (W.std && W.std.features && W.std.features['solana:signMessage']) {
      return Promise.resolve(W.std.features['solana:signMessage'].signMessage({ account: W.account, message: bytes })).then(function (r) { r = Array.isArray(r) ? r[0] : r; return r && r.signature; });
    }
    return Promise.resolve(W.provider.signMessage(bytes, 'utf8')).then(function (r) { var s = r && (r.signature || r); if (s && !(s instanceof Uint8Array) && s.data) s = Uint8Array.from(s.data); return s; });
  }
  function json(url, opt) {
    return fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opt)).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j = j || {}; j._status = r.status; if (!r.ok || j.ok === false) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; e.body = j; throw e; } return j; });
    });
  }
  function changed() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function setProof(o, until) { proof = { wallet: o, until: until }; changed(); if (o) flush(); }
  function checkSession() { // is there already a proved session (HttpOnly cookie) for this wallet?
    var o = owner(); if (!ON || !o) return Promise.resolve(false);
    return json(ep('LB_AUTH_ENDPOINT') + '/session?wallet=' + encodeURIComponent(o), { headers: { accept: 'application/json' } }).then(function (j) {
      if (owner() !== o) return false;
      var until = Date.parse(j.expiresAt || ''); if (j.wallet === o && isFinite(until) && until > Date.now()) { setProof(o, until); return true; }
      return false;
    }).catch(function () { return false; });
  }
  function prove() { // gives back a promise of true/false
    var e = ep('LB_AUTH_ENDPOINT'), o = owner(), a = A();
    if (!ON) { a && a.toast('Wallet proof is coming soon.'); return Promise.resolve(false); }
    if (!o) { var w = WL(); if (w && w.onConnectClick) w.onConnectClick(); return Promise.resolve(false); }
    if (!canSign()) { a.toast('This wallet can\'t sign messages. Try Phantom or Solflare.'); return Promise.resolve(false); }
    if (busy) return Promise.resolve(false);
    busy = true; changed(); var msg;
    return json(e + '/nonce?wallet=' + encodeURIComponent(o), { headers: { accept: 'application/json' } }).then(function (n) {
      if (!n || typeof n.nonce !== 'string' || !/^[A-Za-z0-9]{16,64}$/.test(n.nonce)) throw new Error('bad nonce');
      if (typeof n.issuedAt !== 'string' || isNaN(Date.parse(n.issuedAt))) throw new Error('bad nonce');
      msg = proofMessage(o, n.nonce, n.issuedAt); // the server's own time, so its rebuilt message is byte for byte the same
      return walletSign(new TextEncoder().encode(msg)).then(function (sig) {
        if (!(sig instanceof Uint8Array) || sig.length !== 64) throw new Error('bad signature');
        if (owner() !== o) throw new Error('wallet changed');
        return json(e + '/verify', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ wallet: o, nonce: n.nonce, message: msg, signature: b58(sig) }) });
      });
    }).then(function (v) {
      busy = false; var until = Date.parse(v && v.expiresAt || ''); setProof(o, isFinite(until) ? until : Date.now() + 864e5);
      a.toast('Wallet proved ✔ Your real feeds can count on the ranks.'); return true;
    }).catch(function (err) {
      busy = false; changed(); var m = String(err && (err.message || err) || '');
      a.toast(/reject|cancel|denied|declin/i.test(m) || (err && err.code === 4001) ? 'Signing skipped. You can still play.' : 'Wallet proof did not work. Try again later.'); return false;
    });
  }
  function askProve(why) { // explains first, then the wallet pops up
    var h = H(), o = owner(), a = A(); if (!h) return;
    if (!o) { var w = WL(); if (w && w.onConnectClick) w.onConnectClick(); return; }
    var go = el('button', 'sbtn primary', '✍️ Sign with my wallet'), no = el('button', 'sbtn', 'Not now');
    go.dataset.lbauth = 'sign';
    go.onclick = function () { a.play('tap'); h.closeSheet(); prove().then(function (ok) { if (ok && window.BLUP3TS_LEADERBOARD) BLUP3TS_LEADERBOARD.open(); }); }; // back to the Ranks after proving
    no.onclick = function () { a.play('tap'); h.closeSheet(); };
    h.openSheet('Prove this wallet is yours', [
      h.p(why || 'To count on the ranks, your wallet signs a short message. It is free, it is not a transaction, and it cannot move anything.'),
      el('div', 'lbrmsg', proofMessage(o, '<from the server>', '<now>')),
      h.p('BLUP3TS will never ask for your secret recovery phrase or private key. Never share those with anyone.'),
      go, no]);
  }
  // ---- feed receipts (public tx signatures only) ----
  function qload(o) { try { var v = JSON.parse(localStorage.getItem(QKEY + o) || '[]'); return Array.isArray(v) ? v.filter(function (r) { return r && SIG_RX.test(r.sig || ''); }) : []; } catch (e) { return []; } }
  function qsave(o, q) { try { if (q.length) localStorage.setItem(QKEY + o, JSON.stringify(q.slice(-50))); else localStorage.removeItem(QKEY + o); } catch (e) {} }
  function queued() { var o = owner(); return o ? qload(o).length : 0; }
  function noteFeed(r) { // r: { sig, wallet, petId, tier, token, name, collection, number }
    if (!r || !SIG_RX.test(r.sig || '') || !KEY_RX.test(r.wallet || '')) return;
    var q = qload(r.wallet); if (!q.some(function (x) { return x.sig === r.sig; })) q.push({ sig: r.sig, petId: r.petId, tier: r.tier, token: r.token, name: r.name, collection: r.collection, number: r.number, at: Date.now(), tries: 0 });
    qsave(r.wallet, q); changed(); setTimeout(flush, 0);
  }
  function later(ms) { clearTimeout(retryT); retryT = setTimeout(flush, ms); }
  function flush() { // sends queued receipts for the proved wallet. 202 = not final yet (try again later), 401 = prove first.
    var e = ep('FEED_RECEIPT_ENDPOINT'), o = owner(); if (!e || !o || flushing) return Promise.resolve(0);
    if (ON && !proved()) return Promise.resolve(0);
    var q = qload(o); if (!q.length) return Promise.resolve(0);
    flushing = true; var done = 0, wait = false;
    return q.reduce(function (p, r) {
      return p.then(function () {
        return json(e, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ wallet: o, signature: r.sig, petId: r.petId, tier: r.tier, token: r.token, name: r.name, collection: r.collection, number: r.number }), keepalive: true })
          .then(function (j) { if (j._status === 202 || j.status === 'pending') { r.tries++; wait = true; } else { r.done = true; done++; } })
          .catch(function (err) {
            var st = err && err.status;
            if (st === 401) { proof = { wallet: null, until: 0 }; wait = false; }
            else if (st === 400 || st === 409 || st === 422) r.done = true; // rejected for good (bad, duplicate or not a matching feed): drop it
            else { r.tries++; wait = true; }
          });
      });
    }, Promise.resolve()).then(function () {
      flushing = false; var gone = {}, tries = {};
      q.forEach(function (r) { if (r.done) gone[r.sig] = 1; tries[r.sig] = r.tries; });
      var left = qload(o).filter(function (x) { return !gone[x.sig]; }).map(function (x) { if (x.sig in tries) x.tries = tries[x.sig]; return x; }); // new receipts added meanwhile are kept
      left = left.filter(function (x) { return x.tries < 40; }); qsave(o, left); changed();
      if (wait && left.length) later(20000); // finalized usually takes well under a minute
      return done;
    });
  }
  var lastOwner = null;
  setInterval(function () { var o = owner(); if (o !== lastOwner) { lastOwner = o; proof = { wallet: null, until: 0 }; changed(); if (o) { checkSession().then(function () { flush(); }); } } }, 1500);
  // ---- Ranks sheet bar ----
  function bar() { // shown at the top of the Ranks sheet
    var box = el('div', 'lbauth'), o = owner(); box.id = 'lbAuthBar';
    if (!ON) return null;
    if (!o) { box.appendChild(el('p', 'lbauthp', 'Ranks count real $BLUNANA feeds from a proved wallet. Connect a wallet to join.')); return box; }
    if (proved()) {
      box.appendChild(el('p', 'lbauthok', '✔ Wallet proved'));
      var n = queued(); if (n) box.appendChild(el('p', 'lbauthp', n + ' feed' + (n === 1 ? ' is' : 's are') + ' being checked on Solana. They show up once final.'));
      return box;
    }
    box.appendChild(el('p', 'lbauthp', 'Prove this wallet is yours so your real feeds count on the ranks. It is free and is not a transaction.'));
    var b = el('button', 'sbtn primary', busy ? 'Waiting for your wallet…' : '✍️ Prove my wallet'); b.type = 'button'; b.dataset.lbauth = 'prove'; b.disabled = busy || !canSign();
    b.onclick = function () { A().play('tap'); askProve(); }; box.appendChild(b);
    return box;
  }
  window.BLUP3TS_LBAUTH = Object.freeze({
    enabled: ON, proved: proved, prove: prove, askProve: askProve, canSign: canSign, proofMessage: proofMessage, bar: bar,
    noteFeed: noteFeed, flush: flush, queued: queued, checkSession: checkSession, onChange: function (f) { if (typeof f === 'function') listeners.push(f); },
    busy: function () { return busy; }, _b58: b58
  });
})();
