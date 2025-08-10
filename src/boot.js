(function () {
  let done = false;

  function markReady() {
    if (done) return;
    done = true;
    try {
      const pre = document.getElementById('preloader');
      const app = document.getElementById('app');
      if (pre) pre.classList.add('hidden');
      if (app) app.classList.remove('hidden');
    } catch (e) {}

    try {
      // Force visibility in case a container applied hidden styles
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.visibility = 'visible';
        document.documentElement.style.opacity = '1';
        document.documentElement.style.display = 'block';
      }
      if (document.body && document.body.style) {
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
        document.body.style.display = 'block';
      }
    } catch (e) {}

    try {
      if (window.YaGames && window.YaGames.init) {
        window.YaGames
          .init()
          .then(function (y) {
            try {
              y &&
                y.features &&
                y.features.LoadingAPI &&
                y.features.LoadingAPI.ready &&
                y.features.LoadingAPI.ready();
            } catch (e) {}
          })
          .catch(function () {});
      }
    } catch (e) {}

    try {
      window.dispatchEvent(new Event('gameready'));
    } catch (e) {}
    try {
      if (window.parent) window.parent.postMessage({ type: 'game_ready' }, '*');
    } catch (e) {}
  }

  function poll() {
    if (done) return;
    if (window.YaGames && window.YaGames.init) {
      // Call ready ASAP once SDK appears
      try {
        window.YaGames.init().then(function (y) {
          try { y?.features?.LoadingAPI?.ready?.(); } catch (e) {}
        }).catch(function () {});
      } catch (e) {}
      markReady();
      return;
    }
    setTimeout(poll, 150);
  }

  // Proactively load Yandex SDK early to avoid container-held preloaders
  try {
    if (!window.YaGames || !window.YaGames.init) {
      var s = document.createElement('script');
      s.src = 'https://yandex.ru/games/sdk/v2';
      s.async = true;
      s.onload = function () {
        try {
          window.YaGames && window.YaGames.init && window.YaGames.init().then(function (y) {
            try { y?.features?.LoadingAPI?.ready?.(); } catch (e) {}
            markReady();
          }).catch(function () { markReady(); });
        } catch (e) { markReady(); }
      };
      s.onerror = function () { markReady(); };
      document.head.appendChild(s);
    }
  } catch (e) {}

  if (document.readyState !== 'loading') {
    // Fire immediately when DOM is ready
    markReady();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      markReady();
    });
  }

  try {
    poll();
  } catch (e) {}

  try {
    window.__boot_timeout = setTimeout(markReady, 4000);
  } catch (e) {}

  try {
    // Promote preloaded stylesheet to real stylesheet as soon as possible
    var preload = document.getElementById('styles-preload');
    if (preload) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = preload.getAttribute('href');
      preload.replaceWith(l);
    } else {
      var s2 = document.createElement('link');
      s2.rel = 'stylesheet';
      s2.href = 'styles.css';
      document.head.appendChild(s2);
    }
  } catch (e) {}
})();