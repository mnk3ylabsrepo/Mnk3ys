/* BLUPA1RS: the pairs game, in the BLUP3TS layout. Payments still use /api/pairs. */
(function () {
  var CARD_TYPES = [
    { id: 'mnk3ys', label: 'Mnk3ys NFT', short: 'MNK3YS', count: 2, kind: 'nft' },
    { id: 'zmb3ys', label: 'Zmb3ys NFT', short: 'ZMB3YS', count: 2, kind: 'nft' },
    { id: '100k', label: '100k $BLUNANA', short: '100k', count: 2, kind: 'tok' },
    { id: '150k', label: '150k $BLUNANA', short: '150k', count: 2, kind: 'tok' },
    { id: '200k', label: '200k $BLUNANA', short: '200k', count: 2, kind: 'tok' },
    { id: '250k', label: '250k $BLUNANA', short: '250k', count: 2, kind: 'tok' },
    { id: '300k', label: '300k $BLUNANA', short: '300k', count: 2, kind: 'tok' },
    { id: '400k', label: '400k $BLUNANA', short: '400k', count: 2, kind: 'tok' },
    { id: '500k', label: '500k $BLUNANA', short: '500k', count: 2, kind: 'tok' },
    { id: 'shuffle', label: 'SHUFFLE', short: 'SHUFFLE', count: 6, kind: 'shuffle' }
  ];
  var TYPE = {};
  CARD_TYPES.forEach(function (t) { TYPE[t.id] = t; });
  var BLUNANA_LOGO = 'https://ipfs.io/ipfs/QmTKRAZEcTfDeVDt8hebrCv27DctYghtdfXRMc9FRA6NU3';
  var BADGE = '../blup3ts/assets/blunana_badge.png';
  var BACK = '/assets/logo.png';
  var STORE = 'blupa1rs.state';
  var cfg = { turnsPerBuy: 5, costBlunana: 100000 };
  var state = {
    deck: [], turns: 0, prizes: [], flipped: [], matched: {}, selecting: false,
    collectionImages: {}, localCollectionImages: {}, lastWonPrizeId: null, pendingPrizes: []
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function commas(n) {
    var s = String(n);
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function shortAddr(pk) {
    return pk && pk.length > 12 ? pk.slice(0, 4) + '…' + pk.slice(-4) : (pk || '');
  }
  var W = { connecting: false, kind: null, provider: null, std: null, account: null, pubkey: null, lastConnect: 0, lastDrop: 0 };
  var LOGO = { solflare: '../blup3ts/assets/wallets/solflare.png', phantom: '../blup3ts/assets/wallets/phantom.png' };
  var ALLOWED = ['Phantom', 'Solflare', 'Backpack'];
  var STD = [];
  var REM = 'blupa1rs.wallet';
  function walletPk() { return W.pubkey || null; }
  function isMobile() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); }
  function remembered() { try { var v = localStorage.getItem(REM); return /^(phantom|solflare|backpack)$/.test(v) ? v : null; } catch (e) { return null; } }
  function remember(kind) { try { if (kind) localStorage.setItem(REM, kind); else localStorage.removeItem(REM); } catch (e) {} }
  function fromDeepLink() { try { return new URLSearchParams(location.search).get('wallet') === '1'; } catch (e) { return false; } }
  function deepLink(base) {
    var u = new URL(location.href); u.hash = ''; u.searchParams.delete('fresh'); u.searchParams.set('wallet', '1');
    return base + encodeURIComponent(u.href) + '?ref=' + encodeURIComponent(location.origin);
  }
  function logoImg(kind) {
    var src = LOGO[kind]; if (!src) return null;
    var i = document.createElement('img'); i.className = 'wlogo'; i.src = src; i.alt = ''; i.width = 22; i.height = 22; i.draggable = false;
    return i;
  }
  function withLogo(node, kind, text) {
    node.textContent = '';
    var i = logoImg(kind);
    if (i) node.appendChild(i);
    node.appendChild(document.createTextNode(text));
    return node;
  }
  function allowedName(n) {
    n = String(n || '').toLowerCase();
    return ALLOWED.filter(function (a) { return n === a.toLowerCase() || n.indexOf(a.toLowerCase()) === 0; })[0] || null;
  }
  function stdOk(w) {
    try {
      var f = w.features || {};
      return (w.chains || []).some(function (c) { return c === 'solana:mainnet'; }) && f['standard:connect'] && typeof f['standard:connect'].connect === 'function';
    } catch (e) { return false; }
  }
  function walletList() {
    var out = [], have = {};
    STD.forEach(function (w) {
      var nm = allowedName(w.name);
      if (nm && !have[nm] && stdOk(w)) { have[nm] = 1; out.push({ kind: nm.toLowerCase(), name: nm, std: w }); }
    });
    try { var ph = window.phantom && window.phantom.solana; if (!have.Phantom && ph && ph.isPhantom) out.push({ kind: 'phantom', name: 'Phantom', p: ph }); } catch (e) {}
    try { var sf = window.solflare; if (!have.Solflare && sf && sf.isSolflare) out.push({ kind: 'solflare', name: 'Solflare', p: sf }); } catch (e) {}
    try { var bp = window.backpack; if (!have.Backpack && bp && bp.isBackpack) out.push({ kind: 'backpack', name: 'Backpack', p: bp }); } catch (e) {}
    return out;
  }
  function rejected(e) { var c = e && (e.code || (e.error && e.error.code)); return c === 4001 || /reject|denied|cancel|declin/i.test(String(e && (e.message || e))); }
  function paintConnect() {
    var btn = $('connectBtn'); if (!btn) return;
    var phone = !W.pubkey && isMobile() && !walletList().length;
    btn.classList.toggle('busy', !!W.connecting);
    btn.setAttribute('aria-busy', W.connecting ? 'true' : 'false');
    var lk = W.pubkey ? W.kind : phone ? 'solflare' : null;
    var label = W.connecting ? 'Connecting…' : W.pubkey ? shortAddr(W.pubkey) + ' · Disconnect' : phone ? 'Connect · Open in Solflare' : 'Connect wallet';
    if (!W.connecting && lk && LOGO[lk]) withLogo(btn, lk, label);
    else btn.textContent = (W.connecting ? '⏳ ' : '👛 ') + label;
    btn.setAttribute('aria-label', W.pubkey ? 'Disconnect wallet ' + shortAddr(W.pubkey) : 'Connect wallet');
  }

  function kindOf(id) { return (TYPE[id] && TYPE[id].kind) || 'tok'; }
  function shortOf(card) { return (TYPE[card.id] && TYPE[card.id].short) || card.label; }
  function imageUrl(id) {
    if (id === 'shuffle') return null;
    if (id === 'mnk3ys' || id === 'zmb3ys') return state.localCollectionImages[id] || state.collectionImages[id] || null;
    return BLUNANA_LOGO;
  }

  function paintTicker() {
    var track = $('tickerTrack');
    if (!track) return;
    var line = 'Flip two cards a turn. Match a pair to win an NFT or $BLUNANA. Five turns cost ' + commas(cfg.costBlunana) + ' $BLUNANA, paid to the pairs treasury. A SHUFFLE card costs the turn and reshuffles the board. Prizes are sent to your wallet when you collect.';
    track.textContent = '';
    track.appendChild(el('span', null, line));
    track.appendChild(el('span', null, line));
    track.style.animation = 'none';
    void track.offsetWidth;
    track.style.animation = '';
  }

  function setMsg(text, warn) {
    var n = $('msg');
    if (!n) return;
    n.textContent = text || '';
    n.className = 'modenote' + (warn ? ' warn' : '');
  }
  function setTurns(n) {
    state.turns = n;
    $('turns').textContent = String(n);
    var buy = $('buyBtn');
    var pk = walletPk();
    buy.disabled = !pk || n > 0 || !!(state.pendingPrizes && state.pendingPrizes.length);
    buy.textContent = n > 0 ? 'Turns in play' : ('Buy ' + cfg.turnsPerBuy + ' turns');
    var cap = $('boardCap');
    if (state.pendingPrizes && state.pendingPrizes.length) cap.textContent = 'Collect your prize before the next flip.';
    else if (n > 0) cap.textContent = n + (n === 1 ? ' turn left. Flip two cards.' : ' turns left. Flip two cards.');
    else if (!pk) cap.textContent = 'Connect a wallet, buy turns, then flip two cards.';
    else cap.textContent = 'No turns left. Buy ' + cfg.turnsPerBuy + ' for ' + commas(cfg.costBlunana) + ' $BLUNANA.';
  }
  function paintCost() {
    $('costNote').textContent = cfg.turnsPerBuy + ' turns = ' + commas(cfg.costBlunana) + ' $BLUNANA';
    paintTicker();
    setTurns(state.turns);
  }

  function syncWallet() {
    paintConnect();
    var pk = walletPk();
    if (pk) {
      var bal = $('bal');
      bal.textContent = '…';
      fetch('/api/verify?wallet=' + encodeURIComponent(pk), { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          bal.textContent = data && data.blunanaFormatted != null ? data.blunanaFormatted : '—';
        })
        .catch(function () { bal.textContent = '—'; });
    } else $('bal').textContent = '—';
    setTurns(state.turns);
  }

  function buildDeck() {
    var deck = [];
    CARD_TYPES.forEach(function (t) {
      for (var i = 0; i < t.count; i++) deck.push({ id: t.id, label: t.label });
    });
    return deck;
  }
  function shuffle(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function shuffleIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 216.318 216.318');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M118.913,22.172V0L45.295,43.154l73.617,43.155V62.604c27,5.108,46.549,28.418,46.549,56.331c0,31.641-25.659,57.383-57.3,57.383s-57.341-25.742-57.341-57.383c0-8.319,1.756-16.334,5.179-23.821L19.632,78.483c-5.825,12.743-8.774,26.354-8.774,40.452c0,53.697,43.688,97.383,97.385,97.383s97.218-43.686,97.218-97.383C205.461,68.939,167.913,27.629,118.913,22.172z');
    svg.appendChild(path);
    return svg;
  }

  function render() {
    var grid = $('grid');
    grid.textContent = '';
    state.deck.forEach(function (card, idx) {
      var up = state.flipped.indexOf(idx) >= 0 || !!state.matched[idx];
      var btn = el('button', 'card ' + kindOf(card.id) + (up ? ' flip' : '') + (state.matched[idx] ? ' matched' : ''));
      btn.type = 'button';
      btn.setAttribute('data-index', String(idx));
      var can = !state.matched[idx] && state.turns > 0 && !state.selecting && state.flipped.indexOf(idx) < 0 && !(state.pendingPrizes && state.pendingPrizes.length);
      btn.disabled = !can;
      btn.setAttribute('aria-label', up ? ('Card, ' + shortOf(card)) : 'Face-down card');
      var inner = el('span', 'inner');
      var back = el('span', 'face back');
      var logo = document.createElement('img');
      logo.src = BACK;
      logo.alt = '';
      back.appendChild(logo);
      var front = el('span', 'face front');
      var media = el('span', 'media');
      if (card.id === 'shuffle') media.appendChild(shuffleIcon());
      else {
        var url = imageUrl(card.id);
        if (url) {
          var img = document.createElement('img');
          img.alt = '';
          img.src = url;
          img.addEventListener('error', function () {
            if (kindOf(card.id) === 'tok' && img.src !== BADGE) img.src = BADGE;
          });
          media.appendChild(img);
        }
      }
      front.appendChild(media);
      front.appendChild(el('b', null, shortOf(card)));
      inner.appendChild(back);
      inner.appendChild(front);
      btn.appendChild(inner);
      if (can) btn.addEventListener('click', function () { onCard(idx); });
      grid.appendChild(btn);
    });
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        deck: state.deck, flipped: state.flipped, matched: state.matched,
        turns: state.turns, prizes: state.prizes
      }));
    } catch (e) {}
  }
  var saveJob = Promise.resolve(true);
  function saveServer() {
    var w = walletPk();
    if (!w) return Promise.resolve(false);
    saveJob = fetch('/api/pairs/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        wallet: w, deck: state.deck, flipped: state.flipped || [],
        matched: state.matched || {}, turnsRemaining: state.turns || 0, prizesWon: state.prizes || []
      })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
    return saveJob;
  }
  function save() { saveLocal(); return saveServer(); }
  function loadLocal() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && Array.isArray(s.deck) && s.deck.length === 24) return s;
    } catch (e) {}
    return null;
  }
  function deal() {
    state.deck = shuffle(buildDeck());
    state.flipped = [];
    state.matched = {};
    $('grid').classList.remove('shuffle');
    render();
  }
  function reshuffle() {
    var grid = $('grid');
    grid.classList.add('shuffle');
    state.deck = shuffle(buildDeck());
    state.flipped = [];
    state.matched = {};
    render();
    setTimeout(function () { grid.classList.remove('shuffle'); save(); }, 600);
  }
  function applySaved(s) {
    state.deck = s.deck;
    state.turns = s.turnsRemaining != null ? s.turnsRemaining : (s.turns != null ? s.turns : 0);
    state.flipped = Array.isArray(s.flipped) ? s.flipped : [];
    state.matched = s.matched && typeof s.matched === 'object' ? s.matched : {};
    state.prizes = Array.isArray(s.prizesWon) ? s.prizesWon : (Array.isArray(s.prizes) ? s.prizes : []);
    setTurns(state.turns);
  }

  function showCollect(show) {
    $('collectBtn').hidden = !show;
  }
  function openWon(label) {
    showCollect(true);
    var body = el('div');
    body.appendChild(el('p', null, 'You won ' + label));
    if (!walletPk()) body.appendChild(el('p', null, 'Connect a wallet to collect.'));
    var btn = el('button', 'sbtn gold', 'Collect');
    btn.type = 'button';
    btn.addEventListener('click', function () { doCollect(); });
    body.appendChild(btn);
    openSheet('Congrats', body);
  }

  function onCard(idx) {
    if (state.pendingPrizes && state.pendingPrizes.length) { setMsg('Collect your prize first', true); openWon('an uncollected prize.'); return; }
    if (state.matched[idx] || state.flipped.indexOf(idx) >= 0) return;
    if (state.flipped.length >= 2 || state.turns <= 0 || state.selecting) return;
    var card = state.deck[idx];
    state.flipped.push(idx);
    if (card.id === 'shuffle' || state.flipped.length === 2) state.selecting = true;
    render();
    if (card.id === 'shuffle') {
      setMsg('SHUFFLE. Turn lost. Board reshuffling…', true);
      setTurns(state.turns - 1);
      setTimeout(function () {
        state.flipped = [];
        state.selecting = false;
        setMsg('');
        reshuffle();
      }, 1200);
      return;
    }
    if (state.flipped.length < 2) return;
    var a = state.flipped[0], b = state.flipped[1];
    var cardA = state.deck[a], cardB = state.deck[b];
    if (cardB.id === 'shuffle') {
      setMsg('SHUFFLE. Turn lost. Board reshuffling…', true);
      setTurns(state.turns - 1);
      setTimeout(function () {
        state.flipped = [];
        state.selecting = false;
        setMsg('');
        reshuffle();
      }, 1200);
      return;
    }
    if (cardA.id === cardB.id) {
      state.matched[a] = true;
      state.matched[b] = true;
      state.prizes.push(cardA.label);
      state.lastWonPrizeId = cardA.id;
      state.pendingPrizes = [{ prizeId: cardA.id }];
      state.flipped = [];
      state.selecting = false;
      setTurns(state.turns - 1);
      render();
      save();
      setMsg('');
      openWon(cardA.label);
      return;
    }
    setTurns(state.turns - 1);
    setTimeout(function () {
      state.flipped = [];
      state.selecting = false;
      render();
      save();
    }, 1200);
  }

  var toastTimer;
  function toast(text) {
    var n = $('hToast'); if (!n) return;
    n.textContent = text || '';
    n.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.classList.remove('show'); }, 2800);
  }
  function openSheet(title, nodes, icon) {
    var titleEl = $('sheetTitle');
    var body = $('sheetBody');
    titleEl.textContent = '';
    if (icon) titleEl.appendChild(icon);
    titleEl.appendChild(document.createTextNode(title));
    body.textContent = '';
    (Array.isArray(nodes) ? nodes : [nodes]).forEach(function (n) { if (n) body.appendChild(n); });
    $('sheetBg').classList.add('show');
    $('sheet').classList.add('show');
    if ($('sheetClose')) $('sheetClose').focus();
  }
  function closeSheet() {
    $('sheetBg').classList.remove('show');
    $('sheet').classList.remove('show');
  }

  function howSheet() {
    var body = el('div');
    var ol = document.createElement('ol');
    [
      'Connect a wallet that holds $BLUNANA.',
      'Buy ' + cfg.turnsPerBuy + ' turns for ' + commas(cfg.costBlunana) + ' $BLUNANA. You can buy again when your turns hit zero.',
      'Each turn flips two cards. A matching pair wins that prize and still uses the turn.',
      'A SHUFFLE card, alone or as the second flip, uses the turn and deals a new board.',
      'Collect sends the prize from the pairs treasury to your wallet. Token prizes are $BLUNANA. NFT prizes are a MNK3YS or ZMB3YS from the treasury.'
    ].forEach(function (line) { ol.appendChild(el('li', null, line)); });
    body.appendChild(ol);
    openSheet('How to play', body);
  }

  function prizeRow(t) {
    var row = el('div', 'prize');
    var url = imageUrl(t.id);
    if (url) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = url;
      img.addEventListener('error', function () { if (t.kind === 'tok') img.src = BADGE; });
      row.appendChild(img);
    }
    row.appendChild(el('span', null, t.label));
    return row;
  }
  function prizesSheet() {
    var body = el('div');
    body.appendChild(el('p', null, 'Match two of the same card to win it.'));
    CARD_TYPES.filter(function (t) { return t.id !== 'shuffle'; }).forEach(function (t) {
      body.appendChild(prizeRow(t));
    });
    openSheet('Prizes', body);
  }

  var listened = [];
  function accountChanged(k) {
    if (!k) return disconnect(false, 'Wallet disconnected');
    k = String(k);
    if (k !== W.pubkey) { W.pubkey = k; toast('Switched to ' + shortAddr(k)); syncWallet(); load(); }
  }
  function listen(x) {
    if (x.std) {
      if (listened.indexOf(x.std) >= 0) return;
      listened.push(x.std);
      try {
        var ev = x.std.features['standard:events'];
        if (ev && typeof ev.on === 'function') ev.on('change', function (props) {
          if (W.std !== x.std || !props || !props.accounts) return;
          var a = props.accounts[0];
          if (!a) return disconnect(false, 'Wallet disconnected');
          W.account = a;
          accountChanged(a.address);
        });
      } catch (e) {}
      return;
    }
    var p = x.p;
    if (!p || listened.indexOf(p) >= 0 || typeof p.on !== 'function') return;
    listened.push(p);
    try { p.on('disconnect', function () { if (W.provider === p && W.pubkey) disconnect(false, 'Wallet disconnected'); }); } catch (e) {}
    try { p.on('accountChanged', function (pk) { if (W.provider !== p) return; accountChanged(pk && (pk.toBase58 ? pk.toBase58() : String(pk))); }); } catch (e) {}
  }
  function disconnect(user, msg) {
    var p = W.provider, sw = W.std;
    W.provider = null; W.std = null; W.account = null; W.pubkey = null; W.kind = null; W.connecting = false;
    if (user) remember(null);
    syncWallet();
    load();
    toast(msg || 'Disconnected');
    if (user && sw) { try { var dc = sw.features['standard:disconnect']; if (dc && typeof dc.disconnect === 'function') Promise.resolve(dc.disconnect()).catch(function () {}); } catch (e) {} }
    if (user && p && typeof p.disconnect === 'function') { try { Promise.resolve(p.disconnect()).catch(function () {}); } catch (e) {} }
  }
  function connect(x, silent) {
    if (W.connecting || W.pubkey) return Promise.resolve();
    if ($('sheet') && $('sheet').classList.contains('show')) closeSheet();
    W.connecting = true;
    syncWallet();
    function done(pk) {
      var k = pk && (typeof pk === 'string' ? pk : pk.toBase58 ? pk.toBase58() : pk.toString());
      if (!k) throw new Error('no public key');
      W.connecting = false;
      W.lastConnect = Date.now();
      W.kind = x.kind;
      W.provider = x.p || null;
      W.std = x.std || null;
      W.pubkey = k;
      listen(x);
      remember(x.kind);
      toast((silent ? 'Welcome back ' : 'Connected ') + shortAddr(k));
      syncWallet();
      load();
    }
    function fail(e) {
      W.connecting = false;
      W.pubkey = null;
      syncWallet();
      if (silent) return;
      toast(rejected(e) ? 'Connect cancelled. No problem.' : 'Couldn\'t connect the wallet.');
    }
    var r;
    if (x.std) {
      try { r = x.std.features['standard:connect'].connect(silent ? { silent: true } : undefined); } catch (e) { fail(e); return Promise.resolve(); }
      return Promise.resolve(r).then(function (res) {
        var accs = (res && res.accounts) || x.std.accounts || [];
        var acc = accs.filter(function (a) { return a && (!a.chains || a.chains.indexOf('solana:mainnet') >= 0); })[0] || accs[0];
        W.account = acc || null;
        done(acc && acc.address);
      }).catch(fail);
    }
    try { r = silent ? x.p.connect({ onlyIfTrusted: true }) : x.p.connect(); } catch (e) { fail(e); return Promise.resolve(); }
    return Promise.resolve(r).then(function (res) { done((res && res.publicKey) || x.p.publicKey); }).catch(fail);
  }
  function onConnectClick() {
    var now = Date.now();
    if (W.connecting) return;
    if (W.pubkey) {
      if (now - (W.lastConnect || 0) < 1200) return;
      W.lastDrop = now;
      return disconnect(true);
    }
    if (now - (W.lastDrop || 0) < 400) return;
    var list = walletList(), nodes = [];
    if (list.length === 1 && isMobile()) return connect(list[0]);
    if (list.length) {
      nodes.push(el('p', null, 'Pick your wallet. Only your public address is shared. Buying turns asks your wallet to approve the payment.'));
      list.forEach(function (x) {
        var b = withLogo(el('button', 'sbtn primary'), x.kind, 'Connect ' + x.name);
        b.type = 'button';
        b.addEventListener('click', function () { connect(x); });
        nodes.push(b);
      });
    } else if (isMobile()) {
      nodes.push(el('p', null, 'On a phone, BLUPA1RS connects inside your wallet app. Tap below: it opens this page in Solflare and connects in one tap.'));
      [['Solflare', 'https://solflare.com/ul/v1/browse/', 'sbtn primary'], ['Phantom', 'https://phantom.app/ul/browse/', 'sbtn']].forEach(function (w) {
        var a = withLogo(el('a', w[2]), w[0].toLowerCase(), 'Open in ' + w[0]);
        a.href = deepLink(w[1]);
        a.rel = 'noopener noreferrer';
        nodes.push(a);
      });
      nodes.push(el('p', 'muted', 'Only your public address is shared until you buy turns.'));
    } else {
      nodes.push(el('p', null, 'No wallet found in this browser. Install the Phantom, Solflare or Backpack browser extension, then reload this page.'));
    }
    nodes.push(el('p', 'muted', 'BLUPA1RS never asks for your seed phrase or private key. If anything does, it\'s a scam.'));
    openSheet('Connect wallet', nodes);
  }

  function doCollect() {
    if (!walletPk()) { setMsg('Connect a wallet to collect', true); onConnectClick(); return; }
    var prizeId = state.lastWonPrizeId;
    if (!prizeId && state.pendingPrizes[0]) prizeId = state.pendingPrizes[0].prizeId;
    if (!prizeId) { setMsg('No prize to collect', true); return; }
    setMsg('Sending…');
    $('collectBtn').disabled = true;
    saveJob.then(function () { return fetch('/api/pairs/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prizeId: prizeId, wallet: walletPk() })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }).catch(function () { return { ok: false, data: { error: 'Invalid response' } }; }); })
      .then(function (res) {
        $('collectBtn').disabled = false;
        if (res.ok && res.data && res.data.txSignature) {
          state.pendingPrizes = [];
          state.lastWonPrizeId = null;
          showCollect(false);
          setTurns(state.turns);
          setMsg('');
          var body = el('div');
          body.appendChild(el('p', null, 'Your prize has been sent to your wallet.'));
          var link = el('a', 'sbtn', 'View transaction');
          link.href = 'https://solscan.io/tx/' + encodeURIComponent(res.data.txSignature);
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          body.appendChild(link);
          var ok = el('button', 'sbtn primary', 'OK');
          ok.type = 'button';
          ok.addEventListener('click', closeSheet);
          body.appendChild(ok);
          openSheet('Prize sent', body);
        } else {
          setMsg((res.data && res.data.error) || 'Collect failed', true);
        }
      })
      .catch(function () {
        $('collectBtn').disabled = false;
        setMsg('Collect failed', true);
      });
    }).catch(function () {
      $('collectBtn').disabled = false;
      setMsg('Collect failed', true);
    });
  }

  function buyTurns() {
    if (state.pendingPrizes && state.pendingPrizes.length) { setMsg('Collect your prize first', true); return; }
    if (state.turns > 0) return;
    var pk = walletPk();
    if (!pk) { setMsg('Connect a wallet first', true); onConnectClick(); return; }
    var buy = $('buyBtn');
    buy.disabled = true;
    setMsg('Preparing…');
    fetch('/api/pairs/create-buy-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ wallet: pk })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.data.transaction) throw new Error((res.data && res.data.error) || 'Could not prepare the payment');
        var raw = atob(res.data.transaction);
        var buf = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        var Tx = window.solanaWeb3 && window.solanaWeb3.Transaction;
        if (!Tx) throw new Error('Solana library did not load. Refresh the page.');
        var tx = Tx.from(buf);
        setMsg('Confirm in your wallet…');
        return sendTx(tx).then(function (sent) {
          var body = { wallet: pk };
          if (typeof sent === 'string') body.signature = sent;
          else body.signedTransaction = sent.signedTransaction;
          return fetch('/api/pairs/buy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify(body)
          });
        });
      })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.data && res.data.error) || 'Buy failed');
        var next = res.data.turnsRemaining != null ? res.data.turnsRemaining : state.turns + cfg.turnsPerBuy;
        setTurns(next);
        if (!state.deck.length) deal();
        else render();
        save();
        syncWallet();
        setMsg('');
        var body = el('div');
        body.appendChild(el('p', null, 'You have ' + next + ' turns. Flip two cards.'));
        var ok = el('button', 'sbtn primary', 'OK');
        ok.type = 'button';
        ok.addEventListener('click', closeSheet);
        body.appendChild(ok);
        openSheet('Turns ready', body);
      })
      .catch(function (err) {
        setTurns(state.turns);
        setMsg((err && err.message) || 'Buy failed', true);
      });
  }

  function load() {
    var w = walletPk();
    if (!w) {
      state.pendingPrizes = [];
      state.lastWonPrizeId = null;
      showCollect(false);
      setTurns(0);
      deal();
      return;
    }
    fetch('/api/pairs/state?wallet=' + encodeURIComponent(w), { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : { state: null, pendingPrizes: [] }; })
      .then(function (data) {
        state.pendingPrizes = Array.isArray(data && data.pendingPrizes) ? data.pendingPrizes : [];
        var s = data && data.state && Array.isArray(data.state.deck) && data.state.deck.length === 24 ? data.state : loadLocal();
        if (s) applySaved(s);
        else { setTurns(0); deal(); save(); }
        if (state.pendingPrizes.length) {
          var first = state.pendingPrizes[0];
          state.lastWonPrizeId = first && first.prizeId ? first.prizeId : null;
          showCollect(true);
          openWon('an uncollected prize.');
        } else showCollect(false);
        render();
      })
      .catch(function () {
        var s = loadLocal();
        if (s) applySaved(s);
        else { setTurns(0); deal(); }
        render();
      });
  }

  function b58encode(bytes) {
    var alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    var n = 0n;
    for (var i = 0; i < bytes.length; i++) n = (n << 8n) + BigInt(bytes[i]);
    var s = '';
    while (n > 0n) { s = alphabet[Number(n % 58n)] + s; n = n / 58n; }
    return '1'.repeat(zeros) + (s || (zeros ? '' : '1'));
  }
  function sigText(res) {
    var out = Array.isArray(res) ? res[0] : res;
    var sig = out && (out.signature || out);
    if (sig && sig.signature) sig = sig.signature;
    if (typeof sig === 'string') return sig;
    if (sig && typeof sig.length === 'number') return b58encode(sig instanceof Uint8Array ? sig : Uint8Array.from(sig));
    throw new Error('No signature from wallet');
  }
  function stdAccount() {
    var list = (W.std && W.std.accounts) || [], hit = null;
    list.forEach(function (a) { if (!hit && a && a.address === W.pubkey) hit = a; });
    return hit || (W.account && W.account.address === W.pubkey ? W.account : null) || list[0] || null;
  }
  function sendTx(tx) {
    var std = W.std, feat = std && std.features && std.features['solana:signAndSendTransaction'];
    var fn = feat && (typeof feat === 'function' ? feat : feat.signAndSendTransaction);
    if (typeof fn === 'function') {
      var account = stdAccount();
      if (!account) throw new Error('Reconnect your wallet');
      var raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      return Promise.resolve(fn.call(feat, { account: account, chain: 'solana:mainnet', transaction: new Uint8Array(raw) })).then(sigText);
    }
    var p = W.provider;
    if (p && typeof p.signAndSendTransaction === 'function') return Promise.resolve(p.signAndSendTransaction(tx)).then(sigText);
    if (p && typeof p.signTransaction === 'function') {
      return p.signTransaction(tx).then(function (signedTx) {
        var serialized = signedTx.serialize();
        var binary = '';
        for (var i = 0; i < serialized.length; i++) binary += String.fromCharCode(serialized[i]);
        return { signedTransaction: btoa(binary) };
      });
    }
    throw new Error('Connect a wallet that can sign');
  }

  var discordUser = null, discordWallets = [], discordSure = '';
  var DISCORD_LOGIN = '/api/discord/auth?next=/preview/blupa1rs/';
  function discordName(u) { return (u && (u.global_name || u.username)) || 'Discord'; }
  function discordAvatar(u) {
    if (!u || !u.id) return '';
    if (u.avatar) {
      var ext = String(u.avatar).indexOf('a_') === 0 ? 'gif' : 'png';
      return 'https://cdn.discordapp.com/avatars/' + encodeURIComponent(u.id) + '/' + encodeURIComponent(u.avatar) + '.' + ext;
    }
    var n = 0;
    if (u.discriminator && u.discriminator !== '0') n = (parseInt(u.discriminator, 10) || 0) % 5;
    return 'https://cdn.discordapp.com/embed/avatars/' + n + '.png';
  }
  function discordLogo() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1A19.8 19.8 0 0 0 6.1 21l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8.3 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z');
    svg.appendChild(path);
    return svg;
  }
  function showDiscordMark(node) {
    if (!node) return;
    node.hidden = false;
    if (!node.firstChild) node.appendChild(discordLogo());
  }
  function paintDiscord() {
    var btn = $('discordBtn'), img = $('discordPfp'), label = $('discordName'), mark = $('discordMark');
    if (!btn || !label) return;
    if (!discordUser) {
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      showDiscordMark(mark);
      btn.classList.add('out');
      label.textContent = 'Sign in with Discord';
      btn.setAttribute('aria-label', 'Sign in with Discord');
      return;
    }
    btn.classList.remove('out');
    var name = discordName(discordUser);
    if (mark) mark.hidden = true;
    if (img) {
      img.hidden = false;
      img.alt = '';
      img.onerror = function () { img.hidden = true; showDiscordMark(mark); };
      img.src = discordAvatar(discordUser);
    }
    label.textContent = name;
    btn.setAttribute('aria-label', 'Discord account, ' + name);
  }
  function discordJson(url, opt) {
    opt = opt || {};
    opt.credentials = 'same-origin';
    opt.headers = opt.headers || { Accept: 'application/json' };
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || 'Request failed');
        return j;
      });
    });
  }
  function loadDiscordWallets() {
    if (!discordUser) { discordWallets = []; return Promise.resolve(); }
    return discordJson('/api/wallets').then(function (j) {
      discordWallets = Array.isArray(j.wallets) ? j.wallets.map(String) : [];
    }).catch(function () { discordWallets = []; });
  }
  function discordLinked(addr) {
    var a = String(addr || '').toLowerCase();
    return discordWallets.some(function (w) { return String(w).toLowerCase() === a; });
  }
  function discordAccount() {
    if (!discordUser) return;
    var head = el('div', 'dhead');
    var img = el('img'); img.alt = ''; img.src = discordAvatar(discordUser);
    var who = el('div');
    who.appendChild(el('b', null, discordName(discordUser)));
    if (discordUser.username) who.appendChild(el('small', null, '@' + discordUser.username));
    head.appendChild(img); head.appendChild(who);
    var nodes = [head, el('p', null, 'Wallets linked to this Discord. Ranks use one row for all of them.')];
    if (!discordWallets.length) nodes.push(el('p', 'muted', 'No wallets linked yet.'));
    discordWallets.forEach(function (w) {
      var row = el('div', 'dwallet');
      var b = el('b', null, shortAddr(w)); b.title = w;
      var u = el('button', null, discordSure === w ? 'Unlink?' : 'Unlink'); u.type = 'button';
      u.addEventListener('click', function () {
        if (discordSure !== w) { discordSure = w; discordAccount(); return; }
        u.disabled = true; u.textContent = 'Unlinking…';
        discordJson('/api/wallets-unlink', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ wallet: w }) })
          .then(function () {
            discordSure = '';
            discordWallets = discordWallets.filter(function (x) { return String(x).toLowerCase() !== String(w).toLowerCase(); });
            toast('Unlinked ' + shortAddr(w));
            discordAccount();
          })
          .catch(function () { discordSure = ''; toast('Could not unlink that wallet'); discordAccount(); });
      });
      row.appendChild(b); row.appendChild(u); nodes.push(row);
    });
    var pk = walletPk();
    if (pk && !discordLinked(pk)) {
      var link = el('button', 'sbtn primary', 'Link ' + shortAddr(pk)); link.type = 'button';
      link.addEventListener('click', function () {
        link.disabled = true; link.textContent = 'Linking…';
        discordJson('/api/wallets/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ wallet: pk }) })
          .then(function () { if (!discordLinked(pk)) discordWallets.push(pk); discordSure = ''; toast('Wallet linked'); return loadDiscordWallets(); })
          .then(function () { discordAccount(); })
          .catch(function () { toast('Could not link that wallet'); discordAccount(); });
      });
      nodes.push(link);
    }
    var out = el('button', 'sbtn', 'Sign out'); out.type = 'button';
    out.addEventListener('click', function () {
      out.disabled = true;
      discordJson('/api/discord/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
        .catch(function () {})
        .then(function () { discordUser = null; discordWallets = []; discordSure = ''; paintDiscord(); closeSheet(); toast('Signed out of Discord'); });
    });
    nodes.push(out);
    var mark = el('span', 'discordmark'); mark.appendChild(discordLogo());
    openSheet('Discord', nodes, mark);
  }
  function bootDiscord() {
    var q = new URLSearchParams(location.search);
    if (q.has('discord')) {
      if (q.get('discord') === 'error') toast('Discord sign-in did not finish. Try again.');
      q.delete('discord');
      var next = q.toString();
      history.replaceState(null, '', location.pathname + (next ? '?' + next : '') + location.hash);
    }
    showDiscordMark($('discordMark'));
    var btn = $('discordBtn');
    if (btn) btn.addEventListener('click', function () {
      if (!discordUser) { location.href = DISCORD_LOGIN; return; }
      loadDiscordWallets().then(discordAccount);
    });
    discordJson('/api/discord/me').then(function (j) {
      discordUser = j && j.connected && j.user ? j.user : null;
      paintDiscord();
      return loadDiscordWallets();
    }).catch(function () { discordUser = null; paintDiscord(); });
  }
  function registerWallets() {
    function onRegister() {
      [].slice.call(arguments).forEach(function (w) { if (w && typeof w === 'object' && STD.indexOf(w) < 0) STD.push(w); });
      return function () {};
    }
    var api = Object.freeze({ register: onRegister });
    try {
      window.addEventListener('wallet-standard:register-wallet', function (e) { try { if (e && typeof e.detail === 'function') e.detail(api); } catch (x) {} });
      window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
    } catch (e) {}
  }
  function autoConnect() {
    var deep = fromDeepLink();
    var kind = remembered();
    if (deep) {
      try {
        var u = new URL(location.href);
        u.searchParams.delete('wallet');
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (e) {}
    }
    if (!deep && !kind) return;
    var tries = 0;
    (function look() {
      if (W.pubkey || W.connecting) return;
      var list = walletList();
      var hit = list.filter(function (x) { return !kind || x.kind === kind; })[0] || (deep ? list[0] : null);
      if (hit) return connect(hit, !deep);
      if (++tries < 12) setTimeout(look, 150);
    })();
  }

  function frame() {
    var h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty('--vvh', Math.round(h) + 'px');
    var desk = window.matchMedia('(min-width: 700px) and (min-height: 600px)').matches;
    document.body.classList.toggle('desk', desk);
  }

  function boot() {
    frame();
    window.addEventListener('resize', frame);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', frame);
    paintTicker();
    $('sheetClose').addEventListener('click', closeSheet);
    $('sheetBg').addEventListener('click', closeSheet);
    $('howBtn').addEventListener('click', howSheet);
    $('prizesBtn').addEventListener('click', prizesSheet);
    $('connectBtn').addEventListener('click', onConnectClick);
    $('buyBtn').addEventListener('click', buyTurns);
    $('collectBtn').addEventListener('click', doCollect);
    $('homeLogo').addEventListener('click', function () { window.location.href = '/'; });
    $('homeLogo').style.cursor = 'pointer';
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('sheet').classList.contains('show')) closeSheet();
    });
    registerWallets();
    bootDiscord();
    autoConnect();
    fetch('/api/pairs/config', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (data.turnsPerBuy) cfg.turnsPerBuy = data.turnsPerBuy;
        if (data.costBlunana) cfg.costBlunana = data.costBlunana;
        paintCost();
      })
      .catch(function () {});
    fetch('/assets/collections/manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (manifest) {
        if (!manifest) return;
        Object.keys(manifest).forEach(function (slug) {
          if (manifest[slug]) state.localCollectionImages[slug] = '/assets/collections/' + manifest[slug];
        });
        render();
      })
      .catch(function () {});
    fetch('/api/collections', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.collections)) return;
        data.collections.forEach(function (c) {
          var img = c.animationUrl || c.image;
          if (c.symbol && img) state.collectionImages[c.symbol] = img;
        });
        render();
      })
      .catch(function () {});
    setTurns(0);
    syncWallet();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
