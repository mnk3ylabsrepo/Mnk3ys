// Family-friendly trait filter: a port of Shared/Core/TraitFilter.swift.
// The blocked values and words are stored as FNV-1a hashes so the page source stays family friendly.
// Weapon / mouth items become a free music look (bass first); other flagged traits are hidden.
(function () {
  'use strict';
  var F = {"byType":{"background":["1d79a5ff","24bfc91c","3654fe56","62e62d19","63820129","81d9f03b","83eba3ff","8bd0f7ee","93091b","a4b2a956","c7e121f6","dc06353f"],"weapon":["1010e65b","11816832","14fe6fc","24ab117c","34c2652d","3ecf15a4","587faf8f","5ad0460f","66a907eb","66f463ef","70b773a8","82af2480","92e7818d","9b99dcaf","9c1a4eac","9ee23eb4","bab76b9a","ce57c44b","cfe0b415","d042d073","dd90e4b5","de8b3dc7","dfe9986d","dfec7ca8","ee0222a7","f1899ea1"],"mouth":["29aafcd5","2dc5e7b4","48ff8550","50a77a47","6da5162f","754559e8","775c7ff5","7a9c0fa0","7ae12203","8ae7d181","c32c359b","ca16e17b","ccdfc38a","d0b63c67","d0d66fbb","f33cdf55","f81d19f9"],"accessory":["75ab1dca","7d64a868"],"top":["47beaae2","c85cbd6e","de03c0c2"],"clothes":["66b6517f","9db1e62","a1709654","a665b693","a9f077af","d235bd19","dc855320"]},"anywhere":["452542dc"],"words":["12019e56","1964b107","19be1ef3","1dff24ba","23cb8952","27535296","3e352725","44529f95","50a77a47","57a30e15","60063106","614b509a","6d04951e","7183f6da","8ae7d181","91b887d3","a25b6c77","aeae0877","bb9a971","c6c67ec0","c7e121f6","ca6adec3","ced1d9fb","d988d8fd","dd90e4b5","df6d3d5","e987f898","ee0222a7"],"allowed":["9751d4bd"]};
  function h(s) { var x = 0x811c9dc5, b = new TextEncoder().encode(String(s).trim().toLowerCase()); for (var i = 0; i < b.length; i++) { x ^= b[i]; x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16); }
  function has(list, s) { return list.indexOf(h(s)) >= 0; }
  function blocked(type, value) {
    var t = String(type).trim().toLowerCase(), v = String(value).trim().toLowerCase();
    if (has(F.anywhere, v)) return true;
    if (F.byType[t] && has(F.byType[t], v)) return true;
    if (has(F.allowed, v)) return false;
    var w = v.split(/[^0-9a-z]+/);
    for (var i = 0; i < w.length; i++) if (w[i] && has(F.words, w[i])) return true;
    return false;
  }
  function slot(type) { var t = String(type).trim().toLowerCase(); return (t === 'weapon' || t === 'front weapon') ? 'hand' : t === 'mouth' ? 'mouth' : null; }
  window.BLUP3TS_FILTER = { blocked: blocked, slot: slot, hash: h };
})();
