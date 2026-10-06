(function () {
  'use strict';

  function init() {
    var app = document.querySelector('[data-nv]');
    if (!app) return;
    var openBtn = document.querySelector('[data-nv-open]');
    function setOpen(open) {
      app.classList.toggle('is-open', open);
      if (openBtn) openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (openBtn) openBtn.addEventListener('click', function () { setOpen(true); });
    var closers = document.querySelectorAll('[data-nv-close]');
    for (var i = 0; i < closers.length; i++) closers[i].addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
