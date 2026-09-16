(function () {
  'use strict';

  function createThemeToggle() {
    var header = document.querySelector('.l_left .nav-area') || document.querySelector('.l_left .header');
    if (!header) {
      return;
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', '切换主题');
    updateIcon(button);

    button.addEventListener('click', function () {
      if (typeof switchTheme === 'function') {
        switchTheme();
      }
      window.setTimeout(function () {
        updateIcon(button);
        updateLogo();
      }, 0);
    });

    header.appendChild(button);
  }

  function updateIcon(button) {
    var theme = document.documentElement.getAttribute('data-theme');
    var dark = theme === 'dark';
    if (theme === null) {
      dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('title', dark ? '切换到浅色模式' : '切换到深色模式');
  }

  function updateLogo() {
    var img = document.querySelector('.logo-wrap .avatar img');
    if (!img) {
      return;
    }
    img.setAttribute('alt', '');
    var theme = document.documentElement.getAttribute('data-theme');
    var dark = theme === 'dark';
    if (theme === null) {
      dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    img.src = dark ? '/brand/fffeiya-mark-dark.png' : '/brand/fffeiya-mark.png';
  }

  function markBrandAccessible() {
    var avatar = document.querySelector('.logo-wrap .avatar');
    if (avatar) {
      avatar.setAttribute('aria-hidden', 'true');
    }
  }

  function markExternalLinks() {
    var links = document.querySelectorAll('a[href^="http"]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.hostname && link.hostname !== window.location.hostname) {
        link.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }

  function formatArticleDates() {
    var times = document.querySelectorAll('.l_body[layout="post"] .article.banner time');
    for (var i = 0; i < times.length; i++) {
      var time = times[i];
      var value = time.getAttribute('datetime');
      if (!value) {
        continue;
      }
      var date = new Date(value);
      if (isNaN(date.getTime())) {
        continue;
      }
      time.textContent = date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日';
    }
  }

  function init() {
    createThemeToggle();
    markExternalLinks();
    formatArticleDates();
    markBrandAccessible();
    updateLogo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
