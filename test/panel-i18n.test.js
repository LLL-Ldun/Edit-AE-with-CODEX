const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadI18n() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'js', 'panel-i18n.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'panel-i18n.js' });
  return context.window.AECreatePanelI18n;
}

function fakeElement(key) {
  return {
    textContent: '',
    getAttribute(name) {
      return name === 'data-i18n' ? key : null;
    }
  };
}

test('panel i18n defaults to Chinese and falls back for unknown language codes', () => {
  const i18n = loadI18n();

  assert.equal(i18n.normalizeLanguage('zh'), 'zh');
  assert.equal(i18n.normalizeLanguage('en'), 'en');
  assert.equal(i18n.normalizeLanguage('fr'), 'zh');
  assert.equal(i18n.t('zh', 'refreshContext'), '刷新上下文');
  assert.equal(i18n.t('en', 'refreshContext'), 'Refresh Context');
  assert.equal(i18n.t('zh', 'refreshPending'), '刷新方案');
  assert.equal(i18n.t('en', 'refreshPending'), 'Refresh Plan');
  assert.equal(i18n.t('zh', 'pendingArchiveTitle'), '历史方案');
  assert.equal(i18n.t('en', 'pendingArchiveTitle'), 'Plan History');
  assert.equal(i18n.t('zh', 'deleteArchive'), '删除');
  assert.equal(i18n.t('en', 'deleteArchive'), 'Delete');
  assert.equal(i18n.t('zh', 'restoreArchive'), '恢复');
  assert.equal(i18n.t('en', 'restoreArchive'), 'Restore');
  assert.equal(i18n.t('zh', 'markerTargetLabel'), '标记目标');
  assert.equal(i18n.t('en', 'markerTargetLabel'), 'Marker Target');
  assert.equal(i18n.t('zh', 'pendingTargetLabel'), '目标');
  assert.equal(i18n.t('en', 'pendingWarningLabel'), 'Warning');
  assert.equal(i18n.t('zh', 'effectParamsTitle'), '插件参数库');
  assert.equal(i18n.t('en', 'scanEffectParams'), 'Scan Plugin');
  assert.equal(i18n.t('zh', 'scanSelectedEffects'), '扫描勾选插件');
  assert.equal(i18n.t('en', 'effectFilterUnscanned'), 'Unscanned');
  assert.equal(i18n.t('zh', 'effectFilterWorkflowKnown'), '已入库');
  assert.equal(i18n.t('en', 'effectFilterWorkflowKnown'), 'In Workflow Library');
  assert.equal(i18n.t('zh', 'effectFilterWorkflowUnknown'), '未入库');
  assert.equal(i18n.t('en', 'effectFilterWorkflowUnknown'), 'Not In Workflow Library');
  assert.equal(i18n.t('zh', 'effectStatusScanned'), '已扫描');
  assert.equal(i18n.t('zh', 'effectScanProgress'), '本次勾选 {selected} 个，已扫描 {scanned} 个，失败 {failed} 个。');
  assert.equal(i18n.t('en', 'effectScanProgress'), 'Selected {selected} plugins, scanned {scanned}, failed {failed}.');
  assert.equal(i18n.t('en', 'effectStatusNoneSelected'), 'Select plugins to scan first.');
  assert.equal(i18n.t('zh', 'effectWorkflowKnown'), 'Workflow: 已入库');
  assert.equal(i18n.t('en', 'effectWorkflowUnknown'), 'Workflow: Not In Library');
  assert.equal(i18n.t('zh', 'gpuModeIntegratedSafe'), '集显/安全');
  assert.equal(i18n.t('en', 'gpuModeDiscretePerformance'), 'Discrete/Performance');
});

test('panel i18n applies translated static text to DOM nodes', () => {
  const i18n = loadI18n();
  const title = fakeElement('contextTitle');
  const button = fakeElement('applyChecked');
  const documentElement = {
    lang: '',
    setAttribute(name, value) {
      if (name === 'lang') this.lang = value;
    }
  };
  const document = {
    documentElement,
    querySelectorAll(selector) {
      return selector === '[data-i18n]' ? [title, button] : [];
    }
  };

  i18n.apply(document, 'zh');
  assert.equal(documentElement.lang, 'zh-CN');
  assert.equal(title.textContent, '上下文');
  assert.equal(button.textContent, '应用勾选');

  i18n.apply(document, 'en');
  assert.equal(documentElement.lang, 'en');
  assert.equal(title.textContent, 'Context');
  assert.equal(button.textContent, 'Apply Checked');
});
