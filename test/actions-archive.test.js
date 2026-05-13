const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

test('readPendingAction stores current pending plan in the archive without duplicates', () => {
  const context = loadActionsWithFiles({
    'C:/bridge/pending-action.json': JSON.stringify(createPlan('Glow Plan'))
  });

  const first = JSON.parse(context.AECreateBridge.readPendingAction());
  const second = JSON.parse(context.AECreateBridge.readPendingAction());
  const archive = JSON.parse(context.files['C:/bridge/pending-plans.json']);

  assert.equal(first.ok, true, first.error);
  assert.equal(first.archive.plans.length, 1);
  assert.equal(second.archive.plans.length, 1);
  assert.equal(archive.plans.length, 1);
  assert.equal(archive.plans[0].plan.title, 'Glow Plan');
});

test('restorePendingAction writes an archived plan back to pending-action.json', () => {
  const context = loadActionsWithFiles({
    'C:/bridge/pending-action.json': JSON.stringify(createPlan('First Plan'))
  });
  const archived = JSON.parse(context.AECreateBridge.readPendingAction());
  const id = archived.archive.plans[0].id;
  context.files['C:/bridge/pending-action.json'] = JSON.stringify(createPlan('Second Plan'));

  const restored = JSON.parse(context.AECreateBridge.restorePendingAction(JSON.stringify({ id })));
  const pending = JSON.parse(context.files['C:/bridge/pending-action.json']);

  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.plan.title, 'First Plan');
  assert.equal(pending.title, 'First Plan');
});

function loadActionsWithFiles(initialFiles) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'actions.jsx'), 'utf8');
  const files = { ...initialFiles };

  function Folder(fsName) {
    this.fsName = fsName.replace(/\\/g, '/');
    this.exists = true;
  }

  function File(fsName) {
    this.fsName = fsName.replace(/\\/g, '/');
    const lastSlash = this.fsName.lastIndexOf('/');
    this.parent = new Folder(lastSlash >= 0 ? this.fsName.slice(0, lastSlash) : '');
  }
  Object.defineProperty(File.prototype, 'exists', {
    get() {
      return Object.prototype.hasOwnProperty.call(files, this.fsName);
    }
  });

  const context = vm.createContext({
    AECreateBridge: {
      bridgeFolder() {
        return new Folder('C:/bridge');
      },
      readText(file) {
        return files[file.fsName] || null;
      },
      writeText(file, text) {
        files[file.fsName] = text;
      },
      respond(object) {
        return JSON.stringify(object);
      },
      fail(message) {
        throw new Error(message);
      }
    },
    app: { project: {} },
    CompItem: function CompItem() {},
    File,
    Folder,
    Error,
    String,
    Date,
    isFinite,
    Math,
    files
  });
  context.AECreateJSON = vm.runInContext('JSON', context);
  vm.runInContext(source, context, { filename: 'actions.jsx' });
  context.files = files;
  return context;
}

function createPlan(title) {
  return {
    schemaVersion: 1,
    createdAt: '2026-05-13T13:40:00+08:00',
    contextFingerprint: 'fingerprint',
    title,
    summary: `${title} summary`,
    target: { compId: 'active', layerIndex: 1, layerName: 'Layer 1' },
    modules: [{
      id: 'm1',
      title: 'Module',
      summary: 'Module summary',
      checked: true,
      actions: [{ type: 'addEffect', name: 'Deep Glow' }]
    }]
  };
}
