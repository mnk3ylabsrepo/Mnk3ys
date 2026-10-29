// Starter pets with no wallet. Runs after data.js, before app.js.
// - LP Doll and the Legendary MNK3Y stay in data.js, hidden behind LPDOLLZ_ENABLED / LEGENDARY_STARTER_ENABLED.
// - FLOOR_STARTERS: one random 'floor' MNK3Y + one random 'floor' ZMB3Y from netlify/functions/floor-pets.js
//   (server-side, cached, mint + name + picture only). The pick is saved on this device so the pet and its progress stay.
// - Until a live pick exists, the bundled MNK3Y #1579 + ZMB3Y #1885 show straight away; the live pets swap in when they
//   arrive, unless the player has already tapped something (then the live pick waits for the next visit).
(function () {
  var C = window.BLUP3TS_CONFIG || {}, D = window.BLUP3TS_DATA; if (!D || !D.pets) return;
  var PICK = 'blup3ts.web.floorpick';
  D.allStarters = D.pets.slice(); // everything kept for later
  function common(p) { return !(p.rank && p.rank <= 100); } // the Legendary (rank 16) is never a 'floor' pet
  function keepExtra(p) { return (C.LPDOLLZ_ENABLED && p.collection === 'LP Dollz') || (C.LEGENDARY_STARTER_ENABLED && !common(p)); }
  if (!C.FLOOR_STARTERS) { D.pets = D.pets.filter(function (p) { return (C.LPDOLLZ_ENABLED || p.collection !== 'LP Dollz') && (C.LEGENDARY_STARTER_ENABLED || common(p)); }); return; }
  function first(col) { return D.pets.filter(function (p) { return p.collection === col && common(p); })[0]; }
  var base = [first('MNK3YS'), first('ZMB3YS')].filter(Boolean), extra = D.pets.filter(keepExtra);
  D.floorSource = 'bundled';
  function livePet(x, col) { return { id: 'flr-' + String(x.mint).slice(0, 40), name: x.name || col, collection: col, img: x.image, round: false, traits: [], floor: true, mint: String(x.mint) }; }
  function okPet(p, col) { return !!p && p.collection === col && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.mint || '') && p.id === 'flr-' + p.mint.slice(0, 40) &&
    typeof p.img === 'string' && /^https:\/\/img-cdn\.magiceden\.dev\/[^\s"'<>]+$/.test(p.img) && typeof p.name === 'string' && p.name.length <= 40; }
  // ?fresh=1 starts over, so drop the saved pick before anything reads it.
  if (/[?&]fresh=1/.test(location.search)) { try { localStorage.removeItem(PICK); } catch (e) {} }
  var lp = null; try { lp = JSON.parse(localStorage.getItem(PICK) || 'null'); } catch (e) {}
  if (lp && okPet(lp.MNK3YS, 'MNK3YS') && okPet(lp.ZMB3YS, 'ZMB3YS')) { base = [lp.MNK3YS, lp.ZMB3YS]; D.floorSource = lp.source || 'live'; }
  D.pets = base.concat(extra);
  if (D.floorSource !== 'bundled' || !C.FLOOR_ENDPOINT || !/^\/[\w\/.-]+$/.test(C.FLOOR_ENDPOINT) || location.protocol === 'file:' || !window.fetch) return;
  var touched = false; // a tap or key before the live pets arrive = the player already chose; don't swap under them
  function touch(e) { if (e.isTrusted) touched = true; }
  document.addEventListener('pointerdown', touch, true); document.addEventListener('keydown', touch, true);
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  fetch(C.FLOOR_ENDPOINT, { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.live || !j.mnk3ys || !j.zmb3ys || !j.mnk3ys.length || !j.zmb3ys.length) return;
    var m = livePet(pick(j.mnk3ys), 'MNK3YS'), z = livePet(pick(j.zmb3ys), 'ZMB3YS');
    if (!okPet(m, 'MNK3YS') || !okPet(z, 'ZMB3YS')) return;
    try { localStorage.setItem(PICK, JSON.stringify({ MNK3YS: m, ZMB3YS: z, source: j.source || 'live' })); } catch (e) {}
    if (touched) return; // saved for next visit
    var A = window.BLUP3TS_APP, H = window.BLUP3TS_HOME, old = D.pets.slice(0, 2);
    if (A && A.petState) [m, z].forEach(function (n, i) { var o = A.petState(old[i].id), s = A.petState(n.id); Object.keys(o).forEach(function (k) { s[k] = o[k]; }); }); // same demo hunger as the bundled pet
    var wasActive = A && A.petDef ? A.petDef().id : null;
    D.pets.splice(0, 2, m, z); D.floorSource = j.source || 'live';
    if (A && A.setActive) A.setActive(wasActive === old[1].id ? z.id : m.id);
    if (H && H.renderCarousel) H.renderCarousel();
  }).catch(function () {}).then(function () { document.removeEventListener('pointerdown', touch, true); document.removeEventListener('keydown', touch, true); });
})();
