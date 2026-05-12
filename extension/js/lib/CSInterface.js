function CSInterface() {}

CSInterface.prototype.evalScript = function evalScript(script, callback) {
  if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
    window.__adobe_cep__.evalScript(script, callback);
  } else if (callback) {
    callback(JSON.stringify({ ok: false, error: 'CEP runtime is not available.' }));
  }
};
