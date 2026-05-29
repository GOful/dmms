(function () {
  if (window.__DMMS_MODE && window.__DMMS_MODE.isLocal()) return;
  var hasMode = new URLSearchParams(location.search).has('mode');
  if (!hasMode) {
    location.replace('login.html');
    return;
  }
  var mode = window.__DMMS_MODE && window.__DMMS_MODE.getMode();
  if (mode === 'demo') return;
  var expected = window.__AUTH_HASH;
  if (!expected || localStorage.getItem('dmms_auth_hash') !== expected) {
    localStorage.removeItem('dmms_auth_hash');
    location.replace('login.html');
  }
})();
