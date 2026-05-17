const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadContextHelpers(extraContext = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'context.jsx'), 'utf8');
  const context = {
    AECreateContext: {},
    AECreateBridge: {},
    AECreateJSON: JSON,
    app: {},
    PropertyType: { PROPERTY: 6212 },
    ...extraContext
  };
  vm.runInNewContext(source, context, { filename: 'context.jsx' });
  return context.AECreateContext;
}

test('effectScanFileName makes stable safe filenames for plugin match names', () => {
  const helpers = loadContextHelpers();

  const name = helpers.effectScanFileName('tc Particular');

  assert.match(name, /^tc-Particular-fnv1a32-[0-9a-f]{8}\.json$/);
});

test('effectScanMatchesEffect identifies stale scans for the same plugin', () => {
  const helpers = loadContextHelpers();
  const previousScan = {
    effect: {
      name: 'Trapcode Particular',
      matchName: 'tc Particular'
    }
  };

  assert.equal(helpers.effectScanMatchesEffect(previousScan, {
    name: 'Trapcode Particular',
    matchName: 'tc Particular'
  }), true);
  assert.equal(helpers.effectScanMatchesEffect(previousScan, {
    name: 'Deep Glow',
    matchName: 'PEDG'
  }), false);
});

test('effectScanMetadataFromText reads scan status without parsing the full params tree', () => {
  const helpers = loadContextHelpers();
  const text = [
    '{"schemaVersion":1,',
    '"scannedAt":"2026-05-16T10:00:00+08:00",',
    '"effect":{"name":"Trapcode Particular","matchName":"tc Particular","category":"RG"},',
    '"workflow":{"id":"particle-solid-carrier"},',
    '"params":[this would be a huge tree and is intentionally not valid JSON],',
    '"parameterCount":428,',
    '"truncated":true}'
  ].join('');

  const record = helpers.effectScanMetadataFromText(text, 'C:/bridge/effect-params/tc-Particular.json');

  assert.equal(record.scannedAt, '2026-05-16T10:00:00+08:00');
  assert.equal(record.outputPath, 'C:/bridge/effect-params/tc-Particular.json');
  assert.equal(record.effect.name, 'Trapcode Particular');
  assert.equal(record.effect.matchName, 'tc Particular');
  assert.equal(record.effect.category, 'RG');
  assert.equal(record.parameterCount, 428);
  assert.equal(record.truncated, true);
});

test('effectScanStatusRecords marks installed plugins as scanned unscanned or failed', () => {
  const helpers = loadContextHelpers();
  const records = helpers.effectScanStatusRecords([
    { name: 'Trapcode Particular', matchName: 'tc Particular', category: 'RG Particles and 3D' },
    { name: 'Deep Glow', matchName: 'Deep Glow', category: 'Plugin Everything' },
    { name: 'Broken FX', matchName: 'Broken FX', category: 'Unstable' }
  ], [{
    scannedAt: '2026-05-15T10:00:00+08:00',
    outputPath: 'C:/bridge/effect-params/tc-Particular.json',
    parameterCount: 42,
    truncated: false,
    effect: { name: 'Trapcode Particular', matchName: 'tc Particular' }
  }], [{
    name: 'Broken FX',
    matchName: 'Broken FX',
    error: 'Unable to add effect.'
  }]);

  assert.equal(records[0].scanStatus, 'scanned');
  assert.equal(records[0].scanOutputPath, 'C:/bridge/effect-params/tc-Particular.json');
  assert.equal(records[0].parameterCount, 42);
  assert.equal(records[1].scanStatus, 'unscanned');
  assert.equal(records[2].scanStatus, 'failed');
  assert.equal(records[2].scanError, 'Unable to add effect.');
});

test('effectScanStatusRecords shows whether plugins have a built-in workflow entry', () => {
  const helpers = loadContextHelpers();
  const records = helpers.effectScanStatusRecords([
    { name: 'Trapcode Particular', matchName: 'tc Particular', category: 'RG Particles and 3D' },
    { name: 'Mystery Render FX', matchName: 'Mystery Render FX', category: 'Unknown Vendor' }
  ], [], []);

  assert.equal(records[0].workflowStatus, 'known');
  assert.equal(records[0].workflowId, 'particle-solid-carrier');
  assert.equal(records[0].workflowLayerStrategy, 'solidCarrier');
  assert.equal(records[1].workflowStatus, 'unknown');
  assert.equal(records[1].workflowId, 'unknown-plugin-workflow');
});

test('selectedEffectsFromPayload resolves only checked plugins from the installed list', () => {
  const helpers = loadContextHelpers();
  const effects = [
    { name: 'Trapcode Particular', matchName: 'tc Particular', category: 'RG Particles and 3D' },
    { name: 'Deep Glow', matchName: 'Deep Glow', category: 'Plugin Everything' },
    { name: 'Twitch', matchName: 'Twitch', category: 'Video Copilot' }
  ];

  const selected = helpers.selectedEffectsFromPayload({
    effects: [
      { matchName: 'Deep Glow' },
      { name: 'Trapcode Particular' },
      { matchName: 'Deep Glow' },
      { matchName: 'Missing' }
    ]
  }, effects);

  assert.equal(JSON.stringify(selected.map((effect) => effect.matchName)), JSON.stringify(['Deep Glow', 'tc Particular']));
});

test('effectParameterTree records writable metadata and match paths', () => {
  const helpers = loadContextHelpers();
  const property = {
    propertyIndex: 1,
    name: 'Birth Rate',
    matchName: 'CC Particle World-0004',
    propertyType: 6212,
    propertyValueType: 6417,
    canSetExpression: true,
    canVaryOverTime: true,
    isTimeVarying: false,
    numKeys: 0,
    value: 2
  };
  const group = {
    numProperties: 1,
    property(index) {
      return index === 1 ? property : null;
    }
  };

  const records = helpers.effectParameterTree(group, {
    maxDepth: 4,
    maxRecords: 10,
    errors: [],
    count: 0,
    truncated: false
  });

  assert.equal(JSON.stringify(records), JSON.stringify([{
    index: 1,
    name: 'Birth Rate',
    matchName: 'CC Particle World-0004',
    propertyType: 6212,
    propertyValueType: 6417,
    canSetExpression: true,
    canVaryOverTime: true,
    isTimeVarying: false,
    path: ['Birth Rate'],
    matchPath: ['CC Particle World-0004'],
    value: 2,
    keyCount: 0
  }]));
});

test('effectParameterTree records AE value ranges when exposed', () => {
  const helpers = loadContextHelpers();
  const property = {
    propertyIndex: 1,
    name: 'Affect Position',
    matchName: 'tc Particular-0711',
    propertyType: 6212,
    propertyValueType: 6417,
    canSetExpression: true,
    canVaryOverTime: true,
    isTimeVarying: false,
    hasMin: true,
    minValue: 0,
    hasMax: true,
    maxValue: 100,
    unitsText: '%',
    numKeys: 0,
    value: 0
  };
  const group = {
    numProperties: 1,
    property(index) {
      return index === 1 ? property : null;
    }
  };

  const records = helpers.effectParameterTree(group, {
    maxDepth: 4,
    maxRecords: 10,
    errors: [],
    count: 0,
    truncated: false
  });

  assert.equal(records[0].hasMin, true);
  assert.equal(records[0].minValue, 0);
  assert.equal(records[0].hasMax, true);
  assert.equal(records[0].maxValue, 100);
  assert.equal(records[0].unitsText, '%');
});

test('effectParameterTree omits hidden disabled and internal parameters from visible scans', () => {
  const helpers = loadContextHelpers();
  const visibleProperty = {
    propertyIndex: 1,
    name: 'Particles/sec',
    matchName: 'tc Particular-0146',
    propertyType: 6212,
    propertyValueType: 6417,
    canSetExpression: true,
    canVaryOverTime: true,
    isTimeVarying: false,
    numKeys: 0,
    value: 100
  };
  const hiddenProperty = {
    propertyIndex: 2,
    name: 'Emitter Type Old',
    matchName: 'tc Particular-0005',
    propertyType: 6212,
    elided: true,
    numKeys: 0,
    value: 1
  };
  const disabledProperty = {
    propertyIndex: 3,
    name: 'Emitter Size Y',
    matchName: 'tc Particular-0015',
    propertyType: 6212,
    enabled: false,
    numKeys: 0,
    value: 500
  };
  const internalProperty = {
    propertyIndex: 4,
    name: '',
    matchName: 'tc Particular-0580',
    propertyType: 6212,
    numKeys: 0,
    value: null
  };
  const group = {
    numProperties: 4,
    property(index) {
      return [visibleProperty, hiddenProperty, disabledProperty, internalProperty][index - 1] || null;
    }
  };

  const records = helpers.effectParameterTree(group, helpers.effectScanOptions({}));

  assert.equal(JSON.stringify(records.map((record) => record.matchName)), JSON.stringify(['tc Particular-0146']));
});

test('plugin file candidate scoring matches effect identity tokens', () => {
  const helpers = loadContextHelpers();

  const score = helpers.pluginFileCandidateScore({
    name: 'Trapcode Particular',
    matchName: 'tc Particular',
    category: 'RG Particles and 3D'
  }, 'C:/Program Files/Adobe/Common/Plug-ins/7.0/MediaCore/Trapcode/Particular.aex');

  assert.ok(score > 0);
});

test('pluginWorkflow prefers the minimum layer count for particle effects', () => {
  const helpers = loadContextHelpers();

  const workflow = helpers.pluginWorkflow({
    name: 'Trapcode Particular',
    matchName: 'tc Particular',
    category: 'RG Particles and 3D'
  });

  assert.equal(workflow.layerStrategy, 'solidCarrier');
  assert.equal(workflow.carrierLayer.type, 'solid');
  assert.equal(workflow.layerPolicy.priority, 'minimum-layers-first');
  assert.equal(workflow.layerPolicy.defaultLayerCount, 1);
  assert.equal(workflow.layerPolicy.defaultEffectInstancesPerVisualGoal, 1);
  assert.equal(workflow.layerPolicy.optionalHelpersRequireExplicitRequest, true);
  assert.ok(workflow.layerPolicy.splitLayersOnlyWhen.includes('user explicitly asks for separate layer control'));
  assert.deepEqual(workflow.helperLayers.map((layer) => layer.type), ['light', 'null']);
  assert.ok(workflow.recommendedActionTypes.includes('addSolidLayer'));
  assert.equal(workflow.recommendedActionTypes.includes('addLightLayer'), false);
  assert.equal(workflow.recommendedActionTypes.includes('addNullLayer'), false);
  assert.ok(workflow.recommendedActionTypes.includes('setLayerProperties'));
});

test('visualWorkflowLibrary teaches color-keyed edge particles as a preprocess-plus-particle flow', () => {
  const helpers = loadContextHelpers();

  const workflows = helpers.visualWorkflowLibrary();
  const keyedParticles = workflows.find((entry) => entry.id === 'color-keyed-edge-particles');

  assert.ok(keyedParticles);
  assert.equal(keyedParticles.goalType, 'visual-preprocess-plus-particle');
  assert.equal(keyedParticles.layerPolicy.priority, 'minimum-layers-first');
  assert.equal(keyedParticles.layerPolicy.defaultLayerCount, 2);
  assert.ok(keyedParticles.matchTokens.includes('刀刃'));
  assert.ok(Array.isArray(keyedParticles.parameterGroups));
  assert.ok(keyedParticles.parameterGroups.includes('keyed-matte-source'));
  assert.ok(keyedParticles.parameterGroups.includes('layer-emitter-3d-switches'));
  assert.ok(keyedParticles.recommendedActionTypes.includes('duplicateLayer'));
  assert.ok(keyedParticles.requiredPlanningSteps.map((step) => step.id).includes('isolate-key-color'));
  assert.ok(keyedParticles.requiredPlanningSteps.map((step) => step.id).includes('prepare-layer-emitter-switches'));
  assert.ok(keyedParticles.requiredPlanningSteps.map((step) => step.id).includes('connect-matte-to-particles'));
  assert.ok(keyedParticles.planningRules.some((rule) => /3D|Collapse|collapse/.test(rule)));
});

test('visualWorkflowLibrary keeps layer-emitter 2D by default unless 3D relay is needed', () => {
  const helpers = loadContextHelpers();

  const workflows = helpers.visualWorkflowLibrary();
  const keyedParticles = workflows.find((entry) => entry.id === 'color-keyed-edge-particles');
  const prepareStep = keyedParticles.requiredPlanningSteps.find((step) => step.id === 'prepare-layer-emitter-switches');

  assert.ok(prepareStep);
  assert.ok(/2D/.test(prepareStep.description));
  assert.ok(/3D/.test(prepareStep.description));
  assert.ok(keyedParticles.planningRules.some((rule) => /2D/.test(rule)));
  assert.ok(keyedParticles.planningRules.some((rule) => /Collapse/.test(rule)));
});

test('pluginWorkflow includes tutorial-derived plugin usage families', () => {
  const helpers = loadContextHelpers();
  const scenarios = [{
    effect: { name: 'Saber', matchName: 'Saber', category: 'Video Copilot' },
    id: 'saber-path-glow',
    strategy: 'solidCarrier',
    group: 'path-or-mask-source'
  }, {
    effect: { name: 'Optical Flares', matchName: 'Optical Flares', category: 'Video Copilot' },
    id: 'optical-flares-hit-feedback',
    strategy: 'solidCarrier',
    group: 'flare-position'
  }, {
    effect: { name: 'BCC Ripple Dissolve', matchName: 'BCC Ripple Dissolve', category: 'Boris FX' },
    id: 'ripple-dissolve-adjustment',
    strategy: 'adjustmentLayer',
    group: 'dissolve-progress'
  }, {
    effect: { name: 'Depth Map ML', matchName: 'Depth Map ML', category: 'AI Depth' },
    id: 'depth-map-source-preprocess',
    strategy: 'sourceLayer',
    group: 'depth-map-output'
  }, {
    effect: { name: 'BCC Two Way Key', matchName: 'BCC Two Way Key', category: 'Boris FX Key' },
    id: 'matte-key-source-preprocess',
    strategy: 'sourceLayer',
    group: 'matte-isolation'
  }, {
    effect: { name: '3D Stroke', matchName: '3D Stroke', category: 'Trapcode' },
    id: 'path-stroke-carrier',
    strategy: 'solidCarrier',
    group: 'path-stroke'
  }];

  for (const scenario of scenarios) {
    const workflow = helpers.pluginWorkflow(scenario.effect);
    assert.equal(workflow.id, scenario.id);
    assert.equal(workflow.layerStrategy, scenario.strategy);
    assert.equal(workflow.layerPolicy.priority, 'minimum-layers-first');
    assert.equal(workflow.layerPolicy.defaultEffectInstancesPerVisualGoal, 1);
    assert.ok(workflow.parameterGroups.includes(scenario.group));
  }
});

test('visualWorkflowLibrary exposes tutorial-derived visual workflow families', () => {
  const helpers = loadContextHelpers();
  const workflows = helpers.visualWorkflowLibrary();
  const ids = workflows.map((entry) => entry.id);
  const expected = [
    'color-keyed-edge-particles',
    'short-impact-adjustment-stack',
    'retime-twixtor-speed-ramp',
    'saber-path-glow',
    'optical-flares-hit-feedback',
    'ripple-dissolve-adjustment',
    'depth-map-smoke-composite',
    'tracked-light-or-overlay',
    'texture-plasma-glow-overlay',
    'transition-preset-two-shot'
  ];

  for (const id of expected) {
    assert.ok(ids.includes(id), `missing visual workflow ${id}`);
    const workflow = workflows.find((entry) => entry.id === id);
    assert.equal(workflow.layerPolicy.priority, 'minimum-layers-first');
    assert.ok(Array.isArray(workflow.requiredPlanningSteps));
    assert.ok(workflow.requiredPlanningSteps.length > 0);
    assert.ok(Array.isArray(workflow.parameterGroups));
    assert.ok(workflow.parameterGroups.length > 0);
    assert.ok(Array.isArray(workflow.planningRules));
    assert.ok(workflow.planningRules.length > 0);
  }
});

test('workflow entries expose single-record source policy for official and tutorial precedence', () => {
  const helpers = loadContextHelpers();

  const pluginWorkflow = helpers.pluginWorkflow({
    name: 'Trapcode Particular',
    matchName: 'tc Particular',
    category: 'RG Particles and 3D'
  });
  const visualWorkflow = helpers.visualWorkflowLibrary().find((entry) => entry.id === 'color-keyed-edge-particles');

  assert.equal(pluginWorkflow.sourcePolicy.schemaVersion, 1);
  assert.equal(pluginWorkflow.sourcePolicy.model, 'single-workflow-record');
  assert.equal(pluginWorkflow.sourcePolicy.primarySourceKind, 'official');
  assert.ok(pluginWorkflow.sourcePolicy.supplementSourceKinds.includes('tutorial'));
  assert.match(pluginWorkflow.sourcePolicy.mergeRule, /official/i);

  assert.equal(visualWorkflow.sourcePolicy.schemaVersion, 1);
  assert.equal(visualWorkflow.sourcePolicy.model, 'single-workflow-record');
  assert.equal(visualWorkflow.sourcePolicy.primarySourceKind, 'tutorial');
  assert.ok(visualWorkflow.sourcePolicy.supplementSourceKinds.includes('official'));
  assert.match(visualWorkflow.sourcePolicy.mergeRule, /tutorial/i);
});

test('supportedActionTypes includes duplicateLayer for non-destructive keyed sources', () => {
  const helpers = loadContextHelpers();

  assert.ok(helpers.supportedActionTypes.includes('duplicateLayer'));
});

test('exportContextData includes the visual workflow library for AI planning', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'context.jsx'), 'utf8');
  class CompItem {}
  const comp = new CompItem();
  comp.name = 'Comp';
  comp.width = 1920;
  comp.height = 1080;
  comp.frameRate = 60;
  comp.duration = 10;
  comp.time = 1;
  comp.selectedLayers = [];
  comp.markerProperty = null;
  const sandbox = {
    AECreateContext: {},
    AECreateBridge: { settings: () => ({ bridgeDir: 'D:/Bridge' }) },
    AECreateJSON: JSON,
    app: {
      project: {
        file: null,
        activeItem: comp
      },
      effects: []
    },
    CompItem,
    PropertyType: { PROPERTY: 6212 },
    Date,
    String,
    Math,
    isFinite
  };
  vm.runInNewContext(source, sandbox, { filename: 'context.jsx' });

  const result = sandbox.AECreateContext.exportContextData();

  assert.equal(result.ok, true);
  assert.equal(result.context.visualWorkflowLibrary.schemaVersion, 1);
  assert.ok(result.context.visualWorkflowLibrary.entries.some((entry) => entry.id === 'color-keyed-edge-particles'));
  assert.equal(result.context.pluginWorkflowLibrary.entries.find((entry) => entry.id === 'particle-solid-carrier').sourcePolicy.primarySourceKind, 'official');
  assert.equal(result.context.visualWorkflowLibrary.entries.find((entry) => entry.id === 'color-keyed-edge-particles').sourcePolicy.primarySourceKind, 'tutorial');
  assert.ok(result.context.supportedActionTypes.includes('duplicateLayer'));
});

test('built-in plugin workflows declare minimum-layer defaults', () => {
  const helpers = loadContextHelpers();

  const entries = helpers.effectWorkflowLibrary();

  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.equal(entry.layerPolicy.priority, 'minimum-layers-first');
    assert.equal(entry.layerPolicy.optionalHelpersRequireExplicitRequest, true);
    assert.equal(typeof entry.layerPolicy.defaultLayerCount, 'number');
    assert.equal(entry.layerPolicy.defaultEffectInstancesPerVisualGoal, 1);
  }
});

test('pluginWorkflow distinguishes adjustment-layer and source-layer effects', () => {
  const helpers = loadContextHelpers();

  const twitch = helpers.pluginWorkflow({
    name: 'Twitch',
    matchName: 'Twitch',
    category: 'Video Copilot'
  });
  const twixtor = helpers.pluginWorkflow({
    name: 'Twixtor Pro',
    matchName: 'Twixtor Pro',
    category: 'RE:Vision Effects'
  });

  assert.equal(twitch.layerStrategy, 'adjustmentLayer');
  assert.equal(twitch.layerPolicy.defaultLayerCount, 1);
  assert.ok(twitch.recommendedActionTypes.includes('addAdjustmentLayer'));
  assert.equal(twixtor.layerStrategy, 'sourceLayer');
  assert.equal(twixtor.layerPolicy.defaultLayerCount, 0);
  assert.equal(twixtor.destructiveRisk, 'retimes-source-layer');
  assert.equal(twixtor.recommendedActionTypes.includes('addAdjustmentLayer'), false);
});

test('pluginWorkflow marks unknown plugins for future online research', () => {
  const helpers = loadContextHelpers();

  const workflow = helpers.pluginWorkflow({
    name: 'Mystery Render FX',
    matchName: 'Mystery Render FX',
    category: 'Unknown Vendor'
  });

  assert.equal(workflow.layerStrategy, 'unknown');
  assert.equal(workflow.layerPolicy.defaultLayerCount, 0);
  assert.equal(workflow.onlineResearch.status, 'needed');
  assert.ok(workflow.onlineResearch.queries[0].includes('Mystery Render FX'));
  assert.ok(workflow.recommendedActionTypes.includes('addEffect'));
});

test('effectWorkflowCatalog records workflows for available effects', () => {
  const helpers = loadContextHelpers();

  const catalog = helpers.effectWorkflowCatalog([{
    name: 'Deep Glow',
    matchName: 'Deep Glow',
    category: 'Plugin Everything'
  }, {
    name: 'Mystery Render FX',
    matchName: 'Mystery Render FX',
    category: 'Unknown Vendor'
  }]);

  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.effects.length, 2);
  assert.equal(catalog.effects[0].workflow.layerStrategy, 'adjustmentLayer');
  assert.equal(catalog.effects[1].workflow.layerStrategy, 'unknown');
  assert.equal(catalog.effects[1].workflow.onlineResearch.status, 'needed');
  assert.equal(catalog.effects[0].workflow.sourcePolicy.primarySourceKind, 'official');
  assert.equal(catalog.effects[1].workflow.sourcePolicy.primarySourceKind, 'official');
});

test('scanEffectParametersData includes inferred plugin workflow', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'context.jsx'), 'utf8');
  class CompItem {}
  const effect = { numProperties: 0 };
  const layer = {
    property(name) {
      if (name === 'ADBE Effect Parade') {
        return {
          addProperty(effectName) {
            assert.equal(effectName, 'Twitch');
            return effect;
          }
        };
      }
      return null;
    },
    remove() {}
  };
  const comp = new CompItem();
  comp.width = 1280;
  comp.height = 720;
  comp.pixelAspect = 1;
  comp.layers = {
    addSolid() {
      return layer;
    }
  };
  const context = {
    AECreateContext: {},
    AECreateJSON: JSON,
    AECreateBridge: {
      fail(message) {
        throw new Error(message);
      }
    },
    app: {
      project: { activeItem: comp },
      beginUndoGroup() {},
      endUndoGroup() {}
    },
    CompItem,
    PropertyType: { PROPERTY: 6212 }
  };

  vm.runInNewContext(source, context, { filename: 'context.jsx' });
  const scan = context.AECreateContext.scanEffectParametersData({
    name: 'Twitch',
    matchName: 'Twitch',
    category: 'Video Copilot'
  }, { includePluginFiles: false });

  assert.equal(scan.workflow.layerStrategy, 'adjustmentLayer');
  assert.ok(scan.workflow.recommendedActionTypes.includes('addAdjustmentLayer'));
  assert.equal(scan.workflow.sourcePolicy.primarySourceKind, 'official');
});

test('findEffectInfo matches installed effects by display name or match name', () => {
  const helpers = loadContextHelpers({
    app: {
      effects: [{
        displayName: 'Trapcode Particular',
        matchName: 'tc Particular',
        category: 'RG Particles and 3D'
      }]
    }
  });

  assert.equal(helpers.findEffectInfo('particular').matchName, 'tc Particular');
  assert.equal(helpers.findEffectInfo('tc Particular').name, 'Trapcode Particular');
});

test('listAvailableEffects bridge response includes effect suggestions', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'context.jsx'), 'utf8');
  const context = {
    AECreateContext: {},
    AECreateJSON: JSON,
    AECreateBridge: {
      respond(object) {
        return JSON.stringify(object);
      }
    },
    app: {
      effects: [{
        displayName: 'Pixel Sorter 3',
        matchName: 'GG PixelSorter3',
        category: 'Pixel Sorter Studio'
      }]
    },
    PropertyType: { PROPERTY: 6212 }
  };

  vm.runInNewContext(source, context, { filename: 'context.jsx' });
  const result = JSON.parse(context.AECreateBridge.listAvailableEffects());

  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result.effects), JSON.stringify([{
    name: 'Pixel Sorter 3',
    matchName: 'GG PixelSorter3',
    category: 'Pixel Sorter Studio'
  }]));
});
