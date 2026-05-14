const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultSettings,
  normalizeSettings,
  validatePendingAction,
  validatePendingActionValueRanges,
  fingerprintContext
} = require('../src/shared/protocol');

test('normalizeSettings keeps a user-selected bridgeDir and fills defaults', () => {
  const result = normalizeSettings({ bridgeDir: 'D:/AEBridge', historyLimit: 12 });
  assert.equal(result.bridgeDir, 'D:/AEBridge');
  assert.equal(result.historyLimit, 12);
  assert.deepEqual(result.presetPaths, []);
  assert.equal(result.showAdvancedLogs, false);
});

test('normalizeSettings creates deterministic defaults', () => {
  const result = normalizeSettings({});
  assert.equal(result.bridgeDir, defaultSettings.bridgeDir);
  assert.equal(result.historyLimit, 50);
  assert.deepEqual(result.presetPaths, []);
});

test('validatePendingAction accepts a structured checked module', () => {
  const action = createValidPendingAction();
  assert.deepEqual(validatePendingAction(action), []);
});

test('validatePendingAction accepts layer workflow actions', () => {
  const action = createValidPendingAction({
    modules: [{
      id: 'm1',
      title: 'Particular Overlay',
      summary: 'Creates a particle carrier above the footage and targets it.',
      checked: true,
      actions: [
        { type: 'duplicateLayer', ref: 'edgeMatte', name: 'AEcreate edge matte', guideLayer: true },
        { type: 'addSolidLayer', ref: 'particles', name: 'AEcreate particles', color: [0, 0, 0] },
        { type: 'addAdjustmentLayer', ref: 'impactFx', name: 'AEcreate impact fx' },
        { type: 'addLightLayer', ref: 'emitter', name: 'AEcreate emitter', lightType: 'point', position: [640, 360, -200] },
        { type: 'addEffect', targetRef: 'particles', matchName: 'tc Particular' },
        { type: 'setLayerProperties', targetRef: 'particles', blendingMode: 'ADD', inPoint: 27.85, outPoint: 32.85 }
      ]
    }]
  });

  assert.deepEqual(validatePendingAction(action), []);
});

test('validatePendingAction reports missing module actions', () => {
  const action = {
    schemaVersion: 1,
    title: 'Broken',
    summary: 'Broken action',
    target: { compId: 'active', layerIndex: 1, layerName: 'Layer' },
    modules: [{ id: 'm1', title: 'No actions', summary: 'Bad', checked: true }]
  };
  assert.ok(validatePendingAction(action).includes('modules[0].actions must be a non-empty array'));
});

test('validatePendingAction reports missing contextFingerprint', () => {
  const action = createValidPendingAction();
  delete action.contextFingerprint;

  assert.ok(validatePendingAction(action).includes('contextFingerprint must be a non-empty string'));
});

test('validatePendingAction reports missing createdAt', () => {
  const action = createValidPendingAction();
  delete action.createdAt;

  assert.ok(validatePendingAction(action).includes('createdAt must be a non-empty string'));
});

test('validatePendingAction reports stale contextFingerprint', () => {
  const action = createValidPendingAction();

  assert.ok(
    validatePendingAction(action, { expectedContextFingerprint: 'def' })
      .includes('contextFingerprint does not match current context')
  );
});

test('validatePendingAction reports malformed action items', () => {
  const action = createValidPendingAction({
    modules: [{
      id: 'm1',
      title: 'Glow Hit',
      summary: 'Modify glow at impact.',
      checked: true,
      actions: [null, { effectMatchName: 'Deep Glow' }]
    }]
  });

  const errors = validatePendingAction(action);
  assert.ok(errors.includes('modules[0].actions[0] must be an object'));
  assert.ok(errors.includes('modules[0].actions[1].type must be a non-empty string'));
});

test('validatePendingAction reports unsupported action type', () => {
  const action = createValidPendingAction({
    modules: [{
      id: 'm1',
      title: 'Unsupported',
      summary: 'Uses an unsupported action type.',
      checked: true,
      actions: [{ type: 'notSupported' }]
    }]
  });

  assert.ok(
    validatePendingAction(action).includes(
      'modules[0].actions[0].type must be one of: addEffect, modifyEffect, applyPreset, setProperty, setKeyframes, setExpression, duplicateLayer, addSolidLayer, addAdjustmentLayer, addLightLayer, addNullLayer, setLayerProperties'
    )
  );
});

test('validatePendingActionValueRanges reports out-of-range effect values from scanned params', () => {
  const action = createValidPendingAction({
    modules: [{
      id: 'm1',
      title: 'Particular Turbulence',
      summary: 'Sets a turbulence parameter beyond its AE range.',
      checked: true,
      actions: [{
        type: 'setProperty',
        effectMatchName: 'tc Particular',
        propertyPath: ['tc Particular-0711'],
        value: 120
      }]
    }]
  });
  const effectScan = {
    effect: { name: 'Trapcode Particular', matchName: 'tc Particular' },
    params: [{
      name: '影响位置',
      matchName: 'tc Particular-0711',
      matchPath: ['tc Particular-0711'],
      path: ['影响位置'],
      hasMin: true,
      minValue: 0,
      hasMax: true,
      maxValue: 100
    }]
  };

  assert.deepEqual(validatePendingActionValueRanges(action, [effectScan]), [
    'modules[0].actions[0] value 120 is above maxValue 100 for tc Particular > tc Particular-0711'
  ]);
});

test('validatePendingActionValueRanges checks keyframe values from scanned params', () => {
  const action = createValidPendingAction({
    modules: [{
      id: 'm1',
      title: 'Particular Turbulence',
      summary: 'Sets turbulence keyframes.',
      checked: true,
      actions: [{
        type: 'setKeyframes',
        effectMatchName: 'tc Particular',
        propertyPath: ['tc Particular-0711'],
        keys: [{ time: 1, value: 92 }, { time: 2, value: -1 }]
      }]
    }]
  });
  const effectScan = {
    effect: { name: 'Trapcode Particular', matchName: 'tc Particular' },
    params: [{
      name: '影响位置',
      matchName: 'tc Particular-0711',
      matchPath: ['tc Particular-0711'],
      path: ['影响位置'],
      hasMin: true,
      minValue: 0,
      hasMax: true,
      maxValue: 100
    }]
  };

  assert.deepEqual(validatePendingActionValueRanges(action, [effectScan]), [
    'modules[0].actions[0].keys[1] value -1 is below minValue 0 for tc Particular > tc Particular-0711'
  ]);
});

test('fingerprintContext ignores exportedAt and contextFingerprint but changes on layer effects', () => {
  const a = {
    schemaVersion: 1,
    exportedAt: 'one',
    contextFingerprint: 'old',
    activeComp: { name: 'Comp' },
    selectedLayers: [{ index: 1, name: 'Layer', effects: [{ matchName: 'Glow' }] }]
  };
  const b = {
    schemaVersion: 1,
    exportedAt: 'two',
    contextFingerprint: 'new',
    activeComp: { name: 'Comp' },
    selectedLayers: [{ index: 1, name: 'Layer', effects: [{ matchName: 'Glow' }] }]
  };
  const c = {
    schemaVersion: 1,
    exportedAt: 'two',
    activeComp: { name: 'Comp' },
    selectedLayers: [{ index: 1, name: 'Layer', effects: [{ matchName: 'Particular' }] }]
  };
  assert.equal(fingerprintContext(a), fingerprintContext(b));
  assert.notEqual(fingerprintContext(a), fingerprintContext(c));
});

test('fingerprintContext ignores panelSettings', () => {
  const a = {
    schemaVersion: 1,
    activeComp: { name: 'Comp' },
    panelSettings: {
      bridgeDir: 'D:/AEBridge',
      historyLimit: 10,
      showAdvancedLogs: true
    },
    selectedLayers: [{ index: 1, name: 'Layer', effects: [{ matchName: 'Glow' }] }]
  };
  const b = {
    schemaVersion: 1,
    activeComp: { name: 'Comp' },
    panelSettings: {
      bridgeDir: 'E:/OtherBridge',
      historyLimit: 100,
      showAdvancedLogs: false
    },
    selectedLayers: [{ index: 1, name: 'Layer', effects: [{ matchName: 'Glow' }] }]
  };

  assert.equal(fingerprintContext(a), fingerprintContext(b));
});

function createValidPendingAction(overrides = {}) {
  return {
    schemaVersion: 1,
    createdAt: '2026-05-12T12:00:00+08:00',
    contextFingerprint: 'abc',
    title: 'Impact Burst',
    summary: 'Adds a short hit effect.',
    target: { compId: 'active', layerIndex: 3, layerName: 'Clip 03' },
    modules: [{
      id: 'm1',
      title: 'Glow Hit',
      summary: 'Modify glow at impact.',
      checked: true,
      actions: [{ type: 'setProperty', effectMatchName: 'Deep Glow', propertyPath: ['Exposure'], value: 1.4 }]
    }],
    ...overrides
  };
}
