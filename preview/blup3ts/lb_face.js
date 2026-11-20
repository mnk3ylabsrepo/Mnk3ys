/* LB REWARDS (preview only, Nov 6 2026): the 3 WINNER-ONLY watch faces for the monthly TOP 3.
 * Watch cases like the other faces (colours as case variables), plus goo motifs 'gold' / 'silver' / 'bronze'
 * (app.js draws them on the drip layer with data-goo; MNK3YS blue and ZMB3YS green goo are untouched).
 * Painted prize art lives at assets/faces/prize/{champion,second,third}.png and replaces the old CSS
 * ribbon / laurel / sparkle ornament placeholders (.t3orn now hosts that art).
 * Never sold: no price in FACE_PRICES, face_unlocks.js opens one only for the wallet the server lists at that rank.
 * Only added when config.js LB_REWARDS_ENABLED is true. */
(function () {
  'use strict';
  var C = window.BLUP3TS_CONFIG || {};
  if (C.LB_REWARDS_ENABLED !== true) return;
  var F = Object.assign({}, window.BLUP3TS_FACES || {});
  function braid(a, b, c) { return 'repeating-linear-gradient(60deg,' + a + ' 0 5px,' + b + ' 5px 7px,transparent 7px 14px),repeating-linear-gradient(-60deg,' + a + ' 0 5px,' + b + ' 5px 7px,' + c + ' 7px 14px)'; }
  F.f_champion = { name: 'Champion', rank: 1, face: true, winnerOnly: true, collection: null, motif: 'gold', logo: null,
    art: 'assets/faces/prize/champion.png',
    caseBg: 'radial-gradient(120% 70% at 28% 8%,#fffbe0 0,rgba(255,251,224,0) 40%),linear-gradient(150deg,#ffe27a,#d4a017 30%,#fff1a8 48%,#a87508 70%,#f5c842)',
    bandBg: braid('#5b2a8c', '#d4a017', '#3b1766'), rim: '#fff1a8', accent: '#ffe27a', glow: 'rgba(255,205,60,.75)',
    crown: 'repeating-linear-gradient(#fff1a8 0 3px,#c8901a 3px 6px)' };
  F.f_second = { name: '2nd Place', rank: 2, face: true, winnerOnly: true, collection: null, motif: 'silver', logo: null,
    art: 'assets/faces/prize/second.png',
    caseBg: 'radial-gradient(120% 70% at 28% 8%,#ffffff 0,rgba(255,255,255,0) 40%),linear-gradient(150deg,#f4f7fb,#aab4c3 30%,#ffffff 48%,#7c8796 70%,#dfe5ee)',
    bandBg: braid('#1c2f5e', '#c9d1dc', '#0f1d40'), rim: '#ffffff', accent: '#dfe8f5', glow: 'rgba(200,225,255,.65)',
    crown: 'repeating-linear-gradient(#ffffff 0 3px,#8d97a6 3px 6px)' };
  F.f_third = { name: '3rd Place', rank: 3, face: true, winnerOnly: true, collection: null, motif: 'bronze', logo: null,
    art: 'assets/faces/prize/third.png',
    caseBg: 'radial-gradient(120% 70% at 28% 8%,#ffe0c2 0,rgba(255,224,194,0) 40%),linear-gradient(150deg,#e8a06a,#a8572a 30%,#f2c29a 48%,#7a3a17 70%,#cd7f45)',
    bandBg: braid('#6b1626', '#c27a45', '#47101b'), rim: '#f3d9a8', accent: '#f3d9a8', glow: 'rgba(230,140,80,.6)',
    crown: 'repeating-linear-gradient(#f2c29a 0 3px,#8a4a22 3px 6px)' };
  window.BLUP3TS_FACES = Object.freeze(F);
  function orn() { // painted prize art layer (replaces CSS ribbon/laurel/sparkle placeholders)
    var st = document.getElementById('stage'); if (!st || st.querySelector('.t3orn')) return;
    var d = document.createElement('div'); d.className = 't3orn'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<img class="t3art" alt="" draggable="false" />';
    st.appendChild(d);
    function sync() {
      var id = st.dataset.case, c = (window.BLUP3TS_FACES || {})[id], img = d.querySelector('.t3art');
      if (!img) return;
      if (c && typeof c.art === 'string' && /^assets\/faces\/prize\/[\w.-]+\.png$/.test(c.art)) {
        if (img.getAttribute('src') !== c.art) img.src = c.art;
        img.hidden = false;
      } else {
        img.removeAttribute('src'); img.hidden = true;
      }
    }
    sync();
    try {
      var mo = new MutationObserver(sync);
      mo.observe(st, { attributes: true, attributeFilter: ['data-case'] });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', orn); else orn();
})();
