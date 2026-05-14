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
- 待应用方案：读取 `pending-action.json`，以可勾选模块列表展示 Codex 生成的方案，并支持应用前浏览/编辑关键参数值。
- 方案历史：刷新或丢弃方案时保留历史记录，支持从历史方案恢复为当前待应用方案。
- 结构化执行器：支持 `addEffect`、`modifyEffect`、`applyPreset`、`setProperty`、`setKeyframes`、`setExpression`。
- 安全校验：应用前校验 schema、目标图层、动作类型和 `contextFingerprint`，并在 AE undo group 内执行。
- 中英文面板：面板支持中文和 English 切换，并保存语言偏好。
- 插件参数库：支持扫描 AE 已安装效果插件的参数树和 workflow，输出 `effect-catalog.json`、`effect-workflows.json`、`effect-scan-report.json` 和 `effect-params/*.json`。
- 插件搜索候选：在插件参数库输入框中输入字母时，会像 AE Effects 搜索一样展示已安装插件候选，点击后可直接扫描。

### English

- AE CEP panel: opens inside After Effects as a dockable extension panel for AE-to-Codex workflows.
- User-selected bridge folder: exchanges context and pending plans through a local folder so users do not need to copy large JSON blocks manually.
- Context export: exports the active comp, current time, selected layers, source metadata, Transform data, markers, existing effect property trees, available effects, and a context fingerprint.
- Marker anchors: supports quick marker creation and can target either the selected layer or the active comp.
- Preset library scan: scans AE user presets, installed presets, and user-defined preset paths, then writes `preset-cache.json`.
- Pending plan view: reads `pending-action.json`, shows Codex-generated modules as a checkable list, and supports reviewing/editing key parameter values before applying.
- Plan history: preserves previous pending plans when refreshing or discarding, and can restore a history item as the current pending plan.
- Structured executor: supports `addEffect`, `modifyEffect`, `applyPreset`, `setProperty`, `setKeyframes`, `setExpression`, layer creation actions, and layer property actions.
- Safety gates: validates schema, target layer, action type, and `contextFingerprint` before applying, then executes inside an AE undo group.
- Bilingual panel: supports Chinese and English UI text with saved language preference.
- Plugin parameter library: scans installed AE effect plugin parameter trees and workflows, then writes `effect-catalog.json`, `effect-workflows.json`, `effect-scan-report.json`, and `effect-params/*.json`.
- Plugin search suggestions: typing in the Plugin Params field shows installed-effect suggestions similar to AE Effects search, and clicking one fills the scan input.

## Update History / 更新记录

### 2026-05-14 - Real Parameter Names in Pending Preview / 待应用预览显示真实参数名

Commit: `pending`

中文：
- 待应用方案参数预览现在优先显示 AE/插件 UI 中的真实参数名，而不是让用户根据 `tc Particular-0146`、`keys[1].value` 等内部字段猜含义。
- `readPendingAction` 会读取已扫描的 `effect-params/*.json`，按 `effectMatchName` 和 `propertyPath` 匹配真实 `path/name`，并给动作补充 `propertyPathDisplay` 与 `parameterName`。
- 面板会优先显示 `propertyPathDisplay`、`propertyPathLabels`、`propertyPathNames` 等真实显示路径；找不到扫描结果时才回退到内部路径。
- 验证：新增执行器回归测试，覆盖从扫描参数库把 `tc Particular-0146` 解析成 `粒子/秒`；扩展面板测试，覆盖真实参数名优先显示。

English:
- Pending parameter preview now prefers the real AE/plugin UI parameter names instead of asking users to infer meaning from internal fields such as `tc Particular-0146` or `keys[1].value`.
- `readPendingAction` reads scanned `effect-params/*.json` files, matches by `effectMatchName` and `propertyPath`, and enriches actions with `propertyPathDisplay` and `parameterName`.
- The panel prefers real display paths such as `propertyPathDisplay`, `propertyPathLabels`, and `propertyPathNames`; internal paths are only used as a fallback.
- Verification: added executor coverage for resolving `tc Particular-0146` to `粒子/秒` from the scan cache, and expanded panel coverage for real parameter-name precedence.

### 2026-05-14 - Localized Parameter Preview Labels / 参数预览标签随语言切换

Commit: `0969cc4`

中文：
- 参数预览列表现在会根据面板语言显示标签，中文界面使用“图层 / 效果 / 名称 / 持续时间 / 关键帧数值”等中文字段。
- 切换到 English 后，同一参数列表会显示 `Layer`、`Effect`、`Name`、`Duration`、`Keyframe Value` 等英文标签。
- 保留插件自身参数名和用户定义图层引用，避免误翻译第三方插件的实际参数路径。
- 验证：扩展面板回归测试，覆盖中文标签、英文标签，以及不再显示 `duration`、`startTime`、`keys[1].value` 这类内部字段路径。

English:
- Parameter preview labels now follow the selected panel language; Chinese UI shows Chinese labels for layer/effect targets, names, duration, and keyframe values.
- Switching to English re-renders the same parameter list with `Layer`, `Effect`, `Name`, `Duration`, `Keyframe Value`, and related labels.
- Plugin-provided parameter names and user-defined layer refs remain unchanged to avoid mistranslating real plugin paths.
- Verification: expanded panel regression coverage for Chinese labels, English labels, and removal of internal path labels such as `duration`, `startTime`, and `keys[1].value`.

### 2026-05-14 - Editable Pending Plan Parameters / 待应用方案参数预览与编辑

Commit: `615a498`

中文：
- 待应用方案模块下新增参数预览区，自动列出 `setProperty`、`setKeyframes`、`modifyEffect`、图层创建/图层属性等动作里的可编辑参数。
- 用户可以在面板中直接修改数值、数组、布尔值或字符串，再点击“应用勾选”执行。
- “应用勾选”会把面板中编辑后的临时 plan 传给 AE 执行器；不会为了预览编辑而直接改写桥接目录里的 `pending-action.json`。
- AE 执行器现在会优先使用 payload 中的编辑后方案，并继续执行原有 schema、上下文指纹和目标图层校验。
- 验证：新增面板和执行器回归测试，覆盖参数渲染、编辑后 payload 注入，以及执行器使用编辑后 plan。

English:
- Pending modules now show a parameter preview area that lists editable values from `setProperty`, `setKeyframes`, `modifyEffect`, layer creation, and layer property actions.
- Users can edit numbers, arrays, booleans, or strings directly in the panel before clicking Apply Checked.
- Apply Checked sends the panel-edited temporary plan to the AE executor without rewriting `pending-action.json` just for preview edits.
- The AE executor now prefers the edited plan from the payload while keeping the existing schema, context fingerprint, and target-layer validation gates.
- Verification: added panel and executor regression tests for parameter rendering, edited payload injection, and executor use of the edited plan.

### 2026-05-14 - Localized Pending Plan Text / 待应用方案双语显示

Commit: `8779528`

中文：
- 待应用方案现在支持 `titleI18n`、`summaryI18n`、`warningsI18n`、`requiresI18n` 等双语字段。
- 面板会根据当前中文/English 语言选择显示对应的方案标题、摘要、模块说明、警告、依赖和历史方案文案。
- “应用勾选”后的成功提示也会使用当前语言和模块双语标题，不再固定显示英文 `Applied modules:`。
- 切换语言时会重新渲染当前方案与历史方案，不需要重新读取桥接目录。
- 验证：新增面板回归测试，覆盖中文与英文之间切换时的待应用方案显示，以及应用后的本地化成功提示。

English:
- Pending plans now support bilingual fields such as `titleI18n`, `summaryI18n`, `warningsI18n`, and `requiresI18n`.
- The panel renders plan titles, summaries, module text, warnings, requirements, and history entries according to the selected Chinese/English UI language.
- The success message after applying checked modules now uses the selected language and localized module titles instead of always showing `Applied modules:`.
- Switching language re-renders the current plan and plan history without re-reading the bridge folder.
- Verification: added panel regression coverage for switching pending-plan text between Chinese and English, including the localized apply success message.

### 2026-05-14 - Unicode Bridge and Visible Plugin Parameters / Unicode 桥接与可见插件参数

Commit: `b129b02`

中文：
- 修复 CEP 面板从 JSX 桥接层读取方案时中文变成 `????` 的问题；桥接返回值现在会先 URL 编码，面板侧再解码后解析 JSON。
- 插件参数扫描默认只输出 AE 当前可见且可调的参数，过滤隐藏、禁用和内部空名参数，让扫描结果更贴近用户在效果控件面板里看到的 UI。
- 新增回归测试覆盖中文方案标题/摘要传输，以及隐藏/禁用/内部参数过滤。
- 验证：`node --test`，47 项测试通过。

English:
- Fixed Chinese text turning into `????` when pending plans travel from the JSX bridge back to the CEP panel; bridge responses are now URL-encoded and decoded before JSON parsing.
- Plugin parameter scans now default to visible, adjustable UI parameters by filtering hidden, disabled, and unnamed internal parameters.
- Added regression tests for Unicode pending-plan transport and visible-parameter scan filtering.
- Verification: `node --test`, 47 tests passed.

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
### 2026-05-13 - Layer Workflow Actions / 图层工作流动作

Commit: `feat: add layer workflow actions`

中文：

- 扩展 `pending-action.json` 动作协议，新增 `addSolidLayer`、`addLightLayer`、`addNullLayer` 和 `setLayerProperties`。
- 执行器新增模块级 `ref` / `targetRef` 图层引用表，后续动作可以明确作用到新建图层，而不是只能作用到原始目标素材层。
- 支持在 AE 中新建粒子承载 Solid、灯光层和 Null 控制层，并设置 in/out、混合模式、透明度等图层属性。
- 新增图层工作流基础能力，后续由通用插件 workflow 库决定何时创建承载层、调整层、灯光层或 Null 控制层。
- 新增回归测试，确保 `tc Particular` 会加到新建粒子承载层上，而不是加到原始视频层。

English:

- Extended the `pending-action.json` action protocol with `addSolidLayer`, `addLightLayer`, `addNullLayer`, and `setLayerProperties`.
- Added a per-module `ref` / `targetRef` layer registry so later actions can target newly created layers instead of only the original selected footage layer.
- Added AE execution support for particle carrier solids, light layers, null control layers, layer timing, blend mode, and opacity settings.
- Added the layer-workflow foundation that the generic plugin workflow library can use for carrier, adjustment, light, and null helper flows.
- Added regression coverage proving `tc Particular` is applied to the new particle carrier layer, not the original footage layer.

### 2026-05-13 - Built-In Plugin Workflow Library / 内置插件 workflow 库

Commit: `feat: add plugin workflow library`

中文：

- 新增内置插件 workflow 库，不再单独保留 Particular 工作流说明或单独示例方案。
- 扫描插件参数时同步生成 workflow：单插件扫描写入 `effect-params/*.json`，全量/目录扫描写入 `effect-workflows.json`。
- workflow 会标记插件更适合 `sourceLayer`、`adjustmentLayer`、`solidCarrier` 或 `unknown`，并给出推荐结构化动作。
- 新增 `addAdjustmentLayer` 动作，让 Twitch、Deep Glow、RSMB、冲击、发光、模糊、故障、调色类效果可以走调整层流程。
- 未匹配插件会保留参数树并标记为 `unknown`，同时写入 `onlineResearch.queries`，后续可由 Codex 联网读取官方说明或教程后补充库规则。

English:

- Added a built-in plugin workflow library and removed the standalone Particular workflow note/example from the current tree.
- Plugin parameter scans now emit workflow metadata in `effect-params/*.json`; catalog scans also write `effect-workflows.json`.
- Workflows classify effects as `sourceLayer`, `adjustmentLayer`, `solidCarrier`, or `unknown`, with recommended structured actions.
- Added `addAdjustmentLayer` so Twitch, Deep Glow, RSMB, impact, glow, blur, glitch, and color workflows can use trimmed adjustment layers.
- Unknown plugins keep their scanned parameter trees and include `onlineResearch.queries` so Codex can later research official docs or tutorials and promote new rules into the library.
