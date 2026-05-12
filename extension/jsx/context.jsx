var AECreateContext = AECreateContext || {};

AECreateContext.activeComp = function () {
  if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) return null;
  return app.project.activeItem;
};

AECreateContext.safeValue = function (value, depth) {
  if (depth > 3) return String(value);
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
  if (value instanceof Array) {
    var array = [];
    for (var i = 0; i < value.length; i++) array.push(AECreateContext.safeValue(value[i], depth + 1));
    return array;
  }

  var commonFields = ['x', 'y', 'z', 'width', 'height', 'left', 'top', 'red', 'green', 'blue', 'alpha'];
  var output = {};
  var hasFields = false;
  for (var j = 0; j < commonFields.length; j++) {
    try {
      var field = commonFields[j];
      if (value[field] !== undefined) {
        output[field] = AECreateContext.safeValue(value[field], depth + 1);
        hasFields = true;
      }
    } catch (fieldError) {}
  }
  if (hasFields) return output;

  try {
    if (value.text !== undefined) return { text: String(value.text) };
  } catch (textError) {}

  return String(value);
};

AECreateContext.markerList = function (markerProperty) {
  var output = [];
  if (!markerProperty) return output;
  var keyCount = 0;
  try {
    keyCount = markerProperty.numKeys;
  } catch (error) {
    output.push({ error: String(error) });
    return output;
  }
  for (var i = 1; i <= keyCount; i++) {
    try {
      var value = markerProperty.keyValue(i);
      var record = { index: i };
      try {
        record.time = markerProperty.keyTime(i);
        record.comment = value.comment;
        record.chapter = value.chapter;
        record.cuePointName = value.cuePointName;
      } catch (fieldError) {
        record.error = String(fieldError);
      }
      output.push(record);
    } catch (keyError) {
      output.push({ index: i, error: String(keyError) });
    }
  }
  return output;
};

AECreateContext.propertyValue = function (property) {
  try {
    var keyCount = property.numKeys && property.numKeys > 0 ? property.numKeys : 0;
    return {
      value: AECreateContext.safeValue(property.value, 0),
      keyCount: keyCount
    };
  } catch (error) {
    return { value: null, keyCount: 0, error: String(error) };
  }
};

AECreateContext.propertyTree = function (group, depth) {
  var output = [];
  if (!group || depth > 4) return output;
  var propertyCount = 0;
  try {
    propertyCount = group.numProperties;
  } catch (error) {
    output.push({ error: String(error) });
    return output;
  }
  for (var i = 1; i <= propertyCount; i++) {
    try {
      var prop = group.property(i);
      var record = { index: i };
      try {
        record.name = prop.name;
        record.matchName = prop.matchName;
        record.propertyType = prop.propertyType;
      } catch (fieldError) {
        record.error = String(fieldError);
        output.push(record);
        continue;
      }
      if (record.propertyType === PropertyType.PROPERTY) {
        var state = AECreateContext.propertyValue(prop);
        record.value = state.value;
        record.keyCount = state.keyCount;
        if (state.error) record.error = state.error;
        try {
          if (prop.expressionEnabled) record.expression = prop.expression;
        } catch (expressionError) {
          record.expressionError = String(expressionError);
        }
      } else {
        try {
          record.children = AECreateContext.propertyTree(prop, depth + 1);
        } catch (childError) {
          record.children = [];
          record.error = String(childError);
        }
      }
      output.push(record);
    } catch (propertyError) {
      output.push({ index: i, error: String(propertyError) });
    }
  }
  return output;
};

AECreateContext.layerRecord = function (layer) {
  var effects = layer.property('ADBE Effect Parade');
  return {
    index: layer.index,
    name: layer.name,
    inPoint: layer.inPoint,
    outPoint: layer.outPoint,
    startTime: layer.startTime,
    selected: layer.selected,
    markers: AECreateContext.markerList(layer.property('Marker')),
    effects: AECreateContext.propertyTree(effects, 0)
  };
};

AECreateContext.export = function () {
  var comp = AECreateContext.activeComp();
  if (!comp) return { ok: false, error: 'No active composition.' };
  var selected = [];
  for (var i = 0; i < comp.selectedLayers.length; i++) {
    selected.push(AECreateContext.layerRecord(comp.selectedLayers[i]));
  }
  var context = {
    schemaVersion: 1,
    exportedAt: new Date().toString(),
    projectPath: app.project.file ? app.project.file.fsName : '',
    activeComp: {
      name: comp.name,
      width: comp.width,
      height: comp.height,
      frameRate: comp.frameRate,
      duration: comp.duration,
      time: comp.time
    },
    selectedLayers: selected,
    compMarkers: AECreateContext.markerList(comp.markerProperty),
    availableEffects: [],
    presetCachePath: 'preset-cache.json',
    panelSettings: AECreateBridge.settings()
  };
  return { ok: true, context: context };
};

AECreateContext.collectPresets = function (folder, records, state, depth) {
  if (!folder) return;
  try {
    if (!folder.exists) return;
  } catch (existsError) {
    state.errors.push({ path: String(folder), error: String(existsError) });
    return;
  }
  if (state.truncated) return;
  if (depth > state.maxDepth) {
    state.truncated = true;
    state.errors.push({ path: folder.fsName, error: 'Preset scan max depth exceeded.' });
    return;
  }
  var key = String(folder.fsName).toLowerCase();
  if (state.seen[key]) return;
  state.seen[key] = true;

  var items = [];
  try {
    items = folder.getFiles();
  } catch (error) {
    state.errors.push({ path: folder.fsName, error: String(error) });
    return;
  }
  for (var i = 0; i < items.length; i++) {
    if (state.truncated) return;
    try {
      if (items[i] instanceof Folder) {
        AECreateContext.collectPresets(items[i], records, state, depth + 1);
      } else if (/\.ffx$/i.test(items[i].name)) {
        if (records.length >= state.maxRecords) {
          state.truncated = true;
          return;
        }
        records.push({
          name: items[i].displayName,
          path: items[i].fsName,
          modified: items[i].modified.toString()
        });
      }
    } catch (itemError) {
      state.errors.push({ path: String(items[i]), error: String(itemError) });
    }
  }
};

AECreateBridge.exportContext = function () {
  try {
    var result = AECreateContext.export();
    if (!result.ok) return AECreateBridge.respond(result);
    var folder = AECreateBridge.bridgeFolder();
    AECreateBridge.writeText(new File(folder.fsName + '/current-context.json'), AECreateJSON.stringify(result.context));
    var markers = [];
    if (result.context.selectedLayers.length) {
      var layerMarkers = result.context.selectedLayers[0].markers;
      for (var i = 0; i < layerMarkers.length; i++) markers.push(layerMarkers[i].time + ' - ' + layerMarkers[i].comment);
    }
    return AECreateBridge.respond({
      ok: true,
      message: 'Exported context to ' + folder.fsName,
      markersText: markers.length ? markers.join('\n') : 'No selected-layer markers.'
    });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.addMarker = function (payloadText) {
  try {
    var payload = AECreateJSON.parse(payloadText || '{}');
    var comp = AECreateContext.activeComp();
    if (!comp) return AECreateBridge.respond({ ok: false, error: 'No active composition.' });
    var value = new MarkerValue(payload.name || 'effect_anchor');
    app.beginUndoGroup('AEcreate Add Marker');
    if (payload.target === 'comp' || comp.selectedLayers.length === 0) {
      comp.markerProperty.setValueAtTime(comp.time, value);
    } else {
      comp.selectedLayers[0].property('Marker').setValueAtTime(comp.time, value);
    }
    app.endUndoGroup();
    return AECreateBridge.respond({ ok: true, message: 'Marker added.' });
  } catch (error) {
    try {
      app.endUndoGroup();
    } catch (undoError) {}
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.scanPresets = function () {
  try {
    var settings = AECreateBridge.settings();
    var paths = settings.presetPaths.slice(0);
    paths.push(Folder.userData.fsName + '/Adobe/After Effects');
    var appPresets = new Folder(app.path.fsName + '/Presets');
    if (appPresets.exists) paths.push(appPresets.fsName);
    var records = [];
    var state = {
      seen: {},
      errors: [],
      truncated: false,
      maxDepth: 8,
      maxRecords: 5000
    };
    for (var i = 0; i < paths.length; i++) {
      if (paths[i]) AECreateContext.collectPresets(new Folder(paths[i]), records, state, 0);
      if (state.truncated) break;
    }
    var folder = AECreateBridge.bridgeFolder();
    AECreateBridge.writeText(new File(folder.fsName + '/preset-cache.json'), AECreateJSON.stringify({
      schemaVersion: 1,
      scannedAt: new Date().toString(),
      errors: state.errors,
      truncated: state.truncated,
      presets: records
    }));
    var message = 'Scanned ' + records.length + ' presets.';
    if (state.truncated) message += ' Scan truncated.';
    return AECreateBridge.respond({ ok: true, message: message });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};
