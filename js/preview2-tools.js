/**
 * Preview 2: tool modals — holders tables (MNK3YS, ZMB3YS, $BLUNANA), rarity checker and $BLUNANA price chart.
 */
(function () {
  'use strict';

  var MAGIC_EDEN_WALLET = '1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix';

  var COLLECTIONS = {
    mnk3ys: { nameHtml: 'MNK<span class="g">3</span>YS', item: 'MNK3Y', limits: { rank: [1, 5000], number: [0, 4999] } },
    zmb3ys: { nameHtml: 'ZMB<span class="g">3</span>YS', item: 'ZMB3Y', limits: { rank: [1, 5550], number: [0, 5554] } },
    blunana: { nameHtml: '<span class="g">$</span>BLUNANA', unit: '$BLUNANA', token: true }
  };

  var DEXTOOLS_URL = 'https://www.dextools.io/app/solana/pair-explorer/xf1K6QsfF7YWKo4hvMVQwn3t8U9yafnsFP3yByw7UJc';
  var CHART_LIB_URL = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js';

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

  function compact(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return fmt(n, 0);
  }

  // Tiny token prices: keep 4 significant digits without exponent notation
  function tokenPrice(n) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '—';
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(Math.min(14, 3 - Math.floor(Math.log10(n))));
  }

  function getJson(url) {
    return fetch(url).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (body) {
        if (!r.ok || !body) throw new Error(body && body.error ? body.error : 'Data unavailable — try again shortly');
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
      var slug = COLLECTIONS[opener.getAttribute('data-collection')] ? opener.getAttribute('data-collection') : 'mnk3ys';
      modal.showModal();
      if (loaders[modal.id]) loaders[modal.id](slug);
      return;
    }
    if (e.target.closest('[data-close]')) {
      e.target.closest('dialog').close();
      return;
    }
    if (e.target.tagName === 'DIALOG') e.target.close();
  });

  // ——— Holders ———
  var holdersRequests = {};
  var holdersSlug = null;
  loaders['p2-holders'] = function (slug) {
    var meta = document.getElementById('p2-holders-meta');
    var tbody = document.getElementById('p2-holders-rows');
    if (slug !== holdersSlug) {
      holdersSlug = slug;
      document.getElementById('p2-holders-name').innerHTML = COLLECTIONS[slug].nameHtml;
      document.getElementById('p2-holders-unit').textContent = COLLECTIONS[slug].unit || 'NFTs';
      meta.textContent = 'Loading…';
      tbody.innerHTML = '';
    }
    if (!holdersRequests[slug]) holdersRequests[slug] = Promise.all([getJson('/api/' + slug + '-holders'), solUsd()]);
    holdersRequests[slug]
      .then(function (res) {
        if (slug !== holdersSlug) return;
        var data = res[0];
        var usd = res[1];
        var token = COLLECTIONS[slug].token;
        var unitSol = token ? data.priceSol : data.floorSol;
        meta.innerHTML = fmt(data.holders.length, 0) + ' holders &middot; ' + (token
          ? 'price ' + (data.priceUsd != null ? '$' + tokenPrice(data.priceUsd) : '—')
          : 'floor ' + (unitSol != null ? fmt(unitSol, 3) + ' SOL' : '—'));
        tbody.innerHTML = data.holders.map(function (h, i) {
          var who;
          if (h.discordName) who = '<span class="p2-discord">' + esc(h.discordName) + '</span>' + (h.walletCount > 1 ? ' <span class="p2-muted">(' + h.walletCount + ' wallets)</span>' : '');
          else if (h.wallet === MAGIC_EDEN_WALLET) who = '<span class="p2-muted">Magic Eden</span>';
          else who = walletLink(h.wallet);
          var sol = unitSol != null ? h.count * unitSol : null;
          var usdc = token && data.priceUsd != null ? h.count * data.priceUsd : sol != null && usd ? sol * usd : null;
          return '<tr><td>' + (i + 1) + '</td><td>' + who + '</td><td class="num">' + (token ? compact(h.count) : h.count) + '</td><td class="num">' + fmt(sol, 2) + '</td><td class="num">' + (usdc != null ? '$' + fmt(usdc, 0) : '—') + '</td></tr>';
        }).join('');
      })
      .catch(function (err) {
        delete holdersRequests[slug];
        if (slug !== holdersSlug) return;
        meta.textContent = err.message || 'Failed to load';
      });
  };

  // ——— Rarity checker ———
  var inputs = {
    rank: document.getElementById('p2-rarity-rank'),
    number: document.getElementById('p2-rarity-number')
  };
  var media = document.getElementById('p2-rarity-media');
  var stats = document.getElementById('p2-rarity-stats');
  var traitList = document.getElementById('p2-rarity-traits');
  var rarityForm = document.getElementById('p2-rarity-form');
  var raritySlug = null;
  var mode = 'rank';
  var lookupSeq = 0;
  var debounce;

  function lookup(nextMode) {
    if (nextMode) mode = nextMode;
    var input = inputs[mode];
    var other = inputs[mode === 'rank' ? 'number' : 'rank'];
    var lim = COLLECTIONS[raritySlug].limits[mode];
    var n = parseInt(input.value, 10);
    n = Math.min(lim[1], Math.max(lim[0], isNaN(n) ? lim[0] : n));
    input.value = n;
    var seq = ++lookupSeq;
    stats.innerHTML = '<p class="p2-muted">Loading ' + (mode === 'rank' ? 'rank ' : COLLECTIONS[raritySlug].item + ' #') + n + '…</p>';
    getJson('/api/' + raritySlug + '-rarity?' + mode + '=' + n)
      .then(function (d) {
        if (seq !== lookupSeq) return;
        var num = /#(\d+)/.exec(d.name || '');
        inputs.rank.value = d.rank || '';
        inputs.number.value = num ? num[1] : '';
        var owner = d.ownerDiscord
          ? '<span class="p2-discord">' + esc(d.ownerDiscord) + '</span>'
          : d.owner ? walletLink(d.owner) : '—';
        var listing = d.listing
          ? '<a class="p2-listed" href="' + esc(d.listing.url) + '" target="_blank" rel="noopener">Listed &middot; ' + fmt(d.listing.priceSol, 3) + ' SOL</a>'
          : '<span class="p2-muted">Not listed</span>';
        media.innerHTML = d.image ? '<img class="p2-rarity__img" src="' + esc(d.image) + '" alt="' + esc(d.name) + '" />' : '';
        stats.innerHTML =
          '<p class="p2-rarity__name">' + esc(d.name || COLLECTIONS[raritySlug].item) + '</p>' +
          '<p class="p2-rarity__rank">' + (d.rank ? 'Rank <span class="g">#' + d.rank + '</span> of ' + fmt(d.supply, 0) : 'Unranked') + '</p>' +
          '<dl class="p2-rarity__facts"><dt>Owner</dt><dd>' + owner + '</dd><dt>Status</dt><dd>' + listing + '</dd></dl>';
        traitList.innerHTML = d.attributes.map(function (t) {
          return '<li><span class="p2-trait__type">' + esc(t.type) + '</span><span class="p2-trait__value">' + esc(t.value) + '</span><span class="p2-trait__pct">' + (t.pct != null ? t.pct + '%' : '') + '</span></li>';
        }).join('');
      })
      .catch(function (err) {
        if (seq !== lookupSeq) return;
        other.value = '';
        media.innerHTML = '';
        traitList.innerHTML = '';
        stats.innerHTML = '<p class="p2-muted">' + esc(err.message || 'Lookup failed') + '</p>';
      });
  }

  loaders['p2-rarity'] = function (slug) {
    if (slug === raritySlug) return;
    raritySlug = slug;
    var limits = COLLECTIONS[slug].limits;
    Object.keys(inputs).forEach(function (m) {
      inputs[m].min = limits[m][0];
      inputs[m].max = limits[m][1];
    });
    inputs.rank.value = 1;
    inputs.number.value = '';
    media.innerHTML = '';
    traitList.innerHTML = '';
    lookup('rank');
  };

  rarityForm.addEventListener('submit', function (e) {
    e.preventDefault();
    lookup();
  });

  Object.keys(inputs).forEach(function (m) {
    inputs[m].addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { lookup(m); }, 450);
    });
    inputs[m].addEventListener('focus', function () { mode = m; });
  });

  rarityForm.addEventListener('click', function (e) {
    var step = e.target.closest('[data-step]');
    if (!step) return;
    var m = step.closest('[data-mode]').getAttribute('data-mode');
    var input = inputs[m];
    var current = parseInt(input.value, 10);
    input.value = (isNaN(current) ? COLLECTIONS[raritySlug].limits[m][0] : current) + parseInt(step.getAttribute('data-step'), 10);
    lookup(m);
  });

  // ——— $BLUNANA price chart ———
  var chartLibPromise;
  function loadChartLib() {
    if (window.LightweightCharts) return Promise.resolve(window.LightweightCharts);
    if (!chartLibPromise) {
      chartLibPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = CHART_LIB_URL;
        s.onload = function () { resolve(window.LightweightCharts); };
        s.onerror = function () { chartLibPromise = null; reject(new Error('Chart library failed to load')); };
        document.head.appendChild(s);
      });
    }
    return chartLibPromise;
  }

  // Price axis for sub-penny values (library defaults would show 0.00)
  function chartPriceFormat(v) {
    var a = Math.abs(v);
    if (a >= 1) return v.toFixed(4);
    if (a >= 1e-12) return v.toFixed(Math.min(14, Math.max(6, 2 - Math.floor(Math.log10(a)))));
    return v.toExponential(4);
  }

  function chartNote(source) {
    var what = source === 'birdeye'
      ? '15-minute candles for the last 7 days, via Birdeye.'
      : '15-minute candles from the main $BLUNANA pool only (via GeckoTerminal), up to the last 500 candles (about 5 days). Trades in other pools aren\'t included and quiet periods with no trades show as gaps.';
    return 'Preview chart: ' + what + ' Data can lag a few minutes. For full history, other timeframes and indicators, ' +
      '<a href="' + DEXTOOLS_URL + '" target="_blank" rel="noopener">open the full chart on DEXTools &rarr;</a>';
  }

  var chartLoaded = false;
  loaders['p2-chart'] = function () {
    if (chartLoaded) return;
    chartLoaded = true;
    var canvas = document.getElementById('p2-chart-canvas');
    var meta = document.getElementById('p2-chart-meta');
    var note = document.getElementById('p2-chart-note');
    canvas.innerHTML = '';
    Promise.all([getJson('/api/blunana-ohlc?type=15m'), getJson('/api/prices').catch(function () { return null; }), loadChartLib()])
      .then(function (res) {
        var data = res[0];
        var p = res[1];
        var items = data && data.data && data.data.items ? data.data.items : [];
        note.innerHTML = chartNote(data.source);
        if (p && p.blunanaUsd != null) {
          var change = typeof p.priceChange24h === 'number'
            ? ' <span class="' + (p.priceChange24h >= 0 ? 'g' : 'p2-neg') + '">' + (p.priceChange24h >= 0 ? '+' : '') + p.priceChange24h.toFixed(2) + '% 24h</span>'
            : '';
          meta.innerHTML = '$' + tokenPrice(p.blunanaUsd) + ' &middot; ' + tokenPrice(p.blunanaPerSol) + ' SOL' + change;
        } else {
          meta.textContent = '';
        }
        if (!items.length) throw new Error(data.message || 'No chart data right now');
        var candles = items.map(function (c) {
          return { time: c.unix_time, open: c.o, high: c.h, low: c.l, close: c.c };
        }).sort(function (a, b) { return a.time - b.time; });
        var chart = res[2].createChart(canvas, {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          layout: { background: { color: 'transparent' }, textColor: '#9a9a9a', fontFamily: 'inherit' },
          grid: { vertLines: { color: 'rgba(255,255,255,0.06)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
          timeScale: { borderColor: 'rgba(34,245,58,0.35)', timeVisible: true, secondsVisible: false },
          rightPriceScale: { borderColor: 'rgba(34,245,58,0.35)', scaleMargins: { top: 0.1, bottom: 0.15 } }
        });
        var series = chart.addCandlestickSeries({
          priceFormat: { type: 'custom', minMove: 1e-15, formatter: chartPriceFormat },
          upColor: '#22f53a',
          downColor: '#f87171',
          borderUpColor: '#22f53a',
          borderDownColor: '#f87171',
          wickUpColor: '#22f53a',
          wickDownColor: '#f87171'
        });
        series.setData(candles);
        chart.timeScale().fitContent();
        if (window.ResizeObserver) {
          new ResizeObserver(function () {
            chart.applyOptions({ width: canvas.clientWidth, height: canvas.clientHeight });
          }).observe(canvas);
        }
      })
      .catch(function (err) {
        chartLoaded = false;
        canvas.innerHTML = '<p class="p2-muted p2-chart__empty">' + esc(err.message || 'Chart unavailable') + '</p>';
      });
  };
})();
