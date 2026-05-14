# Plugin And Visual Workflow Library

AEcreate keeps built-in workflow libraries so scanned plugin parameters are not treated as isolated controls. The libraries help Codex decide both where an effect belongs in AE and which visual preprocessing steps are required before an effect can work correctly.

## Chinese

扫描插件和导出上下文时，工具会同时生成 workflow 信息：

- `effect-params/*.json`：单个插件的参数树和插件 workflow。
- `effect-workflows.json`：当前 AE 已安装效果对应的插件 workflow 目录。
- `current-context.json`：内置插件 workflow、视觉目标 workflow 和支持的结构化动作类型。

当前内置插件策略：

- 粒子 / 生成器类：优先新建 Solid 承载层，把插件加到承载层上，再用 `ADD` / `SCREEN` 叠加到原视频。
- 冲击 / 发光 / 模糊 / 抖动 / 调色 / 故障类：优先新建裁剪到 marker 区间的调整层。
- 变速 / 回溯 / 补帧类：优先作用到源素材层或预合成层，因为这类插件通常需要改变素材时间关系。
- 未匹配插件：标记为 `unknown`，保留参数树，并写入后续联网补全官方文档和教程所需的搜索线索。

当前内置视觉目标策略：

- `color-keyed-edge-particles`：当用户要求“选择已有颜色”“扣色”“刀刃/边缘颜色做粒子”等效果时，Codex 应先复制目标素材层作为扣色源，用颜色键控或颜色范围隔离目标颜色，再创建一个粒子承载层。粒子层可以通过插件的 Layer / Layer RGB / Layer Map / Layer Emitter 类参数引用这个扣色源；如果插件不支持引用，则退化为沿扣色边缘手动放置发射路径。

设计原则：

- 同一个视觉目标默认最少图层优先。
- 如果用户明确要求从画面已有颜色或边缘生成粒子，不能跳过前置扣色步骤。
- 扣色源层不是第二个粒子层，它是后续粒子、发光或遮罩操作的源/参考层。
- 对库里没有的插件或视觉目标，Codex 应优先读取官方文档、官方教程或高质量教程，再把新规则沉淀进库。

## English

When plugins are scanned and AE context is exported, AEcreate emits workflow metadata:

- `effect-params/*.json`: per-plugin parameter tree plus plugin workflow.
- `effect-workflows.json`: workflow catalog for currently installed AE effects.
- `current-context.json`: built-in plugin workflows, visual-goal workflows, and supported structured action types.

Built-in plugin strategies:

- Particle / generator effects: create a solid carrier, apply the plugin to the carrier, then composite with `ADD` / `SCREEN`.
- Impact / glow / blur / shake / color / glitch effects: create a trimmed adjustment layer and apply the plugin there.
- Retime / interpolation effects: target the source footage or precomp layer because these effects change source timing.
- Unknown plugins: preserve the scanned parameter tree, mark the workflow as `unknown`, and include future online-research queries for official docs or high-quality tutorials.

Built-in visual-goal strategies:

- `color-keyed-edge-particles`: when the user asks for particles based on an existing color, keyed color, blade edge, or edge color, Codex should first duplicate the target footage as a keyed source, isolate the sampled color with a key/range/matte effect, then create one particle carrier layer. The particle layer can reference the keyed source through Layer / Layer RGB / Layer Map / Layer Emitter controls when the plugin exposes them; otherwise it should fall back to an emitter path placed on the keyed edge.

Design principles:

- Prefer the fewest layers that correctly express one visual goal.
- Do not skip preprocessing when the user asks for particles from an existing color or edge.
- A keyed source layer is not another particle layer; it is a source/reference layer for downstream particles, glow, or matte operations.
- For unsupported plugins or visual goals, Codex should prefer official documentation, official tutorials, or high-quality workflow tutorials before promoting a new rule into the built-in library.
