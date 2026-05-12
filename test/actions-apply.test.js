const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

test('applyCheckedModules does not depend on AECreateContext being in scope', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'actions.jsx'), 'utf8');

  class CompItem {}
  const targetLayer = { name: 'Adjustment Layer' };
  const activeComp = new CompItem();
  activeComp.numLayers = 1;
  activeComp.layer = function layer(index) {
    return index === 1 ? targetLayer : null;
  };

  const context = vm.createContext({
    AECreateBridge: {
      respond(object) {
        return JSON.stringify(object);
      },
      fail(message) {
        throw new Error(message);
      }
    },
    app: {
      project: { activeItem: activeComp },
      beginUndoGroup() {},
      endUndoGroup() {}
    },
    CompItem,
    Error,
    String,
    isFinite,
    Math
  });
  context.AECreateJSON = vm.runInContext('JSON', context);

  vm.runInContext(source, context, { filename: 'actions.jsx' });
  context.AECreateActions.readPendingPlan = function readPendingPlan() {
    return {
      schemaVersion: 1,
      createdAt: '2026-05-13T01:10:00+08:00',
      contextFingerprint: 'fingerprint',
      title: 'Scoped Apply',
      summary: 'Applies without AECreateContext.',
      target: { compId: 'active', layerIndex: 1, layerName: 'Adjustment Layer' },
      modules: [{
        id: 'm1',
        title: 'Glow',
        summary: 'Apply glow.',
        checked: true,
        actions: [{ type: 'addEffect', name: 'Deep Glow' }]
      }]
    };
  };
  context.AECreateActions.currentContextFingerprint = function currentContextFingerprint() {
    return 'fingerprint';
  };
  context.AECreateActions.validatePendingActionOrFail = function validatePendingActionOrFail() {};
  context.AECreateActions.applyModule = function applyModule(layer, module) {
    assert.equal(layer, targetLayer);
    assert.equal(module.title, 'Glow');
  };
  context.AECreateActions.log = function log() {};
  context.AECreateActions.writeHistory = function writeHistory() {};

  const raw = context.AECreateBridge.applyCheckedModules(JSON.stringify({
    checked: [{ index: 0, checked: true }]
  }));
  const result = JSON.parse(raw);

  assert.equal(result.ok, true, result.error);
  assert.equal(result.message, 'Applied modules: Glow');
});
