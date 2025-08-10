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
      markReady();
      return;
    }
    setTimeout(poll, 150);
  }

  if (document.readyState !== 'loading') {
    setTimeout(markReady, 1200);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(markReady, 1200);
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
      var s = document.createElement('link');
      s.rel = 'stylesheet';
      s.href = 'styles.css';
      document.head.appendChild(s);
    }
  } catch (e) {}
})();