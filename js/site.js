(function () {
  'use strict';

  var root = document.documentElement;

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function initTheme() {
    var button = document.querySelector('[data-theme-toggle]');
    var label = document.querySelector('[data-theme-label]');
    if (!button) return;
    function sync() {
      // The label names the mode you switch to.
      if (label) label.textContent = currentTheme() === 'dark' ? 'Light' : 'Dark';
    }
    button.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      sync();
    });
    sync();
  }

  function initNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return;
    function close() {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;
    function onScroll() {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Markdown output: scrollable tables, captions from alt text, safe external links.
  function initProse() {
    var prose = document.querySelectorAll('.prose');
    for (var i = 0; i < prose.length; i++) {
      var tables = prose[i].querySelectorAll(':scope > table');
      for (var t = 0; t < tables.length; t++) {
        var wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        tables[t].parentNode.insertBefore(wrap, tables[t]);
        wrap.appendChild(tables[t]);
      }
      var imgs = prose[i].querySelectorAll('p > img:only-child');
      for (var k = 0; k < imgs.length; k++) {
        var img = imgs[k];
        img.loading = 'lazy';
        img.decoding = 'async';
        var alt = img.getAttribute('alt');
        if (!alt || img.parentNode.childNodes.length !== 1) continue;
        var fig = document.createElement('figure');
        var cap = document.createElement('figcaption');
        cap.textContent = alt;
        img.parentNode.parentNode.replaceChild(fig, img.parentNode);
        fig.appendChild(img);
        fig.appendChild(cap);
      }
    }
    var links = document.querySelectorAll('a[href^="http"]');
    for (var j = 0; j < links.length; j++) {
      if (links[j].hostname && links[j].hostname !== window.location.hostname) {
        links[j].setAttribute('target', '_blank');
        links[j].setAttribute('rel', 'noopener noreferrer');
      }
    }
  }

  function initToc() {
    var toc = document.querySelector('.toc');
    if (!toc || !('IntersectionObserver' in window)) return;
    var links = toc.querySelectorAll('a[href^="#"]');
    var map = {};
    var heads = [];
    for (var i = 0; i < links.length; i++) {
      var id = decodeURIComponent(links[i].getAttribute('href').slice(1));
      var el = document.getElementById(id);
      if (el) {
        map[id] = links[i];
        heads.push(el);
      }
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        for (var key in map) map[key].classList.remove('is-active');
        map[entry.target.id].classList.add('is-active');
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    heads.forEach(function (h) { observer.observe(h); });
  }

  function init() {
    initTheme();
    initNav();
    initHeader();
    initProse();
    initToc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
