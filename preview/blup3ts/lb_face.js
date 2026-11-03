/* LB REWARDS (preview only, Nov 2 2026): the 3 WINNER-ONLY watch faces for the monthly TOP 3 (Azgog via COS, 1:55 AM AT).
 * Watch cases like the other faces (colours as case variables), plus new goo motifs 'gold' / 'silver' / 'bronze' used ONLY by these 3
 * (app.js draws them on the drip layer with data-goo; MNK3YS blue and ZMB3YS green goo are untouched). Ornaments (bezel gems,
 * crown gem, laurel + crown emblem, ribbon, sparkles) are the .t3orn layer below, styled in lb_rewards.css.
 * Never sold: no price in FACE_PRICES, face_unlocks.js opens one only for the wallet the server lists at that rank.
 * Only added when config.js LB_REWARDS_ENABLED is true. */
(function () {
  'use strict';
  var C = window.BLUP3TS_CONFIG || {};
  if (C.LB_REWARDS_ENABLED !== true) return;
  var F = Object.assign({}, window.BLUP3TS_FACES || {});
  function braid(a, b, c) { return 'repeating-linear-gradient(60deg,' + a + ' 0 5px,' + b + ' 5px 7px,transparent 7px 14px),repeating-linear-gradient(-60deg,' + a + ' 0 5px,' + b + ' 5px 7px,' + c + ' 7px 14px)'; }
  F.f_champion = { name: 'Champion', rank: 1, face: true, winnerOnly: true, collection: null, motif: 'gold', logo: null,
    caseBg: 'radial-gradient(120% 70% at 28% 8%,#fffbe0 0,rgba(255,251,224,0) 40%),linear-gradient(150deg,#ffe27a,#d4a017 30%,#fff1a8 48%,#a87508 70%,#f5c842)',
    bandBg: braid('#5b2a8c', '#d4a017', '#3b1766'), rim: '#fff1a8', accent: '#ffe27a', glow: 'rgba(255,205,60,.75)',
    crown: 'repeating-linear-gradient(#fff1a8 0 3px,#c8901a 3px 6px)' };
  F.f_second = { name: '2nd Place', rank: 2, face: true, winnerOnly: true, collection: null, motif: 'silver', logo: null,
    caseBg: 'radial-gradient(120% 70% at 28% 8%,#ffffff 0,rgba(255,255,255,0) 40%),linear-gradient(150deg,#f4f7fb,#aab4c3 30%,#ffffff 48%,#7c8796 70%,#dfe5ee)',
    bandBg: braid('#1c2f5e', '#c9d1dc', '#0f1d40'), rim: '#ffffff', accent: '#dfe8f5', glow: 'rgba(200,225,255,.65)',
    crown: 'repeating-linear-gradient(#ffffff 0 3px,#8d97a6 3px 6px)' };
  F.f_third = { name: '3rd Place', rank: 3, face: true, winnerOnly: true, collection: null, motif: 'bronze', logo: null,
    caseBg: 'radial-gradient(120% 70% at 28% 8%,#ffe0c2 0,rgba(255,224,194,0) 40%),linear-gradient(150deg,#e8a06a,#a8572a 30%,#f2c29a 48%,#7a3a17 70%,#cd7f45)',
    bandBg: braid('#6b1626', '#c27a45', '#47101b'), rim: '#f3d9a8', accent: '#f3d9a8', glow: 'rgba(230,140,80,.6)',
    crown: 'repeating-linear-gradient(#f2c29a 0 3px,#8a4a22 3px 6px)' };
  window.BLUP3TS_FACES = Object.freeze(F);
  function orn() { // one static ornament layer inside the watch; CSS shows it only for data-goo faces
    var st = document.getElementById('stage'); if (!st || st.querySelector('.t3orn')) return;
    var d = document.createElement('div'); d.className = 't3orn'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div class="t3rib"><span></span></div>' +
      '<svg class="t3em" viewBox="0 0 120 64"><g class="t3lau">' +
      '<path d="M60,58 C38,56 22,44 18,22" fill="none" stroke-width="3"/><path d="M60,58 C82,56 98,44 102,22" fill="none" stroke-width="3"/>' +
      '<ellipse cx="24" cy="26" rx="4" ry="8" transform="rotate(-30 24 26)"/><ellipse cx="30" cy="38" rx="4" ry="8" transform="rotate(-50 30 38)"/><ellipse cx="40" cy="48" rx="4" ry="8" transform="rotate(-70 40 48)"/>' +
      '<ellipse cx="96" cy="26" rx="4" ry="8" transform="rotate(30 96 26)"/><ellipse cx="90" cy="38" rx="4" ry="8" transform="rotate(50 90 38)"/><ellipse cx="80" cy="48" rx="4" ry="8" transform="rotate(70 80 48)"/></g>' +
      '<path class="t3cr" d="M38,46 L34,18 L48,30 L60,10 L72,30 L86,18 L82,46 Z"/><rect class="t3cr" x="38" y="46" width="44" height="6" rx="2"/>' +
      '<circle class="t3gem" cx="60" cy="36" r="4"/><circle class="t3pt" cx="34" cy="18" r="3"/><circle class="t3pt" cx="60" cy="10" r="3"/><circle class="t3pt" cx="86" cy="18" r="3"/></svg>' +
      '<i class="t3sp s1"></i><i class="t3sp s2"></i><i class="t3sp s3"></i><i class="t3sp s4"></i><i class="t3sp s5"></i><i class="t3sp s6"></i>';
    st.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', orn); else orn();
})();
