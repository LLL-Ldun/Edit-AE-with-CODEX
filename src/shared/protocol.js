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

function validatePendingActionValueRanges(action, effectScans = []) {
  const errors = [];
  if (!action || !Array.isArray(action.modules)) return errors;
  const scans = Array.isArray(effectScans) ? effectScans : [effectScans];

  action.modules.forEach((module, moduleIndex) => {
    if (!module || !Array.isArray(module.actions)) return;
    module.actions.forEach((moduleAction, actionIndex) => {
      if (!moduleAction || typeof moduleAction !== 'object') return;
      if (!['setProperty', 'setKeyframes', 'modifyEffect'].includes(moduleAction.type)) return;
      const param = findScannedParam(scans, moduleAction.effectMatchName, moduleAction.propertyPath);
      if (!param) return;
      const label = `modules[${moduleIndex}].actions[${actionIndex}]`;
      if (Object.prototype.hasOwnProperty.call(moduleAction, 'value')) {
        errors.push(...rangeErrorsForValue(label, moduleAction.value, moduleAction.effectMatchName, moduleAction.propertyPath, param));
      }
      if (Array.isArray(moduleAction.keys)) {
        moduleAction.keys.forEach((key, keyIndex) => {
          if (!key || !Object.prototype.hasOwnProperty.call(key, 'value')) return;
          errors.push(...rangeErrorsForValue(
            `${label}.keys[${keyIndex}]`,
            key.value,
            moduleAction.effectMatchName,
            moduleAction.propertyPath,
            param
          ));
        });
      }
    });
  });
  return errors;
}

function findScannedParam(scans, effectName, propertyPath) {
  if (!nonEmptyString(effectName) || !Array.isArray(propertyPath) || propertyPath.length === 0) return null;
  for (const scan of scans) {
    if (!scan || !effectMatches(scan.effect, effectName)) continue;
    const found = findParamInRecords(scan.params || [], propertyPath);
    if (found) return found;
  }
  return null;
}

function effectMatches(effect, name) {
  if (!effect) return false;
  const needle = String(name).toLowerCase();
  return [effect.name, effect.matchName].some((value) => String(value || '').toLowerCase() === needle);
}

function findParamInRecords(records, propertyPath) {
  for (const record of records) {
    if (!record) continue;
    if (samePath(record.matchPath, propertyPath) || samePath(record.path, propertyPath)) return record;
    if (Array.isArray(record.children)) {
      const found = findParamInRecords(record.children, propertyPath);
      if (found) return found;
    }
  }
  return null;
}

function samePath(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => item === b[index]);
}

function rangeErrorsForValue(label, value, effectName, propertyPath, param) {
  const values = Array.isArray(value) ? value : [value];
  const errors = [];
  values.forEach((item, index) => {
    if (typeof item !== 'number' || !Number.isFinite(item)) return;
    const suffix = Array.isArray(value) ? `[${index}]` : '';
    const target = `${effectName} > ${propertyPath.join(' > ')}`;
    if (param.hasMin === true && typeof param.minValue === 'number' && item < param.minValue) {
      errors.push(`${label}${suffix} value ${item} is below minValue ${param.minValue} for ${target}`);
    }
    if (param.hasMax === true && typeof param.maxValue === 'number' && item > param.maxValue) {
      errors.push(`${label}${suffix} value ${item} is above maxValue ${param.maxValue} for ${target}`);
    }
  });
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
  validatePendingActionValueRanges,
  fingerprintContext
};
