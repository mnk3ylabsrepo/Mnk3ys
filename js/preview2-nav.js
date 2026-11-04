/**
 * Preview 2: bottom-left orbit nav (scroll momentum), page reveal, live stats, copy pills.
 */
(function () {
  'use strict';

  var GORILLA = '/assets/preview2/gorilla-logo.png';
  var NAV = '/assets/preview2/nav/';

  var ICONS = {
    home: '<img src="' + GORILLA + '" alt="" class="orbit-bubble__img" draggable="false">',
    mnk3ys: '<img src="' + NAV + 'mnk3ys.png" alt="" class="orbit-bubble__img orbit-bubble__img--cover" draggable="false">',
    zmb3ys: '<img src="' + NAV + 'zmb3ys.png" alt="" class="orbit-bubble__img orbit-bubble__img--cover" draggable="false">',
    blunana: '<img src="' + NAV + 'blunana.png" alt="" class="orbit-bubble__img orbit-bubble__img--cover" draggable="false">',
    games: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4"/><circle cx="17" cy="10" r="1"/><circle cx="15" cy="14" r="1"/></svg>',
    lp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    utility: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    b3bs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-1.5 3-4 5-4 8a4 4 0 0 0 8 0c0-3-2.5-5-4-8z"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
    services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    partners: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  };

  var PAGES = [
    { id: 'home', label: 'Home' },
    { id: 'mnk3ys', label: 'MNK3YS' },
    { id: 'zmb3ys', label: 'ZMB3YS' },
    { id: 'blunana', label: '$BLUNANA' },
    { id: 'games', label: 'GAM3S' },
    { id: 'lp', label: 'LP' },
    { id: 'utility', label: 'Utility' },
    { id: 'b3bs', label: 'B3BS' },
    { id: 'services', label: 'S3RV1CES' },
    { id: 'partners', label: 'Partners' }
  ].filter(function (p) {
    var el = document.getElementById(p.id);
    return el && !el.hasAttribute('hidden');
  });

  var stageEl = document.getElementById('orbit-nav-stage');
  var labelEl = document.getElementById('orbit-nav-label');
  var sections = PAGES.map(function (p) { return document.getElementById(p.id); }).filter(Boolean);
  var pages = Array.prototype.slice.call(document.querySelectorAll('.p2-page:not([hidden])'));
  var bubbles = [];
  var activeIndex = 0;
  var scrollInProgress = false;
  var scrollTimer = null;
  var scrollLoopActive = false;
  var scrollEndTimer = null;
  var isTracking = false;
  var toast = document.getElementById('p2-toast');
  var toastTimer;

  function setScrollTracking(active) {
    if (!stageEl || isTracking === active) return;
    isTracking = active;
    stageEl.classList.toggle('orbit-nav--tracking', active);
  }

  function markScrollActivity() {
    setScrollTracking(true);
  }

  function readSizes() {
    var root = getComputedStyle(document.body);
    return {
      lg: parseFloat(root.getPropertyValue('--orb-primary')) || 96,
      near: parseFloat(root.getPropertyValue('--orb-near')) || 58,
      sm: parseFloat(root.getPropertyValue('--orb-secondary')) || 46,
      gap: parseFloat(root.getPropertyValue('--orb-gap')) || 12
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function pageIcon(id) { return ICONS[id] || ICONS.home; }

  function slotSize(slot, sizes) {
    return slot === 0 ? sizes.near : sizes.sm;
  }

  function belowSlotX(slot, sizes) {
    var x = sizes.lg + sizes.gap;
    for (var s = 0; s < slot; s++) x += slotSize(s, sizes) + sizes.gap;
    return x;
  }

  function aboveSlotY(slot, sizes) {
    var y = sizes.lg + sizes.gap;
    for (var s = 0; s < slot; s++) y += slotSize(s, sizes) + sizes.gap;
    return y;
  }

  function getBubbleLayout(activeIdx, bubbleIdx, sizes) {
    var dist = bubbleIdx - activeIdx;
    if (dist === 0) {
      return { x: 0, y: 0, size: sizes.lg, active: true, opacity: 1, z: 20 };
    }
    if (dist < 0) {
      var slotAbove = -dist - 1;
      return {
        x: 0,
        y: -aboveSlotY(slotAbove, sizes),
        size: slotSize(slotAbove, sizes),
        active: false,
        opacity: Math.max(0.5, 1 - slotAbove * 0.1),
        z: 12 - slotAbove
      };
    }
    var slotBelow = dist - 1;
    return {
      x: belowSlotX(slotBelow, sizes),
      y: 0,
      size: slotSize(slotBelow, sizes),
      active: false,
      opacity: Math.max(0.5, 1 - slotBelow * 0.1),
      z: 12 - slotBelow
    };
  }

  function lerpLayoutRoll(a, b, t) {
    var size = lerp(a.size, b.size, t);
    var opacity = lerp(a.opacity, b.opacity, t);
    var active = a.active ? t < 0.55 : b.active ? t >= 0.45 : false;
    var z = active ? 20 : Math.max(a.z, b.z);
    var aBottom = Math.abs(a.y) < 0.5;
    var bBottom = Math.abs(b.y) < 0.5;
    var aAbove = a.y < -0.5;
    var bAbove = b.y < -0.5;

    if (aBottom && bBottom) return { x: lerp(a.x, b.x, t), y: 0, size: size, active: active, opacity: opacity, z: z };
    if (aAbove && bAbove) return { x: 0, y: lerp(a.y, b.y, t), size: size, active: active, opacity: opacity, z: z };
    if ((aBottom && bAbove) || (bBottom && aAbove)) {
      return { x: 0, y: lerp(a.y, b.y, t), size: size, active: active, opacity: opacity, z: z };
    }
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), size: size, active: active, opacity: opacity, z: z };
  }

  function applyBubbleLayout(bubble, layout, animate) {
    bubble.style.setProperty('--bx', layout.x + 'px');
    bubble.style.setProperty('--by', layout.y + 'px');
    bubble.style.setProperty('--bs', layout.size + 'px');
    bubble.style.setProperty('--bo', String(layout.opacity));
    bubble.style.zIndex = String(layout.z);
    bubble.classList.toggle('orbit-bubble--active', layout.active);
    if (layout.active) bubble.setAttribute('aria-current', 'page');
    else bubble.removeAttribute('aria-current');
    if (animate === false) {
      bubble.classList.add('orbit-bubble--instant');
      requestAnimationFrame(function () { bubble.classList.remove('orbit-bubble--instant'); });
    }
  }

  function resizeStage(activeIdx, sizes) {
    if (!stageEl) return;
    var below = PAGES.length - 1 - activeIdx;
    var above = activeIdx;
    var w = sizes.lg;
    for (var b = 0; b < below; b++) w += sizes.gap + slotSize(b, sizes);
    var h = sizes.lg;
    for (var a = 0; a < above; a++) h += sizes.gap + slotSize(a, sizes);
    stageEl.style.width = (w + 4) + 'px';
    stageEl.style.height = (h + 4) + 'px';
  }

  function layoutOrbit(activeIdx, blendToIdx, blendT, animate) {
    var sizes = readSizes();
    var t = typeof blendT === 'number' ? Math.max(0, Math.min(1, blendT)) : 1;
    var fromIdx = activeIdx;
    var toIdx = typeof blendToIdx === 'number' ? blendToIdx : activeIdx;

    bubbles.forEach(function (bubble, i) {
      var layoutA = getBubbleLayout(fromIdx, i, sizes);
      var layoutB = getBubbleLayout(toIdx, i, sizes);
      var layout = fromIdx === toIdx ? layoutA : lerpLayoutRoll(layoutA, layoutB, t);
      applyBubbleLayout(bubble, layout, animate);
    });

    var displayIdx = fromIdx !== toIdx && t >= 0.5 ? toIdx : fromIdx;
    resizeStage(displayIdx, sizes);
    if (labelEl) labelEl.textContent = PAGES[displayIdx].label;
  }

  function getScrollBlend() {
    if (!sections.length) return { from: 0, to: 0, t: 0 };
    var refY = window.innerHeight * 0.2;
    var blendDistance = Math.max(window.innerHeight * 0.5, 280);
    var last = sections.length - 1;
    var activeIdx = 0;

    for (var i = last; i >= 0; i--) {
      if (sections[i].getBoundingClientRect().top <= refY) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx < last) {
      var nextTop = sections[activeIdx + 1].getBoundingClientRect().top;
      if (nextTop < refY + blendDistance) {
        var t = 1 - (nextTop - refY) / blendDistance;
        t = Math.max(0, Math.min(1, t));
        if (t > 0.001) return { from: activeIdx, to: activeIdx + 1, t: t };
      }
    }
    return { from: activeIdx, to: activeIdx, t: 0 };
  }

  function syncOrbitFromScroll() {
    var blend = getScrollBlend();
    layoutOrbit(blend.from, blend.to, blend.t, true);
    var resolved = blend.from === blend.to ? blend.from : (blend.t >= 0.5 ? blend.to : blend.from);
    if (resolved !== activeIndex) {
      activeIndex = resolved;
      window.history.replaceState(null, '', '#' + PAGES[activeIndex].id);
    }
  }

  function runScrollLoop() {
    syncOrbitFromScroll();
    if (scrollLoopActive) requestAnimationFrame(runScrollLoop);
  }

  function scheduleLayout() {
    markScrollActivity();
    if (!scrollLoopActive) {
      scrollLoopActive = true;
      requestAnimationFrame(runScrollLoop);
    }
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(function () {
      scrollLoopActive = false;
      setScrollTracking(false);
      syncOrbitFromScroll();
    }, 160);
  }

  function scrollToIndex(index) {
    var section = sections[index];
    if (!section) return;
    scrollInProgress = true;
    activeIndex = index;
    window.history.replaceState(null, '', '#' + PAGES[index].id);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      scrollInProgress = false;
      layoutOrbit(index, index, 0, true);
    }, 850);
  }

  function indexFromHash() {
    var hash = (window.location.hash || '').slice(1);
    var idx = PAGES.findIndex(function (p) { return p.id === hash; });
    return idx >= 0 ? idx : 0;
  }

  function buildBubbles() {
    if (!stageEl) return;
    stageEl.innerHTML = '';
    bubbles = PAGES.map(function (page, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'orbit-bubble';
      btn.setAttribute('data-section', page.id);
      btn.setAttribute('data-index', String(index));
      btn.setAttribute('aria-label', page.label);
      btn.innerHTML = '<span class="orbit-bubble__inner">' + pageIcon(page.id) + '</span>';
      btn.addEventListener('click', function () { scrollToIndex(index); });
      stageEl.appendChild(btn);
      return btn;
    });
  }

  buildBubbles();
  activeIndex = indexFromHash();
  layoutOrbit(activeIndex, activeIndex, 0, false);
  if (PAGES[activeIndex] && window.location.hash.slice(1) === PAGES[activeIndex].id) {
    requestAnimationFrame(function () {
      var section = sections[activeIndex];
      if (section) section.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }

  window.addEventListener('scroll', scheduleLayout, { passive: true });
  window.addEventListener('resize', function () { syncOrbitFromScroll(); }, { passive: true });

  /* ——— Page reveal ——— */
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.25 });
    pages.forEach(function (page) { revealObserver.observe(page); });
  } else {
    pages.forEach(function (page) { page.classList.add('is-visible'); });
  }

  /* ——— Toast / copy / coming soon ——— */
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 1800);
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

  /* ——— Live collection / price polling ——— */
  var liveBlocks = Array.prototype.slice.call(document.querySelectorAll('[data-live]'));
  var priceBlocks = Array.prototype.slice.call(document.querySelectorAll('[data-live-price]'));
  var LIVE_POLL_MS = 60 * 1000;

  function num(n) {
    return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
  }

  function tokenPrice(n) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '—';
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(Math.min(14, 3 - Math.floor(Math.log10(n))));
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
})();
