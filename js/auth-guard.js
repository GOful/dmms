(function () {
  var expected = window.__AUTH_HASH;
  if (!expected || localStorage.getItem('dmms_auth_hash') !== expected) {
    localStorage.removeItem('dmms_auth_hash');
    location.replace('login.html');
  }
})();
