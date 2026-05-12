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

AECreateActions.checkedMap = function (payload) {
  var map = {};
  if (!payload || !(payload.checked instanceof Array)) return map;
  for (var i = 0; i < payload.checked.length; i++) {
    if (payload.checked[i]) map[payload.checked[i].index] = payload.checked[i].checked;
  }
  return map;
};

AECreateActions.moduleIsChecked = function (module, checkedMap, index) {
  if (checkedMap[index] === false) return false;
  if (checkedMap[index] === true) return true;
  return !module || module.checked !== false;
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
    if (!pending.target || !pending.target.layerIndex) return AECreateBridge.respond({ ok: false, error: 'Pending action target layerIndex is missing.' });

    var layer = comp.layer(pending.target.layerIndex);
    if (!layer) return AECreateBridge.respond({ ok: false, error: 'Target layer not found.' });

    var applied = [];
    app.beginUndoGroup('AEcreate Apply Checked Modules');
    undoOpen = true;
    for (var m = 0; m < pending.modules.length; m++) {
      if (!AECreateActions.moduleIsChecked(pending.modules[m], checkedMap, m)) continue;
      AECreateActions.applyModule(layer, pending.modules[m]);
      applied.push(pending.modules[m].title || ('Module ' + (m + 1)));
    }
    app.endUndoGroup();
    undoOpen = false;

    AECreateActions.log('Applied: ' + applied.join(', '));
    AECreateActions.writeHistory(pending);
    return AECreateBridge.respond({ ok: true, message: 'Applied modules: ' + applied.join(', ') });
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

AECreateActions.applyModule = function (layer, module) {
  if (!module || !(module.actions instanceof Array)) AECreateBridge.fail('Module actions must be an array.');
  for (var i = 0; i < module.actions.length; i++) {
    AECreateActions.applyAction(layer, module.actions[i]);
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
  var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
  prop.setValue(action.value);
};

AECreateActions.setKeyframes = function (layer, action) {
  var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
  if (!(action.keys instanceof Array)) AECreateBridge.fail('setKeyframes requires keys array.');
  for (var k = 0; k < action.keys.length; k++) {
    if (!action.keys[k]) AECreateBridge.fail('Keyframe entry is missing.');
    prop.setValueAtTime(action.keys[k].time, action.keys[k].value);
  }
};

AECreateActions.setExpression = function (layer, action) {
  var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
  prop.expression = action.expression || '';
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

  var effects = layer.property('ADBE Effect Parade');
  if (!effects) AECreateBridge.fail('Layer does not support effects.');

  var effect = null;
  for (var i = 1; i <= effects.numProperties; i++) {
    var candidate = effects.property(i);
    if (candidate.matchName === effectMatchName || candidate.name === effectMatchName) {
      effect = candidate;
      break;
    }
  }
  if (!effect) throw new Error('Effect not found: ' + effectMatchName);

  var prop = effect;
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
