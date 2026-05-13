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
    ...extraContext
  };
  vm.runInNewContext(source, context, { filename: 'context.jsx' });
  return { helpers: context.AECreateContext, context };
}

test('preset search paths include user Documents AE presets root', () => {
  const { helpers } = loadContextHelpers();

  const paths = helpers.presetSearchPaths(
    { presetPaths: ['D:/Custom Presets'] },
    {
      userData: 'C:/Users/16693/AppData/Roaming',
      myDocuments: 'C:/Users/16693/Documents',
      appPath: 'C:/Program Files/Adobe/Adobe After Effects 2025/Support Files'
    }
  );

  assert.equal(JSON.stringify(paths), JSON.stringify([
    'D:/Custom Presets',
    'C:/Users/16693/AppData/Roaming/Adobe/After Effects',
    'C:/Users/16693/Documents/Adobe/After Effects',
    'C:/Program Files/Adobe/Adobe After Effects 2025/Support Files/Presets'
  ]));
});

test('collectPresets records source path and relative category', () => {
  function Folder(fsName, items = []) {
    this.fsName = fsName;
    this.name = fsName.split('/').pop();
    this.exists = true;
    this.getFiles = () => items;
  }
  function File(fsName) {
    this.fsName = fsName;
    this.name = fsName.split('/').pop();
    this.displayName = this.name;
    this.modified = { toString: () => 'modified' };
  }
  const preset = new File('C:/Presets/Sub/shake.ffx');
  const sub = new Folder('C:/Presets/Sub', [preset]);
  const root = new Folder('C:/Presets', [sub]);
  const { helpers } = loadContextHelpers({ Folder });
  const records = [];

  helpers.collectPresets(root, records, { seen: {}, errors: [], truncated: false, maxDepth: 8, maxRecords: 20 }, 0);

  assert.equal(records.length, 1);
  assert.equal(records[0].sourcePath, 'C:/Presets');
  assert.equal(records[0].relativePath, 'Sub/shake.ffx');
  assert.equal(records[0].category, 'Sub');
});

test('availableEffectsList exports installed effect metadata when AE exposes it', () => {
  const { helpers } = loadContextHelpers({
    app: {
      effects: [{
        displayName: 'Deep Glow',
        matchName: 'Deep Glow',
        category: 'Effects'
      }]
    }
  });

  assert.equal(JSON.stringify(helpers.availableEffectsList()), JSON.stringify([{
    name: 'Deep Glow',
    matchName: 'Deep Glow',
    category: 'Effects'
  }]));
});

test('layerRecord includes source and transform context', () => {
  const { helpers } = loadContextHelpers({
    PropertyType: { PROPERTY: 1 }
  });
  const emptyGroup = { numProperties: 0 };
  const layer = {
    index: 2,
    name: 'Clip',
    inPoint: 1,
    outPoint: 3,
    startTime: 0,
    selected: true,
    source: {
      name: 'clip.mp4',
      duration: 10,
      file: { fsName: 'C:/Media/clip.mp4' }
    },
    property(name) {
      if (name === 'Marker') return { numKeys: 0 };
      return emptyGroup;
    }
  };

  const record = helpers.layerRecord(layer);

  assert.equal(JSON.stringify(record.source), JSON.stringify({ name: 'clip.mp4', duration: 10, path: 'C:/Media/clip.mp4' }));
  assert.equal(JSON.stringify(record.transform), JSON.stringify([]));
});
