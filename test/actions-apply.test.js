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

test('applyCheckedModules can use edited pending plan from payload', () => {
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
      title: 'Disk Plan',
      summary: 'Old disk plan.',
      target: { compId: 'active', layerIndex: 1, layerName: 'Adjustment Layer' },
      modules: [{
        id: 'm1',
        title: 'Disk Glow',
        summary: 'Old value.',
        checked: true,
        actions: [{ type: 'setProperty', effectMatchName: 'Deep Glow', propertyPath: ['Radius'], value: 35 }]
      }]
    };
  };
  context.AECreateActions.currentContextFingerprint = function currentContextFingerprint() {
    return 'fingerprint';
  };
  context.AECreateActions.validatePendingActionOrFail = function validatePendingActionOrFail() {};
  context.AECreateActions.applyModule = function applyModule(layer, module) {
    assert.equal(layer, targetLayer);
    assert.equal(module.title, 'Edited Glow');
    assert.equal(module.actions[0].value, 64);
  };
  context.AECreateActions.log = function log() {};
  context.AECreateActions.writeHistory = function writeHistory(plan) {
    assert.equal(plan.modules[0].title, 'Edited Glow');
  };

  const editedPlan = {
    schemaVersion: 1,
    createdAt: '2026-05-13T01:10:00+08:00',
    contextFingerprint: 'fingerprint',
    title: 'Edited Plan',
    summary: 'Edited before applying.',
    target: { compId: 'active', layerIndex: 1, layerName: 'Adjustment Layer' },
    modules: [{
      id: 'm1',
      title: 'Edited Glow',
      summary: 'Edited value.',
      checked: true,
      actions: [{ type: 'setProperty', effectMatchName: 'Deep Glow', propertyPath: ['Radius'], value: 64 }]
    }]
  };

  const raw = context.AECreateBridge.applyCheckedModules(JSON.stringify({
    checked: [{ index: 0, checked: true }],
    plan: editedPlan
  }));
  const result = JSON.parse(raw);

  assert.equal(result.ok, true, result.error);
  assert.equal(result.message, 'Applied modules: Edited Glow');
});

test('applyModule can target effects at a newly created particle layer', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'actions.jsx'), 'utf8');

  class CompItem {}
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
      project: { activeItem: null }
    },
    CompItem,
    BlendingMode: { ADD: 'ADD', SCREEN: 'SCREEN', NORMAL: 'NORMAL' },
    LightType: { POINT: 'POINT', SPOT: 'SPOT' },
    Error,
    String,
    isFinite,
    Math
  });
  context.AECreateJSON = vm.runInContext('JSON', context);

  vm.runInContext(source, context, { filename: 'actions.jsx' });
  const result = vm.runInContext(`
    (function () {
      var calls = [];
      var targetEffects = {
        numProperties: 0,
        addProperty: function (name) {
          calls.push({ type: 'targetEffect', name: name });
          return { name: name, matchName: name };
        }
      };
      var targetLayer = {
        name: 'canju.mp4',
        property: function (name) {
          if (name === 'ADBE Effect Parade') return targetEffects;
          return null;
        }
      };

      var solidEffects = {
        added: [],
        numProperties: 0,
        addProperty: function (name) {
          this.added.push(name);
          this.numProperties = this.added.length;
          calls.push({ type: 'solidEffect', name: name });
          return { name: name, matchName: name };
        },
        property: function () {
          return null;
        }
      };
      var solidValues = {};
      var solidLayer = {
        name: '',
        property: function (name) {
          if (name === 'ADBE Effect Parade') return solidEffects;
          if (name === 'ADBE Transform Group') {
            return {
              property: function (child) {
                return {
                  setValue: function (value) {
                    solidValues[child] = value;
                  }
                };
              }
            };
          }
          return null;
        },
        moveBefore: function (layer) {
          calls.push({ type: 'moveBefore', target: layer.name });
        }
      };
      var lightValues = {};
      function lightProp(name) {
        return {
          setValue: function (value) {
            lightValues[name] = value;
          }
        };
      }
      var lightLayer = {
        name: '',
        property: function (name) {
          if (name === 'ADBE Transform Group') {
            return { property: function (child) { return lightProp(child); } };
          }
          if (name === 'ADBE Light Options Group') {
            return { property: function (child) { return lightProp(child); } };
          }
          return null;
        }
      };

      var comp = new CompItem();
      comp.width = 1280;
      comp.height = 720;
      comp.pixelAspect = 1;
      comp.duration = 40;
      comp.layers = {
        addSolid: function (color, name, width, height, pixelAspect, duration) {
          calls.push({ type: 'addSolid', color: color, name: name, width: width, height: height, duration: duration });
          solidLayer.name = name;
          return solidLayer;
        },
        addLight: function (name, position) {
          calls.push({ type: 'addLight', name: name, position: position });
          lightLayer.name = name;
          return lightLayer;
        }
      };

      AECreateActions.applyModule(targetLayer, {
        id: 'm1',
        title: 'Particular Overlay',
        summary: 'Create particle layer workflow.',
        actions: [
          { type: 'addSolidLayer', ref: 'particles', name: 'AEcreate particles', color: [0, 0, 0], inPoint: 27.85, outPoint: 32.85, blendingMode: 'ADD' },
          { type: 'addLightLayer', ref: 'emitter', name: 'AEcreate emitter', lightType: 'point', position: [640, 360, -200], intensity: 80 },
          { type: 'addEffect', targetRef: 'particles', matchName: 'tc Particular' },
          { type: 'setLayerProperties', targetRef: 'particles', blendingMode: 'SCREEN', opacity: 75 }
        ]
      }, 0, { comp: comp, targetLayer: targetLayer, layersByRef: {} });

      return {
        calls: calls,
        solidEffects: solidEffects.added,
        targetEffectCount: targetEffects.numProperties,
        solidInPoint: solidLayer.inPoint,
        solidOutPoint: solidLayer.outPoint,
        solidBlendingMode: solidLayer.blendingMode,
        solidValues: solidValues,
        lightType: lightLayer.lightType,
        lightValues: lightValues
      };
    })()
  `, context);

  assert.deepEqual(Array.from(result.solidEffects), ['tc Particular']);
  assert.equal(result.targetEffectCount, 0);
  assert.equal(result.solidInPoint, 27.85);
  assert.equal(result.solidOutPoint, 32.85);
  assert.equal(result.solidBlendingMode, 'SCREEN');
  assert.equal(result.solidValues['ADBE Opacity'], 75);
  assert.equal(result.lightType, 'POINT');
  assert.deepEqual(Array.from(result.lightValues['ADBE Position']), [640, 360, -200]);
  assert.deepEqual(Array.from(result.calls).map((call) => call.type), ['addSolid', 'moveBefore', 'addLight', 'solidEffect']);
});

test('applyModule can create and target an adjustment layer workflow', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'actions.jsx'), 'utf8');

  class CompItem {}
  const context = vm.createContext({
    AECreateBridge: {
      respond(object) {
        return JSON.stringify(object);
      },
      fail(message) {
        throw new Error(message);
      }
    },
    app: { project: { activeItem: null } },
    CompItem,
    BlendingMode: { NORMAL: 'NORMAL' },
    Error,
    String,
    isFinite,
    Math
  });
  context.AECreateJSON = vm.runInContext('JSON', context);

  vm.runInContext(source, context, { filename: 'actions.jsx' });
  const result = vm.runInContext(`
    (function () {
      var calls = [];
      var targetLayer = { name: 'clip.mp4' };
      var adjustmentEffects = {
        added: [],
        numProperties: 0,
        addProperty: function (name) {
          this.added.push(name);
          this.numProperties = this.added.length;
          return { name: name, matchName: name };
        }
      };
      var adjustmentLayer = {
        name: '',
        property: function (name) {
          if (name === 'ADBE Effect Parade') return adjustmentEffects;
          return null;
        },
        moveBefore: function (layer) {
          calls.push({ type: 'moveBefore', target: layer.name });
        }
      };
      var comp = new CompItem();
      comp.width = 1280;
      comp.height = 720;
      comp.pixelAspect = 1;
      comp.duration = 20;
      comp.layers = {
        addSolid: function (color, name, width, height, pixelAspect, duration) {
          calls.push({ type: 'addSolid', color: color, name: name, duration: duration });
          adjustmentLayer.name = name;
          return adjustmentLayer;
        }
      };

      AECreateActions.applyModule(targetLayer, {
        id: 'm1',
        title: 'Twitch adjustment',
        summary: 'Create adjustment layer workflow.',
        actions: [
          { type: 'addAdjustmentLayer', ref: 'impactFx', name: 'AEcreate impact fx', inPoint: 2, outPoint: 3 },
          { type: 'addEffect', targetRef: 'impactFx', matchName: 'Twitch' }
        ]
      }, 0, { comp: comp, targetLayer: targetLayer, layersByRef: {} });

      return {
        calls: calls,
        adjustmentLayer: adjustmentLayer.adjustmentLayer,
        inPoint: adjustmentLayer.inPoint,
        outPoint: adjustmentLayer.outPoint,
        effects: adjustmentEffects.added
      };
    })()
  `, context);

  assert.equal(result.adjustmentLayer, true);
  assert.equal(result.inPoint, 2);
  assert.equal(result.outPoint, 3);
  assert.deepEqual(Array.from(result.effects), ['Twitch']);
  assert.deepEqual(Array.from(result.calls).map((call) => call.type), ['addSolid', 'moveBefore']);
});
