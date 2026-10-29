// Starter pets with no wallet. Runs after data.js, before app.js.
// - LP Doll and the Legendary MNK3Y stay in data.js, hidden behind LPDOLLZ_ENABLED / LEGENDARY_STARTER_ENABLED.
// - FLOOR_STARTERS (Azgog, Oct 29: "randomize the MNK3Y and ZMB3Y each time the wallet is not selected in pretend mode"):
//   every load in Pretend mode, and every switch from Wallet back to Pretend, shows a fresh random 'floor' MNK3Y + ZMB3Y from
//   netlify/functions/floor-pets.js (server-side, cached, family-filtered, mint + name + picture only), avoiding the last pick.
// - Progress stays with the two starter SLOTS: a floor pet takes the slot's id (the bundled pet's id), so hunger, strength,
//   level, looks and the active pet carry over when the picture changes.
// - The bundled MNK3Y #1579 + ZMB3Y #1885 show straight away and stay if the lookup fails. The live pets swap in when they
//   arrive, unless the player has already tapped something on this load (then the bundled pets stay until next time).
(function () {
  var C = window.BLUP3TS_CONFIG || {}, D = window.BLUP3TS_DATA; if (!D || !D.pets) return;
  var LAST = 'blup3ts.web.floorlast', COLS = ['MNK3YS', 'ZMB3YS'];
  D.allStarters = D.pets.slice(); // everything kept for later
  function common(p) { return !(p.rank && p.rank <= 100); } // the Legendary (rank 16) is never a 'floor' pet
  function keepExtra(p) { return (C.LPDOLLZ_ENABLED && p.collection === 'LP Dollz') || (C.LEGENDARY_STARTER_ENABLED && !common(p)); }
  if (!C.FLOOR_STARTERS) { D.pets = D.pets.filter(function (p) { return (C.LPDOLLZ_ENABLED || p.collection !== 'LP Dollz') && (C.LEGENDARY_STARTER_ENABLED || common(p)); }); return; }
  function first(col) { return D.pets.filter(function (p) { return p.collection === col && common(p); })[0]; }
  var bundled = [first('MNK3YS'), first('ZMB3YS')].filter(Boolean), extra = D.pets.filter(keepExtra);
  if (bundled.length !== 2) return;
  var SLOT = { MNK3YS: bundled[0].id, ZMB3YS: bundled[1].id }; // progress lives here, whatever picture fills the slot
  D.pets = bundled.concat(extra); D.floorSource = 'bundled';
  try { localStorage.removeItem('blup3ts.web.floorpick'); } catch (e) {} // older 'same pets on this device' pick: no longer used
  function okRow(x) { return !!x && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(x.mint || '')) && typeof x.image === 'string' && /^https:\/\/img-cdn\.magiceden\.dev\/[^\s"'<>]+$/.test(x.image) &&
    (x.name === undefined || (typeof x.name === 'string' && x.name.length <= 40)); }
  function slotPet(x, col) { return { id: SLOT[col], name: x.name || col, collection: col, img: x.image, round: false, traits: [], floor: true, mint: String(x.mint) }; }
  function last() { try { return JSON.parse(localStorage.getItem(LAST) || 'null') || {}; } catch (e) { return {}; } }
  function pick(rows, avoid) { // random, never the same as last time when there is another choice
    var ok = rows.filter(okRow), pool = ok.filter(function (x) { return String(x.mint) !== avoid; }); if (!pool.length) pool = ok;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  var list = null, wantSwap = true, touched = false;
  function pretend() { var A = window.BLUP3TS_APP; if (A && A.state) return A.state().mode !== 'wallet'; try { return localStorage.getItem('blup3ts.web.mode') !== '"wallet"'; } catch (e) { return true; } }
  function apply() { // put a fresh random floor pet in each slot
    if (!list || !pretend()) return false;
    var L = last(), shown = {}; D.pets.forEach(function (p) { if (p.floor) shown[p.collection] = p.mint; });
    var got = {}; COLS.forEach(function (col) { var x = pick(list[col], shown[col] || L[col]); if (x) got[col] = slotPet(x, col); });
    if (!got.MNK3YS || !got.ZMB3YS) return false;
    D.pets = D.pets.map(function (p) { return !p.owned && p.id === SLOT.MNK3YS ? got.MNK3YS : !p.owned && p.id === SLOT.ZMB3YS ? got.ZMB3YS : p; });
    D.floorSource = list.source;
    try { localStorage.setItem(LAST, JSON.stringify({ MNK3YS: got.MNK3YS.mint, ZMB3YS: got.ZMB3YS.mint })); } catch (e) {}
    var A = window.BLUP3TS_APP, H = window.BLUP3TS_HOME;
    if (A && A.refreshStarters) A.refreshStarters(); if (H && H.renderCarousel) H.renderCarousel();
    return true;
  }
  function load() {
    if (!C.FLOOR_ENDPOINT || !/^\/[\w\/.-]+$/.test(C.FLOOR_ENDPOINT) || location.protocol === 'file:' || !window.fetch) return Promise.resolve(null);
    return fetch(C.FLOOR_ENDPOINT, { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.live || !Array.isArray(j.mnk3ys) || !Array.isArray(j.zmb3ys) || !j.mnk3ys.length || !j.zmb3ys.length) return null;
      list = { MNK3YS: j.mnk3ys, ZMB3YS: j.zmb3ys, source: j.source || 'live' }; return list;
    }).catch(function () { return null; });
  }
  // a tap or key before the live pets arrive = the player already chose; don't swap the picture under them on this load
  function touch(e) { if (e.isTrusted) touched = true; }
  document.addEventListener('pointerdown', touch, true); document.addEventListener('keydown', touch, true);
  load().then(function () { if (wantSwap && !touched) apply(); wantSwap = false;
    document.removeEventListener('pointerdown', touch, true); document.removeEventListener('keydown', touch, true); });
  // app.js calls this when the player switches from Wallet back to Pretend
  window.BLUP3TS_FLOOR = { reroll: function () { if (list) return apply(); load().then(function () { apply(); }); return false; }, slots: function () { return SLOT; } };
})();
