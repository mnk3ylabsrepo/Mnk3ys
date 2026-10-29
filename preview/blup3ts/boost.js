// BLUP3TS game boost from burning one compressed NFT (cNFT) of a pinned collection.
// OFF: needs BURN_BOOST_ENABLED=true AND BLUNANA_CNFT_COLLECTION set in config.js. The boost is in-game only.
// The rules core is pure (no DOM) so it can be unit tested; wallet.js drives the burn itself.
(function (root) {
  'use strict';
  var RULES = Object.freeze({ hunger: 20, mood: 20, xpMult: 1.5, minutes: 30, xpBonusCap: 200, perDay: 1 });
  function dayOf(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function core(opts) {
    var now = opts.now || Date.now, cfg = opts.cfg || {}, load = opts.load || function () { return null; }, save = opts.save || function () {};
    var s = clean(load());
    function clean(v) {
      var o = { day: '', count: 0, until: 0, petId: null, bonus: 0, used: [] };
      if (!v || typeof v !== 'object') return o;
      if (typeof v.day === 'string') o.day = v.day.slice(0, 12);
      if (isFinite(v.count) && v.count >= 0) o.count = Math.min(99, Math.floor(v.count));
      if (isFinite(v.until) && v.until > 0) o.until = Math.min(+v.until, now() + RULES.minutes * 60000); // never longer than one boost
      if (typeof v.petId === 'string' && /^[A-Za-z0-9-]{3,48}$/.test(v.petId)) o.petId = v.petId;
      if (isFinite(v.bonus) && v.bonus >= 0) o.bonus = Math.min(RULES.xpBonusCap, +v.bonus);
      if (Array.isArray(v.used)) o.used = v.used.filter(function (x) { return typeof x === 'string' && x.length <= 44; }).slice(-200);
      return o;
    }
    function roll() { var d = dayOf(now()); if (s.day !== d) { s.day = d; s.count = 0; } }
    function enabled() { return cfg.BURN_BOOST_ENABLED === true && typeof cfg.BLUNANA_CNFT_COLLECTION === 'string' && cfg.BLUNANA_CNFT_COLLECTION.length >= 32; }
    function active(petId) { return s.until > now() && (!petId || s.petId === petId); }
    // why a new boost can't start right now (null = it can)
    function blockReason(petId, assetId) {
      if (!enabled()) return 'Coming soon';
      roll();
      if (!petId) return 'Pick a pet first';
      if (s.until > now()) return 'A boost is already running';
      if (s.count >= RULES.perDay) return 'One boost a day. Come back tomorrow';
      if (assetId && s.used.indexOf(assetId) >= 0) return 'That NFT was already used';
      return null;
    }
    // Call ONLY after the burn is confirmed on Solana and re-checked (collection + owner + burnt).
    function apply(petId, assetId, pet, proof) {
      var why = blockReason(petId, assetId); if (why) throw new Error(why);
      if (!proof || proof.confirmed !== true || proof.burnt !== true || proof.collection !== cfg.BLUNANA_CNFT_COLLECTION || proof.assetId !== assetId || !proof.ownerOk) throw new Error('burn not verified');
      pet.full = Math.min(100, pet.full + RULES.hunger); pet.joy = Math.min(100, pet.joy + RULES.mood);
      s.count++; s.until = now() + RULES.minutes * 60000; s.petId = petId; s.bonus = 0; s.used.push(assetId); save(s);
      return { until: s.until };
    }
    // XP (strength) gain while boosted: x1.5, but the extra is capped per boost.
    function xp(petId, base) {
      base = Math.max(0, +base || 0);
      if (!enabled() || !active(petId)) return base;
      var extra = Math.min(base * (RULES.xpMult - 1), Math.max(0, RULES.xpBonusCap - s.bonus));
      s.bonus += extra; save(s); return base + extra;
    }
    function reset() { s = clean(null); save(s); }
    return { rules: RULES, enabled: enabled, active: active, blockReason: blockReason, apply: apply, xp: xp, state: function () { return s; }, reset: reset,
      left: function () { return Math.max(0, s.until - now()); } };
  }
  root.BLUP3TS_BOOST_CORE = core;
})(typeof window !== 'undefined' ? window : globalThis);
