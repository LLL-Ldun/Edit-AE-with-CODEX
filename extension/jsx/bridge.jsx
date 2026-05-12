//@include "json.jsx"

var AECreateBridge = AECreateBridge || {};

AECreateBridge.loadWarnings = AECreateBridge.loadWarnings || [];

AECreateBridge.fail = function (message) {
  throw new Error(message);
};

AECreateBridge.extensionRoot = function () {
  return File($.fileName).parent.fsName;
};

AECreateBridge.settingsFile = function () {
  return new File(AECreateBridge.extensionRoot() + '/settings.json');
};

AECreateBridge.defaultBridgeDir = function () {
  return Folder.myDocuments.fsName + '/AEcreate/ae-codex-bridge';
};

AECreateBridge.errorSuffix = function (object) {
  return object && object.error ? ': ' + object.error : '';
};

AECreateBridge.ensureFolder = function (folder, label) {
  if (!(folder instanceof Folder)) AECreateBridge.fail(label + ' is not a folder.');
  if (!folder.exists && !folder.create()) {
    AECreateBridge.fail('Unable to create ' + label + ': ' + folder.fsName + AECreateBridge.errorSuffix(folder));
  }
  if (!folder.exists) AECreateBridge.fail('Unable to verify ' + label + ': ' + folder.fsName);
  return folder;
};

AECreateBridge.readText = function (file) {
  if (!file.exists) return null;
  file.encoding = 'UTF-8';
  if (!file.open('r')) AECreateBridge.fail('Unable to open file for reading: ' + file.fsName + AECreateBridge.errorSuffix(file));
  var text = file.read();
  var readError = file.error;
  if (!file.close()) AECreateBridge.fail('Unable to close file after reading: ' + file.fsName + AECreateBridge.errorSuffix(file));
  if (readError) AECreateBridge.fail('Unable to read file: ' + file.fsName + ': ' + readError);
  return text;
};

AECreateBridge.writeText = function (file, text) {
  AECreateBridge.ensureFolder(file.parent, 'parent folder');
  file.encoding = 'UTF-8';
  if (!file.open('w')) AECreateBridge.fail('Unable to open file for writing: ' + file.fsName + AECreateBridge.errorSuffix(file));
  if (!file.write(text)) {
    var writeError = file.error;
    file.close();
    AECreateBridge.fail('Unable to write file: ' + file.fsName + (writeError ? ': ' + writeError : ''));
  }
  if (!file.close()) AECreateBridge.fail('Unable to close file after writing: ' + file.fsName + AECreateBridge.errorSuffix(file));
};

AECreateBridge.settings = function () {
  var file = AECreateBridge.settingsFile();
  var defaults = {
    bridgeDir: AECreateBridge.defaultBridgeDir(),
    presetPaths: [],
    historyLimit: 50,
    showAdvancedLogs: false
  };
  var text = AECreateBridge.readText(file);
  if (!text) return defaults;
  try {
    var parsed = AECreateJSON.parse(text);
    if (parsed.bridgeDir) defaults.bridgeDir = parsed.bridgeDir;
    if (parsed.presetPaths instanceof Array) defaults.presetPaths = parsed.presetPaths;
    if (parsed.historyLimit > 0) defaults.historyLimit = parsed.historyLimit;
    defaults.showAdvancedLogs = parsed.showAdvancedLogs === true;
  } catch (error) {}
  return defaults;
};

AECreateBridge.saveSettings = function (settings) {
  AECreateBridge.writeText(AECreateBridge.settingsFile(), AECreateJSON.stringify(settings));
};

AECreateBridge.bridgeFolder = function () {
  var settings = AECreateBridge.settings();
  if (!settings.bridgeDir) AECreateBridge.fail('Bridge folder path is empty.');
  var folder = AECreateBridge.ensureFolder(new Folder(settings.bridgeDir), 'bridge folder');
  AECreateBridge.ensureFolder(new Folder(folder.fsName + '/history'), 'history folder');
  AECreateBridge.ensureFolder(new Folder(folder.fsName + '/favorites'), 'favorites folder');
  AECreateBridge.ensureFolder(new Folder(folder.fsName + '/logs'), 'logs folder');
  return folder;
};

AECreateBridge.respond = function (object) {
  return AECreateJSON.stringify(object);
};

AECreateBridge.chooseBridgeFolder = function () {
  try {
    var folder = Folder.selectDialog('Choose AEcreate bridge folder');
    if (!folder) return AECreateBridge.respond({ ok: false, error: 'Bridge folder selection cancelled.' });
    var settings = AECreateBridge.settings();
    settings.bridgeDir = folder.fsName;
    AECreateBridge.saveSettings(settings);
    AECreateBridge.bridgeFolder();
    return AECreateBridge.respond({ ok: true, message: 'Bridge folder: ' + folder.fsName });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.openBridgeFolder = function () {
  try {
    var folder = AECreateBridge.bridgeFolder();
    if (!folder.execute()) AECreateBridge.fail('Unable to open bridge folder: ' + folder.fsName + AECreateBridge.errorSuffix(folder));
    return AECreateBridge.respond({ ok: true, message: 'Opened bridge folder.' });
  } catch (error) {
    return AECreateBridge.respond({ ok: false, error: String(error) });
  }
};

AECreateBridge.loadOptionalScript = function (fileName) {
  var file = new File(AECreateBridge.extensionRoot() + '/' + fileName);
  if (!file.exists) {
    AECreateBridge.loadWarnings.push(fileName + ' not found; skipping.');
    return false;
  }
  try {
    $.evalFile(file);
    return true;
  } catch (error) {
    AECreateBridge.loadWarnings.push(fileName + ' failed to load: ' + String(error));
    return false;
  }
};

AECreateBridge.loadOptionalScript('context.jsx');
AECreateBridge.loadOptionalScript('actions.jsx');
