/* Discord account on the home screen: name, picture, linked wallets, unlink. */
(function () {
  'use strict';
  var LOGIN = (window.BLUP3TS_CONFIG && BLUP3TS_CONFIG.LEADERBOARD_DISCORD_LOGIN_URL) || '/api/discord/auth?next=/preview/blup3ts/';
  var user = null, wallets = [], sure = '';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }
  function toast(t) { var H = window.BLUP3TS_HOME; if (H && H.toast) H.toast(t); }
  function nameOf(u) { return (u && (u.global_name || u.username)) || 'Discord'; }
  function short(w) { w = String(w || ''); return w.length > 12 ? w.slice(0, 4) + '…' + w.slice(-4) : w; }
  function avatar(u) {
    if (!u || !u.id) return '';
    if (u.avatar) {
      var ext = String(u.avatar).indexOf('a_') === 0 ? 'gif' : 'png';
      return 'https://cdn.discordapp.com/avatars/' + encodeURIComponent(u.id) + '/' + encodeURIComponent(u.avatar) + '.' + ext;
    }
    var n = 0;
    if (u.discriminator && u.discriminator !== '0') n = (parseInt(u.discriminator, 10) || 0) % 5;
    return 'https://cdn.discordapp.com/embed/avatars/' + n + '.png';
  }
  function json(url, opt) {
    opt = opt || {};
    opt.credentials = 'same-origin';
    opt.headers = opt.headers || { Accept: 'application/json' };
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || 'Request failed');
        return j;
      });
    });
  }
  function connectedWallet() {
    var W = window.BLUP3TS_WALLET;
    var s = W && W.state && W.state();
    return s && s.pubkey ? String(s.pubkey) : '';
  }
  function linked(addr) {
    var a = String(addr || '').toLowerCase();
    return wallets.some(function (w) { return String(w).toLowerCase() === a; });
  }
  function paint() {
    var btn = $('discordBtn'), img = $('discordPfp'), label = $('discordName');
    if (!btn || !label) return;
    if (!user) {
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      label.textContent = 'Sign in with Discord';
      btn.setAttribute('aria-label', 'Sign in with Discord');
      return;
    }
    var name = nameOf(user);
    if (img) { img.hidden = false; img.src = avatar(user); img.alt = ''; }
    label.textContent = name;
    btn.setAttribute('aria-label', 'Discord account, ' + name);
  }
  function account() {
    var H = window.BLUP3TS_HOME;
    if (!H || !H.openSheet || !user) return;
    var head = el('div', 'dhead');
    var pic = el('img'); pic.src = avatar(user); pic.alt = ''; pic.width = 56; pic.height = 56;
    var who = el('div');
    who.appendChild(el('b', null, nameOf(user)));
    if (user.username) who.appendChild(el('small', null, '@' + user.username));
    head.appendChild(pic); head.appendChild(who);
    var nodes = [head, el('p', null, 'Wallets linked to this Discord. Ranks use one row for all of them.')];
    if (!wallets.length) nodes.push(el('p', 'ranknote', 'No wallets linked yet.'));
    wallets.forEach(function (w) {
      var row = el('div', 'dwallet');
      var b = el('b', null, short(w)); b.title = w;
      var u = el('button', null, sure === w ? 'Unlink?' : 'Unlink'); u.type = 'button';
      u.addEventListener('click', function () {
        if (sure !== w) { sure = w; account(); return; }
        u.disabled = true; u.textContent = 'Unlinking…';
        json('/api/wallets-unlink', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ wallet: w }) })
          .then(function () {
            sure = '';
            wallets = wallets.filter(function (x) { return String(x).toLowerCase() !== String(w).toLowerCase(); });
            toast('Unlinked ' + short(w));
            account();
          })
          .catch(function () { sure = ''; toast('Could not unlink that wallet'); account(); });
      });
      row.appendChild(b); row.appendChild(u); nodes.push(row);
    });
    var pk = connectedWallet();
    if (pk && !linked(pk)) {
      var link = el('button', 'sbtn primary', 'Link ' + short(pk)); link.type = 'button';
      link.addEventListener('click', function () {
        link.disabled = true; link.textContent = 'Linking…';
        json('/api/wallets/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ wallet: pk }) })
          .then(function () { if (!linked(pk)) wallets.push(pk); sure = ''; toast('Wallet linked'); return loadWallets(); })
          .then(function () { account(); })
          .catch(function () { toast('Could not link that wallet'); account(); });
      });
      nodes.push(link);
    }
    var out = el('button', 'sbtn', 'Sign out'); out.type = 'button';
    out.addEventListener('click', function () {
      out.disabled = true;
      json('/api/discord/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
        .catch(function () {})
        .then(function () { user = null; wallets = []; sure = ''; paint(); if (H.closeSheet) H.closeSheet(); toast('Signed out of Discord'); });
    });
    nodes.push(out);
    H.openSheet('Discord', nodes);
  }
  function loadWallets() {
    if (!user) { wallets = []; return Promise.resolve(); }
    return json('/api/wallets').then(function (j) {
      wallets = Array.isArray(j.wallets) ? j.wallets.map(String) : [];
    }).catch(function () { wallets = []; });
  }
  function boot() {
    var q = new URLSearchParams(location.search);
    if (q.has('discord')) {
      if (q.get('discord') === 'error') toast('Discord sign-in did not finish. Try again.');
      q.delete('discord');
      var next = q.toString();
      history.replaceState(null, '', location.pathname + (next ? '?' + next : '') + location.hash);
    }
    var btn = $('discordBtn');
    if (btn) btn.addEventListener('click', function () {
      if (window.BLUP3TS_APP && BLUP3TS_APP.play) BLUP3TS_APP.play('tap');
      if (!user) { location.href = LOGIN; return; }
      loadWallets().then(account);
    });
    json('/api/discord/me').then(function (j) {
      user = j && j.connected && j.user ? j.user : null;
      paint();
      return loadWallets();
    }).catch(function () { user = null; paint(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.BLUP3TS_DISCORD = { open: function () { if (user) loadWallets().then(account); }, user: function () { return user; } };
})();
