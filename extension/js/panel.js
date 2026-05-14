(function () {
  var bridge = new window.AECreateBridgeClient();
  var i18n = window.AECreatePanelI18n;
  var state = {
    pending: null,
    pendingArchive: null,
    currentArchiveId: null,
    selectedArchiveId: null,
    language: i18n.loadLanguage(window.localStorage),
    availableEffects: [],
    effectsLoaded: false
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

  function localizedValue(value, fallback) {
    function looksQuestionMarkCorrupted(textValue) {
      if (typeof textValue !== 'string') return false;
      if (textValue.indexOf('????') !== -1) return true;
      var compact = textValue.replace(/\s+/g, '');
      if (compact.length < 6) return false;
      var questionCount = 0;
      for (var i = 0; i < compact.length; i++) {
        if (compact.charAt(i) === '?') questionCount++;
      }
      return questionCount >= 3 && questionCount / compact.length >= 0.3;
    }

    function cleanLocalizedCandidate(candidate) {
      if (candidate === undefined || candidate === null || candidate === '') return null;
      if (typeof candidate === 'string') return looksQuestionMarkCorrupted(candidate) ? null : candidate;
      if (Array.isArray(candidate)) {
        var clean = candidate.filter(function (item) {
          return !(typeof item === 'string' && looksQuestionMarkCorrupted(item));
        });
        return clean.length ? clean : null;
      }
      return candidate;
    }

    function firstClean(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var clean = cleanLocalizedCandidate(candidates[i]);
        if (clean !== null) return clean;
      }
      return '';
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return firstClean([value[state.language], fallback, value.en, value.zh]);
    }
    return firstClean([value, fallback]);
  }

  function localizedField(source, fieldName, fallback) {
    if (!source) return fallback || '';
    var i18nValue = source[fieldName + 'I18n'];
    if (i18nValue === undefined && source.i18n) i18nValue = source.i18n[fieldName];
    if (i18nValue !== undefined) return localizedValue(i18nValue, source[fieldName] || fallback);
    return localizedValue(source[fieldName], fallback);
  }

  function localizedList(source, fieldName) {
    return localizedField(source, fieldName, source && source[fieldName]);
  }

  function selectedModuleNames(checked) {
    if (!state.pending || !state.pending.modules) return [];
    var checkedMap = {};
    if (Array.isArray(checked)) {
      checked.forEach(function (item) {
        checkedMap[item.index] = item.checked;
      });
    }
    var names = [];
    state.pending.modules.forEach(function (module, index) {
      var hasExplicitState = Object.prototype.hasOwnProperty.call(checkedMap, index);
      var isChecked = hasExplicitState ? checkedMap[index] : module.checked !== false;
      if (isChecked) names.push(localizedField(module, 'title', 'Module ' + (index + 1)));
    });
    return names;
  }

  function appliedModulesMessage(checked, fallback) {
    var names = selectedModuleNames(checked);
    if (!names.length) return fallback || '';
    return text('pendingAppliedModules').replace('{modules}', names.join(', '));
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function editableLayerFields(action) {
    var fields = [];
    [
      'name',
      'color',
      'width',
      'height',
      'pixelAspect',
      'duration',
      'startTime',
      'inPoint',
      'outPoint',
      'enabled',
      'guideLayer',
      'shy',
      'opacity',
      'blendingMode',
      'position',
      'lightType',
      'intensity'
    ].forEach(function (field) {
      if (hasOwn(action, field)) fields.push([field]);
    });
    return fields;
  }

  function editableParameterPaths(action) {
    var paths = [];
    if (!action || typeof action !== 'object') return paths;
    if ((action.type === 'setProperty' || action.type === 'modifyEffect') && hasOwn(action, 'value')) {
      paths.push(['value']);
    }
    if ((action.type === 'setKeyframes' || action.type === 'modifyEffect') && Array.isArray(action.keys)) {
      action.keys.forEach(function (key, index) {
        if (key && hasOwn(key, 'time')) paths.push(['keys', index, 'time']);
        if (key && hasOwn(key, 'value')) paths.push(['keys', index, 'value']);
      });
    }
    if (action.type === 'setExpression' && hasOwn(action, 'expression')) paths.push(['expression']);
    if (action.type === 'applyPreset' && hasOwn(action, 'path')) paths.push(['path']);
    if (
      action.type === 'duplicateLayer' ||
      action.type === 'addSolidLayer' ||
      action.type === 'addAdjustmentLayer' ||
      action.type === 'addLightLayer' ||
      action.type === 'addNullLayer' ||
      action.type === 'setLayerProperties'
    ) {
      paths = paths.concat(editableLayerFields(action));
    }
    return paths;
  }

  function getPathValue(object, path) {
    var cursor = object;
    for (var i = 0; i < path.length; i++) {
      if (cursor === undefined || cursor === null) return undefined;
      cursor = cursor[path[i]];
    }
    return cursor;
  }

  function setPathValue(object, path, value) {
    var cursor = object;
    for (var i = 0; i < path.length - 1; i++) {
      cursor = cursor[path[i]];
      if (cursor === undefined || cursor === null) return;
    }
    cursor[path[path.length - 1]] = value;
  }

  function encodeParamPath(path) {
    return path.join('.');
  }

  function decodeParamPath(value) {
    if (!value) return [];
    return value.split('.').map(function (part) {
      return /^\d+$/.test(part) ? Number(part) : part;
    });
  }

  function formatParamPath(path) {
    var output = '';
    path.forEach(function (part, index) {
      if (typeof part === 'number') output += '[' + part + ']';
      else output += (index === 0 ? '' : '.') + part;
    });
    return output;
  }

  function fillTemplate(template, values) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, key) {
      return values && values[key] !== undefined ? String(values[key]) : match;
    });
  }

  function parameterValueText(value) {
    if (value && typeof value === 'object') return JSON.stringify(value);
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function parseParameterValue(raw, original) {
    var textValue = String(raw);
    var trimmed = textValue.replace(/^\s+|\s+$/g, '');
    if (Array.isArray(original) || (original && typeof original === 'object')) {
      return JSON.parse(trimmed);
    }
    if (typeof original === 'number') {
      var numberValue = Number(trimmed);
      if (!isFinite(numberValue)) throw new Error('Expected a number.');
      return numberValue;
    }
    if (typeof original === 'boolean') {
      if (/^(true|1)$/i.test(trimmed)) return true;
      if (/^(false|0)$/i.test(trimmed)) return false;
      throw new Error('Expected true or false.');
    }
    return textValue;
  }

  function actionTargetInfo(action) {
    if (action.effectMatchName && action.propertyPath) {
      var displayPath = action.propertyPathDisplay || action.propertyDisplayPath || action.propertyPathLabels || action.propertyPathNames || action.propertyPath;
      if (!Array.isArray(displayPath)) displayPath = [displayPath];
      var effectName = action.effectDisplayName || action.effectName || action.effectMatchName;
      return { kind: 'effect', target: effectName + ' > ' + displayPath.join(' > ') };
    }
    if (action.ref || action.targetRef || action.layerRef) return { kind: 'layer', target: action.ref || action.targetRef || action.layerRef };
    if (
      action.type === 'duplicateLayer' ||
      action.type === 'addSolidLayer' ||
      action.type === 'addAdjustmentLayer' ||
      action.type === 'addLightLayer' ||
      action.type === 'addNullLayer' ||
      action.type === 'setLayerProperties'
    ) {
      return { kind: 'layer', target: action.name || action.type };
    }
    return { kind: 'action', target: action.matchName || action.name || action.type || 'action' };
  }

  function localizedParameterTarget(action) {
    var info = actionTargetInfo(action);
    var key = info.kind === 'effect' ? 'paramTargetEffect' : (info.kind === 'layer' ? 'paramTargetLayer' : 'paramTargetAction');
    return fillTemplate(text(key), { target: info.target });
  }

  function localizedParamField(path) {
    if (path[0] === 'keys' && typeof path[1] === 'number') {
      var keyNumber = path[1] + 1;
      if (path[2] === 'time') return fillTemplate(text('paramKeyTime'), { index: keyNumber });
      if (path[2] === 'value') return fillTemplate(text('paramKeyValue'), { index: keyNumber });
    }
    var last = path[path.length - 1];
    var fieldKeys = {
      value: 'paramFieldValue',
      name: 'paramFieldName',
      color: 'paramFieldColor',
      width: 'paramFieldWidth',
      height: 'paramFieldHeight',
      pixelAspect: 'paramFieldPixelAspect',
      duration: 'paramFieldDuration',
      startTime: 'paramFieldStartTime',
      inPoint: 'paramFieldInPoint',
      outPoint: 'paramFieldOutPoint',
      enabled: 'paramFieldEnabled',
      guideLayer: 'paramFieldGuideLayer',
      shy: 'paramFieldShy',
      opacity: 'paramFieldOpacity',
      blendingMode: 'paramFieldBlendingMode',
      position: 'paramFieldPosition',
      lightType: 'paramFieldLightType',
      intensity: 'paramFieldIntensity',
      expression: 'paramFieldExpression',
      path: 'paramFieldPath'
    };
    return fieldKeys[last] ? text(fieldKeys[last]) : formatParamPath(path);
  }

  function parameterLabel(action, path) {
    return localizedParameterTarget(action) + ' | ' + localizedParamField(path);
  }

  function renderParameterInput(action, moduleIndex, actionIndex, path) {
    var row = document.createElement('label');
    row.className = 'parameter-row';

    var label = document.createElement('span');
    label.className = 'parameter-label';
    label.textContent = parameterLabel(action, path);

    var input = document.createElement('input');
    input.className = 'parameter-input';
    input.setAttribute('type', 'text');
    input.setAttribute('data-param-edit', '1');
    input.setAttribute('data-module-index', String(moduleIndex));
    input.setAttribute('data-action-index', String(actionIndex));
    input.setAttribute('data-param-path', encodeParamPath(path));
    input.value = parameterValueText(getPathValue(action, path));
    input.addEventListener('change', function () {
      syncParameterInput(input);
    });

    row.appendChild(label);
    row.appendChild(input);
    return row;
  }

  function renderModuleParameters(module, moduleIndex) {
    if (!module || !Array.isArray(module.actions)) return null;
    var rows = [];
    module.actions.forEach(function (action, actionIndex) {
      editableParameterPaths(action).forEach(function (path) {
        rows.push(renderParameterInput(action, moduleIndex, actionIndex, path));
      });
    });
    if (!rows.length) return null;

    var container = document.createElement('div');
    container.className = 'parameter-preview';
    var title = document.createElement('div');
    title.className = 'parameter-preview-title';
    title.textContent = text('parameterPreviewTitle');
    container.appendChild(title);
    rows.forEach(function (row) {
      container.appendChild(row);
    });
    return container;
  }

  function syncParameterInput(input) {
    var moduleIndex = Number(input.getAttribute('data-module-index'));
    var actionIndex = Number(input.getAttribute('data-action-index'));
    var path = decodeParamPath(input.getAttribute('data-param-path'));
    var action = state.pending &&
      state.pending.modules &&
      state.pending.modules[moduleIndex] &&
      state.pending.modules[moduleIndex].actions &&
      state.pending.modules[moduleIndex].actions[actionIndex];
    if (!action) throw new Error('Parameter action not found.');
    var original = getPathValue(action, path);
    var parsed = parseParameterValue(input.value, original);
    setPathValue(action, path, parsed);
    input.value = parameterValueText(parsed);
    input.className = input.className.replace(/\s*is-invalid/g, '');
  }

  function syncEditableParameters() {
    var errors = [];
    var inputs = document.querySelectorAll('[data-param-edit]');
    for (var i = 0; i < inputs.length; i++) {
      try {
        syncParameterInput(inputs[i]);
      } catch (error) {
        inputs[i].className = inputs[i].className.replace(/\s*is-invalid/g, '') + ' is-invalid';
        errors.push(error.message || String(error));
      }
    }
    return errors;
  }

  function selectedMarkerTarget() {
    var element = requireElement('markerTarget');
    return element.value === 'comp' ? 'comp' : 'layer';
  }

  function normalizeGpuMode(value) {
    return value === 'discretePerformance' ? 'discretePerformance' : 'integratedSafe';
  }

  function pendingTargetText(plan) {
    if (!plan || !plan.target) return '';
    var name = plan.target.layerName || ('Layer ' + plan.target.layerIndex);
    var index = plan.target.layerIndex ? ' (#' + plan.target.layerIndex + ')' : '';
    return text('pendingTargetLabel') + ': ' + name + index;
  }

  function compactList(value) {
    if (Array.isArray(value)) return value.join(', ');
    return value ? String(value) : '';
  }

  function applyLanguage() {
    i18n.apply(document, state.language);
    requireElement('languageSelect').value = state.language;
    if (state.pending) renderPending(state.pending);
    else setEmptyText('pendingSummary', 'noPendingAction');
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
    var summary = localizedField(plan, 'title') + '\n' + localizedField(plan, 'summary');
    var target = pendingTargetText(plan);
    if (target) summary += '\n' + target;
    setText('pendingSummary', summary);
    plan.modules.forEach(function (module, index) {
      var row = document.createElement('div');
      row.className = 'module';

      var checkbox = document.createElement('input');
      checkbox.setAttribute('type', 'checkbox');
      checkbox.setAttribute('data-index', String(index));
      checkbox.checked = module.checked !== false;

      var body = document.createElement('div');
      body.className = 'module-body';

      var title = document.createElement('span');
      title.className = 'module-title';
      title.textContent = localizedField(module, 'title');

      var moduleSummary = document.createElement('span');
      moduleSummary.className = 'module-summary';
      moduleSummary.textContent = localizedField(module, 'summary');

      var meta = document.createElement('span');
      meta.className = 'module-meta';
      meta.textContent = formatActionCount(module.actions ? module.actions.length : 0);

      var warning = document.createElement('span');
      warning.className = 'module-warning';
      var warnings = compactList(localizedList(module, 'warnings'));
      warning.textContent = warnings ? text('pendingWarningLabel') + ': ' + warnings : '';

      var requirement = document.createElement('span');
      requirement.className = 'module-requirement';
      var requires = compactList(localizedList(module, 'requires'));
      requirement.textContent = requires ? text('pendingRequiresLabel') + ': ' + requires : '';

      body.appendChild(title);
      body.appendChild(moduleSummary);
      body.appendChild(meta);
      body.appendChild(warning);
      body.appendChild(requirement);
      var parameters = renderModuleParameters(module, index);
      if (parameters) body.appendChild(parameters);

      row.appendChild(checkbox);
      row.appendChild(body);
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
    var selectedExists = false;
    for (var p = 0; p < plans.length; p++) {
      if (plans[p] && plans[p].id === state.selectedArchiveId && plans[p].id !== state.currentArchiveId) {
        selectedExists = true;
        break;
      }
    }
    if (!selectedExists) state.selectedArchiveId = null;
    var shown = 0;
    plans.forEach(function (record) {
      if (!record || !record.plan || record.id === state.currentArchiveId) return;
      var item = document.createElement('div');
      item.className = 'archive-item' + (record.id === state.selectedArchiveId ? ' is-selected' : '');
      item.setAttribute('data-archive-id', record.id);
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');

      var title = document.createElement('span');
      title.className = 'archive-title';
      title.textContent = localizedField(record.plan, 'title', record.title || 'Untitled plan');

      var summary = document.createElement('span');
      summary.className = 'archive-summary';
      summary.textContent = localizedField(record.plan, 'summary', record.summary || '');

      var meta = document.createElement('span');
      meta.className = 'archive-meta';
      meta.textContent = formatActionCount(record.actionCount || 0);

      var deleteButton = document.createElement('button');
      deleteButton.className = 'archive-delete';
      deleteButton.setAttribute('type', 'button');
      deleteButton.textContent = text('deleteArchive');
      deleteButton.addEventListener('click', function (event) {
        if (event && event.stopPropagation) event.stopPropagation();
        deletePendingArchive(record.id);
      });

      item.appendChild(title);
      item.appendChild(summary);
      item.appendChild(meta);
      item.appendChild(deleteButton);
      item.addEventListener('click', function () {
        selectPendingArchive(record.id);
      });
      item.addEventListener('keydown', function (event) {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
        if (event.preventDefault) event.preventDefault();
        selectPendingArchive(record.id);
      });
      list.appendChild(item);
      shown++;
    });
    if (!shown) setEmptyText('pendingArchiveList', 'noPendingArchive');
  }

  function setArchiveItemSelectedClass(item, selected) {
    item.className = item.className.replace(/\s*is-selected/g, '') + (selected ? ' is-selected' : '');
  }

  function updateArchiveSelectionClasses() {
    var list = requireElement('pendingArchiveList');
    for (var i = 0; i < list.children.length; i++) {
      var item = list.children[i];
      if (!item || !item.getAttribute) continue;
      setArchiveItemSelectedClass(item, item.getAttribute('data-archive-id') === state.selectedArchiveId);
    }
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

  function selectPendingArchive(id) {
    state.selectedArchiveId = id;
    updateArchiveSelectionClasses();
  }

  function deletePendingArchive(id) {
    bridge.call('deletePendingArchive', { id: id }).then(function (result) {
      if (result.ok) {
        if (state.selectedArchiveId === id) state.selectedArchiveId = null;
        renderPendingArchive(result.archive, state.currentArchiveId);
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

  function renderSettings(settings) {
    settings = settings || {};
    requireElement('gpuMode').value = normalizeGpuMode(settings.gpuMode);
    renderPresetPaths(settings.presetPaths || []);
  }

  function renderEffectScanResult(result) {
    if (!result.ok) {
      setText('effectScanStatus', result.error);
      return;
    }
    var lines = [result.message];
    if (result.parameterCount !== undefined) lines.push('Parameters: ' + result.parameterCount);
    if (result.truncated) lines.push('Truncated: true');
    if (result.outputPath) lines.push('Output: ' + result.outputPath);
    if (result.catalogPath) lines.push('Catalog: ' + result.catalogPath);
    if (result.reportPath) lines.push('Report: ' + result.reportPath);
    setText('effectScanStatus', lines.join('\n'));
  }

  function effectSearchText(effect) {
    return [effect.name, effect.matchName, effect.category].join(' ').toLowerCase();
  }

  function clearEffectSuggestions() {
    requireElement('effectSuggestionList').innerHTML = '';
  }

  function selectEffectSuggestion(effect) {
    requireElement('effectScanQuery').value = effect.name || effect.matchName || '';
    clearEffectSuggestions();
  }

  function renderEffectSuggestions() {
    var query = requireElement('effectScanQuery').value.replace(/^\s+|\s+$/g, '').toLowerCase();
    var list = requireElement('effectSuggestionList');
    list.innerHTML = '';
    if (!query) return;
    var shown = 0;
    state.availableEffects.forEach(function (effect) {
      if (shown >= 24 || effectSearchText(effect).indexOf(query) === -1) return;
      var item = document.createElement('button');
      item.className = 'effect-suggestion';
      item.setAttribute('type', 'button');

      var title = document.createElement('span');
      title.className = 'effect-suggestion-title';
      title.textContent = effect.name || effect.matchName || 'Unnamed effect';

      var meta = document.createElement('span');
      meta.className = 'effect-suggestion-meta';
      meta.textContent = [effect.matchName, effect.category].filter(Boolean).join(' | ');

      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener('click', function () { selectEffectSuggestion(effect); });
      list.appendChild(item);
      shown++;
    });
  }

  function loadAvailableEffects() {
    if (state.effectsLoaded) {
      renderEffectSuggestions();
      return;
    }
    bridge.call('listAvailableEffects', {}).then(function (result) {
      if (result.ok && result.effects) {
        state.availableEffects = result.effects;
        state.effectsLoaded = true;
        renderEffectSuggestions();
      }
    });
  }

  function loadSettings() {
    bridge.call('getSettings', {}).then(function (result) {
      if (result.ok && result.settings) renderSettings(result.settings);
    });
  }

  requireElement('refreshContext').addEventListener('click', refreshContext);
  requireElement('refreshPending').addEventListener('click', loadPending);
  requireElement('languageSelect').addEventListener('change', function () {
    state.language = i18n.normalizeLanguage(this.value);
    i18n.saveLanguage(window.localStorage, state.language);
    applyLanguage();
  });
  requireElement('gpuMode').addEventListener('change', function () {
    var gpuMode = normalizeGpuMode(this.value);
    this.value = gpuMode;
    bridge.call('setGpuMode', { gpuMode: gpuMode }).then(function (result) {
      if (result.ok && result.settings) renderSettings(result.settings);
      setText('contextStatus', result.ok ? result.message : result.error);
    });
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
  requireElement('scanEffectParams').addEventListener('click', function () {
    bridge.call('scanEffectParams', { query: requireElement('effectScanQuery').value }).then(renderEffectScanResult);
  });
  requireElement('effectScanQuery').addEventListener('focus', loadAvailableEffects);
  requireElement('effectScanQuery').addEventListener('input', function () {
    if (!state.effectsLoaded) loadAvailableEffects();
    else renderEffectSuggestions();
  });
  requireElement('scanAllEffectParams').addEventListener('click', function () {
    if (!confirm(text('scanAllEffectsConfirm'))) return;
    bridge.call('scanAllEffectParams', { maxDepth: 8, maxRecords: 12000 }).then(renderEffectScanResult);
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
    var parameterErrors = syncEditableParameters();
    if (parameterErrors.length) {
      setText('pendingSummary', text('pendingInvalidParameter').replace('{error}', parameterErrors[0]));
      return;
    }
    var checked = Array.prototype.map.call(document.querySelectorAll('[data-index]'), function (input) {
      return { index: Number(input.getAttribute('data-index')), checked: input.checked };
    });
    var payload = { checked: checked };
    if (state.pending) payload.plan = clonePlain(state.pending);
    bridge.call('applyCheckedModules', payload).then(function (result) {
      setText('pendingSummary', result.ok ? appliedModulesMessage(checked, result.message) : result.error);
    });
  });
  requireElement('discardPending').addEventListener('click', function () { bridge.call('discardPendingAction', {}).then(loadPending); });
  requireElement('saveFavorite').addEventListener('click', function () { bridge.call('saveFavorite', {}).then(loadPending); });
  requireElement('openLogs').addEventListener('click', function () { bridge.call('openLogs', {}); });

  applyLanguage();
  loadSettings();
  loadPending();
}());
