var AECreateActions = AECreateActions || {};

AECreateActions.pendingFile = function () {
  return new File(AECreateBridge.bridgeFolder().fsName + '/pending-action.json');
};

AECreateActions.pendingArchiveFile = function () {
  return new File(AECreateBridge.bridgeFolder().fsName + '/pending-plans.json');
};

AECreateActions.log = function (message) {
  var folder = AECreateBridge.ensureFolder(new Folder(AECreateBridge.bridgeFolder().fsName + '/logs'), 'logs folder');
  var file = new File(folder.fsName + '/apply.log');
  file.encoding = 'UTF-8';
  if (!file.open('a')) AECreateBridge.fail('Unable to open apply log: ' + file.fsName + AECreateBridge.errorSuffix(file));
  file.writeln(new Date().toString() + ' ' + message);
  if (!file.close()) AECreateBridge.fail('Unable to close apply log: ' + file.fsName + AECreateBridge.errorSuffix(file));
};

AECreateActions.readPendingPlan = function () {
  var file = AECreateActions.pendingFile();
  if (!file.exists) AECreateBridge.fail('No pending-action.json found.');
  return AECreateJSON.parse(AECreateBridge.readText(file));
};

AECreateActions.effectParamsFolder = function () {
  return new Folder(AECreateBridge.bridgeFolder().fsName + '/effect-params');
};

AECreateActions.effectScanMatches = function (effect, effectName) {
  if (!effect || !AECreateActions.isNonEmptyString(effectName)) return false;
  var needle = String(effectName).toLowerCase();
  return String(effect.name || '').toLowerCase() === needle || String(effect.matchName || '').toLowerCase() === needle;
};

AECreateActions.samePath = function (left, right) {
  if (!(left instanceof Array) || !(right instanceof Array) || left.length !== right.length) return false;
  for (var i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
};

AECreateActions.pathKey = function (path) {
  if (!(path instanceof Array)) return '';
  var parts = [];
  for (var i = 0; i < path.length; i++) parts.push(String(path[i]));
  return parts.join('\u001f');
};

AECreateActions.effectKey = function (name) {
  return String(name || '').toLowerCase();
};

AECreateActions.indexScannedParamRecord = function (index, record) {
  if (!record || typeof record !== 'object') return;
  if (record.matchPath instanceof Array) index.records[AECreateActions.pathKey(record.matchPath)] = record;
  if (record.path instanceof Array) index.records[AECreateActions.pathKey(record.path)] = record;
  if (AECreateActions.isNonEmptyString(record.matchName)) index.records[AECreateActions.pathKey([record.matchName])] = record;
  if (record.children instanceof Array) {
    for (var i = 0; i < record.children.length; i++) AECreateActions.indexScannedParamRecord(index, record.children[i]);
  }
};

AECreateActions.registerEffectScanIndex = function (lookup, scan, index) {
  if (!scan || !scan.effect) return;
  var names = [scan.effect.name, scan.effect.matchName];
  for (var i = 0; i < names.length; i++) {
    if (AECreateActions.isNonEmptyString(names[i])) lookup.effects[AECreateActions.effectKey(names[i])] = index;
  }
};

AECreateActions.createEffectParamLookup = function () {
  var lookup = { effects: {} };
  var folder = AECreateActions.effectParamsFolder();
  if (!folder.exists || !folder.getFiles) return lookup;
  var files = folder.getFiles('*.json');
  for (var i = 0; i < files.length; i++) {
    try {
      var scan = AECreateJSON.parse(AECreateBridge.readText(files[i]));
      if (!scan || !scan.effect) continue;
      var index = { scan: scan, records: {} };
      if (scan.params instanceof Array) {
        for (var p = 0; p < scan.params.length; p++) AECreateActions.indexScannedParamRecord(index, scan.params[p]);
      }
      AECreateActions.registerEffectScanIndex(lookup, scan, index);
    } catch (scanError) {}
  }
  return lookup;
};

AECreateActions.lookupScannedParam = function (effectName, propertyPath, lookup) {
  if (!(propertyPath instanceof Array)) return null;
  var activeLookup = lookup || AECreateActions.createEffectParamLookup();
  var index = activeLookup.effects[AECreateActions.effectKey(effectName)];
  if (!index) return null;
  var record = index.records[AECreateActions.pathKey(propertyPath)];
  return record ? { scan: index.scan, record: record } : null;
};

AECreateActions.actionNeedsParamLookup = function (action) {
  return action &&
    typeof action === 'object' &&
    action.propertyPath instanceof Array &&
    AECreateActions.isNonEmptyString(action.effectMatchName) &&
    !(action.propertyPathDisplay instanceof Array && action.propertyPathDisplay.length);
};

AECreateActions.planNeedsParamLookup = function (plan) {
  if (!plan || !(plan.modules instanceof Array)) return false;
  for (var m = 0; m < plan.modules.length; m++) {
    var module = plan.modules[m];
    if (!module || !(module.actions instanceof Array)) continue;
    for (var a = 0; a < module.actions.length; a++) {
      if (AECreateActions.actionNeedsParamLookup(module.actions[a])) return true;
    }
  }
  return false;
};

AECreateActions.enrichActionDisplayNames = function (action, lookup) {
  if (!AECreateActions.actionNeedsParamLookup(action)) return;
  var found = AECreateActions.lookupScannedParam(action.effectMatchName, action.propertyPath, lookup);
  if (!found || !found.record) return;
  if (found.scan && found.scan.effect && AECreateActions.isNonEmptyString(found.scan.effect.name)) action.effectDisplayName = found.scan.effect.name;
  if (found.record.path instanceof Array && found.record.path.length) {
    action.propertyPathDisplay = found.record.path;
  } else if (AECreateActions.isNonEmptyString(found.record.name)) {
    action.propertyPathDisplay = [found.record.name];
  }
  if (action.propertyPathDisplay instanceof Array && action.propertyPathDisplay.length) {
    action.parameterName = action.propertyPathDisplay[action.propertyPathDisplay.length - 1];
  }
};

AECreateActions.enrichPendingPlanDisplayNames = function (plan) {
  if (!plan || !(plan.modules instanceof Array)) return plan;
  var lookup = AECreateActions.planNeedsParamLookup(plan) ? AECreateActions.createEffectParamLookup() : null;
  for (var m = 0; m < plan.modules.length; m++) {
    var module = plan.modules[m];
    if (!module || !(module.actions instanceof Array)) continue;
    for (var a = 0; a < module.actions.length; a++) {
      AECreateActions.enrichActionDisplayNames(module.actions[a], lookup);
    }
  }
  return plan;
};

AECreateActions.hashString = function (text) {
  var hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash = hash >>> 0;
  }
  var output = hash.toString(16);
  while (output.length < 8) output = '0' + output;
  return 'plan:' + output;
};

AECreateActions.planIdentity = function (plan) {
  return {
    schemaVersion: plan.schemaVersion,
    createdAt: plan.createdAt,
    contextFingerprint: plan.contextFingerprint,
    title: plan.title,
    summary: plan.summary,
    target: plan.target,
    modules: plan.modules
  };
};

AECreateActions.planId = function (plan) {
  return AECreateActions.hashString(AECreateJSON.stringify(AECreateActions.planIdentity(plan)));
};

AECreateActions.planActionCount = function (plan) {
  var count = 0;
  if (!plan || !(plan.modules instanceof Array)) return count;
  for (var i = 0; i < plan.modules.length; i++) {
    if (plan.modules[i] && plan.modules[i].actions instanceof Array) count += plan.modules[i].actions.length;
  }
  return count;
};

AECreateActions.readPendingArchive = function () {
  var file = AECreateActions.pendingArchiveFile();
  if (!file.exists) return { schemaVersion: 1, plans: [] };
  try {
    var archive = AECreateJSON.parse(AECreateBridge.readText(file));
    if (!archive || !(archive.plans instanceof Array)) return { schemaVersion: 1, plans: [] };
    return archive;
  } catch (error) {
    return { schemaVersion: 1, plans: [] };
  }
};

AECreateActions.writePendingArchive = function (archive) {
  AECreateBridge.writeText(AECreateActions.pendingArchiveFile(), AECreateJSON.stringify(archive));
};

AECreateActions.pendingArchiveRecord = function (plan, id) {
  return {
    id: id,
    savedAt: new Date().toString(),
    title: plan.title || 'Untitled plan',
    summary: plan.summary || '',
    moduleCount: plan.modules instanceof Array ? plan.modules.length : 0,
    actionCount: AECreateActions.planActionCount(plan),
    plan: plan
  };
};

AECreateActions.rememberPendingPlan = function (plan) {
  var archive = AECreateActions.readPendingArchive();
  var id = AECreateActions.planId(plan);
  var kept = [];
  for (var i = 0; i < archive.plans.length; i++) {
    if (archive.plans[i] && archive.plans[i].id !== id) kept.push(archive.plans[i]);
  }
  kept.unshift(AECreateActions.pendingArchiveRecord(plan, id));
  var limit = 50;
  if (kept.length > limit) kept = kept.slice(0, limit);
  archive = { schemaVersion: 1, updatedAt: new Date().toString(), plans: kept };
  AECreateActions.writePendingArchive(archive);
  return { id: id, archive: archive };
};

AECreateActions.findArchivedPlan = function (id) {
  var archive = AECreateActions.readPendingArchive();
  for (var i = 0; i < archive.plans.length; i++) {
    if (archive.plans[i] && archive.plans[i].id === id) return { archive: archive, record: archive.plans[i] };
  }
  return { archive: archive, record: null };
};

AECreateActions.hasField = function (object, name) {
  return object && object.hasOwnProperty && object.hasOwnProperty(name);
};

AECreateActions.isInteger = function (value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
};

AECreateActions.isNonNegativeInteger = function (value) {
  return AECreateActions.isInteger(value) && value >= 0;
};

AECreateActions.isPositiveInteger = function (value) {
  return AECreateActions.isInteger(value) && value > 0;
};

AECreateActions.allowedActionTypes = [
  'addEffect',
  'modifyEffect',
  'applyPreset',
  'setProperty',
  'setKeyframes',
  'setExpression',
  'duplicateLayer',
  'addSolidLayer',
  'addAdjustmentLayer',
  'addLightLayer',
  'addNullLayer',
  'setLayerProperties'
];

AECreateActions.isNonEmptyString = function (value) {
  return typeof value === 'string' && value.replace(/^\s+|\s+$/g, '').length > 0;
};

AECreateActions.isAllowedActionType = function (type) {
  for (var i = 0; i < AECreateActions.allowedActionTypes.length; i++) {
    if (AECreateActions.allowedActionTypes[i] === type) return true;
  }
  return false;
};

AECreateActions.activeComp = function () {
  if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) return null;
  return app.project.activeItem;
};

AECreateActions.currentContextFingerprint = function () {
  var file = new File(AECreateBridge.bridgeFolder().fsName + '/current-context.json');
  if (!file.exists) AECreateBridge.fail('current-context.json is missing. Click Refresh Context before applying pending actions.');
  var context = AECreateJSON.parse(AECreateBridge.readText(file));
  if (!context || !AECreateActions.isNonEmptyString(context.contextFingerprint)) {
    AECreateBridge.fail('current-context.json has no contextFingerprint. Click Refresh Context again before applying pending actions.');
  }
  return context.contextFingerprint;
};

AECreateActions.validatePendingAction = function (pending, expectedContextFingerprint) {
  var errors = [];
  if (!pending || typeof pending !== 'object' || pending instanceof Array) return ['pending action must be an object'];

  if (pending.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!AECreateActions.isNonEmptyString(pending.createdAt)) errors.push('createdAt must be a non-empty string');
  if (!AECreateActions.isNonEmptyString(pending.contextFingerprint)) errors.push('contextFingerprint must be a non-empty string');
  if (AECreateActions.isNonEmptyString(expectedContextFingerprint) && pending.contextFingerprint !== expectedContextFingerprint) {
    errors.push('contextFingerprint does not match current context');
  }
  if (!AECreateActions.isNonEmptyString(pending.title)) errors.push('title must be a non-empty string');
  if (!AECreateActions.isNonEmptyString(pending.summary)) errors.push('summary must be a non-empty string');

  if (!pending.target || typeof pending.target !== 'object' || pending.target instanceof Array) {
    errors.push('target must be an object');
  } else {
    if (pending.target.compId !== 'active' && !AECreateActions.isNonEmptyString(pending.target.compId)) {
      errors.push('target.compId must be active or a non-empty string');
    }
    if (!AECreateActions.isPositiveInteger(pending.target.layerIndex)) {
      errors.push('target.layerIndex must be a positive integer');
    }
  }

  if (!(pending.modules instanceof Array) || pending.modules.length === 0) {
    errors.push('modules must be a non-empty array');
  } else {
    for (var m = 0; m < pending.modules.length; m++) {
      var module = pending.modules[m];
      if (!module || typeof module !== 'object' || module instanceof Array) {
        errors.push('modules[' + m + '] must be an object');
        continue;
      }
      if (!AECreateActions.isNonEmptyString(module.id)) errors.push('modules[' + m + '].id must be a non-empty string');
      if (!AECreateActions.isNonEmptyString(module.title)) errors.push('modules[' + m + '].title must be a non-empty string');
      if (!AECreateActions.isNonEmptyString(module.summary)) errors.push('modules[' + m + '].summary must be a non-empty string');
      if (!(module.actions instanceof Array) || module.actions.length === 0) {
        errors.push('modules[' + m + '].actions must be a non-empty array');
      } else {
        for (var a = 0; a < module.actions.length; a++) {
          var action = module.actions[a];
          if (!action || typeof action !== 'object' || action instanceof Array) {
            errors.push('modules[' + m + '].actions[' + a + '] must be an object');
            continue;
          }
          if (!AECreateActions.isNonEmptyString(action.type)) {
            errors.push('modules[' + m + '].actions[' + a + '].type must be a non-empty string');
          } else if (!AECreateActions.isAllowedActionType(action.type)) {
            errors.push('modules[' + m + '].actions[' + a + '].type must be one of: ' + AECreateActions.allowedActionTypes.join(', '));
          }
        }
      }
    }
  }

  return errors;
};

AECreateActions.validatePendingActionOrFail = function (pending, expectedContextFingerprint) {
  var errors = AECreateActions.validatePendingAction(pending, expectedContextFingerprint);
  if (errors.length) AECreateBridge.fail('Pending action failed validation: ' + errors.join('; '));
};

AECreateActions.checkedMap = function (payload) {
  var map = {};
  if (!payload || !(payload.checked instanceof Array)) AECreateBridge.fail('payload.checked must be an array.');
  for (var i = 0; i < payload.checked.length; i++) {
    var item = payload.checked[i];
    if (!item || typeof item !== 'object' || item instanceof Array) AECreateBridge.fail('payload.checked[' + i + '] must be an object.');
    if (!AECreateActions.isNonNegativeInteger(item.index)) AECreateBridge.fail('payload.checked[' + i + '].index must be a non-negative integer.');
    if (typeof item.checked !== 'boolean') AECreateBridge.fail('payload.checked[' + i + '].checked must be a boolean.');
    map[item.index] = item.checked;
  }
  return map;
};

AECreateActions.moduleIsChecked = function (module, checkedMap, index) {
  return checkedMap[index] === true;
};

AECreateActions.pendingPlanFromPayload = function (payload) {
  if (payload && payload.plan && typeof payload.plan === 'object' && !(payload.plan instanceof Array)) return payload.plan;
  return AECreateActions.readPendingPlan();
};

AECreateActions.validateTargetLayerIndex = function (pending, comp) {
  if (!pending.target || !AECreateActions.isPositiveInteger(pending.target.layerIndex)) {
    return { ok: false, error: 'Pending action target layerIndex must be a positive integer. Requested index: ' + (pending.target ? pending.target.layerIndex : 'missing') + ', comp.numLayers: ' + comp.numLayers + '.' };
  }
  var targetName = AECreateActions.isNonEmptyString(pending.target.layerName) ? pending.target.layerName : null;
  var indexLayer = pending.target.layerIndex <= comp.numLayers ? comp.layer(pending.target.layerIndex) : null;
  if (targetName) {
    if (indexLayer && indexLayer.name === targetName) return { ok: true, layer: indexLayer };
    var matches = [];
    for (var i = 1; i <= comp.numLayers; i++) {
      var candidate = comp.layer(i);
      if (candidate && candidate.name === targetName) matches.push(candidate);
    }
    if (matches.length === 1) {
      return {
        ok: true,
        layer: matches[0],
        warning: 'Target layer index changed; resolved by layerName: ' + targetName
      };
    }
    if (matches.length > 1) {
      return { ok: false, error: 'Pending action target layerName is ambiguous: ' + targetName + ' matched ' + matches.length + ' layers.' };
    }
  }
  if (!indexLayer) {
    return { ok: false, error: 'Pending action target layerIndex is out of range. Requested index: ' + pending.target.layerIndex + ', comp.numLayers: ' + comp.numLayers + '.' };
  }
  return { ok: true, layer: indexLayer };
};

AECreateBridge.readPendingAction = function () {
  try {
    var plan = AECreateActions.enrichPendingPlanDisplayNames(AECreateActions.readPendingPlan());
    var remembered = AECreateActions.rememberPendingPlan(plan);
    return AECreateBridge.respond({ ok: true, plan: plan, archive: remembered.archive, currentArchiveId: remembered.id });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: 'Could not read pending-action.json: ' + String(error) });
  }
};

AECreateBridge.listPendingArchive = function () {
  try {
    return AECreateBridge.respond({ ok: true, archive: AECreateActions.readPendingArchive() });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.restorePendingAction = function (payloadText) {
  try {
    var payload = AECreateJSON.parse(payloadText || '{}');
    if (!AECreateActions.isNonEmptyString(payload.id)) AECreateBridge.fail('restorePendingAction requires id.');
    var found = AECreateActions.findArchivedPlan(payload.id);
    if (!found.record || !found.record.plan) AECreateBridge.fail('Archived pending plan not found: ' + payload.id);
    AECreateBridge.writeText(AECreateActions.pendingFile(), AECreateJSON.stringify(found.record.plan));
    var remembered = AECreateActions.rememberPendingPlan(found.record.plan);
    return AECreateBridge.respond({
      ok: true,
      message: 'Restored pending plan: ' + (found.record.plan.title || payload.id),
      plan: found.record.plan,
      archive: remembered.archive,
      currentArchiveId: remembered.id
    });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.discardPendingAction = function () {
  try {
    var file = AECreateActions.pendingFile();
    if (file.exists) {
      try {
        AECreateActions.rememberPendingPlan(AECreateJSON.parse(AECreateBridge.readText(file)));
      } catch (archiveError) {}
    }
    if (file.exists && !file.remove()) AECreateBridge.fail('Unable to remove pending action: ' + file.fsName + AECreateBridge.errorSuffix(file));
    return AECreateBridge.respond({ ok: true, message: 'Discarded pending action.' });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.applyCheckedModules = function (payloadText) {
  var undoOpen = false;
  try {
    var payload = AECreateJSON.parse(payloadText || '{}');
    var checkedMap = AECreateActions.checkedMap(payload);
    var pending = AECreateActions.pendingPlanFromPayload(payload);
    var expectedContextFingerprint = AECreateActions.currentContextFingerprint();
    AECreateActions.validatePendingActionOrFail(pending, null);

    var comp = AECreateActions.activeComp();
    if (!comp) return AECreateBridge.respond({ ok: false, error: 'No active composition.' });
    var targetCheck = AECreateActions.validateTargetLayerIndex(pending, comp);
    if (!targetCheck.ok) return AECreateBridge.respond(targetCheck);

    var layer = targetCheck.layer || comp.layer(pending.target.layerIndex);
    if (!layer) return AECreateBridge.respond({ ok: false, error: 'Target layer not found.' });

    var applied = [];
    app.beginUndoGroup('AEcreate Apply Checked Modules');
    undoOpen = true;
    for (var m = 0; m < pending.modules.length; m++) {
      if (!AECreateActions.moduleIsChecked(pending.modules[m], checkedMap, m)) continue;
      AECreateActions.applyModule(layer, pending.modules[m], m, AECreateActions.createModuleContext(comp, layer));
      applied.push(pending.modules[m].title || ('Module ' + (m + 1)));
    }
    app.endUndoGroup();
    undoOpen = false;

    var postApplyWarnings = [];
    try {
      AECreateActions.log('Applied: ' + applied.join(', '));
    } catch (logError) {
      postApplyWarnings.push('Could not write apply log: ' + String(logError));
    }
    try {
      AECreateActions.writeHistory(pending);
    } catch (historyError) {
      postApplyWarnings.push('Could not write history: ' + String(historyError));
    }

    var response = { ok: true, message: 'Applied modules: ' + applied.join(', ') };
    if (AECreateActions.isNonEmptyString(expectedContextFingerprint) && pending.contextFingerprint !== expectedContextFingerprint) {
      postApplyWarnings.push('contextFingerprint changed; applied as reusable plan after resolving target layer.');
    }
    if (targetCheck.warning) postApplyWarnings.push(targetCheck.warning);
    if (postApplyWarnings.length) response.warning = postApplyWarnings.join(' ');
    return AECreateBridge.respond(response);
  } catch (error) {
    if (undoOpen) {
      try {
        app.endUndoGroup();
      } catch (undoError) {}
    }
    try {
      AECreateActions.log('ERROR ' + String(error));
    } catch (logError) {}
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateActions.actionContext = function (module, moduleIndex, actionIndex) {
  var title = module && module.title ? module.title : ('Module ' + (moduleIndex + 1));
  return 'module ' + title + ' action ' + (actionIndex + 1);
};

AECreateActions.requirePropertyPath = function (action) {
  if (!(action.propertyPath instanceof Array) || action.propertyPath.length === 0) AECreateBridge.fail('propertyPath must be a non-empty array.');
};

AECreateActions.createModuleContext = function (comp, targetLayer) {
  return {
    comp: comp || AECreateActions.activeComp(),
    targetLayer: targetLayer,
    layersByRef: {}
  };
};

AECreateActions.ensureModuleContext = function (layer, moduleContext) {
  if (moduleContext && typeof moduleContext === 'object') {
    if (!moduleContext.targetLayer) moduleContext.targetLayer = layer;
    if (!moduleContext.comp) moduleContext.comp = AECreateActions.activeComp();
    if (!moduleContext.layersByRef) moduleContext.layersByRef = {};
    return moduleContext;
  }
  if (layer && typeof layer === 'object' && layer.targetLayer && layer.layersByRef) {
    return AECreateActions.ensureModuleContext(layer.targetLayer, layer);
  }
  return AECreateActions.createModuleContext(AECreateActions.activeComp(), layer);
};

AECreateActions.rememberLayerRef = function (context, action, layer) {
  if (!context.layersByRef) context.layersByRef = {};
  if (AECreateActions.isNonEmptyString(action.ref)) context.layersByRef[action.ref] = layer;
};

AECreateActions.resolveActionLayer = function (context, action) {
  var ref = action.targetRef || action.layerRef;
  if (AECreateActions.isNonEmptyString(ref)) {
    if (!context.layersByRef || !context.layersByRef[ref]) AECreateBridge.fail('Layer ref not found: ' + ref);
    return context.layersByRef[ref];
  }
  if (!context.targetLayer) AECreateBridge.fail('No target layer available for action.');
  return context.targetLayer;
};

AECreateActions.resolveLayerRef = function (context, ref) {
  if (!AECreateActions.isNonEmptyString(ref)) return null;
  if (!context.layersByRef || !context.layersByRef[ref]) AECreateBridge.fail('Layer ref not found: ' + ref);
  return context.layersByRef[ref];
};

AECreateActions.numberOrDefault = function (value, fallback) {
  return typeof value === 'number' && isFinite(value) ? value : fallback;
};

AECreateActions.blendingModeValue = function (name) {
  if (!AECreateActions.isNonEmptyString(name)) return null;
  var normalized = String(name).toUpperCase().replace(/[\s-]+/g, '_');
  var aliases = {
    ADD: 'ADD',
    SCREEN: 'SCREEN',
    NORMAL: 'NORMAL',
    MULTIPLY: 'MULTIPLY',
    OVERLAY: 'OVERLAY',
    SOFT_LIGHT: 'SOFT_LIGHT',
    HARD_LIGHT: 'HARD_LIGHT',
    LINEAR_DODGE: 'LINEAR_DODGE',
    COLOR_DODGE: 'COLOR_DODGE',
    LIGHTEN: 'LIGHTEN',
    DARKEN: 'DARKEN'
  };
  var key = aliases[normalized] || normalized;
  if (typeof BlendingMode !== 'undefined' && BlendingMode[key] !== undefined) return BlendingMode[key];
  return null;
};

AECreateActions.lightTypeValue = function (name) {
  if (!AECreateActions.isNonEmptyString(name)) return null;
  var key = String(name).toUpperCase().replace(/[\s-]+/g, '_');
  if (key === 'POINT_LIGHT') key = 'POINT';
  if (key === 'SPOT_LIGHT') key = 'SPOT';
  if (key === 'PARALLEL_LIGHT') key = 'PARALLEL';
  if (key === 'AMBIENT_LIGHT') key = 'AMBIENT';
  if (typeof LightType !== 'undefined' && LightType[key] !== undefined) return LightType[key];
  return null;
};

AECreateActions.applyLayerTiming = function (layer, action, comp) {
  if (typeof action.startTime === 'number' && isFinite(action.startTime)) layer.startTime = action.startTime;
  if (typeof action.inPoint === 'number' && isFinite(action.inPoint)) layer.inPoint = action.inPoint;
  if (typeof action.outPoint === 'number' && isFinite(action.outPoint)) {
    layer.outPoint = action.outPoint;
  } else if (typeof action.duration === 'number' && isFinite(action.duration)) {
    var base = typeof layer.inPoint === 'number' ? layer.inPoint : 0;
    var outPoint = base + action.duration;
    if (comp && typeof comp.duration === 'number' && outPoint > comp.duration) outPoint = comp.duration;
    layer.outPoint = outPoint;
  }
  if (typeof action.enabled === 'boolean') layer.enabled = action.enabled;
  if (typeof action.guideLayer === 'boolean') layer.guideLayer = action.guideLayer;
  if (typeof action.shy === 'boolean') layer.shy = action.shy;
};

AECreateActions.setNativeLayerProperty = function (layer, groupName, propertyName, value) {
  var group = layer.property(groupName);
  if (!group) return false;
  var prop = group.property(propertyName);
  if (!prop || !prop.setValue) return false;
  prop.setValue(value);
  return true;
};

AECreateActions.applyLayerComposite = function (layer, action) {
  if (AECreateActions.isNonEmptyString(action.blendingMode)) {
    var mode = AECreateActions.blendingModeValue(action.blendingMode);
    if (mode === null) AECreateBridge.fail('Unsupported blendingMode: ' + action.blendingMode);
    layer.blendingMode = mode;
  }
  if (typeof action.opacity === 'number' && isFinite(action.opacity)) {
    AECreateActions.setNativeLayerProperty(layer, 'ADBE Transform Group', 'ADBE Opacity', action.opacity);
  }
};

AECreateActions.applyLayerPlacement = function (context, layer, action) {
  if (action.moveBeforeTarget !== false && context.targetLayer && layer.moveBefore) {
    layer.moveBefore(context.targetLayer);
  }
};

AECreateActions.addSolidLayer = function (context, action) {
  var comp = context.comp || AECreateActions.activeComp();
  if (!comp || !comp.layers || !comp.layers.addSolid) AECreateBridge.fail('No active composition available for addSolidLayer.');
  var color = action.color instanceof Array ? action.color : [0, 0, 0];
  var name = action.name || action.ref || 'AEcreate Solid';
  var width = AECreateActions.numberOrDefault(action.width, comp.width);
  var height = AECreateActions.numberOrDefault(action.height, comp.height);
  var pixelAspect = AECreateActions.numberOrDefault(action.pixelAspect, comp.pixelAspect || 1);
  var duration = AECreateActions.numberOrDefault(action.duration, comp.duration);
  var layer = comp.layers.addSolid(color, name, width, height, pixelAspect, duration);
  AECreateActions.applyLayerTiming(layer, action, comp);
  AECreateActions.applyLayerComposite(layer, action);
  AECreateActions.applyLayerPlacement(context, layer, action);
  AECreateActions.rememberLayerRef(context, action, layer);
  return layer;
};

AECreateActions.duplicateLayer = function (context, action) {
  var sourceLayer = AECreateActions.resolveLayerRef(context, action.sourceRef || action.sourceLayerRef) || context.targetLayer;
  if (!sourceLayer || !sourceLayer.duplicate) AECreateBridge.fail('No duplicatable source layer available for duplicateLayer.');
  var layer = sourceLayer.duplicate();
  if (!layer) AECreateBridge.fail('Unable to duplicate source layer.');
  if (action.name) layer.name = action.name;
  AECreateActions.applyLayerTiming(layer, action, context.comp);
  AECreateActions.applyLayerComposite(layer, action);
  AECreateActions.applyLayerPlacement(context, layer, action);
  AECreateActions.rememberLayerRef(context, action, layer);
  return layer;
};

AECreateActions.addAdjustmentLayer = function (context, action) {
  var comp = context.comp || AECreateActions.activeComp();
  if (!comp || !comp.layers || !comp.layers.addSolid) AECreateBridge.fail('No active composition available for addAdjustmentLayer.');
  var name = action.name || action.ref || 'AEcreate Adjustment';
  var duration = AECreateActions.numberOrDefault(action.duration, comp.duration);
  var layer = comp.layers.addSolid([1, 1, 1], name, comp.width, comp.height, comp.pixelAspect || 1, duration);
  layer.adjustmentLayer = true;
  AECreateActions.applyLayerTiming(layer, action, comp);
  AECreateActions.applyLayerComposite(layer, action);
  AECreateActions.applyLayerPlacement(context, layer, action);
  AECreateActions.rememberLayerRef(context, action, layer);
  return layer;
};

AECreateActions.addNullLayer = function (context, action) {
  var comp = context.comp || AECreateActions.activeComp();
  if (!comp || !comp.layers || !comp.layers.addNull) AECreateBridge.fail('No active composition available for addNullLayer.');
  var duration = AECreateActions.numberOrDefault(action.duration, comp.duration);
  var layer = comp.layers.addNull(duration);
  if (action.name) layer.name = action.name;
  AECreateActions.applyLayerTiming(layer, action, comp);
  AECreateActions.applyLayerPlacement(context, layer, action);
  AECreateActions.rememberLayerRef(context, action, layer);
  return layer;
};

AECreateActions.addLightLayer = function (context, action) {
  var comp = context.comp || AECreateActions.activeComp();
  if (!comp || !comp.layers || !comp.layers.addLight) AECreateBridge.fail('No active composition available for addLightLayer.');
  var position = action.position instanceof Array ? action.position : [comp.width / 2, comp.height / 2, -500];
  var name = action.name || action.ref || 'AEcreate Light';
  var layer = comp.layers.addLight(name, [position[0], position[1]]);
  var lightType = AECreateActions.lightTypeValue(action.lightType || 'point');
  if (lightType !== null) layer.lightType = lightType;
  AECreateActions.applyLayerTiming(layer, action, comp);
  if (position.length > 2) AECreateActions.setNativeLayerProperty(layer, 'ADBE Transform Group', 'ADBE Position', position);
  if (typeof action.intensity === 'number' && isFinite(action.intensity)) {
    AECreateActions.setNativeLayerProperty(layer, 'ADBE Light Options Group', 'ADBE Light Intensity', action.intensity);
  }
  if (action.color instanceof Array) {
    AECreateActions.setNativeLayerProperty(layer, 'ADBE Light Options Group', 'ADBE Light Color', action.color);
  }
  AECreateActions.rememberLayerRef(context, action, layer);
  return layer;
};

AECreateActions.setLayerProperties = function (context, action) {
  var layer = AECreateActions.resolveActionLayer(context, action);
  AECreateActions.applyLayerTiming(layer, action, context.comp);
  AECreateActions.applyLayerComposite(layer, action);
};

AECreateActions.applyModule = function (layer, module, moduleIndex, moduleContext) {
  var context = AECreateActions.ensureModuleContext(layer, moduleContext);
  if (!module || !(module.actions instanceof Array)) AECreateBridge.fail('module ' + (module && module.title ? module.title : ('Module ' + (moduleIndex + 1))) + ' actions must be an array.');
  for (var i = 0; i < module.actions.length; i++) {
    try {
      AECreateActions.applyAction(context, module.actions[i]);
    } catch (error) {
      throw new Error(AECreateActions.actionContext(module, moduleIndex, i) + ': ' + String(error));
    }
  }
};

AECreateActions.applyAction = function (contextOrLayer, action) {
  var context = AECreateActions.ensureModuleContext(contextOrLayer, null);
  if (!action || !action.type) AECreateBridge.fail('Action type is required.');
  if (action.type === 'addSolidLayer') {
    AECreateActions.addSolidLayer(context, action);
    return;
  }
  if (action.type === 'duplicateLayer') {
    AECreateActions.duplicateLayer(context, action);
    return;
  }
  if (action.type === 'addAdjustmentLayer') {
    AECreateActions.addAdjustmentLayer(context, action);
    return;
  }
  if (action.type === 'addLightLayer') {
    AECreateActions.addLightLayer(context, action);
    return;
  }
  if (action.type === 'addNullLayer') {
    AECreateActions.addNullLayer(context, action);
    return;
  }
  if (action.type === 'setLayerProperties') {
    AECreateActions.setLayerProperties(context, action);
    return;
  }
  var layer = AECreateActions.resolveActionLayer(context, action);
  if (action.type === 'addEffect') {
    AECreateActions.addEffect(layer, action);
    return;
  }
  if (action.type === 'applyPreset') {
    AECreateActions.applyPreset(layer, action);
    return;
  }
  if (action.type === 'setProperty') {
    AECreateActions.setProperty(context, layer, action);
    return;
  }
  if (action.type === 'setKeyframes') {
    AECreateActions.setKeyframes(layer, action);
    return;
  }
  if (action.type === 'setExpression') {
    AECreateActions.setExpression(layer, action);
    return;
  }
  if (action.type === 'modifyEffect') {
    AECreateActions.applyModifyEffect(context, layer, action);
    return;
  }
  throw new Error('Unsupported action type: ' + action.type);
};

AECreateActions.addEffect = function (layer, action) {
  var effects = layer.property('ADBE Effect Parade');
  if (!effects) AECreateBridge.fail('Layer does not support effects.');
  var effectName = action.matchName || action.name;
  if (!effectName) AECreateBridge.fail('addEffect requires matchName or name.');
  var effect = effects.addProperty(effectName);
  if (!effect) AECreateBridge.fail('Unable to add effect: ' + effectName);
};

AECreateActions.applyPreset = function (layer, action) {
  if (!action.path) AECreateBridge.fail('applyPreset requires path.');
  var preset = new File(action.path);
  if (!preset.exists) AECreateBridge.fail('Preset not found: ' + preset.fsName);
  layer.applyPreset(preset);
};

AECreateActions.setProperty = function (context, layer, action) {
  AECreateActions.requirePropertyPath(action);
  if (!AECreateActions.hasField(action, 'value') && !AECreateActions.isNonEmptyString(action.valueLayerRef)) {
    AECreateBridge.fail('setProperty requires value or valueLayerRef.');
  }
  var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
  var value = action.value;
  if (AECreateActions.isNonEmptyString(action.valueLayerRef)) {
    var refLayer = AECreateActions.resolveLayerRef(context, action.valueLayerRef);
    value = refLayer.index;
  }
  prop.setValue(value);
};

AECreateActions.setKeyframes = function (layer, action) {
  AECreateActions.requirePropertyPath(action);
  var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
  if (!(action.keys instanceof Array) || action.keys.length === 0) AECreateBridge.fail('setKeyframes requires non-empty keys array.');
  for (var k = 0; k < action.keys.length; k++) {
    if (!action.keys[k] || typeof action.keys[k] !== 'object' || action.keys[k] instanceof Array) AECreateBridge.fail('setKeyframes key ' + k + ' must be an object.');
    if (typeof action.keys[k].time !== 'number') AECreateBridge.fail('setKeyframes key ' + k + '.time must be a number.');
    if (!AECreateActions.hasField(action.keys[k], 'value')) AECreateBridge.fail('setKeyframes key ' + k + ' requires value.');
    prop.setValueAtTime(action.keys[k].time, action.keys[k].value);
  }
};

AECreateActions.setExpression = function (layer, action) {
  AECreateActions.requirePropertyPath(action);
  if (typeof action.expression !== 'string') AECreateBridge.fail('setExpression requires expression string.');
  var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
  prop.expression = action.expression;
  prop.expressionEnabled = true;
};

AECreateActions.applyModifyEffect = function (context, layer, action) {
  if (action.keys instanceof Array) {
    AECreateActions.setKeyframes(layer, action);
    return;
  }
  AECreateActions.setProperty(context, layer, action);
};

AECreateActions.findEffectProperty = function (layer, effectMatchName, propertyPath) {
  if (!effectMatchName) AECreateBridge.fail('Effect matchName is required.');
  if (!(propertyPath instanceof Array) || propertyPath.length === 0) AECreateBridge.fail('propertyPath must be a non-empty array.');

  var prop = null;
  if (effectMatchName === 'ADBE Transform Group') {
    prop = layer.property('ADBE Transform Group');
    if (!prop) AECreateBridge.fail('Transform group not found.');
  } else {
    var effects = layer.property('ADBE Effect Parade');
    if (!effects) AECreateBridge.fail('Layer does not support effects.');

    for (var i = 1; i <= effects.numProperties; i++) {
      var candidate = effects.property(i);
      if (candidate.matchName === effectMatchName || candidate.name === effectMatchName) {
        prop = candidate;
        break;
      }
    }
    if (!prop) throw new Error('Effect not found: ' + effectMatchName);
  }

  for (var p = 0; p < propertyPath.length; p++) {
    prop = prop.property(propertyPath[p]);
    if (!prop) throw new Error('Property not found: ' + propertyPath.join(' > '));
  }
  return prop;
};

AECreateActions.writeHistory = function (plan) {
  var folder = AECreateBridge.ensureFolder(new Folder(AECreateBridge.bridgeFolder().fsName + '/history'), 'history folder');
  var name = 'plan-' + new Date().getTime() + '.json';
  AECreateBridge.writeText(new File(folder.fsName + '/' + name), AECreateJSON.stringify(plan));
};

AECreateBridge.saveFavorite = function () {
  try {
    var file = AECreateActions.pendingFile();
    if (!file.exists) return AECreateBridge.respond({ ok: false, error: 'No pending action to save.' });
    var plan = AECreateJSON.parse(AECreateBridge.readText(file));
    var folder = AECreateBridge.ensureFolder(new Folder(AECreateBridge.bridgeFolder().fsName + '/favorites'), 'favorites folder');
    var title = plan.title || 'pending-action';
    var safeTitle = title.replace(/[\\\/:*?"<>|]/g, '_');
    AECreateBridge.writeText(new File(folder.fsName + '/' + safeTitle + '.json'), AECreateJSON.stringify(plan));
    return AECreateBridge.respond({ ok: true, message: 'Saved favorite: ' + title });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.openLogs = function () {
  try {
    var folder = AECreateBridge.ensureFolder(new Folder(AECreateBridge.bridgeFolder().fsName + '/logs'), 'logs folder');
    if (!folder.execute()) AECreateBridge.fail('Unable to open logs folder: ' + folder.fsName + AECreateBridge.errorSuffix(folder));
    return AECreateBridge.respond({ ok: true, message: 'Opened logs.' });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};
