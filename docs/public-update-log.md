# Public Update Log / 公开更新日志

This document is public-facing and safe to push. It records shipped updates, visible changes, validation notes, and the current feature set. Private design notes, local debugging details, user media paths, bridge runtime files, and project-specific AE assets should not be recorded here.

本文档是可公开推送的更新日志，用于记录已经推送的功能更新、可见改动、验证情况和当前功能实现概览。私人完整设计、本地调试细节、用户素材路径、桥接运行数据和具体 AE 工程资产不应写入此文件。

## Current Features / 当前已实现功能

### Chinese / 中文

- AE CEP 内嵌面板：可作为 After Effects 扩展面板打开，用于连接 AE 和 Codex。
- 用户自选桥接目录：面板通过本地文件夹导出上下文、读取待执行方案，避免手动复制大段 JSON。
- 上下文导出：可导出当前合成、当前时间、选中图层、图层来源、Transform、marker、已有特效属性树、可用插件列表和上下文指纹。
- 标记点锚定：支持添加常用 marker，并可选择写入选中图层或当前合成。
- 预设库扫描：支持扫描 AE 用户预设、安装目录预设和用户自定义预设路径，输出 `preset-cache.json`。
- 待应用方案：读取 `pending-action.json`，以可勾选模块列表展示 Codex 生成的方案。
- 方案历史：刷新或丢弃方案时保留历史记录，支持从历史方案恢复为当前待应用方案。
- 结构化执行器：支持 `addEffect`、`modifyEffect`、`applyPreset`、`setProperty`、`setKeyframes`、`setExpression`。
- 安全校验：应用前校验 schema、目标图层、动作类型和 `contextFingerprint`，并在 AE undo group 内执行。
- 中英文面板：面板支持中文和 English 切换，并保存语言偏好。
- 插件参数库：支持扫描 AE 已安装效果插件的参数树，输出 `effect-catalog.json`、`effect-scan-report.json` 和 `effect-params/*.json`。
- 插件搜索候选：在插件参数库输入框中输入字母时，会像 AE Effects 搜索一样展示已安装插件候选，点击后可直接扫描。

### English

- AE CEP panel: opens inside After Effects as a dockable extension panel for AE-to-Codex workflows.
- User-selected bridge folder: exchanges context and pending plans through a local folder so users do not need to copy large JSON blocks manually.
- Context export: exports the active comp, current time, selected layers, source metadata, Transform data, markers, existing effect property trees, available effects, and a context fingerprint.
- Marker anchors: supports quick marker creation and can target either the selected layer or the active comp.
- Preset library scan: scans AE user presets, installed presets, and user-defined preset paths, then writes `preset-cache.json`.
- Pending plan view: reads `pending-action.json` and shows Codex-generated modules as a checkable list.
- Plan history: preserves previous pending plans when refreshing or discarding, and can restore a history item as the current pending plan.
- Structured executor: supports `addEffect`, `modifyEffect`, `applyPreset`, `setProperty`, `setKeyframes`, and `setExpression`.
- Safety gates: validates schema, target layer, action type, and `contextFingerprint` before applying, then executes inside an AE undo group.
- Bilingual panel: supports Chinese and English UI text with saved language preference.
- Plugin parameter library: scans installed AE effect plugin parameter trees and writes `effect-catalog.json`, `effect-scan-report.json`, and `effect-params/*.json`.
- Plugin search suggestions: typing in the Plugin Params field shows installed-effect suggestions similar to AE Effects search, and clicking one fills the scan input.

## Update History / 更新记录

### 2026-05-13 - Plugin Scan Intelligence Metadata / 插件扫描智能元数据

Commit: `feat: enrich plugin scan metadata`

中文：

- 插件参数扫描新增 AE 暴露的范围约束记录，包括 `hasMin`、`minValue`、`hasMax`、`maxValue` 和 `unitsText`。
- 单插件扫描结果新增 `pluginFiles` 候选，用于记录本机匹配到的 `.aex`、`.plugin`、`.dll` 等插件文件路径和元数据。
- 同一个插件重复扫描时，会在写入新参数树前清理该插件旧的扫描 JSON，避免重复旧文件继续被 Codex 读到。
- 新增协议级 `validatePendingActionValueRanges`，可用已扫描参数库检查 `pending-action.json` 中的 `setProperty`、`setKeyframes`、`modifyEffect` 是否越界。
- 明确二进制插件文件只能作为文件身份和本地证据，插件语义仍需要结合参数树、预设、文档和动态探测建立。

English:

- Plugin parameter scans now record AE-exposed range metadata, including `hasMin`, `minValue`, `hasMax`, `maxValue`, and `unitsText`.
- Single-plugin scan output now includes `pluginFiles` candidates for locally matched `.aex`, `.plugin`, `.dll`, and related plugin files.
- Re-scanning the same plugin now removes older scan JSON files for that plugin before writing the new parameter tree.
- Added protocol-level `validatePendingActionValueRanges` so scanned parameter data can catch out-of-range `setProperty`, `setKeyframes`, and `modifyEffect` values before applying plans.
- Clarified that compiled plugin binaries are file-identity evidence; semantic control still comes from parameter trees, presets, documentation, and dynamic probing.

### 2026-05-13 - Plugin Search Suggestions / 插件搜索候选

Commit: `7361a02 feat: autocomplete plugin parameter search`

中文：

- 新增 `AECreateBridge.listAvailableEffects()`，从 AE `app.effects` 读取已安装效果插件列表。
- 在 `Plugin Params / 插件参数库` 输入框下方新增候选列表。
- 输入部分字母时，按插件显示名、`matchName` 和分类过滤候选。
- 点击候选项后自动填入插件名，便于继续扫描参数树。
- 新增回归测试覆盖桥接接口和面板候选过滤行为。
- 验证：`node --test`，31 项测试通过。

English:

- Added `AECreateBridge.listAvailableEffects()` to read installed effects from AE `app.effects`.
- Added a suggestion list below the `Plugin Params` input.
- Filters suggestions by display name, `matchName`, and category while typing.
- Clicking a suggestion fills the plugin name so it can be scanned immediately.
- Added regression tests for the bridge API and panel-side suggestion filtering.
- Verification: `node --test`, 31 tests passed.

### 2026-05-13 - Plugin Parameter Tree Scan / 插件参数树扫描

Commit: `c5b6536 feat: scan AE plugin parameter trees`

中文：

- 新增 `插件参数库 / Plugin Params` 面板区域。
- 支持扫描单个插件的完整参数树。
- 支持扫描 AE 暴露的全部已安装插件，并记录成功和失败结果。
- 扫描结果写入 `effect-catalog.json`、`effect-scan-report.json` 和 `effect-params/*.json`。
- 参数记录包含属性名、`matchName`、路径、值类型、当前值、关键帧能力、表达式能力和读取错误。
- 该能力为自然语言控制任意插件参数提供机器可读基础。

English:

- Added the `Plugin Params` panel section.
- Supports scanning a single plugin's parameter tree.
- Supports scanning all installed effects exposed by AE, with both successes and failures recorded.
- Writes scan output to `effect-catalog.json`, `effect-scan-report.json`, and `effect-params/*.json`.
- Parameter records include property name, `matchName`, paths, value type, current value, keyframe capability, expression capability, and read errors.
- This creates machine-readable data for future natural-language control of arbitrary plugin parameters.

### 2026-05-13 - V1 Design Gap Fill / V1 查漏补缺

Commit: `ab456c3 feat: fill v1 design gaps`

中文：

- 标记点区域新增目标切换，可写入选中图层或当前合成。
- 上下文导出增强：加入图层来源、Transform 属性树和 AE 暴露的已安装插件列表。
- 预设扫描结果增强：记录来源路径、相对路径和分类。
- 待应用方案列表增强：显示目标信息、模块 warnings 和 requires。
- 更新手动测试清单，覆盖新增上下文和面板行为。

English:

- Added marker target switching between the selected layer and the active comp.
- Expanded context export with layer source metadata, Transform property trees, and installed effects exposed by AE.
- Improved preset scan output with source path, relative path, and category metadata.
- Enhanced pending plan display with target information, module warnings, and requirements.
- Updated the manual test checklist for the new context and panel behavior.

### 2026-05-13 - Pending Plan History / 待应用方案历史

Commit: `d544b2c feat: preserve pending plan history`

中文：

- 新增 `pending-plans.json` 作为待应用方案历史库。
- 刷新或丢弃当前方案前，会尝试归档当前 `pending-action.json`。
- 面板新增历史方案列表，可查看旧方案摘要并恢复为当前方案。
- 面板启动时不再自动刷新 AE 上下文，降低打开面板时触发重型 AE/GPU 路径的风险。

English:

- Added `pending-plans.json` as the pending plan history store.
- Archives the current `pending-action.json` before refresh or discard when possible.
- Added a plan history list in the panel, with restore support.
- Stopped auto-refreshing AE context on panel startup to reduce the chance of triggering heavy AE/GPU paths when the panel opens.

### 2026-05-13 - Refresh Pending Plan List / 刷新待应用方案列表

Commit: `c3b80a3 feat: refresh pending plan list`

中文：

- 待应用方案区域新增独立刷新按钮。
- 待应用模块改为更清晰的列表展示。
- 每个模块显示动作数量，方便应用前确认影响范围。
- 补充中英文 UI 文案。

English:

- Added an explicit refresh button for the pending plan section.
- Improved pending modules into a clearer list layout.
- Shows action counts per module to make impact easier to review before applying.
- Added corresponding Chinese and English UI copy.

### 2026-05-13 - Apply Action Context Fix / 应用动作上下文修复

Commit: `6d9cdf6 fix: keep apply action context local`

中文：

- 修复应用方案时 `AECreateContext` 作用域不可见导致的失败。
- 应用流程改为从当前 AE 项目直接解析 active comp。
- 增加回归测试，确保执行器不依赖 `AECreateContext` 全局可见。

English:

- Fixed an apply-time failure caused by `AECreateContext` not being visible in the execution scope.
- The apply flow now resolves the active comp directly from the current AE project.
- Added regression coverage so the executor does not depend on globally visible `AECreateContext`.

### 2026-05-12 - Private Notes Protection / 私有日志保护

Commit: `30fc783 docs: ignore private local notes`

中文：

- 将 `docs/private-*.md` 加入忽略规则。
- 私人开发日志和完整设计文件保留在本地，不进入公开仓库。

English:

- Added `docs/private-*.md` to ignored files.
- Private development logs and complete design notes remain local and are not included in the public repository.

### 2026-05-12 - JSX Bridge Reload Fix / JSX 桥接重载修复

Commit: `14543fd fix: reload JSX bridge before panel calls`

中文：

- 前端每次调用 AE JSX 函数前重新加载当前扩展目录下的 `bridge.jsx`。
- 修复 AE/CEP 缓存旧 JSX 导致新桥接函数找不到的问题。

English:

- Reloads `bridge.jsx` from the current extension folder before each panel-to-AE JSX call.
- Fixes missing new bridge functions caused by AE/CEP retaining older JSX globals.

### 2026-05-12 - Custom Preset Scan Paths / 自定义预设扫描路径

Commit: `b1ee88f fix: allow custom preset scan paths`

中文：

- 面板支持添加和清空自定义预设扫描路径。
- 默认扫描范围补充用户 Documents 下的 AE 预设位置。
- 扫描结果显示本次使用的路径，便于排查预设未被发现的问题。

English:

- Added panel support for adding and clearing custom preset scan paths.
- Included the user's Documents AE preset location in default scan paths.
- Scan output now shows paths used during the scan, making missing preset issues easier to diagnose.

### 2026-05-12 - Panel Language Selector / 面板语言选择

Commit: `63cf2c5 feat: add panel language selector`

中文：

- 面板新增中文和 English 语言选择。
- 将主要按钮、区块标题、状态信息和确认提示接入 i18n 字典。
- 语言偏好保存在 `localStorage`。

English:

- Added Chinese and English language selection to the panel.
- Connected major buttons, section titles, status messages, and confirmation prompts to the i18n dictionary.
- Language preference is stored in `localStorage`.

### 2026-05-12 - AE Codex Effect Bridge Baseline / AE Codex 特效桥接基础版

Commit: `4dc9e2d merge: ae codex effect bridge`

中文：

- 建立 AE CEP 面板、ExtendScript 桥接层、共享协议工具和基础测试。
- 支持桥接目录设置、上下文导出、marker、预设扫描、待应用方案读取。
- 支持应用勾选模块，并通过 AE undo group 包裹执行。
- 加入安装脚本和手动测试清单。

English:

- Established the AE CEP panel, ExtendScript bridge layer, shared protocol utilities, and baseline tests.
- Added bridge folder settings, context export, markers, preset scanning, and pending plan reading.
- Added checked-module application wrapped in an AE undo group.
- Added the development install script and manual test checklist.

## Verification Notes / 验证说明

中文：

- 常规自动验证命令：`node --test`。
- AE 真实运行仍需按 `docs/manual-test-checklist.md` 做手动验证。
- 扫描全部插件可能较慢，建议在一次性测试工程中使用。

English:

- Standard automated verification command: `node --test`.
- Real AE runtime behavior should still be manually verified with `docs/manual-test-checklist.md`.
- Scanning all plugins can be slow; use it in a disposable test project when possible.
