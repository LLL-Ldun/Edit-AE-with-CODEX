const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadContextHelpers() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'context.jsx'), 'utf8');
  const context = {
    AECreateContext: {},
    AECreateBridge: {},
    AECreateJSON: JSON,
    app: {}
  };
  vm.runInNewContext(source, context, { filename: 'context.jsx' });
  return context.AECreateContext;
}

test('preset search paths include user Documents AE presets root', () => {
  const helpers = loadContextHelpers();

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
