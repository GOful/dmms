(function () {
  var mode = window.__DMMS_MODE && window.__DMMS_MODE.getMode();
  if (mode === 'demo') return;
  if (window.__DMMS_MODE.isLocal()) return;
  var expected = window.__AUTH_HASH;
  if (!expected || localStorage.getItem('dmms_auth_hash') !== expected) {
    localStorage.removeItem('dmms_auth_hash');
    location.replace('login.html');
  }
})();
