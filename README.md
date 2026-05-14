# AEcreate

AEcreate is a dockable After Effects CEP panel that helps Codex edit AE effects through a safe local bridge workflow. It exports AE context, lets Codex prepare a structured pending plan, then lets the user review and apply checked modules inside After Effects.

AEcreate 是一个可停靠在 After Effects 里的 CEP 扩展面板，用来把 AE 工程上下文安全地交给 Codex，再由 Codex 生成可检查、可勾选、可撤销的特效编辑方案。

## What It Does

- Exports active comp context, selected layers, markers, source metadata, Transform data, existing effect trees, and available AE effects.
- Uses a user-selected local bridge folder instead of requiring manual JSON copy and paste.
- Shows Codex-generated `pending-action.json` plans as checkable modules before applying anything in AE.
- Applies checked modules inside an AE undo group.
- Scans AE `.ffx` presets from user, install, and custom preset folders.
- Scans installed AE effect plugin parameter trees into machine-readable JSON, including built-in workflow guidance.
- Exports visual workflow guidance so Codex can plan preprocessing steps, such as duplicating a source layer for color keying before building edge-driven particles.
- Provides plugin search suggestions in the panel, similar to AE Effects search.
- Supports Chinese and English panel UI.

## 中文功能概览

- 导出当前合成、选中图层、marker、素材来源、Transform、已有特效属性树和 AE 已安装效果列表。
- 使用用户自选本地桥接目录，减少手动复制 JSON 的步骤。
- 将 Codex 生成的 `pending-action.json` 显示为可勾选模块，应用前可检查。
- 在 AE undo group 内应用勾选模块，方便撤销。
- 扫描用户预设、安装目录预设和自定义路径中的 `.ffx` 预设。
- 扫描 AE 已安装效果插件的参数树，生成机器可读 JSON。
- 插件参数库支持类似 AE Effects 搜索的输入候选。
- 面板支持中文和 English 切换。

## Workflow

1. Open the AEcreate panel in After Effects.
2. Choose a local bridge folder.
3. Add timeline markers such as `kill_icon`, `impact`, or `rewind`.
4. Click `Refresh Context` so AE writes `current-context.json`.
5. Ask Codex for the effect change you want.
6. Codex writes `pending-action.json` into the bridge folder.
7. Review the pending plan in AEcreate.
8. Apply only the checked modules inside AE.

## Current Structured Actions

AEcreate currently supports these structured action types:

- `addEffect`
- `modifyEffect`
- `applyPreset`
- `setProperty`
- `setKeyframes`
- `setExpression`
- `duplicateLayer`
- `addSolidLayer`
- `addAdjustmentLayer`
- `addLightLayer`
- `addNullLayer`
- `setLayerProperties`

Layer workflow actions can duplicate source layers, create carrier/control layers, and then target later effect actions with `targetRef`. `setProperty` can also use `valueLayerRef` when an effect parameter should point at a layer created earlier in the same module. Plugin and visual workflow guidance help Codex choose source-layer preprocessing, adjustment-layer, solid-carrier, light, null, or keyed-matte flows instead of treating every request as a direct effect on the footage layer.

## Install For Development

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-dev.ps1
```

Restart After Effects, then open:

```text
Window > Extensions > AEcreate Codex Bridge
```

## Test

```powershell
npm test
```

If the current shell cannot find npm, run the Node test runner directly:

```powershell
node --test
```

## Documentation

- Public update log: `docs/public-update-log.md`
- Manual AE test checklist: `docs/manual-test-checklist.md`
- Plugin workflow library: `docs/plugin-workflow-library.md`
- Design spec: `docs/superpowers/specs/2026-05-12-ae-codex-effect-bridge-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-12-ae-codex-effect-bridge-implementation.md`

## Safety

Keep project media, AE project files, rendered videos, and bridge runtime data outside this repository. The `.gitignore` excludes common media files, AE project files, render outputs, bridge folders, and private local notes.

The panel is designed to show pending changes before applying them. It does not silently modify AE projects without the user applying checked modules.
