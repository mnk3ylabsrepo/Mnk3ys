/* FACES MOCK v2 (preview only, Nov 2 2026): 6 new watch faces that work like the MNK3YS / ZMB3YS cases.
 * Each one is a watch case (colours on the case edge, band, rim, crown) using the same case-art SVG layer as the
 * originals (motif 'drip': same drip shapes and count, same stretch / pinch-off / drop motion, incl. the goo_mock2
 * extra drips). Only the colours change, set in faces_mock.css. The screen background is not touched.
 * Preview: all 6 are unlocked for every pet. Unlock levels are Azgog's choice.
 * Registered for app.js caseCfg() through window.BLUP3TS_FACES (config.js is untouched). */
(function () {
  'use strict';
  var F = {
    f_blunanaville: { name: 'Blunanaville',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#fff3a0 0,rgba(255,243,160,0) 45%),linear-gradient(150deg,#e8b923,#a8781a 48%,#5a3d12 72%,#c9a227)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(72,216,252,.12) 0 2px,transparent 2px 12px),linear-gradient(#6b4a12,#3a2708)',
      rim: '#48D8FC', accent: '#48D8FC', glow: 'rgba(242,201,76,.45)', crown: 'repeating-linear-gradient(#8af0ff 0 3px,#1E6FD9 3px 6px)' },
    f_glacier: { name: 'Glacier',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#ffffff 0,rgba(255,255,255,0) 45%),linear-gradient(150deg,#cfeeff,#7fb9de 45%,#2f6f9c 72%,#bfe6ff)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(255,255,255,.14) 0 2px,transparent 2px 12px),linear-gradient(#4f86ad,#24506f)',
      rim: '#dff6ff', accent: '#9fdcff', glow: 'rgba(191,234,255,.5)', crown: 'repeating-linear-gradient(#ffffff 0 3px,#8fc6e6 3px 6px)' },
    f_pirate: { name: 'Pirate Cove',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#6fe3d3 0,rgba(111,227,211,0) 45%),linear-gradient(150deg,#1fa395,#0e5f63 48%,#083b40 72%,#1a8a80)',
      bandBg: 'repeating-linear-gradient(90deg,rgba(217,178,107,.16) 0 3px,transparent 3px 10px),linear-gradient(#5c4524,#2e2210)',
      rim: '#d9b26b', accent: '#f5e3b5', glow: 'rgba(31,181,166,.42)', crown: 'repeating-linear-gradient(#f5e3b5 0 3px,#9c7a3c 3px 6px)' },
    f_christmas: { name: 'Christmas Morning',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#ff8a8a 0,rgba(255,138,138,0) 45%),linear-gradient(150deg,#d93636,#8f1d1d 48%,#5a1010 72%,#c42d2d)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(255,255,255,.16) 0 3px,transparent 3px 10px),linear-gradient(#1f6b30,#0f3d1a)',
      rim: '#ffffff', accent: '#2e9e44', glow: 'rgba(255,255,255,.35)', crown: 'repeating-linear-gradient(#ffffff 0 3px,#2e9e44 3px 6px)' },
    f_haunted: { name: 'Haunted Manor',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,#9b7fd1 0,rgba(155,127,209,0) 45%),linear-gradient(150deg,#5a3d94,#2d1b4e 48%,#1a0f2e 72%,#4a2f7a)',
      bandBg: 'repeating-linear-gradient(135deg,rgba(232,220,255,.10) 0 2px,transparent 2px 12px),linear-gradient(#2d1b4e,#140a24)',
      rim: '#c9b3ff', accent: '#f4f0ff', glow: 'rgba(155,127,209,.45)', crown: 'repeating-linear-gradient(#e8dcff 0 3px,#4a2f7a 3px 6px)' },
    f_neon: { name: 'Neon',
      caseBg: 'radial-gradient(120% 80% at 25% 10%,rgba(255,79,216,.35) 0,rgba(255,79,216,0) 45%),linear-gradient(150deg,#2a0a3a,#08030f 48%,#12041c 72%,#2a0a3a)',
      bandBg: 'repeating-linear-gradient(90deg,rgba(72,216,252,.14) 0 1px,transparent 1px 8px),linear-gradient(#14061f,#06020b)',
      rim: '#ff4fd8', accent: '#48D8FC', glow: 'rgba(255,79,216,.6)', crown: 'repeating-linear-gradient(#48D8FC 0 3px,#ff4fd8 3px 6px)' }
  };
  Object.keys(F).forEach(function (k) { F[k].face = true; F[k].collection = null; F[k].motif = 'drip'; F[k].logo = null; });
  window.BLUP3TS_FACES = Object.freeze(F);
})();
