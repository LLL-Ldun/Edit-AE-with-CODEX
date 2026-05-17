# Plugin And Visual Workflow Library

AEcreate exports workflow metadata so Codex does not treat scanned plugin parameters as isolated controls. The workflow library is part of the complete tool design: it tells Codex which AE layer workflow to use, which visual preprocessing steps are required, and when extra helper layers are justified.

## 中文

扫描插件和导出上下文时，工具会同时生成 workflow 信息：

- `current-context.json`：包含 `pluginWorkflowLibrary`、`visualWorkflowLibrary` 和 `supportedActionTypes`。
- `effect-params/*.json`：单个插件的可见参数树、范围信息、本地插件文件候选和插件 workflow。
- `effect-workflows.json`：当前 AE 已安装效果对应的插件 workflow 目录。

### 设计原则

- 默认最少图层优先：同一个视觉目标不要自动堆叠多个相似 Solid、调整层、Light 或 Null。
- 参数树只回答“有哪些参数”；workflow 回答“应该按什么 AE 流程使用插件”。
- 如果用户要求从画面已有颜色、边缘、刀刃、UI 光效或 matte 生成粒子，必须先查视觉目标 workflow，不能直接手动撒粒子。
- helper 层只在真实需要时创建，例如跟踪、source 保护、不同遮罩/混合范围、插件自身工作流程要求，或用户明确要求分层控制。
- 库里没有的插件或视觉目标，先标记 unknown/incomplete，并优先从官方文档、官方教程或高质量教程提炼规则后再沉淀进库。

### 插件能力 workflow

- `particle-solid-carrier`：Particular、Stardust、Form、Plexus 等粒子/生成器默认使用一个 Solid 承载层，使用 `ADD` 或 `SCREEN` 叠加。
- `adjustment-impact-layer`：Twitch、Deep Glow、RSMB、Shake、Sapphire、BCC、调色、故障、模糊、冲击类效果默认使用裁剪调整层。
- `source-retime-layer`：Twixtor、Timewarp、回溯、补帧、变速类效果默认作用在 source/预合成层。
- `saber-path-glow`：Saber 类路径光/描边发光使用 Solid 承载层和 mask/path 驱动。
- `optical-flares-hit-feedback`：Optical Flares 类镜头光斑使用 ADD/SCREEN 承载层，只有跟踪需求才加 Null。
- `ripple-dissolve-adjustment`：BCC Ripple Dissolve 或波纹转场使用裁剪调整层。
- `depth-map-source-preprocess`：Depth Map/Depth Scanner 类插件作为 source 或 matte 预处理。
- `matte-key-source-preprocess`：Linear Color Key、Color Range、Keylight、BCC Two Way Key 等作为 matte/source 预处理。
- `path-stroke-carrier`：3D Stroke、路径描边、write-on 类效果使用 Solid 承载层。
- `unknown-plugin-workflow`：未识别插件保留参数树，并记录后续联网查询线索。

### 视觉目标 workflow

- `color-keyed-edge-particles`：先取样/扣出目标颜色或刀刃边缘，再创建粒子承载层并引用扣色源。使用 Particular 等 Layer Emitter 时，默认保持扣色源为 2D；只有当源层本身需要把 3D 变换传给粒子发射时，才打开对应 3D 图层开关并在需要时启用 Collapse Transformations，同时优先约束发射器大小，避免粒子从全画面散开。
- `short-impact-adjustment-stack`：击杀点、卡点、冲击、抖动、发光和短促模糊优先合并到一个调整层。
- `retime-twixtor-speed-ramp`：变速、回溯、补帧优先作用在 source 层，必要时复制或预合成保护素材。
- `saber-path-glow`：路径光、能量线、刀刃描边发光要先确定 mask/path 来源。
- `optical-flares-hit-feedback`：镜头光斑、爆闪、击中光要先确定光源点，再 keyframe 亮度和衰减。
- `ripple-dissolve-adjustment`：波纹溶解/涟漪转场要先确定切点和持续时间。
- `depth-map-smoke-composite`：景深烟雾要先准备深度 matte，再合成烟雾/雾气层。
- `tracked-light-or-overlay`：只有目标会运动时才创建跟踪 Null 或控制层。
- `texture-plasma-glow-overlay`：纹理、等离子、能量叠加优先在一个承载层上组合生成器和发光。
- `transition-preset-two-shot`：两段镜头转场优先用扫描到的预设或一个调整层堆栈，并暴露切点、持续时间和强度。

## English

When AE context or plugin parameters are scanned, AEcreate emits workflow metadata:

- `current-context.json`: built-in plugin workflows, visual-goal workflows, and supported structured action types.
- `effect-params/*.json`: per-plugin visible parameter tree, range metadata, local plugin-file candidates, and inferred workflow.
- `effect-workflows.json`: workflow catalog for the currently installed AE effects.

### Principles

- Minimum layers first: one visual goal should not automatically become several similar solids, adjustment layers, lights, or nulls.
- Parameter trees say which controls exist; workflow entries say how a plugin should be used in AE.
- Each workflow entry also carries `sourcePolicy` metadata: `primarySourceKind`, `supplementSourceKinds`, `mergeRule`, and source notes. Tutorial-covered workflows use the tutorial as the primary source and official docs as the supplement; non-tutorial workflows use official docs as the primary source.
- Requests based on an existing color, edge, blade, UI glow, or matte must consult the visual workflow library before particle actions are generated.
- Layer Emitter particle workflows such as Particular should keep the keyed source 2D by default and only enable 3D layer switches plus Collapse Transformations when the source itself must relay 3D transform data. If particles spread across the whole comp, verify the layer/RGB source and constrain emitter size before adding more particle layers.
- Helper layers are created only when tracking, source protection, different masks/blend scopes, a real plugin workflow, or explicit user control requires them.
- Unknown plugins or visual goals are preserved as unknown/incomplete until official docs, official tutorials, or high-quality tutorials are reviewed and promoted into the library.

### Current Built-In Families

The first built-in set covers particle carriers, adjustment impact stacks, source retime, Saber path glow, Optical Flares hits, ripple dissolves, depth-map preprocessing, key/matte preprocessing, path strokes, and unknown-plugin research.

The first visual-goal set covers keyed edge particles, short impact stacks, Twixtor speed ramps, Saber path glow, flare hit feedback, ripple dissolves, depth-map smoke composites, tracked overlays, texture/plasma overlays, and two-shot preset transitions.


## ???????

?? workflow ??????? `sourcePolicy`?`primarySourceKind`?`supplementSourceKinds`?`mergeRule` ????????????? workflow ??????????????????????????? workflow ????????
