/* Nov 19 (Azgog): network status next to the watch clock. Animated Wi-Fi symbol on Wi-Fi only (no LTE text, Azgog Nov 19).
   Uses navigator.connection.type, which only some browsers share (Chrome on Android). iPhone Safari does not,
   so the indicator stays hidden there instead of guessing. Hidden when offline. */
(function () {
  var el = document.getElementById('netStat'); if (!el) return;
  var WIFI = '<svg viewBox="0 0 24 18" width="20" height="15" aria-hidden="true"><path d="M12 17.5l3.2-3.6a4.6 4.6 0 0 0-6.4 0z" class="w1" fill="currentColor"/><path class="w2" d="M5.6 10.6a9.2 9.2 0 0 1 12.8 0l-1.9 2.1a6.4 6.4 0 0 0-9 0z" fill="currentColor"/><path class="w3" d="M2.3 7a13.8 13.8 0 0 1 19.4 0l-1.9 2.1a11 11 0 0 0-15.6 0z" fill="currentColor"/></svg>';
  function paint() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection, t = c && c.type;
    var kind = navigator.onLine === false ? '' : (t === 'wifi' || t === 'ethernet') ? 'wifi' : '';
    el.className = 'netstat' + (kind ? ' ns-' + kind : '');
    if (kind === 'wifi') { el.innerHTML = WIFI; el.setAttribute('aria-label', 'Wi-Fi'); }
    else el.textContent = '';
    el.hidden = !kind;
  }
  paint();
  var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c && c.addEventListener) c.addEventListener('change', paint);
  window.addEventListener('online', paint); window.addEventListener('offline', paint);
  window.BLUP3TS_NETSTAT = { paint: paint };
})();
