// BLUP3TS web (beta). Pretend mode is the default. Wallet mode lives in wallet.js; the home screen in home.js.
(function () {
  'use strict';
  var DATA = window.BLUP3TS_DATA;
  var $ = function (id) { return document.getElementById(id); };

  // ===== Game rules: same numbers as Shared/Core/PetEngine.swift =====
  var RULES = { fullDecay: (function (b) { return Number.isFinite(b) && b > 0 && b <= 100 ? b : 4; })((window.BLUP3TS_CONFIG || {}).BASE_HUNGER_DECAY_PER_HOUR) /* config.js */, joyDecay: 3, joyDecayHungry: 6, hungry: 30, jamJoy: 18, jamCost: 6, jamStr: 0, minFullToJam: 10 };
  var FOODS = [
    { id: 'nibble', tier: 'Nibble', name: 'Half Blunana', cost: 100, full: 7, joy: 2, str: 4, n: 1, icon: 'half', trial: true }, // trial: half a Snack's food, same STR per $BLUNANA as a Snack
    { id: 'snack', tier: 'Snack', name: 'Full Blunana', cost: 250, full: 15, joy: 4, str: 10, n: 1, icon: 'one' },
    { id: 'meal', tier: 'Meal', name: 'Bunch', cost: 1000, full: 45, joy: 10, str: 60, n: 4, icon: 'two' },
    { id: 'feast', tier: 'Feast', name: 'Split', cost: 2500, full: 100, joy: 20, str: 140, n: 8, icon: 'split' }
  ];
  (function () { // config.js is the one source: FEED_COSTS x COST_SCALE (whole tokens, at least 1)
    var C0 = window.BLUP3TS_CONFIG || {}, c = C0.FEED_COSTS || {}, k = C0.COST_SCALE; k = typeof k === 'number' && isFinite(k) && k > 0 ? k : 1;
    FOODS.forEach(function (f) { var base = Number.isInteger(c[f.id]) && c[f.id] > 0 ? c[f.id] : f.cost; f.cost = Math.max(1, Math.round(base * k)); });
  })();
  var START = 100000;
  var SPEEDS = [[600, '1s = 10 min'], [3600, '1s = 1 hr'], [1, 'real time']];
  // total strength needed to reach level n (n >= 1), from config.js LEVEL_STRENGTH (L2..L10), then +LEVEL_STEP_AFTER per level
  var LV = (function () {
    var c = window.BLUP3TS_CONFIG || {}, t = c.LEVEL_STRENGTH, d = [50, 150, 350, 700, 1000, 1500, 2300, 3500, 5000], step = c.LEVEL_STEP_AFTER;
    var ok = Array.isArray(t) && t.length >= 1 && t.every(function (x, i) { return Number.isFinite(x) && x > 0 && (i === 0 || x > t[i - 1]); });
    return { t: ok ? t.slice() : d, step: Number.isFinite(step) && step > 0 ? step : 2000 };
  })();
  var strNeeded = function (n) { if (n <= 1) return 0; var i = n - 2; return i < LV.t.length ? LV.t[i] : LV.t[LV.t.length - 1] + (i - LV.t.length + 1) * LV.step; };
  var levelFor = function (s) { s = Math.max(0, +s || 0); var l = 1; while (l < 999 && strNeeded(l + 1) <= s) l++; return l; };
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };

  // ===== Saved state (this browser only), under blup3ts.web.* keys. Owned pets are keyed by their mint. =====
  // 'Show original traits': 18+ confirmed, switched on, and ONLY for the holder's own connected NFT (never starters)
  function origOn(d) { var c = window.BLUP3TS_CONFIG || {}; return c.ORIGINAL_TRAITS_SETTING === true && !!S && S.adult === true && S.orig === true && S.mode === 'wallet' && !!(d && d.owned); }
  function walletOn() { var c = window.BLUP3TS_CONFIG; return !!c && c.WALLET_CONNECT_ENABLED === true; }
  var P = 'blup3ts.web.', KEYS = ['balance', 'pets', 'swaps', 'active', 'sound', 'speed', 'started', 'mode', 'orig', 'adult', 'layout', 'vol', 'fold'], store = null;
  try { store = window.localStorage; } catch (e) {}
  function clamp(n) { n = +n; return isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; }
  function newPet() { return { full: 80, joy: 70, str: 0, eaten: 0, jams: 0 }; }
  function fresh() { var s = { active: DATA.pets[0].id, bal: START, speed: 0, pets: {}, looks: {}, started: false, sound: false, mode: 'pretend', orig: false, adult: false, layout: 'watch', vol: 0, fold: 'auto' }; DATA.pets.forEach(function (p) { s.pets[p.id] = newPet(); }); var zs = DATA.pets.filter(function (p) { return p.collection === 'ZMB3YS'; })[0]; if (zs) { s.pets[zs.id].full = 26; s.pets[zs.id].joy = 55; } return s; } // NEXT BATCH: the ZMB3Y starter may be a live floor pick
  function get(k) { try { var v = store && store.getItem(P + k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }
  function clearKeys() { try { if (!store) return; KEYS.forEach(function (k) { store.removeItem(P + k); }); for (var i = store.length - 1; i >= 0; i--) { var k = store.key(i); if (k && k.indexOf(P) === 0 && k !== P + 'floorlast') store.removeItem(k); } } catch (e) {} } // keeps floorlast (starters.js 'never the same pet twice'; not progress) - the live list can land before app.js runs
  // spoken name = the visible text first, then what a tap does (data-al), so voice control and screen readers match what you see
  function syncAl() { requestAnimationFrame(function () { document.querySelectorAll('[data-al]').forEach(function (n) { var t = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim(); var l = (t ? t + ': ' : '') + n.dataset.al; if (n.getAttribute('aria-label') !== l) n.setAttribute('aria-label', l); }); }); }
  function load() {
    var s = fresh(), v;
    if (typeof (v = get('balance')) === 'number' && v >= 0) s.bal = v;
    v = get('pets'); if (v && typeof v === 'object') Object.keys(v).forEach(function (id) { var q = v[id]; if (/^[A-Za-z0-9-]{3,48}$/.test(id) && q && typeof q.full === 'number' && typeof q.str === 'number') s.pets[id] = { full: clamp(q.full), joy: clamp(q.joy), str: Math.max(0, +q.str || 0), eaten: Math.max(0, +q.eaten || 0), jams: Math.max(0, +q.jams || 0), holder: typeof q.holder === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q.holder) ? q.holder : undefined }; });
    v = get('swaps'); if (v && typeof v === 'object') s.looks = v;
    v = get('active'); if (typeof v === 'string' && /^[A-Za-z0-9-]{3,48}$/.test(v)) s.active = v; // an owned pet shows once the wallet loads it
    // a saved pet that is no longer a starter (e.g. retired MNK3YS) -> MNK3Y #1579. Owned pets only while wallet connect is on.
    if (!DATA.pets.some(function (p) { return p.id === s.active; }) && !(walletOn() && /^own-/.test(s.active))) s.active = DATA.pets[0].id;
    s.mode = get('mode') === 'wallet' && walletOn() ? 'wallet' : 'pretend'; // wallet connect off -> Pretend
    s.sound = get('sound') === true;
    v = get('speed'); if (v === 0 || v === 1 || v === 2) s.speed = v;
    s.started = get('started') === true;
    s.adult = get('adult') === true; s.orig = s.adult && get('orig') === true; // 'Show original traits' needs the 18+ confirm
    // M13: exactly two views, Watch and Phone. Any older saved view ('full' or anything else) becomes Phone.
    v = get('layout'); s.layout = v === undefined || v === 'watch' ? 'watch' : 'phone';
    v = get('fold'); s.fold = v === 'v' || v === 'h' ? v : 'auto'; // Phone layout: Auto / Stacked / Side by side
    v = get('vol'); s.vol = typeof v === 'number' && isFinite(v) ? Math.round(Math.max(0, Math.min(100, v))) : (s.sound ? 70 : 0); // master volume 0..100 (older saves: sound on = 70)
    return s;
  }
  if (/[?&]fresh=1/.test(location.search)) clearKeys(); // starts over (starters.js picks fresh floor pets on every Pretend load anyway)
  var S = load();
  function save() {
    try { if (!store) return;
      store.setItem(P + 'balance', JSON.stringify(S.bal)); store.setItem(P + 'pets', JSON.stringify(S.pets));
      store.setItem(P + 'swaps', JSON.stringify(S.looks)); store.setItem(P + 'active', JSON.stringify(S.active));
      store.setItem(P + 'sound', JSON.stringify(!!S.sound)); store.setItem(P + 'speed', JSON.stringify(S.speed));
      store.setItem(P + 'started', JSON.stringify(!!S.started)); store.setItem(P + 'mode', JSON.stringify(S.mode));
      store.setItem(P + 'orig', JSON.stringify(!!S.orig)); store.setItem(P + 'adult', JSON.stringify(!!S.adult)); store.setItem(P + 'layout', JSON.stringify(S.layout)); store.setItem(P + 'vol', JSON.stringify(S.vol));       store.setItem(P + 'fold', JSON.stringify(S.fold));
      if (window.BLUP3TS_WALLET && BLUP3TS_WALLET.persist) BLUP3TS_WALLET.persist();
    } catch (e) {}
  }
  var simClock = new Date(2026, 9, 22, 10, 9).getTime();
  function petDef() { return DATA.pets.filter(function (p) { return p.id === S.active; })[0] || DATA.pets[0]; }
  function pet() { var id = petDef().id; if (!S.pets[id]) S.pets[id] = newPet(); return S.pets[id]; }

  // food lost per hour for one pet: config BASE_HUNGER_DECAY_PER_HOUR; rarer pets a bit slower ONLY when RARITY_PERKS_ENABLED
  function decayRate(id) {
    var T = window.BLUP3TS_TIERS, C = window.BLUP3TS_CONFIG || {};
    if (!T || !T.hungerDecay) return RULES.fullDecay;
    if (C.RARITY_PERKS_ENABLED !== true) return T.hungerDecay(C, null); // flag off: the same rate for every pet
    var d = DATA.pets.filter(function (q) { return q.id === id; })[0] || (API && API.pets ? API.pets().filter(function (q) { return q.id === id; })[0] : null);
    var r = d ? rarityInfo(d) : null; return T.hungerDecay(C, r && r.tier);
  }
  function decay(hours) {
    Object.keys(S.pets).forEach(function (id) {
      var p = S.pets[id], rate = decayRate(id);
      var untilHungry = p.full <= RULES.hungry ? 0 : (p.full - RULES.hungry) / rate;
      var hungryH = Math.max(0, hours - untilHungry), normalH = hours - hungryH;
      p.joy = Math.max(0, p.joy - normalH * RULES.joyDecay - hungryH * RULES.joyDecayHungry);
      p.full = Math.max(0, p.full - rate * hours);
    });
  }
  function mood(p) {
    if (p.full <= 5) return ['😵', 'Starving', 1];
    if (p.full < 30) return ['😋', 'Hungry', 1];
    if (p.joy < 30) return ['😢', 'Sad', 1];
    if (p.full >= 80 && p.joy >= 85) return ['🤩', 'Ecstatic', 0];
    if (p.joy >= 60) return ['😊', 'Happy', 0];
    return ['🙂', 'Okay', 0];
  }

  // ===== 8-bit sound: OFF until the visitor turns it on =====
  var soundOn = false, sounds = {};
  ['tap', 'levelup', 'launch', 'jam_loop'].forEach(function (k) { var a = new Audio(); a.preload = 'none'; a.src = 'audio/' + k + '.mp3'; if (k === 'jam_loop') a.loop = true; sounds[k] = a; });
  sounds.jam_loop.volume = .7;
  function play(k) { if (!soundOn) return; var a = sounds[k]; try { a.currentTime = 0; var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
  function stop(k) { try { sounds[k].pause(); } catch (e) {} }
  var unlocked = false;
  function unlock() { // iPhone Safari only lets audio start inside a tap
    if (window.BLUP3TS_EAT) BLUP3TS_EAT.unlockAudio();
    if (unlocked) return; unlocked = true;
    Object.keys(sounds).forEach(function (k) { var a = sounds[k]; a.preload = 'auto'; a.muted = true; var pr = a.play(); if (pr && pr.then) pr.then(function () { a.pause(); a.currentTime = 0; a.muted = false; }).catch(function () { a.muted = false; }); else { a.pause(); a.muted = false; } });
  }
  // M13: one master volume (0..100) for the Jam music and all sound effects. 0 = muted (sound off).
  var lastVol = 70;
  function applyVol() { var v = S.vol / 100; Object.keys(sounds).forEach(function (k) { try { sounds[k].volume = v * (k === 'jam_loop' ? .7 : 1); } catch (e) {} }); if (window.BLUP3TS_EAT && BLUP3TS_EAT.setVolume) BLUP3TS_EAT.setVolume(v); }
  var SPK = { 0: 'M4 9h4l5-4v14l-5-4H4z M16 9l5 6 M21 9l-5 6', 1: 'M4 9h4l5-4v14l-5-4H4z M16 9.5c1.2 1.4 1.2 3.6 0 5', 2: 'M4 9h4l5-4v14l-5-4H4z M16 9.5c1.2 1.4 1.2 3.6 0 5 M18.5 7c2.6 2.8 2.6 7.2 0 10' };
  function renderVol() {
    var on = S.vol > 0, lv = !on ? 0 : S.vol < 50 ? 1 : 2;
    var sb = $('soundBtn'); if (sb) { sb.textContent = on ? '🔊 Sound on · 8-bit' : '🔇 Sound off · tap for 8-bit'; sb.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    var h = $('spkHome'); if (h) { h.textContent = on ? '🔊' : '🔇'; h.setAttribute('aria-pressed', on ? 'true' : 'false'); h.setAttribute('aria-label', on ? 'Sound is on. Turn sound off' : 'Sound is off. Turn sound on'); }
    var b = $('spkWatch'); if (b) { b.dataset.level = lv; b.dataset.on = on ? '1' : '0'; b.setAttribute('aria-label', 'Volume ' + (on ? S.vol + '%' : 'muted') + '. Tap to change'); var pth = b.querySelector('path'); if (pth) pth.setAttribute('d', SPK[lv]); }
    var r = $('volSlider'); if (r && +r.value !== S.vol) r.value = S.vol; if (r) { r.setAttribute('aria-valuetext', on ? S.vol + '%' : 'Muted'); r.style.setProperty('--v', S.vol + '%'); }
  }
  function setVolume(v, quiet) {
    v = Math.round(Math.max(0, Math.min(100, +v || 0))); var was = soundOn, on = v > 0;
    S.vol = v; if (on) lastVol = v; soundOn = on; S.sound = on; save(); applyVol();
    if (window.BLUP3TS_EAT) BLUP3TS_EAT.setEnabled(on); if (window.BLUP3TS_APP && BLUP3TS_APP.onSound && was !== on) BLUP3TS_APP.onSound(on);
    renderVol();
    if (on && !was && !quiet) { unlock(); setTimeout(function () { play(jamTimer ? 'jam_loop' : 'launch'); }, 120); }
    else if (!on) Object.keys(sounds).forEach(stop);
  }
  function setSound(on, quiet) { setVolume(on ? (S.vol > 0 ? S.vol : lastVol || 70) : 0, quiet); }

  // ===== Pages =====
  var PAGES = ['home', 'stats', 'pets', 'balance'];
  var TITLES = { stats: 'Stats', pets: 'My pets', balance: 'Balance' };
  var page = 'home';
  function showPage(name) {
    page = name;
    document.querySelectorAll('.page').forEach(function (el) { el.classList.toggle('on', el.dataset.page === name); });
    var dots = $('dots'); dots.style.display = name === 'launch' ? 'none' : '';
    [].forEach.call(dots.children, function (d, i) { d.classList.toggle('a', PAGES[i] === name); });
    [].forEach.call(document.querySelectorAll('#tabs button'), function (b) { b.classList.toggle('a', b.dataset.go === name); });
    if (name === 'stats') renderTraits();
    if (name === 'pets') renderPets();
    hideOverlays();
    render();
  }
  PAGES.forEach(function (n) { var b = document.createElement('button'); b.setAttribute('aria-label', n); b.onclick = function () { play('tap'); showPage(n); }; $('dots').appendChild(b); });
  $('crown').onclick = function () { play('tap'); var i = PAGES.indexOf(page); showPage(PAGES[(i + 1) % PAGES.length]); };
  [].forEach.call(document.querySelectorAll('#tabs button[data-go]'), function (b) { b.onclick = function () { play('tap'); if (!S.started) start(); showPage(b.dataset.go); }; });

  // ===== Render =====
  function render() {
    applyCase();
    var p = pet(), d = petDef(), m = mood(eating ? { full: dispFull, joy: p.joy } : p), lvl = levelFor(p.str);
    $('ttl').textContent = ovOpen ? OVT[ovOpen] : page === 'launch' ? '' : page === 'home' ? d.name : TITLES[page];
    $('moodPill').style.display = (page === 'home' && !ovOpen) ? '' : 'none';
    var cpt = document.querySelector('#screen .concept'); if (cpt) cpt.classList.toggle('offrow', !(page === 'home' && !ovOpen)); // Phone view: BETA rides in the mood row
    wmFit();
    $('moodPill').textContent = m[0] + ' ' + m[1];
    var shown = eating ? dispFull : p.full;
    syncAl(); $('hFull').textContent = Math.round(eating ? dispText : p.full) + '%'; $('hFullBar').style.width = shown + '%';
    $('feedBtn').disabled = eating; $('jamBtn').disabled = eating;
    var lo = strNeeded(lvl), hi = strNeeded(lvl + 1), lvlPct = (p.str - lo) / (hi - lo) * 100;
    $('hStr').textContent = fmt(p.str); $('hStrBar').style.width = Math.min(100, p.str / hi * 100) + '%';
    $('hLvl').textContent = lvl; $('hLvlBar').style.width = lvlPct + '%';
    $('petWrap').classList.toggle('sad', !!m[2]);
    $('sFull').textContent = Math.round(p.full) + '% full'; $('sFullBar').style.width = p.full + '%';
    $('sJoy').textContent = Math.round(p.joy) + '%'; $('sJoyBar').style.width = p.joy + '%';
    $('sLvlL').textContent = '⭐ Level ' + lvl; $('sLvl').textContent = fmt(p.str) + ' / ' + fmt(hi) + ' STR'; $('sLvlBar').style.width = lvlPct + '%';
    $('sEaten').textContent = p.eaten; $('sJams').textContent = p.jams;
    var hrs = (p.full - RULES.hungry) / decayRate(petDef().id);
    bluText($('sHungry'), hrs > 0 ? 'in ' + (hrs < 1 ? Math.round(hrs * 60) + ' min' : hrs.toFixed(1) + ' hr') : 'now! 🍌');
    $('bal').textContent = fmt(S.bal);
    if (API && API.paintPlay) API.paintPlay();
    var fi = $('fullInfo'); if (fi && S.layout === 'phone') { var ri = rarityInfo(d); fi.textContent = '⭐ Lv ' + lvl + ' · ' + fmt(p.str) + ' / ' + fmt(hi) + ' STR' + (ri && ri.tier ? ' · ' + ri.tier.name + ' (preview)' : ''); }
    var t = new Date(simClock); $('clock').textContent = t.getHours() + ':' + String(t.getMinutes()).padStart(2, '0');
  }
  function setPetArt() {
    var d = petDef();
    var fb = d.fallbackImg || (window.BLUP3TS_ART ? BLUP3TS_ART.collection(d.collection) : null);
    ['petImg', 'jamImg', 'lvPet', 'launchPet'].forEach(function (id) { var im = $(id); im.onerror = function () { if (fb && im.src.indexOf(fb) < 0) im.src = fb; }; im.src = d.img; });
    $('verified').textContent = d.owned ? '✔ ' + d.collection + ' · in your wallet' : '✔ ' + d.collection + ' · starter pet';
    var fp = $('fullPet'); if (fp) fp.textContent = d.name + ' · ' + d.collection;
  }

  // ===== Traits + family-friendly looks =====
  // ----- rarity tier + rank (display only, preview). Perks change nothing while RARITY_PERKS_ENABLED is false. -----
  var TIERS = window.BLUP3TS_TIERS, CFG = window.BLUP3TS_CONFIG || {}, rarCache = {};
  function rarityInfo(d) {
    d = d || petDef(); if (!TIERS) return null;
    if (!rarCache[d.id]) { try { rarCache[d.id] = TIERS.preview(CFG, d, window.BLUP3TS_RARITY, window.BLUP3TS_FILTER && BLUP3TS_FILTER.hash); } catch (e) { rarCache[d.id] = null; } }
    return rarCache[d.id];
  }
  function featStr(d, base) { var r = rarityInfo(d); return TIERS ? TIERS.featStr(CFG, r && r.tier, base) : base; }
  function renderRarity() {
    var box = $('rarityBox'); if (!box) return; box.textContent = '';
    var r = rarityInfo(), d = petDef();
    // M13 batch: a live floor starter (never a wallet pet) gets a small 'Adopt on Orbis' link to its own Orbis item page
    var ad = $('adoptLink'); if (ad) { var okm = d && d.floor && !d.owned && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(d.mint || '');
      ad.hidden = !okm; if (okm) { ad.href = 'https://www.orbisonsol.io/marketplace/item/' + d.mint; ad.setAttribute('aria-label', 'Adopt ' + d.name + ' on Orbis (opens a new tab)'); } }
    var h = el('div', 'cardh'); h.appendChild(document.createTextNode('Rarity ')); h.appendChild(el('span', 'dim small', 'preview')); box.appendChild(h);
    var row = el('div', 'trow'); row.appendChild(el('span', 'tk', 'Tier'));
    var tv = el('span', 'tv'); tv.appendChild(document.createTextNode(r && r.tier ? r.tier.name : 'Coming soon'));
    if (r && r.tier) {
      var pct = r.rank && r.of ? Math.max(1, Math.ceil(r.rank / r.of * 100)) : (r.tier.id === 'common' ? 0 : r.tier.topPct);
      if (pct) tv.appendChild(el('b', 'rar-' + r.tier.id, 'Top ' + pct + '%'));
    }
    row.appendChild(tv); box.appendChild(row);
    var rr = el('div', 'trow'); rr.appendChild(el('span', 'tk', 'Rank'));
    rr.appendChild(el('span', 'tv', r && r.rank ? (r.source === 'estimate' ? '≈ #' : '#') + fmt(r.rank) + (r.of ? ' of ' + fmt(r.of) : '') : 'Coming soon')); box.appendChild(rr);
    var pv = r && r.tier && TIERS && TIERS.perkPreview ? TIERS.perkPreview(r.tier) : null, on = CFG.RARITY_PERKS_ENABLED === true;
    if (pv && (pv.strBonus || pv.storeDiscount || pv.hungerDecayReduction)) {
      var pr = el('div', 'trow'); pr.appendChild(el('span', 'tk', 'Perks'));
      var bits = []; if (pv.strBonus) bits.push('+' + Math.round(pv.strBonus * 100) + '% strength per feed'); if (pv.storeDiscount) bits.push(Math.round(pv.storeDiscount * 100) + '% off in the Store');
      if (pv.hungerDecayReduction) bits.push('gets hungry ' + Math.round(pv.hungerDecayReduction * 100) + '% slower');
      pr.appendChild(el('span', 'tv', bits.join(', ') + (on ? '' : ' (coming soon)'))); pr.id = 'perkRow'; box.appendChild(pr);
    }
    box.appendChild(el('div', 'fine', (r && r.source === 'orbis' ? 'Rank from Orbis. ' : r && r.source === 'estimate' ? 'Estimated from trait counts. ' : d.collection + ' ranks are coming soon. ') + 'Official ranks are on their way. Feeding costs the same for every pet.'));
  }
  function rarity(sh) { return sh < 1 ? ['Legendary', 'legendary'] : sh < 3 ? ['Rare', 'rare'] : sh < 10 ? ['Uncommon', 'uncommon'] : ['Common', 'common']; }
  // ----- instruments: unlock by level (config.js INSTRUMENT_LEVELS), free, never sold -----
  var INST = (function () {
    var c = (window.BLUP3TS_CONFIG || {}).INSTRUMENT_LEVELS, d = { bass: 2, guitar: 3, drumsticks: 4, mic: 5, keytar: 6 }, o = {};
    Object.keys(d).forEach(function (k) { var v = c && c[k]; o[k] = Number.isInteger(v) && v >= 1 && v <= 999 ? v : d[k]; }); return o;
  })();
  var INST_NAME = { bass: 'Bass', guitar: 'Guitar', drumsticks: 'Drumsticks', mic: 'Mic', keytar: 'Keytar' };
  var INST_OPTS = DATA.swaps.hand.options.filter(function (o) { return INST[o[0]]; }); // existing music-swap art (bass first)
  function petLevel(id) { var p = S.pets[id || petDef().id]; return levelFor(p ? p.str : 0); }
  // ----- watch cases (config.js WATCH_CASES): cosmetic only, free. A project case unlocks for its collection once any
  // of the player's pets from that collection reaches CASE_UNLOCK_LEVEL. Choice saved per pet in looks[petId].case.
  var CASE_SAFE = /^[#(),.%\s\w-]*$/; // colours / gradients only: no url(), no ';' -> nothing can load from outside
  function caseCfg() { var c = window.BLUP3TS_CONFIG || {}, m = c.WATCH_CASES || {}; return { map: m, def: m[c.DEFAULT_WATCH_CASE] ? c.DEFAULT_WATCH_CASE : 'default', lvl: (c.CASE_UNLOCK_LEVEL >= 1 && c.CASE_UNLOCK_LEVEL <= 99) ? Math.floor(c.CASE_UNLOCK_LEVEL) : 3 }; }
  function allPets() { return (API && API.pets) ? API.pets() : DATA.pets; }
  function casesFor(d) { var K = caseCfg(), out = []; Object.keys(K.map).forEach(function (id) { var c = K.map[id]; if (id === K.def || (c && c.collection && d && c.collection === d.collection)) out.push(id); }); return out; }
  function caseUnlocked(id) {
    var K = caseCfg(), c = K.map[id]; if (!c) return false; if (id === K.def || !c.collection) return true;
    return allPets().some(function (q) { return q.collection === c.collection && petLevel(q.id) >= K.lvl; });
  }
  function caseOf(d) { d = d || petDef(); var K = caseCfg(), want = (S.looks[d.id] || {}).case; return want && casesFor(d).indexOf(want) >= 0 && caseUnlocked(want) ? want : K.def; }
  function setCase(id, d) {
    d = d || petDef(); if (casesFor(d).indexOf(id) < 0 || !caseUnlocked(id)) return false;
    var lk = S.looks[d.id] = S.looks[d.id] || {}; if (id === caseCfg().def) delete lk.case; else lk.case = id; save(); applyCase(); return true;
  }
  function caseList(d) { d = d || petDef(); var K = caseCfg(), cur = caseOf(d); return casesFor(d).map(function (id) { var c = K.map[id]; return { id: id, name: c.name || id, on: id === cur, locked: !caseUnlocked(id), level: K.lvl, collection: c.collection || null, swatch: c.caseBg, rim: c.rim }; }); }
  // Looks sheet: every case in WATCH_CASES with its real styling, so the picker can draw a mini watch with the pet inside.
  // applies = this pet can wear it (default or same collection); art = this pet, or one of your pets from that collection.
  function caseVars(c) { var o = {}; [['--case-bg', c.caseBg], ['--case-band', c.bandBg], ['--case-rim', c.rim], ['--case-accent', c.accent], ['--case-glow', c.glow], ['--case-crown', c.crown]].forEach(function (v) {
    if (typeof v[1] === 'string' && CASE_SAFE.test(v[1]) && v[1].indexOf('url') < 0) o[v[0]] = v[1]; }); return o; }
  function caseLogoSrc(c) { return typeof c.logo === 'string' && /^[\w\/.-]+$/.test(c.logo) && c.logo.indexOf('..') < 0 ? c.logo : null; }
  function casePreviews(d) {
    d = d || petDef(); var K = caseCfg(), cur = caseOf(d), mine = casesFor(d);
    return Object.keys(K.map).map(function (id) {
      var c = K.map[id] || {}, applies = mine.indexOf(id) >= 0, art = d.img;
      if (!applies && c.collection) { var pool = visiblePets().filter(function (x) { return x.collection === c.collection && x.img; }), q = pool.filter(function (x) { return x.owned; })[0] || pool[0]; if (q) art = q.img; } // M12: your own wallet pets first
      return { id: id, name: c.name || id, on: id === cur, applies: applies, locked: !applies || !caseUnlocked(id), level: K.lvl, collection: c.collection || null,
        vars: caseVars(c), logo: caseLogoSrc(c), motif: c.motif === 'drip' || c.motif === 'slime' ? c.motif : null, art: art };
    });
  }
  function applyCase() {
    var st = $('stage'); if (!st) return; var K = caseCfg(), id = caseOf(), c = K.map[id] || {};
    [['--case-bg', c.caseBg], ['--case-band', c.bandBg], ['--case-rim', c.rim], ['--case-accent', c.accent], ['--case-glow', c.glow], ['--case-crown', c.crown]].forEach(function (v) {
      if (typeof v[1] === 'string' && CASE_SAFE.test(v[1]) && v[1].indexOf('url') < 0) st.style.setProperty(v[0], v[1]); else st.style.removeProperty(v[0]); });
    st.dataset.case = id; if (c.motif === 'drip' || c.motif === 'slime') st.dataset.motif = c.motif; else delete st.dataset.motif;
    var lg = $('caseLogo'), src = typeof c.logo === 'string' && /^[\w\/.-]+$/.test(c.logo) && c.logo.indexOf('..') < 0 ? c.logo : null; // local files only
    if (lg) { if (src) { if (lg.getAttribute('src') !== src) lg.src = src; lg.hidden = false; } else lg.hidden = true; }
  }
  function instOpen(k, id) { return !INST[k] || petLevel(id) >= INST[k]; } // not an instrument = always open; else by level (retroactive)
  function hasHand(d) { return (d || petDef()).traits.some(function (t) { return t.slot === 'hand'; }); }
  function lookFor(slot) { var opts = DATA.swaps[slot].options, id = (S.looks[petDef().id] || {})[slot]; return opts.filter(function (o) { return o[0] === id && instOpen(o[0]); })[0] || opts[0]; }
  function equippedInst() { // what the pet plays in Jam
    var d = petDef(), id = hasHand(d) ? lookFor('hand')[0] : (S.looks[d.id] || {}).inst;
    return INST[id] && instOpen(id) ? id : null;
  }
  function instOpt(k) { return INST_OPTS.filter(function (o) { return o[0] === k; })[0]; }
  function newUnlocks(before, after) { return INST_OPTS.filter(function (o) { return INST[o[0]] > before && INST[o[0]] <= after; }).map(function (o) { return o[2] + ' ' + INST_NAME[o[0]] + ' unlocked!'; }).concat(JAM.level > before && JAM.level <= after ? ['🎶 Long Jam unlocked!'] : []); }
  // M13: Blunanas, not yellow bananas. The 🍌 emoji is always drawn as the blue $BLUNANA art (assets/banana.png).
  function bluIcon() { var i = document.createElement('img'); i.className = 'blu'; i.src = 'assets/banana.png'; i.alt = 'Blunana'; i.setAttribute('role', 'img'); i.setAttribute('aria-label', 'Blunana'); i.draggable = false; return i; }
  function bluText(node, text) { // sets text, drawing every 🍌 as a Blunana icon (skips work when unchanged)
    text = text == null ? '' : String(text); if (node.__blu === text && node.childNodes.length) return node; node.__blu = text; node.textContent = '';
    text.split('\uD83C\uDF4C').forEach(function (part, i) { if (i) node.appendChild(bluIcon()); if (part) node.appendChild(document.createTextNode(part)); }); return node;
  }
  window.BLUP3TS_BLU = { icon: bluIcon, text: bluText };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function renderTraits() {
    var list = $('traitList'), d = petDef(), slots = 0, hidden = 0; list.textContent = '';
    var showOrig = origOn(d);
    d.traits.forEach(function (t) {
      if (showOrig && t.orig) { var orow = el('div', 'trow'); orow.appendChild(el('span', 'tk', t.origType || t.type)); var ov = el('span', 'tv'); ov.appendChild(document.createTextNode(t.orig)); ov.appendChild(el('b', 'origtag', 'Original')); orow.appendChild(ov); list.appendChild(orow); return; }
      if (t.hidden) { hidden++; return; }
      var row = el('div', 'trow'); row.appendChild(el('span', 'tk', t.type));
      var v = el('span', 'tv');
      if (t.slot) { slots++; var o = lookFor(t.slot); v.appendChild(bluText(el('span'), o[1] + ' ' + o[2])); v.appendChild(el('b', 'yourlook', 'Your look')); }
      else { v.appendChild(document.createTextNode(t.value)); if (typeof t.share === 'number') { var r = rarity(t.share); v.appendChild(el('b', 'rar-' + r[1], r[0] + ' · ' + (t.share < 1 ? t.share.toFixed(1) : Math.round(t.share)) + '%')); } }
      row.appendChild(v); list.appendChild(row);
    });
    if (!hasHand(d)) { var ie = equippedInst(); if (ie) { var io = instOpt(ie), ir = el('div', 'trow'); ir.appendChild(el('span', 'tk', 'Instrument')); var iv = el('span', 'tv'); iv.appendChild(document.createTextNode(io[1] + ' ' + io[2])); iv.appendChild(el('b', 'yourlook', 'Your look')); ir.appendChild(iv); list.appendChild(ir); } }
    renderRarity();
    $('lookBtn').style.display = ''; // instruments are for every pet
    $('familyNote').textContent = showOrig && d.traits.some(function (t) { return t.orig; }) ? 'Showing original traits (18+ setting). Turn it off in Settings on Home.' : (slots || hidden) ? 'Some traits are hidden or swapped to keep BLUP3TS family friendly.' : 'Just for looks · rarity from Orbis';
  }
  function openLooks() {
    var box = $('lookList'), d = petDef(); box.textContent = '';
    function optBtn(o, on, pick) { // locked instruments show 'Unlocks at Level N' and can't be picked
      var open = instOpen(o[0]), b = el('button', 'lopt' + (on ? ' on' : '') + (open ? '' : ' locked'));
      b.dataset.opt = o[0]; b.appendChild(bluText(el('span', 'le'), open ? o[2] : '🔒')); b.appendChild(el('span', 'ln', o[1]));
      if (!open) { b.appendChild(el('span', 'lul', 'Unlocks at Level ' + INST[o[0]])); b.setAttribute('aria-disabled', 'true'); b.onclick = function () { play('tap'); toast('Unlocks at Level ' + INST[o[0]] + ' 🔒'); }; return b; }
      if (on) b.appendChild(el('span', 'lc', '✓'));
      b.onclick = function () { play('tap'); pick(); save(); openLooks(); renderTraits(); }; return b;
    }
    var cg = el('div', 'lgrp'); cg.appendChild(el('div', 'lgh', '⌚ WATCH CASE')); // cosmetic, free
    caseList(d).forEach(function (c) {
      var b = el('button', 'lopt' + (c.on ? ' on' : '') + (c.locked ? ' locked' : '')); b.dataset.case = c.id;
      b.appendChild(el('span', 'le', c.locked ? '🔒' : '⌚')); b.appendChild(el('span', 'ln', c.name));
      if (c.locked) { b.appendChild(el('span', 'lul', 'Unlocks at L' + c.level)); b.setAttribute('aria-disabled', 'true'); b.onclick = function () { play('tap'); toast('Unlocks at Level ' + c.level + ' 🔒'); }; }
      else { if (c.on) b.appendChild(el('span', 'lc', '✓')); b.onclick = function () { play('tap'); setCase(c.id, d); openLooks(); }; }
      cg.appendChild(b);
    });
    if (caseList(d).length < 2) cg.appendChild(el('div', 'fine', 'More watch cases are coming soon.'));
    if (!hasHand(d)) { // pets with no hand trait still get the instrument row
      var ig = el('div', 'lgrp'), cur0 = equippedInst(), lk = function () { return (S.looks[petDef().id] = S.looks[petDef().id] || {}); };
      ig.appendChild(el('div', 'lgh', '🎵 MUSIC · INSTRUMENT'));
      ig.appendChild(optBtn(['none', 'No instrument', '🙌', 'Music'], !cur0, function () { delete lk().inst; }));
      INST_OPTS.forEach(function (o) { ig.appendChild(optBtn(o, cur0 === o[0], function () { lk().inst = o[0]; })); });
      box.appendChild(ig);
    }
    d.traits.filter(function (t) { return t.slot; }).forEach(function (t) {
      var sw = DATA.swaps[t.slot], cur = lookFor(t.slot);
      ['Music', 'Extras'].forEach(function (g) {
        var grp = el('div', 'lgrp' + (g === 'Extras' ? ' plain' : ''));
        grp.appendChild(el('div', 'lgh', (g === 'Music' ? '🎵 MUSIC · ' : 'EXTRAS · ') + sw.title.toUpperCase()));
        sw.options.filter(function (o) { return o[3] === g; }).forEach(function (o) {
          // the pet's own swapped trait (first option) always shows; other instruments unlock by level
          var b = o[0] === cur[0] ? optBtn(['__cur'].concat(o.slice(1)), true, function () {}) : optBtn(o, false, function () { S.looks[petDef().id] = S.looks[petDef().id] || {}; S.looks[petDef().id][t.slot] = o[0]; });
          b.dataset.opt = o[0]; grp.appendChild(b);
        });
        box.appendChild(grp);
      });
    });
    box.appendChild(cg); // watch case group last, after the instruments
    box.appendChild(el('div', 'fine center', 'Free · instruments unlock as your pet levels up · never sold · just for looks, the NFT itself never changes'));
    show('ov-look');
  }
  $('lookBtn').onclick = function () { play('tap'); openLooks(); };

  // ===== Pets =====
  var hideStarters = function () { return false; };
  function visiblePets() { var h = false; try { h = hideStarters() === true; } catch (e) {} return h ? DATA.pets.filter(function (p) { return p.owned; }) : DATA.pets; }
  function renderPets() {
    var list = $('petList'); list.textContent = '';
    visiblePets().forEach(function (d) {
      if (!S.pets[d.id]) S.pets[d.id] = newPet();
      var p = S.pets[d.id], m = mood(p), on = d.id === petDef().id;
      var b = el('button', 'prow' + (on ? ' on' : ''));
      var av = el('div', 'pav'); var im = el('img'); im.onerror = function () { if (d.fallbackImg && im.src.indexOf(d.fallbackImg) < 0) im.src = d.fallbackImg; }; im.src = d.img; im.alt = ''; av.appendChild(im); b.appendChild(av);
      var tx = el('div', 'ptext'); tx.appendChild(el('div', 'pn', d.name)); tx.appendChild(el('div', 'ps', d.collection + ' · Lv ' + levelFor(p.str) + ' · ' + m[0] + ' ' + m[1])); b.appendChild(tx);
      if (on) b.appendChild(el('div', 'pcheck', '✓'));
      b.onclick = function () { if (eating) return; play('tap'); S.active = d.id; save(); setPetArt(); showPage('home'); toast('Hi, ' + d.name + '!'); };
      list.appendChild(b);
    });
    // BABI3S: locked, dark silhouette with a gold lock
    var lb = el('div', 'prow locked'); var lav = el('div', 'pav lockbg'); var li = el('img'); li.src = 'assets/babi3s_silhouette.png'; li.alt = ''; lav.appendChild(li);
    var lk = el('div', 'lock'); lk.innerHTML = '<svg width="28" height="32" viewBox="0 0 30 34" aria-hidden="true"><path d="M8 15V10a7 7 0 0 1 14 0v5" fill="none" stroke="#F2C94C" stroke-width="3.5" stroke-linecap="round"/><rect x="3" y="14" width="24" height="18" rx="5" fill="#F2C94C"/><circle cx="15" cy="22" r="2.6" fill="#3a2c00"/><rect x="13.8" y="23" width="2.4" height="5" rx="1.2" fill="#3a2c00"/></svg>';
    lav.appendChild(lk); lb.appendChild(lav);
    var lt = el('div', 'ptext'); lt.appendChild(el('div', 'pn', 'BABI3S')); lt.appendChild(el('div', 'ps', 'Coming soon')); lb.appendChild(lt); list.appendChild(lb);
    lk.classList.add('pclock'); lb.id = 'babiRow'; lb.setAttribute('role', 'button'); lb.tabIndex = 0; lb.setAttribute('aria-label', 'BABI3S: coming soon');
    lb.onclick = function () { play('tap'); var s = lk.querySelector('svg'); lk.classList.remove('jig'); void lk.offsetWidth; lk.classList.add('jig'); if (s) s.addEventListener('animationend', function () { lk.classList.remove('jig'); }, { once: true }); setTimeout(function () { lk.classList.remove('jig'); }, 900); toast('BABI3S are coming soon! 🔒', false, lb); };
    lb.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lb.click(); } };
    // M13 'Add my own': the easy way to bring in your own MNK3YS / ZMB3YS, right here (no trip to Home).
    // Not connected -> the connect step (Open in Solflare on a phone). Connected -> check the wallet again, with a spinner.
    var Wm = window.BLUP3TS_WALLET, ao = walletOn() && Wm && Wm.addOwnInfo ? Wm.addOwnInfo() : null;
    if (ao) {
      var add = el('button', 'prow add' + (ao.busy ? ' busy' : '')); add.id = 'addOwn'; add.setAttribute('aria-busy', ao.busy ? 'true' : 'false');
      var aav = el('div', 'pav'); if (ao.busy) aav.appendChild(el('div', 'spin')); else { var ai = el('img', ao.logo ? 'wl' : null); ai.src = ao.logo || 'assets/mnk3ys.png'; ai.alt = ''; aav.appendChild(ai); } add.appendChild(aav);
      var at = el('div', 'ptext'); at.appendChild(el('div', 'pn', ao.name)); at.appendChild(el('div', 'ps', ao.sub)); add.appendChild(at);
      add.onclick = function () { if (ao.busy) return; play('tap'); Wm.addOwnTap(); };
      list.appendChild(add);
    }
  }

  // ===== Overlays, toast, effects =====
  var OVS = ['ov-feed', 'ov-look', 'ov-jam', 'ov-jamch', 'ov-level', 'ov-soon'];
  var OVT = { 'ov-feed': 'Feed', 'ov-look': 'Choose look', 'ov-jam': 'Jam', 'ov-jamch': 'Jam', 'ov-level': '', 'ov-soon': '' };
  var ovOpen = null;
  function show(id) { ovOpen = id; OVS.forEach(function (o) { $(o).classList.toggle('show', o === id); }); render(); }
  function hideOverlays() { ovOpen = null; OVS.forEach(function (o) { $(o).classList.remove('show'); }); endJam(true); render(); }
  document.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { play('tap'); hideOverlays(); }; });
  var tt;
  function toast(text, withCoin, near) { // near: optional element; the toast then sits just above it (seen even when the page is scrolled)
    var t = $('toast'); t.__blu = null; bluText(t, text);
    var pe = $('pg-' + page); if (pe && t.parentNode !== pe) pe.appendChild(t); // tap fixes: toasts show on every watch page, not only Home
    t.style.top = ''; if (pe && near) { var f = wmScale || 1, nr = near.getBoundingClientRect(), pr = pe.getBoundingClientRect(); t.style.top = Math.max(4, (nr.top - 40 * f >= 0 ? (nr.top - pr.top) / f - 40 : (nr.bottom - pr.top) / f + 8) + pe.scrollTop) + 'px'; } // above it, or below when there is no room on screen
    else if (pe && pe.scrollTop) t.style.top = (parseFloat(getComputedStyle(t).top) + pe.scrollTop) + 'px';
    if (withCoin) { var c = el('img'); c.src = 'assets/blunana_badge.png'; c.alt = ''; t.appendChild(c); }
    t.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); }, 3000); // toasts stay up about 3 s (Azgog, Oct 29)
  }
  function trick(cls, ms) { var w = $('petWrap'); w.classList.remove('chomp', 'hop', 'shake'); void w.offsetWidth; w.classList.add(cls); setTimeout(function () { w.classList.remove(cls); }, ms); }
  function burst(kind, n) {
    var fx = $('fx'), W = fx.clientWidth || 396, H = fx.clientHeight || 484;
    for (var i = 0; i < n; i++) {
      var e;
      if (kind === 'banana') { e = el('img', 'p'); e.src = 'assets/banana.png'; e.alt = ''; }
      else e = el('div', 'p', kind === 'heart' ? '💖' : kind === 'star' ? '⭐' : '🎵');
      fx.appendChild(e);
      var side = i % 2 ? 1 : -1;
      var x0 = kind === 'banana' ? W * (.25 + .5 * Math.random()) : W / 2 + side * 60, y0 = kind === 'banana' ? -40 : H * .5;
      var x1 = kind === 'banana' ? W / 2 - 17 + (Math.random() - .5) * 30 : W / 2 + side * (90 + 60 * Math.random()), y1 = kind === 'banana' ? H * .38 : H * (.08 + .25 * Math.random());
      var rot = (Math.random() - .5) * 540, dur = kind === 'banana' ? 700 + i * 80 : 900 + Math.random() * 500;
      var frames = kind === 'banana'
        ? [{ transform: 'translate(' + x0 + 'px,' + y0 + 'px) rotate(0deg) scale(1)', opacity: 1 }, { transform: 'translate(' + x1 + 'px,' + y1 + 'px) rotate(' + rot + 'deg) scale(.6)', opacity: 1, offset: .8 }, { transform: 'translate(' + x1 + 'px,' + (y1 + 6) + 'px) rotate(' + rot + 'deg) scale(.1)', opacity: 0 }]
        : [{ transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)', opacity: 1 }, { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(1.25)', opacity: 0 }];
      (function (node) {
        if (node.animate) node.animate(frames, { duration: dur, delay: kind === 'banana' ? i * 100 : i * 30, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' }).onfinish = function () { node.remove(); };
        else setTimeout(function () { node.remove(); }, 1500);
      })(e);
    }
  }
  function levelUp(l, before) {
    if (OVS.some(function (o) { return $(o).classList.contains('show'); })) return setTimeout(function () { levelUp(l, before); }, 600);
    $('lvNum').textContent = l; $('lvTxt').textContent = petDef().collection.slice(0, -1) + ' got stronger!';
    var un = newUnlocks(before || l - 1, l), u = $('lvUnlock'); u.textContent = un.join(' '); u.hidden = !un.length;
    show('ov-level'); play('levelup');
  }

  // ===== Feed (pretend $BLUNANA only) =====
  function tokenFeed() { return S.mode === 'wallet' && API.payFeed && (window.BLUP3TS_CONFIG || {}).TEST_PLAY === true; }
  function openFeed() {
    if (eating || jamTimer) return; // no feeding while a jam is running
    var live = tokenFeed();
    $('feedBal').textContent = live ? '…' : fmt(S.bal);
    if (API.paintPlay) API.paintPlay();
    if (live && API.refreshToken) API.refreshToken();
    var box = $('foods'); box.textContent = '';
    FOODS.forEach(function (f) {
      var cost = live && API.feedCost ? API.feedCost(f) : f.cost;
      var b = el('button', 'food' + (f.trial ? ' trial' : '')); b.disabled = live ? API.feedLocked(f) : S.bal < f.cost; b.dataset.tier = f.id;
      var fi = el('div', 'fi');
      fi.appendChild(BLUP3TS_EAT.icon(f.id));
      b.appendChild(fi);
      var fn = el('div', 'fn'); fn.appendChild(el('b', null, f.tier + ' · ' + f.name)); if (f.trial) fn.firstChild.appendChild(el('i', 'tryit', 'Try it')); fn.appendChild(el('span', null, '+' + f.full + ' food · +' + f.str + ' STR')); b.appendChild(fn);
      var fc = el('div', 'fc'); var ci = el('img'); ci.src = 'assets/blunana_badge.png'; ci.alt = ''; fc.appendChild(ci); fc.appendChild(document.createTextNode(fmt(cost))); b.appendChild(fc);
      b.onclick = function () { if (live) API.payFeed(petDef(), f); else feed(f); };
      box.appendChild(b);
    });
    if (live && API.feedNote) box.insertBefore(API.feedNote(), box.firstChild);
    if (live && API.paintClaim) API.paintClaim();
    else if (S.mode === 'wallet' && API.realFeedSection) box.insertBefore(API.realFeedSection(petDef(), FOODS), box.firstChild);
    show('ov-feed');
  }
  // the real eating sequence lives in eat.js; this part only handles the game numbers
  var eating = false, dispFull = 0, dispText = 0, eatLog = null, textTween = null;
  var MOUTH = { 'mnk3y-1579': [.67, .68] }; // other pets: art.js mouth / data.js mouth
  function gainXp(id, base) { try { return API.xp ? Math.max(base, +API.xp(id, base) || base) : base; } catch (e) { return base; } }
  var reducedMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function tweenText(to, ms) {
    var from = dispText, t0 = performance.now(); cancelAnimationFrame(textTween);
    (function step() { var k = Math.min(1, (performance.now() - t0) / ms); dispText = from + (to - from) * (1 - Math.pow(1 - k, 3)); render(); if (k < 1) textTween = requestAnimationFrame(step); })();
  }
  function feed(f, real) {
    if (eating || !f) return false;
    if (jamTimer && !real) return false; // finish the jam first
    if (jamTimer && real) endJam(false); // a confirmed real feed wins: wrap up the jam, then eat
    var p = pet(); hideOverlays();
    if (p.full >= 98) { trick('shake', 700); toast('Too full! 🤢'); return false; }
    if (!real && S.bal < f.cost) { toast('Tap Refill on the Balance screen'); return false; }
    if (page !== 'home') showPage('home');
    var before = levelFor(p.str), startFull = p.full;
    // pay once, save right away (a reload mid-animation keeps the result)
    S.bal -= f.cost; p.full = Math.min(100, p.full + f.full); p.joy = Math.min(100, p.joy + f.joy); p.str += gainXp(petDef().id, featStr(petDef(), f.str)); p.eaten += f.n;
    if (real) S.bal += f.cost; // real feeds don't touch the pretend balance
    var endFull = p.full, petId = petDef().id;
    eating = true; dispFull = startFull; dispText = startFull; save();
    eatLog = { tier: f.id, bites: 0, planned: BLUP3TS_EAT.plan[f.id].bites, startFull: startFull, endFull: endFull, fills: [], startedAt: performance.now(), done: false, balAfter: S.bal };
    render();
    var pd = petDef(), m = MOUTH[petId] || (Array.isArray(pd.mouth) && pd.mouth.length === 2 ? pd.mouth : null) || (pd.collection === 'ZMB3YS' ? [.5, .62] : [.6, .68]);
    var pw = $('petWrap'), W = pw.offsetWidth || 170, X0 = pw.offsetWidth ? pw.offsetLeft : 113, Y0 = pw.offsetWidth ? pw.offsetTop : 90; // read from the layout (watch or full view)
    BLUP3TS_EAT.run({
      tier: f.id, full: f.full, layer: $('eatLayer'), petChomp: $('petChomp'), petWrap: $('petWrap'), shakeEl: document.querySelector('.case'),
      mouth: { x: X0 + m[0] * W, y: Y0 + m[1] * W }, center: { x: X0 + W / 2, y: Y0 + W / 2 }, reduced: reducedMQ.matches, scale: Math.min(1.25, W / 170),
      onBite: function (i, n) {
        eatLog.bites = i + 1;
        dispFull = startFull + (endFull - startFull) * ((i + 1) / n); eatLog.fills.push(Math.round(dispFull * 10) / 10);
        tweenText(dispFull, 280);
      },
      onDone: function () {
        eating = false; eatLog.done = true; eatLog.ms = Math.round(performance.now() - eatLog.startedAt);
        render(); burst('heart', 4 + f.n);
        toast(real ? 'Fed with ' + ((CFG.TEST_PLAY && CFG.TEST_TOKEN_SYMBOL) || '$BLUNANA') + ' ✔' : '−' + fmt(f.cost) + ' pretend', !real);
        if (real && API.refreshToken) API.refreshToken();
        var after = levelFor(S.pets[petId].str); if (after > before) setTimeout(function () { levelUp(after, before); }, 250);
      }
    });
    return true;
  }
  $('feedBtn').onclick = function () { play('tap'); openFeed(); };

  // ===== Jam (free, 8 seconds of tap-along) =====
  var jamTimer = null, eqTimer = null, jamEnd = 0, jamTaps = 0, jamJoy0 = 0, jamLong = false;
  var BEAT = (function () { // config.js JAM_BEAT, checked
    var c = (window.BLUP3TS_CONFIG || {}).JAM_BEAT || {}, n = function (v, d, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : d; };
    var b = { bpm: n(c.BPM, 120, 40, 240), offset: n(c.OFFSET_MS, 10, -500, 500), perfect: n(c.PERFECT_MS, 80, 20, 200), good: n(c.GOOD_MS, 160, 40, 300), lat: n(c.LATENCY_MS, 70, 0, 400), vlat: n(c.VISUAL_LATENCY_MS, 30, 0, 200), pp: n(c.PERFECT_PTS, 2, 0, 12), gp: n(c.GOOD_PTS, 1, 0, 12), max: n(c.TAP_BONUS_MAX, 12, 0, 12) };
    if (b.good < b.perfect) b.good = b.perfect; b.period = 60000 / b.bpm; return b;
  })();
  var barHold = false, jamT0 = 0, beatPts = 0, lastBeat = null, judged = { perfect: 0, good: 0, miss: 0 }, lastJudge = null, barE = [], barShape = [];
  function audioClock() { var a = sounds.jam_loop; return soundOn && a && !a.paused && a.currentTime > 0 ? a.currentTime * 1000 : null; }
  function beatClock() { var t = audioClock(); return t === null ? { t: perfNow() - jamT0, lat: BEAT.vlat, src: 'visual' } : { t: t - BEAT.offset, lat: BEAT.lat, src: 'audio' }; } // ms on the beat grid
  function perfNow() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function judgeAt(tt) { // tt: tap time on the beat grid (latency already taken off). Nearest beat decides.
    var P = BEAT.period, idx = Math.round(tt / P), d = Math.abs(tt - idx * P);
    return { beat: idx, off: Math.round(d), grade: d <= BEAT.perfect ? 'perfect' : d <= BEAT.good ? 'good' : 'miss' };
  }
  function jamBonus() { return Math.min(BEAT.max, beatPts); }
  var JAM = (function () { // config.js JAM_SECONDS / LONG_JAM_SECONDS / LONG_JAM_LEVEL, checked
    var c = window.BLUP3TS_CONFIG || {}, pi = function (v, d, lo, hi) { return Number.isInteger(v) && v >= lo && v <= hi ? v : d; };
    var q = pi(c.JAM_SECONDS, 8, 3, 60), l = pi(c.LONG_JAM_SECONDS, 16, 4, 120); if (l <= q) l = q * 2;
    return { quick: q, long: l, level: pi(c.LONG_JAM_LEVEL, 6, 1, 999) };
  })();
  var LONG_X = 1.5; // Long Jam: ~1.5x mood, 1.5x hunger cost, needs 1.5x food to start
  function longJamOpen() { return petLevel() >= JAM.level; }
  function openJam() { // below the level: straight into the usual Jam. From the level: Quick (default) or Long, player picks
    if (eating || jamTimer) return;
    if (!longJamOpen()) return startJam(false);
    var p = pet(), enough = p.full >= RULES.minFullToJam * LONG_X;
    $('jamQuick').textContent = '🎸 Quick Jam · ' + JAM.quick + 's'; $('jamLongBtn').textContent = '🎶 Long Jam · ' + JAM.long + 's';
    $('jamLongBtn').disabled = !enough; $('jamChNote').textContent = enough ? 'Long Jam: more mood, uses more food. Both are free.' : 'Long Jam needs ' + Math.ceil(RULES.minFullToJam * LONG_X) + '% food. Feed first, or pick Quick.';
    show('ov-jamch'); $('jamQuick').focus({ preventScroll: true });
  }
  $('jamQuick').onclick = function () { play('tap'); hideOverlays(); startJam(false); };
  $('jamLongBtn').onclick = function () { if (this.disabled) return; play('tap'); hideOverlays(); startJam(true); };
  function startJam(long) {
    if (eating || jamTimer) return;
    long = !!long && longJamOpen();
    var p = pet();
    if (p.full < RULES.minFullToJam * (long ? LONG_X : 1)) { trick('shake', 700); return toast(long ? 'Too hungry for a Long Jam 🍌' : 'Too hungry to jam 🍌'); }
    jamLong = long; jamTaps = 0; jamJoy0 = p.joy; jamT0 = perfNow(); beatPts = 0; lastBeat = null; lastJudge = null; judged = { perfect: 0, good: 0, miss: 0 }; jamEnd = Date.now() + (long ? JAM.long : JAM.quick) * 1000;
    $('longHint').hidden = longJamOpen(); $('longHint').textContent = 'Long Jam unlocks at Level ' + JAM.level;
    var ji = equippedInst(), jo = ji && instOpt(ji); $('jamGroove').textContent = jo ? jo[2] + ' ' + INST_NAME[ji] + ' · 8-bit groove' : '🎸 8-bit groove';
    show('ov-jam'); $('jamJoy').style.width = p.joy + '%'; play('jam_loop');
    $('jamTap').hidden = false; // 'Tap your pet to jam!' prompt: shows every time Jam starts, hides on the first tap
    var bars = document.querySelectorAll('#eq i');
    barE = [].map.call(bars, function () { return 0; }); barShape = [].map.call(bars, function (b, i) { return [.7, .9, 1, .8, .95, 1, .85, .7][i % 8]; });
    var dots = document.querySelectorAll('#beatBar b'), pop = $('jamPop'); if (pop) { pop.hidden = true; pop.textContent = ''; }
    eqTimer = setInterval(function () { // beat marker + bars: bars only move when the player taps, then settle low
      var bc = beatClock(), P = BEAT.period, ph = ((bc.t % P) + P) % P, bi = Math.floor(bc.t / P), on = ph < 110;
      [].forEach.call(dots, function (d, i) { d.classList.toggle('on', on && ((bi % 4) + 4) % 4 === i); d.classList.toggle('now', ((bi % 4) + 4) % 4 === i); });
      $('jamPet').classList.toggle('tick', on); $('stage').classList.toggle('beat', on); // M13: case glow pulses on the beat
      if (!barHold) [].forEach.call(bars, function (b, i) { barE[i] *= 0.88; if (barE[i] < 0.02) barE[i] = 0; b.style.height = Math.round(6 + 32 * barE[i]) + 'px'; });
    }, 33);
    jamTimer = setInterval(function () {
      var left = Math.max(0, Math.ceil((jamEnd - Date.now()) / 1000));
      $('jamTxt').textContent = left ? 'Tap your pet along to the beat · ' + left + 's left · free' : 'Great jam!';
      if (!left) endJam(false);
    }, 200);
  }
  function endJam(silent) {
    if (!jamTimer) return;
    clearInterval(jamTimer); clearInterval(eqTimer); jamTimer = null; stop('jam_loop'); $('jamTap').hidden = true; $('jamPet').classList.remove('tick'); $('stage').classList.remove('beat'); if ($('jamPop')) $('jamPop').hidden = true;
    var p = pet();
    var k = jamLong ? LONG_X : 1; p.joy = Math.min(100, jamJoy0 + Math.round((RULES.jamJoy + jamBonus()) * k)); /* on-beat bonus capped at TAP_BONUS_MAX (12), the same cap as before */ p.full = Math.max(0, p.full - Math.round(RULES.jamCost * k)); p.jams++; // levels come only from feeding $BLUNANA: Jam gives mood, costs hunger, adds no strength
    save(); render();
    if (!silent) {
      $('ov-jam').classList.remove('show'); ovOpen = null; render(); trick('hop', 900); burst('note', 8); toast(jamLong ? '🎶 What a long jam! Mood way up' : '🎸 What a jam! Mood up');
    }
  }
  $('jamBtn').onclick = function () { play('tap'); openJam(); };
  $('jamTap').onclick = function () { $('jamPet').click(); }; // the prompt bubble is part of the picture's tap area
  function jamTapAt(tt) { // one tap on the pet picture at beat-grid time tt
    if (!jamTimer) return null;
    $('jamTap').hidden = true;
    var j = judgeAt(tt); if (j.grade !== 'miss' && lastBeat === j.beat) j.grade = 'miss'; // one scored tap per beat, no spamming
    if (j.grade !== 'miss') lastBeat = j.beat;
    jamTaps++; judged[j.grade]++; lastJudge = j; beatPts += j.grade === 'perfect' ? BEAT.pp : j.grade === 'good' ? BEAT.gp : 0;
    var ji = equippedInst(); if (ji && window.BLUP3TS_EAT) BLUP3TS_EAT.inst(ji); else play('tap'); // short tap sound over the music (sound off: silent)
    var b = $('jamPet'); b.classList.add('beat'); setTimeout(function () { b.classList.remove('beat'); }, 90);
    var jump = j.grade === 'perfect' ? 1 : j.grade === 'good' ? .62 : .22;
    barE = barE.map(function (e, i) { return Math.min(1, Math.max(e, jump * barShape[i] * (.85 + Math.random() * .15))); });
    var bars = document.querySelectorAll('#eq i'); [].forEach.call(bars, function (x, i) { x.style.height = Math.round(6 + 32 * barE[i]) + 'px'; });
    var k = jamLong ? LONG_X : 1; $('jamJoy').style.width = Math.min(100, jamJoy0 + jamBonus() * 2.5 * k) + '%';
    var pop = $('jamPop'); if (pop) {
      pop.textContent = j.grade === 'perfect' ? 'Perfect!' : j.grade === 'good' ? 'Good' : 'Miss'; pop.className = 'jampop g-' + j.grade; pop.hidden = false;
      clearTimeout(pop._t); pop._t = setTimeout(function () { pop.hidden = true; }, 650);
      if (pop.animate && !reducedMQ.matches) pop.animate([{ transform: 'translate(-50%,6px) scale(.8)', opacity: .4 }, { transform: 'translate(-50%,0) scale(1.08)', opacity: 1, offset: .35 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    }
    if (j.grade !== 'miss') {
      var jo = ji && instOpt(ji), n = el('span', null, jamTaps % 2 && jo ? jo[2] : ['🎵', '🎶', '🎸', '🥁'][jamTaps % 4]); var nx = Math.random() * 300, notes = $('notes'); notes.appendChild(n);
      if (n.animate && !reducedMQ.matches) n.animate([{ transform: 'translate(' + nx + 'px,150px)', opacity: 1 }, { transform: 'translate(' + (nx + (Math.random() - .5) * 60) + 'px,-10px)', opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'both' }).onfinish = function () { n.remove(); };
      else setTimeout(function () { n.remove(); }, 900);
    }
    return j;
  }
  $('jamPet').onclick = function () { if (!jamTimer) return; var bc = beatClock(); jamTapAt(bc.t - bc.lat); };

  // ===== Other buttons =====
  function start() { S.started = true; save(); showPage('home'); }
  $('startBtn').onclick = function () { play('tap'); start(); };
  ['walletSoon', 'walletSoon2'].forEach(function (id) { var b = $(id); if (b) { b.hidden = !walletOn(); b.style.display = walletOn() ? '' : 'none'; } }); // only with wallet connect on
  $('walletSoon').onclick = $('walletSoon2').onclick = function () { play('tap'); var Wm = window.BLUP3TS_WALLET; if (walletOn() && Wm && Wm.addOwnTap) Wm.addOwnTap(); else show('ov-soon'); };
  if (!walletOn()) { var sn = document.querySelector('#ov-soon .fine'); if (sn) sn.textContent = 'Wallet connect is coming soon. Then you can play with your own MNK3YS and ZMB3YS. Pretend mode works now and needs no wallet.'; }
  $('refillBtn').onclick = function () { play('tap'); S.bal = START; save(); render(); };

  // ---------- Quick tap fixes (Azgog, Oct 29): little reactions so taps never feel dead ----------
  function keyTap(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }
  [].forEach.call(document.querySelectorAll('#moodPill, #tileHunger, #tileStr, #tileLvl, #balCoin, .betatap, #heroLogo, #homeLogo'), function (n) { n.addEventListener('keydown', keyTap); });
  function bump(n, cls, ms) { if (!n) return; n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); setTimeout(function () { n.classList.remove(cls); }, ms); }
  var patAt = 0;
  $('petImg').addEventListener('click', function () { // pat the pet: bounce + a heart + a toast
    if (eating || jamTimer || page !== 'home') return; var now = Date.now(); if (now - patAt < 450) return; patAt = now;
    play('tap'); trick('hop', 900); toast(petDef().name + ' loves pats! 💛');
    var fx = $('fx'), pw = $('petWrap'), h = el('span', 'patheart', '💛');
    h.style.left = (pw.offsetLeft + pw.offsetWidth / 2) + 'px'; h.style.top = (pw.offsetTop + pw.offsetHeight * .2) + 'px';
    fx.appendChild(h); setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 1100);
  });
  var MOOD_TIP = { Starving: 'Starving! Tap Feed for a big snack.', Hungry: 'Hungry! Tap Feed to share a banana.', Sad: 'Feeling sad. A Jam together will cheer it up.',
    Ecstatic: 'Best day ever: full tummy and lots of fun!', Happy: 'Happy! Keep the bananas and tunes coming.', Okay: 'Doing okay. A snack or a Jam makes it happier.' };
  $('moodPill').onclick = function () { play('tap'); var m = mood(pet()); toast(m[0] + ' ' + (MOOD_TIP[m[1]] || 'Tap Feed or Jam to play together.')); };
  $('tileHunger').onclick = function () { play('tap'); toast('Hunger shows how full your pet is. Tap Feed to fill it up.'); };
  $('tileStr').onclick = $('tileLvl').onclick = function () { play('tap'); showPage('stats'); };
  $('balCoin').onclick = function () { play('tap'); bump(this, 'spin', 900); toast(S.mode === 'wallet' && CFG.TEST_PLAY ? (CFG.TEST_TOKEN_SYMBOL || 'BLUTEST') + ' · test token' : 'Pretend $BLUNANA, play money'); };
  $('sideBtn').onclick = function () { play('tap'); hideOverlays(); if (!S.started) start(); showPage('home'); };
  [].forEach.call(document.querySelectorAll('#screen .betatap'), function (n) { n.onclick = function () { play('tap'); toast('New stuff on the way, share ideas on Discord'); }; });
  if ($('soundBtn')) $('soundBtn').onclick = function () { setSound(!soundOn); };
  if ($('spkHome')) $('spkHome').onclick = function (e) { e.stopPropagation(); setSound(!soundOn); }; // Home corner: quick mute / unmute
  (function () { // M13: in-game speaker icon opens a 0..100 volume slider (top bar, same spot in Watch and Phone)
    var b = $('spkWatch'), r = $('volSlider'), box = $('volCtl'); if (!b || !r || !box) return;
    function open(on) { r.hidden = !on; b.setAttribute('aria-expanded', on ? 'true' : 'false'); box.classList.toggle('open', on); var gb = box.parentNode; if (gb) gb.classList.toggle('volopen', on); fit(); }
    b.onclick = function (e) { e.stopPropagation(); open(r.hidden); if (!r.hidden) try { r.focus({ preventScroll: true }); } catch (x) {} };
    ['pointerdown', 'touchstart'].forEach(function (t) { r.addEventListener(t, function () { unlock(); }, { passive: true }); });
    r.addEventListener('input', function () { setVolume(r.value); });
    r.addEventListener('change', function () { setVolume(r.value); });
    r.addEventListener('keydown', function (e) { if (e.key === 'Escape') { open(false); b.focus(); } });
    document.addEventListener('click', function (e) { if (!r.hidden && !box.contains(e.target)) open(false); }, true); // close on the click (not pointerdown): the bar re-lays out after the tap has found its button
  })();
  function speedLabel() { $('speedBtn').textContent = '⏩ Speed: ' + SPEEDS[S.speed][1]; }
  $('speedBtn').onclick = function () { S.speed = (S.speed + 1) % SPEEDS.length; speedLabel(); save(); };
  $('hungryBtn').onclick = function () { var p = pet(); p.full = 22; p.joy = Math.min(p.joy, 45); if (page === 'launch') start(); render(); save(); };
  function resetSandbox() {
    clearKeys(); endJam(true); BLUP3TS_EAT.cancel(); eating = false; S = fresh(); setSound(false, true); simClock = new Date(2026, 9, 22, 10, 9).getTime();
    S.started = true; save(); setPetArt(); speedLabel(); showPage('home'); toast('Progress reset ✨'); if (API.onReset) API.onReset();
  }
  $('resetBtn').onclick = function () {
    if (window.confirm('Reset progress? This clears your pretend balance, pets and looks on this device and starts fresh with MNK3Y #1579.')) resetSandbox();
  };
  document.addEventListener('pointerdown', function () { if (soundOn) unlock(); }, true);

  // ===== Fit the watch to the screen =====
  function isFull() { return S.layout === 'phone'; } // M13: the Phone view (open foldable)
  (function () { var pi = $('petImg'), fp = $('foldPet'); if (!pi || !fp || !window.MutationObserver) return; // M13: left screen shows the pet while menus are open
    var sync = function () { fp.src = pi.src; }; sync(); new MutationObserver(sync).observe(pi, { attributes: true, attributeFilter: ['src'] }); })();
  function foldSide() { return S.fold === 'h' ? true : S.fold === 'v' ? false : window.innerWidth > window.innerHeight && window.innerWidth >= 640; } // M13: Auto = side by side when wide/landscape
  function caseFxFit(full, side) { // the case art SVG follows the device: gold bits on top, drips/slime hang off the bottom edge
    var fx = document.querySelector('.casefx'); if (!fx) return;
    var H = full ? (side ? 598 : 934) : 660, dy = full ? (side ? 542 : 878) - 588 : 0;
    fx.setAttribute('viewBox', '0 0 452 ' + H);
    [].forEach.call(fx.querySelectorAll('.fxbot'), function (g) { if (full) g.setAttribute('transform', 'translate(0 ' + dy + ')'); else g.removeAttribute('transform'); });
    [].forEach.call(fx.querySelectorAll('.fxtop'), function (g) { if (full) g.setAttribute('transform', 'translate(0 -14)'); else g.removeAttribute('transform'); });
  }

  // Quick tap fixes: in portrait, the crown, the screen dots and the side button each get >= 44 real pixels to tap,
  // without covering the pet or the stat tiles: crown grows out to the window edge, dots sit just left of it, side button under it.
  function sideFit() {
    var cr = $('crown'), dt = $('dots'), sb = $('sideBtn'), st = $('stage'); if (!cr || !dt || !sb || !st) return;
    [cr, sb].forEach(function (n) { n.style.height = ''; n.style.borderTop = ''; n.style.borderBottom = ''; n.style.width = ''; n.style.right = ''; n.style.borderRight = ''; n.style.borderLeft = ''; n.style.top = ''; });
    dt.style.top = ''; dt.style.right = ''; [].forEach.call(dt.children, function (b) { b.style.transform = ''; b.style.removeProperty('--dx'); }); st.classList.remove('t44'); var pw = $('petWrap'); if (pw) { pw.style.left = ''; pw.style.width = ''; pw.style.height = ''; }
    var f = wmScale || 1, sr = st.getBoundingClientRect(), gv = $('gameView'); if (!sr.width) return;
    if (window.innerHeight <= window.innerWidth || (gv && gv.classList.contains('fold-h'))) { // landscape + Duo side by side: layout unchanged; the side button's tap area only grows outward
      var r0 = sb.getBoundingClientRect(), cs0 = getComputedStyle(sb), er0 = Math.max(0, Math.min(44.5 - r0.width, window.innerWidth - r0.right - 2));
      if (er0 > 0) { if (cs0.boxSizing === 'border-box') sb.style.width = (sb.offsetWidth + er0 / f) + 'px'; sb.style.right = (parseFloat(cs0.right) - er0 / f) + 'px'; sb.style.borderRight = (er0 / f) + 'px solid transparent'; }
      return;
    }
    var L = 44 / f + 0.5; st.style.setProperty('--t44', L + 'px'); st.classList.add('t44');
    function widen(n) {
      var r = n.getBoundingClientRect(), cs = getComputedStyle(n), need = 44.5 - r.width; if (need <= 0) return;
      var er = Math.max(0, Math.min(need, window.innerWidth - r.right)), el_ = need - er;
      if (cs.boxSizing === 'border-box') n.style.width = (n.offsetWidth + need / f) + 'px'; // borders below are transparent tap area; the drawn part keeps its size
      if (er) { n.style.right = (parseFloat(cs.right) - er / f) + 'px'; n.style.borderRight = (er / f) + 'px solid transparent'; }
      if (el_) n.style.borderLeft = (parseFloat(cs.borderLeftStyle === 'none' ? 0 : cs.borderLeftWidth) + el_ / f) + 'px solid transparent';
    }
    function tall(n) { // small screens: grow the tap area up and down with transparent borders (the drawn part keeps its size and place)
      var r = n.getBoundingClientRect(), cs = getComputedStyle(n), need = 44.5 - r.height; if (need <= 0) return; var h = need / 2 / f;
      if (cs.boxSizing === 'border-box') n.style.height = (n.offsetHeight + need / f) + 'px';
      n.style.top = (parseFloat(cs.top) - h) + 'px';
      n.style.borderTop = (parseFloat(cs.borderTopStyle === 'none' ? 0 : cs.borderTopWidth) + h) + 'px solid transparent';
      n.style.borderBottom = (parseFloat(cs.borderBottomStyle === 'none' ? 0 : cs.borderBottomWidth) + h) + 'px solid transparent';
    }
    widen(cr); widen(sb); tall(cr); tall(sb);
    var c = cr.getBoundingClientRect(), s = sb.getBoundingClientRect();
    if (s.top < c.bottom + 2) sb.style.top = (sb.offsetTop + (c.bottom + 2 - s.top) / f) + 'px';
    var d = dt.getBoundingClientRect(), cs = getComputedStyle(dt);
    if (d.right > c.left) dt.style.right = (parseFloat(cs.right) + (d.right - c.left) / f) + 'px';
    var sc = $('screen').getBoundingClientRect(), top = Math.max(sc.top + 82 * f, c.top - 16); // under the mood badge row
    dt.style.top = (dt.offsetTop + (top - d.top) / f) + 'px';
    // small watches (320px): a dot's 44px tap area must not lie over a stat tile; slide just that tap area right (toward the screen edge), the dot stays drawn where it was
    var tiles = ['tileHunger', 'tileStr', 'tileLvl'].map(function (id) { var e = $(id); return e && e.offsetParent ? e.getBoundingClientRect() : null; }).filter(Boolean);
    [].forEach.call(dt.children, function (b) { var r = b.getBoundingClientRect(), dx = 0;
      tiles.forEach(function (t) { if (r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top) dx = Math.max(dx, t.right + 1 - r.left); });
      dx = Math.min(dx, window.innerWidth - r.right); if (dx > 0) { b.style.transform = 'translateX(' + (dx / f) + 'px)'; b.style.setProperty('--dx', (-dx / f) + 'px'); } });
    // Duo portrait: the pet picture moves left into the space beside the dots rail (shrinks only if that is not enough), so the dots never cover it
    if (pw && gv && gv.classList.contains('full')) {
      var pr = pw.getBoundingClientRect(), dl = Math.min.apply(null, [].map.call(dt.children, function (b) { return b.getBoundingClientRect().left; })), over = (pr.right - (dl - 4)) / f;
      if (over > 0) { var l0 = pw.offsetLeft, w0 = pw.offsetWidth, right = l0 + w0 - over, nl = Math.max(16, right - w0), nw = right - nl;
        pw.style.left = nl + 'px'; pw.style.width = nw + 'px'; pw.style.height = nw + 'px'; }
    }
  }
  function deskOn() { return window.matchMedia('(min-width: 700px) and (min-height: 600px)').matches; }
  function deskBox() {
    var gv = $('gameView'); if (!gv) return null;
    var box = gv.getBoundingClientRect(); if (box.width < 200 || box.height < 200) return null;
    var side = gv.querySelector('.sidecol'), sw = side ? side.getBoundingClientRect().width : 0;
    var bar = gv.querySelector('.gamebar'), barH = bar ? bar.getBoundingClientRect().height + 20 : 0;
    return { w: Math.max(200, box.width - (sw > 40 ? sw + 36 : 420)), h: Math.max(200, box.height - barH) };
  }
  function deskFrame() {
    var vv = window.visualViewport, h = vv && vv.height ? vv.height : window.innerHeight;
    document.body.style.setProperty('--vvh', Math.round(h) + 'px');
  }
  function fit() {
    var gv = $('gameView'), full = isFull(), side = full && foldSide();
    document.body.classList.toggle('desk', deskOn());
    deskFrame();
    if (gv) { gv.classList.toggle('full', full); gv.classList.toggle('fold-h', side); gv.classList.toggle('fold-v', full && !side); }
    caseFxFit(full, side);
    if (full) { // M13: Full view = an open foldable phone (two screens + hinge) that fits the window
      var FW = side ? 856 : 452, FH = side ? 598 : 934, desk = deskOn() && gv && gv.classList.contains('on') ? deskBox() : null;
      var top = Math.max(56, Math.round($('stagewrap').getBoundingClientRect().top + (window.scrollY || 0))), avail = Math.min(window.innerWidth, ($('gameView') && $('gameView').clientWidth) || window.innerWidth) - (window.innerWidth >= 900 && !deskOn() ? 394 : 0), // wide phones kept a side column for a how-to that is not on this page
        // NEXT BATCH mock: on a phone the Duo device may use the side padding too (it stays centred, no sideways scroll)
        fs = desk ? Math.min((desk.w - 12) / FW, desk.h / FH) : Math.min(((window.innerWidth < 600 ? window.innerWidth - 4 : avail - 12)) / FW, (window.innerHeight - top - 8) / FH);
      fs = Math.max(.3, Math.min(1.6, fs)); // Stacked on a landscape phone gets small but never clips
      $('stage').style.transform = 'scale(' + fs + ')'; $('stagewrap').style.width = (FW * fs) + 'px'; $('stagewrap').style.height = (FH * fs) + 'px';
      wmScale = fs; $('stage').style.setProperty('--fs', fs); wmFit(); sideFit(); return;
    }
    var w = Math.min(window.innerWidth - 24, 560), s = Math.min(1, w / 452, (window.innerHeight * .9) / 660);
    var deskWatch = deskOn() && gv && gv.classList.contains('on') ? deskBox() : null;
    if (deskWatch) s = Math.min(deskWatch.w / 452, deskWatch.h / 660, 1.55);
    else if (window.innerWidth >= 900) s = Math.min(1, (window.innerHeight - 250) / 660);
    s = Math.max(.55, s);
    // short landscape phones: keep the watch big enough to tap (the page scrolls a little instead)
    if (window.innerHeight < 520 && window.innerWidth > window.innerHeight) s = Math.max(s, Math.min(.8, (window.innerWidth - 24) / 452));
    $('stage').style.transform = 'scale(' + s + ')';
    $('stagewrap').style.width = (452 * s) + 'px'; $('stagewrap').style.height = (660 * s) + 'px';
    wmScale = s; $('stage').style.setProperty('--fs', s); wmFit(); sideFit();
  }
  // M13: the watermark link gets a tap area of about 44 real pixels whatever the device scale. Watch: grows down into the bezel / strap.
  // Phone: grows up into the empty space under Feed / Jam, only on the pet screen with no menu open (so it never covers other controls).
  var wmScale = 1, wmLast = '';
  function wmFit() {
    var a = $('gameWm'); if (!a) return;
    var full = isFull(), side = full && foldSide(), roomy = page === 'home' && !ovOpen, need = 44 / (wmScale || 1), h, b;
    if (!full) { var top = roomy ? 35 : 22; h = Math.max(44, need, top + 19); b = 16 + top - h; } // box top sits `top` px above the screen bottom
    else { var room = side ? 128 : 96, t = roomy ? Math.max(32, Math.min(need - 16, room)) : 24; h = 16 + t; b = 0; }
    var k = Math.round(h) + '|' + Math.round(b); if (k === wmLast) return; wmLast = k;
    a.style.height = Math.round(h) + 'px'; a.style.bottom = Math.round(b) + 'px';
  }
  window.addEventListener('resize', fit);
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); }
  fit();

  // hooks for automated checks
  // ===== API for home.js and wallet.js =====
  var API = window.BLUP3TS_APP = {
    cases: caseList, casePreviews: casePreviews, setCase: function (id, d) { var ok = setCase(id, d); if (ok) render(); return ok; }, caseOf: caseOf, caseUnlocked: caseUnlocked,
    state: function () { return S; }, save: save, render: render, toast: toast, el: el, fmt: fmt, play: play, mood: mood, levelFor: levelFor, foods: FOODS,
    isEating: function () { return eating; }, petDef: petDef, petState: function (id) { if (!S.pets[id]) S.pets[id] = newPet(); return S.pets[id]; },
    pets: function () { return DATA.pets; },
    // M11: while a wallet is connected (Wallet mode) only the wallet's own pets are shown; starters stay in DATA.pets (hidden) and come back on disconnect
    refreshPets: function () { if (page === 'pets') renderPets(); }, // M13: wallet state changed -> redraw the pet list (Add my own row)
    visiblePets: visiblePets, setStarterFilter: function (fn) { hideStarters = typeof fn === 'function' ? fn : function () { return false; }; },
    setActive: function (id) { if (eating) return false; if (!DATA.pets.some(function (p) { return p.id === id; })) return false; S.active = id; save(); setPetArt(); render(); if (page === 'pets') renderPets(); if (page === 'stats') renderTraits(); return true; },
    addPets: function (list) { rarCache = {}; DATA.pets = DATA.pets.filter(function (p) { return !p.owned; }).concat(list); list.forEach(function (p) { if (!S.pets[p.id]) S.pets[p.id] = newPet(); }); setPetArt(); render(); save(); },
    // A pet's progress belongs to the wallet holding it. A different holder starts again at zero.
    noteHolder: function (wallet, ids) {
      if (typeof wallet !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet) || !Array.isArray(ids)) return;
      ids.forEach(function (id) {
        var p = S.pets[id]; if (!p || !p.holder || p.holder === wallet) return;
        S.pets[id] = { full: 0, joy: 0, str: 0, eaten: 0, jams: 0, holder: wallet };
        if (S.looks[id]) delete S.looks[id];
      });
      save();
    },
    applyProgress: function (rows) { if (!Array.isArray(rows)) return; rows.forEach(function (q) { if (!q || !/^own-[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q.id)) return; var cur = S.pets[q.id], str = Math.max(0, +q.str || 0); if (!q.reset && cur && cur.str > str) return; S.pets[q.id] = { full: clamp(q.full), joy: clamp(q.joy), str: str, eaten: Math.max(0, +q.eaten || 0), jams: Math.max(0, +q.jams || 0), holder: typeof q.holder === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q.holder) ? q.holder : (cur && cur.holder) }; if (q.reset && S.looks[q.id]) delete S.looks[q.id]; }); save(); render(); },
    removeOwnedPets: function () { DATA.pets = DATA.pets.filter(function (p) { return !p.owned; }); setPetArt(); render(); },
    setMode: function (m) { var was = S.mode; S.mode = m === 'wallet' && walletOn() ? 'wallet' : 'pretend'; save(); if (was === 'wallet' && S.mode === 'pretend' && window.BLUP3TS_FLOOR) BLUP3TS_FLOOR.reroll(); }, /* back to Pretend: fresh random floor pets */
    refreshStarters: function () { rarCache = {}; setPetArt(); render(); if (page === 'pets') renderPets(); }, /* starters.js put new floor pets in the starter slots (same ids, same progress) */ walletOn: walletOn,
    setSound: function (on) { setSound(on); }, soundOn: function () { return soundOn; }, setVolume: function (v) { setVolume(v); }, volume: function () { return S.vol; },
    audioLevels: function () { return { vol: S.vol, jam: sounds.jam_loop.volume, tap: sounds.tap.volume, sfx: window.BLUP3TS_EAT && BLUP3TS_EAT.volume ? BLUP3TS_EAT.volume() : null }; },
    start: function () { S.started = true; save(); showPage('home'); fit(); },
    feedReal: function (f) { return feed(f, true); }, showPage: showPage, hideOverlays: hideOverlays, show: show,
    mouth: MOUTH, xp: null, onAddOwn: null, realFeedSection: null, onReset: null, onSound: null,
    setLayout: function (l) { S.layout = l === 'watch' ? 'watch' : 'phone'; save(); fit(); render(); }, layout: function () { return S.layout; }, fit: fit, // 'full' (older name) = Phone
    MODES: ['watch', 'phone'], setFold: function (f) { S.fold = f === 'v' || f === 'h' ? f : 'auto'; save(); fit(); }, fold: function () { return S.fold; },
    rarity: rarityInfo, origOn: origOn, setOrig: function (on, adult) { if (adult === true) S.adult = true; S.orig = !!on && S.adult === true; save(); if (page === 'stats') renderTraits(); },
    renderTraits: renderTraits
  };
  window.blup3tsSandbox = { decay: function (h) { decay(h); render(); }, decayRate: decayRate, levelUp: levelUp, trick: trick, burst: burst, rarity: rarityInfo, featStr: featStr, setStr: function (n) { pet().str = n; save(); render(); }, jamInfo: function () { var bc = jamTimer ? beatClock() : null; return { on: !!jamTimer, long: jamLong, taps: jamTaps, msLeft: jamTimer ? jamEnd - Date.now() : 0, cfg: JAM, beat: BEAT, clock: bc, points: beatPts, bonus: jamBonus(), judged: judged, last: lastJudge, bars: [].map.call(document.querySelectorAll('#eq i'), function (b) { return parseFloat(b.style.height) || 0; }) }; }, jamJudge: function (tt) { return judgeAt(tt); }, jamHoldBars: function (on) { barHold = !!on; }, /* screenshots only: pause the bar settle */ jamTapAt: function (offMs, beatsAhead) { if (!jamTimer) return null; var bc = beatClock(), P = BEAT.period, idx = Math.round((bc.t - bc.lat) / P) + (beatsAhead || 0); return jamTapAt(idx * P + (offMs || 0)); }, openJam: openJam, instruments: function () { return { levels: INST, open: INST_OPTS.filter(function (o) { return instOpen(o[0]); }).map(function (o) { return o[0]; }), equipped: equippedInst() }; }, reset: resetSandbox, eating: function () { return eating; }, eatLog: function () { return eatLog; },  state: function () { return S; }, showPage: showPage, openFeed: openFeed, feed: function (i) { feed(typeof i === 'string' ? FOODS.filter(function (f) { return f.id === i; })[0] : FOODS[i]); }, startJam: startJam, openLooks: openLooks };

  setPetArt(); speedLabel(); if (S.vol > 0) lastVol = S.vol; setVolume(S.vol, true); showPage(page);
  var last = performance.now();
  setInterval(function () { var now = performance.now(), sec = (now - last) / 1000; last = now; if (!S.started) return; var ps = sec * SPEEDS[S.speed][0]; decay(ps / 3600); simClock += ps * 1000; render(); }, 250);
  setInterval(save, 3000);
  // M13: the single "Made by Azgog (@azgog)" watermark links to @BluP3ts on X. Opens a new tab / the system browser;
  // wallet in-app browsers (Solflare, Phantom) sometimes ignore target=_blank, so fall back to opening it in place.
  [].forEach.call(document.querySelectorAll('a.wmlink, a.extlink'), function (a) { // also the Adopt link
    a.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault(); var w = null;
      try { w = window.open(a.href, '_blank'); } catch (_) { w = null; }
      if (w) { try { w.opener = null; } catch (_) {} } else { location.href = a.href; }
    });
  });
})();
