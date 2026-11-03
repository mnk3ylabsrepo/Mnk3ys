// BLUP3TS Wallet mode: read-only connect (Wallet Standard: Phantom, Solflare, Backpack), then the NFT check
// (MNK3YS, ZMB3YS, Caporegime Del $Empire; config NFT_CHECK_COLLECTIONS) through the same-site Netlify Function so no RPC key reaches the browser.
// Real feeding is ON (config REAL_PAYMENTS_ENABLED). The cNFT boost stays OFF (BURN_BOOST_ENABLED).
// The optional sign-in message is OFF (SIGN_IN_ENABLED). In P1 the wallet is never asked to sign anything.
// Rules: public keys only. Never asks for a seed phrase or private key. No signAllTransactions.
// Pet data from the RPC is untrusted: it is cleaned and only ever set with textContent / img.src.
(function () {
  'use strict';
  var A = window.BLUP3TS_APP, H = window.BLUP3TS_HOME, C = window.BLUP3TS_CONFIG, SOL = window.BLUP3TS_SOL, F = window.BLUP3TS_FILTER, R = window.BLUP3TS_RARITY || {}, ART = window.BLUP3TS_ART;
  var $ = function (id) { return document.getElementById(id); }, el = A.el;
  if (!A || !H || !C) return;
  // Wallet connect switched off (config.js WALLET_CONNECT_ENABLED): stop here. Nothing below runs, so no wallet
  // provider is touched, no RPC/DAS call is made and no deep link is built. The code stays for when it is turned on.
  if (C.WALLET_CONNECT_ENABLED !== true) return;
  var W = { connecting: false, tryStarters: false, kind: null, provider: null, std: null, pubkey: null, verified: false, loading: false, error: null, soon: false, pets: [], found: 0, skipped: 0, gen: 0, counts: {}, progressReady: false };
  function payOn() { return C.REAL_PAYMENTS_ENABLED === true; }
  var BOOST = window.BLUP3TS_BOOST_CORE ? BLUP3TS_BOOST_CORE({ cfg: C, load: function () { try { return JSON.parse(localStorage.getItem('blup3ts.web.boost')); } catch (e) { return null; } },
    save: function (s) { try { localStorage.setItem('blup3ts.web.boost', JSON.stringify(s)); } catch (e) {} } }) : null;
  if (BOOST) A.xp = function (id, base) { return BOOST.xp(id, base); };

  // ---------- helpers ----------
  var B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  function isKey(s) { return typeof s === 'string' && B58.test(s) && (!SOL || SOL.isPubkey(s)); }
  function short(k) { return k ? k.slice(0, 4) + '…' + k.slice(-4) : ''; }
  function txt(v, max) { return String(v == null ? '' : v).slice(0, 400).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 40); }
  function hostOk(h, list) { h = h.toLowerCase(); return list.some(function (p) { p = p.toLowerCase(); return p.indexOf('*.') === 0 ? (h.length > p.length - 1 && h.slice(-(p.length - 1)) === p.slice(1)) : h === p; }); }
  function safeImg(u) { try { var x = new URL(String(u)); return x.protocol === 'https:' && !x.username && !x.password && hostOk(x.hostname, C.IMAGE_HOSTS || []) ? x.href : null; } catch (e) { return null; } }
  function isMobile() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); }
  // M11: remember only which wallet app was used (e.g. 'solflare'), so next visit can reconnect quietly. No address, no keys.
  var REM = 'blup3ts.web.wallet';
  function remembered() { try { var v = localStorage.getItem(REM); return /^(phantom|solflare|backpack)$/.test(v) ? v : null; } catch (e) { return null; } }
  function remember(kind) { try { if (kind) localStorage.setItem(REM, kind); else localStorage.removeItem(REM); } catch (e) {} }
  function fromDeepLink() { try { return new URLSearchParams(location.search).get('wallet') === '1'; } catch (e) { return false; } }
  function deepLink(base) { var u = new URL(location.href); u.hash = ''; u.searchParams.delete('fresh'); u.searchParams.set('wallet', '1'); return base + encodeURIComponent(u.href) + '?ref=' + encodeURIComponent(location.origin); }
  // M13: official wallet icons (the ones the Solflare / Phantom wallet adapters report), stored in the bundle, never loaded from outside
  var LOGO = { solflare: 'assets/wallets/solflare.png', phantom: 'assets/wallets/phantom.png' };
  function logoImg(kind, cls) { var src = LOGO[kind]; if (!src) return null; var i = el('img', cls || 'wlogo'); i.src = src; i.alt = ''; i.width = 22; i.height = 22; i.draggable = false; return i; }
  function withLogo(node, kind, text) { node.textContent = ''; var i = logoImg(kind); if (i) node.appendChild(i); node.appendChild(document.createTextNode(text)); return node; }
  // ---------- Wallet Standard discovery (no library: the two standard window events) ----------
  var STD = [];
  function onRegister() { [].slice.call(arguments).forEach(function (w) { if (w && typeof w === 'object' && STD.indexOf(w) < 0) STD.push(w); }); return function () {}; }
  var stdApi = Object.freeze({ register: onRegister });
  try {
    window.addEventListener('wallet-standard:register-wallet', function (e) { try { if (e && typeof e.detail === 'function') e.detail(stdApi); } catch (x) {} });
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: stdApi }));
  } catch (e) {}
  var ALLOWED = (Array.isArray(C.WALLETS) && C.WALLETS.length ? C.WALLETS : ['Phantom', 'Solflare', 'Backpack']).map(String);
  function allowedName(n) { n = String(n || '').toLowerCase(); return ALLOWED.filter(function (a) { return n === a.toLowerCase() || n.indexOf(a.toLowerCase()) === 0; })[0] || null; }
  function stdOk(w) { try { var f = w.features || {}; return (w.chains || []).some(function (c) { return c === 'solana:mainnet'; }) && f['standard:connect'] && typeof f['standard:connect'].connect === 'function'; } catch (e) { return false; } }
  function providers() {
    var out = [], have = {};
    STD.forEach(function (w) { var nm = allowedName(w.name); if (nm && !have[nm] && stdOk(w)) { have[nm] = 1; out.push({ kind: nm.toLowerCase(), name: nm, std: w }); } });
    // older wallet builds without Wallet Standard: the classic injected objects (connect only)
    try { var ph = window.phantom && window.phantom.solana; if (!have.Phantom && ph && ph.isPhantom && ALLOWED.indexOf('Phantom') >= 0) out.push({ kind: 'phantom', name: 'Phantom', p: ph }); } catch (e) {}
    try { var sf = window.solflare; if (!have.Solflare && sf && sf.isSolflare && ALLOWED.indexOf('Solflare') >= 0) out.push({ kind: 'solflare', name: 'Solflare', p: sf }); } catch (e) {}
    try { var bp = window.backpack; if (!have.Backpack && bp && bp.isBackpack && ALLOWED.indexOf('Backpack') >= 0) out.push({ kind: 'backpack', name: 'Backpack', p: bp }); } catch (e) {}
    return out;
  }
  function rejected(e) { var c = e && (e.code || (e.error && e.error.code)); return c === 4001 || /reject|denied|cancel|declin/i.test(String(e && (e.message || e))); }
  var TOKEN_PROG = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', ATA_PROG = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', HOLD = 10000;
  var tokenBal = null, balGen = 0;
  function playKind() { try { return localStorage.getItem('blup3ts.playToken') === 'blunana' ? 'blunana' : 'test'; } catch (e) { return 'test'; } }
  function usingTest() { return playKind() !== 'blunana'; }
  function payCfg() {
    return {
      RESERVE_WALLET: usingTest() ? C.RESERVE_WALLET : C.BLUNANA_RESERVE_WALLET,
      BLUNANA_MINT: usingTest() ? C.BLUNANA_MINT : C.REAL_BLUNANA_MINT,
      BLUNANA_DECIMALS: C.BLUNANA_DECIMALS,
      FEED_COSTS: C.FEED_COSTS,
      COST_SCALE: C.COST_SCALE,
      LIVE_COST_SCALE: C.LIVE_COST_SCALE
    };
  }
  function realOn() { var cfg = payCfg(); return payOn() && C.NETWORK === 'mainnet-live' && isKey(cfg.RESERVE_WALLET) && isKey(cfg.BLUNANA_MINT) && !!SOL; }
  function livePlay() { return A.state().mode === 'wallet' && payOn() && (usingTest() ? C.TEST_PLAY === true : isKey(C.BLUNANA_RESERVE_WALLET)); }
  function setPlayKind(k) {
    try { localStorage.setItem('blup3ts.playToken', k === 'blunana' ? 'blunana' : 'test'); } catch (e) {}
    tokenBal = null; readBal(); syncClaim(); paintPlay();
    if (H && H.renderMode) H.renderMode();
  }
  function holdsEnough() { return tokenBal != null && tokenBal >= HOLD; }
  function readBal() {
    var gen = ++balGen, owner = W.pubkey, mint = payCfg().BLUNANA_MINT;
    if (!livePlay() || !owner || !SOL || !isKey(mint)) { tokenBal = null; paintPlay(); paintClaim(); return Promise.resolve(); }
    var PK = SOL.PublicKey;
    return PK.findProgramAddress([new PK(owner).toBytes(), new PK(TOKEN_PROG).toBytes(), new PK(mint).toBytes()], new PK(ATA_PROG)).then(function (found) {
      return rpc('getAccountInfo', [found[0].toBase58(), { encoding: 'base64' }]);
    }).then(function (r) {
      if (gen !== balGen || W.pubkey !== owner) return;
      var data = r && r.value && r.value.data, b64 = Array.isArray(data) ? data[0] : (typeof data === 'string' ? data : '');
      if (!b64) tokenBal = 0;
      else {
        var raw = atob(b64), n = 0n;
        for (var i = 0; i < 8; i++) n += BigInt(raw.charCodeAt(64 + i)) << BigInt(8 * i);
        tokenBal = Number(n / (10n ** BigInt(C.BLUNANA_DECIMALS || 6)));
      }
      paintPlay(); paintClaim();
    }).catch(function () { if (gen !== balGen) return; tokenBal = null; paintPlay(); paintClaim(); });
  }
  function unlockFoods() {
    if (!livePlay() || !A.foods) return;
    document.querySelectorAll('#foods .food[data-tier]').forEach(function (b) {
      var f = A.foods.filter(function (x) { return x.id === b.dataset.tier; })[0];
      if (f) b.disabled = feedLocked(f);
    });
  }
  function paintPlay() {
    var live = livePlay(), word = payWord();
    var cap = $('balCap'), fine = $('balFine'), refill = $('refillBtn');
    if (cap) cap.textContent = live ? word : 'Pretend $BLUNANA';
    if (fine) fine.textContent = !live ? 'Play money for Pretend mode. Nothing here touches real tokens.' : usingTest() ? (W.pubkey ? 'Test token in this wallet. Feeding sends it to the test reserve. It is not $BLUNANA.' : 'Connect a wallet to see your ' + word + '. Wallet mode does not use pretend play money.') : (W.pubkey ? 'Real $BLUNANA. Every feed goes back into the project.' : 'Connect a wallet to see your $BLUNANA. Every feed goes back into the project.');
    if (refill) refill.hidden = !!live;
    if (live && $('bal')) $('bal').textContent = !W.pubkey ? '—' : (tokenBal == null ? '…' : A.fmt(tokenBal));
    var fw = $('feedWord'), ff = $('feedFine'), fb = $('feedBal'), ov = $('ov-feed');
    if (fw) fw.textContent = live ? word : 'pretend';
    if (ff) ff.textContent = !live ? 'Pretend $BLUNANA · play money · no real tokens' : usingTest() ? word + ' · your wallet approves each feed · not $BLUNANA' : '$BLUNANA · your wallet approves each feed · community wallet';
    if (live && fb && ov && ov.classList.contains('show')) fb.textContent = !W.pubkey ? '—' : (tokenBal == null ? '…' : A.fmt(tokenBal));
    var home = $('blutestBal');
    if (home) { home.hidden = !live; home.textContent = !W.pubkey ? 'Connect a wallet to see your ' + word + ' balance.' : (tokenBal == null ? 'Checking ' + word + ' balance…' : word + ' balance: ' + A.fmt(tokenBal)); }
    unlockFoods();
  }

  // ---------- RPC (read-only) ----------
  function rpc(method, params) {
    if (!C.RPC_URL) return Promise.reject(new Error('RPC off')); // real payments are off; nothing to call
    var ctl = window.AbortController ? new AbortController() : null, ms = C.RPC_TIMEOUT_MS || 15000;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(C.RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'blup3ts', method: method, params: params }), signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (r) { if (!r.ok) { var e = new Error('RPC ' + r.status); e.http = r.status; throw e; } return r.json(); })
      .then(function (j) { if (!j || typeof j !== 'object') throw new Error('bad RPC reply'); if (j.error) { var e = new Error(txt(j.error.message, 120) || 'RPC error'); e.rpc = j.error.code; throw e; } return j.result; })
      .catch(function (e) { if (e && e.name === 'AbortError') { var t = new Error('timeout'); t.timeout = true; throw t; } throw e; })
      .finally(function () { clearTimeout(timer); });
  }
  function friendly(e) {
    if (!e) return 'Something went wrong.';
    if (e.timeout) return 'Solana took too long to answer. Try again in a moment.';
    if (e.soon) return 'NFT check coming soon. Your starter pets still work.';
    if (e.code === 'no-das' || e.rpc === -32601 || /method not found|not supported/i.test(e.message)) return 'NFT check coming soon. Your starter pets still work.';
    if (e.code === 'busy') return 'Solana is busy right now. Try again in a minute.';
    if (e.http === 429) return 'Solana is busy right now (too many requests). Try again in a minute.';
    if (e.http) return 'Solana answered with an error (' + e.http + '). Try again soon.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) return 'Can\'t reach Solana. Check your internet and try again.';
    return 'Couldn\'t load your pets. Try again soon.';
  }

  var CAPO_ON = C.CAPO_WALLET_ENABLED === true, CAPO_S = CAPO_ON ? ', Capo' : '', CAPO_L = CAPO_ON ? ' (and Caporegime Del $Empire)' : '', CAPO_O = CAPO_ON ? ' (or Caporegime Del $Empire)' : '';
  // ---------- pets ----------
  var CHECK_IDS = Array.isArray(C.NFT_CHECK_COLLECTIONS) ? C.NFT_CHECK_COLLECTIONS.filter(function (id) { return id !== 'capo' || C.CAPO_WALLET_ENABLED === true; }) : null; // Capos: no NFT check while CAPO_WALLET_ENABLED is false
  function collById(id) { return (C.COLLECTIONS || []).filter(function (c) { return c.id === id && (!CHECK_IDS || CHECK_IDS.indexOf(c.id) >= 0) && c.enabled !== false && c.verified === true; })[0] || null; }
  function share(coll, type, value) {
    var t = R[coll], f = F && F.hash; if (!t || !f) return undefined;
    var m = t.t[f(type)], n = m && m[f(value)]; return n ? Math.round(10000 * n / t.total) / 100 : undefined;
  }
  // family friendly: blocked values become a music look slot or are hidden; the original text is kept on the
  // pet (orig) ONLY for the holder's own NFT, shown only when 'Show original traits' (18+) is switched on.
  function traitsOf(attrs, coll) {
    var out = [], seen = {};
    if (!Array.isArray(attrs)) return out;
    attrs.slice(0, 30).forEach(function (a) {
      if (!a || typeof a !== 'object') return;
      var type = txt(a.trait_type, 24), value = txt(a.value, 40);
      if (!type || !value || seen[type.toLowerCase()] || /^rarity/i.test(type)) return; seen[type.toLowerCase()] = 1;
      if (/^(blank|none)$/i.test(value)) return;
      if (F && F.blocked(type, value)) { var sl = F.slot(type); out.push(sl ? { type: sl === 'hand' ? 'In hand' : 'Mouth', slot: sl, orig: value, origType: type } : { type: type, hidden: true, orig: value }); return; }
      if (/blunana/i.test(value)) value = value.replace(/blunana/ig, 'BLUNANA');
      out.push({ type: /^(mnk3y|zmb3y)$/i.test(type) ? type.toUpperCase() : type, value: value, share: share(coll.name, type, value) });
    });
    return out;
  }
  function petOf(item) {
    var coll = item && collById(item.collection), id = item && item.id;
    if (!coll || !isKey(id)) return null;
    var nm = txt(item.name, 32), m = /#\s?(\d{1,5})$/.exec(nm);
    var name = m ? coll.one + ' #' + m[1] : coll.one + ' ' + short(id);
    var img = safeImg(item.image) || (ART ? ART.collection(coll.id) : 'assets/mnk3ys.png');
    var raw = (Array.isArray(item.attributes) ? item.attributes : []).slice(0, 30).map(function (a) { return { type: txt(a && a.trait_type, 24), value: txt(a && a.value, 40) }; }).filter(function (a) { return a.type && a.value && !/^rarity/i.test(a.type); });
    return { id: 'own-' + id, mint: id, name: name, collection: coll.name, collectionId: coll.id, img: img, fallbackImg: ART ? ART.collection(coll.id) : null, round: coll.id === 'zmb3ys', owned: true,
      traits: traitsOf(item.attributes, coll), rawTraits: raw, number: m ? +m[1] : undefined };
  }
  function endpoint() { var u = C.NFT_CHECK_ENDPOINT; return typeof u === 'string' && u.length > 0 && !/[?&](api[-_]?key|key|token)=/i.test(u) ? u : null; }
  function checkUrl(owner) { var u = endpoint(); return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'owner=' + encodeURIComponent(owner); }
  function fetchPets(owner) {
    if (!endpoint()) { var none = new Error('no endpoint'); none.soon = true; return Promise.reject(none); } // static hosting: no NFT check yet
    var ctl = window.AbortController ? new AbortController() : null, ms = C.RPC_TIMEOUT_MS || 15000;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(checkUrl(owner), { method: 'GET', headers: { accept: 'application/json' }, signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (r) {
        if (r.status === 404) { var n = new Error('no function'); n.soon = true; throw n; } // function not deployed (local preview)
        return r.json().catch(function () { var e = new Error('bad reply'); e.http = r.status; throw e; }).then(function (j) {
          if (j && j.code === 'not-configured') { var s = new Error('soon'); s.soon = true; throw s; }
          if (!r.ok || !j || j.ok !== true || !Array.isArray(j.pets)) { var e = new Error('check failed'); e.http = r.status; e.code = j && j.code; throw e; }
          return j;
        });
      })
      .catch(function (e) { if (e && e.name === 'AbortError') { var t = new Error('timeout'); t.timeout = true; throw t; } throw e; })
      .finally(function () { clearTimeout(timer); });
  }
  function loadPets() {
    if (!W.pubkey) return Promise.resolve();
    var gen = ++W.gen, owner = W.pubkey;
    W.loading = true; W.error = null; W.soon = false; refresh();
    return fetchPets(owner).then(function (j) {
      if (gen !== W.gen || W.pubkey !== owner) return;
      var fv = A.favs ? A.favs.list(owner) : [], src = j.pets.slice();
      if (fv.length) src = src.filter(function (it) { return it && fv.indexOf(String(it.id)) >= 0; }).concat(src.filter(function (it) { return !(it && fv.indexOf(String(it.id)) >= 0); })); // favorites first, so they are always in the 60
      var pets = src.map(petOf).filter(Boolean).slice(0, C.MAX_PETS || 60);
      var total = Math.max(+j.found || 0, src.length); W.found = total || pets.length; W.skipped = Math.max(0, total - pets.length); W.pets = pets; W.counts = {};
      pets.forEach(function (p) { W.counts[p.collectionId] = (W.counts[p.collectionId] || 0) + 1; });
      W.loading = false; showOwned();
      pullPets(owner);
      if (W.pets.length && !A.petDef().owned) whenIdle(function () { if (W.pubkey === owner && W.pets[0]) { A.setActive(W.pets[0].id); refresh(); } }); // M11: start on your own pet
      say(!W.pets.length ? 'No MNK3YS or ZMB3YS' + CAPO_O + ' found in this wallet' : 'Found ' + W.pets.length + ' pet' + (W.pets.length === 1 ? '' : 's') + ' 🎉');
    }).catch(function (e) {
      if (gen !== W.gen) return; W.loading = false; W.soon = !!(e && e.soon); W.error = friendly(e); refresh(); H.toast(W.soon ? 'NFT check coming soon 👛' : W.error);
    });
  }
  function say(t) { H.toast(t); } // the page toast floats over every screen (the watch toast lives on the watch Home page only)
  var persistTimer = null, OWN = /^own-[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  function pullPets(owner, attempt) {
    W.progressReady = false;
    fetch('/api/blup3ts-pets?wallet=' + encodeURIComponent(owner), { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (W.pubkey !== owner) return;
        if (!j || j.ok !== true || !Array.isArray(j.pets)) { if (!attempt) setTimeout(function () { if (W.pubkey === owner) pullPets(owner, 1); }, 2000); return; }
        if (A.applyProgress) A.applyProgress(j.pets);
        W.progressReady = true;
        refresh();
      }).catch(function () { if (W.pubkey === owner && !attempt) setTimeout(function () { if (W.pubkey === owner) pullPets(owner, 1); }, 2000); });
  }
  function pushPets() {
    if (!W.progressReady || !W.pubkey || !A.state) return;
    var pets = A.state().pets || {}, rows = [], defs = A.pets ? A.pets() : [];
    Object.keys(pets).forEach(function (id) {
      if (!OWN.test(id)) return;
      var q = pets[id], d = null, row = { id: id, full: q.full, joy: q.joy, str: q.str, eaten: q.eaten, jams: q.jams };
      for (var i = 0; i < defs.length; i++) if (defs[i].id === id) d = defs[i];
      if (d) { row.name = d.name; row.collection = d.collection; if (d.number != null) row.number = d.number; row.image = d.img; }
      rows.push(row);
    });
    if (!rows.length) return;
    var owner = W.pubkey;
    fetch('/api/blup3ts-pets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: owner, pets: rows }), keepalive: true, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.pets && j.pets.length && W.pubkey === owner && A.applyProgress) A.applyProgress(j.pets); })
      .catch(function () {});
  }
  function persist() { if (!W.progressReady) return; clearTimeout(persistTimer); persistTimer = setTimeout(pushPets, 800); }
  function showOwned() {
    if (A.state().mode === 'wallet' && W.pubkey && W.pets.length) { if (A.noteHolder) A.noteHolder(W.pubkey, W.pets.map(function (p) { return p.id; })); A.addPets(W.pets); } else dropOwned();
    refresh();
  }
  function dropOwned() {
    var act = A.petDef(), wasOwned = act && act.owned;
    A.removeOwnedPets();
    if (wasOwned || /^own-/.test(A.state().active)) whenIdle(function () { A.setActive(A.pets()[0].id); refresh(); });
  }
  function whenIdle(fn) { if (!A.isEating()) return fn(); var t = setInterval(function () { if (!A.isEating()) { clearInterval(t); fn(); } }, 200); }
  function refresh() { H.renderMode(); syncClaim(); H.renderCarousel(false); if (A.refreshPets) A.refreshPets(); }

  // ---------- connect / sign in ----------
  function onConnectClick() {
    var now = Date.now();
    if (W.connecting) return; // no double taps while the wallet is asking
    if (W.pubkey) { if (now - (W.lastConnect || 0) < 1200) return; W.lastDrop = now; return disconnect(true); } // a quick 2nd tap on Connect can't disconnect
    if (now - (W.lastDrop || 0) < 400) return; // ...and a quick 2nd tap on Disconnect can't reconnect
    var list = providers(), nodes = [];
    if (list.length === 1 && isMobile()) return connect(list[0]); // M11: inside the wallet's own browser: one tap, no picker
    if (list.length) {
      nodes.push(H.p('Pick your wallet. Only your public address is shared. BLUP3TS will not ask you to sign anything.'));
      pickButtons(list).forEach(function (b) { nodes.push(b); });
    } else if (isMobile()) {
      // M11: phone browsers (Safari/Chrome) have no wallet inside, so we open BLUP3TS in the wallet app's own browser.
      // ?wallet=1 tells the page to start in Wallet mode and connect right away there.
      nodes.push(H.p('On a phone, BLUP3TS connects inside your wallet app. Tap below: it opens this page in Solflare and connects in one tap.'));
      [['Solflare', 'https://solflare.com/ul/v1/browse/', 'sbtn primary'], ['Phantom', 'https://phantom.app/ul/browse/', 'sbtn']].forEach(function (w) {
        var a = withLogo(el('a', w[2] + ' openin'), w[0].toLowerCase(), 'Open in ' + w[0]); a.href = deepLink(w[1]); a.rel = 'noopener noreferrer'; a.dataset.wallet = w[0].toLowerCase(); nodes.push(a);
      });
      nodes.push(el('p', 'muted', 'Only your public address is shared. Nothing to sign.'));
    } else {
      nodes.push(H.p('No wallet found in this browser. Install the Phantom, Solflare or Backpack browser extension, then reload this page.'));
    }
    nodes.push(el('p', 'muted', 'BLUP3TS never asks for your seed phrase or private key. If anything does, it\'s a scam.'));
    H.openSheet('Connect wallet', nodes);
  }
  function pickButtons(list) {
    return list.map(function (x) { var b = withLogo(el('button', 'sbtn primary'), x.kind, 'Connect ' + x.name); b.dataset.wallet = x.kind; b.onclick = function () { W.picked = true; connect(x); }; return b; });
  }
  // NEXT BATCH (wallet repick): right after you disconnect, offer the wallet picker so you can reconnect or switch wallets.
  // Only ever called from a disconnect you made (never on page load). Closing it (X, tap outside, Esc) keeps you in Pretend mode.
  // Always a picker here, even inside a wallet's own browser with one wallet (no quiet one-tap reconnect after you chose to leave).
  function showRepick() {
    if (W.pubkey || W.connecting) return;
    var list = providers(); if (!list.length) return; // no wallet in this browser: nothing to offer
    W.picked = false;
    var nodes = [H.p(list.length > 1 ? 'Disconnected. Pick a wallet to connect again or switch wallets, or close this to keep playing in Pretend mode.' : 'Disconnected. Connect again, or close this to keep playing in Pretend mode.')];
    pickButtons(list).forEach(function (b) { nodes.push(b); });
    nodes.push(el('p', 'muted', 'BLUP3TS never asks for your seed phrase or private key. If anything does, it\'s a scam.'));
    H.openSheet('Connect wallet', nodes, null, function () {
      if (W.picked || W.pubkey || W.connecting) return;
      if (A.state().mode === 'wallet') { if (H.setMode) H.setMode('pretend'); else { A.setMode('pretend'); onMode('pretend'); H.renderMode(); H.renderCarousel(true); } }
    });
    var sh = $('sheet'); if (sh) sh.dataset.repick = '1';
  }
  function connect(x, silent) {
    if (W.connecting || W.pubkey) return Promise.resolve();
    if ($('sheet') && $('sheet').classList.contains('show')) H.closeSheet();
    if (A.state().mode !== 'wallet') { A.setMode('wallet'); }
    W.connecting = true; W.error = null; refresh();
    var done = function (pk) {
      var k = pk && (typeof pk === 'string' ? pk : pk.toBase58 ? pk.toBase58() : pk.toString());
      if (!isKey(k)) throw new Error('no public key');
      W.connecting = false; W.tryStarters = false; W.lastConnect = Date.now();
      W.kind = x.kind; W.provider = x.p || null; W.std = x.std || null; W.pubkey = k; W.verified = false; W.pets = []; listen(x); remember(x.kind);
      dropOwned(); W.loading = true; // looking card + spinner straight away, starters hidden
      H.toast((silent ? 'Welcome back ' : 'Connected ') + short(k)); refresh(); readBal(); if (C.SIGN_IN_ENABLED === true) askSignIn(); return loadPets();
    };
    var r;
    if (x.std) { // Wallet Standard: standard:connect gives back accounts; we read the public address only
      try { r = x.std.features['standard:connect'].connect(silent ? { silent: true } : undefined); } catch (e) { return fail(e); }
      return Promise.resolve(r).then(function (res) {
        var accs = (res && res.accounts) || x.std.accounts || [], acc = accs.filter(function (a) { return a && (!a.chains || a.chains.indexOf('solana:mainnet') >= 0); })[0] || accs[0];
        W.account = acc || null;
        return done(acc && acc.address);
      }).catch(fail);
    }
    try { r = silent ? x.p.connect({ onlyIfTrusted: true }) : x.p.connect(); } catch (e) { return fail(e); }
    return Promise.resolve(r).then(function (res) { return done((res && res.publicKey) || x.p.publicKey); }).catch(fail);
    function fail(e) { W.connecting = false; W.pubkey = null; refresh(); if (silent) return; H.toast(rejected(e) ? 'Connect cancelled. No problem.' : 'Couldn\'t connect the wallet.'); }
  }
  function nonce() { var b = new Uint8Array(16); crypto.getRandomValues(b); return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function siwsMessage(addr, n, now) {
    var exp = new Date(now + (C.SIGN_IN_MINUTES || 10) * 60000);
    return { text: (location.host || 'blup3ts-local') + ' wants you to sign in with your Solana account:\n' + addr + '\n\nSign in to BLUP3TS (beta) to prove this wallet is yours. This is free and does not move anything.\n\n' +
      'URI: ' + location.origin + '\nVersion: 1\nChain ID: mainnet\nNonce: ' + n + '\nIssued At: ' + new Date(now).toISOString() + '\nExpiration Time: ' + exp.toISOString(), exp: exp.getTime(), nonce: n };
  }
  function askSignIn() {
    if (C.SIGN_IN_ENABLED !== true || !W.provider || typeof W.provider.signMessage !== 'function') return;
    var b = el('button', 'sbtn primary', '✍️ Sign in (free)'), s = el('button', 'sbtn', 'Skip for now');
    b.onclick = function () { H.closeSheet(); signIn(); }; s.onclick = H.closeSheet;
    H.openSheet('Prove it\'s you', [H.p('Sign a short message so BLUP3TS knows this wallet is yours. It\'s free, it is not a transaction, and it only works on this site for ' + (C.SIGN_IN_MINUTES || 10) + ' minutes.'), b, s]);
  }
  function signIn() {
    var k = W.pubkey, p = W.provider; if (C.SIGN_IN_ENABLED !== true || !k || !p) return Promise.resolve(false);
    var m = siwsMessage(k, nonce(), Date.now()), bytes = new TextEncoder().encode(m.text);
    return Promise.resolve().then(function () { return p.signMessage(bytes, 'utf8'); }).then(function (res) {
      var sig = res && (res.signature || res); if (sig && !(sig instanceof Uint8Array) && sig.data) sig = Uint8Array.from(sig.data);
      if (!(sig instanceof Uint8Array) || sig.length !== 64) throw new Error('bad signature');
      if (W.pubkey !== k) throw new Error('wallet changed');
      if (Date.now() > m.exp) throw new Error('expired');
      if (!SOL.verifySignature(bytes, sig, k)) throw new Error('signature does not match');
      W.verified = true; refresh(); H.toast('Signed in ✔'); return true;
    }).catch(function (e) { W.verified = false; refresh(); H.toast(rejected(e) ? 'Sign-in skipped. You can still play.' : 'Sign-in didn\'t check out.'); return false; });
  }
  var listened = [], unlisten = []; // unlisten: functions that remove our wallet event listeners (cleared on disconnect)
  function accountChanged(k) {
    if (!isKey(k)) return disconnect(false, 'Wallet disconnected');
    if (k !== W.pubkey) { W.pubkey = k; tokenBal = null; W.verified = false; W.pets = []; W.tryStarters = false; dropOwned(); H.toast('Switched to ' + short(k)); readBal(); loadPets(); }
  }
  function listen(x) {
    if (x.std) {
      if (listened.indexOf(x.std) >= 0) return; listened.push(x.std);
      try { var ev = x.std.features['standard:events']; if (ev && typeof ev.on === 'function') { var off = ev.on('change', function (props) {
        if (W.std !== x.std || !props || !props.accounts) return;
        var a = props.accounts[0]; if (!a) return disconnect(false, 'Wallet disconnected'); W.account = a; accountChanged(a.address);
      }); var sw = x.std; unlisten.push(function () { if (typeof off === 'function') off(); var i = listened.indexOf(sw); if (i >= 0) listened.splice(i, 1); }); } } catch (e) {}
      return;
    }
    var p = x.p; if (listened.indexOf(p) >= 0 || typeof p.on !== 'function') return; listened.push(p);
    var onDc = function () { if (W.provider === p && W.pubkey) disconnect(false, 'Wallet disconnected'); };
    var onAc = function (pk) { if (W.provider !== p) return; accountChanged(pk && (pk.toBase58 ? pk.toBase58() : String(pk))); };
    try { p.on('disconnect', onDc); } catch (e) {}
    try { p.on('accountChanged', onAc); } catch (e) {}
    unlisten.push(function () {
      var off = typeof p.off === 'function' ? 'off' : typeof p.removeListener === 'function' ? 'removeListener' : null;
      if (off) { try { p[off]('disconnect', onDc); } catch (e) {} try { p[off]('accountChanged', onAc); } catch (e) {} }
      var i = listened.indexOf(p); if (i >= 0) listened.splice(i, 1);
    });
  }
  function disconnect(user, msg) {
    var p = W.provider, sw = W.std; W.gen++;
    W.provider = null; W.std = null; W.account = null; W.pubkey = null; tokenBal = null; balGen++; W.kind = null; W.verified = false; W.pets = []; W.loading = false; W.error = null; W.soon = false; W.counts = {}; W.connecting = false; W.tryStarters = false; W.progressReady = false;
    if (user) clearSession(); // you chose to disconnect: forget this wallet fully, no quiet reconnect next time
    dropOwned(); refresh(); H.toast(msg || 'Disconnected');
    if (user && sw) { try { var dc = sw.features['standard:disconnect']; if (dc && typeof dc.disconnect === 'function') Promise.resolve(dc.disconnect()).catch(function () {}); } catch (e) {} }
    if (user && p && typeof p.disconnect === 'function') { try { Promise.resolve(p.disconnect()).catch(function () {}); } catch (e) {} }
    if (user) showRepick();
  }
  // Wallet session only. Progress (blup3ts.web.pets), looks, favorites and settings keys are NOT touched.
  function clearSession() {
    unlisten.splice(0).forEach(function (f) { try { f(); } catch (e) {} }); // drop our listeners on the old wallet
    clearTimeout(persistTimer); // no late progress push for the old address
    remember(null); // blup3ts.web.wallet: the auto-reconnect flag
    try { localStorage.removeItem('walletName'); } catch (e) {} // generic wallet-adapter auto-connect key, in case a future build adds the adapter
    W.found = 0; W.skipped = 0; W.lastConnect = 0;
    try { var u = new URL(location.href); if (u.searchParams.get('wallet') === '1') { u.searchParams.delete('wallet'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } } catch (e) {} // ?wallet=1 would auto-connect again on reload
  }

  // ---------- M13 'Add my own' (pet list + the Wallet mode buttons on the start and Balance screens) ----------
  function addOwnInfo() {
    var n = W.pets.length, phone = isMobile() && !providers().length;
    if (W.connecting) return { name: 'Connecting…', sub: 'Check your wallet app', busy: true };
    if (W.pubkey && W.loading) return { name: 'Checking…', sub: 'Looking for MNK3YS, ZMB3YS' + CAPO_S, busy: true };
    if (W.pubkey) return { name: 'Check my wallet', sub: W.error ? 'Tap to try again' : n ? n + ' found · MNK3YS, ZMB3YS' + CAPO_S : 'None found yet · MNK3YS, ZMB3YS' + CAPO_S, logo: LOGO[W.kind] };
    return { name: 'Add my own', sub: phone ? 'Open in Solflare · MNK3YS, ZMB3YS' + CAPO_S : 'Connect wallet · MNK3YS, ZMB3YS' + CAPO_S, logo: phone ? LOGO.solflare : null };
  }
  function addOwnTap() {
    if (W.connecting || W.loading) return;
    if (W.pubkey) { if (A.state().mode !== 'wallet') { A.setMode('wallet'); showOwned(); } return loadPets(); } // check again, right here
    onConnectClick(); // phone browser: sheet with Open in Solflare; in the wallet's own browser: connects in one tap
  }

  // ---------- home hooks ----------
  function modeNote() {
    if (W.connecting) return 'Connecting to your wallet…';
    if (!W.pubkey) return 'Wallet mode: connect Phantom, Solflare or Backpack to play with your own MNK3YS and ZMB3YS' + CAPO_L + '. Only your public address is shared.';
    if (W.loading) return 'Looking for your MNK3YS and ZMB3YS' + CAPO_L + '…';
    if (W.error) return W.error;
    return (W.verified ? '✔ Signed in · ' : 'Connected · ') + short(W.pubkey) + ' · ' + (W.pets.length ? W.pets.length + ' pet' + (W.pets.length === 1 ? '' : 's') + ' found' : 'no MNK3YS or ZMB3YS' + (CAPO_ON ? ' or Capo' : '') + ' found');
  }
  function walletIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wico'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    ['M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1', 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'].forEach(function (d) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('d', d);
      svg.appendChild(path);
    });
    return svg;
  }
  function fillWalletBtn(btn, label) { btn.textContent = ''; btn.appendChild(walletIcon()); btn.appendChild(document.createTextNode(label)); }
  function renderConnect(btn) {
    btn.classList.toggle('busy', !!W.connecting); btn.setAttribute('aria-busy', W.connecting ? 'true' : 'false');
    var label = W.connecting ? 'Connecting…' : W.pubkey ? short(W.pubkey) + ' · Disconnect' : 'Connect wallet';
    fillWalletBtn(btn, label);
    btn.setAttribute('aria-label', W.pubkey ? 'Disconnect wallet ' + short(W.pubkey) : 'Connect wallet'); renderBoostBtn(); }
  function syncClaim() {
    var b = $('blutestClaim'); if (!b || !C.TEST_PLAY) return;
    b.hidden = !(A.state && A.state().mode === 'wallet' && usingTest());
    paintClaim(); paintPlay();
  }
  function onMode(m) { if (m === 'wallet') { showOwned(); readBal(); } else { W.gen++; W.loading = false; tokenBal = null; dropOwned(); } syncClaim(); }
  // M11: phone, not connected: tapping Wallet goes straight to the connect step (one less tap). Desktop unchanged.
  function afterWalletMode() { if (!W.pubkey && !W.connecting && isMobile()) onConnectClick(); }
  // Starters are hidden while a wallet is connected (or quietly reconnecting) in Wallet mode, unless you tapped 'Try a starter pet'
  function hidingStarters() { return A.state().mode === 'wallet' && (!!W.pubkey || W.connecting) && !W.tryStarters; }
  function carouselExtra() {
    if (A.state().mode !== 'wallet') return null;
    if (W.pubkey && W.pets.length && !W.loading) return null;
    var busy = W.connecting || W.loading, empty = W.pubkey && !busy && !W.error && !W.soon;
    var c = el(empty ? 'div' : 'button', 'pcard addcard' + (busy ? ' busy' : '') + (empty ? ' emptycard' : '')); c.dataset.id = 'add';
    var art = el('div', 'pcart'); art.appendChild(busy ? el('div', 'spin') : BLUP3TS_BLU.text(el('div', 'pcfallback'), W.error ? '↻' : empty ? '🍌' : '👛')); c.appendChild(art);
    c.appendChild(el('div', 'pcname', W.connecting ? 'Connecting…' : W.loading ? 'Finding pets…' : W.soon ? 'Coming soon' : W.error ? 'Try again' : empty ? 'No pets found' : 'Your pets'));
    c.appendChild(el('div', 'pcsub', W.connecting ? 'Check your wallet app' : W.loading ? 'MNK3YS, ZMB3YS' + CAPO_S : W.soon ? 'NFT check coming soon' : W.error ? 'Reload your pets' : empty ? 'Not in this wallet yet' : 'Connect a wallet'));
    if (empty) {
      var row = el('div', 'emptyrow'), again = el('button', 'mini', '↻ Check again'), tryS = el('button', 'mini', W.tryStarters ? 'Hide starters' : 'Try a starter pet');
      again.id = 'checkAgain'; tryS.id = 'tryStarter';
      again.onclick = function () { A.play('tap'); loadPets(); };
      tryS.onclick = function () { A.play('tap'); W.tryStarters = !W.tryStarters; refresh(); };
      row.appendChild(again); row.appendChild(tryS); c.appendChild(row);
    } else if (!busy) c.onclick = function () { A.play('tap'); if (!W.pubkey) onConnectClick(); else loadPets(); };
    return c;
  }

  // ---------- real $BLUNANA feeding (ON when config REAL_PAYMENTS_ENABLED is true) ----------
  function payWord() { return usingTest() ? (C.TEST_TOKEN_SYMBOL || 'BLUTEST') : '$BLUNANA'; }
  var claimState = 'idle', claimTimer = null, claimMsg = '';
  function claimButtons() {
    var list = [];
    var home = $('blutestClaim'); if (home) list.push(home);
    document.querySelectorAll('[data-blutest-claim]').forEach(function (b) { list.push(b); });
    return list;
  }
  function claimLabel(b, text) {
    var label = b.querySelector('.blutest-label');
    if (label) label.textContent = text; else b.textContent = text;
  }
  function paintClaim() {
    claimButtons().forEach(function (b) {
      if (!b.querySelector('.blutest-label')) {
        var text = b.textContent; b.textContent = '';
        var m = el('span', 'blutest-mark'); m.setAttribute('aria-hidden', 'true');
        var lab = el('span', 'blutest-label'); lab.textContent = text;
        b.appendChild(m); b.appendChild(lab);
      }
      b.classList.toggle('is-busy', claimState === 'busy');
      b.classList.toggle('is-ok', claimState === 'ok');
      b.classList.toggle('is-bad', claimState === 'bad');
      var rich = !!W.pubkey && holdsEnough() && claimState === 'idle';
      var waiting = !!W.pubkey && tokenBal == null && claimState === 'idle' && livePlay();
      b.disabled = claimState === 'busy' || rich || waiting;
      b.setAttribute('aria-busy', claimState === 'busy' ? 'true' : 'false');
      if (claimState === 'busy') claimLabel(b, 'Sending ' + payWord() + '…');
      else if (claimState === 'ok') claimLabel(b, '100,000 ' + payWord() + ' sent');
      else if (claimState === 'bad') claimLabel(b, claimMsg || 'Claim failed');
      else if (waiting) claimLabel(b, 'Checking ' + payWord() + '…');
      else if (rich) claimLabel(b, 'You already have 10,000+ ' + payWord());
      else claimLabel(b, (W.pubkey ? 'Get 100,000 ' : 'Connect wallet to get 100,000 ') + payWord());
    });
  }
  function claimTest() {
    if (!W.pubkey) return H.toast('Connect your wallet first');
    if (claimState === 'busy' || holdsEnough()) return;
    claimState = 'busy'; clearTimeout(claimTimer); paintClaim();
    fetch('/api/blup3ts-claim', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ wallet: W.pubkey }), cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        claimState = x.ok ? 'ok' : 'bad';
        claimMsg = x.ok ? '' : ((x.j && x.j.message) || 'Claim failed');
        paintClaim(); if (x.ok) readBal();
      })
      .catch(function () { claimState = 'bad'; claimMsg = 'Claim failed'; paintClaim(); })
      .then(function () { claimTimer = setTimeout(function () { claimState = 'idle'; paintClaim(); }, 5000); });
  }
  function feedCost(f) { return SOL && f ? SOL.realTierCost(C, f.id) : (f ? f.cost : 0); }
  function feedLocked(f) {
    if (!W.pubkey) return false;
    if (!realOn() || !isKey(A.petDef().mint) || tokenBal == null) return true;
    return tokenBal < feedCost(f);
  }
  function payFeed(pd, f) {
    if (!W.pubkey) return onConnectClick();
    if (!realOn()) return H.toast('Test token feeding is not ready.');
    if (!isKey(pd && pd.mint)) return H.toast('Pick one of your own pets to feed with ' + payWord() + '.');
    if (tokenBal == null) return H.toast('Checking your ' + payWord() + ' balance…');
    if (tokenBal < feedCost(f)) return H.toast('Not enough ' + payWord() + '.');
    confirmFeed(pd, f);
  }
  function feedNote() {
    var box = el('div', 'realfeed'), word = payWord(), line = el('p', 'rfnote');
    if (!W.pubkey) line.textContent = 'Connect your wallet. Each feed sends ' + word + ' and your wallet asks you to approve.';
    else if (!isKey(A.petDef().mint)) line.textContent = 'Pick one of your own pets. Feeding sends ' + word + ' from your wallet.';
    else line.textContent = word + ' balance: ' + (tokenBal == null ? '…' : A.fmt(tokenBal)) + '. A feed opens your wallet.' + (usingTest() ? ' It is not $BLUNANA.' : ' It goes to the community wallet.');
    box.appendChild(line);
    if (usingTest()) {
      var claim = el('button', 'food'); claim.setAttribute('data-blutest-claim', '1');
      claim.onclick = function () { A.play('tap'); if (claim.disabled) return; if (!W.pubkey) onConnectClick(); else claimTest(); };
      box.appendChild(claim);
    }
    return box;
  }
  function realFeedSection(pd, foods) {
    if (!payOn()) return document.createDocumentFragment(); // M13: real payments are fully hidden from players while REAL_PAYMENTS_ENABLED is false
    var box = el('div', 'realfeed'), word = payWord();
    box.appendChild(el('div', 'rfhead', usingTest() ? 'Test token · ' + word : 'Real $BLUNANA'));
    if (usingTest()) { var claim = el('button', 'food'); claim.setAttribute('data-blutest-claim', '1'); claim.onclick = function () { A.play('tap'); if (claimState === 'busy') return; if (!W.pubkey) onConnectClick(); else claimTest(); }; box.appendChild(claim); paintClaim(); }
    if (!realOn()) { var b = el('button', 'food rfoff', '🍌 Real feeding coming soon'); b.disabled = true; box.appendChild(b); box.appendChild(el('p', 'rfnote', 'Pretend feeding works now.')); return box; }
    if (!W.pubkey || !pd.owned) { box.appendChild(el('p', 'rfnote', W.pubkey ? 'Pick one of your own pets to feed it ' + word + '.' : 'Connect your wallet to feed with ' + word + '.')); return box; }
    box.appendChild(el('p', 'rfnote', usingTest() ? word + ' is a test token. It is not $BLUNANA and has no value. A feed sends it to the test reserve.' : 'Feeding sends real $BLUNANA to the community wallet. It goes back into pets, styles, features and events.'));
    foods.forEach(function (f) { var b = el('button', 'food rf', f.tier + ' · ' + A.fmt(SOL.realTierCost(C, f.id)) + ' ' + word); if (f.trial) b.appendChild(el('i', 'tryit', 'Try it')); b.onclick = function () { confirmFeed(pd, f); }; box.appendChild(b); });
    return box;
  }
  function confirmFeed(pd, f) {
    A.hideOverlays();
    var go = el('button', 'sbtn primary', 'Continue in wallet'), no = el('button', 'sbtn', 'Cancel'), word = payWord(), amt = A.fmt(SOL.realTierCost(C, f.id));
    no.onclick = H.closeSheet; go.onclick = function () { go.disabled = true; H.closeSheet(); sendFeed(pd, f); };
    var lines = usingTest()
      ? [H.p('This sends ' + amt + ' ' + word + ' to the test reserve. Your wallet will ask you to approve.'), H.p(word + ' is not $BLUNANA. It was made for this preview and has no value.'), H.p('Solana also charges a tiny network fee in SOL.'), go, no]
      : [H.p('Feeding costs ' + amt + ' $BLUNANA. It goes to the MNK3YLabs community wallet.'), H.p('Every $BLUNANA spent in BLUP3TS goes back into building the $BLUNANA and MNK3YLabs ecosystems: new pets, styles, features and community events.'), H.p('Your wallet will show the same amount before you approve. Solana also charges a tiny network fee in SOL.'), el('p', 'muted', 'This is a game, not an investment.'), go, no];
    H.openSheet(f.tier + ' for ' + pd.name, lines);
  }
  function stdAccount() {
    var list = (W.std && W.std.accounts) || [], hit = null;
    list.forEach(function (a) { if (!hit && a && a.address === W.pubkey) hit = a; });
    return hit || (W.account && W.account.address === W.pubkey ? W.account : null) || list[0] || null;
  }
  function sigText(res) {
    var out = Array.isArray(res) ? res[0] : res, sig = out && (out.signature || out);
    if (sig && sig.signature) sig = sig.signature;
    if (typeof sig === 'string' && B58.test(sig.slice(0, 44))) return sig;
    if (sig && typeof sig.length === 'number') { var s = SOL.bs58encode(sig instanceof Uint8Array ? sig : Uint8Array.from(sig)); if (typeof s === 'string' && B58.test(s.slice(0, 44))) return s; }
    throw new Error('no signature');
  }
  function walletSend(tx) {
    var std = W.std, feat = std && std.features && std.features['solana:signAndSendTransaction'];
    var fn = feat && (typeof feat === 'function' ? feat : feat.signAndSendTransaction);
    if (typeof fn === 'function') {
      var account = stdAccount(); if (!account) throw new Error('Reconnect your wallet');
      var raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      return Promise.resolve(fn.call(feat, { account: account, chain: 'solana:mainnet', transaction: new Uint8Array(raw) })).then(sigText);
    }
    var p = W.provider;
    if (p && typeof p.signAndSendTransaction === 'function') return Promise.resolve(p.signAndSendTransaction(tx)).then(sigText);
    throw new Error('wallet can\'t send');
  }
  function noteFeed(pd, f, sig) {
    var LA = window.BLUP3TS_LBAUTH, rec = { sig: sig, wallet: W.pubkey, petId: pd.id, tier: f.id, token: usingTest() ? 'test' : 'blunana', name: pd.name, collection: pd.collection, number: pd.number };
    if (LA && LA.enabled) { LA.noteFeed(rec); return; } // ranks security ON: the tx signature is checked on chain by the server before it counts
    fetch('/api/blup3ts-feeds', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        wallet: W.pubkey, petId: pd.id, tier: f.id, token: usingTest() ? 'test' : 'blunana',
        name: pd.name, collection: pd.collection, number: pd.number, signature: sig
      }),
      keepalive: true, cache: 'no-store'
    }).catch(function () {});
  }
  function sendFeed(pd, f) {
    var payer = W.pubkey; if (!payOn() || !payer || !realOn()) { H.toast('Feeding is not ready.'); return Promise.resolve(false); }
    if (!SOL.TIERS || (C.FEED_COSTS || {})[f.id] !== SOL.TIERS[f.id] || SOL.tierCost(C, f.id) !== f.cost || !(SOL.realTierCost(C, f.id) >= 1)) { H.toast('Feeding is paused: amounts don\'t match.'); return Promise.resolve(false); }
    var conn = new SOL.Connection(C.RPC_URL, 'confirmed'), sig;
    H.toast('Getting it ready…');
    var cfg = payCfg();
    return SOL.buildFeedTx({ cfg: cfg, connection: conn, payer: payer, tier: f.id, petMint: pd.mint }).then(function (tx) {
      SOL.verifyFeedTx(tx, { cfg: cfg, payer: payer, tier: f.id, petMint: pd.mint }); // checked again right before the wallet sees it
      return walletSend(tx);
    }).then(function (r) {
      sig = r; if (typeof sig !== 'string' || !B58.test(sig.slice(0, 44))) throw new Error('no signature');
      H.toast('Waiting for Solana…');
      return waitConfirmed(sig);
    }).then(function () {
      if (W.pubkey !== payer) return false;
      if (!A.setActive(pd.id) && A.petDef().id !== pd.id) return false;
      var ate = A.feedReal(f);
      if (ate) { readBal(); noteFeed(pd, f, sig); }
      return ate;
    }).catch(function (e) { H.toast(rejected(e) ? 'Cancelled. Nothing was sent.' : 'Feeding didn\'t go through: ' + txt(e && e.message, 60)); return false; });
  }
  function waitConfirmed(sig) {
    var t0 = Date.now();
    return (function poll() {
      return rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: false }]).then(function (r) {
        var s = r && r.value && r.value[0];
        if (s && s.err) throw new Error('failed on Solana');
        if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) return true;
        if (Date.now() - t0 > 60000) throw new Error('not confirmed yet');
        return new Promise(function (ok) { setTimeout(ok, 1500); }).then(poll);
      });
    })();
  }

  // ---------- cNFT burn for a game boost (OFF) ----------
  function renderBoostBtn() {
    var b = $('boostBtn'); if (!b) return;
    var on = A.state().mode === 'wallet' && payOn() && C.TEST_PLAY !== true; b.hidden = !on; if (!on) return; // test-token play does not offer the cNFT burn
    var why = BOOST && payOn() ? BOOST.blockReason(A.petDef().id, null) : 'Coming soon';
    b.disabled = !!why || !W.pubkey; b.setAttribute('aria-disabled', b.disabled ? 'true' : 'false');
    b.textContent = '✨ Burn cNFT for a boost' + (why ? ' · ' + why : !W.pubkey ? ' · connect first' : '');
  }
  function listCnfts() {
    var coll = C.BLUNANA_CNFT_COLLECTION;
    return rpc('getAssetsByOwner', { ownerAddress: W.pubkey, page: 1, limit: 1000 }).then(function (r) {
      return ((r && r.items) || []).filter(function (a) { var g = (a.grouping || []).filter(function (x) { return x.group_key === 'collection'; });
        return a.compression && a.compression.compressed === true && !a.burnt && a.ownership && a.ownership.owner === W.pubkey && g.length === 1 && g[0].group_value === coll; }).slice(0, 50);
    });
  }
  function openBoost() {
    if (!payOn() || !BOOST || !BOOST.enabled() || !W.pubkey) return;
    var pd = A.petDef(), why = BOOST.blockReason(pd.id, null); if (why) return H.toast(why);
    listCnfts().then(function (list) {
      if (!list.length) return H.toast('No NFTs from that collection in this wallet');
      var nodes = [H.p('Pick one to use up for a game boost for ' + pd.name + ': +' + BOOST.rules.hunger + ' hunger, +' + BOOST.rules.mood + ' mood and 1.5x XP for ' + BOOST.rules.minutes + ' minutes.')];
      list.forEach(function (a) {
        var b = el('button', 'sbtn', txt(a.content && a.content.metadata && a.content.metadata.name, 32) || short(a.id));
        b.onclick = function () { confirmBurn(pd, a); }; nodes.push(b);
      });
      H.openSheet('Game boost', nodes);
    }).catch(function (e) { H.toast(friendly(e)); });
  }
  function confirmBurn(pd, a) {
    var nm = txt(a.content && a.content.metadata && a.content.metadata.name, 32) || short(a.id), img = safeImg(a.content && a.content.links && a.content.links.image);
    var nodes = [];
    if (img) { var im = el('img', 'burnimg'); im.alt = nm; im.src = img; nodes.push(im); }
    nodes.push(el('p', null, nm)); nodes.push(H.p('This NFT will be gone forever. The boost is just for the game: more food, mood and XP for a while.'));
    var go = el('button', 'sbtn primary', 'Burn it for the boost'), no = el('button', 'sbtn', 'Keep it');
    no.onclick = H.closeSheet; go.onclick = function () { go.disabled = true; H.closeSheet(); burn(pd, a.id); };
    nodes.push(go, no); H.openSheet('Are you sure?', nodes);
  }
  function burn(pd, assetId) {
    var owner = W.pubkey, p = W.provider, coll = C.BLUNANA_CNFT_COLLECTION, asset, proof, sig;
    if (!payOn() || !p || BOOST.blockReason(pd.id, assetId)) return Promise.resolve(false);
    return Promise.all([rpc('getAsset', { id: assetId }), rpc('getAssetProof', { id: assetId })]).then(function (r) {
      asset = r[0]; proof = r[1];
      return new SOL.Connection(C.RPC_URL, 'confirmed').getLatestBlockhash('confirmed');
    }).then(function (bh) {
      var tx = SOL.buildBurnTx({ asset: asset, proof: proof, owner: owner, collection: coll }, bh.blockhash);
      SOL.verifyBurnTx(tx, { asset: asset, proof: proof, owner: owner });
      return p.signAndSendTransaction(tx);
    }).then(function (r) { sig = r && (r.signature || r); return waitConfirmed(sig); })
      .then(function () { return rpc('getAsset', { id: assetId }); })
      .then(function (after) {
        var g = (after && after.grouping || []).filter(function (x) { return x.group_key === 'collection'; });
        BOOST.apply(pd.id, assetId, A.petState(pd.id), { confirmed: true, burnt: after && after.burnt === true, collection: g.length === 1 ? g[0].group_value : null, assetId: after && after.id, ownerOk: asset.ownership.owner === owner });
        A.save(); A.render(); refresh(); H.toast('Boost on! ✨'); return true;
      }).catch(function (e) { H.toast(rejected(e) ? 'Cancelled. Nothing was burned.' : 'Boost didn\'t go through: ' + txt(e && e.message, 60)); return false; });
  }
  if ($('boostBtn')) $('boostBtn').onclick = function () { if (!this.disabled) openBoost(); };
  if ($('blutestClaim')) $('blutestClaim').onclick = function () { A.play('tap'); if (claimState === 'busy') return; if (!W.pubkey) onConnectClick(); else claimTest(); };
  syncClaim();

  // ---------- FACE UNLOCKS (preview): the feed payment path (payCfg -> same reserve + mint, same 2-3 instructions,
  // checked again before the wallet sees it, walletSend, waitConfirmed), with the face amount and its OWN memo.
  // SOL.buildFeedTx can't be reused as is: its amount comes only from the 4 feed tiers and its memo must match
  // SOL.MEMO_RE (blup3ts:feed:v2:<tier>:<petMint>). A face unlock uses 'blup3ts:face:<id>' so it is never counted as a feed.
  var FACE_MEMO_RE = /^blup3ts:face:f_[a-z]{2,24}$/, MEMO_PROG = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', SYS_PROG = '11111111111111111111111111111111';
  function faceMemo(id) { var m = 'blup3ts:face:' + id; if (!FACE_MEMO_RE.test(m)) throw new Error('bad memo'); return m; }
  function faceAmount(id) { var pr = (C.FACE_PRICES || {})[id]; if (C.FACE_UNLOCKS_ENABLED !== true || !Number.isInteger(pr) || pr <= 0) throw new Error('not for sale'); return SOL.realCost(pr, C); }
  function ataOf(owner, mint) { var P = SOL.PublicKey; return P.findProgramAddressSync([owner.toBytes(), new P(TOKEN_PROG).toBytes(), mint.toBytes()], new P(ATA_PROG))[0]; }
  function faceUnits(amt) { return BigInt(amt) * BigInt(10) ** BigInt(6); }
  // ---------- FACE SOL FEE (preview, Azgog Nov 2 2026 1:37/1:38 AM AT): same small SOL fee as feeds (0.05 USD worth of SOL, set on the server).
  // The SERVER turns USD into lamports from the live SOL price (FACE_SOL_FEE_QUOTE_ENDPOINT). The client never works out a price:
  // it only uses the lamports the server gives, inside a sanity range. REAL $BLUNANA unlocks only (BLUTEST: no SOL fee).
  // FAIL CLOSED: no quote (no endpoint, price unavailable, bad or expired answer) = the paid unlock is blocked and no tx is sent.
  // Switch: FACE_SOL_FEE_ENABLED. Recipient: SOL_FEE_RECIPIENT, the community wallet (Azgog, Nov 2 2:31 AM AT), also planned for the feed SOL fee.
  function feeRecipient() { var r = C.SOL_FEE_RECIPIENT; return isKey(r) ? r : null; }
  function faceFeeOn() { return C.FACE_SOL_FEE_ENABLED === true && !usingTest(); } // Nov 3: paid $BLUNANA face unlocks KEEP the 5-cent SOL fee (the no-SOL-fee rule is for the new Store items only) // real $BLUNANA only. On + no recipient/quote = blocked, never free
  function goodQuote(q) {
    var lo = C.SOL_FEE_MIN_LAMPORTS || 1000, hi = C.SOL_FEE_MAX_LAMPORTS || 5000000;
    return !!q && Number.isInteger(q.lamports) && q.lamports >= lo && q.lamports <= hi && q.recipient === feeRecipient() && (!q.expiresAt || Date.parse(q.expiresAt) > Date.now());
  }
  function faceFeeQuote(id) { // resolves { lamports, recipient, quoteId, expiresAt } or null (= no fee this time)
    if (!faceFeeOn() || !W.pubkey) return Promise.resolve(null);
    var get = function () {
      var ep = C.FACE_SOL_FEE_QUOTE_ENDPOINT; if (typeof ep !== 'string' || !/^\/api\/[\w\/-]+$/.test(ep)) return Promise.resolve(null);
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, 5000) : 0;
      return fetch(ep + '?faceId=' + encodeURIComponent(id) + '&wallet=' + encodeURIComponent(W.pubkey), { headers: { accept: 'application/json' }, cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; });
    };
    return get().then(function (q) { return q && q.ok !== false && goodQuote(q) ? { lamports: q.lamports, recipient: q.recipient, quoteId: q.quoteId || null, expiresAt: q.expiresAt || null } : null; }).catch(function () { return null; });
  }
  function solExact(l) { var s = String(l); while (s.length < 10) s = '0' + s; var w = s.slice(0, -9), f = s.slice(-9).replace(/0+$/, ''); return f ? w + '.' + f : w; } // exact lamports -> SOL text, no rounding
  function buildFaceTx(o) { // o: { cfg, connection, payer, id, fee } (fee = server quote or null)
    var P = SOL.PublicKey, cfg = o.cfg, owner = new P(o.payer), mint = new P(cfg.BLUNANA_MINT), res = new P(cfg.RESERVE_WALLET);
    if (owner.equals(res)) throw new Error('payer is the reserve'); if (cfg.BLUNANA_DECIMALS !== 6) throw new Error('decimals must be 6');
    if (!P.isOnCurve(owner.toBytes())) throw new Error('bad payer'); // same rule as the feed (payer token account, owner on curve)
    var from = ataOf(owner, mint), to = ataOf(res, mint), units = faceUnits(faceAmount(o.id)), memo = faceMemo(o.id);
    return o.connection.getAccountInfo(to).then(function (info) {
      return o.connection.getLatestBlockhash('confirmed').then(function (bh) {
        var tx = new SOL.Transaction({ feePayer: owner, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
        if (!info) tx.add({ programId: new P(ATA_PROG), data: Uint8Array.of(1), keys: [{ pubkey: owner, isSigner: true, isWritable: true }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: res, isSigner: false, isWritable: false }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: new P(SYS_PROG), isSigner: false, isWritable: false }, { pubkey: new P(TOKEN_PROG), isSigner: false, isWritable: false }] });
        var d = new Uint8Array(10), x = units; d[0] = 12; for (var i = 1; i <= 8; i++) { d[i] = Number(x & BigInt(255)); x = x >> BigInt(8); } d[9] = 6;
        tx.add({ programId: new P(TOKEN_PROG), data: d, keys: [{ pubkey: from, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: owner, isSigner: true, isWritable: false }] });
        if (o.fee) tx.add(feeIx(owner, o.fee)); // small SOL fee: lamports exactly as the server quoted
        tx.add({ programId: new P(MEMO_PROG), data: new TextEncoder().encode(memo), keys: [{ pubkey: owner, isSigner: true, isWritable: false }] });
        verifyFaceTx(tx, o); return tx;
      });
    });
  }
  function feeIx(owner, fee) { // SystemProgram transfer: u32 LE 2 + u64 LE lamports
    var P = SOL.PublicKey, d = new Uint8Array(12), x = BigInt(fee.lamports); d[0] = 2;
    for (var i = 4; i < 12; i++) { d[i] = Number(x & BigInt(255)); x = x >> BigInt(8); }
    return { programId: new P(SYS_PROG), data: d, keys: [{ pubkey: owner, isSigner: true, isWritable: true }, { pubkey: new P(fee.recipient), isSigner: false, isWritable: true }] };
  }
  function verifyFaceTx(tx, o) { // same checks as SOL.verifyFeedTx, for the face amount + memo
    var P = SOL.PublicKey, cfg = o.cfg, owner = new P(o.payer), mint = new P(cfg.BLUNANA_MINT), res = new P(cfg.RESERVE_WALLET), from = ataOf(owner, mint), to = ataOf(res, mint);
    var bad = function (w) { throw new Error('face check failed: ' + w); }, R = tx.instructions, k0 = 0, memo = faceMemo(o.id), units = faceUnits(faceAmount(o.id));
    if (!usingTest() && (cfg.RESERVE_WALLET !== C.BLUNANA_RESERVE_WALLET || cfg.BLUNANA_MINT !== C.REAL_BLUNANA_MINT)) bad('real reserve');
    if (!tx.feePayer || !tx.feePayer.equals(owner)) bad('fee payer'); var hasFee = !!o.fee, nIx = 2 + (hasFee ? 1 : 0); if (R.length !== nIx && R.length !== nIx + 1) bad('instruction count');
    if (hasFee && !goodQuote(o.fee)) bad('fee quote');
    if (hasFee && usingTest()) bad('no SOL fee on test token'); if (!hasFee && faceFeeOn()) bad('fee missing'); // real $BLUNANA + switch on = fee required
    if (R.length === nIx + 1) { var a = R[0]; if (!a.programId.equals(new P(ATA_PROG)) || a.data.length !== 1 || a.data[0] !== 1) bad('ata ix'); if (!a.keys[1].pubkey.equals(to) || !a.keys[2].pubkey.equals(res) || !a.keys[3].pubkey.equals(mint)) bad('ata accounts'); k0 = 1; }
    var t = R[k0], dd = t.data, n = BigInt(0); if (!t.programId.equals(new P(TOKEN_PROG))) bad('token program'); if (dd.length !== 10 || dd[0] !== 12) bad('not TransferChecked');
    for (var i = 8; i >= 1; i--) n = (n << BigInt(8)) | BigInt(dd[i]); if (n !== units) bad('amount'); if (dd[9] !== 6) bad('decimals');
    if (!t.keys[0].pubkey.equals(from) || !t.keys[1].pubkey.equals(mint) || !t.keys[2].pubkey.equals(to) || !t.keys[3].pubkey.equals(owner) || !t.keys[3].isSigner) bad('accounts');
    var fl = null; if (hasFee) { var f = R[k0 + 1], fd = f.data; fl = BigInt(0); // fee: System transfer, exact quoted lamports, to the fee recipient, from the payer
      if (!f.programId.equals(new P(SYS_PROG)) || fd.length !== 12 || fd[0] !== 2 || fd[1] || fd[2] || fd[3]) bad('fee ix');
      for (var j = 11; j >= 4; j--) fl = (fl << BigInt(8)) | BigInt(fd[j]); if (fl !== BigInt(o.fee.lamports)) bad('fee amount');
      if (f.keys.length !== 2 || !f.keys[0].pubkey.equals(owner) || !f.keys[0].isSigner || f.keys[1].pubkey.toBase58() !== feeRecipient()) bad('fee recipient'); k0++; }
    if (R.some(function (x, i) { return x.programId.equals(new P(SYS_PROG)) && !(hasFee && i === k0); })) bad('extra SOL transfer'); // no fee quote = no SOL transfer at all
    var m = R[k0 + 1]; if (!m.programId.equals(new P(MEMO_PROG)) || new TextDecoder().decode(m.data) !== memo) bad('memo');
    return { amountUnits: n, to: to.toBase58(), toOwner: res.toBase58(), mint: mint.toBase58(), memo: memo, feeLamports: fl == null ? null : fl.toString(), feeTo: hasFee ? feeRecipient() : null };
  }
  function faceReady() { return payOn() && !!W.pubkey && realOn(); }
  function payFace(id, fee) { // fee = the quote shown on the confirm sheet (or null). resolves { sig, wallet, token, amount, memo } or false. Never touches the pretend balance.
    var payer = W.pubkey, amt; if (!faceReady()) { H.toast('Unlocking with ' + payWord() + ' is not ready yet.'); return Promise.resolve(false); }
    try { amt = faceAmount(id); } catch (e) { H.toast('This face is not ready yet.'); return Promise.resolve(false); }
    if (!usingTest() && C.PAID_FACE_REAL_UNLOCKS_ENABLED !== true) { H.toast('Unlocking with $BLUNANA is coming soon 🔒'); return Promise.resolve(false); } // real $BLUNANA unlocks paused until the dev's SOL quote endpoint exists (they keep the 5-cent SOL fee)
    if (faceFeeOn() && !goodQuote(fee)) { H.toast('Price unavailable, try again shortly'); return Promise.resolve(false); } // fail closed: no tx
    var bal = tokenBal;
    if (bal != null && bal < amt) { H.toast('You need ' + A.fmt(amt - bal) + ' more ' + payWord() + ' for this face.'); return Promise.resolve(false); }
    var cfg = payCfg(), conn = new SOL.Connection(C.RPC_URL, 'confirmed'), send = walletSend, confirm = waitConfirmed, sig, o = { cfg: cfg, connection: conn, payer: payer, id: id, fee: faceFeeOn() ? fee : null };
    H.toast('Getting it ready…');
    return buildFaceTx(o).then(function (tx) {
      var chk = verifyFaceTx(tx, o); // checked again right before the wallet sees it
      return send(tx);
    }).then(function (r) {
      sig = r; if (typeof sig !== 'string' || !B58.test(sig.slice(0, 44))) throw new Error('no signature');
      H.toast('Waiting for Solana…'); return confirm(sig);
    }).then(function () {
      if (W.pubkey !== payer) return false; readBal();
      return { sig: sig, wallet: payer, token: usingTest() ? 'test' : 'blunana', amount: amt, memo: faceMemo(id), feeLamports: o.fee ? o.fee.lamports : 0, quoteId: o.fee ? o.fee.quoteId : null };
    }).catch(function (e) { H.toast(rejected(e) ? 'Cancelled. Nothing was sent.' : 'The unlock didn\'t go through: ' + txt(e && e.message, 60)); return false; });
  }
  window.BLUP3TS_WALLET = { addOwnInfo: addOwnInfo, addOwnTap: addOwnTap, afterWalletMode: afterWalletMode, modeNote: modeNote, renderConnect: renderConnect, onMode: onMode, onConnectClick: onConnectClick, carouselExtra: carouselExtra,
    playToken: playKind, setPlayToken: setPlayKind, payWord: payWord, livePlay: livePlay,
    state: function () { return W; }, signIn: signIn, reload: loadPets, disconnect: function () { disconnect(true); }, realOn: realOn, boost: BOOST, persist: persist,
    // helpers for empire_store.js ($EMPIRE feeds, Store, free unlock SOL fee): same wallet send / confirm path as the feeds
    pay: { send: function (tx) { return walletSend(tx); }, confirm: function (s) { return waitConfirmed(s); }, ataOf: function (o, m) { return ataOf(o, m); }, realOn: realOn, payOn: payOn, isKey: isKey,
      rejected: function (e) { return rejected(e); }, txt: txt, readBal: function () { readBal(); }, feeRecipient: feeRecipient,
      PROG: { TOKEN: TOKEN_PROG, ATA: ATA_PROG, MEMO: MEMO_PROG, SYS: SYS_PROG } },
    payFace: payFace, faceReady: faceReady, faceFeeOn: faceFeeOn, faceFeeQuote: faceFeeQuote, solExact: solExact, faceAmount: function (id) { try { return faceAmount(id); } catch (e) { return null; } }, tokenBalance: function () { return tokenBal; },
    _test: { petOf: petOf, safeImg: safeImg, txt: txt, siwsMessage: siwsMessage, providers: providers, buildFaceTx: buildFaceTx, verifyFaceTx: verifyFaceTx, faceMemo: faceMemo, payCfg: payCfg } };
  A.realFeedSection = realFeedSection;
  A.paintPlay = paintPlay; A.paintClaim = paintClaim; A.refreshToken = readBal; A.payFeed = payFeed; A.feedCost = feedCost; A.feedLocked = feedLocked; A.feedNote = feedNote;
  A.livePlay = livePlay; A.payWord = payWord; A.playToken = playKind;
  var prevReset = A.onReset; A.onReset = function () { if (BOOST) BOOST.reset(); if (prevReset) prevReset(); renderBoostBtn(); };
  if (A.setStarterFilter) A.setStarterFilter(hidingStarters);
  H.renderMode();
  renderBoostBtn();
  // M11 auto-connect: opened from 'Open in Solflare' (?wallet=1) -> connect once the wallet shows up (that is the one tap: approve in Solflare).
  // Connected here before (remembered flag) -> quiet reconnect, no popup; if the wallet says no, you just see Connect.
  (function autoConnect() {
    var deep = fromDeepLink(), rem = remembered(); if (!deep && !rem) return;
    if (!deep && A.state().mode !== 'wallet') return; // you picked Pretend last time: leave it
    if (deep && A.state().mode !== 'wallet') A.setMode('wallet');
    var tries = 0; W.connecting = true; refresh(); // 'Connecting…' card right away, no flash of starter pets
    (function look() {
      if (W.pubkey) return;
      var list = providers(), pick = list.filter(function (x) { return x.kind === rem; })[0] || (list.length === 1 || deep ? list[0] : null);
      if (pick) { W.connecting = false; return connect(pick, !deep && !!rem); }
      if (++tries < 12) return setTimeout(look, 150); // wallets can register a moment after the page loads
      W.connecting = false; refresh();
    })();
  })();
})();
