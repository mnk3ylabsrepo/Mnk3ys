/* Live feed notices: who fed which pet, and for how much. */
(function () {
  'use strict';
  var since = 0, primed = false, box = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }
  function host() {
    if (box && box.isConnected) return box;
    box = document.getElementById('liveNotes');
    return box;
  }
  function amt(n) {
    var x = Math.round(Number(n) || 0);
    try { return x.toLocaleString('en-US'); } catch (e) { return String(x); }
  }
  function show(feed) {
    var root = host(); if (!root || !feed) return;
    while (root.children.length >= 3) root.removeChild(root.firstChild);
    var card = el('div', 'livenote');
    card.appendChild(el('b', null, feed.who || 'Player'));
    card.appendChild(el('span', null, 'Fed ' + (feed.pet || 'a pet') + ' · ' + (feed.tier || 'Feed') + ' · ' + amt(feed.amount) + ' ' + (feed.token || '')));
    root.appendChild(card);
    setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 7000);
  }
  function poll() {
    if (document.hidden) return;
    var url = '/api/blup3ts-feeds' + (primed ? '?after=' + since : '');
    fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || j.ok !== true) return;
        if (!primed) { since = Number(j.latest) || 0; primed = true; return; }
        (j.feeds || []).forEach(show);
        if (j.latest) since = Number(j.latest) || since;
      })
      .catch(function () {});
  }
  function boot() {
    poll();
    setInterval(poll, 6000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
