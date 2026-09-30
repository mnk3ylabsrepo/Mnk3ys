/**
 * Preview 2: holder portal — Discord + wallet verify (same flow as the main site), my holdings and the combined holders table.
 */
(function () {
  'use strict';

  var MAGIC_EDEN_WALLET = '1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix';
  var HOLDINGS = [
    { key: 'mnk3ys', html: 'MNK<span class="g">3</span>YS' },
    { key: 'zmb3ys', html: 'ZMB<span class="g">3</span>YS' },
    { key: 'blunana', html: '<span class="g">$</span>BLUNANA', token: true }
  ];

  var btn = document.getElementById('p2-portal-btn');
  var dialog = document.getElementById('p2-portal');
  if (!btn || !dialog) return;

  var el = function (id) { return document.getElementById(id); };
  var verifyBox = el('p2-verify');
  var mineBox = el('p2-mine');
  var walletPick = el('p2-wallet-pick');

  var discordUser = null;
  var me = null;
  var walletAddr = null;
  var managing = false;
  var flash = '';
  var meLoading = false;
  var meError = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shortWallet(w) {
    return w ? w.slice(0, 4) + '…' + w.slice(-4) : '—';
  }

  function fmt(n, digits) {
    return n == null || isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function compact(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return fmt(n, 0);
  }

  function amount(h, n) {
    if (!n) return '<span class="p2-muted">0</span>';
    return h.token ? compact(n) : fmt(n, 0);
  }

  function sol(n) {
    if (n == null || isNaN(n)) return '—';
    return fmt(n, n > 0 && n < 1 ? 3 : 2);
  }

  function usd(n) {
    return n == null || isNaN(n) ? '—' : '$' + fmt(n, n > 0 && n < 100 ? 2 : 0);
  }

  function getJson(url, opts) {
    return fetch(url, Object.assign({ credentials: 'include' }, opts)).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (body) {
        if (!r.ok || !body) {
          var err = new Error(body && body.error ? body.error : 'Data unavailable — try again shortly');
          err.status = r.status;
          throw err;
        }
        return body;
      });
    });
  }

  function discordAvatar(user) {
    if (user && user.id && user.avatar) {
      return 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.' + (user.avatar.indexOf('a_') === 0 ? 'gif' : 'png');
    }
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }

  // ——— Wallets (same providers as the main site) ———
  function detectedWallets() {
    var list = [];
    if (window.phantom && window.phantom.solana && window.phantom.solana.isPhantom) list.push({ name: 'Phantom', provider: window.phantom.solana });
    if (window.solflare && window.solflare.isSolflare) list.push({ name: 'Solflare', provider: window.solflare });
    if (window.solana && !list.some(function (w) { return w.provider === window.solana; })) {
      list.push({ name: window.solana.isPhantom ? 'Phantom' : window.solana.isSolflare ? 'Solflare' : 'Solana wallet', provider: window.solana });
    }
    return list;
  }

  function connectProvider(provider) {
    return Promise.resolve(provider.connect({ onlyIfTrusted: false })).then(function (res) {
      var pk = (res && res.publicKey) || provider.publicKey;
      if (!pk) throw new Error('Wallet did not return an address');
      walletAddr = pk.toString();
      walletPick.hidden = true;
      flash = pendingWallet() ? '' : 'That wallet is already linked';
      render();
    });
  }

  function showWalletPicker() {
    var wallets = detectedWallets();
    walletPick.hidden = false;
    if (!wallets.length) {
      walletPick.innerHTML = '<p class="p2-muted">No Solana wallet found in this browser. Install <a href="https://phantom.app" target="_blank" rel="noopener">Phantom</a> or <a href="https://solflare.com" target="_blank" rel="noopener">Solflare</a>, or open this page in your wallet app\'s browser.</p>';
      return;
    }
    if (wallets.length === 1) {
      walletPick.hidden = true;
      connectProvider(wallets[0].provider).catch(walletFailed);
      return;
    }
    walletPick.innerHTML = '';
    wallets.forEach(function (w) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'p2-pill';
      b.textContent = w.name;
      b.addEventListener('click', function () { connectProvider(w.provider).catch(walletFailed); });
      walletPick.appendChild(b);
    });
  }

  function walletFailed(err) {
    if (err && err.code === 4001) return;
    el('p2-step-wallet').textContent = (err && err.message) || 'Wallet connection failed';
  }

  // ——— Session + holdings ———
  function loadMe(fresh) {
    if (!discordUser) return Promise.resolve();
    meLoading = true;
    meError = '';
    render();
    var q = [];
    if (fresh) q.push('fresh=1');
    if (walletAddr) q.push('wallet=' + encodeURIComponent(walletAddr));
    return getJson('/api/portal-me' + (q.length ? '?' + q.join('&') : ''))
      .then(function (data) { me = data; })
      .catch(function (err) {
        if (err.status === 401) { discordUser = null; me = null; }
        else meError = err.message;
      })
      .then(function () { meLoading = false; render(); });
  }

  function linkedWallets() {
    return me ? me.wallets.filter(function (w) { return w.linked; }) : [];
  }

  function isVerified() {
    return !!discordUser && linkedWallets().length > 0;
  }

  // Connected in this browser but not linked to the Discord account yet
  function pendingWallet() {
    if (!walletAddr) return null;
    var lower = walletAddr.toLowerCase();
    return linkedWallets().some(function (w) { return w.wallet.toLowerCase() === lower; }) ? null : walletAddr;
  }

  function holdingsKey() {
    return me ? me.holdings.map(function (h) { return h.key + ':' + h.amount; }).join('|') : '';
  }

  function verify() {
    var before = holdingsKey();
    var pending = pendingWallet();
    var b = el('p2-btn-verify');
    b.disabled = true;
    b.textContent = pending ? 'Linking…' : 'Checking…';
    flash = '';
    var step = pending
      ? getJson('/api/wallets/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: pending })
      })
      : Promise.resolve();
    step
      .then(function () { return loadMe(true); })
      .then(function () {
        if (meError) throw new Error(meError);
        if (pending) flash = 'Wallet linked · holdings updated';
        else flash = holdingsKey() !== before ? 'Holdings updated' : 'Nothing to update · holdings are current';
        managing = false;
      })
      .catch(function (err) {
        if (err.status === 401) discordUser = null;
        flash = err.status === 401 ? 'Discord session expired — link Discord again' : (err.message || 'Verify failed');
      })
      .then(function () {
        b.textContent = 'Verify';
        render();
      });
  }

  function unlink(wallet, button) {
    button.disabled = true;
    button.textContent = 'Unlinking…';
    getJson('/api/wallets-unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: wallet })
    })
      .then(function () {
        if (walletAddr && walletAddr.toLowerCase() === wallet.toLowerCase()) walletAddr = null;
        flash = 'Unlinked ' + shortWallet(wallet);
        return loadMe();
      })
      .catch(function (err) {
        flash = err.message || 'Unlink failed';
        render();
      });
  }

  function logout() {
    fetch('/api/discord/logout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      .catch(function () {})
      .then(function () {
        discordUser = null;
        me = null;
        managing = false;
        flash = '';
        render();
      });
  }

  // ——— Render ———
  function setStep(stage, done, current, stateHtml) {
    var li = verifyBox.querySelector('[data-stage="' + stage + '"]');
    li.classList.toggle('is-done', !!done);
    li.classList.toggle('is-current', !!current);
    el('p2-step-' + stage).innerHTML = stateHtml;
  }

  function renderVerify() {
    var hasDiscord = !!discordUser;
    var linked = linkedWallets();
    var pending = pendingWallet();
    var current = !hasDiscord ? 'discord' : pending ? 'verify' : 'wallet';

    setStep('discord', hasDiscord, current === 'discord', hasDiscord
      ? 'Signed in as <span class="p2-discord">' + esc(discordUser.global_name || discordUser.username) + '</span>'
      : 'Sign in with Discord to start');
    el('p2-btn-discord').hidden = hasDiscord;
    el('p2-btn-signout-step').hidden = !hasDiscord;

    var walletState = !hasDiscord ? 'Link Discord first'
      : linked.length ? linked.length + ' linked wallet' + (linked.length === 1 ? '' : 's')
      : pending ? 'Wallet connected — verify to link it'
      : 'Phantom, Solflare or any Solana wallet';
    setStep('wallet', linked.length > 0 || !!pending, current === 'wallet', walletState);
    var wb = el('p2-btn-wallet');
    wb.disabled = !hasDiscord;
    wb.textContent = linked.length || walletAddr ? 'Connect another wallet' : 'Connect wallet';

    var list = el('p2-wallet-list');
    var items = linked.map(function (w) {
      return '<li><a href="https://solscan.io/account/' + esc(w.wallet) + '" target="_blank" rel="noopener">' + esc(shortWallet(w.wallet)) + '</a>' +
        '<span class="p2-wallets__tag g">Linked</span>' +
        '<button type="button" class="p2-link" data-unlink="' + esc(w.wallet) + '">Unlink</button></li>';
    });
    if (pending) {
      items.push('<li><span>' + esc(shortWallet(pending)) + '</span><span class="p2-wallets__tag">Not linked yet</span></li>');
    }
    list.innerHTML = items.join('');
    list.hidden = !hasDiscord || !items.length;

    var vb = el('p2-btn-verify');
    vb.disabled = !hasDiscord || (!pending && !linked.length) || meLoading;
    var verifyState = meLoading ? 'Loading holdings…'
      : flash ? esc(flash)
      : !hasDiscord ? 'Link Discord first'
      : pending ? 'Link ' + esc(shortWallet(pending)) + ' to your Discord'
      : linked.length ? 'Re-check your linked wallets to update holdings'
      : 'Connect a wallet first';
    setStep('verify', !!hasDiscord && linked.length > 0 && !pending, current === 'verify', verifyState);

    el('p2-btn-back').hidden = !isVerified();
  }

  function renderMine() {
    el('p2-mine-avatar').src = discordAvatar(me.user);
    el('p2-mine-name').textContent = me.user.name;
    var linked = linkedWallets();
    el('p2-mine-wallets').textContent = linked.length + ' linked wallet' + (linked.length === 1 ? '' : 's') + ': ' +
      linked.map(function (w) { return shortWallet(w.wallet); }).join(', ');
    var meta = el('p2-mine-meta');
    meta.classList.toggle('is-flash', !!flash && !meLoading && !meError);
    meta.innerHTML = meLoading ? 'Refreshing…' : meError ? esc(meError) :
      (flash ? esc(flash) + ' &middot; ' : '') + 'SOL ' + usd(me.solUsd) + ' &middot; updated ' + new Date(me.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var byKey = {};
    me.holdings.forEach(function (h) { byKey[h.key] = h; });
    el('p2-mine-rows').innerHTML = HOLDINGS.map(function (h) {
      var d = byKey[h.key] || {};
      return '<tr' + (d.amount ? '' : ' class="p2-muted"') + '><td>' + h.html + '</td><td class="num">' + amount(h, d.amount) + '</td><td class="num">' + sol(d.valueSol) + '</td><td class="num">' + usd(d.valueUsd) + '</td></tr>';
    }).join('');
    el('p2-mine-total').innerHTML = '<tr><td>Total</td><td></td><td class="num">' + sol(me.total.valueSol) + '</td><td class="num">' + usd(me.total.valueUsd) + '</td></tr>';
  }

  function render() {
    var verified = isVerified();
    btn.classList.toggle('is-locked', !verified);
    btn.setAttribute('aria-label', verified ? 'Holder portal' : 'Holder portal (locked)');
    var pfp = el('p2-portal-pfp');
    var pfpSrc = discordUser ? discordAvatar(discordUser) : '';
    if (pfp.getAttribute('src') !== pfpSrc) {
      if (pfpSrc) pfp.src = pfpSrc;
      else pfp.removeAttribute('src');
    }
    pfp.hidden = !pfpSrc;
    btn.classList.toggle('has-pfp', !!pfpSrc);

    var showMine = verified && !managing;
    mineBox.hidden = !showMine;
    verifyBox.hidden = showMine;
    if (showMine) renderMine();
    else renderVerify();
    markMyRow();
  }

  // ——— Holders tab ———
  var holdersPromise = null;
  var holdersData = null;
  var filterSel = el('p2-portal-filter');

  function loadHolders() {
    if (!holdersPromise) {
      el('p2-portal-meta').textContent = 'Loading all holdings…';
      holdersPromise = getJson('/api/portal-holders')
        .then(function (data) { holdersData = data; renderHolders(); })
        .catch(function (err) {
          holdersPromise = null;
          el('p2-portal-meta').textContent = err.message || 'Failed to load';
        });
    }
    return holdersPromise;
  }

  function holderCell(h) {
    if (h.discordName) return '<span class="p2-discord">' + esc(h.discordName) + '</span>' + (h.walletCount > 1 ? ' <span class="p2-muted">(' + h.walletCount + ')</span>' : '');
    if (h.wallet === MAGIC_EDEN_WALLET) return '<span class="p2-muted">Magic Eden</span>';
    if (h.wallet) return '<a href="https://solscan.io/account/' + esc(h.wallet) + '" target="_blank" rel="noopener">' + esc(shortWallet(h.wallet)) + '</a>';
    return '<span class="p2-muted">Discord user</span>';
  }

  function renderHolders() {
    if (!holdersData) return;
    var filter = filterSel.value;
    var m = holdersData.market || {};
    var unit = m.unitSol || {};
    var col = HOLDINGS.filter(function (c) { return c.key === filter; })[0];
    var cols = col ? [col] : HOLDINGS;

    // With a filter, value only that holding (NFTs at floor, $BLUNANA at live price)
    var rows = holdersData.holders
      .filter(function (h) { return cols.some(function (x) { return h[x.key] > 0; }); })
      .map(function (h) {
        if (!col) return { h: h, valueSol: h.valueSol, valueUsd: h.valueUsd };
        var vs = unit[col.key] != null ? h[col.key] * unit[col.key] : null;
        return { h: h, valueSol: vs, valueUsd: vs != null && m.solUsd != null ? vs * m.solUsd : null };
      });
    rows.sort(function (a, b) {
      return ((b.valueSol || 0) - (a.valueSol || 0)) || (col ? b.h[col.key] - a.h[col.key] : 0);
    });

    dialog.querySelector('.p2-portal__table').classList.toggle('is-filtered', !!col);
    el('p2-portal-head').innerHTML = '<tr><th>#</th><th>Holder</th>' +
      cols.map(function (c) { return '<th class="num">' + c.html + '</th>'; }).join('') +
      '<th class="num">SOL</th><th class="num">USDC</th></tr>';

    var meta = fmt(rows.length, 0) + ' holders';
    if (!col) meta += ' &middot; MNK3YS floor ' + sol(unit.mnk3ys) + ' &middot; ZMB3YS floor ' + sol(unit.zmb3ys) + ' SOL';
    else if (col.token) meta += ' &middot; valued at the live price';
    else if (unit[col.key] != null) meta += ' &middot; floor ' + sol(unit[col.key]) + ' SOL';
    else meta += ' &middot; no market floor';
    el('p2-portal-meta').innerHTML = meta;

    el('p2-portal-rows').innerHTML = rows.map(function (r, i) {
      return '<tr data-name="' + esc(r.h.discordName || '') + '"><td>' + (i + 1) + '</td><td>' + holderCell(r.h) + '</td>' +
        cols.map(function (c) { return '<td class="num">' + amount(c, r.h[c.key]) + '</td>'; }).join('') +
        '<td class="num">' + sol(r.valueSol) + '</td><td class="num">' + usd(r.valueUsd) + '</td></tr>';
    }).join('');
    markMyRow();
  }

  function markMyRow() {
    var name = isVerified() ? me.user.name : null;
    el('p2-portal-rows').querySelectorAll('tr').forEach(function (tr) {
      tr.classList.toggle('is-me', !!name && tr.getAttribute('data-name') === name);
    });
  }

  filterSel.addEventListener('change', renderHolders);

  // ——— Tabs + open ———
  function showTab(name) {
    dialog.querySelectorAll('.p2-tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    dialog.querySelectorAll('.p2-tabpanel').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== name;
    });
    if (name === 'holders') loadHolders();
  }

  dialog.querySelector('.p2-tabs').addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (t) showTab(t.getAttribute('data-tab'));
  });

  function openPortal(tab) {
    if (!dialog.open) dialog.showModal();
    showTab(tab || 'mine');
    render();
  }

  btn.addEventListener('click', function () { openPortal('mine'); });

  el('p2-btn-discord').addEventListener('click', function () {
    window.location.href = '/api/discord/auth?next=' + encodeURIComponent('/preview2');
  });
  el('p2-btn-wallet').addEventListener('click', showWalletPicker);
  el('p2-btn-verify').addEventListener('click', verify);
  el('p2-btn-manage').addEventListener('click', function () {
    managing = true;
    flash = '';
    render();
  });
  el('p2-btn-back').addEventListener('click', function () {
    managing = false;
    flash = '';
    render();
  });
  el('p2-wallet-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-unlink]');
    if (b) unlink(b.getAttribute('data-unlink'), b);
  });
  el('p2-btn-signout-step').addEventListener('click', logout);
  el('p2-btn-logout').addEventListener('click', logout);

  // ——— Boot ———
  var params = new URLSearchParams(window.location.search);
  var returnedFromDiscord = params.get('discord') === 'connected';
  if (params.has('discord')) {
    params.delete('discord');
    var qs = params.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
  }

  getJson('/api/discord/me')
    .then(function (data) {
      discordUser = data && data.connected ? data.user : null;
      var trusted = detectedWallets()[0];
      if (!discordUser || !trusted) return;
      return Promise.resolve(trusted.provider.connect({ onlyIfTrusted: true }))
        .then(function (res) {
          var pk = (res && res.publicKey) || trusted.provider.publicKey;
          if (pk) walletAddr = pk.toString();
        })
        .catch(function () {});
    })
    .catch(function () { discordUser = null; })
    .then(function () {
      render();
      if (returnedFromDiscord) openPortal('mine');
      return loadMe();
    });
})();
