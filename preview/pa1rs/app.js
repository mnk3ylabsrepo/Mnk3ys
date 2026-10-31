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
  function providers() {
    return [window.solflare, window.solana, window.backpack, window.glow];
  }
  function walletPk() {
    var list = providers();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].publicKey) return list[i].publicKey.toString();
    }
    return null;
  }
  function walletProvider() {
    var list = providers();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p && p.publicKey && typeof p.signTransaction === 'function') return p;
    }
    return null;
  }
  function detected() {
    var list = [];
    if (window.solflare) list.push({ name: 'Solflare', provider: window.solflare });
    if (window.backpack) list.push({ name: 'Backpack', provider: window.backpack });
    if (window.glow) list.push({ name: 'Glow', provider: window.glow });
    if (window.solana && !list.some(function (x) { return x.provider === window.solana; })) {
      var name = window.solana.isPhantom ? 'Phantom' : window.solana.isSolflare ? 'Solflare' : 'Solana';
      list.push({ name: name, provider: window.solana });
    }
    return list;
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
    var btn = $('connectBtn');
    var pk = walletPk();
    if (pk) {
      btn.textContent = '👛 ' + shortAddr(pk);
      var bal = $('bal');
      bal.textContent = '…';
      fetch('/api/verify?wallet=' + encodeURIComponent(pk), { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          bal.textContent = data && data.blunanaFormatted != null ? data.blunanaFormatted : '—';
        })
        .catch(function () { bal.textContent = '—'; });
    } else {
      btn.textContent = '👛 Connect wallet';
      $('bal').textContent = '—';
    }
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

  function openSheet(title, node) {
    var titleEl = $('sheetTitle');
    var body = $('sheetBody');
    titleEl.textContent = title;
    body.textContent = '';
    body.appendChild(node);
    $('sheetBg').classList.add('show');
    $('sheet').classList.add('show');
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

  function walletSheet() {
    var pk = walletPk();
    var body = el('div');
    if (pk) {
      body.appendChild(el('p', null, shortAddr(pk)));
      var off = el('button', 'sbtn', 'Disconnect');
      off.type = 'button';
      off.addEventListener('click', function () {
        var p = walletProvider();
        var done = function () { closeSheet(); syncWallet(); load(); };
        if (p && typeof p.disconnect === 'function') p.disconnect().then(done).catch(done);
        else done();
      });
      body.appendChild(off);
      openSheet('Wallet', body);
      return;
    }
    var wallets = detected();
    if (!wallets.length) {
      body.appendChild(el('p', null, 'No Solana wallet found in this browser. Install Phantom, Solflare, Backpack, or Glow, then refresh.'));
      openSheet('Connect wallet', body);
      return;
    }
    wallets.forEach(function (w) {
      var b = el('button', 'sbtn', w.name);
      b.type = 'button';
      b.addEventListener('click', function () {
        closeSheet();
        w.provider.connect({ onlyIfTrusted: false }).then(function () {
          syncWallet();
          load();
        }).catch(function (err) {
          if (!(err && err.code === 4001)) setMsg('Wallet connect failed', true);
        });
      });
      body.appendChild(b);
    });
    openSheet('Connect wallet', body);
  }

  function doCollect() {
    if (!walletPk()) { setMsg('Connect a wallet to collect', true); walletSheet(); return; }
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
    if (!pk) { setMsg('Connect a wallet first', true); walletSheet(); return; }
    var provider = walletProvider();
    if (!provider) { setMsg('Connect a wallet that can sign', true); return; }
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
        if (typeof provider.signAndSendTransaction === 'function') {
          return provider.signAndSendTransaction(tx).then(function (result) {
            var sig = result && (result.signature || result.transactionSignature || (typeof result === 'string' ? result : null));
            if (!sig) throw new Error('No signature from wallet');
            if (typeof sig !== 'string' && sig.toString) sig = sig.toString();
            return fetch('/api/pairs/buy', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({ signature: sig, wallet: pk })
            });
          });
        }
        return provider.signTransaction(tx).then(function (signedTx) {
          setMsg('Submitting…');
          var serialized = signedTx.serialize();
          var binary = '';
          for (var i = 0; i < serialized.length; i++) binary += String.fromCharCode(serialized[i]);
          return fetch('/api/pairs/buy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ signedTransaction: btoa(binary), wallet: pk })
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
    $('connectBtn').addEventListener('click', walletSheet);
    $('buyBtn').addEventListener('click', buyTurns);
    $('collectBtn').addEventListener('click', doCollect);
    $('homeLogo').addEventListener('click', function () { window.location.href = '/'; });
    $('homeLogo').style.cursor = 'pointer';
    detected().forEach(function (w) {
      if (w.provider && typeof w.provider.on === 'function') {
        w.provider.on('accountChanged', function () { syncWallet(); load(); });
      }
    });
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
