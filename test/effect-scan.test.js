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
