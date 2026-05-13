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
  BridgeClient.prototype.call = function call(name) {
    calls.push(name);
    if (name === 'readPendingAction') {
      return Promise.resolve({
        ok: true,
        plan: {
          archiveId: 'current-id',
          title: 'Glow Plan',
          summary: 'Apply glow at markers.',
          modules: [{
            id: 'm1',
            title: 'Deep Glow',
            summary: 'Pulse the selected adjustment layer.',
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

  assert.ok(calls.includes('readPendingAction'));
  assert.equal(calls.includes('exportContext'), false);
  assert.equal(elements.pendingSummary.textContent, 'Glow Plan\nApply glow at markers.');
  assert.equal(elements.moduleList.children.length, 1);
  assert.equal(elements.moduleList.children[0].querySelector('.module-title').textContent, 'Deep Glow');
  assert.equal(
    elements.moduleList.children[0].querySelector('.module-summary').textContent,
    'Pulse the selected adjustment layer.'
  );
  assert.equal(elements.moduleList.children[0].querySelector('.module-meta').textContent, '2 actions');
  assert.equal(elements.pendingArchiveList.children.length, 1);
  assert.equal(elements.pendingArchiveList.children[0].querySelector('.archive-title').textContent, 'Old Shake Plan');

  elements.pendingArchiveList.children[0].listeners.click();
  await Promise.resolve();
  assert.ok(calls.includes('restorePendingAction'));
});

function createPanelElements() {
  const ids = [
    'languageSelect',
    'pendingSummary',
    'moduleList',
    'pendingArchiveList',
    'contextStatus',
    'markerList',
    'presetPathList',
    'presetStatus',
    'refreshContext',
    'refreshPending',
    'chooseBridge',
    'openBridge',
    'scanPresets',
    'addPresetPath',
    'clearPresetPaths',
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
  return elements;
}

function createDocument(elements) {
  const markerButtons = [createElement('markerKill')];
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
        return elements.moduleList.children
          .map((child) => child.querySelector('[data-index]'))
          .filter(Boolean);
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
      if (selector === '[data-index]') return this.input || null;
      if (selector === '.module-title') return this.title || findChildByClass(this, 'module-title');
      if (selector === '.module-summary') return this.summary || findChildByClass(this, 'module-summary');
      if (selector === '.module-meta') return this.meta || findChildByClass(this, 'module-meta');
      if (selector === '.archive-title') return findChildByClass(this, 'archive-title');
      if (selector === '.archive-summary') return findChildByClass(this, 'archive-summary');
      if (selector === '.archive-meta') return findChildByClass(this, 'archive-meta');
      return null;
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

function createI18n() {
  return {
    loadLanguage() {
      return 'en';
    },
    normalizeLanguage(language) {
      return language === 'en' ? 'en' : 'zh';
    },
    saveLanguage() {},
    apply() {},
    t(language, key) {
      const translations = {
        noPendingAction: 'No pending action.',
        noCustomPresetPaths: 'No custom preset paths.',
        customPresetPaths: 'Custom preset paths',
        scannedPresetPaths: 'Scanned paths',
        actionCountOne: '1 action',
        actionCountMany: '{count} actions',
        noPendingArchive: 'No plan history.'
      };
      return translations[key] || key;
    }
  };
}

function createStorage() {
  return {
    getItem() {
      return null;
    },
    setItem() {}
  };
}
