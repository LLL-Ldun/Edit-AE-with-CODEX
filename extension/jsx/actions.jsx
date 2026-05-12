var AECreateActions = AECreateActions || {};

AECreateActions.pendingFile = function () {
  return new File(AECreateBridge.bridgeFolder().fsName + '/pending-action.json');
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

AECreateActions.validateTargetLayerIndex = function (pending, comp) {
  if (!pending.target || !AECreateActions.isPositiveInteger(pending.target.layerIndex)) {
    return { ok: false, error: 'Pending action target layerIndex must be a positive integer. Requested index: ' + (pending.target ? pending.target.layerIndex : 'missing') + ', comp.numLayers: ' + comp.numLayers + '.' };
  }
  if (pending.target.layerIndex > comp.numLayers) {
    return { ok: false, error: 'Pending action target layerIndex is out of range. Requested index: ' + pending.target.layerIndex + ', comp.numLayers: ' + comp.numLayers + '.' };
  }
  return { ok: true };
};

AECreateBridge.readPendingAction = function () {
  try {
    return AECreateBridge.respond({ ok: true, plan: AECreateActions.readPendingPlan() });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: 'Could not read pending-action.json: ' + String(error) });
  }
};

AECreateBridge.discardPendingAction = function () {
  try {
    var file = AECreateActions.pendingFile();
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
    var pending = AECreateActions.readPendingPlan();
    if (!pending.modules || !(pending.modules instanceof Array)) AECreateBridge.fail('Pending action modules must be an array.');

    var checkedMap = AECreateActions.checkedMap(payload);
    var comp = AECreateContext.activeComp();
    if (!comp) return AECreateBridge.respond({ ok: false, error: 'No active composition.' });
    var targetCheck = AECreateActions.validateTargetLayerIndex(pending, comp);
    if (!targetCheck.ok) return AECreateBridge.respond(targetCheck);

    var layer = comp.layer(pending.target.layerIndex);
    if (!layer) return AECreateBridge.respond({ ok: false, error: 'Target layer not found.' });

    var applied = [];
    app.beginUndoGroup('AEcreate Apply Checked Modules');
    undoOpen = true;
    for (var m = 0; m < pending.modules.length; m++) {
      if (!AECreateActions.moduleIsChecked(pending.modules[m], checkedMap, m)) continue;
      AECreateActions.applyModule(layer, pending.modules[m], m);
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

AECreateActions.applyModule = function (layer, module, moduleIndex) {
  if (!module || !(module.actions instanceof Array)) AECreateBridge.fail('module ' + (module && module.title ? module.title : ('Module ' + (moduleIndex + 1))) + ' actions must be an array.');
  for (var i = 0; i < module.actions.length; i++) {
    try {
      AECreateActions.applyAction(layer, module.actions[i]);
    } catch (error) {
      throw new Error(AECreateActions.actionContext(module, moduleIndex, i) + ': ' + String(error));
    }
  }
};

AECreateActions.applyAction = function (layer, action) {
  if (!action || !action.type) AECreateBridge.fail('Action type is required.');
  if (action.type === 'addEffect') {
    AECreateActions.addEffect(layer, action);
    return;
  }
  if (action.type === 'applyPreset') {
    AECreateActions.applyPreset(layer, action);
    return;
  }
  if (action.type === 'setProperty') {
    AECreateActions.setProperty(layer, action);
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
    AECreateActions.applyModifyEffect(layer, action);
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

AECreateActions.setProperty = function (layer, action) {
  AECreateActions.requirePropertyPath(action);
  if (!AECreateActions.hasField(action, 'value')) AECreateBridge.fail('setProperty requires value.');
  var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
  prop.setValue(action.value);
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

AECreateActions.applyModifyEffect = function (layer, action) {
  if (action.keys instanceof Array) {
    AECreateActions.setKeyframes(layer, action);
    return;
  }
  AECreateActions.setProperty(layer, action);
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
