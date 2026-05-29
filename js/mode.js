(function () {
  function getMode() {
    var m = new URLSearchParams(location.search).get('mode');
    return m === 'admin' ? 'admin' : 'demo';
  }
  function dataPath(base) {
    return getMode() === 'admin' ? base.replace('.json', '.admin.json') : base;
  }
  function isLocal() {
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
  }
  window.__DMMS_MODE = { getMode: getMode, dataPath: dataPath, isLocal: isLocal };
})();
