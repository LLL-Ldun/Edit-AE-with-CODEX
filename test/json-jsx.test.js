const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadParserWithoutNativeJson() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'jsx', 'json.jsx'), 'utf8');
  const context = { JSON: undefined, isFinite, Number, String, RegExp, parseInt, Error };
  vm.runInNewContext(source, context, { filename: 'json.jsx' });
  return context.AECreateJSON;
}

test('JSX JSON fallback parses valid JSON without native JSON', () => {
  const parser = loadParserWithoutNativeJson();

  const parsed = parser.parse('{"name":"Glow","keys":[0,0.1,true,null],"nested":{"x":1}}');
  const expected = {
    name: 'Glow',
    keys: [0, 0.1, true, null],
    nested: { x: 1 }
  };

  assert.equal(JSON.stringify(parsed), JSON.stringify(expected));
});

test('JSX JSON fallback rejects executable trailing content', () => {
  const parser = loadParserWithoutNativeJson();

  assert.throws(
    () => parser.parse('{"ok":true}; alert("bad")'),
    /Invalid JSON: unexpected trailing content/
  );
});
