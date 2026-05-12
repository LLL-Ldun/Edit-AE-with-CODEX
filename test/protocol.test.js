const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultSettings,
  normalizeSettings,
  validatePendingAction,
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
  const action = {
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
    }]
  };
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
  assert.deepEqual(validatePendingAction(action), ['modules[0].actions must be a non-empty array']);
});

test('fingerprintContext ignores exportedAt but changes on layer effects', () => {
  const a = {
    schemaVersion: 1,
    exportedAt: 'one',
    activeComp: { name: 'Comp' },
    selectedLayers: [{ index: 1, name: 'Layer', effects: [{ matchName: 'Glow' }] }]
  };
  const b = {
    schemaVersion: 1,
    exportedAt: 'two',
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
