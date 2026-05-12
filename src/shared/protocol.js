const crypto = require('node:crypto');

const defaultSettings = {
  bridgeDir: 'C:/Users/16693/Documents/AEEE/ae-codex-bridge',
  presetPaths: [],
  historyLimit: 50,
  showAdvancedLogs: false
};

const allowedActionTypes = [
  'addEffect',
  'modifyEffect',
  'applyPreset',
  'setProperty',
  'setKeyframes',
  'setExpression'
];

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

function validatePendingAction(action, options = {}) {
  const errors = [];
  if (!action || typeof action !== 'object') return ['pending action must be an object'];
  if (action.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!nonEmptyString(action.createdAt)) errors.push('createdAt must be a non-empty string');
  if (!nonEmptyString(action.contextFingerprint)) errors.push('contextFingerprint must be a non-empty string');
  if (
    nonEmptyString(options.expectedContextFingerprint) &&
    action.contextFingerprint !== options.expectedContextFingerprint
  ) {
    errors.push('contextFingerprint does not match current context');
  }
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
      } else {
        module.actions.forEach((moduleAction, actionIndex) => {
          if (!moduleAction || typeof moduleAction !== 'object' || Array.isArray(moduleAction)) {
            errors.push(`modules[${index}].actions[${actionIndex}] must be an object`);
            return;
          }
          if (!nonEmptyString(moduleAction.type)) {
            errors.push(`modules[${index}].actions[${actionIndex}].type must be a non-empty string`);
          } else if (!allowedActionTypes.includes(moduleAction.type)) {
            errors.push(
              `modules[${index}].actions[${actionIndex}].type must be one of: ${allowedActionTypes.join(', ')}`
            );
          }
        });
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
    if (key === 'exportedAt' || key === 'panelSettings' || key === 'contextFingerprint') return;
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
