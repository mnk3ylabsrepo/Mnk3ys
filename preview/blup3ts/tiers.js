// BLUP3TS rarity tiers (P2 prep, display only). Tiers come from config.js RARITY_TIERS (percent of each
// collection's size). Perks (strength per feed, Store discount) apply ONLY when RARITY_PERKS_ENABLED is true;
// while it is false every perk is 0, so nothing in the game changes. Feed costs are the same for everyone.
// The rank shown here is a PREVIEW: a starter pet uses its saved Orbis rank; any other pet gets an estimate from
// the local trait counts in rarity.js (traits treated as independent). Real ranking moves server-side in P2.
// Works for any collection that has trait counts in rarity.js (MNK3YS, ZMB3YS today; LP Dollz and future
// partners show 'Rank coming soon' until their counts are added).
(function (root) {
  'use strict';
  var DEF = [{ id: 'legendary', name: 'Legendary', topPct: 1, strBonus: 0.15, storeDiscount: 0.15, hungerDecayReduction: 0.15 }, { id: 'rare', name: 'Rare', topPct: 5, strBonus: 0.10, storeDiscount: 0.10, hungerDecayReduction: 0.10 },
    { id: 'uncommon', name: 'Uncommon', topPct: 20, strBonus: 0.05, storeDiscount: 0.05, hungerDecayReduction: 0.05 }, { id: 'common', name: 'Common', topPct: 100, strBonus: 0, storeDiscount: 0, hungerDecayReduction: 0 }];
  var BASE_DECAY = 4, MAX_DECAY_REDUCTION = 0.25; // the server (P2) must apply the same 0..0.25 clamp
  function tiers(cfg) {
    var t = cfg && cfg.RARITY_TIERS;
    var ok = Array.isArray(t) && t.length > 0 && t.every(function (x, i) { return x && typeof x.id === 'string' && Number.isFinite(x.topPct) && x.topPct > 0 && x.topPct <= 100 && (i === 0 || x.topPct > t[i - 1].topPct); }) && t[t.length - 1].topPct === 100;
    return ok ? t : DEF;
  }
  // rank 1 = rarest. Top 1% of the collection = Legendary, next 4% = Rare, next 15% = Uncommon, the rest Common.
  function tierFor(cfg, rank, supply) {
    if (!(rank >= 1) || !(supply >= 1)) return null;
    var pct = Math.min(100, (rank / supply) * 100), list = tiers(cfg);
    for (var i = 0; i < list.length; i++) if (pct <= list[i].topPct) return list[i];
    return list[list.length - 1];
  }
  function clampBonus(x) { return Number.isFinite(x) && x >= 0 && x <= 1 ? x : 0; }
  function clampDecayCut(x) { return Number.isFinite(x) && x > 0 ? Math.min(MAX_DECAY_REDUCTION, x) : 0; }
  function baseDecay(cfg) { var b = cfg && cfg.BASE_HUNGER_DECAY_PER_HOUR; return Number.isFinite(b) && b > 0 && b <= 100 ? b : BASE_DECAY; }
  // perks: all 0 while the flag is off. They stack: strength per feed, Store discount, slower hunger.
  function perks(cfg, tier) {
    if (!cfg || cfg.RARITY_PERKS_ENABLED !== true || !tier) return { strBonus: 0, storeDiscount: 0, hungerDecayReduction: 0 };
    return { strBonus: clampBonus(tier.strBonus), storeDiscount: clampBonus(tier.storeDiscount), hungerDecayReduction: clampDecayCut(tier.hungerDecayReduction) };
  }
  // food lost per hour for a pet of this tier (exactly the base for every pet while the flag is off)
  function hungerDecay(cfg, tier) { var b = baseDecay(cfg), cut = perks(cfg, tier).hungerDecayReduction; return Math.round(b * (1 - cut) * 10000) / 10000; }
  // the perks a tier would get, for the display-only preview (ignores the flag; the app labels it "coming soon")
  function perkPreview(tier) { return tier ? { strBonus: clampBonus(tier.strBonus), storeDiscount: clampBonus(tier.storeDiscount), hungerDecayReduction: clampDecayCut(tier.hungerDecayReduction) } : null; }
  function featStr(cfg, tier, baseStr) { var p = perks(cfg, tier); return p.strBonus ? Math.round(baseStr * (1 + p.strBonus)) : baseStr; }

  // ----- preview rank from trait counts -----
  // counts: { total, t: { hash(type): { hash(name): n } } }; vals: { hash(type): hash(name) } for this pet
  function score(counts, values, types) { var s = 0; types.forEach(function (ty) { var m = counts.t[ty], v = values[ty], n = m && v && m[v]; s += counts.total / (n || 1); }); return s; }
  function rng(seed) { var x = seed >>> 0 || 1; return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  var simCache = {};
  function estimateRank(counts, values, supply, key) {
    var types = Object.keys(values).filter(function (ty) { return counts.t[ty] && counts.t[ty][values[ty]]; });
    if (types.length < 2) return null; // not enough known traits to say anything
    var ck = key + '|' + types.slice().sort().join(','), sims = simCache[ck];
    if (!sims) {
      var r = rng(2026), N = 3000; sims = [];
      var tabs = types.map(function (ty) { var m = counts.t[ty], ks = Object.keys(m), cum = [], acc = 0; ks.forEach(function (k) { acc += m[k]; cum.push(acc); }); return { ty: ty, ks: ks, cum: cum, sum: acc }; });
      for (var i = 0; i < N; i++) { var vals = {}; tabs.forEach(function (tb) { var u = r() * tb.sum, j = 0; while (tb.cum[j] < u) j++; vals[tb.ty] = tb.ks[j]; }); sims.push(score(counts, vals, types)); }
      sims.sort(function (a, b) { return b - a; }); simCache[ck] = sims;
    }
    var mine = score(counts, values, types), higher = 0;
    while (higher < sims.length && sims[higher] >= mine - 1e-9) higher++; // ties count as ahead (a cautious preview)
    var sup = supply || counts.total;
    return { rank: Math.max(1, Math.min(sup, Math.round((higher / sims.length) * sup) + 1)), of: sup, traitsUsed: types.length };
  }
  // pet: { collection, rank?, of?, traits / rawTraits: list of { type, name } trait pairs }
  function preview(cfg, pet, rarityCounts, hash) {
    var coll = ((cfg && cfg.COLLECTIONS) || []).filter(function (c) { return c.name === pet.collection || c.id === pet.collection; })[0] || null;
    var supply = (coll && coll.supply) || pet.of || null;
    if (pet && Number.isInteger(pet.rank) && pet.rank > 0) { var of = pet.of || supply; return { rank: pet.rank, of: of, tier: tierFor(cfg, pet.rank, of), source: 'orbis', preview: true }; }
    var counts = rarityCounts && pet && rarityCounts[pet.collection];
    if (!counts || !hash) return { rank: null, of: supply, tier: null, source: 'none', preview: true };
    var vals = {}; (pet.rawTraits || pet.traits || []).forEach(function (t) { if (t && t.type && t.value != null && !t.hidden && !t.slot) vals[hash(t.type)] = hash(t.value); });
    var est = estimateRank(counts, vals, counts.total, pet.collection);
    if (!est) return { rank: null, of: supply, tier: null, source: 'none', preview: true };
    return { rank: est.rank, of: est.of, tier: tierFor(cfg, est.rank, est.of), source: 'estimate', preview: true };
  }
  var api = { tiers: tiers, tierFor: tierFor, perks: perks, featStr: featStr, hungerDecay: hungerDecay, baseDecay: baseDecay, perkPreview: perkPreview, MAX_DECAY_REDUCTION: MAX_DECAY_REDUCTION, preview: preview, estimateRank: estimateRank };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BLUP3TS_TIERS = api;
})(typeof window !== 'undefined' ? window : null);
