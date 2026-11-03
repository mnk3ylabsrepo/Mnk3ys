// BLUP3TS $EMPIRE feeds + Store + free unlock SOL fee (Azgog via COS, Nov 3 2026). PREVIEW: every real path is behind a flag.
// - $EMPIRE feeds (EMPIRE_FEEDS_ENABLED, default false): Capo pets only. The size of each meal matches the $BLUNANA feed
//   value from a LIVE server quote (EMPIRE_QUOTE_ENDPOINT). The browser never works out an amount itself. No quote = no feed.
// - Store (STORE_ENABLED; real buys STORE_REAL_BUYS_ENABLED, default false): one-time buys per connected wallet. Paid items
//   have NO SOL fee. Capo items are for Capo pets only. Items: faces (watch cases) and charms (hang on the top band).
// - Free unlock SOL fee (FREE_UNLOCK_SOL_FEE_ENABLED, default false): once per wallet, about 10 US cents of SOL, amount from the server
//   quote (FREE_UNLOCK_FEE_QUOTE_ENDPOINT, lamports). BLUP3TS Classic is always free. Pretend mode pays nothing.
// Every payment: confirm sheet first, one TransferChecked (or one SOL transfer) + memo, checked before the wallet sees it.
// Ownership is kept in localStorage for now; the real record is the dev's server (HANDOFF.md, docs/API_EMPIRE_STORE.md).
(function () {
  'use strict';
  var C = window.BLUP3TS_CONFIG || {}, A = window.BLUP3TS_APP, H = window.BLUP3TS_HOME, SOL = window.BLUP3TS_SOL;
  if (!A || !H) return;
  var CAPO = 'Caporegime Del $Empire', E = C.EMPIRE || {}, B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, conn = null, nowOverride = null;
  function now() { return typeof nowOverride === 'number' ? nowOverride : Date.now(); }
  function WL() { return window.BLUP3TS_WALLET || null; }
  function PAY() { var w = WL(); return w && w.pay; }
  function walletMode() { return A.state().mode === 'wallet'; }
  function capoSoon(it) { return walletMode() && C.CAPO_WALLET_ENABLED !== true && !!it && it.collection === CAPO; } // CAPO_WALLET_ENABLED false: Capo Store items say 'Coming soon' in Wallet mode
  function owner() { if (!walletMode()) return null; var w = WL(), s = w && w.state && w.state(); return s && B58.test(s.pubkey || '') ? s.pubkey : null; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function toast(t) { (H && H.toast && H.view && H.view() !== 'game' ? H.toast : A.toast)(t); } // the toast the player can see right now
  function fmt(n) { return A.fmt ? A.fmt(n) : String(n); }
  function connection() { return conn || new SOL.Connection(C.RPC_URL, 'confirmed'); }
  function load(k) { try { var v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var PRICE_NA = 'Price unavailable, try again shortly';

  // ---------- quotes from the dev's server (fail closed) ----------
  function getJSON(ep, q) {
    if (typeof ep !== 'string' || !/^\/api\/[\w\/-]+$/.test(ep) || !window.fetch) return Promise.resolve(null);
    var qs = Object.keys(q).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, 6000) : 0;
    return fetch(ep + '?' + qs, { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function freshQuote(q) { var x = +q.expiresAt; return isFinite(x) && x > now() + 5000 && x < now() + 15 * 60000 && typeof q.quoteId === 'string' && /^[\w-]{6,64}$/.test(q.quoteId); }
  function empireCost(tier) { return SOL && SOL.realTierCost ? SOL.realTierCost(C, tier) : null; } // the $BLUNANA feed value the meal must match
  function goodEmpireQuote(q, tier) {
    return !!q && q.ok === true && q.tier === tier && q.mint === E.mint && q.recipient === E.recipient && q.decimals === E.decimals &&
      typeof q.units === 'string' && /^[1-9]\d{0,17}$/.test(q.units) && q.blunana === empireCost(tier) && freshQuote(q);
  }
  function empireQuote(tier) { var o = owner(); return getJSON(C.EMPIRE_QUOTE_ENDPOINT, { tier: tier, wallet: o || '' }).then(function (q) { return goodEmpireQuote(q, tier) ? q : null; }); }
  function goodSolQuote(q, item) {
    var lo = C.SOL_FEE_MIN_LAMPORTS || 1000, hi = C.SOL_FEE_MAX_LAMPORTS || 5000000;
    return !!q && q.ok === true && q.item === item && Number.isInteger(q.lamports) && q.lamports >= lo && q.lamports <= hi && q.recipient === C.SOL_FEE_RECIPIENT && B58.test(q.recipient || '') && freshQuote(q);
  }
  function unitsText(units, dec) { var s = String(units); while (s.length <= dec) s = '0' + s; var w = s.slice(0, -dec), f = s.slice(-dec).replace(/0+$/, ''); return Number(w).toLocaleString('en-US') + (f ? '.' + f : ''); }
  function solText(l) { var w = WL(); return w && w.solExact ? w.solExact(l) : String(l / 1e9); }

  // ---------- transactions (built here, checked before the wallet sees them) ----------
  function u64(d, at, x) { for (var i = 0; i < 8; i++) { d[at + i] = Number(x & BigInt(255)); x = x >> BigInt(8); } }
  function buildTokenTx(o) { // o: { payer, mint, decimals, units (BigInt), to (recipient owner), memo }
    var P = SOL.PublicKey, G = PAY().PROG, owner_ = new P(o.payer), mint = new P(o.mint), res = new P(o.to), from = PAY().ataOf(owner_, mint), to = PAY().ataOf(res, mint);
    if (owner_.equals(res)) throw new Error('payer is the recipient'); if (!P.isOnCurve(owner_.toBytes())) throw new Error('bad payer');
    var c = connection();
    return c.getAccountInfo(to).then(function (info) {
      return c.getLatestBlockhash('confirmed').then(function (bh) {
        var tx = new SOL.Transaction({ feePayer: owner_, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
        if (!info) tx.add({ programId: new P(G.ATA), data: Uint8Array.of(1), keys: [{ pubkey: owner_, isSigner: true, isWritable: true }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: res, isSigner: false, isWritable: false }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: new P(G.SYS), isSigner: false, isWritable: false }, { pubkey: new P(G.TOKEN), isSigner: false, isWritable: false }] });
        var d = new Uint8Array(10); d[0] = 12; u64(d, 1, o.units); d[9] = o.decimals;
        tx.add({ programId: new P(G.TOKEN), data: d, keys: [{ pubkey: from, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: owner_, isSigner: true, isWritable: false }] });
        tx.add({ programId: new P(G.MEMO), data: new TextEncoder().encode(o.memo), keys: [{ pubkey: owner_, isSigner: true, isWritable: false }] });
        verifyTokenTx(tx, o); return tx;
      });
    });
  }
  function verifyTokenTx(tx, o) { // exactly: [create ATA] + TransferChecked(mint, decimals, units, payer ATA -> recipient ATA) + memo. No SOL transfer.
    var P = SOL.PublicKey, G = PAY().PROG, ow = new P(o.payer), mint = new P(o.mint), res = new P(o.to), from = PAY().ataOf(ow, mint), to = PAY().ataOf(res, mint);
    var bad = function (w) { throw new Error('payment check failed: ' + w); }, R = tx.instructions, k = 0;
    if (!tx.feePayer || !tx.feePayer.equals(ow)) bad('fee payer'); if (R.length !== 2 && R.length !== 3) bad('instruction count');
    if (R.length === 3) { var a = R[0]; if (!a.programId.equals(new P(G.ATA)) || a.data.length !== 1 || a.data[0] !== 1 || !a.keys[1].pubkey.equals(to) || !a.keys[2].pubkey.equals(res) || !a.keys[3].pubkey.equals(mint)) bad('ata'); k = 1; }
    var t = R[k], dd = t.data, n = BigInt(0); if (!t.programId.equals(new P(G.TOKEN)) || dd.length !== 10 || dd[0] !== 12) bad('not TransferChecked');
    for (var i = 8; i >= 1; i--) n = (n << BigInt(8)) | BigInt(dd[i]); if (n !== o.units) bad('amount'); if (dd[9] !== o.decimals) bad('decimals');
    if (!t.keys[0].pubkey.equals(from) || !t.keys[1].pubkey.equals(mint) || !t.keys[2].pubkey.equals(to) || !t.keys[3].pubkey.equals(ow) || !t.keys[3].isSigner) bad('accounts');
    if (R.some(function (x) { return x.programId.equals(new P(G.SYS)); })) bad('SOL transfer'); // paid items: no SOL fee
    var m = R[k + 1]; if (!m.programId.equals(new P(G.MEMO)) || new TextDecoder().decode(m.data) !== o.memo) bad('memo');
    return { units: n.toString(), to: to.toBase58(), mint: mint.toBase58(), memo: o.memo };
  }
  function buildSolTx(o) { // o: { payer, lamports, to, memo }: one System transfer + memo
    var P = SOL.PublicKey, G = PAY().PROG, ow = new P(o.payer), c = connection();
    return c.getLatestBlockhash('confirmed').then(function (bh) {
      var tx = new SOL.Transaction({ feePayer: ow, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }), d = new Uint8Array(12); d[0] = 2; u64(d, 4, BigInt(o.lamports));
      tx.add({ programId: new P(G.SYS), data: d, keys: [{ pubkey: ow, isSigner: true, isWritable: true }, { pubkey: new P(o.to), isSigner: false, isWritable: true }] });
      tx.add({ programId: new P(G.MEMO), data: new TextEncoder().encode(o.memo), keys: [{ pubkey: ow, isSigner: true, isWritable: false }] });
      verifySolTx(tx, o); return tx;
    });
  }
  function verifySolTx(tx, o) {
    var P = SOL.PublicKey, G = PAY().PROG, ow = new P(o.payer), R = tx.instructions, bad = function (w) { throw new Error('fee check failed: ' + w); };
    if (!tx.feePayer || !tx.feePayer.equals(ow) || R.length !== 2) bad('shape'); var f = R[0], fd = f.data, l = BigInt(0);
    if (!f.programId.equals(new P(G.SYS)) || fd.length !== 12 || fd[0] !== 2 || fd[1] || fd[2] || fd[3]) bad('transfer');
    for (var j = 11; j >= 4; j--) l = (l << BigInt(8)) | BigInt(fd[j]); if (l !== BigInt(o.lamports)) bad('amount');
    if (o.to !== C.SOL_FEE_RECIPIENT || f.keys.length !== 2 || !f.keys[0].pubkey.equals(ow) || !f.keys[0].isSigner || f.keys[1].pubkey.toBase58() !== o.to) bad('recipient');
    var m = R[1]; if (!m.programId.equals(new P(G.MEMO)) || new TextDecoder().decode(m.data) !== o.memo) bad('memo');
    return { lamports: l.toString(), to: o.to, memo: o.memo };
  }
  function send(build, o) { // build -> check again -> wallet -> confirmed. Resolves the signature or false.
    var p = PAY(), payer = o.payer, sig; toast('Getting it ready…');
    return build(o).then(function (tx) { (build === buildSolTx ? verifySolTx : verifyTokenTx)(tx, o); return p.send(tx); })
      .then(function (r) { sig = r; if (typeof sig !== 'string' || !B58.test(sig.slice(0, 44))) throw new Error('no signature'); toast('Waiting for Solana…'); return p.confirm(sig); })
      .then(function () { var s = owner(); return s === payer ? sig : false; })
      .catch(function (e) { toast(p.rejected(e) ? 'Cancelled. Nothing was sent.' : 'It didn\'t go through: ' + p.txt(e && e.message, 60)); return false; });
  }
  function ready() { var p = PAY(); return !!(p && SOL && C.NETWORK === 'mainnet-live' && owner() && p.payOn()); }
  function confirmSheet(title, lines, goText, onGo) {
    var go = el('button', 'sbtn primary', goText || 'Continue in wallet'), no = el('button', 'sbtn', 'Cancel');
    no.onclick = H.closeSheet; go.onclick = function () { go.disabled = true; H.closeSheet(); onGo(); };
    H.openSheet(title, lines.map(function (t) { return typeof t === 'string' ? H.p(t) : t; }).concat([go, no]));
  }
  var FEE_LINE = 'A small SOL fee that supports BLUP3TS development.';

  // ---------- $EMPIRE feeds ----------
  function empireOn() { return C.EMPIRE_FEEDS_ENABLED === true && B58.test(E.mint || '') && E.decimals === 5 && B58.test(E.recipient || ''); }
  function feedSection(box, pd, foods) {
    if (!empireOn() || !walletMode() || C.CAPO_WALLET_ENABLED !== true || !pd || pd.collection !== CAPO) return; // Capos are Pretend-only while CAPO_WALLET_ENABLED is false
    var sec = el('div', 'realfeed empirefeed'); sec.appendChild(el('div', 'rfhead', 'Feed with $EMPIRE'));
    if (!owner() || !pd.owned) { sec.appendChild(el('p', 'rfnote', 'Connect your wallet and pick your own Capo to feed it $EMPIRE.')); box.appendChild(sec); return; }
    sec.appendChild(el('p', 'rfnote', 'Same meal size as $BLUNANA, worked out live when you tap. It goes to the community wallet and back into the project.'));
    foods.forEach(function (f) { var b = el('button', 'food rf empire', f.tier + ' · $EMPIRE'); b.dataset.empireTier = f.id; if (A.solFeeFor && A.solFeeFor(f.id)) b.appendChild(el('i', 'solfeetag', '+ SOL fee'));
      b.onclick = function () { A.play('tap'); askEmpireFeed(pd, f); }; sec.appendChild(b); });
    box.appendChild(sec);
  }
  function askEmpireFeed(pd, f) {
    if (!empireOn()) return Promise.resolve(false);
    toast('Getting a live amount…');
    return empireQuote(f.id).then(function (q) {
      if (!q) { toast(PRICE_NA); return false; } // fail closed: nothing to approve, nothing sent
      A.hideOverlays();
      var lines = ['This ' + f.tier + ' for ' + pd.name + ' sends ' + unitsText(q.units, E.decimals) + ' $EMPIRE to the community wallet. It goes back into the project.'];
      if (A.solFeeFor && A.solFeeFor(f.id)) lines.push(FEE_LINE);
      lines.push('Your wallet shows the same amount before you approve.');
      confirmSheet(f.tier + ' for ' + pd.name, lines, 'Continue in wallet', function () { sendEmpireFeed(pd, f, q); });
      return true;
    });
  }
  function sendEmpireFeed(pd, f, q) {
    if (!ready() || !goodEmpireQuote(q, f.id)) { toast(PRICE_NA); return Promise.resolve(false); }
    var o = { payer: owner(), mint: E.mint, decimals: E.decimals, units: BigInt(q.units), to: E.recipient, memo: 'blup3ts:feed:empire:' + f.id + ':' + q.quoteId };
    return send(buildTokenTx, o).then(function (sig) {
      if (!sig) return false; if (!A.setActive(pd.id) && A.petDef().id !== pd.id) return false;
      var ate = A.feedReal(f); if (!ate) return false;
      var rec = { sig: sig, wallet: o.payer, petId: pd.id, tier: f.id, token: 'empire', quoteId: q.quoteId, name: pd.name, collection: pd.collection, number: pd.number }, LA = window.BLUP3TS_LBAUTH;
      if (LA && LA.enabled) LA.noteFeed(rec);
      else fetch(C.FEED_RECEIPT_ENDPOINT || '/api/blup3ts-feeds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec), keepalive: true, cache: 'no-store' }).catch(function () {});
      return true;
    });
  }

  // ---------- Store ----------
  var SKEY = 'blup3ts.web.store.', CKEY = 'blup3ts.web.charms';
  function items() { return (Array.isArray(C.STORE_ITEMS) ? C.STORE_ITEMS : []).filter(function (it) {
    return it && /^[a-z_]{3,32}$/.test(it.id) && (it.kind === 'face' || it.kind === 'item') && (it.token === 'empire' || it.token === 'blunana') && Number.isInteger(it.price) && it.price >= 0 && typeof it.collection === 'string'; }); }
  function item(id) { return items().filter(function (x) { return x.id === id; })[0] || null; }
  function storeOn() { return C.STORE_ENABLED === true && items().length > 0; }
  function owns(id) { var o = owner(), it = item(id); if (!o || !it) return false; if (it.price === 0) return FREE.paid(id); var r = load(SKEY + o)[id]; return !!(r && typeof r.sig === 'string'); }
  function isStoreFace(id) { var it = item(id); return !!(it && it.kind === 'face'); }
  function tokenOf(it) { return it.token === 'empire' ? { mint: E.mint, decimals: E.decimals, sym: '$EMPIRE', to: E.recipient, icon: '🏛️' } : { mint: C.REAL_BLUNANA_MINT, decimals: C.BLUNANA_DECIMALS, sym: '$BLUNANA', to: C.BLUNANA_RESERVE_WALLET, icon: '🍌' }; }
  function label(it) { if (owns(it.id)) return '✓ Yours'; if (it.price === 0) return C.FREE_UNLOCK_SOL_FEE_ENABLED === true ? '◎ One-time SOL unlock' : 'Free'; var t = tokenOf(it); return t.icon + ' ' + fmt(it.price) + ' ' + t.sym; }
  function charms() { return load(CKEY); }
  function charmFor(pd) { var id = pd && charms()[pd.id], it = item(id); return it && it.kind === 'item' && it.collection === pd.collection && owns(id) ? it : null; }
  function equip(pd, id) { var it = item(id); if (!pd || (id && (!it || it.kind !== 'item' || it.collection !== pd.collection || !owns(id)))) return false; var m = charms(); if (id) m[pd.id] = id; else delete m[pd.id]; save(CKEY, m); paintCharm(pd); return true; }
  // Charm on the TOP band beside the badge (Nov 3): hangs from a small loop, gentle swing, sparkle on Feed, tap = cosmetic reaction only.
  var CHARM_LINES = { 'Caporegime Del $Empire': ['Capo approved 👌', 'Looking sharp, boss', 'Family style 🎩'], MNK3YS: ['Ooh ooh, banana time! 🍌', 'Monkey approved 🐒', 'Swing swing!'], ZMB3YS: ['Brains? No, bones! 🦴', 'Zombie approved 🧟', 'Glow time 💚'] };
  function sparkle(w) { if (!w) return; var s = el('i', 'charmspark'); s.setAttribute('aria-hidden', 'true'); w.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 700); }
  function tapCharm(w) {
    var it = item(w.dataset.charm); if (!it) return; A.play('tap'); // A.play already respects mute
    w.classList.remove('tapped'); void w.offsetWidth; w.classList.add('tapped'); sparkle(w);
    var L = CHARM_LINES[it.collection] || ['Nice! ✨'], b = document.getElementById('charmBubble');
    if (!b) { b = el('span', 'charmbubble'); b.id = 'charmBubble'; b.setAttribute('role', 'status'); w.parentNode.appendChild(b); }
    b.textContent = L[(w.__n || 0) % L.length]; w.__n = (w.__n || 0) + 1; b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b.__t); b.__t = setTimeout(function () { b.hidden = true; b.classList.remove('show'); }, 1600);
  } // cosmetic only: no stats, no XP, no save
  function paintCharm(pd) {
    var st = document.getElementById('stage'); if (!st) return; var w = document.getElementById('charmBtn'), it = charmFor(pd || A.petDef());
    if (!it) { if (w) { w.hidden = true; document.getElementById('charmImg').hidden = true; } var ob = document.getElementById('charmBubble'); if (ob) ob.hidden = true; return; }
    if (!w) {
      w = el('button', 'bandcharm'); w.id = 'charmBtn'; w.type = 'button';
      w.appendChild(el('i', 'charmloop')); var img = el('img', 'charmart'); img.id = 'charmImg'; img.alt = ''; w.appendChild(img);
      w.onclick = function (e) { e.stopPropagation(); tapCharm(w); }; st.appendChild(w);
    }
    var im = document.getElementById('charmImg'); if (/^store\/[\w.-]+\.png$/.test(it.art)) im.src = it.art; im.hidden = false;
    w.hidden = false; w.dataset.charm = it.id; w.setAttribute('aria-label', it.name + ' charm. Tap it!');
  }
  document.addEventListener('blup3ts:fed', function () { var w = document.getElementById('charmBtn'); if (w && !w.hidden) sparkle(w); });
  function buy(id, after) {
    var it = item(id), pd = A.petDef(); if (!it) return false;
    if (capoSoon(it)) { toast('Capos are coming soon in Wallet mode! Try them in Pretend mode. 🔒'); return false; }
    if (it.collection !== pd.collection) { toast('This one is for ' + it.collection + ' pets 🔒'); return false; } // Capo items: Capo pets only
    if (!owner()) { toast('Connect a wallet to get things from the Store 👛'); return false; }
    if (owns(id)) return false;
    if (it.price === 0) return FREE.ask(id, after);
    if (C.STORE_REAL_BUYS_ENABLED !== true) { toast('The Store opens soon 🛍️'); return false; }
    var w = WL(); if (it.token === 'blunana' && w && w.playToken && w.playToken() !== 'blunana') { toast('Switch to $BLUNANA to get this one.'); return false; }
    var t = tokenOf(it), units = BigInt(it.price) * BigInt(Math.pow(10, t.decimals));
    confirmSheet('Get ' + it.name, ['Get ' + it.name + ' once for this wallet: ' + fmt(it.price) + ' ' + t.sym + '. It goes back into the project.', 'No SOL fee. Your wallet shows the same amount before you approve.'], 'Continue in wallet', function () {
      if (!ready()) { toast('The Store is not ready yet.'); return; }
      var o = { payer: owner(), mint: t.mint, decimals: t.decimals, units: units, to: t.to, memo: 'blup3ts:store:' + it.id };
      send(buildTokenTx, o).then(function (sig) { if (!sig) return; var m = load(SKEY + o.payer); m[it.id] = { sig: sig, token: it.token, at: now() }; save(SKEY + o.payer, m); toast('🎉 ' + it.name + ' is yours'); if (after) after(); });
    });
    return true;
  }
  function open(focusId) {
    if (!storeOn()) return false; var pd = A.petDef(), grid = el('div', 'storegrid');
    items().forEach(function (it) {
      var card = el('div', 'storecard' + (it.collection === CAPO ? ' capo' : '')); card.dataset.item = it.id; if (focusId === it.id) card.classList.add('focus');
      var im = el('img', 'storeart'); im.src = it.art; im.alt = ''; card.appendChild(im);
      card.appendChild(el('b', 'storename', it.name)); card.appendChild(el('span', 'storefor', (it.kind === 'face' ? 'Watch face' : 'Charm') + ' · ' + (it.collection === CAPO ? 'Capo pets only' : it.collection + ' pets')));
      var mine = owns(it.id), b = el('button', 'sbtn storebuy' + (mine ? ' owned' : ''));
      if (mine && it.kind === 'item') { var on = charms()[pd.id] === it.id; b.textContent = on ? '✓ On your pet' : 'Put it on'; b.onclick = function () { A.play('tap'); if (!equip(pd, on ? null : it.id)) toast('This one is for ' + it.collection + ' pets 🔒'); open(it.id); }; }
      else if (mine) { b.textContent = '✓ Yours · wear it'; b.onclick = function () { A.play('tap'); if (A.setCase(it.id, pd)) { H.closeSheet(); } else toast('This one is for ' + it.collection + ' pets 🔒'); }; }
      else if (capoSoon(it)) { b.textContent = '🔒 Coming soon'; b.classList.add('soon'); b.onclick = function () { A.play('tap'); buy(it.id); }; }
      else { b.textContent = label(it); b.onclick = function () { A.play('tap'); buy(it.id, function () { open(it.id); }); }; }
      card.appendChild(b); grid.appendChild(card);
    });
    H.openSheet('Store', [H.p('One-time, per connected wallet. Everything goes back into the project. Store items have no SOL fee.'), grid]);
    return true;
  }

  // ---------- free unlock SOL fee ----------
  var FKEY = 'blup3ts.web.freeunlock.';
  var FREE = {
    on: function () { return C.FREE_UNLOCK_SOL_FEE_ENABLED === true; },
    isFree: function (id) { // free today: project cases (MNK3YS, ZMB3YS, Capo), faces free by date (Christmas), Store items priced 0. Never Classic.
      var K = A.caseCfg ? A.caseCfg() : { map: {}, def: 'default' }, c = K.map[id], it = item(id);
      if (id === K.def || id === 'default') return false;
      if (it) return it.price === 0;
      if (!c || c.store === true) return false;
      return !!c.collection || !!(c.face === true && (C.FACE_FREE_FROM || {})[id]);
    },
    paid: function (id) { var o = owner(); if (!o) return false; var r = load(FKEY + o)[id]; return !!(r && typeof r.sig === 'string'); },
    needs: function (id) { return FREE.on() && walletMode() && FREE.isFree(id) && !FREE.paid(id); }, // Wallet mode only; no wallet yet = still locked
    note: function () { return FREE.on() && walletMode() ? 'Free faces unlock once per wallet with a small SOL fee (about 10 cents of SOL). ' + FEE_LINE + ' BLUP3TS Classic is always free.' : ''; },
    ask: function (id, after) {
      if (!FREE.needs(id)) return false; var o = owner(); if (!o) { toast('Connect a wallet to unlock this one 👛'); return false; }
      var K = A.caseCfg(), nm = (K.map[id] && K.map[id].name) || (item(id) && item(id).name) || id;
      toast('Getting a live amount…');
      return getJSON(C.FREE_UNLOCK_FEE_QUOTE_ENDPOINT, { item: id, wallet: o }).then(function (q) {
        if (!goodSolQuote(q, id)) { toast(PRICE_NA); return false; } // fail closed
        confirmSheet('Unlock ' + nm, ['Unlock ' + nm + ' once for this wallet with a small SOL fee: ' + solText(q.lamports) + ' SOL (about 10 cents).', FEE_LINE, 'Your wallet shows the same amount before you approve.'], 'Continue in wallet', function () {
          if (!ready() || !goodSolQuote(q, id)) { toast(PRICE_NA); return; }
          var tx = { payer: o, lamports: q.lamports, to: q.recipient, memo: 'blup3ts:unlock:' + id + ':' + q.quoteId };
          send(buildSolTx, tx).then(function (sig) { if (!sig) return; var m = load(FKEY + o); m[id] = { sig: sig, lamports: q.lamports, quoteId: q.quoteId, at: now() }; save(FKEY + o, m); toast('🎉 ' + nm + ' unlocked'); A.applyCase(); if (after) after(); });
        });
        return true;
      });
    }
  };

  window.BLUP3TS_EMPIRE = { on: empireOn, feedSection: feedSection, ask: askEmpireFeed, quote: empireQuote, goodQuote: goodEmpireQuote };
  window.BLUP3TS_STORE = { on: storeOn, items: items, owns: owns, open: open, buy: buy, equip: equip, paintCharm: paintCharm, tapCharm: function () { var w = document.getElementById('charmBtn'); if (w && !w.hidden) tapCharm(w); }, isStoreFace: isStoreFace, label: label };
  window.BLUP3TS_FREEFEE = FREE;
  // tests only (no real network): swap the RPC connection, set the clock, read the builders
  window.BLUP3TS_PAYTEST = { setConnection: function (c) { conn = c; }, setNow: function (t) { nowOverride = t; }, buildTokenTx: buildTokenTx, verifyTokenTx: verifyTokenTx, buildSolTx: buildSolTx, verifySolTx: verifySolTx, goodSolQuote: goodSolQuote, unitsText: unitsText };
  try { paintCharm(A.petDef()); } catch (e) {}
})();
