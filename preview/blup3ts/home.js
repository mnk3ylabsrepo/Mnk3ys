// BLUP3TS home screen: pet carousel, Play, mode toggle, sound, How to play.
// Everything is built with textContent / DOM nodes (never innerHTML with pet data).
(function () {
  'use strict';
  var A = window.BLUP3TS_APP, $ = function (id) { return document.getElementById(id); }, el = A.el;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOCK_SVG = 'M8 15V10a7 7 0 0 1 14 0v5';

  // ---------- views ----------
  var view = 'home', VIEWS = { home: 'homeView', game: 'gameView', nfts: 'nftsView' };
  function curEl() { return $(VIEWS[view]); }
  function goGame(layout) {
    if (layout === 'full' || layout === 'phone' || layout === 'watch') A.setLayout(layout); // 'full' = older name for Phone
    renderLayoutBtn();
    if (view === 'game') { A.fit(); return; } var hv = curEl(); view = 'game'; A.play('tap'); A.start();
    var gv = $('gameView');
    if (reduced) { hv.classList.remove('on'); gv.classList.add('on'); window.scrollTo(0, 0); return; }
    hv.classList.add('leaving');
    setTimeout(function () { hv.classList.remove('on', 'leaving'); gv.classList.add('on', 'entering'); window.scrollTo(0, 0); window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(function () { requestAnimationFrame(function () { gv.classList.remove('entering'); }); }); }, 320);
  }
  function goHome() {
    if (view === 'home') return; var gv = curEl(); view = 'home'; A.play('tap'); A.hideOverlays();
    var hv = $('homeView');
    gv.classList.remove('on'); hv.classList.add('on', 'entering'); renderCarousel(true); window.scrollTo(0, 0);
    requestAnimationFrame(function () { requestAnimationFrame(function () { hv.classList.remove('entering'); }); });
  }
  function goNfts() {
    if (view === 'nfts') return renderNfts(); var from = curEl(); view = 'nfts'; A.play('tap'); A.hideOverlays();
    var nv = $('nftsView'); from.classList.remove('on'); nv.classList.add('on', 'entering'); renderNfts(); window.scrollTo(0, 0);
    requestAnimationFrame(function () { requestAnimationFrame(function () { nv.classList.remove('entering'); }); });
  }
  $('playBtn').onclick = function () { goGame(); };
  $('nftsBtn').onclick = goNfts; $('gameNfts').onclick = goNfts; $('nftsHome').onclick = goHome;
  // M13: exactly two views. The switch shows both: Watch | Phone. Phone has its own layout picker (Auto / Stacked / Side by side).
  var FOLD_NAME = { auto: 'Auto', v: 'Stacked', h: 'Side by side' }, FOLD_NEXT = { auto: 'v', v: 'h', h: 'auto' };
  function renderLayoutBtn() {
    var ph = A.layout() === 'phone';
    [].forEach.call(document.querySelectorAll('#layoutBtn [data-view]'), function (b) { var on = b.dataset.view === A.layout(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var fp = $('foldPick'); if (fp) { var nm = FOLD_NAME[A.fold()] || 'Auto'; fp.hidden = !ph; fp.dataset.fold = A.fold(); $('foldTxt').textContent = nm; fp.setAttribute('aria-label', 'Duo layout: ' + nm + '. Tap to change'); }
  }
  [].forEach.call(document.querySelectorAll('#layoutBtn [data-view]'), function (b) { b.onclick = function () { if (A.layout() === b.dataset.view) { if (view === 'game') { A.play('tap'); A.hideOverlays(); A.showPage('home'); } return; } A.play('tap'); // no Watch tab any more: tapping the view you are in goes back to the pet screen
       A.setLayout(b.dataset.view); renderLayoutBtn(); window.scrollTo(0, 0); }; });
  if ($('foldPick')) $('foldPick').onclick = function () { A.play('tap'); A.setFold(FOLD_NEXT[A.fold()] || 'auto'); renderLayoutBtn(); }; // rotate button: Auto -> Stacked -> Side by side

  // ---------- My NFTs: grid of your pets (owned in Wallet mode, starters in Pretend), filter by collection ----------
  var nftFilter = 'all';
  function collList() { return ((window.BLUP3TS_CONFIG || {}).COLLECTIONS || []).filter(function (c) { return c.enabled !== false; }); }
  function nftPets() {
    var all = A.pets(), owned = all.filter(function (d) { return d.owned; }), vis = A.visiblePets ? A.visiblePets() : all;
    if (vis !== all) return owned; // M11: wallet connected -> only the wallet's own pets (can be none)
    return A.state().mode === 'wallet' && owned.length ? owned : all.filter(function (d) { return !d.owned; });
  }
  function renderNfts() {
    var list = nftPets(), chips = $('nftChips'), grid = $('nftGrid'), hid = !!(A.visiblePets && A.visiblePets() !== A.pets()), wallet = hid || (A.state().mode === 'wallet' && list.some(function (d) { return d.owned; }));
    $('nftNote').textContent = wallet ? 'Your own NFTs from your wallet. Tap one to play full size.' : (A.walletOn() ? 'Starter pets (no wallet needed). Tap one to play full size. Connect a wallet on Home to see your own.' : 'Starter pets. Tap one to play full size.');
    chips.textContent = '';
    var chk = window.BLUP3TS_CONFIG && window.BLUP3TS_CONFIG.NFT_CHECK_COLLECTIONS; // wallet view: only the collections the NFT check gives back
    [{ id: 'all', name: 'All' }].concat(collList().filter(function (c) { return (!wallet || !Array.isArray(chk) || chk.indexOf(c.id) >= 0) && (c.id !== 'ldz' || (window.BLUP3TS_CONFIG || {}).LPDOLLZ_ENABLED); })).forEach(function (c) {
      var n = c.id === 'all' ? list.length : list.filter(function (d) { return d.collection === c.name; }).length;
      var b = el('button', 'chip' + (nftFilter === c.id ? ' a' : ''), c.name + ' · ' + n); b.dataset.f = c.id; b.setAttribute('aria-pressed', nftFilter === c.id ? 'true' : 'false');
      b.onclick = function () { A.play('tap'); nftFilter = c.id; renderNfts(); }; chips.appendChild(b);
    });
    var cn = (collList().filter(function (c) { return c.id === nftFilter; })[0] || {}).name;
    var shown = list.filter(function (d) { return nftFilter === 'all' || d.collection === cn; });
    grid.textContent = '';
    if (!shown.length) { var Wst = window.BLUP3TS_WALLET && BLUP3TS_WALLET.state(); grid.appendChild(el('p', 'nftempty', hid && Wst && Wst.loading ? 'Looking for your MNK3YS and ZMB3YS…' : hid && nftFilter === 'all' ? 'No MNK3YS or ZMB3YS found in this wallet. Starter pets come back when you disconnect.' : 'No ' + (cn || 'pets') + ' here yet.' + (A.walletOn() && !wallet ? ' Connect your wallet on Home to add your own.' : ''))); return; }
    shown.forEach(function (d) {
      var st = A.petState(d.id), m = A.mood(st), r = A.rarity(d), c = el('button', 'ncard' + (d.id === A.petDef().id ? ' on' : '')); c.dataset.id = d.id;
      var art = el('div', 'nart'), im = el('img'); im.alt = d.name; im.loading = 'lazy'; im.decoding = 'async'; im.draggable = false;
      var fb = d.fallbackImg || (window.BLUP3TS_ART ? BLUP3TS_ART.collection(d.collection) : null);
      im.onerror = function () { if (fb && im.src.indexOf(fb) < 0) im.src = fb; else { im.remove(); art.appendChild(el('div', 'pcfallback', d.collection.charAt(0))); } };
      im.src = d.img; art.appendChild(im); if (r && r.tier && r.tier.id !== 'common') art.appendChild(el('span', 'ntier rar-' + r.tier.id, r.tier.name)); c.appendChild(art);
      c.appendChild(el('div', 'nname', d.name));
      c.appendChild(el('div', 'nsub', (d.owned ? '👛 ' : '') + d.collection + ' · Lv ' + A.levelFor(st.str) + ' · ' + m[0]));
      c.onclick = function () { if (!A.setActive(d.id)) { if (A.isEating()) htoast('Busy eating 🍌'); return; } goGame('full'); };
      grid.appendChild(c);
    });
  }
  $('homeBtn').onclick = goHome; // Home lives in the bottom nav (one nav bar)
  // Quick tap fixes: header logos wiggle (the game header one also goes Home); BETA badges say what is coming
  function wig(n) { n.classList.remove('wig'); void n.offsetWidth; n.classList.add('wig'); setTimeout(function () { n.classList.remove('wig'); }, 700); }
  if ($('heroLogo')) $('heroLogo').onclick = function () { wig(this); wig($('homeLogo')); goHome(); };
  if ($('homeLogo')) $('homeLogo').onclick = function () { A.play('tap'); wig(this); };
  [].forEach.call(document.querySelectorAll('.hhead .betatap'), function (n) { n.onclick = function () { A.play('tap'); htoast('New stuff on the way, share ideas on Discord'); }; });
  [].forEach.call(document.querySelectorAll('.hero .betatap'), function (n) { n.onclick = function () { A.play('tap'); A.toast('New stuff on the way, share ideas on Discord'); }; });

  // ---------- toast ----------
  var tt;
  function htoast(t) { var e = $('hToast'); e.__blu = null; BLUP3TS_BLU.text(e, t); e.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { e.classList.remove('show'); }, 2200); }

  // ---------- carousel ----------
  function lockIcon() {
    var NS = (function () { var d = document.createElement('div'); d.innerHTML = '<svg></svg>'; return d.firstChild.namespaceURI; })();
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 30 34'); s.setAttribute('width', '34'); s.setAttribute('height', '38'); s.setAttribute('aria-hidden', 'true');
    function add(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); s.appendChild(e); }
    add('path', { d: LOCK_SVG, fill: 'none', stroke: '#F2C94C', 'stroke-width': '3.5', 'stroke-linecap': 'round' });
    add('rect', { x: '3', y: '14', width: '24', height: '18', rx: '5', fill: '#F2C94C' });
    add('circle', { cx: '15', cy: '22', r: '2.6', fill: '#3a2c00' });
    add('rect', { x: '13.8', y: '23', width: '2.4', height: '5', rx: '1.2', fill: '#3a2c00' });
    return s;
  }
  function cardFor(d, i) {
    var st = A.petState(d.id), m = A.mood(st), on = d.id === A.petDef().id;
    var c = el('button', 'pcard' + (on ? ' on' : '') + (d.owned ? ' owned' : '')); c.setAttribute('role', 'option'); c.setAttribute('aria-selected', on ? 'true' : 'false'); c.dataset.id = d.id; c.tabIndex = on ? 0 : -1; // one tab stop; arrows move
    c.style.setProperty('--bob', (i % 4) * -0.6 + 's');
    var art = el('div', 'pcart'); var im = el('img'); im.alt = d.name; im.loading = 'lazy'; im.decoding = 'async'; im.draggable = false;
    im.onerror = function () { im.remove(); art.appendChild(el('div', 'pcfallback', d.collection === 'ZMB3YS' ? 'Z' : 'M')); };
    im.src = d.img; art.appendChild(im); c.appendChild(art);
    c.appendChild(el('div', 'pcname', d.name));
    c.appendChild(el('div', 'pcsub', (d.owned ? '👛 ' : '') + d.collection + ' · Lv ' + A.levelFor(st.str) + ' · ' + m[0] + ' ' + m[1]));
    var hb = el('div', 'pchunger'); hb.appendChild(BLUP3TS_BLU.text(el('span'), '🍌 ' + Math.round(st.full) + '%'));
    var bar = el('div', 'bar'); var fill = el('i', 'f-cyan'); fill.style.width = st.full + '%'; bar.appendChild(fill); hb.appendChild(bar); c.appendChild(hb);
    if (on) c.appendChild(el('div', 'pcbadge', '✓ Active'));
    c.onclick = function () { if (dragMoved) return; select(d.id, true); };
    return c;
  }
  function lockedCard() {
    var c = el('button', 'pcard locked'); c.setAttribute('role', 'option'); c.setAttribute('aria-disabled', 'true'); c.dataset.id = 'babi3s'; c.tabIndex = -1;
    var art = el('div', 'pcart'); var im = el('img'); im.src = 'assets/babi3s_silhouette.png'; im.alt = 'BABI3S, locked'; im.draggable = false; art.appendChild(im);
    var lk = el('div', 'pclock'); lk.appendChild(lockIcon()); art.appendChild(lk); c.appendChild(art);
    c.appendChild(el('div', 'pcname', 'BABI3S')); c.appendChild(el('div', 'pcsub gold', 'Coming soon'));
    c.onclick = function () { if (dragMoved) return; A.play('tap'); htoast('BABI3S are coming soon 🔒');
      lk.classList.remove('jig'); void lk.offsetWidth; lk.classList.add('jig'); }; // bigger jiggle on tap (CSS skips it with reduced motion)
    lk.addEventListener('animationend', function (e) { if (e.animationName === 'lockjig') lk.classList.remove('jig'); });
    return c;
  }
  // light refresh: update hunger/level text in place (no rebuild, so taps and images are never interrupted)
  function refreshStats() {
    var car = $('carousel'), list = A.visiblePets ? A.visiblePets() : A.pets(), cards = car.querySelectorAll('.pcard[data-id]:not(.locked)');
    var same = cards.length >= list.length && list.every(function (d, i) { return cards[i].dataset.id === d.id; });
    if (!same) return renderCarousel(false);
    list.forEach(function (d, i) {
      var c = cards[i], st = A.petState(d.id), m = A.mood(st), sub = c.querySelector('.pcsub'), sp = c.querySelector('.pchunger span'), f = c.querySelector('.pchunger .bar i');
      if (sub) sub.textContent = (d.owned ? '👛 ' : '') + d.collection + ' · Lv ' + A.levelFor(st.str) + ' · ' + m[0] + ' ' + m[1];
      if (sp) BLUP3TS_BLU.text(sp, '🍌 ' + Math.round(st.full) + '%'); if (f) f.style.width = st.full + '%';
    });
    var d = A.petDef(), st = A.petState(d.id);
    if (list.some(function (q) { return q.id === d.id; })) $('carStatus').textContent = 'Active: ' + d.name + ' · Level ' + A.levelFor(st.str) + ' · Hunger ' + Math.round(st.full) + '% full';
  }
  function renderCarousel(scrollToActive) {
    if (view === 'nfts') renderNfts();
    var desk = document.body.classList.contains('desk'), car = $('carousel'), keep = desk ? car.scrollTop : car.scrollLeft; car.textContent = '';
    var list = A.visiblePets ? A.visiblePets() : A.pets(), x = window.BLUP3TS_WALLET && BLUP3TS_WALLET.carouselExtra ? BLUP3TS_WALLET.carouselExtra() : null;
    if (x && !list.length) car.appendChild(x); // M11: connected wallet with no pets (or still looking): the friendly card comes first
    list.forEach(function (d, i) { car.appendChild(cardFor(d, i)); });
    car.appendChild(lockedCard());
    if (x && list.length) car.appendChild(x);
    var d = A.petDef(), st = A.petState(d.id), none = !list.some(function (q) { return q.id === d.id; });
    $('carStatus').textContent = none ? '\u00a0' : 'Active: ' + d.name + ' · Level ' + A.levelFor(st.str) + ' · Hunger ' + Math.round(st.full) + '% full';
    $('playBtn').textContent = '▶ Play'; $('playBtn').style.visibility = none ? 'hidden' : ''; $('playBtn').disabled = none; // keeps its space: no jumpy layout
    if (scrollToActive) { var a = car.querySelector('.pcard.on'); if (a) centerOn(a, false); } else if (desk) car.scrollTop = keep; else car.scrollLeft = keep;
  }
  function centerOn(card, smooth) {
    var car = $('carousel');
    if (document.body.classList.contains('desk')) {
      var cr = car.getBoundingClientRect(), br = card.getBoundingClientRect(), top = car.scrollTop + (br.top - cr.top) - Math.max(0, (cr.height - br.height) / 2);
      if (car.scrollTo) car.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced ? 'smooth' : 'auto' }); else car.scrollTop = Math.max(0, top);
      return;
    }
    var x = card.offsetLeft - (car.clientWidth - card.offsetWidth) / 2;
    if (car.scrollTo) car.scrollTo({ left: x, behavior: smooth && !reduced ? 'smooth' : 'auto' }); else car.scrollLeft = x;
  }
  function select(id, smooth) {
    if (!A.setActive(id)) { if (A.isEating()) htoast('Busy eating 🍌'); return; }
    A.play('tap'); renderCarousel(false);
    var c = $('carousel').querySelector('.pcard[data-id="' + cssId(id) + '"]'); if (c) { centerOn(c, smooth); c.focus({ preventScroll: true }); }
  }
  function cssId(s) { return String(s).replace(/[^A-Za-z0-9-]/g, ''); }
  function step(dir) {
    var cards = [].slice.call($('carousel').querySelectorAll('.pcard:not(.locked):not(.addcard)')), cur = A.petDef().id, i = 0;
    cards.forEach(function (c, k) { if (c.dataset.id === cur) i = k; });
    var n = cards[Math.max(0, Math.min(cards.length - 1, i + dir))]; if (n) select(n.dataset.id, true);
  }
  $('carPrev').onclick = function () { step(-1); }; $('carNext').onclick = function () { step(1); };
  var car = $('carousel');
  car.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.key === 'Enter' && e.target === car) goGame(); });
  // mouse wheel: vertical wheel scrolls the row sideways
  car.addEventListener('wheel', function (e) { if (document.body.classList.contains('desk')) return; if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); car.scrollLeft += e.deltaY; } }, { passive: false });
  // mouse drag (touch already scrolls natively)
  var dragX = null, dragStart = 0, dragMoved = false;
  car.addEventListener('pointerdown', function (e) { if (document.body.classList.contains('desk') || e.pointerType !== 'mouse' || e.button !== 0) return; dragX = e.clientX; dragStart = car.scrollLeft; dragMoved = false; });
  window.addEventListener('pointermove', function (e) { if (dragX === null) return; var dx = e.clientX - dragX; if (Math.abs(dx) > 6) { dragMoved = true; car.classList.add('dragging'); } if (dragMoved) car.scrollLeft = dragStart - dx; });
  window.addEventListener('pointerup', function () { if (dragX === null) return; dragX = null; car.classList.remove('dragging'); setTimeout(function () { dragMoved = false; }, 0); });

  // ---------- mode ----------
  function renderMode() {
    if (!A.walletOn()) { // wallet connect switched off (config.js WALLET_CONNECT_ENABLED): no wallet controls at all. Code kept for later.
      $('modePretend').setAttribute('aria-pressed', 'true'); $('modePretend').classList.add('a');
      ['connectBtn', 'modeWallet'].forEach(function (id) { var b = $(id); b.hidden = true; b.disabled = true; b.style.display = 'none'; });
      var seg = document.querySelector('.modeseg'); if (seg) { seg.hidden = true; seg.style.display = 'none'; }
      $('modeNote').textContent = 'Pretend mode: play money only.';
      return;
    }
    ['connectBtn', 'modeWallet'].forEach(function (id) { $(id).hidden = false; $(id).disabled = false; }); // wallet connect on: show the controls
    var seg0 = document.querySelector('.modeseg'); if (seg0) { seg0.hidden = false; seg0.style.display = ''; }
    var w = A.state().mode === 'wallet';
    $('modePretend').setAttribute('aria-pressed', w ? 'false' : 'true'); $('modeWallet').setAttribute('aria-pressed', w ? 'true' : 'false');
    $('modePretend').classList.toggle('a', !w); $('modeWallet').classList.toggle('a', w);
    $('connectBtn').style.display = w ? '' : 'none';
    var W = window.BLUP3TS_WALLET;
    $('modeNote').textContent = w ? (W ? W.modeNote() : 'Wallet mode is on its way in the next update. Pretend mode works now.') : 'Pretend mode: play money only. No wallet needed.';
    if (W) W.renderConnect($('connectBtn'));
    else $('connectBtn').textContent = '👛 Connect wallet';
  }
  function setMode(m) { if (m === 'wallet' && !A.walletOn()) return; A.play('tap'); A.setMode(m); if (window.BLUP3TS_WALLET) BLUP3TS_WALLET.onMode(m); renderMode(); renderCarousel(true); }
  $('modePretend').onclick = function () { setMode('pretend'); };
  $('modeWallet').onclick = function () { var was = A.state().mode === 'wallet'; setMode('wallet'); var Wl = window.BLUP3TS_WALLET; if (!was && Wl && Wl.afterWalletMode) Wl.afterWalletMode(); }; // M11: on phones, tapping Wallet goes straight to connect
  $('connectBtn').onclick = function () { if (!A.walletOn()) return; if (window.BLUP3TS_WALLET) BLUP3TS_WALLET.onConnectClick(); else openSheet('Wallet mode', [p('Wallet mode is on its way in the next update.'), p('Pretend mode works now and needs no wallet.')]); };
  // M13: the old 'Add my own' path (jump to Home, flip to Wallet mode, then connect or reload) is gone; wallet.js addOwnTap does it in place.

  // ---------- sound ----------
  function renderSound(on) { var b = $('hSoundBtn'); if (!b) return; b.textContent = on ? '🔊 Sound on' : '🔇 Sound off'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); } // B1.01: the corner speaker (#spkHome) is the one sound control on Home
  if ($('hSoundBtn')) $('hSoundBtn').onclick = function () { A.setSound(!A.soundOn()); };
  A.onSound = renderSound;

  // ---------- sheets ----------
  var lastFocus = null;
  function p(t) { return el('p', null, t); }
  function placeSheet() {
    var sh = $('sheet'); if (!sh || !sh.classList.contains('show')) return;
    var vv = window.visualViewport;
    var h = vv && vv.height ? vv.height : window.innerHeight;
    var w = vv && vv.width ? vv.width : window.innerWidth;
    var top = (vv && vv.offsetTop ? vv.offsetTop : 0) + h / 2;
    var left = (vv && vv.offsetLeft ? vv.offsetLeft : 0) + w / 2;
    sh.style.top = top + 'px';
    sh.style.left = left + 'px';
    sh.style.maxHeight = Math.max(180, Math.round(h - 24)) + 'px';
    sh.style.maxWidth = Math.max(280, Math.round(Math.min(560, w - 24))) + 'px';
  }
  function openSheet(title, nodes) {
    lastFocus = document.activeElement;
    $('sheetTitle').textContent = title; var b = $('sheetBody'); b.textContent = ''; nodes.forEach(function (n) { b.appendChild(n); });
    $('sheet').classList.add('show'); $('sheetBg').classList.add('show'); placeSheet(); $('sheetClose').focus();
  }
  function closeSheet() {
    var sh = $('sheet'); sh.classList.remove('show'); $('sheetBg').classList.remove('show');
    sh.style.top = ''; sh.style.left = ''; sh.style.maxHeight = ''; sh.style.maxWidth = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', placeSheet); window.visualViewport.addEventListener('scroll', placeSheet); }
  window.addEventListener('resize', placeSheet);
  $('sheetClose').onclick = closeSheet; $('sheetBg').onclick = closeSheet;
  document.addEventListener('keydown', function (e) {
    var sh = $('sheet'); if (!sh.classList.contains('show')) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key === 'Tab') { // keep keyboard focus inside the open sheet
      var f = Array.prototype.filter.call(sh.querySelectorAll('button, [href], summary, input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return; var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !sh.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });
  // ---------- Settings: family-friendly filter / 'Show original traits' (18+, off by default) ----------
  function settings() {
    var C = window.BLUP3TS_CONFIG || {}, st = A.state(), on = st.orig === true && st.adult === true;
    var nodes = [p('Family-friendly filter is ON by default: some traits are hidden or swapped for a free music look.')];
    if (C.ORIGINAL_TRAITS_SETTING === true && A.walletOn()) { // only affects your own connected NFTs, so hidden while wallet connect is off
      var b = el('button', 'sbtn' + (on ? '' : ' primary'), on ? 'Hide original traits (family friendly)' : 'Show original traits (18+)'); b.id = 'origToggle';
      b.onclick = function () {
        if (on) { A.setOrig(false); closeSheet(); htoast('Family-friendly filter on ✔'); return; }
        if (st.adult === true) { A.setOrig(true); closeSheet(); htoast('Original traits on for your own NFTs'); return; }
        var yes = el('button', 'sbtn primary', 'I\'m 18 or older'), no = el('button', 'sbtn', 'Cancel'); yes.id = 'adultYes';
        yes.onclick = function () { A.setOrig(true, true); closeSheet(); htoast('Original traits on for your own NFTs'); }; no.onclick = closeSheet;
        openSheet('Are you 18 or older?', [p('Some original traits are for grown-ups. They only show on your own connected NFTs, on this website. Starter pets and shared pictures always stay family friendly.'), yes, no]);
      };
      nodes.push(b, el('p', 'muted', 'Only changes trait names on your own connected NFTs in Wallet mode. Never on starter pets. Saved on this device only.'));
    }
    if (window.BLUP3TS_FS) nodes = nodes.concat(BLUP3TS_FS.settingNodes()); // 'Start in full screen' switch
    openSheet('Settings', nodes);
  }
  $('settingsBtn').onclick = function () { A.play('tap'); settings(); };
  // ---------- Looks: watch cases for the selected pet (config.js WATCH_CASES, unlock at CASE_UNLOCK_LEVEL) ----------
  function miniWatch(c) { // small copy of the real watch (same proportions + case styling) with the pet's NFT inside
    var w = el('span', 'mw'); w.dataset.case = c.id; if (c.motif) w.dataset.motif = c.motif;
    Object.keys(c.vars).forEach(function (k) { w.style.setProperty(k, c.vars[k]); });
    w.appendChild(el('span', 'mb t')); w.appendChild(el('span', 'mb b'));
    var mc = el('span', 'mc'), ms = el('span', 'ms'), im = el('img'); im.src = c.art; im.alt = ''; im.loading = 'lazy'; ms.appendChild(im); mc.appendChild(ms); mc.appendChild(el('span', 'mk')); w.appendChild(mc);
    if (c.logo) { var lg = el('img', 'mlogo'); lg.src = c.logo; lg.alt = ''; w.appendChild(lg); }
    if (c.motif) { var fx = el('span', 'mfx'); for (var i = 0; i < 5; i++) fx.appendChild(el('i')); w.appendChild(fx); }
    if (c.locked) w.appendChild(el('span', 'mlock', '🔒'));
    return w;
  }
  function looks() {
    var d = A.petDef(), list = A.casePreviews(d), grid = el('div', 'casepick');
    list.forEach(function (c) {
      var b = el('button', 'caseopt' + (c.on ? ' on' : '') + (c.locked ? ' locked' : '')); b.dataset.case = c.id;
      b.setAttribute('aria-label', c.name + (c.on ? ', wearing' : c.locked ? ', locked' : ', tap to wear'));
      b.appendChild(miniWatch(c)); b.appendChild(el('span', 'cn', c.name));
      b.appendChild(el('span', c.locked ? 'cl' : 'cs', c.locked ? '🔒 Unlocks at L' + c.level : c.on ? '✓ Wearing' : 'Tap to wear'));
      if (!c.applies && c.collection) b.appendChild(el('span', 'cfor', 'For ' + c.collection + ' pets'));
      b.onclick = function () {
        A.play('tap');
        if (!c.applies) { htoast('This case is for ' + c.collection + ' pets 🔒'); return; }
        if (c.locked) { htoast('Get a ' + (c.collection || 'pet') + ' to Level ' + c.level + ' to unlock 🔒'); return; }
        A.setCase(c.id, d); looks();
      };
      grid.appendChild(b);
    });
    var head = el('div', 'lookshead'), hi = el('img'); hi.src = d.img; hi.alt = ''; head.appendChild(hi); head.appendChild(p('Pick a watch case for ' + d.name + '. Free, just for looks.'));
    var nodes = [head, grid];
    nodes.push(el('p', 'muted', 'Project cases unlock when one of your pets from that collection reaches Level ' + (list[0] ? list[0].level : 3) + '.'));
    openSheet('Looks · watch case', nodes);
  }
  $('looksBtn').onclick = function () { A.play('tap'); looks(); };
  (function () { var c = window.BLUP3TS_CONFIG || {}; var s = $('looksSub'); if (s && c.CASE_UNLOCK_LEVEL) s.textContent = 'Watch cases · unlock at Level ' + c.CASE_UNLOCK_LEVEL; })();
  function howTo() {
    var ol = el('ol');
    [['Pick a pet', 'swipe the row and tap one. BABI3S are coming soon.'], ['Press Play', 'your pet opens on the watch.'],
     ['Feed', 'pick a Nibble, Snack, Meal or Feast and watch it eat. Pretend mode uses play $BLUNANA.'], ['Jam', 'tap along to the 8-bit groove. It\'s free and lifts the mood.'],
     ['Stats', 'see traits from Orbis and choose a music look, bass first 🎸.'], ['Come back', 'pets get hungry over time, so check in.']].forEach(function (s) {
      var li = el('li'); li.appendChild(el('b', null, s[0] + ': ')); li.appendChild(document.createTextNode(s[1])); ol.appendChild(li); });
    openSheet('How to play', [ol, el('p', 'muted', 'Tip: on the watch, tap the Digital Crown or the dots to change screens. 🏠 Home brings you back here.')]);
  }
  $('howBtn').onclick = function () { A.play('tap'); howTo(); };
  function faq() {
    var list = el('div', 'faq');
    var off = !A.walletOn() && window.BLUP3TS_FAQ_WALLET_OFF ? window.BLUP3TS_FAQ_WALLET_OFF : null;
    (window.BLUP3TS_FAQ || []).map(function (q) { return off && Object.prototype.hasOwnProperty.call(off, q[0]) ? (off[q[0]] ? [q[0], off[q[0]]] : null) : q; }).filter(Boolean).forEach(function (q) { var d = el('details'), sm = el('summary', null, q[0]); d.appendChild(sm); d.appendChild(el('p', null, q[1])); list.appendChild(d); });
    openSheet('FAQ', [list]);
  }
  $('faqBtn').onclick = function () { A.play('tap'); faq(); };

  window.BLUP3TS_HOME = { looks: looks, goNfts: goNfts, renderNfts: renderNfts, settings: settings, renderCarousel: renderCarousel, renderMode: renderMode, openSheet: openSheet, faq: faq, closeSheet: closeSheet, p: p, toast: htoast, goHome: goHome, goGame: goGame, view: function () { return view; } };
  A.onReset = function () { renderCarousel(true); renderMode(); if (view === 'nfts') renderNfts(); renderLayoutBtn(); };
  renderLayoutBtn();
  renderSound(A.soundOn()); renderMode(); renderCarousel(true);
  (function paintReserve() {
    var node = $('reserveBal');
    if (!node) return;
    fetch('/api/blup3ts-reserve', { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || j.ok !== true || !isFinite(+j.balance)) return;
        node.hidden = false;
        node.textContent = 'Reserve: ' + Math.round(+j.balance).toLocaleString('en-US') + ' $BLUNANA';
      }).catch(function () {});
  })();
  setInterval(function () { if (view === 'home' && !document.hidden) { if (dragX === null) refreshStats(); } }, 4000);
})();
