# AE Codex Effect Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build V1 of a dockable After Effects CEP panel that exports AE context to a user-selected bridge folder, reads Codex pending effect plans, and applies checked modules to the selected AE layer.

**Architecture:** The repo contains a static CEP extension plus Node-based tests for shared protocol logic. Browser JavaScript owns panel state and file-bridge UI, while ExtendScript owns direct AE operations such as markers, effect inspection, preset application, and structured action execution.

**Tech Stack:** Adobe CEP, HTML/CSS/browser JavaScript, ExtendScript JSX, Node.js built-in test runner, PowerShell install helper.

---

## File Structure

- Create `package.json`: Node scripts for tests and lint-like validation.
- Create `src/shared/protocol.js`: CommonJS helpers for settings, context, pending-action validation, and fingerprinting.
- Create `test/protocol.test.js`: Node tests for shared protocol helpers.
- Create `extension/CSXS/manifest.xml`: AE CEP manifest for a dockable panel.
- Create `extension/index.html`: Panel markup.
- Create `extension/css/panel.css`: Panel styling.
- Create `extension/js/lib/CSInterface.js`: Minimal local CSInterface shim used by the CEP panel.
- Create `extension/js/panel.js`: Browser UI controller.
- Create `extension/js/bridge-client.js`: Browser wrapper around JSX calls.
- Create `extension/jsx/json.jsx`: JSON stringify/parse helpers for ExtendScript.
- Create `extension/jsx/bridge.jsx`: Shared JSX bridge helpers for paths, settings, and file IO.
- Create `extension/jsx/context.jsx`: AE context export, marker reading, effect tree inspection, and preset scanning.
- Create `extension/jsx/actions.jsx`: Pending-action validation and structured action executor.
- Create `scripts/install-dev.ps1`: Copies the extension into the current user's CEP extensions folder.
- Create `docs/manual-test-checklist.md`: AE manual verification checklist.
- Modify `README.md`: Add install, test, and usage instructions.

## Task 1: Node Test Harness And Protocol Helpers

**Files:**
- Create: `package.json`
- Create: `src/shared/protocol.js`
- Create: `test/protocol.test.js`

- [ ] **Step 1: Create the failing protocol tests**

Create `test/protocol.test.js`:

```js
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
```

- [ ] **Step 2: Add a test script and run it to verify failure**

Create `package.json`:

```json
{
  "name": "aecreate",
  "version": "0.1.0",
  "private": true,
  "description": "After Effects CEP panel for Codex-driven effect control.",
  "scripts": {
    "test": "node --test"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Run: `npm test`

Expected: FAIL with `Cannot find module '../src/shared/protocol'`.

- [ ] **Step 3: Implement the protocol helpers**

Create `src/shared/protocol.js`:

```js
const crypto = require('node:crypto');

const defaultSettings = {
  bridgeDir: 'C:/Users/16693/Documents/AEEE/ae-codex-bridge',
  presetPaths: [],
  historyLimit: 50,
  showAdvancedLogs: false
};

function normalizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    bridgeDir: typeof source.bridgeDir === 'string' && source.bridgeDir.trim()
      ? source.bridgeDir
      : defaultSettings.bridgeDir,
    presetPaths: Array.isArray(source.presetPaths)
      ? source.presetPaths.filter((item) => typeof item === 'string' && item.trim())
      : [],
    historyLimit: Number.isInteger(source.historyLimit) && source.historyLimit > 0
      ? source.historyLimit
      : defaultSettings.historyLimit,
    showAdvancedLogs: source.showAdvancedLogs === true
  };
}

function validatePendingAction(action) {
  const errors = [];
  if (!action || typeof action !== 'object') return ['pending action must be an object'];
  if (action.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!nonEmptyString(action.title)) errors.push('title must be a non-empty string');
  if (!nonEmptyString(action.summary)) errors.push('summary must be a non-empty string');
  if (!action.target || typeof action.target !== 'object') {
    errors.push('target must be an object');
  } else {
    if (action.target.compId !== 'active' && !nonEmptyString(action.target.compId)) {
      errors.push('target.compId must be active or a non-empty string');
    }
    if (!Number.isInteger(action.target.layerIndex) || action.target.layerIndex < 1) {
      errors.push('target.layerIndex must be a positive integer');
    }
  }
  if (!Array.isArray(action.modules) || action.modules.length === 0) {
    errors.push('modules must be a non-empty array');
  } else {
    action.modules.forEach((module, index) => {
      if (!module || typeof module !== 'object') {
        errors.push(`modules[${index}] must be an object`);
        return;
      }
      if (!nonEmptyString(module.id)) errors.push(`modules[${index}].id must be a non-empty string`);
      if (!nonEmptyString(module.title)) errors.push(`modules[${index}].title must be a non-empty string`);
      if (!nonEmptyString(module.summary)) errors.push(`modules[${index}].summary must be a non-empty string`);
      if (!Array.isArray(module.actions) || module.actions.length === 0) {
        errors.push(`modules[${index}].actions must be a non-empty array`);
      }
    });
  }
  return errors;
}

function fingerprintContext(context) {
  const stable = stripVolatileFields(context);
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function stripVolatileFields(value) {
  if (Array.isArray(value)) return value.map(stripVolatileFields);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  Object.keys(value).sort().forEach((key) => {
    if (key === 'exportedAt') return;
    output[key] = stripVolatileFields(value[key]);
  });
  return output;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  defaultSettings,
  normalizeSettings,
  validatePendingAction,
  fingerprintContext
};
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test`

Expected: PASS, 5 tests passing.

Commit:

```bash
git add package.json src/shared/protocol.js test/protocol.test.js
git commit -m "test: add bridge protocol helpers"
```

## Task 2: CEP Extension Shell

**Files:**
- Create: `extension/CSXS/manifest.xml`
- Create: `extension/index.html`
- Create: `extension/css/panel.css`
- Create: `extension/js/lib/CSInterface.js`
- Create: `extension/js/bridge-client.js`
- Create: `extension/js/panel.js`

- [ ] **Step 1: Add static panel files**

Create `extension/CSXS/manifest.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ExtensionManifest Version="7.0" ExtensionBundleId="com.aecreate.codexbridge" ExtensionBundleVersion="0.1.0" ExtensionBundleName="AEcreate">
  <ExtensionList>
    <Extension Id="com.aecreate.codexbridge.panel" Version="0.1.0" />
  </ExtensionList>
  <ExecutionEnvironment>
    <HostList>
      <Host Name="AEFT" Version="[25.0,26.0]" />
    </HostList>
    <LocaleList>
      <Locale Code="All" />
    </LocaleList>
    <RequiredRuntimeList>
      <RequiredRuntime Name="CSXS" Version="11.0" />
    </RequiredRuntimeList>
  </ExecutionEnvironment>
  <DispatchInfoList>
    <Extension Id="com.aecreate.codexbridge.panel">
      <DispatchInfo>
        <Resources>
          <MainPath>./index.html</MainPath>
          <ScriptPath>./jsx/bridge.jsx</ScriptPath>
          <CEFCommandLine>
            <Parameter>--allow-file-access</Parameter>
            <Parameter>--allow-file-access-from-files</Parameter>
          </CEFCommandLine>
        </Resources>
        <Lifecycle>
          <AutoVisible>true</AutoVisible>
        </Lifecycle>
        <UI>
          <Type>Panel</Type>
          <Menu>AEcreate Codex Bridge</Menu>
          <Geometry>
            <Size>
              <Width>420</Width>
              <Height>720</Height>
            </Size>
            <MinSize>
              <Width>360</Width>
              <Height>520</Height>
            </MinSize>
          </Geometry>
        </UI>
      </DispatchInfo>
    </Extension>
  </DispatchInfoList>
</ExtensionManifest>
```

Create `extension/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>AEcreate Codex Bridge</title>
  <link rel="stylesheet" href="./css/panel.css">
</head>
<body>
  <main class="panel">
    <section class="section">
      <div class="section-title">Context</div>
      <div id="contextStatus" class="status">No context exported.</div>
      <div class="button-row">
        <button id="refreshContext">Refresh Context</button>
        <button id="chooseBridge">Choose Bridge</button>
      </div>
      <button id="openBridge" class="full">Open Bridge Folder</button>
    </section>

    <section class="section">
      <div class="section-title">Markers</div>
      <div class="button-grid">
        <button data-marker="kill_icon">Kill</button>
        <button data-marker="impact">Impact</button>
        <button data-marker="rewind">Rewind</button>
        <button id="customMarker">Custom</button>
      </div>
      <pre id="markerList" class="box">No markers loaded.</pre>
    </section>

    <section class="section">
      <div class="section-title">Library</div>
      <button id="scanPresets" class="full">Scan Presets</button>
      <pre id="presetStatus" class="box">Preset cache not scanned.</pre>
    </section>

    <section class="section">
      <div class="section-title">Pending Plan</div>
      <div id="pendingSummary" class="status">No pending action.</div>
      <div id="moduleList" class="module-list"></div>
      <div class="button-row">
        <button id="applyChecked">Apply Checked</button>
        <button id="discardPending">Discard</button>
      </div>
      <div class="button-row">
        <button id="saveFavorite">Save Favorite</button>
        <button id="openLogs">Open Logs</button>
      </div>
    </section>
  </main>

  <script src="./js/lib/CSInterface.js"></script>
  <script src="./js/bridge-client.js"></script>
  <script src="./js/panel.js"></script>
</body>
</html>
```

Create `extension/css/panel.css`:

```css
body {
  margin: 0;
  background: #1f1f1f;
  color: #f0f0f0;
  font-family: Arial, "Microsoft YaHei", sans-serif;
  font-size: 12px;
}

.panel {
  padding: 12px;
}

.section {
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
  background: #282828;
}

.section-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.status,
.box {
  background: #171717;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.button-row,
.button-grid {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}

.button-row {
  grid-template-columns: 1fr 1fr;
}

.button-grid {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

button {
  background: #3d6fb6;
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
}

button:hover {
  background: #4d7fc6;
}

button.full {
  width: 100%;
}

.module {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 8px;
  align-items: start;
  padding: 8px;
  margin-bottom: 6px;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  background: #202020;
}

.module-title {
  font-weight: 700;
}

.module-summary {
  color: #c8c8c8;
  margin-top: 3px;
}
```

Create `extension/js/lib/CSInterface.js`:

```js
function CSInterface() {}

CSInterface.prototype.evalScript = function evalScript(script, callback) {
  if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
    window.__adobe_cep__.evalScript(script, callback);
  } else if (callback) {
    callback(JSON.stringify({ ok: false, error: 'CEP runtime is not available.' }));
  }
};
```

Create `extension/js/bridge-client.js`:

```js
(function () {
  function BridgeClient() {
    this.cs = new CSInterface();
  }

  BridgeClient.prototype.call = function call(functionName, payload) {
    var serialized = JSON.stringify(payload || {});
    var escaped = serialized.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var script = 'AECreateBridge.' + functionName + "('" + escaped + "')";
    return new Promise(function (resolve) {
      this.cs.evalScript(script, function (raw) {
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          resolve({ ok: false, error: 'Invalid JSX response: ' + raw });
        }
      });
    }.bind(this));
  };

  window.AECreateBridgeClient = BridgeClient;
}());
```

Create `extension/js/panel.js`:

```js
(function () {
  var bridge = new window.AECreateBridgeClient();
  var state = { pending: null };

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    $(id).textContent = text;
  }

  function renderPending(plan) {
    state.pending = plan;
    var list = $('moduleList');
    list.innerHTML = '';
    if (!plan || !plan.modules || !plan.modules.length) {
      setText('pendingSummary', 'No pending action.');
      return;
    }
    setText('pendingSummary', plan.title + '\n' + plan.summary);
    plan.modules.forEach(function (module, index) {
      var row = document.createElement('label');
      row.className = 'module';
      row.innerHTML =
        '<input type="checkbox" data-index="' + index + '"' + (module.checked !== false ? ' checked' : '') + '>' +
        '<span><span class="module-title"></span><span class="module-summary"></span></span>';
      row.querySelector('.module-title').textContent = module.title;
      row.querySelector('.module-summary').textContent = module.summary;
      list.appendChild(row);
    });
  }

  function refreshContext() {
    bridge.call('exportContext', {}).then(function (result) {
      setText('contextStatus', result.ok ? result.message : result.error);
      if (result.ok && result.markersText) setText('markerList', result.markersText);
    });
  }

  function loadPending() {
    bridge.call('readPendingAction', {}).then(function (result) {
      if (result.ok) renderPending(result.plan);
      else setText('pendingSummary', result.error);
    });
  }

  $('refreshContext').addEventListener('click', refreshContext);
  $('chooseBridge').addEventListener('click', function () {
    bridge.call('chooseBridgeFolder', {}).then(function (result) {
      setText('contextStatus', result.ok ? result.message : result.error);
    });
  });
  $('openBridge').addEventListener('click', function () { bridge.call('openBridgeFolder', {}); });
  $('scanPresets').addEventListener('click', function () {
    bridge.call('scanPresets', {}).then(function (result) {
      setText('presetStatus', result.ok ? result.message : result.error);
    });
  });
  document.querySelectorAll('[data-marker]').forEach(function (button) {
    button.addEventListener('click', function () {
      bridge.call('addMarker', { name: button.getAttribute('data-marker'), target: 'layer' }).then(refreshContext);
    });
  });
  $('customMarker').addEventListener('click', function () {
    var name = prompt('Marker name', 'custom_effect');
    if (name) bridge.call('addMarker', { name: name, target: 'layer' }).then(refreshContext);
  });
  $('applyChecked').addEventListener('click', function () {
    var checked = Array.prototype.map.call(document.querySelectorAll('[data-index]'), function (input) {
      return { index: Number(input.getAttribute('data-index')), checked: input.checked };
    });
    bridge.call('applyCheckedModules', { checked: checked }).then(function (result) {
      setText('pendingSummary', result.ok ? result.message : result.error);
    });
  });
  $('discardPending').addEventListener('click', function () { bridge.call('discardPendingAction', {}).then(loadPending); });
  $('saveFavorite').addEventListener('click', function () { bridge.call('saveFavorite', {}).then(loadPending); });
  $('openLogs').addEventListener('click', function () { bridge.call('openLogs', {}); });

  refreshContext();
  loadPending();
}());
```

- [ ] **Step 2: Validate static files and commit**

Run: `Get-ChildItem -Recurse extension | Select-Object FullName`

Expected: includes manifest, HTML, CSS, JS files.

Commit:

```bash
git add extension
git commit -m "feat: add CEP panel shell"
```

## Task 3: ExtendScript Bridge, Settings, And File IO

**Files:**
- Create: `extension/jsx/json.jsx`
- Create: `extension/jsx/bridge.jsx`

- [ ] **Step 1: Add JSON helpers**

Create `extension/jsx/json.jsx`:

```js
var AECreateJSON = AECreateJSON || {};

AECreateJSON.stringify = function (value) {
  if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(value);
  function esc(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  }
  function write(v) {
    if (v === null) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return '"' + esc(v) + '"';
    if (v instanceof Array) {
      var items = [];
      for (var i = 0; i < v.length; i++) items.push(write(v[i]));
      return '[' + items.join(',') + ']';
    }
    var props = [];
    for (var key in v) if (v.hasOwnProperty(key)) props.push('"' + esc(key) + '":' + write(v[key]));
    return '{' + props.join(',') + '}';
  }
  return write(value);
};

AECreateJSON.parse = function (text) {
  if (typeof JSON !== 'undefined' && JSON.parse) return JSON.parse(text);
  return AECreateJSON.strictParse(text);
};
```

- [ ] **Step 2: Add bridge helpers and CEP entry points**

Create `extension/jsx/bridge.jsx`:

```js
//@include "json.jsx"
//@include "context.jsx"
//@include "actions.jsx"

var AECreateBridge = AECreateBridge || {};

AECreateBridge.extensionRoot = function () {
  return File($.fileName).parent.fsName;
};

AECreateBridge.settingsFile = function () {
  return File(AECreateBridge.extensionRoot() + '/settings.json');
};

AECreateBridge.defaultBridgeDir = function () {
  return Folder.myDocuments.fsName + '/AEcreate/ae-codex-bridge';
};

AECreateBridge.readText = function (file) {
  if (!file.exists) return null;
  file.encoding = 'UTF-8';
  file.open('r');
  var text = file.read();
  file.close();
  return text;
};

AECreateBridge.writeText = function (file, text) {
  var folder = file.parent;
  if (!folder.exists) folder.create();
  file.encoding = 'UTF-8';
  file.open('w');
  file.write(text);
  file.close();
};

AECreateBridge.settings = function () {
  var file = AECreateBridge.settingsFile();
  var defaults = {
    bridgeDir: AECreateBridge.defaultBridgeDir(),
    presetPaths: [],
    historyLimit: 50,
    showAdvancedLogs: false
  };
  var text = AECreateBridge.readText(file);
  if (!text) return defaults;
  try {
    var parsed = AECreateJSON.parse(text);
    if (parsed.bridgeDir) defaults.bridgeDir = parsed.bridgeDir;
    if (parsed.presetPaths instanceof Array) defaults.presetPaths = parsed.presetPaths;
    if (parsed.historyLimit > 0) defaults.historyLimit = parsed.historyLimit;
    defaults.showAdvancedLogs = parsed.showAdvancedLogs === true;
  } catch (error) {}
  return defaults;
};

AECreateBridge.saveSettings = function (settings) {
  AECreateBridge.writeText(AECreateBridge.settingsFile(), AECreateJSON.stringify(settings));
};

AECreateBridge.bridgeFolder = function () {
  var settings = AECreateBridge.settings();
  var folder = Folder(settings.bridgeDir);
  if (!folder.exists) folder.create();
  Folder(folder.fsName + '/history').create();
  Folder(folder.fsName + '/favorites').create();
  Folder(folder.fsName + '/logs').create();
  return folder;
};

AECreateBridge.respond = function (object) {
  return AECreateJSON.stringify(object);
};

AECreateBridge.chooseBridgeFolder = function () {
  var folder = Folder.selectDialog('Choose AEcreate bridge folder');
  if (!folder) return AECreateBridge.respond({ ok: false, error: 'Bridge folder selection cancelled.' });
  var settings = AECreateBridge.settings();
  settings.bridgeDir = folder.fsName;
  AECreateBridge.saveSettings(settings);
  AECreateBridge.bridgeFolder();
  return AECreateBridge.respond({ ok: true, message: 'Bridge folder: ' + folder.fsName });
};

AECreateBridge.openBridgeFolder = function () {
  AECreateBridge.bridgeFolder().execute();
  return AECreateBridge.respond({ ok: true, message: 'Opened bridge folder.' });
};
```

- [ ] **Step 3: Run a syntax smoke check and commit**

Run: `Get-Content extension/jsx/bridge.jsx | Select-String 'AECreateBridge.chooseBridgeFolder'`

Expected: command prints the function name.

Commit:

```bash
git add extension/jsx/json.jsx extension/jsx/bridge.jsx
git commit -m "feat: add JSX bridge settings and file IO"
```

## Task 4: Context Export, Markers, Effects, And Preset Scan

**Files:**
- Create: `extension/jsx/context.jsx`

- [ ] **Step 1: Implement context export**

Create `extension/jsx/context.jsx`:

```js
var AECreateContext = AECreateContext || {};

AECreateContext.activeComp = function () {
  if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) return null;
  return app.project.activeItem;
};

AECreateContext.markerList = function (markerProperty) {
  var output = [];
  if (!markerProperty) return output;
  for (var i = 1; i <= markerProperty.numKeys; i++) {
    var value = markerProperty.keyValue(i);
    output.push({
      index: i,
      time: markerProperty.keyTime(i),
      comment: value.comment,
      chapter: value.chapter,
      cuePointName: value.cuePointName
    });
  }
  return output;
};

AECreateContext.propertyValue = function (property) {
  try {
    if (property.numKeys && property.numKeys > 0) {
      return { value: property.value, keyCount: property.numKeys };
    }
    return { value: property.value, keyCount: 0 };
  } catch (error) {
    return { value: null, error: String(error) };
  }
};

AECreateContext.propertyTree = function (group, depth) {
  var output = [];
  if (!group || depth > 4) return output;
  for (var i = 1; i <= group.numProperties; i++) {
    var prop = group.property(i);
    var record = {
      index: i,
      name: prop.name,
      matchName: prop.matchName,
      propertyType: prop.propertyType
    };
    if (prop.propertyType === PropertyType.PROPERTY) {
      var state = AECreateContext.propertyValue(prop);
      record.value = state.value;
      record.keyCount = state.keyCount;
      if (prop.expressionEnabled) record.expression = prop.expression;
    } else {
      record.children = AECreateContext.propertyTree(prop, depth + 1);
    }
    output.push(record);
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
    panelSettings: AECreateBridge.settings()
  };
  return { ok: true, context: context };
};

AECreateBridge.exportContext = function () {
  var result = AECreateContext.export();
  if (!result.ok) return AECreateBridge.respond(result);
  var folder = AECreateBridge.bridgeFolder();
  AECreateBridge.writeText(File(folder.fsName + '/current-context.json'), AECreateJSON.stringify(result.context));
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
};

AECreateBridge.addMarker = function (payloadText) {
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
};

AECreateBridge.scanPresets = function () {
  var settings = AECreateBridge.settings();
  var paths = settings.presetPaths.slice(0);
  paths.push(Folder.userData.fsName + '/Adobe/After Effects');
  var appPresets = Folder(app.path.fsName + '/Presets');
  if (appPresets.exists) paths.push(appPresets.fsName);
  var records = [];
  for (var i = 0; i < paths.length; i++) {
    AECreateContext.collectPresets(Folder(paths[i]), records);
  }
  var folder = AECreateBridge.bridgeFolder();
  AECreateBridge.writeText(File(folder.fsName + '/preset-cache.json'), AECreateJSON.stringify({
    schemaVersion: 1,
    scannedAt: new Date().toString(),
    presets: records
  }));
  return AECreateBridge.respond({ ok: true, message: 'Scanned ' + records.length + ' presets.' });
};

AECreateContext.collectPresets = function (folder, records) {
  if (!folder.exists) return;
  var items = folder.getFiles();
  for (var i = 0; i < items.length; i++) {
    if (items[i] instanceof Folder) {
      AECreateContext.collectPresets(items[i], records);
    } else if (/\.ffx$/i.test(items[i].name)) {
      records.push({ name: items[i].displayName, path: items[i].fsName, modified: items[i].modified.toString() });
    }
  }
};
```

- [ ] **Step 2: Validate file presence and commit**

Run: `Select-String -Path extension/jsx/context.jsx -Pattern 'propertyTree|scanPresets|addMarker'`

Expected: command prints all three function names.

Commit:

```bash
git add extension/jsx/context.jsx
git commit -m "feat: export AE context and scan presets"
```

## Task 5: Pending Action Reader And Structured Executor

**Files:**
- Create: `extension/jsx/actions.jsx`

- [ ] **Step 1: Implement pending-action reading and module execution**

Create `extension/jsx/actions.jsx`:

```js
var AECreateActions = AECreateActions || {};

AECreateActions.pendingFile = function () {
  return File(AECreateBridge.bridgeFolder().fsName + '/pending-action.json');
};

AECreateActions.log = function (message) {
  var folder = Folder(AECreateBridge.bridgeFolder().fsName + '/logs');
  if (!folder.exists) folder.create();
  var file = File(folder.fsName + '/apply.log');
  file.encoding = 'UTF-8';
  file.open('a');
  file.writeln(new Date().toString() + ' ' + message);
  file.close();
};

AECreateBridge.readPendingAction = function () {
  var file = AECreateActions.pendingFile();
  if (!file.exists) return AECreateBridge.respond({ ok: false, error: 'No pending-action.json found.' });
  try {
    var plan = AECreateJSON.parse(AECreateBridge.readText(file));
    return AECreateBridge.respond({ ok: true, plan: plan });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: 'Could not parse pending-action.json: ' + error });
  }
};

AECreateBridge.discardPendingAction = function () {
  var file = AECreateActions.pendingFile();
  if (file.exists) file.remove();
  return AECreateBridge.respond({ ok: true, message: 'Discarded pending action.' });
};

AECreateBridge.applyCheckedModules = function (payloadText) {
  var payload = AECreateJSON.parse(payloadText || '{}');
  var pending = AECreateJSON.parse(AECreateBridge.readText(AECreateActions.pendingFile()));
  var checkedMap = {};
  for (var i = 0; i < payload.checked.length; i++) checkedMap[payload.checked[i].index] = payload.checked[i].checked;
  var comp = AECreateContext.activeComp();
  if (!comp) return AECreateBridge.respond({ ok: false, error: 'No active composition.' });
  var layer = comp.layer(pending.target.layerIndex);
  if (!layer) return AECreateBridge.respond({ ok: false, error: 'Target layer not found.' });
  var applied = [];
  app.beginUndoGroup('AEcreate Apply Checked Modules');
  try {
    for (var m = 0; m < pending.modules.length; m++) {
      if (checkedMap[m] === false) continue;
      AECreateActions.applyModule(layer, pending.modules[m]);
      applied.push(pending.modules[m].title);
    }
  } catch (error) {
    app.endUndoGroup();
    AECreateActions.log('ERROR ' + error);
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
  app.endUndoGroup();
  AECreateActions.log('Applied: ' + applied.join(', '));
  AECreateActions.writeHistory(pending);
  return AECreateBridge.respond({ ok: true, message: 'Applied modules: ' + applied.join(', ') });
};

AECreateActions.applyModule = function (layer, module) {
  for (var i = 0; i < module.actions.length; i++) {
    AECreateActions.applyAction(layer, module.actions[i]);
  }
};

AECreateActions.applyAction = function (layer, action) {
  if (action.type === 'addEffect') {
    layer.property('ADBE Effect Parade').addProperty(action.matchName || action.name);
    return;
  }
  if (action.type === 'applyPreset') {
    layer.applyPreset(File(action.path));
    return;
  }
  if (action.type === 'setProperty') {
    var prop = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
    prop.setValue(action.value);
    return;
  }
  if (action.type === 'setKeyframes') {
    var keyed = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
    for (var k = 0; k < action.keys.length; k++) keyed.setValueAtTime(action.keys[k].time, action.keys[k].value);
    return;
  }
  if (action.type === 'setExpression') {
    var expressed = AECreateActions.findEffectProperty(layer, action.effectMatchName, action.propertyPath);
    expressed.expression = action.expression;
    expressed.expressionEnabled = true;
    return;
  }
  throw new Error('Unsupported action type: ' + action.type);
};

AECreateActions.findEffectProperty = function (layer, effectMatchName, propertyPath) {
  var effects = layer.property('ADBE Effect Parade');
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
  var folder = Folder(AECreateBridge.bridgeFolder().fsName + '/history');
  if (!folder.exists) folder.create();
  var name = 'plan-' + new Date().getTime() + '.json';
  AECreateBridge.writeText(File(folder.fsName + '/' + name), AECreateJSON.stringify(plan));
};

AECreateBridge.saveFavorite = function () {
  var file = AECreateActions.pendingFile();
  if (!file.exists) return AECreateBridge.respond({ ok: false, error: 'No pending action to save.' });
  var plan = AECreateJSON.parse(AECreateBridge.readText(file));
  var folder = Folder(AECreateBridge.bridgeFolder().fsName + '/favorites');
  if (!folder.exists) folder.create();
  AECreateBridge.writeText(File(folder.fsName + '/' + plan.title.replace(/[\\\/:*?"<>|]/g, '_') + '.json'), AECreateJSON.stringify(plan));
  return AECreateBridge.respond({ ok: true, message: 'Saved favorite: ' + plan.title });
};

AECreateBridge.openLogs = function () {
  Folder(AECreateBridge.bridgeFolder().fsName + '/logs').execute();
  return AECreateBridge.respond({ ok: true, message: 'Opened logs.' });
};
```

- [ ] **Step 2: Validate action types and commit**

Run: `Select-String -Path extension/jsx/actions.jsx -Pattern 'addEffect|applyPreset|setProperty|setKeyframes|setExpression'`

Expected: command prints all structured action branches.

Commit:

```bash
git add extension/jsx/actions.jsx
git commit -m "feat: apply checked effect modules"
```

## Task 6: Development Install Helper And Usage Docs

**Files:**
- Create: `scripts/install-dev.ps1`
- Create: `docs/manual-test-checklist.md`
- Modify: `README.md`

- [ ] **Step 1: Add install helper**

Create `scripts/install-dev.ps1`:

```powershell
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "extension"
$targetRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$target = Join-Path $targetRoot "com.aecreate.codexbridge"

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
if (Test-Path $target) {
  Remove-Item -LiteralPath $target -Recurse -Force
}
Copy-Item -LiteralPath $source -Destination $target -Recurse

Write-Host "Installed AEcreate CEP panel to $target"
Write-Host "Restart After Effects, then open Window > Extensions > AEcreate Codex Bridge."
```

- [ ] **Step 2: Add manual AE checklist**

Create `docs/manual-test-checklist.md`:

```md
# Manual AE Test Checklist

- [ ] Run `powershell -ExecutionPolicy Bypass -File scripts/install-dev.ps1`.
- [ ] Restart After Effects 2025.
- [ ] Open `Window > Extensions > AEcreate Codex Bridge`.
- [ ] Choose a bridge folder outside video/material folders.
- [ ] Open a test composition.
- [ ] Select one layer.
- [ ] Add a `kill_icon` marker from the panel.
- [ ] Click `Refresh Context`.
- [ ] Confirm `current-context.json` exists in the bridge folder.
- [ ] Click `Scan Presets`.
- [ ] Confirm `preset-cache.json` exists and includes `.ffx` files.
- [ ] Add a test `pending-action.json` that applies a harmless preset or changes an existing effect property.
- [ ] Confirm the pending plan appears with module checkboxes.
- [ ] Apply one checked module.
- [ ] Confirm the effect appears or updates on the selected layer.
- [ ] Press Ctrl+Z once in AE and confirm the full applied module reverts.
- [ ] Save the pending plan as a favorite.
- [ ] Confirm logs are written in the bridge folder.
```

- [ ] **Step 3: Update README**

Replace `README.md` with:

```md
# AEcreate

AEcreate is a dockable After Effects CEP panel for Codex-driven effect control.

V1 uses a local bridge folder:

1. AE exports selected-layer context, markers, existing effects, and preset metadata.
2. Codex reads that context and writes `pending-action.json`.
3. The AE panel displays checkable modules.
4. The user applies checked modules inside AE.

## Install For Development

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-dev.ps1
```

Restart After Effects, then open:

`Window > Extensions > AEcreate Codex Bridge`

## Test

```powershell
npm test
```

## Design

- `docs/superpowers/specs/2026-05-12-ae-codex-effect-bridge-design.md`
- `docs/superpowers/plans/2026-05-12-ae-codex-effect-bridge-implementation.md`

## Safety

Keep project media, AE project files, renders, and bridge runtime data outside this repo. The `.gitignore` excludes common media, AE project, and bridge-output files.
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add scripts/install-dev.ps1 docs/manual-test-checklist.md README.md
git commit -m "docs: add install and manual test workflow"
```

## Task 7: Manual Pending Action Fixture

**Files:**
- Create: `examples/pending-actions/opacity-pulse.json`
- Modify: `docs/manual-test-checklist.md`

- [ ] **Step 1: Add a safe pending-action example**

Create `examples/pending-actions/opacity-pulse.json`:

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-05-12T12:30:00+08:00",
  "contextFingerprint": "replace-with-current-context-fingerprint",
  "title": "Opacity Pulse Test",
  "summary": "Creates a short opacity pulse on the selected target layer.",
  "target": {
    "compId": "active",
    "layerIndex": 1,
    "layerName": "Selected Layer"
  },
  "modules": [
    {
      "id": "opacity-pulse",
      "title": "Opacity Pulse",
      "summary": "Sets opacity keyframes at 0s, 0.1s, and 0.2s for a harmless apply test.",
      "checked": true,
      "actions": [
        {
          "type": "setKeyframes",
          "effectMatchName": "ADBE Transform Group",
          "propertyPath": ["ADBE Opacity"],
          "keys": [
            { "time": 0, "value": 100 },
            { "time": 0.1, "value": 35 },
            { "time": 0.2, "value": 100 }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Update executor to support transform property paths**

Modify `extension/jsx/actions.jsx` inside `AECreateActions.findEffectProperty` so it can resolve transform properties:

```js
AECreateActions.findEffectProperty = function (layer, effectMatchName, propertyPath) {
  var prop;
  if (effectMatchName === 'ADBE Transform Group') {
    prop = layer.property('ADBE Transform Group');
  } else {
    var effects = layer.property('ADBE Effect Parade');
    var effect = null;
    for (var i = 1; i <= effects.numProperties; i++) {
      var candidate = effects.property(i);
      if (candidate.matchName === effectMatchName || candidate.name === effectMatchName) {
        effect = candidate;
        break;
      }
    }
    if (!effect) throw new Error('Effect not found: ' + effectMatchName);
    prop = effect;
  }
  for (var p = 0; p < propertyPath.length; p++) {
    prop = prop.property(propertyPath[p]);
    if (!prop) throw new Error('Property not found: ' + propertyPath.join(' > '));
  }
  return prop;
};
```

- [ ] **Step 3: Update manual checklist with fixture copy command**

Add this line after the `pending-action.json` checklist item:

```md
- [ ] For a safe first apply test, copy `examples/pending-actions/opacity-pulse.json` to `<bridge-folder>/pending-action.json`, then set `target.layerIndex` and `contextFingerprint` to the values shown in `current-context.json`.
```

- [ ] **Step 4: Commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add examples/pending-actions/opacity-pulse.json extension/jsx/actions.jsx docs/manual-test-checklist.md
git commit -m "test: add safe pending action fixture"
```

## Task 8: Final Verification And Remote Prep

**Files:**
- Modify only if verification reveals a concrete issue.

- [ ] **Step 1: Run repository verification**

Run:

```powershell
npm test
git status --short
git ls-files
```

Expected:

- `npm test` passes.
- `git status --short` shows no uncommitted files after commits.
- `git ls-files` lists project files only, with no `.aep`, media, bridge runtime data, or rendered outputs.

- [ ] **Step 2: Verify install copy command on disk**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-dev.ps1
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.aecreate.codexbridge\CSXS\manifest.xml"
```

Expected: `True`.

- [ ] **Step 3: Commit any verification fixes**

If files changed during verification:

```bash
git add <changed-project-files>
git commit -m "fix: resolve verification issues"
```

- [ ] **Step 4: Push when GitHub access works**

Run:

```bash
git remote -v
git push -u origin main
```

Expected: push succeeds after the GitHub repository is reachable and the local environment is authenticated.

## Self-Review Notes

- Spec coverage: Tasks cover CEP shell, user-selected bridge folder, context export, marker anchors, preset scanning, pending plans, checkable modules, structured action execution, history/favorites, logs, install, and manual AE verification.
- Universal effect support: Task 4 exports existing effect property trees and scans `.ffx`; Task 5 supports structured effect/preset/property/keyframe/expression actions.
- Natural-language editing support: Codex has enough context to produce `modify existing effect` plans through `setProperty`, `setKeyframes`, and `setExpression`; specialized adapters can generate the same action schema.
- Safety: The panel applies only checked modules and wraps execution in one AE undo group.
- Repository boundary: `.gitignore` excludes local AE projects, media, renders, and bridge runtime data.
