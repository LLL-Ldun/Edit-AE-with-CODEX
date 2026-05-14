const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

test('panel renders pending modules as list rows with action counts', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'js', 'panel.js'), 'utf8');
  const elements = createPanelElements();
  const calls = [];

  function BridgeClient() {}
  BridgeClient.prototype.call = function call(name, payload) {
    calls.push({ name, payload });
    if (name === 'readPendingAction') {
      return Promise.resolve({
        ok: true,
        plan: {
          archiveId: 'current-id',
          title: 'Glow Plan',
          summary: 'Apply glow at markers.',
          target: { layerIndex: 3, layerName: 'Clip 03' },
          modules: [{
            id: 'm1',
            title: 'Deep Glow',
            summary: 'Pulse the selected adjustment layer.',
            warnings: ['Deep Glow must be installed.'],
            requires: ['Deep Glow'],
            checked: true,
            actions: [{ type: 'addEffect' }, { type: 'setKeyframes' }]
          }]
        },
        archive: {
          plans: [{
            id: 'old-id',
            savedAt: '2026-05-13T13:35:00+08:00',
            plan: {
              title: 'Old Shake Plan',
              summary: 'Use shake preset.',
              modules: [{ actions: [{ type: 'applyPreset' }] }]
            }
          }]
        }
      });
    }
    if (name === 'restorePendingAction') {
      return Promise.resolve({
        ok: true,
        plan: { title: 'Old Shake Plan', summary: 'Use shake preset.', modules: [] },
        archive: { plans: [] },
        message: 'Restored pending plan.'
      });
    }
    if (name === 'getSettings') return Promise.resolve({ ok: true, settings: { presetPaths: [] } });
    if (name === 'exportContext') return Promise.resolve({ ok: true, message: 'exported' });
    return Promise.resolve({ ok: true });
  };

  const context = {
    window: {
      AECreateBridgeClient: BridgeClient,
      AECreatePanelI18n: createI18n(),
      localStorage: createStorage()
    },
    document: createDocument(elements),
    Promise,
    Number,
    Array,
    String,
    prompt() {
      return null;
    }
  };

  vm.runInNewContext(source, context, { filename: 'panel.js' });
  await Promise.resolve();
  await Promise.resolve();

  assert.ok(calls.some((call) => call.name === 'readPendingAction'));
  assert.equal(calls.some((call) => call.name === 'exportContext'), false);
  assert.match(elements.pendingSummary.textContent, /Glow Plan\nApply glow at markers\./);
  assert.match(elements.pendingSummary.textContent, /Target: Clip 03 \(#3\)/);
  assert.equal(elements.moduleList.children.length, 1);
  assert.equal(elements.moduleList.children[0].querySelector('.module-title').textContent, 'Deep Glow');
  assert.equal(
    elements.moduleList.children[0].querySelector('.module-summary').textContent,
    'Pulse the selected adjustment layer.'
  );
  assert.equal(elements.moduleList.children[0].querySelector('.module-meta').textContent, '2 actions');
  assert.equal(elements.moduleList.children[0].querySelector('.module-warning').textContent, 'Warning: Deep Glow must be installed.');
  assert.equal(elements.moduleList.children[0].querySelector('.module-requirement').textContent, 'Requires: Deep Glow');
  assert.equal(elements.pendingArchiveList.children.length, 1);
  assert.equal(elements.pendingArchiveList.children[0].querySelector('.archive-title').textContent, 'Old Shake Plan');

  elements.pendingArchiveList.children[0].listeners.click();
  await Promise.resolve();
  assert.ok(calls.some((call) => call.name === 'restorePendingAction'));
});

test('panel localizes pending and archived plan text from the selected language', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'js', 'panel.js'), 'utf8');
  const elements = createPanelElements();
  const calls = [];

  function BridgeClient() {}
  BridgeClient.prototype.call = function call(name, payload) {
    calls.push({ name, payload });
    if (name === 'readPendingAction') {
      return Promise.resolve({
        ok: true,
        plan: {
          archiveId: 'current-id',
          title: 'Fallback Plan',
          titleI18n: { zh: '中文当前方案', en: 'English Current Plan' },
          summary: 'Fallback summary.',
          summaryI18n: { zh: '中文当前摘要。', en: 'English current summary.' },
          target: { layerIndex: 1, layerName: 'Clip' },
          modules: [{
            id: 'm1',
            title: 'Fallback Module',
            titleI18n: { zh: '中文模块', en: 'English Module' },
            summary: 'Fallback module summary.',
            summaryI18n: { zh: '中文模块摘要。', en: 'English module summary.' },
            warnings: ['Fallback warning'],
            warningsI18n: { zh: ['中文警告'], en: ['English warning'] },
            requires: ['Fallback requirement'],
            requiresI18n: { zh: ['中文依赖'], en: ['English requirement'] },
            actions: [{ type: 'addEffect' }]
          }]
        },
        archive: {
          plans: [{
            id: 'old-id',
            actionCount: 2,
            title: 'Fallback Archive',
            summary: 'Fallback archive summary.',
            plan: {
              title: 'Fallback Archive',
              titleI18n: { zh: '中文历史方案', en: 'English Archive Plan' },
              summary: 'Fallback archive summary.',
              summaryI18n: { zh: '中文历史摘要。', en: 'English archive summary.' },
              modules: [{ actions: [{ type: 'addEffect' }, { type: 'setProperty' }] }]
            }
          }]
        }
      });
    }
    if (name === 'applyCheckedModules') {
      return Promise.resolve({ ok: true, message: 'Applied modules: Fallback Module' });
    }
    if (name === 'getSettings') return Promise.resolve({ ok: true, settings: { presetPaths: [] } });
    return Promise.resolve({ ok: true });
  };

  const context = {
    window: {
      AECreateBridgeClient: BridgeClient,
      AECreatePanelI18n: createI18n('zh'),
      localStorage: createStorage('zh')
    },
    document: createDocument(elements),
    Promise,
    Number,
    Array,
    String,
    prompt() {
      return null;
    }
  };

  vm.runInNewContext(source, context, { filename: 'panel.js' });
  await Promise.resolve();
  await Promise.resolve();

  assert.match(elements.pendingSummary.textContent, /中文当前方案\n中文当前摘要。/);
  assert.equal(elements.moduleList.children[0].querySelector('.module-title').textContent, '中文模块');
  assert.equal(elements.moduleList.children[0].querySelector('.module-summary').textContent, '中文模块摘要。');
  assert.equal(elements.moduleList.children[0].querySelector('.module-warning').textContent, '警告: 中文警告');
  assert.equal(elements.moduleList.children[0].querySelector('.module-requirement').textContent, '依赖: 中文依赖');
  assert.equal(elements.pendingArchiveList.children[0].querySelector('.archive-title').textContent, '中文历史方案');

  elements.moduleList.children[0].querySelector('[data-index]').checked = true;
  elements.applyChecked.listeners.click();
  await Promise.resolve();
  assert.equal(elements.pendingSummary.textContent, '已应用模块: 中文模块');

  elements.languageSelect.value = 'en';
  elements.languageSelect.listeners.change.call(elements.languageSelect);

  assert.match(elements.pendingSummary.textContent, /English Current Plan\nEnglish current summary\./);
  assert.equal(elements.moduleList.children[0].querySelector('.module-title').textContent, 'English Module');
  assert.equal(elements.moduleList.children[0].querySelector('.module-summary').textContent, 'English module summary.');
  assert.equal(elements.moduleList.children[0].querySelector('.module-warning').textContent, 'Warning: English warning');
  assert.equal(elements.moduleList.children[0].querySelector('.module-requirement').textContent, 'Requires: English requirement');
  assert.equal(elements.pendingArchiveList.children[0].querySelector('.archive-title').textContent, 'English Archive Plan');

  elements.moduleList.children[0].querySelector('[data-index]').checked = true;
  elements.applyChecked.listeners.click();
  await Promise.resolve();
  assert.equal(elements.pendingSummary.textContent, 'Applied modules: English Module');
  assert.ok(calls.some((call) => call.name === 'readPendingAction'));
});

test('panel lets users review and edit action parameters before applying', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'js', 'panel.js'), 'utf8');
  const elements = createPanelElements();
  const calls = [];

  function BridgeClient() {}
  BridgeClient.prototype.call = function call(name, payload) {
    calls.push({ name, payload });
    if (name === 'readPendingAction') {
      return Promise.resolve({
        ok: true,
        plan: {
          schemaVersion: 1,
          createdAt: '2026-05-14T10:00:00+08:00',
          contextFingerprint: 'fingerprint',
          archiveId: 'current-id',
          title: 'Parameter Plan',
          summary: 'Tune parameters before applying.',
          target: { compId: 'active', layerIndex: 1, layerName: 'Clip' },
          modules: [{
            id: 'm1',
            title: 'Glow Params',
            summary: 'Adjust intensity and pulse.',
            checked: true,
            actions: [
              {
                type: 'addSolidLayer',
                ref: 'particles',
                name: 'AEcreate particles',
                color: [0, 0, 0],
                width: 2560,
                height: 1440,
                duration: 5,
                startTime: 27.85
              },
              {
                type: 'setProperty',
                effectMatchName: 'Deep Glow',
                propertyPath: ['Glow Radius'],
                value: 35
              },
              {
                type: 'setKeyframes',
                effectMatchName: 'Deep Glow',
                propertyPath: ['Exposure'],
                keys: [
                  { time: 1.25, value: 0.4 },
                  { time: 1.75, value: 1.2 }
                ]
              }
            ]
          }]
        },
        archive: { plans: [] }
      });
    }
    if (name === 'applyCheckedModules') {
      return Promise.resolve({ ok: true, message: 'Applied modules: Glow Params' });
    }
    if (name === 'getSettings') return Promise.resolve({ ok: true, settings: { presetPaths: [] } });
    return Promise.resolve({ ok: true });
  };

  const context = {
    window: {
      AECreateBridgeClient: BridgeClient,
      AECreatePanelI18n: createI18n('zh'),
      localStorage: createStorage('zh')
    },
    document: createDocument(elements),
    Promise,
    Number,
    Array,
    String,
    JSON,
    prompt() {
      return null;
    }
  };

  vm.runInNewContext(source, context, { filename: 'panel.js' });
  await Promise.resolve();
  await Promise.resolve();

  const parameterInputs = elements.moduleList.querySelectorAll('[data-param-edit]');
  assert.equal(parameterInputs.length, 11);
  assert.equal(parameterInputs[0].value, 'AEcreate particles');
  assert.equal(parameterInputs[6].value, '35');
  assert.match(combinedText(elements.moduleList), /图层: particles \| 名称/);
  assert.match(combinedText(elements.moduleList), /图层: particles \| 持续时间/);
  assert.match(combinedText(elements.moduleList), /效果: Deep Glow > Glow Radius \| 数值/);
  assert.match(combinedText(elements.moduleList), /效果: Deep Glow > Exposure \| 关键帧 2 数值/);
  assert.doesNotMatch(combinedText(elements.moduleList), /keys\[1\]\.value|duration|startTime/);

  elements.languageSelect.value = 'en';
  elements.languageSelect.listeners.change.call(elements.languageSelect);
  assert.match(combinedText(elements.moduleList), /Layer: particles \| Name/);
  assert.match(combinedText(elements.moduleList), /Layer: particles \| Duration/);
  assert.match(combinedText(elements.moduleList), /Effect: Deep Glow > Glow Radius \| Value/);
  assert.match(combinedText(elements.moduleList), /Effect: Deep Glow > Exposure \| Keyframe 2 Value/);

  const englishInputs = elements.moduleList.querySelectorAll('[data-param-edit]');
  englishInputs[6].value = '64';
  englishInputs[9].value = '2.00';
  englishInputs[10].value = '1.8';

  elements.moduleList.children[0].querySelector('[data-index]').checked = true;
  elements.applyChecked.listeners.click();
  await Promise.resolve();

  const applyCall = calls.find((call) => call.name === 'applyCheckedModules');
  assert.equal(applyCall.payload.plan.modules[0].actions[1].value, 64);
  assert.equal(applyCall.payload.plan.modules[0].actions[2].keys[1].time, 2);
  assert.equal(applyCall.payload.plan.modules[0].actions[2].keys[1].value, 1.8);
});

test('marker buttons use the selected marker target', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'js', 'panel.js'), 'utf8');
  const elements = createPanelElements();
  elements.markerTarget.value = 'comp';
  const calls = [];

  function BridgeClient() {}
  BridgeClient.prototype.call = function call(name, payload) {
    calls.push({ name, payload });
    if (name === 'readPendingAction') return Promise.resolve({ ok: false, error: 'No pending.' });
    if (name === 'listPendingArchive') return Promise.resolve({ ok: true, archive: { plans: [] } });
    if (name === 'getSettings') return Promise.resolve({ ok: true, settings: { presetPaths: [] } });
    if (name === 'exportContext') return Promise.resolve({ ok: true, message: 'exported' });
    return Promise.resolve({ ok: true });
  };

  const context = {
    window: {
      AECreateBridgeClient: BridgeClient,
      AECreatePanelI18n: createI18n(),
      localStorage: createStorage()
    },
    document: createDocument(elements),
    Promise,
    Number,
    Array,
    String,
    prompt() {
      return null;
    }
  };

  vm.runInNewContext(source, context, { filename: 'panel.js' });
  await Promise.resolve();
  elements.markerButtons[0].listeners.click();
  await Promise.resolve();

  const markerCall = calls.find((call) => call.name === 'addMarker');
  assert.equal(JSON.stringify(markerCall.payload), JSON.stringify({ name: 'kill_icon', target: 'comp' }));
});

test('plugin scan buttons send the requested effect query', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'js', 'panel.js'), 'utf8');
  const elements = createPanelElements();
  elements.effectScanQuery.value = 'tc Particular';
  const calls = [];

  function BridgeClient() {}
  BridgeClient.prototype.call = function call(name, payload) {
    calls.push({ name, payload });
    if (name === 'readPendingAction') return Promise.resolve({ ok: false, error: 'No pending.' });
    if (name === 'listPendingArchive') return Promise.resolve({ ok: true, archive: { plans: [] } });
    if (name === 'getSettings') return Promise.resolve({ ok: true, settings: { presetPaths: [] } });
    if (name === 'scanEffectParams') {
      return Promise.resolve({ ok: true, message: 'Scanned Trapcode Particular.', outputPath: 'C:/bridge/effect-params/tc-Particular.json' });
    }
    return Promise.resolve({ ok: true });
  };

  const context = {
    window: {
      AECreateBridgeClient: BridgeClient,
      AECreatePanelI18n: createI18n(),
      localStorage: createStorage()
    },
    document: createDocument(elements),
    Promise,
    Number,
    Array,
    String,
    prompt() {
      return null;
    },
    confirm() {
      return true;
    }
  };

  vm.runInNewContext(source, context, { filename: 'panel.js' });
  await Promise.resolve();
  elements.scanEffectParams.listeners.click();
  await Promise.resolve();

  const scanCall = calls.find((call) => call.name === 'scanEffectParams');
  assert.equal(JSON.stringify(scanCall.payload), JSON.stringify({ query: 'tc Particular' }));
  assert.match(elements.effectScanStatus.textContent, /Scanned Trapcode Particular/);
  assert.match(elements.effectScanStatus.textContent, /tc-Particular\.json/);
});

test('plugin search suggestions filter installed effects while typing', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension', 'js', 'panel.js'), 'utf8');
  const elements = createPanelElements();
  const calls = [];

  function BridgeClient() {}
  BridgeClient.prototype.call = function call(name, payload) {
    calls.push({ name, payload });
    if (name === 'readPendingAction') return Promise.resolve({ ok: false, error: 'No pending.' });
    if (name === 'listPendingArchive') return Promise.resolve({ ok: true, archive: { plans: [] } });
    if (name === 'getSettings') return Promise.resolve({ ok: true, settings: { presetPaths: [] } });
    if (name === 'listAvailableEffects') {
      return Promise.resolve({
        ok: true,
        effects: [
          { name: 'Pastiche', matchName: 'MB Pastiche', category: 'Motion Boutique' },
          { name: 'Pixel Sorter 3', matchName: 'GG PixelSorter3', category: 'Pixel Sorter Studio' },
          { name: 'Potok', matchName: 'irrealix Potok', category: 'irrealix' }
        ]
      });
    }
    return Promise.resolve({ ok: true });
  };

  const context = {
    window: {
      AECreateBridgeClient: BridgeClient,
      AECreatePanelI18n: createI18n(),
      localStorage: createStorage()
    },
    document: createDocument(elements),
    Promise,
    Number,
    Array,
    String,
    prompt() {
      return null;
    },
    confirm() {
      return true;
    }
  };

  vm.runInNewContext(source, context, { filename: 'panel.js' });
  await Promise.resolve();
  await Promise.resolve();

  elements.effectScanQuery.value = 'p';
  elements.effectScanQuery.listeners.input();
  await Promise.resolve();
  assert.equal(elements.effectSuggestionList.children.length, 3);
  assert.equal(elements.effectSuggestionList.children[1].querySelector('.effect-suggestion-title').textContent, 'Pixel Sorter 3');

  elements.effectScanQuery.value = 'pix';
  elements.effectScanQuery.listeners.input();
  assert.equal(elements.effectSuggestionList.children.length, 1);
  elements.effectSuggestionList.children[0].listeners.click();
  assert.equal(elements.effectScanQuery.value, 'Pixel Sorter 3');
  assert.equal(elements.effectSuggestionList.children.length, 0);
  assert.ok(calls.some((call) => call.name === 'listAvailableEffects'));
});

function createPanelElements() {
  const ids = [
    'languageSelect',
    'pendingSummary',
    'moduleList',
    'pendingArchiveList',
    'contextStatus',
    'markerList',
    'markerTarget',
    'presetPathList',
    'presetStatus',
    'effectScanQuery',
    'effectSuggestionList',
    'effectScanStatus',
    'refreshContext',
    'refreshPending',
    'chooseBridge',
    'openBridge',
    'scanPresets',
    'addPresetPath',
    'clearPresetPaths',
    'scanEffectParams',
    'scanAllEffectParams',
    'customMarker',
    'applyChecked',
    'discardPending',
    'saveFavorite',
    'openLogs'
  ];
  const elements = {};
  ids.forEach((id) => {
    elements[id] = createElement(id);
  });
  elements.markerTarget.value = 'layer';
  return elements;
}

function createDocument(elements) {
  const markerButtons = [createElement('markerKill')];
  elements.markerButtons = markerButtons;
  markerButtons[0].getAttribute = function getAttribute(name) {
    return name === 'data-marker' ? 'kill_icon' : null;
  };

  return {
    documentElement: {
      setAttribute() {}
    },
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tagName) {
      return createElement(tagName);
    },
    querySelectorAll(selector) {
      if (selector === '[data-marker]') return markerButtons;
      if (selector === '[data-index]') {
        return elements.moduleList.querySelectorAll('[data-index]');
      }
      if (selector === '[data-param-edit]') {
        return elements.moduleList.querySelectorAll('[data-param-edit]');
      }
      if (selector === '[data-i18n]') return [];
      return [];
    }
  };
}

function createElement(id) {
  return {
    id,
    className: '',
    textContent: '',
    value: '',
    checked: false,
    children: [],
    attributes: {},
    listeners: {},
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name] || null;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const matches = [];
      collectMatches(this, selector, matches);
      return matches;
    },
    set innerHTML(value) {
      this.children = [];
      if (value.indexOf('data-index') !== -1) {
        this.input = createElement('input');
        this.input.setAttribute('data-index', '0');
        this.title = createElement('title');
        this.title.className = 'module-title';
        this.summary = createElement('summary');
        this.summary.className = 'module-summary';
        this.meta = createElement('meta');
        this.meta.className = 'module-meta';
        this.warning = createElement('warning');
        this.warning.className = 'module-warning';
        this.requirement = createElement('requirement');
        this.requirement.className = 'module-requirement';
        this.children.push(this.title, this.summary, this.meta, this.warning, this.requirement);
      }
    },
    get innerHTML() {
      return '';
    }
  };
}

function findChildByClass(element, className) {
  return element.children.find((child) => child.className === className) || null;
}

function collectMatches(element, selector, matches) {
  if (selector === '[data-index]' && element.getAttribute && element.getAttribute('data-index') !== null) {
    matches.push(element);
  }
  if (selector === '[data-param-edit]' && element.getAttribute && element.getAttribute('data-param-edit') !== null) {
    matches.push(element);
  }
  if (selector.charAt(0) === '.' && element.className === selector.slice(1)) {
    matches.push(element);
  }
  element.children.forEach((child) => collectMatches(child, selector, matches));
}

function combinedText(element) {
  return [element.textContent].concat(element.children.map(combinedText)).join('');
}

function createI18n(initialLanguage = 'en') {
  return {
    loadLanguage() {
      return initialLanguage;
    },
    normalizeLanguage(language) {
      return language === 'en' ? 'en' : 'zh';
    },
    saveLanguage() {},
    apply() {},
    t(language, key) {
      const translations = {
        zh: {
          noPendingAction: '暂无待应用方案。',
          noCustomPresetPaths: '暂无自定义预设路径。',
          customPresetPaths: '自定义预设路径',
          scannedPresetPaths: '已扫描路径',
          actionCountOne: '{count} 个动作',
          actionCountMany: '{count} 个动作',
          noPendingArchive: '暂无历史方案。',
          pendingTargetLabel: '目标',
          pendingWarningLabel: '警告',
          pendingRequiresLabel: '依赖',
          pendingAppliedModules: '已应用模块: {modules}',
          parameterPreviewTitle: '参数预览，可修改后再应用',
          pendingInvalidParameter: '参数格式无效：{error}',
          paramTargetEffect: '效果: {target}',
          paramTargetLayer: '图层: {target}',
          paramTargetAction: '动作: {target}',
          paramFieldValue: '数值',
          paramFieldName: '名称',
          paramFieldColor: '颜色',
          paramFieldWidth: '宽度',
          paramFieldDuration: '持续时间',
          paramFieldStartTime: '开始时间',
          paramKeyTime: '关键帧 {index} 时间',
          paramKeyValue: '关键帧 {index} 数值'
        },
        en: {
          noPendingAction: 'No pending action.',
          noCustomPresetPaths: 'No custom preset paths.',
          customPresetPaths: 'Custom preset paths',
          scannedPresetPaths: 'Scanned paths',
          actionCountOne: '1 action',
          actionCountMany: '{count} actions',
          noPendingArchive: 'No plan history.',
          pendingTargetLabel: 'Target',
          pendingWarningLabel: 'Warning',
          pendingRequiresLabel: 'Requires',
          pendingAppliedModules: 'Applied modules: {modules}',
          parameterPreviewTitle: 'Parameter Preview - edit before applying',
          pendingInvalidParameter: 'Invalid parameter format: {error}',
          paramTargetEffect: 'Effect: {target}',
          paramTargetLayer: 'Layer: {target}',
          paramTargetAction: 'Action: {target}',
          paramFieldValue: 'Value',
          paramFieldName: 'Name',
          paramFieldColor: 'Color',
          paramFieldWidth: 'Width',
          paramFieldDuration: 'Duration',
          paramFieldStartTime: 'Start Time',
          paramKeyTime: 'Keyframe {index} Time',
          paramKeyValue: 'Keyframe {index} Value'
        }
      };
      return (translations[language] && translations[language][key]) || translations.en[key] || key;
    }
  };
}

function createStorage(initialLanguage = null) {
  return {
    value: initialLanguage,
    getItem() {
      return this.value;
    },
    setItem(key, value) {
      this.value = value;
    }
  };
}
