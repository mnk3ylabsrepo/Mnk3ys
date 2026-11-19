(function () {
  var list = document.getElementById('pk-list');
  var statusEl = document.getElementById('pk-status');
  var tabs = Array.prototype.slice.call(
    document.querySelectorAll('.pk-tab, .p2-poker__tab')
  );
  if (!list || !statusEl) return;

  var activeTab = 'registering';
  var tournaments = [];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatWhen(iso) {
    if (!iso) return 'Time TBA';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 'Time TBA';
    try {
      return d.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch (_) {
      return d.toISOString();
    }
  }

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
    statusEl.hidden = !text;
  }

  function filtered() {
    return tournaments.filter(function (t) { return t.tab === activeTab; });
  }

  function render() {
    var rows = filtered();
    list.hidden = false;
    list.scrollTop = 0;
    if (!rows.length) {
      list.innerHTML = '<p class="pk-empty">No ' + esc(activeTab) + ' tournaments right now.</p>';
      return;
    }
    list.innerHTML = rows.map(function (t) {
      var seats = (t.registeredCount != null ? t.registeredCount : '—')
        + (t.maxPlayers != null ? ' / ' + t.maxPlayers : '');
      var prize = t.prizeBlurb
        ? '<p class="pk-card__prize">' + esc(t.prizeBlurb) + '</p>'
        : '';
      var desc = t.description
        ? '<p class="pk-card__desc">' + esc(t.description) + '</p>'
        : '';
      return (
        '<a class="pk-card" href="' + esc(t.url) + '" target="_blank" rel="noopener">'
        + '<div class="pk-card__top">'
        + '<h3 class="pk-card__name">' + esc(t.name) + '</h3>'
        + '</div>'
        + '<p class="pk-card__meta">' + esc(formatWhen(t.startTime)) + ' · ' + esc(seats) + ' seated</p>'
        + prize
        + desc
        + '<span class="pk-card__cta">Open on BUX Poker →</span>'
        + '</a>'
      );
    }).join('');
  }

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeTab = btn.getAttribute('data-tab') || 'registering';
      tabs.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      render();
    });
  });

  fetch('/api/poker-tournaments', { headers: { accept: 'application/json' }, cache: 'no-store' })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.j || !res.j.ok) throw new Error((res.j && res.j.message) || 'Load failed');
      tournaments = Array.isArray(res.j.tournaments) ? res.j.tournaments : [];
      setStatus(tournaments.length ? '' : 'No MNK3YS tournaments found yet.');
      render();
    })
    .catch(function (err) {
      setStatus(err.message || 'Could not load tournaments', true);
      list.hidden = false;
      list.innerHTML = '<p class="pk-empty">Try again in a minute.</p>';
    });
})();
