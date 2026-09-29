/**
 * Preview 2: top nav (active link + mobile menu), page reveal, copy-to-clipboard pills.
 */
(function () {
  'use strict';

  var nav = document.getElementById('p2-nav');
  var toggle = document.getElementById('p2-nav-toggle');
  var links = Array.prototype.slice.call(document.querySelectorAll('.p2-nav__links a'));
  var pages = Array.prototype.slice.call(document.querySelectorAll('.p2-page'));
  var toast = document.getElementById('p2-toast');
  var toastTimer;

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });

  links.forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });

  function setActive(id) {
    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-section') === id);
    });
  }

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.25 });

    var activeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });

    pages.forEach(function (page) {
      revealObserver.observe(page);
      activeObserver.observe(page);
    });
  } else {
    pages.forEach(function (page) { page.classList.add('is-visible'); });
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 1800);
  }

  var statEls = Array.prototype.slice.call(document.querySelectorAll('[data-stat]'));
  if (statEls.length && window.fetch) {
    fetch('/api/collection-stats')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        statEls.forEach(function (el) {
          var path = el.getAttribute('data-stat').split('.');
          var value = data[path[0]] && data[path[0]][path[1]];
          if (typeof value === 'number') el.textContent = value.toLocaleString('en-US');
        });
      })
      .catch(function () {});
  }

  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      var value = copyBtn.getAttribute('data-copy');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(value).then(function () { showToast('CA copied'); });
      } else {
        showToast(value);
      }
      return;
    }
    if (e.target.closest('[data-todo]')) {
      e.preventDefault();
      showToast('Coming soon');
    }
  });
})();
