(function (root) {
  var storageKey = 'aecreate.panelLanguage';
  var translations = {
    zh: {
      appTitle: 'AEcreate Codex Bridge',
      languageLabel: '界面语言',
      contextTitle: '上下文',
      noContextExported: '尚未导出上下文。',
      refreshContext: '刷新上下文',
      chooseBridge: '选择桥接目录',
      openBridge: '打开桥接目录',
      markersTitle: '标记',
      markerTargetLabel: '标记目标',
      markerTargetLayer: '选中图层',
      markerTargetComp: '当前合成',
      markerKill: '击杀',
      markerImpact: '冲击',
      markerRewind: '回溯',
      markerCustom: '自定义',
      noMarkersLoaded: '暂无标记。',
      libraryTitle: '预设库',
      scanPresets: '扫描预设',
      addPresetPath: '添加预设路径',
      clearPresetPaths: '清空自定义路径',
      noCustomPresetPaths: '暂无自定义预设路径。默认会扫描 Documents/Adobe/After Effects、APPDATA 和 AE 安装 Presets。',
      customPresetPaths: '自定义预设路径',
      scannedPresetPaths: '本次扫描路径',
      presetNotScanned: '尚未扫描预设缓存。',
      effectParamsTitle: '插件参数库',
      scanEffectParams: '扫描此插件',
      scanAllEffectParams: '扫描全部插件',
      effectParamsNotScanned: '尚未扫描插件参数树。',
      scanAllEffectsConfirm: '扫描全部插件参数树可能需要较长时间，并可能触发不稳定插件。确定继续？',
      pendingTitle: '待应用方案',
      refreshPending: '刷新方案',
      noPendingAction: '暂无待应用动作。',
      pendingArchiveTitle: '历史方案',
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
      paramFieldHeight: '高度',
      paramFieldPixelAspect: '像素长宽比',
      paramFieldDuration: '持续时间',
      paramFieldStartTime: '开始时间',
      paramFieldInPoint: '入点',
      paramFieldOutPoint: '出点',
      paramFieldEnabled: '启用',
      paramFieldGuideLayer: '参考图层',
      paramFieldShy: '隐藏开关',
      paramFieldOpacity: '不透明度',
      paramFieldBlendingMode: '混合模式',
      paramFieldPosition: '位置',
      paramFieldLightType: '灯光类型',
      paramFieldIntensity: '强度',
      paramFieldExpression: '表达式',
      paramFieldPath: '路径',
      paramKeyTime: '关键帧 {index} 时间',
      paramKeyValue: '关键帧 {index} 数值',
      actionCountOne: '1 个动作',
      actionCountMany: '{count} 个动作',
      applyChecked: '应用勾选',
      discardPending: '丢弃',
      saveFavorite: '收藏方案',
      openLogs: '打开日志',
      markerPrompt: '标记名称'
    },
    en: {
      appTitle: 'AEcreate Codex Bridge',
      languageLabel: 'Language',
      contextTitle: 'Context',
      noContextExported: 'No context exported.',
      refreshContext: 'Refresh Context',
      chooseBridge: 'Choose Bridge',
      openBridge: 'Open Bridge Folder',
      markersTitle: 'Markers',
      markerTargetLabel: 'Marker Target',
      markerTargetLayer: 'Selected Layer',
      markerTargetComp: 'Current Comp',
      markerKill: 'Kill',
      markerImpact: 'Impact',
      markerRewind: 'Rewind',
      markerCustom: 'Custom',
      noMarkersLoaded: 'No markers loaded.',
      libraryTitle: 'Library',
      scanPresets: 'Scan Presets',
      addPresetPath: 'Add Preset Path',
      clearPresetPaths: 'Clear Custom Paths',
      noCustomPresetPaths: 'No custom preset paths. Defaults include Documents/Adobe/After Effects, APPDATA, and AE Presets.',
      customPresetPaths: 'Custom preset paths',
      scannedPresetPaths: 'Scanned paths',
      presetNotScanned: 'Preset cache not scanned.',
      effectParamsTitle: 'Plugin Params',
      scanEffectParams: 'Scan Plugin',
      scanAllEffectParams: 'Scan All Plugins',
      effectParamsNotScanned: 'Plugin parameter tree not scanned.',
      scanAllEffectsConfirm: 'Scanning all plugin parameter trees can take a long time and may trigger unstable plugins. Continue?',
      pendingTitle: 'Pending Plan',
      refreshPending: 'Refresh Plan',
      noPendingAction: 'No pending action.',
      pendingArchiveTitle: 'Plan History',
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
      paramFieldHeight: 'Height',
      paramFieldPixelAspect: 'Pixel Aspect',
      paramFieldDuration: 'Duration',
      paramFieldStartTime: 'Start Time',
      paramFieldInPoint: 'In Point',
      paramFieldOutPoint: 'Out Point',
      paramFieldEnabled: 'Enabled',
      paramFieldGuideLayer: 'Guide Layer',
      paramFieldShy: 'Shy',
      paramFieldOpacity: 'Opacity',
      paramFieldBlendingMode: 'Blending Mode',
      paramFieldPosition: 'Position',
      paramFieldLightType: 'Light Type',
      paramFieldIntensity: 'Intensity',
      paramFieldExpression: 'Expression',
      paramFieldPath: 'Path',
      paramKeyTime: 'Keyframe {index} Time',
      paramKeyValue: 'Keyframe {index} Value',
      actionCountOne: '1 action',
      actionCountMany: '{count} actions',
      applyChecked: 'Apply Checked',
      discardPending: 'Discard',
      saveFavorite: 'Save Favorite',
      openLogs: 'Open Logs',
      markerPrompt: 'Marker name'
    }
  };

  function normalizeLanguage(language) {
    return language === 'en' ? 'en' : 'zh';
  }

  function t(language, key) {
    var normalized = normalizeLanguage(language);
    return translations[normalized][key] || translations.en[key] || key;
  }

  function apply(documentRef, language) {
    var normalized = normalizeLanguage(language);
    if (documentRef.documentElement) {
      documentRef.documentElement.setAttribute('lang', normalized === 'zh' ? 'zh-CN' : 'en');
    }
    var nodes = documentRef.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(normalized, nodes[i].getAttribute('data-i18n'));
    }
  }

  function loadLanguage(storage) {
    try {
      if (storage) return normalizeLanguage(storage.getItem(storageKey));
    } catch (error) {}
    return 'zh';
  }

  function saveLanguage(storage, language) {
    try {
      if (storage) storage.setItem(storageKey, normalizeLanguage(language));
    } catch (error) {}
  }

  root.AECreatePanelI18n = {
    storageKey: storageKey,
    translations: translations,
    normalizeLanguage: normalizeLanguage,
    t: t,
    apply: apply,
    loadLanguage: loadLanguage,
    saveLanguage: saveLanguage
  };
}(typeof window !== 'undefined' ? window : this));
