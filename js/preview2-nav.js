/**
 * Preview 2 — bottom pipe nav + scroll spy (founder mockup).
 */
(function () {
  'use strict';

  if (!document.body.classList.contains('site-preview2')) return;

  var CONFIG = window.MNK3YS_CONFIG || {};
  var shopUrl = (CONFIG.shopUrl || '').trim();
  var nav = document.getElementById('p2-bottom-nav');
  if (!nav) return;

  var shopLink = nav.querySelector('.p2-bottom-nav__link--shop');
  var shopSep = nav.querySelector('.p2-bottom-nav__sep--shop');
  if (shopLink && shopUrl) {
    shopLink.href = shopUrl;
    shopLink.style.display = '';
    if (shopSep) shopSep.style.display = '';
  }

  var tokenSymbol = (CONFIG.token && CONFIG.token.symbol) || 'BLUNANA';
  nav.querySelectorAll('[data-config="token-symbol"]').forEach(function (el) {
    el.textContent = '$' + tokenSymbol;
  });

  var SECTION_IDS = [
    'home',
    'about',
    'collections',
    'blunana',
    'games',
    'utilities',
    'x-spaces',
    'team',
    'partners',
  ];

  var links = nav.querySelectorAll('.p2-bottom-nav__link[data-section]');
  var sections = SECTION_IDS.map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  function setActive(sectionId) {
    links.forEach(function (link) {
      var sid = link.getAttribute('data-section');
      var isChart = link.getAttribute('href') === '#blunana-chart';
      var active = !isChart && sid === sectionId;
      link.classList.toggle('p2-bottom-nav__link--active', active);
    });
  }

  function sectionInView() {
    var mid = window.innerHeight * 0.35;
    var current = 'home';
    sections.forEach(function (sec) {
      if (!sec) return;
      var rect = sec.getBoundingClientRect();
      if (rect.top <= mid && rect.bottom > mid) current = sec.id;
    });
    setActive(current);
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href') || '';
      if (href.startsWith('#') && href.length > 1) {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  window.addEventListener('scroll', sectionInView, { passive: true });
  sectionInView();
})();
