(function () {
  var bridge = new window.AECreateBridgeClient();
  var state = { pending: null };

  function requireElement(id) {
    var element = document.getElementById(id);
    if (!element) {
      throw new Error('Missing panel element: ' + id);
    }
    return element;
  }

  function setText(id, text) {
    requireElement(id).textContent = text;
  }

  function renderPending(plan) {
    state.pending = plan;
    var list = requireElement('moduleList');
    list.innerHTML = '';
    if (!plan || !plan.modules || !plan.modules.length) {
      setText('pendingSummary', 'No pending action.');
      return;
    }
    setText('pendingSummary', plan.title + '\n' + plan.summary);
    plan.modules.forEach(function (module, index) {
      var row = document.createElement('label');
      row.className = 'module';
      row.innerHTML =
        '<input type="checkbox" data-index="' + index + '"' + (module.checked !== false ? ' checked' : '') + '>' +
        '<span><span class="module-title"></span><span class="module-summary"></span></span>';
      row.querySelector('.module-title').textContent = module.title;
      row.querySelector('.module-summary').textContent = module.summary;
      list.appendChild(row);
    });
  }

  function refreshContext() {
    bridge.call('exportContext', {}).then(function (result) {
      setText('contextStatus', result.ok ? result.message : result.error);
      if (result.ok && result.markersText) setText('markerList', result.markersText);
    });
  }

  function loadPending() {
    bridge.call('readPendingAction', {}).then(function (result) {
      if (result.ok) renderPending(result.plan);
      else setText('pendingSummary', result.error);
    });
  }

  requireElement('refreshContext').addEventListener('click', refreshContext);
  requireElement('chooseBridge').addEventListener('click', function () {
    bridge.call('chooseBridgeFolder', {}).then(function (result) {
      setText('contextStatus', result.ok ? result.message : result.error);
    });
  });
  requireElement('openBridge').addEventListener('click', function () { bridge.call('openBridgeFolder', {}); });
  requireElement('scanPresets').addEventListener('click', function () {
    bridge.call('scanPresets', {}).then(function (result) {
      setText('presetStatus', result.ok ? result.message : result.error);
    });
  });
  document.querySelectorAll('[data-marker]').forEach(function (button) {
    button.addEventListener('click', function () {
      bridge.call('addMarker', { name: button.getAttribute('data-marker'), target: 'layer' }).then(refreshContext);
    });
  });
  requireElement('customMarker').addEventListener('click', function () {
    var name = prompt('Marker name', 'custom_effect');
    if (name) bridge.call('addMarker', { name: name, target: 'layer' }).then(refreshContext);
  });
  requireElement('applyChecked').addEventListener('click', function () {
    var checked = Array.prototype.map.call(document.querySelectorAll('[data-index]'), function (input) {
      return { index: Number(input.getAttribute('data-index')), checked: input.checked };
    });
    bridge.call('applyCheckedModules', { checked: checked }).then(function (result) {
      setText('pendingSummary', result.ok ? result.message : result.error);
    });
  });
  requireElement('discardPending').addEventListener('click', function () { bridge.call('discardPendingAction', {}).then(loadPending); });
  requireElement('saveFavorite').addEventListener('click', function () { bridge.call('saveFavorite', {}).then(loadPending); });
  requireElement('openLogs').addEventListener('click', function () { bridge.call('openLogs', {}); });

  refreshContext();
  loadPending();
}());
