// Full screen (Azgog, Oct 29 12:15 AM): top-bar button + 'Start in full screen' setting (blup3ts.web.fullscreen, off by default).
// Uses the browser Fullscreen API on the whole page, so layout, Watch / Duo and the fold setting never change.
// Where pages can't go full screen (some phone browsers), the button shows an 'Add to Home Screen' tip instead;
// the home-screen app (manifest.webmanifest) always opens full screen with no browser bars.
(function () {
  'use strict';
  var KEY = 'blup3ts.web.fullscreen', A = window.BLUP3TS_APP || {}, doc = document, root = doc.documentElement;
  function $(id) { return doc.getElementById(id); }
  var canFS = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && !!(root.requestFullscreen || root.webkitRequestFullscreen);
  function installed() {
    try { if (window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) {}
    return window.navigator.standalone === true;
  }
  function isFS() { return !!(doc.fullscreenElement || doc.webkitFullscreenElement); }
  function pref() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function setPref(on) { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {} }
  function enter() {
    if (!canFS || isFS() || installed()) return;
    try { var p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function exit() {
    if (!isFS()) return;
    try { var p = doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function tip() {
    var H = window.BLUP3TS_HOME; if (!H || !H.openSheet) return;
    function p(t) { var e = doc.createElement('p'); e.textContent = t; return e; }
    H.openSheet('Play full screen', [p('This browser can\u2019t make a web page full screen.'),
      p('Tip: open the Share menu (the square with an arrow) and pick \u201cAdd to Home Screen\u201d.'),
      p('Then open BLUP3TS from your home screen: it plays full screen, with no browser bars.')]);
  }
  function render() {
    var b = $('fsBtn'); if (!b) return;
    var on = isFS(); b.hidden = installed();
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Exit full screen' : (canFS ? 'Full screen' : 'Full screen: how to'));
    b.title = on ? 'Exit full screen' : 'Full screen';
  }
  function tap() {
    if (A.play) A.play('tap');
    if (!canFS) { tip(); return; }
    if (isFS()) exit(); else enter();
  }
  // Exiting (Esc, back gesture, the button) or turning the phone: just re-measure the stage. Nothing else changes.
  function changed() { render(); if (A.fit) { A.fit(); setTimeout(function () { A.fit(); }, 250); } }
  doc.addEventListener('fullscreenchange', changed); doc.addEventListener('webkitfullscreenchange', changed);
  window.addEventListener('orientationchange', function () { setTimeout(changed, 300); });
  if ($('fsBtn')) $('fsBtn').onclick = tap;
  // 'Start in full screen': browsers only allow full screen after a tap, so try once on the player's first tap of this visit.
  var armed = false;
  function firstTap(e) {
    if (e.type === 'keydown' && (e.key === 'Escape' || e.key === 'Tab' || e.key === 'Shift')) return;
    disarm(); if (pref() && !(e.target && e.target.closest && e.target.closest('#fsBtn, #fsToggle'))) enter();
  }
  function arm() { if (armed || !canFS || installed() || isFS()) return; armed = true; ['pointerup', 'keydown'].forEach(function (t) { doc.addEventListener(t, firstTap, true); }); }
  function disarm() { if (!armed) return; armed = false; ['pointerup', 'keydown'].forEach(function (t) { doc.removeEventListener(t, firstTap, true); }); }
  if (pref()) arm();
  // Settings switch (added to the Settings sheet by home.js)
  function settingNodes() {
    var on = pref(), b = doc.createElement('button');
    b.id = 'fsToggle'; b.className = 'sbtn fstoggle'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', on ? 'true' : 'false');
    var lab = doc.createElement('span'); lab.textContent = 'Start in full screen';
    var kn = doc.createElement('span'); kn.className = 'fsknob'; kn.setAttribute('aria-hidden', 'true');
    b.appendChild(lab); b.appendChild(kn);
    b.onclick = function () {
      var nv = b.getAttribute('aria-checked') !== 'true'; setPref(nv); b.setAttribute('aria-checked', nv ? 'true' : 'false'); if (A.play) A.play('tap');
      if (nv) { arm(); enter(); } else disarm(); // turning it on is a tap, so go full screen now too
    };
    var note = doc.createElement('p'); note.className = 'muted';
    note.textContent = installed() ? 'You opened BLUP3TS from your home screen, so it is already full screen.'
      : canFS ? 'Goes full screen on your first tap each visit. Saved on this device only.'
      : 'This browser can\u2019t do it for web pages: use \u201cAdd to Home Screen\u201d from the Share menu to play full screen.';
    return [b, note];
  }
  render();
  window.BLUP3TS_FS = { settingNodes: settingNodes, isFS: isFS, canFS: function () { return canFS; }, installed: installed, pref: pref, enter: enter, exit: exit, render: render };
})();
