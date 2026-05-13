(function () {
  var bridge = new window.AECreateBridgeClient();
  var i18n = window.AECreatePanelI18n;
  var state = {
    pending: null,
    pendingArchive: null,
    currentArchiveId: null,
    language: i18n.loadLanguage(window.localStorage)
  };

  function requireElement(id) {
    var element = document.getElementById(id);
    if (!element) {
      throw new Error('Missing panel element: ' + id);
    }
    return element;
  }

  function setText(id, text) {
    var element = requireElement(id);
    element.removeAttribute('data-i18n');
    element.removeAttribute('data-empty-i18n');
    element.textContent = text;
  }

  function text(key) {
    return i18n.t(state.language, key);
  }

  function setEmptyText(id, key) {
    var element = requireElement(id);
    element.setAttribute('data-empty-i18n', key);
    element.textContent = text(key);
  }

  function formatActionCount(count) {
    var key = count === 1 ? 'actionCountOne' : 'actionCountMany';
    return text(key).replace('{count}', String(count));
  }

  function selectedMarkerTarget() {
    var element = requireElement('markerTarget');
    return element.value === 'comp' ? 'comp' : 'layer';
  }

  function pendingTargetText(plan) {
    if (!plan || !plan.target) return '';
    var name = plan.target.layerName || ('Layer ' + plan.target.layerIndex);
    var index = plan.target.layerIndex ? ' (#' + plan.target.layerIndex + ')' : '';
    return text('pendingTargetLabel') + ': ' + name + index;
  }

  function compactList(value) {
    if (value instanceof Array) return value.join(', ');
    return value ? String(value) : '';
  }

  function applyLanguage() {
    i18n.apply(document, state.language);
    requireElement('languageSelect').value = state.language;
    if (!state.pending) setEmptyText('pendingSummary', 'noPendingAction');
    renderPresetPaths(state.presetPaths || []);
    renderPendingArchive(state.pendingArchive, state.currentArchiveId);
  }

  function renderPending(plan) {
    state.pending = plan;
    var list = requireElement('moduleList');
    list.innerHTML = '';
    if (!plan || !plan.modules || !plan.modules.length) {
      setEmptyText('pendingSummary', 'noPendingAction');
      return;
    }
    var summary = plan.title + '\n' + plan.summary;
    var target = pendingTargetText(plan);
    if (target) summary += '\n' + target;
    setText('pendingSummary', summary);
    plan.modules.forEach(function (module, index) {
      var row = document.createElement('label');
      row.className = 'module';
      row.innerHTML =
        '<input type="checkbox" data-index="' + index + '"' + (module.checked !== false ? ' checked' : '') + '>' +
        '<span><span class="module-title"></span><span class="module-summary"></span><span class="module-meta"></span><span class="module-warning"></span><span class="module-requirement"></span></span>';
      row.querySelector('.module-title').textContent = module.title;
      row.querySelector('.module-summary').textContent = module.summary;
      row.querySelector('.module-meta').textContent = formatActionCount(module.actions ? module.actions.length : 0);
      var warnings = compactList(module.warnings);
      var requires = compactList(module.requires);
      row.querySelector('.module-warning').textContent = warnings ? text('pendingWarningLabel') + ': ' + warnings : '';
      row.querySelector('.module-requirement').textContent = requires ? text('pendingRequiresLabel') + ': ' + requires : '';
      list.appendChild(row);
    });
  }

  function renderPendingArchive(archive, currentArchiveId) {
    state.pendingArchive = archive || { plans: [] };
    state.currentArchiveId = currentArchiveId || null;
    var list = requireElement('pendingArchiveList');
    list.innerHTML = '';
    list.removeAttribute('data-i18n');
    list.removeAttribute('data-empty-i18n');
    var plans = state.pendingArchive.plans || [];
    var shown = 0;
    plans.forEach(function (record) {
      if (!record || !record.plan || record.id === state.currentArchiveId) return;
      var item = document.createElement('button');
      item.className = 'archive-item';
      item.setAttribute('data-archive-id', record.id);

      var title = document.createElement('span');
      title.className = 'archive-title';
      title.textContent = record.title || record.plan.title || 'Untitled plan';

      var summary = document.createElement('span');
      summary.className = 'archive-summary';
      summary.textContent = record.summary || record.plan.summary || '';

      var meta = document.createElement('span');
      meta.className = 'archive-meta';
      meta.textContent = formatActionCount(record.actionCount || 0);

      item.appendChild(title);
      item.appendChild(summary);
      item.appendChild(meta);
      item.addEventListener('click', function () {
        restorePending(record.id);
      });
      list.appendChild(item);
      shown++;
    });
    if (!shown) setEmptyText('pendingArchiveList', 'noPendingArchive');
  }

  function refreshContext() {
    bridge.call('exportContext', {}).then(function (result) {
      setText('contextStatus', result.ok ? result.message : result.error);
      if (result.ok && result.markersText) setText('markerList', result.markersText);
    });
  }

  function loadPending() {
    bridge.call('readPendingAction', {}).then(function (result) {
      if (result.ok) {
        renderPending(result.plan);
        renderPendingArchive(result.archive, result.currentArchiveId);
      }
      else {
        state.pending = null;
        state.currentArchiveId = null;
        requireElement('moduleList').innerHTML = '';
        setText('pendingSummary', result.error);
        loadPendingArchive();
      }
    });
  }

  function loadPendingArchive() {
    bridge.call('listPendingArchive', {}).then(function (result) {
      if (result.ok) renderPendingArchive(result.archive, state.currentArchiveId);
    });
  }

  function restorePending(id) {
    bridge.call('restorePendingAction', { id: id }).then(function (result) {
      if (result.ok) {
        renderPending(result.plan);
        renderPendingArchive(result.archive, result.currentArchiveId);
      } else {
        setText('pendingSummary', result.error);
      }
    });
  }

  function renderPresetPaths(paths) {
    state.presetPaths = paths || [];
    if (!state.presetPaths.length) {
      setEmptyText('presetPathList', 'noCustomPresetPaths');
      return;
    }
    setText('presetPathList', text('customPresetPaths') + ':\n' + state.presetPaths.join('\n'));
  }

  function loadSettings() {
    bridge.call('getSettings', {}).then(function (result) {
      if (result.ok && result.settings) renderPresetPaths(result.settings.presetPaths || []);
    });
  }

  requireElement('refreshContext').addEventListener('click', refreshContext);
  requireElement('refreshPending').addEventListener('click', loadPending);
  requireElement('languageSelect').addEventListener('change', function () {
    state.language = i18n.normalizeLanguage(this.value);
    i18n.saveLanguage(window.localStorage, state.language);
    applyLanguage();
  });
  requireElement('chooseBridge').addEventListener('click', function () {
    bridge.call('chooseBridgeFolder', {}).then(function (result) {
      setText('contextStatus', result.ok ? result.message : result.error);
    });
  });
  requireElement('openBridge').addEventListener('click', function () { bridge.call('openBridgeFolder', {}); });
  requireElement('scanPresets').addEventListener('click', function () {
    bridge.call('scanPresets', {}).then(function (result) {
      if (result.ok && result.searchedPaths) {
        setText('presetStatus', result.message + '\n\n' + text('scannedPresetPaths') + ':\n' + result.searchedPaths.join('\n'));
      } else {
        setText('presetStatus', result.ok ? result.message : result.error);
      }
    });
  });
  requireElement('addPresetPath').addEventListener('click', function () {
    bridge.call('choosePresetFolder', {}).then(function (result) {
      setText('presetStatus', result.ok ? result.message : result.error);
      if (result.ok && result.settings) renderPresetPaths(result.settings.presetPaths || []);
    });
  });
  requireElement('clearPresetPaths').addEventListener('click', function () {
    bridge.call('clearPresetFolders', {}).then(function (result) {
      setText('presetStatus', result.ok ? result.message : result.error);
      if (result.ok && result.settings) renderPresetPaths(result.settings.presetPaths || []);
    });
  });
  document.querySelectorAll('[data-marker]').forEach(function (button) {
    button.addEventListener('click', function () {
      bridge.call('addMarker', { name: button.getAttribute('data-marker'), target: selectedMarkerTarget() }).then(refreshContext);
    });
  });
  requireElement('customMarker').addEventListener('click', function () {
    var name = prompt(text('markerPrompt'), 'custom_effect');
    if (name) bridge.call('addMarker', { name: name, target: selectedMarkerTarget() }).then(refreshContext);
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

  applyLanguage();
  loadSettings();
  loadPending();
}());
