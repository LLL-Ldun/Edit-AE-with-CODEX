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
- Plan history: preserves previous pending plans when refreshing or discarding; clicking a history item only selects it for review, and deletion is explicit.
- Structured executor: supports `addEffect`, `modifyEffect`, `applyPreset`, `setProperty`, `setKeyframes`, `setExpression`, layer creation actions, and layer property actions.
- Safety gates: validates schema, target layer, action type, and `contextFingerprint` before applying, then executes inside an AE undo group.
- Bilingual panel: supports Chinese and English UI text with saved language preference.
- Plugin parameter library: scans installed AE effect plugin parameter trees and workflows, then writes `effect-catalog.json`, `effect-workflows.json`, `effect-scan-report.json`, and `effect-params/*.json`.
- Plugin search suggestions: typing in the Plugin Params field shows installed-effect suggestions similar to AE Effects search, and clicking one fills the scan input.

## Update History / 更新记录

### 2026-05-15 - Filter-Aware Checked Plugin Scanning / 勾选扫描匹配当前筛选列表
Commit: `9211593`

中文：
- `勾选未扫描` 现在会尊重当前插件列表筛选和搜索条件。例如筛选为 `已入库` 时，只会勾选“已入库且未扫描”的插件，不会把隐藏在其他筛选结果里的未扫描插件一起勾选。
- `扫描勾选插件` 现在会在状态区显示本次勾选数量、已扫描数量和失败数量；发起扫描时先显示 `已扫描 0`，扫描返回后更新为实际计数。
- 扫描完成后刷新插件状态列表时会保留本次扫描进度文本，避免刚显示的扫描结果被列表汇总立即覆盖。

English:
- `Select Unscanned` now respects the current plugin-list filter and search query. For example, when filtered to `In Workflow Library`, it selects only plugins that are both in-library and unscanned.
- `Scan Checked Plugins` now shows the selected count, scanned count, and failed count in the status area. It starts at scanned 0, then updates when the scan returns.
- After a scan, the plugin status list refreshes without immediately replacing the scan progress text with the general list summary.

### 2026-05-15 - Workflow Library Filters In Plugin List / 插件名单增加 Workflow 入库筛选
Commit: `fbe9a7d`

中文：
- 插件参数库的状态筛选下拉框新增 `已入库` 和 `未入库`。
- `已入库` 会只显示已经匹配到 AEcreate 内置 workflow 库的插件；`未入库` 会只显示当前仍是未知 workflow 的插件。
- 该筛选只读取现有插件名单和 workflow 匹配状态，不会触发新的插件参数扫描，适合用户快速判断后续需要补库的插件。

English:
- Added `In Workflow Library` and `Not In Workflow Library` filters to the Plugin Params status dropdown.
- `In Workflow Library` shows only plugins that match AEcreate's built-in workflow library; `Not In Workflow Library` shows plugins still using the unknown workflow fallback.
- The filter only reads the existing plugin list and workflow status, and does not trigger a new parameter scan.

### 2026-05-15 - Plugin Workflow Library Status In Scan List / 插件名单显示 Workflow 入库状态
Commit: `a81614c`

中文：
- 插件参数库的扫描状态列表现在会同时显示每个插件是否已经匹配到 AEcreate 内置 workflow 库。
- 已匹配到内置 workflow 的插件显示 `Workflow: 已入库`，并附带 workflow 名称；未知插件显示 `Workflow: 未入库`。
- 该状态不依赖插件是否已经扫描参数树，而是根据当前内置 workflow 规则即时匹配，方便用户判断哪些插件还需要后续教程/官方文档补库。

English:
- The Plugin Params scan status list now also shows whether each installed plugin matches AEcreate's built-in workflow library.
- Plugins with a matched built-in workflow show `Workflow: In Library` plus the workflow name; unknown plugins show `Workflow: Not In Library`.
- This status does not require the plugin parameter tree to be scanned first. It is computed from the current built-in workflow rules so users can see which plugins still need future tutorial/official-doc workflow enrichment.

### 2026-05-15 - Selective Plugin Parameter Scanning / 可选择插件参数扫描
Commit: `50a133d`

中文：
- 插件参数库新增已安装插件扫描状态列表，可显示每个插件的名称、`matchName`、分类、已扫描 / 未扫描 / 上次失败状态、参数数量和上次扫描时间。
- 新增状态筛选：全部插件、未扫描、已扫描、上次失败；搜索框也会同步过滤状态列表。
- 新增“勾选未扫描”和“扫描勾选插件”，用户可以一次只扫描自己选择的几个插件，避免默认扫描全部插件带来的时间和稳定性风险。
- 新增 JSX 桥接接口 `listEffectScanStatus` 和 `scanSelectedEffectParams`；扫描结果继续写入桥接目录的 `effect-params/*.json`、`effect-catalog.json` 和 `effect-scan-report.json`。
- 同一个插件重新扫描时仍清理旧扫描文件再写入新文件，避免旧参数树污染当前库。

English:
- Added an installed-plugin scan status list to the Plugin Params panel, showing each plugin's name, `matchName`, category, Scanned / Unscanned / Last Failed status, parameter count, and last scan time.
- Added status filters for All, Unscanned, Scanned, and Last Failed; the search box also filters the status list.
- Added Select Unscanned and Scan Checked Plugins so users can scan only chosen plugins instead of triggering a full installed-plugin scan.
- Added JSX bridge APIs `listEffectScanStatus` and `scanSelectedEffectParams`; scan output still writes to `effect-params/*.json`, `effect-catalog.json`, and `effect-scan-report.json` in the bridge folder.
- Re-scanning the same plugin still replaces old scan files for that plugin, preventing stale parameter trees from polluting the current library.

### 2026-05-15 - Persistent Bridge Settings And Scan Cache Reuse / 持久桥接设置与扫描缓存复用
Commit: `d2ce6c3`

中文：
- 面板设置从 CEP 扩展安装目录迁移到 `%APPDATA%/AEcreate/settings.json`，避免开发安装、覆盖扩展或 AE 重新加载后丢失用户选择的桥接目录。
- 新增 `bridgeDirHistory` 设置字段，保存最近使用过的桥接目录；当前桥接目录始终排在第一项，供后续 UI 切回历史目录使用。
- 兼容旧版本：如果旧扩展目录中仍有 `settings.json`，工具会读取并迁移到新的持久设置位置。
- 开发安装脚本在替换扩展前会先保留旧 `settings.json`，减少本地调试安装导致桥接目录重置的风险。
- 预设扫描和插件参数扫描记录继续保存在用户选择的桥接目录中，例如 `preset-cache.json`、`effect-catalog.json`、`effect-workflows.json` 和 `effect-params/*.json`；桥接目录稳定后，用户无需重复扫描即可继续使用这些缓存。
- 手动测试清单增加“重开面板、重装开发版后桥接目录仍保持”和“扫描缓存可复用”的检查项。

English:
- Panel settings now persist at `%APPDATA%/AEcreate/settings.json` instead of inside the installed CEP extension folder, so replacing or reinstalling the panel no longer resets the selected bridge folder.
- Added `bridgeDirHistory` to remember recently used bridge folders, with the active bridge folder kept first for future UI reuse.
- Backward compatible migration reads legacy extension-local `settings.json` when present and writes it to the new persistent settings location.
- The development install script preserves a legacy `settings.json` before replacing the extension folder.
- Preset and plugin parameter scan records continue to live in the selected bridge folder, including `preset-cache.json`, `effect-catalog.json`, `effect-workflows.json`, and `effect-params/*.json`; once the bridge folder is stable, users can reuse those scan records without scanning again.
- Manual testing now covers bridge folder persistence across panel reopen/dev reinstall and scan-cache reuse.

### 2026-05-15 - Disposable Panel Operation Diagnostics / 可丢弃面板操作诊断日志
Commit: `4d2458d`

中文：
- 新增一个轻量、可随时移除的面板操作诊断日志，用于排查蓝屏前最后触发了什么桥接操作。
- 每次面板调用 AE JSX 桥接函数时，会在桥接目录的 `logs/panel-operations.jsonl` 写入 `start` / `end` / `error` 事件；如果蓝屏发生在操作中途，通常能留下最后一条 `start`。
- 日志只记录操作名、阶段、payload/result 字节数、少量安全摘要、当前桥接目录及 `pending-action.json` / `pending-plans.json` / `current-context.json` 等文件大小，不写入完整方案 JSON 或素材内容。
- 日志为滚动文件，超过约 256 KB 会保留末尾近期记录；用户可用面板“打开日志”进入 `logs` 文件夹查看或直接删除。
- 验证：新增桥接客户端与 JSX loader 回归测试；`npm test` 全量 74 项通过；已通过 `scripts/install-dev.ps1` 部署到本机 CEP 扩展目录。

English:
- Added a lightweight, disposable panel operation diagnostics log to identify the last bridge operation before a blue screen.
- Every panel-to-AE JSX bridge call now writes `start` / `end` / `error` events to `<bridge-folder>/logs/panel-operations.jsonl`; if a crash occurs mid-operation, the last `start` entry should usually remain.
- The log records operation name, phase, payload/result byte counts, small safe summaries, bridge folder, and key bridge-file sizes such as `pending-action.json`, `pending-plans.json`, and `current-context.json`; it does not store full plan JSON or media contents.
- The file is rolling and trims itself after roughly 256 KB, keeping recent records; users can open the `logs` folder from the panel or delete the file at any time.
- Verification: added bridge-client and JSX-loader regression tests; `npm test`, 74 tests passed; deployed locally with `scripts/install-dev.ps1`.

### 2026-05-15 - Explicit Plan History Restore / 显式历史方案恢复
Commit: `8e05dda`

中文：
- 在保持历史方案点击安全的前提下，重新提供历史方案恢复入口：点击历史卡片仍然只会选中，不会写回 `pending-action.json`。
- 每个历史方案新增“恢复 / Restore”按钮；只有点击该按钮才会调用 `restorePendingAction`，把选中的历史方案恢复为当前待应用方案。
- 恢复按钮不会弹出确认框，便于快速回到旧方案；删除按钮仍然只删除历史记录，不影响当前待应用方案。
- 验证：新增面板回归测试覆盖“点历史不恢复、点恢复按钮才恢复”和中英文恢复文案；`npm test` 全量 72 项通过；已通过 `scripts/install-dev.ps1` 部署到本机 CEP 扩展目录。

English:
- Restored history-plan recovery while keeping safe history selection: clicking a history card still only selects it and does not rewrite `pending-action.json`.
- Each archived plan now has an explicit Restore button; only that button calls `restorePendingAction` and makes the selected archived plan current again.
- Restore does not show a confirmation dialog, so users can quickly bring back old plans; Delete remains explicit and only removes the archive record.
- Verification: added panel regression coverage for “history click does not restore, Restore button does restore” plus bilingual Restore labels; `npm test`, 72 tests passed; deployed locally with `scripts/install-dev.ps1`.

### 2026-05-14 - Low-Repaint Plan History Selection / 低重绘历史方案选择
Commit: `8c94cb4`

中文：
- 根据“Codex 打开时点击历史方案更容易触发 Intel 核显蓝屏”的反馈，进一步降低历史方案点击的面板重绘量。
- 历史方案点击现在不会重建整个历史列表 DOM，只在现有历史项上切换轻量选中类；同时保持零桥接调用、零恢复、零 `pending-action.json` 写入。
- 选中样式去掉背景色切换，仅保留边框提示，减少 AE CEP/Chromium 面板在核显上的重绘压力。
- 验证：新增面板回归断言，确认点击历史项不会产生桥接调用，也不会替换原历史项 DOM；`npm test` 全量 71 项通过。

English:
- Reduced plan-history click repaint after feedback that clicking history items while Codex is open could still trigger Intel integrated-GPU blue screens.
- History selection no longer rebuilds the whole history-list DOM; it only toggles a lightweight selected class on the existing item, with no bridge calls, no restore, and no `pending-action.json` writes.
- The selected style now keeps only a border cue and avoids background-color changes to reduce CEP/Chromium repaint pressure on integrated GPUs.
- Verification: added panel regression coverage proving history selection makes no bridge call and keeps the same DOM item; `npm test`, 71 tests passed.

### 2026-05-14 - Safe Plan History Selection / 历史方案安全选择
Commit: `fc2a694`

中文：
- 修复历史方案点击行为：点击右侧历史方案现在只会选中高亮，不会恢复为当前待应用方案，也不会写回 `pending-action.json`。
- 每个历史方案新增“删除 / Delete”按钮；删除只会移除 `pending-plans.json` 中对应记录，不会影响当前待应用方案。
- 保留底层 `restorePendingAction` 桥接接口以兼容旧流程，但当前面板不再通过历史项点击调用它，避免误触发过重方案。
- 验证：新增历史删除与面板交互回归测试；`npm test` 全量 71 项通过。

English:
- Fixed plan-history click behavior: clicking a history item now only selects/highlights it, without restoring it as the current pending plan or rewriting `pending-action.json`.
- Added an explicit Delete button for each archived plan; deletion only removes the matching record from `pending-plans.json` and leaves the current pending plan untouched.
- Kept the underlying `restorePendingAction` bridge API for compatibility, but the current panel no longer calls it from history-item clicks.
- Verification: added archive deletion and panel interaction regression tests; `npm test`, 71 tests passed.

### 2026-05-14 - GPU-Safe Context Mode / GPU 安全上下文模式
Commit: `fc487f3`

中文：
- 新增“GPU 模式”面板设置，默认值为“集显/安全”，另提供“独显/性能”选项。
- 在“集显/安全”模式下，刷新上下文不会递归读取选中图层的效果属性树，降低触发 AE 插件/GPU 驱动路径的概率。
- 在“独显/性能”模式下，工具仍可导出完整效果树，适合有独显且运行稳定的环境。
- 验证：新增设置归一化、上下文导出和面板设置回归测试；`npm test` 全量 70 项通过。

English:
- Added a GPU Mode setting to the panel, defaulting to Integrated/Safe with an optional Discrete/Performance mode.
- Integrated/Safe context export skips recursive selected-layer effect property-tree reads to reduce exposure to AE/plugin/GPU-driver paths.
- Discrete/Performance keeps full effect-tree export for machines with stable discrete-GPU workflows.
- Verification: added settings normalization, context export, and panel setting regression tests; `npm test`, 70 tests passed.

### 2026-05-14 - Tutorial-Derived Workflow Library / 教程提炼 workflow 库

Commit: `f22f140`

中文：
- 将 workflow 能力明确为工具核心上下文能力，不再作为单独的 Particular 示例或临时说明。
- 扩展插件能力 workflow：新增 Saber 路径光、Optical Flares 击中光斑、BCC Ripple Dissolve、Depth Map 预处理、Key/Matte 预处理、3D Stroke/路径描边等内置插件族。
- 扩展视觉目标 workflow：新增短促冲击调整层、Twixtor 速度坡、Saber 路径光、光斑反馈、波纹溶解、深度烟雾、跟踪光效、纹理/等离子叠加、两段镜头转场等第一批教程提炼规则。
- 每个 workflow 条目现在都强调最少图层优先、必需规划步骤、可编辑参数组、推荐结构化动作和拆层条件，避免同一个视觉目标默认堆叠多个相似层。
- 文档同步：更新公开 workflow 库说明和 AE 手动测试清单；完整设计继续保留在本地私有文档中。

English:
- Defined workflow capability as core context metadata, not as a standalone Particular note or temporary example.
- Expanded plugin workflows with built-in families for Saber path glow, Optical Flares hit feedback, BCC Ripple Dissolve, Depth Map preprocessing, key/matte preprocessing, and 3D Stroke/path carriers.
- Expanded visual-goal workflows with tutorial-derived rules for short impact stacks, Twixtor speed ramps, Saber path glow, flare hits, ripple dissolves, depth-map smoke composites, tracked overlays, texture/plasma overlays, and two-shot preset transitions.
- Each workflow now emphasizes minimum layers first, required planning steps, editable parameter groups, recommended structured actions, and split-layer conditions.
- Documentation updated: public workflow library notes and the AE manual test checklist; complete design stays in private local docs.

### 2026-05-14 - Visual Workflow Planning For Keyed Edge Particles / 扣色边缘粒子视觉工作流

Commit: `901a8c8`

中文：
- 新增视觉目标 workflow 库，导出到 `current-context.json` 的 `visualWorkflowLibrary`，让 Codex 不只看插件参数，还能读取“视觉目标需要哪些前置步骤”。
- 新增 `color-keyed-edge-particles` 工作流：当用户要求从已有颜色、刀刃边缘、边缘颜色或扣色区域生成粒子时，应先复制素材层做扣色源，再创建粒子承载层。
- 扩展结构化动作协议，新增 `duplicateLayer`，支持非破坏性复制目标图层作为 matte/source 层。
- `setProperty` 支持 `valueLayerRef`，可把同一模块里新建或复制的图层写入插件的 Layer Control 类参数。
- 验证：`node --test`，60 项测试全部通过。

English:
- Added a visual-goal workflow library exported as `visualWorkflowLibrary` in `current-context.json`, so Codex can read required preprocessing steps instead of only plugin parameters.
- Added the `color-keyed-edge-particles` workflow: requests based on an existing color, blade edge, edge color, or keyed region should duplicate the footage as a keyed source before creating the particle carrier.
- Extended the structured action protocol with `duplicateLayer` for non-destructive matte/source layer duplication.
- `setProperty` now supports `valueLayerRef`, allowing a plan to write a newly created or duplicated layer into plugin Layer Control parameters.
- Verification: `node --test`, 60 tests passed.

### 2026-05-14 - Reusable Pending Plans / 可重复应用方案

Commit: `7b62eb9`

中文：
- 待应用方案现在可以重复应用；第一次应用后 AE 工程新增图层导致 `contextFingerprint` 变化时，不再直接拒绝执行。
- 应用时仍保留结构校验和目标层校验；如果原 `target.layerIndex` 已因新增 AEcreate 图层而偏移，会使用 `target.layerName` 在当前合成中重新解析唯一目标层。
- 当 fingerprint 已变化但目标层可安全解析时，执行结果会返回 warning，而不是报错中断。
- 验证：新增执行器回归测试，覆盖旧 fingerprint + 目标层 index 偏移时仍能应用到原素材层。

English:
- Pending plans can now be applied repeatedly; AE-created layers changing the `contextFingerprint` after the first apply no longer hard-stop execution.
- The executor still validates structure and target layer safety; if `target.layerIndex` shifted because AEcreate inserted layers, it resolves the unique current target by `target.layerName`.
- A changed fingerprint now returns a warning when the target can be safely resolved instead of aborting the apply.
- Verification: added executor regression coverage for stale fingerprint plus shifted target-layer index.

### 2026-05-14 - Corrupt Localized Text Fallback / 本地化坏文本回退

Commit: `dba3293`

中文：
- 修复中文界面中待应用方案仍显示 `????` 的问题；根因不是 CEP 传输层再次损坏，而是某些 `pending-action.json` / 历史方案里的中文 i18n 字段已经被写成真实问号字符。
- 面板现在会识别高比例问号或连续问号的坏本地化文本，并自动跳过该字段，回退到基础字段或英文字段。
- 该修复覆盖当前方案、模块标题/摘要、警告、依赖和历史方案列表，不需要用户每次刷新后手动修中文字段。
- 验证：新增面板回归测试，覆盖 `zh` 字段为 `????` 时不再显示问号乱码。

English:
- Fixed remaining `????` output in the Chinese pending-plan UI; the root cause was already-corrupted localized fields in `pending-action.json` or archived plans, not a new CEP transport failure.
- The panel now detects high-question-mark localized text and skips it, falling back to the base field or English field.
- The fallback covers current plans, module title/summary text, warnings, requirements, and plan history entries.
- Verification: added a panel regression test for corrupted `zh` localized fields.

### 2026-05-14 - Minimum-Layer Plugin Workflow Defaults / 插件工作流默认最少图层

Commit: `6066b49`

中文：
- 插件 workflow 库现在以“最少图层优先”为默认策略，避免为了一个视觉目标自动堆叠多个相似承载层。
- 粒子/生成器类插件默认推荐 1 个 solid 承载层和 1 个同类效果实例；灯光、Null、额外承载层只作为可选 helper 信息，必须在用户明确需要分层控制或插件确实无法单层表达时才使用。
- `pluginWorkflowLibrary`、`effect-workflows.json` 和单插件扫描结果会携带 `layerPolicy`，明确 `defaultLayerCount`、`defaultEffectInstancesPerVisualGoal` 和允许拆层的条件。
- 验证：新增 workflow 回归测试，覆盖粒子、调整层、源层和未知插件的最少图层策略。

English:
- The plugin workflow library now defaults to a minimum-layer-first policy so one visual goal does not automatically become several similar carrier layers.
- Particle/generator plugins default to one solid carrier and one same-plugin effect instance; lights, nulls, and extra carriers are optional helpers only when the user explicitly asks for separate control or the plugin cannot express the look in one layer.
- `pluginWorkflowLibrary`, `effect-workflows.json`, and per-plugin scan output now include `layerPolicy` with `defaultLayerCount`, `defaultEffectInstancesPerVisualGoal`, and split-layer conditions.
- Verification: added workflow regression tests for particle, adjustment-layer, source-layer, and unknown plugin policies.

### 2026-05-14 - Faster Parameter Name Enrichment / 参数名解析性能修复

Commit: `75c0f97`

中文：
- 修复刷新待应用方案时可能导致 AE 不响应的性能问题；根因是待应用方案里有大量参数动作时，`readPendingAction` 会为每个动作重复读取并解析 `effect-params/*.json`。
- 参数名补全现在会在单次刷新中建立内存查找表，每个扫描文件最多读取一次，再复用给所有动作。
- 如果方案中没有需要补真实参数名的 `effectMatchName + propertyPath` 动作，或动作已经带有显示路径，则不会读取插件参数扫描库。
- 验证：`node --test`，53 项测试全部通过；已通过 `scripts/install-dev.ps1` 部署到本机 CEP 扩展目录。

English:
- Fixed a performance issue where refreshing a pending plan could make AE appear unresponsive; the root cause was repeated reads/parses of `effect-params/*.json` for every parameter action.
- Parameter-name enrichment now builds an in-memory lookup once per refresh, reads each scan file at most once, and reuses it across all actions.
- Plans without `effectMatchName + propertyPath` actions, or actions that already include display paths, no longer read the plugin parameter scan library.
- Verification: `node --test`, 53 tests passed; deployed locally with `scripts/install-dev.ps1`.

### 2026-05-14 - Real Parameter Names in Pending Preview / 待应用预览显示真实参数名

Commit: `167ec78`

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
