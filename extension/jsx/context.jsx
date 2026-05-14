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

AECreateContext.isVolatileFingerprintField = function (key) {
  return key === 'exportedAt' || key === 'panelSettings' || key === 'contextFingerprint';
};

AECreateContext.stableStringify = function (value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return AECreateJSON.stringify(value);
  if (value instanceof Array) {
    var items = [];
    for (var i = 0; i < value.length; i++) items.push(AECreateContext.stableStringify(value[i]));
    return '[' + items.join(',') + ']';
  }

  var keys = [];
  for (var key in value) {
    if (value.hasOwnProperty(key) && !AECreateContext.isVolatileFingerprintField(key)) keys.push(key);
  }
  keys.sort();

  var props = [];
  for (var j = 0; j < keys.length; j++) {
    props.push(AECreateJSON.stringify(keys[j]) + ':' + AECreateContext.stableStringify(value[keys[j]]));
  }
  return '{' + props.join(',') + '}';
};

AECreateContext.hashString = function (text) {
  var hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash = hash >>> 0;
  }
  var output = hash.toString(16);
  while (output.length < 8) output = '0' + output;
  return 'fnv1a32:' + output;
};

AECreateContext.fingerprintContext = function (context) {
  return AECreateContext.hashString(AECreateContext.stableStringify(context));
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

AECreateContext.sourceRecord = function (source) {
  if (!source) return null;
  var record = {};
  try {
    if (source.name !== undefined) record.name = source.name;
  } catch (nameError) {}
  try {
    if (source.duration !== undefined) record.duration = source.duration;
  } catch (durationError) {}
  try {
    if (source.file && source.file.fsName) record.path = source.file.fsName;
  } catch (fileError) {}
  return record.name || record.duration !== undefined || record.path ? record : null;
};

AECreateContext.layerRecord = function (layer) {
  var effects = layer.property('ADBE Effect Parade');
  var transform = layer.property('ADBE Transform Group');
  var source = null;
  try {
    source = AECreateContext.sourceRecord(layer.source);
  } catch (sourceError) {
    source = { error: String(sourceError) };
  }
  return {
    index: layer.index,
    name: layer.name,
    inPoint: layer.inPoint,
    outPoint: layer.outPoint,
    startTime: layer.startTime,
    selected: layer.selected,
    source: source,
    markers: AECreateContext.markerList(layer.property('Marker')),
    transform: AECreateContext.propertyTree(transform, 0),
    effects: AECreateContext.propertyTree(effects, 0)
  };
};

AECreateContext.availableEffectsList = function () {
  var effects = [];
  var source = null;
  try {
    source = app.effects;
  } catch (error) {
    return effects;
  }
  if (!source || typeof source.length !== 'number') return effects;
  for (var i = 0; i < source.length; i++) {
    try {
      var effect = source[i];
      if (!effect) continue;
      effects.push({
        name: effect.displayName || effect.name || '',
        matchName: effect.matchName || '',
        category: effect.category || ''
      });
    } catch (effectError) {}
  }
  return effects;
};

AECreateContext.effectScanFileName = function (matchName) {
  var source = String(matchName || 'effect');
  var safe = source.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe) safe = 'effect';
  return safe + '-' + AECreateContext.hashString(source).replace(':', '-') + '.json';
};

AECreateContext.normalizeEffectIdentity = function (value) {
  return String(value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
};

AECreateContext.effectIdentityMatches = function (a, b) {
  var left = AECreateContext.normalizeEffectIdentity(a);
  var right = AECreateContext.normalizeEffectIdentity(b);
  return left && right && left === right;
};

AECreateContext.effectScanMatchesEffect = function (scan, effectInfo) {
  if (!scan || !scan.effect || !effectInfo) return false;
  return AECreateContext.effectIdentityMatches(scan.effect.matchName, effectInfo.matchName) ||
    AECreateContext.effectIdentityMatches(scan.effect.name, effectInfo.name) ||
    AECreateContext.effectIdentityMatches(scan.effect.matchName, effectInfo.name) ||
    AECreateContext.effectIdentityMatches(scan.effect.name, effectInfo.matchName);
};

AECreateContext.findEffectInfo = function (query) {
  var needle = String(query || '').replace(/^\s+|\s+$/g, '').toLowerCase();
  if (!needle) return null;
  var effects = AECreateContext.availableEffectsList();
  var partial = null;
  for (var i = 0; i < effects.length; i++) {
    var name = String(effects[i].name || '').toLowerCase();
    var matchName = String(effects[i].matchName || '').toLowerCase();
    if (name === needle || matchName === needle) return effects[i];
    if (!partial && (name.indexOf(needle) !== -1 || matchName.indexOf(needle) !== -1)) partial = effects[i];
  }
  return partial;
};

AECreateContext.effectScanOptions = function (options) {
  options = options || {};
  return {
    maxDepth: options.maxDepth > 0 ? options.maxDepth : 8,
    maxRecords: options.maxRecords > 0 ? options.maxRecords : 12000,
    includePluginFiles: options.includePluginFiles !== false,
    visibleOnly: options.visibleOnly !== false,
    maxPluginFileDepth: options.maxPluginFileDepth > 0 ? options.maxPluginFileDepth : 6,
    maxPluginFileRecords: options.maxPluginFileRecords > 0 ? options.maxPluginFileRecords : 40,
    errors: [],
    count: 0,
    truncated: false
  };
};

AECreateContext.safeReadNumberFlag = function (record, prop, flagName, valueName, outputFlag, outputValue) {
  try {
    if (prop[flagName] === true) {
      record[outputFlag] = true;
      record[outputValue] = prop[valueName];
    }
  } catch (error) {}
};

AECreateContext.isVisibleScanProperty = function (prop, name) {
  try {
    if (prop.elided === true) return false;
  } catch (elidedError) {}
  try {
    if (prop.enabled === false) return false;
  } catch (enabledError) {}
  return !!name;
};

AECreateContext.effectParameterTree = function (group, options, depth, path, matchPath) {
  var output = [];
  options = options || AECreateContext.effectScanOptions({});
  depth = depth || 0;
  path = path || [];
  matchPath = matchPath || [];
  if (!group || depth > options.maxDepth) return output;

  var propertyCount = 0;
  try {
    propertyCount = group.numProperties;
  } catch (countError) {
    options.errors.push(String(countError));
    return output;
  }

  for (var i = 1; i <= propertyCount; i++) {
    if (options.count >= options.maxRecords) {
      options.truncated = true;
      break;
    }
    try {
      var prop = group.property(i);
      var name = '';
      var matchName = '';
      var propertyType = null;
      try {
        name = prop.name || '';
        matchName = prop.matchName || '';
      } catch (nameError) {}
      try {
        propertyType = prop.propertyType;
      } catch (typeError) {}

      if (options.visibleOnly && !AECreateContext.isVisibleScanProperty(prop, name)) continue;
      options.count++;

      var record = {
        index: i,
        name: name,
        matchName: matchName,
        propertyType: propertyType
      };
      try {
        if (prop.propertyValueType !== undefined) record.propertyValueType = prop.propertyValueType;
      } catch (valueTypeError) {}
      try {
        if (prop.canSetExpression !== undefined) record.canSetExpression = prop.canSetExpression === true;
      } catch (expressionFlagError) {}
      try {
        if (prop.canVaryOverTime !== undefined) record.canVaryOverTime = prop.canVaryOverTime === true;
      } catch (varyError) {}
      try {
        if (prop.isTimeVarying !== undefined) record.isTimeVarying = prop.isTimeVarying === true;
      } catch (timeVaryingError) {}
      AECreateContext.safeReadNumberFlag(record, prop, 'hasMin', 'minValue', 'hasMin', 'minValue');
      AECreateContext.safeReadNumberFlag(record, prop, 'hasMax', 'maxValue', 'hasMax', 'maxValue');
      try {
        if (prop.unitsText) record.unitsText = prop.unitsText;
      } catch (unitsError) {}

      var pathName = name || matchName || String(i);
      var pathMatchName = matchName || name || String(i);
      record.path = path.concat([pathName]);
      record.matchPath = matchPath.concat([pathMatchName]);

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
        record.children = AECreateContext.effectParameterTree(prop, options, depth + 1, record.path, record.matchPath);
      }
      output.push(record);
    } catch (propertyError) {
      output.push({ index: i, error: String(propertyError), path: path.concat([String(i)]), matchPath: matchPath.concat([String(i)]) });
    }
  }
  return output;
};

AECreateContext.effectIdentityTokens = function (effectInfo) {
  var text = [
    effectInfo && effectInfo.name,
    effectInfo && effectInfo.matchName,
    effectInfo && effectInfo.category
  ].join(' ').toLowerCase();
  var raw = text.split(/[^a-z0-9]+/);
  var blocked = {
    a: true,
    ae: true,
    adbe: true,
    and: true,
    cc: true,
    effect: true,
    effects: true,
    fx: true,
    plugin: true,
    plugins: true,
    rg: true,
    the: true,
    tc: true
  };
  var tokens = [];
  for (var i = 0; i < raw.length; i++) {
    var token = raw[i];
    if (!token || token.length < 3 || blocked[token]) continue;
    var seen = false;
    for (var j = 0; j < tokens.length; j++) {
      if (tokens[j] === token) {
        seen = true;
        break;
      }
    }
    if (!seen) tokens.push(token);
  }
  return tokens;
};

AECreateContext.supportedActionTypes = [
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

AECreateContext.effectWorkflowLibrary = function () {
  return [{
    id: 'saber-path-glow',
    label: 'Saber Path Glow',
    matchTokens: ['saber', 'video copilot saber'],
    categoryTokens: ['video copilot', 'stylize', 'generate'],
    layerStrategy: 'solidCarrier',
    effectPlacement: 'carrierLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 1,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'different masks or paths need independent timing',
        'the glow body and secondary accent require incompatible blend or mask scopes'
      ]
    },
    carrierLayer: {
      type: 'solid',
      color: [0, 0, 0],
      blendModes: ['ADD', 'SCREEN'],
      timing: 'marker-span'
    },
    helperLayers: [],
    parameterGroups: ['path-or-mask-source', 'core-glow', 'start-end-offset', 'flicker', 'distortion', 'composite-blend'],
    recommendedActionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    notes: [
      'Apply Saber to one solid carrier and drive it from masks or text/path sources.',
      'Animate start/end offset, glow intensity, flicker, and distortion around the marker instead of adding multiple similar Saber layers by default.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'optical-flares-hit-feedback',
    label: 'Optical Flares Hit Feedback',
    matchTokens: ['optical flares', 'opticalflares', 'lens flare', 'flare'],
    categoryTokens: ['video copilot', 'light', 'generate'],
    layerStrategy: 'solidCarrier',
    effectPlacement: 'carrierLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 1,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'different flare sources need independent timing',
        'tracked 3D or null control is required'
      ]
    },
    carrierLayer: {
      type: 'solid',
      color: [0, 0, 0],
      blendModes: ['ADD', 'SCREEN'],
      timing: 'marker-span'
    },
    helperLayers: [{
      type: 'null',
      purpose: 'optional flare position or tracking control',
      optional: true
    }],
    parameterGroups: ['flare-position', 'brightness', 'scale', 'flicker', 'occlusion-or-mask', 'composite-blend'],
    recommendedActionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    notes: [
      'Use one additive solid carrier for lens flare hits and keyframe brightness/scale over a short marker span.',
      'Use a null or tracking helper only when the flare must follow a moving source.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'ripple-dissolve-adjustment',
    label: 'Ripple Dissolve Adjustment',
    matchTokens: ['ripple dissolve', 'bcc ripple dissolve', 'ripple', 'dissolve'],
    categoryTokens: ['boris', 'bcc', 'transition', 'distort'],
    layerStrategy: 'adjustmentLayer',
    effectPlacement: 'adjustmentLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 1,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'incoming and outgoing shots need different masks',
        'two incompatible transition plugins must be isolated'
      ]
    },
    carrierLayer: {
      type: 'adjustment',
      timing: 'transition-span'
    },
    helperLayers: [],
    parameterGroups: ['dissolve-progress', 'ripple-height', 'wave-speed', 'edge-softness', 'mix-with-original'],
    recommendedActionTypes: ['addAdjustmentLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    notes: [
      'Use a trimmed adjustment layer for ripple/dissolve transitions unless the plugin specifically requires source layers.',
      'Expose progress, ripple amount, edge softness, and timing to the pending parameter preview.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'depth-map-source-preprocess',
    label: 'Depth Map Source Preprocess',
    matchTokens: ['depth map', 'depthmap', 'depth scanner', 'depth matte', 'depth blur'],
    categoryTokens: ['depth', 'ai', 'blur'],
    layerStrategy: 'sourceLayer',
    effectPlacement: 'sourceLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 0,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'the depth map must be preserved as a separate matte source',
        'the user explicitly asks for separate layer control',
        'a downstream smoke, blur, or displacement effect needs an isolated depth reference'
      ]
    },
    carrierLayer: null,
    helperLayers: [],
    parameterGroups: ['depth-map-output', 'depth-focus', 'foreground-background-separation', 'matte-softness'],
    recommendedActionTypes: ['duplicateLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    notes: [
      'Prefer applying depth-map extraction to the source or a duplicate source layer.',
      'Use a duplicate only when downstream effects need an isolated matte or when the original footage must remain untouched.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'matte-key-source-preprocess',
    label: 'Matte Key Source Preprocess',
    matchTokens: ['two way key', 'linear color key', 'color key', 'keylight', 'color range', 'matte key'],
    categoryTokens: ['key', 'matte', 'boris', 'bcc'],
    layerStrategy: 'sourceLayer',
    effectPlacement: 'sourceLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 0,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'the keyed result must feed another layer or plugin',
        'the original source must remain visually untouched',
        'the user explicitly asks for separate matte control'
      ]
    },
    carrierLayer: null,
    helperLayers: [],
    parameterGroups: ['matte-isolation', 'sample-color', 'tolerance', 'softness', 'spill-cleanup', 'alpha-output'],
    recommendedActionTypes: ['duplicateLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    notes: [
      'Use keying effects as source or matte preprocessors, not as final visual effects by themselves when the user asks for edge-driven particles or composites.',
      'Keep sampled color, tolerance, softness, and matte cleanup editable.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'path-stroke-carrier',
    label: 'Path Stroke Carrier',
    matchTokens: ['3d stroke', 'stroke', 'trapcode stroke', 'write on'],
    categoryTokens: ['trapcode', 'generate', 'stylize'],
    layerStrategy: 'solidCarrier',
    effectPlacement: 'carrierLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 1,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'separate paths need incompatible timing or colors',
        'the stroke must be tracked by a helper path or null'
      ]
    },
    carrierLayer: {
      type: 'solid',
      color: [0, 0, 0],
      blendModes: ['ADD', 'SCREEN'],
      timing: 'marker-span'
    },
    helperLayers: [{
      type: 'null',
      purpose: 'optional path or tracking control',
      optional: true
    }],
    parameterGroups: ['path-stroke', 'stroke-width', 'taper', 'start-end-offset', 'color', 'glow-composite'],
    recommendedActionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    notes: [
      'Use one solid carrier for mask/path driven stroke effects.',
      'Animate start/end and width around the marker; add tracking helpers only when the source motion requires them.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'particle-solid-carrier',
    label: 'Particle Solid Carrier',
    matchTokens: ['particular', 'particle', 'particles', 'stardust', 'form', 'plexus'],
    categoryTokens: ['particle', 'particles', '3d'],
    layerStrategy: 'solidCarrier',
    effectPlacement: 'carrierLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 1,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'different timing, mask, blend mode, or compositing scope is required',
        'the plugin cannot express the requested look in one effect instance'
      ]
    },
    carrierLayer: {
      type: 'solid',
      color: [0, 0, 0],
      blendModes: ['ADD', 'SCREEN'],
      timing: 'marker-span'
    },
    helperLayers: [{
      type: 'light',
      purpose: 'emitter-or-light-control',
      optional: true
    }, {
      type: 'null',
      purpose: 'position-or-expression-control',
      optional: true
    }],
    parameterGroups: ['emitter-position', 'particle-rate', 'particle-life', 'particle-size', 'velocity', 'turbulence', 'color-over-life', 'aux-system-or-trails', 'glow-composite'],
    recommendedActionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    notes: [
      'Create one carrier solid above footage and apply the particle/generator effect to that carrier.',
      'Use ADD or SCREEN when the effect should overlay the original video.',
      'Do not split one visual idea into several similar particle carrier layers by default; combine body, trail, glow, and spark accents into the fewest effect instances the plugin can support.',
      'Use light/null helpers only when the user asks for explicit helper control or the plugin workflow requires them.',
      'If the visual goal says particles should come from an existing color, edge, matte, blade edge, UI glow, or keyed region, consult the visual workflow library before generating actions; do not skip the keyed source/matte preparation step.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'adjustment-impact-layer',
    label: 'Adjustment Impact Layer',
    matchTokens: ['twitch', 'deep', 'glow', 'rsmb', 'motionblur', 'motion', 'blur', 'shake', 'sapphire', 'bcc', 'pixel', 'sorter', 'looks', 'colorista'],
    categoryTokens: ['blur', 'stylize', 'distort', 'color', 'video copilot', 'sapphire', 'boris', 'red giant'],
    layerStrategy: 'adjustmentLayer',
    effectPlacement: 'adjustmentLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 1,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'different timing, mask, blend mode, or compositing scope is required',
        'stacking is required to separate incompatible plugin operations'
      ]
    },
    carrierLayer: {
      type: 'adjustment',
      timing: 'marker-span'
    },
    helperLayers: [],
    parameterGroups: ['impact-time', 'amount', 'decay', 'blur', 'glow', 'color', 'shake'],
    recommendedActionTypes: ['addAdjustmentLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    notes: [
      'Create a trimmed adjustment layer above the footage for non-destructive impact, glow, blur, shake, color, or glitch effects.',
      'Keep the original footage layer unchanged unless the user asks for source-layer treatment.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }, {
    id: 'source-retime-layer',
    label: 'Source Retime Layer',
    matchTokens: ['twixtor', 'timewarp', 'time', 'retime', 'retimer', 'remap'],
    categoryTokens: ['revision', 'time'],
    layerStrategy: 'sourceLayer',
    effectPlacement: 'sourceLayer',
    destructiveRisk: 'retimes-source-layer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 0,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'the retime needs a duplicate or precomp to remain reversible',
        'different timing sections need independent source treatment'
      ]
    },
    carrierLayer: null,
    helperLayers: [],
    parameterGroups: ['retime-speed', 'frame-interpolation', 'motion-vector-quality', 'source-frame-rate'],
    recommendedActionTypes: ['addEffect', 'setProperty', 'setKeyframes', 'setExpression'],
    notes: [
      'Apply retime effects to the footage/precomp layer being retimed.',
      'Prefer duplicating or precomping source footage when the edit should remain reversible.',
      'Do not default to adjustment layers for source timing effects.'
    ],
    onlineResearch: {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  }];
};

AECreateContext.visualWorkflowLibrary = function () {
  function minimumLayerPolicy(defaultLayerCount, splitLayersOnlyWhen) {
    return {
      priority: 'minimum-layers-first',
      defaultLayerCount: defaultLayerCount,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: splitLayersOnlyWhen || [
        'user explicitly asks for separate layer control',
        'different timing, mask, blend mode, or compositing scope is required',
        'the plugin cannot express the requested look in one effect instance'
      ]
    };
  }

  function optionalResearch() {
    return {
      status: 'optional',
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    };
  }

  return [{
    id: 'color-keyed-edge-particles',
    label: 'Color-Keyed Edge Particles',
    matchTokens: [
      'edge color',
      'blade edge',
      'knife edge',
      'color keyed particles',
      'color selected particles',
      'matte particles',
      'keyed edge',
      '扣色',
      '边缘颜色',
      '刀边缘',
      '刀刃',
      '选择颜色',
      '取色',
      '颜色粒子',
      '粒子效果'
    ],
    goalType: 'visual-preprocess-plus-particle',
    defaultPlugins: [{
      role: 'matte-isolation',
      preferredEffects: [
        { name: 'Linear Color Key', matchName: 'ADBE Linear Color Key2' },
        { name: 'Color Range', matchName: 'ADBE Color Range' },
        { name: 'Keylight (1.2)', matchName: 'Keylight 906' },
        { name: 'BCC Linear Color Key', matchName: 'BCC3Linear Color Key' }
      ]
    }, {
      role: 'particle-carrier',
      preferredEffects: [
        { name: 'Trapcode Particular', matchName: 'tc Particular' }
      ]
    }, {
      role: 'edge-bloom',
      preferredEffects: [
        { name: 'Deep Glow', matchName: 'PEDG' },
        { name: 'Deep Glow 2', matchName: 'PEDG2' }
      ],
      optional: true
    }],
    layerPolicy: minimumLayerPolicy(2, [
      'the keyed source must remain separate from the particle carrier',
      'the user explicitly asks for separate layer control',
      'the particle plugin cannot use the keyed layer as a layer emitter or layer map'
    ]),
    parameterGroups: ['keyed-matte-source', 'sample-color', 'key-tolerance', 'matte-softness', 'particle-emitter', 'particle-life-size', 'turbulence', 'glow-composite'],
    requiredPlanningSteps: [{
      id: 'sample-target-color',
      description: 'Identify the visible source color or edge region that should drive the effect, such as a pink blade edge.'
    }, {
      id: 'duplicate-source-for-matte',
      actionTypes: ['duplicateLayer'],
      description: 'Duplicate the target footage or precomp into a non-destructive keyed source layer trimmed to the marker span.'
    }, {
      id: 'isolate-key-color',
      actionTypes: ['addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
      description: 'Apply a color key/range/matte cleanup effect to isolate the sampled edge color before building particles.'
    }, {
      id: 'create-particle-carrier',
      actionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes'],
      description: 'Create one ADD/SCREEN solid carrier for the particle plugin and place it above the footage.'
    }, {
      id: 'connect-matte-to-particles',
      actionTypes: ['setProperty'],
      description: 'When the particle plugin exposes a Layer/Layer RGB/Layer Emitter/Layer Map control, set that property from the keyed source layer reference; otherwise approximate with an emitter path placed on the keyed edge.'
    }],
    planningRules: [
      'A request that says select/pick/key the existing color before particles must not be implemented as only manually positioned particles.',
      'The keyed duplicate is a source/matte layer, not another similar particle layer; it may be hidden/guide/non-rendering when the downstream plugin can still read it.',
      'Prefer one keyed source layer plus one particle carrier layer. Add glow on the particle carrier or keyed source only when needed for the requested look.',
      'Expose the sampled color, key tolerance/softness, particle rate, emitter path, turbulence, life, size, and glow strength as user-editable parameters when practical.'
    ],
    recommendedActionTypes: ['duplicateLayer', 'addEffect', 'setProperty', 'setKeyframes', 'addSolidLayer', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'short-impact-adjustment-stack',
    label: 'Short Impact Adjustment Stack',
    matchTokens: ['impact', 'hit', 'kill icon', 'shake', 'twitch', 'glow hit', '冲击', '击杀', '抖动', '卡点', '震动'],
    goalType: 'marker-impact-adjustment',
    defaultPlugins: [{
      role: 'impact-distortion',
      preferredEffects: [
        { name: 'Twitch', matchName: 'Twitch' },
        { name: 'S_Shake', matchName: 'S_Shake' }
      ]
    }, {
      role: 'impact-glow-blur',
      preferredEffects: [
        { name: 'Deep Glow', matchName: 'PEDG' },
        { name: 'RSMB', matchName: 'RSMB' }
      ],
      optional: true
    }],
    layerPolicy: minimumLayerPolicy(1, [
      'user explicitly asks for separate layer control',
      'glow/blur must be isolated from distortion timing',
      'plugin order cannot express the requested stack on one adjustment layer'
    ]),
    parameterGroups: ['impact-time', 'shake-amount', 'rgb-split', 'blur-amount', 'glow-exposure', 'decay-frames'],
    requiredPlanningSteps: [{
      id: 'resolve-impact-marker',
      actionTypes: ['setKeyframes'],
      description: 'Resolve the marker time and keep the effect span short, usually a few frames before and after the hit.'
    }, {
      id: 'create-trimmed-adjustment',
      actionTypes: ['addAdjustmentLayer', 'setLayerProperties'],
      description: 'Create one trimmed adjustment layer for the hit stack unless the user asks for separated controls.'
    }, {
      id: 'keyframe-hit-decay',
      actionTypes: ['addEffect', 'setProperty', 'setKeyframes'],
      description: 'Keyframe intensity up at the marker and decay quickly so the impact feels sharp.'
    }],
    planningRules: [
      'Prefer one adjustment layer for one short impact stack.',
      'Make keyframes relative to the marker, not absolute timeline guesses.',
      'Expose hit strength, decay length, blur, glow, and shake amount as editable parameters.'
    ],
    recommendedActionTypes: ['addAdjustmentLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'retime-twixtor-speed-ramp',
    label: 'Retime Twixtor Speed Ramp',
    matchTokens: ['twixtor', 'speed ramp', 'retime', 'rewind', 'time remap', '变速', '回溯', '时间重映射', '补帧'],
    goalType: 'source-retime',
    defaultPlugins: [{
      role: 'retime-interpolation',
      preferredEffects: [
        { name: 'Twixtor Pro', matchName: 'Twixtor Pro' },
        { name: 'Twixtor', matchName: 'Twixtor' },
        { name: 'Timewarp', matchName: 'ADBE Timewarp' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(0, [
      'the retime needs a duplicate or precomp to remain reversible',
      'different timing sections need independent source treatment',
      'user explicitly asks for separate layer control'
    ]),
    parameterGroups: ['retime-speed', 'speed-keyframes', 'frame-interpolation', 'motion-vector-quality', 'source-frame-rate'],
    requiredPlanningSteps: [{
      id: 'identify-source-timing',
      actionTypes: ['setKeyframes'],
      description: 'Determine which footage/precomp layer owns the timing and where the ramp or rewind should begin and end.'
    }, {
      id: 'protect-source-if-needed',
      actionTypes: ['duplicateLayer', 'setLayerProperties'],
      description: 'Duplicate or precomp only when the edit must remain reversible or affects only one isolated beat.'
    }, {
      id: 'keyframe-retime-curve',
      actionTypes: ['addEffect', 'setProperty', 'setKeyframes'],
      description: 'Apply the retime effect to the source layer and keyframe speed or frame controls around the marker.'
    }],
    planningRules: [
      'Do not use an adjustment layer for a plugin that changes source timing.',
      'Tie speed changes to beat or kill-icon timing and keep keyframes editable.',
      'Warn when the source frame rate or motion-vector quality is unknown.'
    ],
    recommendedActionTypes: ['duplicateLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'saber-path-glow',
    label: 'Saber Path Glow',
    matchTokens: ['saber', 'path glow', 'outline glow', 'energy stroke', '路径光', '描边发光', '能量线', '边缘光'],
    goalType: 'path-or-mask-glow',
    defaultPlugins: [{
      role: 'path-glow',
      preferredEffects: [
        { name: 'Saber', matchName: 'Saber' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(1, [
      'different paths need independent timing or colors',
      'the user explicitly asks for separate layer control',
      'the path must be tracked by an external helper'
    ]),
    parameterGroups: ['path-or-mask-source', 'glow-intensity', 'core-size', 'start-end-offset', 'flicker', 'distortion'],
    requiredPlanningSteps: [{
      id: 'choose-mask-or-text-path',
      actionTypes: ['addSolidLayer'],
      description: 'Choose whether the glow follows a mask, text outline, weapon edge, or hand-drawn path.'
    }, {
      id: 'create-saber-carrier',
      actionTypes: ['addSolidLayer', 'addEffect', 'setLayerProperties'],
      description: 'Create one additive solid carrier with Saber and the required mask/path source.'
    }, {
      id: 'animate-reveal-or-pulse',
      actionTypes: ['setProperty', 'setKeyframes'],
      description: 'Keyframe start/end offset, intensity, flicker, or distortion to match the visual beat.'
    }],
    planningRules: [
      'Do not create multiple Saber layers for one path unless the colors or timings truly diverge.',
      'Prefer mask/path controls over hand-placed glow when the target edge is clear.',
      'Expose path source, intensity, core size, flicker, and reveal timing.'
    ],
    recommendedActionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'optical-flares-hit-feedback',
    label: 'Optical Flares Hit Feedback',
    matchTokens: ['optical flares', 'lens flare', 'flare hit', 'light hit', '光晕', '镜头光斑', '爆闪', '击中光'],
    goalType: 'flare-hit-feedback',
    defaultPlugins: [{
      role: 'flare-feedback',
      preferredEffects: [
        { name: 'Optical Flares', matchName: 'Optical Flares' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(1, [
      'tracked flare position requires a null or tracked layer',
      'different flare sources need independent timing',
      'user explicitly asks for separate layer control'
    ]),
    parameterGroups: ['flare-position', 'brightness', 'scale', 'flicker', 'occlusion', 'blend-mode'],
    requiredPlanningSteps: [{
      id: 'resolve-flare-source',
      actionTypes: ['addSolidLayer'],
      description: 'Choose a source point such as muzzle flash, hit icon, weapon edge, or UI highlight.'
    }, {
      id: 'create-flare-carrier',
      actionTypes: ['addSolidLayer', 'addEffect', 'setLayerProperties'],
      description: 'Create one additive solid carrier for the flare effect.'
    }, {
      id: 'keyframe-flare-decay',
      actionTypes: ['setProperty', 'setKeyframes'],
      description: 'Keyframe brightness and scale with a fast rise and short decay around the marker.'
    }],
    planningRules: [
      'Use one flare carrier for one hit unless there are multiple independently tracked sources.',
      'Use tracking/null helpers only when the source moves noticeably.',
      'Expose position, brightness, scale, flicker, and decay length.'
    ],
    recommendedActionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'ripple-dissolve-adjustment',
    label: 'Ripple Dissolve Adjustment',
    matchTokens: ['ripple dissolve', 'water dissolve', 'wave dissolve', 'transition ripple', '波纹溶解', '涟漪转场', '水波转场'],
    goalType: 'adjustment-transition',
    defaultPlugins: [{
      role: 'ripple-dissolve',
      preferredEffects: [
        { name: 'BCC Ripple Dissolve', matchName: 'BCC Ripple Dissolve' },
        { name: 'Ripple', matchName: 'ADBE Ripple' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(1, [
      'incoming and outgoing shots need independent masks',
      'plugin order cannot express the requested dissolve on one adjustment layer',
      'user explicitly asks for separate layer control'
    ]),
    parameterGroups: ['dissolve-progress', 'ripple-height', 'wave-speed', 'edge-softness', 'transition-span'],
    requiredPlanningSteps: [{
      id: 'resolve-transition-span',
      actionTypes: ['setLayerProperties'],
      description: 'Resolve the cut or marker span that the dissolve should cover.'
    }, {
      id: 'create-transition-adjustment',
      actionTypes: ['addAdjustmentLayer', 'addEffect'],
      description: 'Create one trimmed adjustment layer over the transition span.'
    }, {
      id: 'animate-dissolve-progress',
      actionTypes: ['setProperty', 'setKeyframes'],
      description: 'Animate progress, ripple amount, wave speed, and edge softness through the transition.'
    }],
    planningRules: [
      'Use an adjustment layer unless the plugin requires source-layer treatment.',
      'Keep transition progress editable and avoid hard-coded absolute times.',
      'Do not stack several dissolve layers for one cut by default.'
    ],
    recommendedActionTypes: ['addAdjustmentLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'depth-map-smoke-composite',
    label: 'Depth Map Smoke Composite',
    matchTokens: ['depth map smoke', 'depth smoke', 'fog depth', 'atmosphere depth', '景深烟雾', '深度烟雾', '雾气合成', '纵深'],
    goalType: 'depth-matte-composite',
    defaultPlugins: [{
      role: 'depth-matte',
      preferredEffects: [
        { name: 'Depth Map ML', matchName: 'Depth Map ML' },
        { name: 'Depth Scanner', matchName: 'Depth Scanner' }
      ]
    }, {
      role: 'smoke-overlay',
      preferredEffects: [
        { name: 'Fractal Noise', matchName: 'ADBE Fractal Noise' },
        { name: 'Turbulent Displace', matchName: 'ADBE Turbulent Displace' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(2, [
      'the depth map must remain separate from the smoke layer',
      'user explicitly asks for separate layer control',
      'different foreground/background masks require separate composites'
    ]),
    parameterGroups: ['depth-map-output', 'fog-density', 'smoke-scale', 'turbulence', 'matte-softness', 'blend-mode'],
    requiredPlanningSteps: [{
      id: 'build-or-read-depth-matte',
      actionTypes: ['duplicateLayer', 'addEffect', 'setLayerProperties'],
      description: 'Create or reuse a depth matte source if the effect must respect foreground/background separation.'
    }, {
      id: 'create-smoke-composite-layer',
      actionTypes: ['addSolidLayer', 'addEffect', 'setLayerProperties'],
      description: 'Create one smoke/fog carrier that can use the depth matte as a map or matte reference.'
    }, {
      id: 'animate-atmosphere',
      actionTypes: ['setProperty', 'setKeyframes', 'setExpression'],
      description: 'Control density, drift, turbulence, and matte softness over the requested span.'
    }],
    planningRules: [
      'Use the depth matte as a source/helper layer, not another final visual layer.',
      'Prefer one smoke composite layer unless foreground and background need independent timings.',
      'Expose depth strength, fog density, turbulence, and matte softness.'
    ],
    recommendedActionTypes: ['duplicateLayer', 'addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'tracked-light-or-overlay',
    label: 'Tracked Light Or Overlay',
    matchTokens: ['track light', 'tracked overlay', 'motion track', 'follow target', '跟踪光', '跟随光', '跟踪叠加', '运动跟踪'],
    goalType: 'tracked-overlay',
    defaultPlugins: [{
      role: 'tracking-control',
      preferredEffects: [
        { name: 'Tracker', matchName: 'ADBE Tracker' }
      ]
    }, {
      role: 'light-or-overlay',
      preferredEffects: [
        { name: 'Optical Flares', matchName: 'Optical Flares' },
        { name: 'Deep Glow', matchName: 'PEDG' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(2, [
      'a null is required to hold tracking data',
      'the overlay must be independently transformable',
      'user explicitly asks for separate layer control'
    ]),
    parameterGroups: ['track-source', 'track-position', 'overlay-position', 'brightness', 'scale', 'decay'],
    requiredPlanningSteps: [{
      id: 'choose-track-feature',
      actionTypes: ['addNullLayer'],
      description: 'Identify the feature or layer that should drive the overlay position.'
    }, {
      id: 'create-track-control',
      actionTypes: ['addNullLayer', 'setExpression', 'setLayerProperties'],
      description: 'Create a null or reuse tracking data only when the overlay must follow motion.'
    }, {
      id: 'attach-overlay',
      actionTypes: ['addSolidLayer', 'addEffect', 'setExpression', 'setKeyframes'],
      description: 'Attach one light or overlay carrier to the track control and keyframe intensity around the marker.'
    }],
    planningRules: [
      'Do not add a null when the target is static or the user only needs a one-frame hit.',
      'Use a tracking helper only when it reduces manual per-frame positioning.',
      'Expose track source, overlay position, brightness, scale, and timing.'
    ],
    recommendedActionTypes: ['addNullLayer', 'addSolidLayer', 'addEffect', 'setExpression', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'texture-plasma-glow-overlay',
    label: 'Texture Plasma Glow Overlay',
    matchTokens: ['plasma glow', 'texture glow', 'energy texture', 'fractal glow', '纹理发光', '能量纹理', '等离子', '火焰纹理'],
    goalType: 'generator-overlay',
    defaultPlugins: [{
      role: 'texture-generator',
      preferredEffects: [
        { name: 'Fractal Noise', matchName: 'ADBE Fractal Noise' },
        { name: 'Turbulent Noise', matchName: 'ADBE Turbulent Noise' }
      ]
    }, {
      role: 'glow-composite',
      preferredEffects: [
        { name: 'Deep Glow', matchName: 'PEDG' },
        { name: 'Glow', matchName: 'ADBE Glow' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(1, [
      'the texture must be separately matted or tracked',
      'user explicitly asks for separate layer control',
      'the generator and glow require incompatible masks or timing'
    ]),
    parameterGroups: ['noise-scale', 'evolution', 'color-map', 'glow-strength', 'mask-or-matte', 'blend-mode'],
    requiredPlanningSteps: [{
      id: 'create-texture-carrier',
      actionTypes: ['addSolidLayer', 'addEffect', 'setLayerProperties'],
      description: 'Create one overlay carrier for texture generation and glow.'
    }, {
      id: 'shape-overlay-scope',
      actionTypes: ['setProperty', 'setExpression'],
      description: 'Limit the overlay with masks, matte references, or blend settings when needed.'
    }, {
      id: 'animate-energy-motion',
      actionTypes: ['setProperty', 'setKeyframes', 'setExpression'],
      description: 'Animate evolution, scale, color, and glow strength over the marker span.'
    }],
    planningRules: [
      'Combine generator and glow on one carrier when the same scope and timing are enough.',
      'Use masks or matte references instead of adding duplicate texture layers by default.',
      'Expose noise scale, evolution speed, color, glow, and blend mode.'
    ],
    recommendedActionTypes: ['addSolidLayer', 'addEffect', 'setProperty', 'setKeyframes', 'setExpression', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }, {
    id: 'transition-preset-two-shot',
    label: 'Transition Preset Two Shot',
    matchTokens: ['transition preset', 'two shot transition', 'cut transition', 'preset transition', '转场预设', '两段转场', '镜头衔接', '预设转场'],
    goalType: 'two-shot-transition',
    defaultPlugins: [{
      role: 'preset-or-effect-stack',
      preferredEffects: [
        { name: 'User Preset', matchName: 'ffx' }
      ]
    }],
    layerPolicy: minimumLayerPolicy(1, [
      'incoming and outgoing shots need independent source treatment',
      'the preset contains source-layer effects that cannot live on one adjustment layer',
      'user explicitly asks for separate layer control'
    ]),
    parameterGroups: ['cut-time', 'transition-duration', 'preset-path', 'strength', 'motion-blur', 'glow-or-distortion'],
    requiredPlanningSteps: [{
      id: 'resolve-cut-and-shots',
      actionTypes: ['setLayerProperties'],
      description: 'Resolve the outgoing shot, incoming shot, and cut or marker span.'
    }, {
      id: 'choose-preset-or-stack',
      actionTypes: ['applyPreset', 'addAdjustmentLayer'],
      description: 'Choose a scanned preset or build a small adjustment-layer stack based on the requested look.'
    }, {
      id: 'expose-transition-controls',
      actionTypes: ['setProperty', 'setKeyframes'],
      description: 'Expose duration, strength, blur, glow, and distortion controls before applying.'
    }],
    planningRules: [
      'Use scanned presets when the user asks for a known saved look.',
      'Keep the transition span explicit and editable.',
      'Do not overwrite source timing unless the transition requires source-layer retime.'
    ],
    recommendedActionTypes: ['addAdjustmentLayer', 'applyPreset', 'addEffect', 'setProperty', 'setKeyframes', 'setLayerProperties'],
    onlineResearch: optionalResearch()
  }];
};

AECreateContext.workflowSearchText = function (effectInfo) {
  return [
    effectInfo && effectInfo.name,
    effectInfo && effectInfo.matchName,
    effectInfo && effectInfo.category
  ].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
};

AECreateContext.workflowEntryScore = function (entry, effectInfo) {
  var text = AECreateContext.workflowSearchText(effectInfo);
  var score = 0;
  var matched = [];
  function scoreTokens(tokens, weight, prefix) {
    if (!(tokens instanceof Array)) return;
    for (var i = 0; i < tokens.length; i++) {
      var token = String(tokens[i] || '').toLowerCase();
      if (!token) continue;
      if (text.indexOf(token) !== -1) {
        score += weight;
        matched.push(prefix + ':' + token);
      }
    }
  }
  scoreTokens(entry.matchTokens, 3, 'name');
  scoreTokens(entry.categoryTokens, 1, 'category');
  return { score: score, matched: matched };
};

AECreateContext.cloneWorkflowEntry = function (entry) {
  return AECreateJSON.parse(AECreateJSON.stringify(entry));
};

AECreateContext.unknownPluginWorkflow = function (effectInfo) {
  var displayName = (effectInfo && (effectInfo.name || effectInfo.matchName)) || 'unknown AE effect';
  return {
    schemaVersion: 1,
    id: 'unknown-plugin-workflow',
    label: 'Unknown Plugin Workflow',
    confidence: 'low',
    matchedBy: [],
    layerStrategy: 'unknown',
    effectPlacement: 'targetLayer',
    layerPolicy: {
      priority: 'minimum-layers-first',
      defaultLayerCount: 0,
      defaultEffectInstancesPerVisualGoal: 1,
      optionalHelpersRequireExplicitRequest: true,
      splitLayersOnlyWhen: [
        'user explicitly asks for separate layer control',
        'official workflow research proves helper or carrier layers are required',
        'different timing, mask, blend mode, or compositing scope is required'
      ]
    },
    carrierLayer: null,
    helperLayers: [],
    destructiveRisk: 'unknown',
    recommendedActionTypes: ['addEffect', 'setProperty', 'setKeyframes', 'setExpression'],
    notes: [
      'No built-in workflow entry matched this plugin.',
      'Use scanned parameters cautiously and research the plugin workflow before generating layer-creation actions.'
    ],
    onlineResearch: {
      status: 'needed',
      queries: [
        displayName + ' After Effects official documentation workflow',
        displayName + ' After Effects tutorial adjustment layer solid layer light null',
        displayName + ' plugin user guide After Effects'
      ],
      preferredSources: ['official vendor documentation', 'official tutorials', 'high-quality workflow tutorials']
    }
  };
};

AECreateContext.pluginWorkflow = function (effectInfo) {
  var library = AECreateContext.effectWorkflowLibrary();
  var best = null;
  var bestScore = 0;
  var bestMatched = [];
  for (var i = 0; i < library.length; i++) {
    var result = AECreateContext.workflowEntryScore(library[i], effectInfo);
    if (result.score > bestScore) {
      best = library[i];
      bestScore = result.score;
      bestMatched = result.matched;
    }
  }
  if (!best) return AECreateContext.unknownPluginWorkflow(effectInfo);
  var workflow = AECreateContext.cloneWorkflowEntry(best);
  workflow.schemaVersion = 1;
  workflow.confidence = bestScore >= 3 ? 'medium' : 'low';
  if (bestScore >= 6) workflow.confidence = 'high';
  workflow.matchedBy = bestMatched;
  return workflow;
};

AECreateContext.effectWorkflowCatalog = function (effects) {
  var source = effects || AECreateContext.availableEffectsList();
  var output = [];
  for (var i = 0; i < source.length; i++) {
    output.push({
      effect: source[i],
      workflow: AECreateContext.pluginWorkflow(source[i])
    });
  }
  return {
    schemaVersion: 1,
    version: '2026-05-14',
    generatedAt: new Date().toString(),
    effects: output
  };
};

AECreateContext.pluginFileCandidateScore = function (effectInfo, filePath) {
  var tokens = AECreateContext.effectIdentityTokens(effectInfo);
  var normalizedPath = String(filePath || '').toLowerCase().replace(/\\/g, '/');
  var fileName = normalizedPath.split('/').pop();
  var score = 0;
  var matched = 0;
  for (var i = 0; i < tokens.length; i++) {
    if (fileName.indexOf(tokens[i]) !== -1) {
      score += 3;
      matched++;
    } else if (normalizedPath.indexOf(tokens[i]) !== -1) {
      score += 1;
      matched++;
    }
  }
  return matched ? score : 0;
};

AECreateContext.pluginFileExtensions = {
  aex: true,
  plugin: true,
  dll: true
};

AECreateContext.pluginFileSearchRoots = function () {
  var roots = [];
  function add(path) {
    if (!path) return;
    var key = String(path).toLowerCase();
    for (var i = 0; i < roots.length; i++) {
      if (String(roots[i]).toLowerCase() === key) return;
    }
    roots.push(path);
  }
  try {
    if (Folder.startup) add(Folder.startup.fsName + '/Plug-ins');
  } catch (startupError) {}
  try {
    var programFiles = $.getenv('ProgramFiles') || 'C:/Program Files';
    var programFilesX86 = $.getenv('ProgramFiles(x86)');
    var programData = $.getenv('ProgramData') || 'C:/ProgramData';
    add(programFiles + '/Adobe/Common/Plug-ins');
    add(programFiles + '/Common Files/Adobe/Plug-Ins');
    add(programFiles + '/Maxon');
    add(programData + '/Maxon');
    if (programFilesX86) {
      add(programFilesX86 + '/Adobe/Common/Plug-ins');
      add(programFilesX86 + '/Common Files/Adobe/Plug-Ins');
    }
  } catch (envError) {}
  return roots;
};

AECreateContext.collectPluginFileCandidatesInFolder = function (folder, effectInfo, options, depth, output) {
  if (!folder || !folder.exists || depth > options.maxPluginFileDepth || output.length >= options.maxPluginFileRecords) return;
  var files = [];
  try {
    files = folder.getFiles();
  } catch (error) {
    return;
  }
  for (var i = 0; i < files.length; i++) {
    if (output.length >= options.maxPluginFileRecords) return;
    var item = files[i];
    if (item instanceof Folder) {
      AECreateContext.collectPluginFileCandidatesInFolder(item, effectInfo, options, depth + 1, output);
      continue;
    }
    if (!(item instanceof File)) continue;
    var name = String(item.name || '');
    var extension = name.split('.').pop().toLowerCase();
    if (!AECreateContext.pluginFileExtensions[extension]) continue;
    var score = AECreateContext.pluginFileCandidateScore(effectInfo, item.fsName);
    if (score <= 0) continue;
    var record = {
      path: item.fsName,
      name: item.name,
      extension: extension,
      score: score,
      readableSemantics: false,
      note: 'Compiled AE plugin binary. Use this as file identity metadata; semantic control still comes from AE parameter scanning, presets, docs, and dynamic probing.'
    };
    try {
      record.size = item.length;
    } catch (lengthError) {}
    try {
      record.modified = item.modified ? item.modified.toString() : '';
    } catch (modifiedError) {}
    output.push(record);
  }
};

AECreateContext.pluginFileCandidates = function (effectInfo, options) {
  options = options || AECreateContext.effectScanOptions({});
  if (!options.includePluginFiles || typeof Folder === 'undefined') return [];
  var output = [];
  var roots = AECreateContext.pluginFileSearchRoots();
  for (var i = 0; i < roots.length; i++) {
    AECreateContext.collectPluginFileCandidatesInFolder(new Folder(roots[i]), effectInfo, options, 0, output);
    if (output.length >= options.maxPluginFileRecords) break;
  }
  output.sort(function (a, b) {
    return b.score - a.score;
  });
  return output;
};

AECreateContext.effectParamsFolder = function () {
  return AECreateBridge.ensureFolder(new Folder(AECreateBridge.bridgeFolder().fsName + '/effect-params'), 'effect params folder');
};

AECreateContext.writeEffectCatalog = function (effects) {
  var file = new File(AECreateBridge.bridgeFolder().fsName + '/effect-catalog.json');
  var workflowPath = AECreateContext.writeEffectWorkflowCatalog(effects);
  var catalog = {
    schemaVersion: 1,
    scannedAt: new Date().toString(),
    workflowLibraryPath: 'effect-workflows.json',
    workflowLibraryFullPath: workflowPath,
    effects: effects || AECreateContext.availableEffectsList()
  };
  AECreateBridge.writeText(file, AECreateJSON.stringify(catalog));
  return file.fsName;
};

AECreateContext.writeEffectWorkflowCatalog = function (effects) {
  var file = new File(AECreateBridge.bridgeFolder().fsName + '/effect-workflows.json');
  AECreateBridge.writeText(file, AECreateJSON.stringify(AECreateContext.effectWorkflowCatalog(effects)));
  return file.fsName;
};

AECreateContext.writeEffectScan = function (scan) {
  var folder = AECreateContext.effectParamsFolder();
  AECreateContext.cleanEffectScanFiles(folder, scan.effect || {});
  var file = new File(folder.fsName + '/' + AECreateContext.effectScanFileName(scan.effect.matchName || scan.effect.name));
  AECreateBridge.writeText(file, AECreateJSON.stringify(scan));
  return file.fsName;
};

AECreateContext.cleanEffectScanFiles = function (folder, effectInfo) {
  if (!folder || !folder.exists || !effectInfo) return 0;
  var removed = 0;
  var files = [];
  try {
    files = folder.getFiles('*.json');
  } catch (error) {
    return removed;
  }
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (!(file instanceof File)) continue;
    try {
      var scan = AECreateJSON.parse(AECreateBridge.readText(file));
      if (!AECreateContext.effectScanMatchesEffect(scan, effectInfo)) continue;
      if (file.remove()) removed++;
    } catch (cleanupError) {}
  }
  return removed;
};

AECreateContext.scanEffectParametersData = function (effectInfo, options) {
  var comp = AECreateContext.activeComp();
  if (!comp) AECreateBridge.fail('No active composition. Open a comp before scanning plugin parameters.');
  var scanOptions = AECreateContext.effectScanOptions(options || {});
  var layer = null;
  var undoOpen = false;
  try {
    app.beginUndoGroup('AEcreate Scan Effect Parameters');
    undoOpen = true;
    layer = comp.layers.addSolid([0, 0, 0], 'AEcreate effect scan temp', comp.width, comp.height, comp.pixelAspect, 1);
    var effects = layer.property('ADBE Effect Parade');
    var effect = null;
    try {
      effect = effects.addProperty(effectInfo.matchName || effectInfo.name);
    } catch (matchError) {
      effect = effects.addProperty(effectInfo.name || effectInfo.matchName);
    }
    if (!effect) AECreateBridge.fail('Unable to add effect for scanning: ' + (effectInfo.matchName || effectInfo.name));
    var params = AECreateContext.effectParameterTree(effect, scanOptions, 0, [], []);
    layer.remove();
    layer = null;
    app.endUndoGroup();
    undoOpen = false;
    return {
      schemaVersion: 1,
      scannedAt: new Date().toString(),
      effect: effectInfo,
      workflow: AECreateContext.pluginWorkflow(effectInfo),
      pluginFiles: AECreateContext.pluginFileCandidates(effectInfo, scanOptions),
      params: params,
      parameterCount: scanOptions.count,
      truncated: scanOptions.truncated,
      errors: scanOptions.errors
    };
  } catch (error) {
    if (layer) {
      try {
        layer.remove();
      } catch (removeError) {}
    }
    if (undoOpen) {
      try {
        app.endUndoGroup();
      } catch (undoError) {}
    }
    throw error;
  }
};

AECreateBridge.scanEffectParams = function (payloadText) {
  try {
    var payload = AECreateJSON.parse(payloadText || '{}');
    var effectInfo = AECreateContext.findEffectInfo(payload.query || payload.matchName || payload.name);
    if (!effectInfo) AECreateBridge.fail('Effect not found: ' + (payload.query || payload.matchName || payload.name || ''));
    AECreateContext.writeEffectCatalog();
    var scan = AECreateContext.scanEffectParametersData(effectInfo, payload);
    var outputPath = AECreateContext.writeEffectScan(scan);
    return AECreateBridge.respond({
      ok: true,
      message: 'Scanned plugin parameters: ' + (effectInfo.name || effectInfo.matchName),
      effect: effectInfo,
      outputPath: outputPath,
      parameterCount: scan.parameterCount,
      truncated: scan.truncated
    });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.listAvailableEffects = function () {
  try {
    var effects = AECreateContext.availableEffectsList();
    return AECreateBridge.respond({ ok: true, effects: effects });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.scanAllEffectParams = function (payloadText) {
  try {
    var payload = AECreateJSON.parse(payloadText || '{}');
    payload.includePluginFiles = payload.includePluginFiles === true;
    var effects = AECreateContext.availableEffectsList();
    var catalogPath = AECreateContext.writeEffectCatalog(effects);
    var report = {
      schemaVersion: 1,
      scannedAt: new Date().toString(),
      catalogPath: catalogPath,
      scanned: [],
      failed: []
    };
    var maxEffects = payload.maxEffects > 0 ? Math.min(payload.maxEffects, effects.length) : effects.length;
    for (var i = 0; i < maxEffects; i++) {
      try {
        var scan = AECreateContext.scanEffectParametersData(effects[i], payload);
        var outputPath = AECreateContext.writeEffectScan(scan);
        report.scanned.push({
          name: effects[i].name,
          matchName: effects[i].matchName,
          outputPath: outputPath,
          workflow: scan.workflow,
          parameterCount: scan.parameterCount,
          truncated: scan.truncated
        });
      } catch (scanError) {
        report.failed.push({
          name: effects[i].name,
          matchName: effects[i].matchName,
          error: String(scanError)
        });
      }
    }
    var reportFile = new File(AECreateBridge.bridgeFolder().fsName + '/effect-scan-report.json');
    AECreateBridge.writeText(reportFile, AECreateJSON.stringify(report));
    return AECreateBridge.respond({
      ok: true,
      message: 'Scanned ' + report.scanned.length + ' of ' + maxEffects + ' plugins. Failed: ' + report.failed.length + '.',
      catalogPath: catalogPath,
      reportPath: reportFile.fsName,
      scannedCount: report.scanned.length,
      failedCount: report.failed.length
    });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateContext.exportContextData = function () {
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
    availableEffects: AECreateContext.availableEffectsList(),
    presetCachePath: 'preset-cache.json',
    effectWorkflowLibraryPath: 'effect-workflows.json',
    pluginWorkflowLibrary: {
      schemaVersion: 1,
      version: '2026-05-14',
      entries: AECreateContext.effectWorkflowLibrary()
    },
    visualWorkflowLibrary: {
      schemaVersion: 1,
      version: '2026-05-14',
      entries: AECreateContext.visualWorkflowLibrary()
    },
    supportedActionTypes: AECreateContext.supportedActionTypes,
    panelSettings: AECreateBridge.settings()
  };
  context.contextFingerprint = AECreateContext.fingerprintContext(context);
  return { ok: true, context: context };
};

AECreateContext.relativePresetPath = function (rootPath, filePath) {
  var root = String(rootPath || '').replace(/\\/g, '/');
  var file = String(filePath || '').replace(/\\/g, '/');
  if (file.toLowerCase().indexOf(root.toLowerCase() + '/') === 0) return file.substring(root.length + 1);
  return file;
};

AECreateContext.presetCategory = function (relativePath) {
  var path = String(relativePath || '').replace(/\\/g, '/');
  var index = path.lastIndexOf('/');
  return index > 0 ? path.substring(0, index) : '';
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
  if (!state.rootPath) state.rootPath = folder.fsName;

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
        var relativePath = AECreateContext.relativePresetPath(state.rootPath, items[i].fsName);
        records.push({
          name: items[i].displayName,
          path: items[i].fsName,
          sourcePath: state.rootPath,
          relativePath: relativePath,
          category: AECreateContext.presetCategory(relativePath),
          modified: items[i].modified.toString()
        });
      }
    } catch (itemError) {
      state.errors.push({ path: String(items[i]), error: String(itemError) });
    }
  }
};

AECreateContext.presetSearchPaths = function (settings, environment) {
  var env = environment || {};
  var paths = [];
  var seen = {};
  function addPath(path) {
    if (!path) return;
    var key = String(path).toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    paths.push(path);
  }
  if (settings && settings.presetPaths && typeof settings.presetPaths.length === 'number') {
    for (var i = 0; i < settings.presetPaths.length; i++) {
      addPath(settings.presetPaths[i]);
    }
  }
  var userData = env.userData;
  var myDocuments = env.myDocuments;
  var appPath = env.appPath;

  if (!userData && typeof Folder !== 'undefined' && Folder.userData) userData = Folder.userData.fsName;
  if (!myDocuments && typeof Folder !== 'undefined' && Folder.myDocuments) myDocuments = Folder.myDocuments.fsName;
  if (!appPath && typeof app !== 'undefined' && app.path) appPath = app.path.fsName;

  addPath(userData ? userData + '/Adobe/After Effects' : '');
  addPath(myDocuments ? myDocuments + '/Adobe/After Effects' : '');
  addPath(appPath ? appPath + '/Presets' : '');
  return paths;
};

AECreateBridge.exportContext = function () {
  try {
    var result = AECreateContext.exportContextData();
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
    var paths = AECreateContext.presetSearchPaths(settings);
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
      searchedPaths: paths,
      errors: state.errors,
      truncated: state.truncated,
      presets: records
    }));
    var message = 'Scanned ' + records.length + ' presets.';
    if (state.truncated) message += ' Scan truncated.';
    return AECreateBridge.respond({ ok: true, message: message, searchedPaths: paths });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};
