(function () {
  function BridgeClient() {
    this.cs = new CSInterface();
  }

  function escapeScriptString(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function buildScript(functionName, payloadText) {
    var escapedFunctionName = escapeScriptString(functionName);
    var escapedPayload = escapeScriptString(payloadText);
    return [
      '(function () {',
      '  function jsonError(message) {',
      '    return \'{"ok":false,"error":"\' + String(message)',
      '      .replace(/\\\\/g, \'\\\\\\\\\')',
      '      .replace(/"/g, \'\\\\"\')',
      '      .replace(/\\r/g, \'\\\\r\')',
      '      .replace(/\\n/g, \'\\\\n\') + \'"}\';',
      '  }',
      '  try {',
      '    var functionName = \'' + escapedFunctionName + '\';',
      '    if (typeof AECreateBridge === \'undefined\') {',
      '      return jsonError(\'AECreateBridge is not loaded for \' + functionName);',
      '    }',
      '    if (typeof AECreateBridge[functionName] !== \'function\') {',
      '      return jsonError(\'AECreateBridge.\' + functionName + \' is not a function\');',
      '    }',
      '    return AECreateBridge[functionName](\'' + escapedPayload + '\');',
      '  } catch (error) {',
      '    return jsonError(\'AECreateBridge.\' + functionName + \' failed: \' + error);',
      '  }',
      '}())'
    ].join('\n');
  }

  BridgeClient.prototype.call = function call(functionName, payload) {
    var serialized = JSON.stringify(payload || {});
    var script = buildScript(functionName, serialized);
    return new Promise(function (resolve) {
      this.cs.evalScript(script, function (raw) {
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          resolve({ ok: false, error: 'Invalid JSX response: ' + raw });
        }
      });
    }.bind(this));
  };

  window.AECreateBridgeClient = BridgeClient;
}());
