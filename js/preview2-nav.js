/**
 * Preview 2: top nav (active link + mobile menu), page reveal, copy-to-clipboard pills.
 */
(function () {
  'use strict';

  var nav = document.getElementById('p2-nav');
  var toggle = document.getElementById('p2-nav-toggle');
  var links = Array.prototype.slice.call(document.querySelectorAll('.p2-nav__links a'));
  var pages = Array.prototype.slice.call(document.querySelectorAll('.p2-page'));
  var toast = document.getElementById('p2-toast');
  var toastTimer;

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });

  links.forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });

  function setNavEdge() {
    var last = links[links.length - 1];
    var right = last && last.getBoundingClientRect().right;
    if (right) {
      document.documentElement.style.setProperty('--p2-nav-right', (document.documentElement.clientWidth - right) + 'px');
    }
  }

  setNavEdge();
  window.addEventListener('resize', setNavEdge);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setNavEdge);

  function setActive(id) {
    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-section') === id);
    });
  }

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.25 });

    var activeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });

    pages.forEach(function (page) {
      revealObserver.observe(page);
      activeObserver.observe(page);
    });
  } else {
    pages.forEach(function (page) { page.classList.add('is-visible'); });
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 1800);
  }

  var liveBlocks = Array.prototype.slice.call(document.querySelectorAll('[data-live]'));
  var LIVE_POLL_MS = 60 * 1000;

  function num(n) {
    return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
  }

  function renderLive(data) {
    liveBlocks.forEach(function (block) {
      var s = data && data[block.getAttribute('data-live')];
      var ok = !!s && (s.holders != null || s.floorSol != null);
      block.classList.toggle('is-offline', !ok);
      block.querySelector('.p2-live__label').textContent = ok ? 'Live stats' : 'Stats offline';
      if (!s) return;
      var values = {
        holders: num(s.holders),
        staked: typeof s.stakedPct === 'number' ? s.stakedPct + '%' : '—',
        floor: typeof s.floorSol === 'number' ? s.floorSol.toFixed(s.floorSol < 1 ? 3 : 2) + ' SOL' : '—',
        listed: num(s.listed)
      };
      Object.keys(values).forEach(function (key) {
        var el = block.querySelector('[data-live-stat="' + key + '"]');
        if (el) el.textContent = values[key];
      });
      var stakedEl = block.querySelector('[data-live-stat="staked"]');
      if (stakedEl && typeof s.staked === 'number') stakedEl.title = num(s.staked) + ' staked';
    });
  }

  var priceBlocks = Array.prototype.slice.call(document.querySelectorAll('[data-live-price]'));

  // Tiny token prices: keep 4 significant digits without exponent notation
  function tokenPrice(n) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '—';
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(Math.min(14, 3 - Math.floor(Math.log10(n))));
  }

  function renderPrices(p) {
    priceBlocks.forEach(function (block) {
      var ok = !!p && typeof p.blunanaUsd === 'number';
      block.classList.toggle('is-offline', !ok);
      block.querySelector('.p2-live__label').textContent = ok ? 'Live price' : 'Price offline';
      if (!ok) return;
      block.querySelector('[data-price="usd"]').textContent = '$' + tokenPrice(p.blunanaUsd);
      block.querySelector('[data-price="sol"]').textContent = tokenPrice(p.blunanaPerSol);
    });
  }

  function pollLive() {
    if (document.hidden) return;
    if (liveBlocks.length) {
      fetch('/api/collection-live')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(renderLive);
    }
    if (priceBlocks.length) {
      fetch('/api/prices')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(renderPrices);
    }
  }

  if ((liveBlocks.length || priceBlocks.length) && window.fetch) {
    pollLive();
    setInterval(pollLive, LIVE_POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) pollLive(); });
  }

  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      var value = copyBtn.getAttribute('data-copy');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(value).then(function () { showToast('CA copied'); });
      } else {
        showToast(value);
      }
      return;
    }
    if (e.target.closest('[data-todo]')) {
      e.preventDefault();
      showToast('Coming soon');
    }
  });
})();
