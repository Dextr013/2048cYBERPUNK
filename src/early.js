(function(){
  var MAX_WAIT_MS = 5000;
  var POLL_MS = 150;
  var done = false;
  function markReady(){
    if (done) return; done = true;
    try { window.YaGames && window.YaGames.init && window.YaGames.init().then(function(y){ try{ y && y.features && y.features.LoadingAPI && y.features.LoadingAPI.ready && y.features.LoadingAPI.ready(); } catch(e){} }).catch(function(){}); } catch(e){}
    try { var pre=document.getElementById('preloader'); var app=document.getElementById('app'); if (pre) pre.classList.add('hidden'); if (app) app.classList.remove('hidden'); } catch(e){}
    try { window.__boot_timeout && clearTimeout(window.__boot_timeout); window.__boot_timeout = null; } catch(e){}
    try { window.parent && window.parent.postMessage({ type:'game_ready' }, '*'); } catch(e){}
  }
  function poll(){
    if (done) return;
    if (window.YaGames && window.YaGames.init) { markReady(); return; }
    setTimeout(poll, POLL_MS);
  }
  // Start polling for SDK as soon as possible
  try { poll(); } catch(e){}
  // Safety timeout to ensure first paint even if SDK/network stalls
  window.__boot_timeout = setTimeout(markReady, MAX_WAIT_MS);
})();