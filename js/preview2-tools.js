/**
 * Preview 2: collection tool modals — MNK3YS holders table and rarity checker.
 */
(function () {
  'use strict';

  var MAGIC_EDEN_WALLET = '1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shortWallet(w) {
    return w ? w.slice(0, 4) + '…' + w.slice(-4) : '—';
  }

  function walletLink(w) {
    return '<a href="https://solscan.io/account/' + esc(w) + '" target="_blank" rel="noopener">' + esc(shortWallet(w)) + '</a>';
  }

  function fmt(n, digits) {
    return n == null || isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function getJson(url) {
    return fetch(url).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok) throw new Error(body && body.error ? body.error : 'Request failed');
        return body;
      });
    });
  }

  var solUsdPromise;
  function solUsd() {
    if (!solUsdPromise) {
      solUsdPromise = getJson('/api/prices').then(function (p) { return p && p.solUsd; }).catch(function () { return null; });
    }
    return solUsdPromise;
  }

  // ——— Modal open / close ———
  var loaders = {};

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-modal]');
    if (opener) {
      var modal = document.getElementById(opener.getAttribute('data-modal'));
      if (!modal) return;
      modal.showModal();
      if (loaders[modal.id]) loaders[modal.id]();
      return;
    }
    if (e.target.closest('[data-close]')) {
      e.target.closest('dialog').close();
      return;
    }
    if (e.target.tagName === 'DIALOG') e.target.close();
  });

  // ——— Holders ———
  var holdersLoaded = false;
  loaders['p2-holders'] = function () {
    if (holdersLoaded) return;
    holdersLoaded = true;
    var meta = document.getElementById('p2-holders-meta');
    var tbody = document.getElementById('p2-holders-rows');
    Promise.all([getJson('/api/mnk3ys/holders'), solUsd()])
      .then(function (res) {
        var data = res[0];
        var usd = res[1];
        var floor = data.floorSol;
        meta.innerHTML = fmt(data.holders.length, 0) + ' holders &middot; floor ' + (floor != null ? fmt(floor, 3) + ' SOL' : '—');
        tbody.innerHTML = data.holders.map(function (h, i) {
          var who;
          if (h.discordName) who = '<span class="p2-discord">' + esc(h.discordName) + '</span>' + (h.walletCount > 1 ? ' <span class="p2-muted">(' + h.walletCount + ' wallets)</span>' : '');
          else if (h.wallet === MAGIC_EDEN_WALLET) who = '<span class="p2-muted">Magic Eden</span>';
          else who = walletLink(h.wallet);
          var sol = floor != null ? h.count * floor : null;
          var usdc = sol != null && usd ? sol * usd : null;
          return '<tr><td>' + (i + 1) + '</td><td>' + who + '</td><td class="num">' + h.count + '</td><td class="num">' + fmt(sol, 2) + '</td><td class="num">' + (usdc != null ? '$' + fmt(usdc, 0) : '—') + '</td></tr>';
        }).join('');
      })
      .catch(function (err) {
        holdersLoaded = false;
        meta.textContent = err.message || 'Failed to load';
      });
  };

  // ——— Rarity checker ———
  var rankInput = document.getElementById('p2-rarity-rank');
  var result = document.getElementById('p2-rarity-result');
  var rarityForm = document.getElementById('p2-rarity-form');
  var lookupSeq = 0;
  var debounce;

  function lookup() {
    var rank = Math.min(5000, Math.max(1, parseInt(rankInput.value, 10) || 1));
    rankInput.value = rank;
    var seq = ++lookupSeq;
    result.innerHTML = '<p class="p2-muted">Loading rank ' + rank + '…</p>';
    getJson('/api/mnk3ys/rarity?rank=' + rank)
      .then(function (d) {
        if (seq !== lookupSeq) return;
        var owner = d.ownerDiscord
          ? '<span class="p2-discord">' + esc(d.ownerDiscord) + '</span>'
          : d.owner ? walletLink(d.owner) : '—';
        var listing = d.listing
          ? '<a class="p2-listed" href="' + esc(d.listing.url) + '" target="_blank" rel="noopener">Listed &middot; ' + fmt(d.listing.priceSol, 3) + ' SOL</a>'
          : '<span class="p2-muted">Not listed</span>';
        var traits = d.attributes.map(function (t) {
          return '<li><span class="p2-trait__type">' + esc(t.type) + '</span><span class="p2-trait__value">' + esc(t.value) + '</span><span class="p2-trait__pct">' + (t.pct != null ? t.pct + '%' : '') + '</span></li>';
        }).join('');
        result.innerHTML =
          '<div class="p2-rarity">' +
            (d.image ? '<img class="p2-rarity__img" src="' + esc(d.image) + '" alt="' + esc(d.name) + '" />' : '') +
            '<div class="p2-rarity__info">' +
              '<p class="p2-rarity__name">' + esc(d.name || 'MNK3Y') + '</p>' +
              '<p class="p2-rarity__rank">Rank <span class="g">#' + d.rank + '</span> of ' + fmt(d.supply, 0) + '</p>' +
              '<dl class="p2-rarity__facts"><dt>Owner</dt><dd>' + owner + '</dd><dt>Status</dt><dd>' + listing + '</dd></dl>' +
              '<ul class="p2-traits">' + traits + '</ul>' +
            '</div>' +
          '</div>';
      })
      .catch(function (err) {
        if (seq !== lookupSeq) return;
        result.innerHTML = '<p class="p2-muted">' + esc(err.message || 'Lookup failed') + '</p>';
      });
  }

  var rarityLoaded = false;
  loaders['p2-rarity'] = function () {
    if (rarityLoaded) return;
    rarityLoaded = true;
    lookup();
  };

  rarityForm.addEventListener('submit', function (e) {
    e.preventDefault();
    lookup();
  });

  rankInput.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(lookup, 450);
  });

  rarityForm.addEventListener('click', function (e) {
    var step = e.target.closest('[data-step]');
    if (!step) return;
    rankInput.value = (parseInt(rankInput.value, 10) || 1) + parseInt(step.getAttribute('data-step'), 10);
    lookup();
  });
})();
