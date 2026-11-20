/* Duo opening (Watch -> Duo) for BLUP3TS (Nov 10, ported from the approved v2 Duo opening (flat slide + even grow, 240ms fade, tap skips, reduced motion = short fade).
   No extra sizing: the Duo device and NFT keep the live sizes and positions. */
(function () {
  'use strict';
  var A = window.BLUP3TS_APP; if (!A || !A.setLayout) return;
  var $ = function (id) { return document.getElementById(id); };
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var cur = null;

  // NFT sizing (Nov 10): the live sizes win. The demo's Horizontal 'credit shrink' (139 -> 115 px NFT at 844x390) is removed.
  // Nov 10: no extra sizing hooks. The app's own fit() runs exactly when it does on the live site, so the Duo size and the
  // NFT position match live on every phone (the demo's extra refits after a layout change and on top-bar resizes are removed).

  function play() {
    var gv = $('gameView'), wrap = $('stagewrap'), st = $('stage'); if (!gv || !wrap || !st || !gv.classList.contains('full')) return;
    if (cur) cur.finish();
    var side = gv.classList.contains('fold-h'), reduce = RM && RM.matches, manual = !!window.LDO_MANUAL;
    var OPEN = 1900, T = reduce ? 500 : 2950, EASE = 'cubic-bezier(.45,0,.2,1)', SOFT = 'cubic-bezier(.22,1,.36,1)';
    var wr = wrap.getBoundingClientRect(), hg = st.querySelector('.foldhinge'), hr = hg ? hg.getBoundingClientRect() : null;
    var scr = $('screen'), sc = scr.getBoundingClientRect();
    var ov = document.createElement('div'); ov.className = 'ldo-open ' + (side ? 'ldo-h' : 'ldo-v'); ov.setAttribute('aria-hidden', 'true');
    var W = wr.width, H = wr.height, hx = hr ? hr.left + hr.width / 2 - wr.left : W / 2, hy = hr ? hr.top + hr.height / 2 - wr.top : H / 2;
    var hh = hr ? (side ? hr.width : hr.height) / 2 + 20 : 24; // half the hinge plus its shadow
    var sp = document.createElement('div'); sp.className = 'ldo-splash';
    sp.style.left = (sc.left - wr.left) + 'px'; sp.style.top = (sc.top - wr.top) + 'px'; sp.style.width = sc.width + 'px'; sp.style.height = sc.height + 'px';
    sp.style.borderRadius = getComputedStyle(scr).borderRadius;
    var hl0 = $('heroLogo'), lsrc = (hl0 && hl0.getAttribute('src')) || 'assets/mnk3ylabs_logo.png'; // same logo the page header uses
    var lg = document.createElement('img'); lg.className = 'ldo-logo' + (/mnk3ylabs_logo/.test(lsrc) ? ' ldo-white' : ''); lg.src = lsrc; lg.alt = '';
    var wm = document.createElement('img'); wm.className = 'ldo-wm'; wm.src = 'assets/blup3ts_wordmark.png'; wm.alt = ''; // the supplied BLUP3TS wordmark (white BLU, cyan P3TS), never redrawn
    sp.appendChild(lg); sp.appendChild(wm); ov.appendChild(sp);
    function cloneStage() { var c = st.cloneNode(true); c.removeAttribute('id'); c.classList.add('ldo-clone'); [].forEach.call(c.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); }); [].forEach.call(c.querySelectorAll('.ldo-open'), function (n) { n.remove(); }); return c; }
    var lid = null, anims = [], clips = [], wmk = $('gameWm');
    if (!reduce) {
      lid = document.createElement('div'); lid.className = 'ldo-lid';
      lid.style.left = '0'; lid.style.top = '0'; lid.style.width = (side ? hx : W) + 'px'; lid.style.height = (side ? H : hy) + 'px';
      var face = document.createElement('div'); face.className = 'ldo-face'; face.appendChild(cloneStage()); face.appendChild(sp.cloneNode(true));
      if (hg) { var hl = document.createElement('div'); hl.className = 'ldo-clone ldo-hingel'; hl.style.width = st.offsetWidth + 'px'; hl.style.height = st.offsetHeight + 'px'; hl.style.transform = st.style.transform; hl.appendChild(hg.cloneNode(true)); face.appendChild(hl); } // gap fix 1: hinge line on top of the moving edge
      // the clip reaches past the hinge centre so the whole hinge line shows on the moving edge
      face.style.clipPath = side ? 'inset(-60px ' + (-hh) + 'px -60px -60px)' : 'inset(-60px -60px ' + (-hh) + 'px -60px)';
      lid.appendChild(face); ov.appendChild(lid);
      clips = [[st, side ? 'inset(0 0 0 ' + (hx / W * 100) + '%)' : 'inset(' + (hy / H * 100) + '% 0 0 0)'],
               [sp, side ? 'inset(0 0 0 ' + Math.max(0, hx - (sc.left - wr.left)) + 'px)' : 'inset(' + Math.max(0, hy - (sc.top - wr.top)) + 'px 0 0 0)']];
      clips.forEach(function (c) { c[0].style.clipPath = c[1]; });
      st.classList.add('ldo-hidehinge'); // the real hinge would be cut in half by the clip; the moving copy shows it whole
    }
    var lgl = document.createElement('div'); lgl.className = 'ldo-splash'; lgl.style.cssText = sp.style.cssText; lgl.style.background = 'transparent'; lgl.style.zIndex = '5'; lgl.style.clipPath = '';
    lgl.appendChild(lg); lgl.appendChild(wm); ov.appendChild(lgl);
    if (lid) [].forEach.call(lid.querySelectorAll('.ldo-splash img'), function (n) { n.remove(); });
    wrap.appendChild(ov);
    if (!reduce) {
      var dist = side ? (W - hx) * 0.7 : (H - hy) * 0.7;
      anims.push(lid.animate([{ transform: (side ? 'translateX(' : 'translateY(') + dist + 'px)' }, { transform: 'translate(0,0)' }], { duration: OPEN, easing: EASE, fill: 'both' }));
      wrap.style.transformOrigin = hx + 'px ' + hy + 'px';
      anims.push(wrap.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], { duration: OPEN, easing: EASE, fill: 'both' }));
    }
    if (wmk) anims.push(wmk.animate([{ opacity: 0 }, { opacity: 0, offset: (T - 500) / T }, { opacity: 1 }], { duration: T, easing: 'linear', fill: 'both' })); // credit hidden while the phone opens, fades in at its final spot
    [sp, lgl].concat(lid ? [lid.querySelector('.ldo-splash')] : []).forEach(function (s) {
      [].forEach.call(s.querySelectorAll('img'), function (n, k) { anims.push(n.animate([{ opacity: 0, transform: 'scale(.82)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 600, delay: (reduce ? 0 : 1250) + k * 80, easing: SOFT, fill: 'both' })); });
      anims.push(s.animate([{ opacity: 1 }, { opacity: 1, offset: (T - 500) / T }, { opacity: 0 }], { duration: T, easing: 'linear', fill: 'both' }));
    });
    var done = false, unclipped = false;
    function unclip() { if (unclipped) return; unclipped = true; clips.forEach(function (c) { c[0].style.clipPath = ''; }); st.classList.remove('ldo-hidehinge'); if (lid) { var fa = lid.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'both' }); anims.push(fa); if (manual) { fa.pause(); lid.__fa = fa; } } }
    function finish() { if (done) return; done = true; anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); unclip(); wrap.style.transformOrigin = ''; ov.remove(); cur = null; }
    function seek(t) { if (t >= OPEN + 16) unclip(); anims.forEach(function (a) { a.pause(); a.currentTime = (lid && a === lid.__fa) ? Math.max(0, t - OPEN - 16) : t; }); if (t >= T) finish(); }
    ov.addEventListener('pointerdown', finish); // tap skips
    if (!manual) { setTimeout(unclip, OPEN + 16); setTimeout(finish, T + 30); }
    else anims.forEach(function (a) { a.pause(); a.currentTime = 0; });
    cur = { finish: finish, seek: seek, T: T };
    return cur;
  }
  var set0 = A.setLayout;
  A.setLayout = function (l) { var from = A.layout(); var r = set0.apply(this, arguments); if (from === 'watch' && A.layout() === 'phone') { window.scrollTo(0, 0); play(); } return r; };
  A.duoOpen = play; A.duoOpenCurrent = function () { return cur; };
})();
