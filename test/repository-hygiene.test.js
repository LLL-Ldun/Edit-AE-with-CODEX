const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

function gitTrackedFiles() {
  return execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim().split(/\r?\n/).filter(Boolean);
}

test('complete design and implementation planning docs are not tracked publicly', () => {
  const tracked = gitTrackedFiles();
  const privateDesignDocs = tracked.filter((file) => (
    file.startsWith('docs/superpowers/specs/') ||
    file.startsWith('docs/superpowers/plans/') ||
    /private-complete-design/i.test(file)
  ));

  assert.deepEqual(privateDesignDocs, []);
});

test('public docs do not link to private complete design paths', () => {
  const publicDocs = [
    'README.md',
    'docs/public-update-log.md',
    'docs/plugin-workflow-library.md',
    'docs/manual-test-checklist.md'
  ];

  for (const relativePath of publicDocs) {
    const fullPath = path.join(repoRoot, relativePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(content, /docs\/superpowers\/(?:specs|plans)\//, relativePath);
    assert.doesNotMatch(content, /private-complete-design/i, relativePath);
  }
});
