/**
 * Preview site — orbit page navigation + account menu.
 * Persistent bubbles with scroll-linked size/position animation.
 */
(function () {
  'use strict';

  if (!document.body.classList.contains('site-preview')) return;

  var CONFIG = window.MNK3YS_CONFIG || {};

  function resolveAssetUrl(url) {
    if (!url) return '/assets/logo.png';
    if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url;
    if (url.startsWith('/')) return url;
    return '/' + url.replace(/^\/+/, '');
  }

  var tokenLogo = resolveAssetUrl((CONFIG.token && CONFIG.token.logoUrl) || '/assets/logo.png');
  var projectLogo = resolveAssetUrl(CONFIG.logoUrl || '/assets/logo.png');

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    collections: '<img src="' + projectLogo + '" alt="" class="orbit-bubble__img" draggable="false">',
    blunana: '<img src="' + tokenLogo + '" alt="" class="orbit-bubble__img" draggable="false">',
    holders: '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M28 27.7H4v-28a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4Z"/><path d="M8 24V12h4v12H8zm8 0V8h4v16h-4zm8 0V4h4v20h-4z"/></svg>',
    'x-spaces': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    partners: '<svg viewBox="0 0 640 512" fill="none" stroke="currentColor" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"><path d="M519.2 127.9l-47.6-47.6A56.252 56.252 0 0 0 432 64H205.2c-14.8 0-29.1 5.9-39.6 16.3L118 127.9H0v255.7h64c17.6 0 31.8-14.2 31.9-31.7h9.1l84.6 76.4c30.9 25.1 73.8 25.7 105.6 3.8 12.5 10.8 26 15.9 41.1 15.9 18.2 0 35.3-7.4 48.8-24 22.1 8.7 48.2 2.6 64-16.8l26.2-32.3c5.6-6.9 9.1-14.8 10.9-23h57.9c.1 17.5 14.4 31.7 31.9 31.7h64V127.9H519.2zM48 351.6c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16c0 8.9-7.2 16-16 16zm390-6.9l-26.1 32.2c-2.8 3.4-7.8 4-11.3 1.2l-23.9-19.4-30 36.5c-6 7.3-15 4.8-18 2.4l-36.8-31.5-15.6 19.2c-13.9 17.1-39.2 19.7-55.3 6.6l-97.3-88H96V175.8h41.9l61.7-61.6c2-.8 3.7-1.5 5.7-2.3H262l-38.7 35.5c-29.4 26.9-31.1 72.3-4.4 101.3 14.8 16.2 61.2 41.2 101.5 4.4l8.2-7.5 108.2 87.8c3.4 2.8 3.9 7.9 1.2 11.3zm106-40.8h-69.2c-2.3-2.8-4.9-5.4-7.7-7.7l-102.7-83.4 12.5-11.4c6.5-6 7-16.1 1-22.6L367 167.1c-6-6.5-16.1-6.9-22.6-1l-55.2 50.6c-9.5 8.7-25.7 9.4-34.6 0-9.3-9.9-8.5-25.1 1.2-33.9l65.6-60.1c7.4-6.8 17-10.5 27-10.5l83.7-.2c2.1 0 4.1.8 5.5 2.3l61.7 61.6H544v128zm48 47.7c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16c0 8.9-7.2 16-16 16z"/></svg>',
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M3 4h2l2.4 12h11.2l1.4-8H7.3"/></svg>',
  };

  var shopUrl = (CONFIG.shopUrl || '').trim();
  var PAGES = [
    { id: 'home', label: 'Home' },
    { id: 'collections', label: 'Collections' },
    { id: 'blunana', label: (CONFIG.token && CONFIG.token.symbol) || 'Token' },
    { id: 'holders', label: 'Holders' },
    { id: 'x-spaces', label: 'X Spaces' },
    { id: 'team', label: 'Team' },
    { id: 'partners', label: 'Partners' },
  ];
  if (shopUrl) {
    PAGES.push({ id: 'shop', label: 'Shop', externalUrl: shopUrl });
  }

  var stageEl = document.getElementById('orbit-nav-stage');
  var labelEl = document.getElementById('orbit-nav-label');
  var sections = PAGES.map(function (p) { return document.getElementById(p.id); }).filter(Boolean);
  var bubbles = [];
  var activeIndex = 0;
  var scrollInProgress = false;
  var scrollTimer = null;
  var scrollLoopActive = false;
  var scrollEndTimer = null;
  var isTracking = false;

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
      gap: parseFloat(root.getPropertyValue('--orb-gap')) || 12,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function pageIcon(id) {
    return ICONS[id] || ICONS.home;
  }

  function refreshBubbleIcon(pageId, html) {
    ICONS[pageId] = html;
    bubbles.forEach(function (bubble, i) {
      if (PAGES[i].id !== pageId) return;
      var inner = bubble.querySelector('.orbit-bubble__inner');
      if (inner) inner.innerHTML = html;
    });
  }

  /** Slot positions with no overlap — bottom row y=0, above column stacks upward. */
  function slotSize(slot, sizes, kind) {
    return slot === 0 ? sizes.near : sizes.sm;
  }

  function belowSlotX(slot, sizes) {
    var x = sizes.lg + sizes.gap;
    for (var s = 0; s < slot; s++) {
      x += slotSize(s, sizes, 'below') + sizes.gap;
    }
    return x;
  }

  function aboveSlotY(slot, sizes) {
    var y = sizes.lg + sizes.gap;
    for (var s = 0; s < slot; s++) {
      y += slotSize(s, sizes, 'above') + sizes.gap;
    }
    return y;
  }

  function getBubbleLayout(activeIdx, bubbleIdx, sizes) {
    var lg = sizes.lg;
    var dist = bubbleIdx - activeIdx;

    if (dist === 0) {
      return { x: 0, y: 0, size: lg, active: true, opacity: 1, z: 20 };
    }

    if (dist < 0) {
      var slotAbove = -dist - 1;
      var size = slotSize(slotAbove, sizes, 'above');
      return {
        x: 0,
        y: -aboveSlotY(slotAbove, sizes),
        size: size,
        active: false,
        opacity: Math.max(0.5, 1 - slotAbove * 0.1),
        z: 12 - slotAbove,
      };
    }

    var slotBelow = dist - 1;
    var sizeBelow = slotSize(slotBelow, sizes, 'below');
    return {
      x: belowSlotX(slotBelow, sizes),
      y: 0,
      size: sizeBelow,
      active: false,
      opacity: Math.max(0.5, 1 - slotBelow * 0.1),
      z: 12 - slotBelow,
    };
  }

  /** Roll along bottom row (horizontal) or left column (vertical) — no diagonal overlap. */
  function lerpLayoutRoll(a, b, t) {
    var size = lerp(a.size, b.size, t);
    var opacity = lerp(a.opacity, b.opacity, t);
    var active = a.active ? t < 0.55 : b.active ? t >= 0.45 : false;
    var z = active ? 20 : Math.max(a.z, b.z);

    var aBottom = Math.abs(a.y) < 0.5;
    var bBottom = Math.abs(b.y) < 0.5;
    var aAbove = a.y < -0.5;
    var bAbove = b.y < -0.5;

    // Bottom row — slide horizontally on shared baseline
    if (aBottom && bBottom) {
      return { x: lerp(a.x, b.x, t), y: 0, size: size, active: active, opacity: opacity, z: z };
    }

    // Above column — slide vertically, left-aligned with active hub
    if (aAbove && bAbove) {
      return {
        x: 0,
        y: lerp(a.y, b.y, t),
        size: size,
        active: active,
        opacity: opacity,
        z: z,
      };
    }

    // Hub → above: roll up on left edge
    if (aBottom && bAbove) {
      return {
        x: 0,
        y: lerp(a.y, b.y, t),
        size: size,
        active: active,
        opacity: opacity,
        z: z,
      };
    }

    // Above → hub: roll down on left edge
    if (bBottom && aAbove) {
      return {
        x: 0,
        y: lerp(a.y, b.y, t),
        size: size,
        active: active,
        opacity: opacity,
        z: z,
      };
    }

    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      size: size,
      active: active,
      opacity: opacity,
      z: z,
    };
  }

  function applyBubbleLayout(bubble, layout, animate) {
    bubble.style.setProperty('--bx', layout.x + 'px');
    bubble.style.setProperty('--by', layout.y + 'px');
    bubble.style.setProperty('--bs', layout.size + 'px');
    bubble.style.setProperty('--bo', String(layout.opacity));
    bubble.style.zIndex = String(layout.z);
    bubble.classList.toggle('orbit-bubble--active', layout.active);
    bubble.setAttribute('aria-current', layout.active ? 'page' : 'false');
    if (animate === false) {
      bubble.classList.add('orbit-bubble--instant');
      requestAnimationFrame(function () {
        bubble.classList.remove('orbit-bubble--instant');
      });
    }
  }

  function resizeStage(activeIdx, sizes) {
    if (!stageEl) return;
    var below = PAGES.length - 1 - activeIdx;
    var above = activeIdx;
    var w = sizes.lg;
    for (var b = 0; b < below; b++) {
      w += sizes.gap + slotSize(b, sizes, 'below');
    }
    var h = sizes.lg;
    for (var a = 0; a < above; a++) {
      h += sizes.gap + slotSize(a, sizes, 'above');
    }
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
      var layout = fromIdx === toIdx
        ? layoutA
        : lerpLayoutRoll(layoutA, layoutB, t);
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
        if (t > 0.001) {
          return { from: activeIdx, to: activeIdx + 1, t: t };
        }
      }
    }

    return { from: activeIdx, to: activeIdx, t: 0 };
  }

  function syncOrbitFromScroll() {
    var blend = getScrollBlend();
    layoutOrbit(blend.from, blend.to, blend.t, true);

    var resolved = blend.from === blend.to
      ? blend.from
      : (blend.t >= 0.5 ? blend.to : blend.from);

    if (resolved !== activeIndex) {
      activeIndex = resolved;
      window.history.replaceState(null, '', '#' + PAGES[activeIndex].id);
    }
  }

  function runScrollLoop() {
    syncOrbitFromScroll();
    if (scrollLoopActive) {
      requestAnimationFrame(runScrollLoop);
    }
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
      btn.addEventListener('click', function () {
        if (page.externalUrl) {
          window.open(page.externalUrl, '_blank', 'noopener');
          return;
        }
        scrollToIndex(index);
      });
      stageEl.appendChild(btn);
      return btn;
    });
  }

  buildBubbles();
  activeIndex = indexFromHash();
  layoutOrbit(activeIndex, activeIndex, 0, false);

  window.addEventListener('scroll', scheduleLayout, { passive: true });
  window.addEventListener('resize', function () {
    syncOrbitFromScroll();
  }, { passive: true });

  setTimeout(function () {
    projectLogo = resolveAssetUrl(CONFIG.logoUrl || '/assets/logo.png');
    refreshBubbleIcon('collections', '<img src="' + projectLogo + '" alt="" class="orbit-bubble__img" draggable="false">');
    var tokenImg = document.querySelector('.section__thumb');
    var tokenSrc = tokenImg && tokenImg.src ? tokenImg.src : tokenLogo;
    refreshBubbleIcon('blunana', '<img src="' + tokenSrc + '" alt="" class="orbit-bubble__img" draggable="false">');
    syncOrbitFromScroll();
  }, 300);

  // ——— Account menu ———
  var trigger = document.getElementById('account-orb-trigger');
  var menu = document.getElementById('account-menu');
  var backdrop = document.getElementById('account-menu-backdrop');
  var closeBtn = document.getElementById('account-menu-close');
  var avatarEl = document.getElementById('account-orb-avatar');
  var defaultIcon = document.getElementById('account-orb-icon-default');

  function openMenu() {
    if (!menu || !trigger) return;
    menu.classList.add('account-menu--open');
    menu.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    if (backdrop) {
      backdrop.classList.add('account-menu__backdrop--open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
  }

  function closeMenu() {
    if (!menu || !trigger) return;
    menu.classList.remove('account-menu--open');
    menu.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    if (backdrop) {
      backdrop.classList.remove('account-menu__backdrop--open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function toggleMenu() {
    if (menu && menu.classList.contains('account-menu--open')) closeMenu();
    else openMenu();
  }

  trigger?.addEventListener('click', toggleMenu);
  closeBtn?.addEventListener('click', closeMenu);
  backdrop?.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  function syncAccountOrb() {
    var discordAv = document.getElementById('discord-avatar-sidebar');
    if (!avatarEl || !defaultIcon) return;
    if (document.body.classList.contains('discord-connected') && discordAv && discordAv.src) {
      avatarEl.src = discordAv.src;
      avatarEl.alt = discordAv.alt || 'Discord';
      avatarEl.hidden = false;
      defaultIcon.hidden = true;
    } else {
      avatarEl.hidden = true;
      defaultIcon.hidden = false;
    }
  }

  var bodyObserver = new MutationObserver(syncAccountOrb);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncAccountOrb();

  var discordAvTarget = document.getElementById('discord-avatar-sidebar');
  if (discordAvTarget) {
    var avObserver = new MutationObserver(syncAccountOrb);
    avObserver.observe(discordAvTarget, { attributes: true, attributeFilter: ['src'] });
  }
})();
