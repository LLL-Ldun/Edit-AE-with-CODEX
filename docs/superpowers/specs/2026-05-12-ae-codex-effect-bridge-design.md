# AE Codex Effect Bridge Design

Date: 2026-05-12

## Summary

Build a dockable After Effects extension panel that lets the user mark effect timing points in AE, describe the desired visual result to Codex in natural language, and then apply Codex-generated effect edits back inside AE with user confirmation.

Version 1 uses a CEP panel and a local file bridge. The panel exports AE context to a user-selected bridge folder. Codex reads that context directly, writes back a pending effect plan, and the panel displays a summary with checkboxes before applying the selected modules to the current AE composition and selected layer.

The long-term goal is natural-language control over any effect plugin installed in the user's AE, including Red Giant, Particular, Sapphire, BCC, built-in AE effects, saved `.ffx` presets, and custom effect stacks. Twixtor, Twitch, Deep Glow, and RSMB are only initial high-value adapters, not the boundary of the system.

## Goals

- Provide a Flow-like dockable panel inside AE.
- Let the user add marker anchors on the timeline to tell Codex where effects should happen.
- Avoid manual JSON copying by using a user-selectable local bridge folder.
- Let Codex read selected-layer context, markers, existing effects, available presets, and plugin metadata.
- Let Codex generate effect plans from natural language.
- Show pending plans as readable, checkable modules before execution.
- Support applying built-in modules, scanned `.ffx` presets, user favorites, history items, and Codex-generated temporary modules.
- Support editing existing plugin effects, not only adding new effects.
- Keep V1 local and conservative, while preserving a clean path to a future localhost service.

## Non-Goals For V1

- No direct automatic editing of AE without panel confirmation.
- No built-in cloud AI call from the AE panel in V1.
- No promise that every third-party plugin has semantic parameter names on day one.
- No full video auto-editing workflow. The first target is single selected layer or selected effect stack precision control.

## User Workflow

1. The user opens the CEP panel inside AE.
2. The user selects a target layer in the current composition.
3. The user places timeline markers such as `kill_icon`, `impact`, `rewind`, or custom names.
4. The user clicks `Refresh Context`.
5. The panel writes `current-context.json` into the configured bridge folder.
6. In Codex, the user describes the desired result, for example:
   - "At kill_icon, make the existing Particular burst denser for 8 frames, add a harder Twitch hit, and shorten the Deep Glow tail."
   - "Use my saved impact preset, but reduce blur and make the glow decay faster."
7. Codex reads the bridge context and writes a `pending-action.json` plan.
8. The AE panel detects the pending plan and displays:
   - plan title
   - human-readable summary
   - checkable modules
   - target layer and marker assumptions
9. The user checks or unchecks modules and clicks `Apply Checked`.
10. The panel executes the selected modules inside an AE undo group and writes logs/history.
11. The user can undo in AE, save the plan as a favorite, or reuse it from history.

## Architecture

V1 architecture:

```text
AE CEP Panel <-> user-selected bridge folder <-> Codex
```

### AE CEP Panel

The panel is a CEP extension installed into AE. It uses HTML/CSS/JavaScript for the UI and calls ExtendScript through `CSInterface.evalScript()` for AE operations.

Responsibilities:

- display current comp, time, and selected layer
- add and list comp/layer marker anchors
- export current AE context
- scan effect presets
- display pending Codex plans
- let the user check modules before applying
- execute selected modules through ExtendScript
- write logs, history, and favorites
- save panel settings

### ExtendScript Layer

ExtendScript handles all direct AE operations:

- read active project, composition, selected layers, and current time
- read layer and composition markers
- inspect existing effects and effect property trees
- add effects by match name where available
- apply `.ffx` presets
- set property values and keyframes
- set expressions when requested
- create adjustment layers when a module explicitly requires one
- wrap apply operations in `app.beginUndoGroup()` and `app.endUndoGroup()`

### Bridge Folder

The bridge folder is chosen by the user in the panel. A default can be created under the current project folder, but the path is not fixed.

The selected path is saved to panel settings:

```json
{
  "bridgeDir": "C:/Users/16693/Documents/AEEE/ae-codex-bridge",
  "presetPaths": [],
  "historyLimit": 50,
  "showAdvancedLogs": false
}
```

Codex should read the configured bridge folder from settings when possible. If no setting exists, it can use the documented default for the current project.

## Panel UI

### Context Area

Shows:

- active composition
- current time
- selected target layer
- selected layer source and timing
- current bridge folder

Controls:

- `Refresh Context`
- `Choose Bridge Folder`
- `Open Bridge Folder`
- `Export Context`

### Marker Area

Markers are effect anchors only. They tell Codex where an effect should happen, but they do not define the creative logic by themselves.

Controls:

- quick marker buttons such as `Kill`, `Impact`, `Rewind`, `Custom`
- marker target toggle: selected layer or composition
- marker list with names and times
- rename/delete marker actions where possible

### Library Area

The library has three layers:

- built-in modules
- scanned AE `.ffx` presets
- history and favorites

Built-in modules are stable actions for common editing tasks. Scanned presets are any `.ffx` files found in user or installation preset folders. History/favorites let useful Codex-generated plans become reusable modules.

### Pending Plan Area

Shows a pending Codex action:

- plan title
- summary
- target comp/layer
- marker assumptions
- module list with checkboxes
- warnings for missing markers, missing plugins, or stale context

Controls:

- `Apply Checked`
- `Preview Script`
- `Save Favorite`
- `Discard`
- `Open Logs`

## Bridge File Protocol

The internal folder structure is stable regardless of which bridge folder the user chooses:

```text
bridge/
  settings.json
  current-context.json
  pending-action.json
  preset-cache.json
  history/
  favorites/
  logs/
```

### current-context.json

Written by the AE panel and read by Codex.

Required top-level fields:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-12T11:45:00+08:00",
  "projectPath": "C:/Users/16693/Documents/AEEE/xiangmumu/AI.aep",
  "activeComp": {},
  "selectedLayers": [],
  "compMarkers": [],
  "availableEffects": [],
  "presetCachePath": "preset-cache.json",
  "effectWorkflowLibraryPath": "effect-workflows.json",
  "pluginWorkflowLibrary": {},
  "visualWorkflowLibrary": {},
  "supportedActionTypes": [],
  "contextFingerprint": "fingerprint-of-current-context",
  "panelSettings": {}
}
```

Layer records include:

- layer index and name
- in/out/start times
- source information
- selected state
- markers
- existing effect stack
- transform values when useful

Effect records include:

- display name
- match name when available
- enabled state
- property tree
- current values
- keyframes
- expressions

The property tree is essential because Codex must be able to modify existing plugins, not only add new ones.

Workflow metadata is also part of the exported context, not a side document. `pluginWorkflowLibrary` describes how plugin families should be used inside AE, such as source-layer retime, adjustment-layer impact, solid-carrier particles, path glow, flare hits, key/matte preprocessors, and unknown-plugin research. `visualWorkflowLibrary` describes visual goals that may require several ordered steps before a plugin can work correctly, such as keying an existing blade edge before building particles from it. `supportedActionTypes` lets Codex generate only actions that the installed panel can execute.

### preset-cache.json

Written by the panel after scanning preset folders.

Records include:

- preset name
- file path
- source path
- relative category
- file modified time
- scan time

Preset folders include user-configured paths plus common AE locations such as:

- `%APPDATA%/Adobe/After Effects/<version>/Presets`
- `%APPDATA%/Adobe/After Effects/<version>/User Presets`
- AE installation `Support Files/Presets`

### pending-action.json

Written by Codex and read by the AE panel.

Required fields:

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-05-12T11:48:00+08:00",
  "contextFingerprint": "hash-of-current-context",
  "title": "Kill Icon Impact Burst",
  "summary": "Edits the existing glow and particle effects around kill_icon.",
  "target": {
    "compId": "active",
    "layerIndex": 7,
    "layerName": "VAL_Kill_Clip_07"
  },
  "modules": []
}
```

Each module includes:

- module id
- title
- summary
- default checked state
- required plugin/effect/preset dependencies
- warnings
- action list

Supported action types:

- `duplicateLayer`
- `addSolidLayer`
- `addAdjustmentLayer`
- `addLightLayer`
- `addNullLayer`
- `addEffect`
- `modifyEffect`
- `applyPreset`
- `setProperty`
- `setKeyframes`
- `setExpression`
- `setLayerProperties`

Later structured action candidates:

- `addMarker`
- `renameLayer`
- convenience shorthands for blend mode and opacity

The action format should prefer structured operations over raw script whenever possible. Raw JSX can exist as an escape hatch, but structured actions make summaries, validation, partial execution, and future UI editing easier.

## Universal Effect Support

The system must not be limited to specific plugins.

V1 should support four levels of plugin control:

### Level 1: Preset-Based Support

Any plugin that can be saved as an AE `.ffx` preset can be scanned and applied as a module.

This is the broadest and most reliable first layer for plugins such as Red Giant, Particular, Sapphire, BCC, and other third-party suites.

### Level 2: Generic Effect and Property Editing

For effects already present on the selected layer, Codex can read the property tree and generate structured edits:

- change property values
- set keyframes relative to marker times
- adjust existing keyframes
- add or remove expressions where appropriate
- enable/disable effects

This is what makes natural-language editing of existing plugins possible.

### Level 3: Semantic Adapters

High-frequency plugins can receive adapter metadata that maps natural phrases to known parameters.

Initial adapters:

- Twixtor
- Twitch
- Deep Glow
- RSMB

Future adapters:

- Particular
- Red Giant effects
- Sapphire effects
- BCC effects
- any frequently used user plugin

Adapters are convenience layers, not hard requirements. If no adapter exists, Codex can still use the property tree and presets.

### Level 4: Workflow Libraries

Parameter trees answer "what controls exist"; workflow libraries answer "how this kind of effect should be built in AE." They are core tool capability and must be exported with context.

The plugin capability library classifies installed effects by display name, match name, and category. Built-in families include:

- particle and generator effects on a solid carrier
- short impact, glow, blur, shake, color, and glitch stacks on an adjustment layer
- source-layer retime and interpolation effects
- Saber-style path glow on a solid carrier
- Optical Flares-style hit feedback on an additive carrier
- BCC ripple dissolve on a trimmed adjustment layer
- depth-map extraction as source or matte preprocessing
- key/matte plugins as source preprocessing
- path or stroke generators on a carrier layer
- unknown plugins marked for future official-doc or tutorial research

The visual-goal workflow library sits above individual plugins. It describes workflows such as:

- color-keyed edge particles
- short impact adjustment stacks
- Twixtor-style speed ramps
- Saber path glow
- flare hit feedback
- ripple dissolve transitions
- depth-map smoke composites
- tracked light or overlay effects
- texture/plasma glow overlays
- two-shot preset transitions

Each workflow entry must include match tokens, default plugin roles, required planning steps, editable parameter groups, a minimum-layer policy, recommended structured action types, and rules for when helper layers are allowed.

The default planning constraint is minimum layers first. One visual goal should not automatically become several similar solid, adjustment, light, or null layers. Extra layers are allowed only when timing, masking, blend scope, source preservation, tracking, or a plugin's actual workflow requires them.

When a scanned plugin or requested visual goal is not in the built-in library, Codex should preserve the scanned parameter tree, mark the workflow as unknown or incomplete, and use official vendor documentation, official tutorials, or high-quality tutorials before promoting a new rule into the built-in library.

## Natural Language Editing Requirements

Codex must be able to edit effects that are already on the layer.

Example request:

> Make the existing Particular burst denser at the kill marker, make the glow punch harder but fade quicker, and make the Twitch hit feel sharper.

Required behavior:

- inspect the selected layer's current effects
- identify likely Particular, glow, and Twitch-like effects by display name and match name
- read their current properties and keyframes
- generate a pending plan that modifies the existing effects first
- add missing effects only when necessary
- show exactly which effects and properties will change
- write all edits inside a single undo group

The panel should show summaries such as:

- "Modify existing Particular: raise particle rate around kill_icon for 8 frames."
- "Modify existing Deep Glow: increase exposure at impact and shorten radius decay."
- "Modify existing Twitch: add brief jitter and RGB separation at impact."

## Safety And Error Handling

Before applying:

- confirm an active composition exists
- confirm a target layer is selected or resolvable
- confirm required markers exist
- confirm pending action is not stale against the last context fingerprint
- confirm required presets exist
- warn if a plugin/effect cannot be found

During apply:

- execute inside one AE undo group
- apply only checked modules
- skip unchecked modules
- log each module result separately
- continue or stop based on module criticality

After apply:

- write an execution log
- add the action to history if successful or partially successful
- allow saving as favorite
- surface errors in the panel without hiding the raw log

## Testing Plan

Manual validation in AE:

1. Install or load the CEP panel.
2. Choose a bridge folder.
3. Open a test project and comp.
4. Select a single video layer.
5. Add layer and comp markers.
6. Refresh context and confirm `current-context.json` appears.
7. Scan presets and confirm `preset-cache.json` includes user and install presets.
8. Create a simple `pending-action.json` that applies a preset.
9. Confirm the panel shows the pending module.
10. Apply the checked module and verify AE changes.
11. Undo once and verify all changes revert.
12. Test a structured action that modifies an existing effect property.
13. Test missing marker and missing plugin warnings.
14. Save a successful plan as favorite.
15. Reapply a history/favorite item to another selected layer.

Script-level validation:

- context export returns stable JSON
- marker export handles layer and comp markers
- effect property export handles nested properties
- preset scanner handles Chinese and English paths
- pending-action validation catches stale or malformed actions
- structured action executor applies only checked modules

## Future V2: Local Service

After V1 is stable, the file bridge can be upgraded to a localhost service.

V2 goals:

- reduce file-management friction
- let the panel push context and pull plans over HTTP/WebSocket
- keep the same action schema
- keep the same safety confirmation flow
- optionally support AI/API calls directly from the panel

The V1 bridge schema should be designed so it can become the service API without rewriting the panel workflow.

## References

- Adobe CEP Resources: https://github.com/Adobe-CEP/CEP-Resources
- Adobe CEP Getting Started Guides: https://github.com/Adobe-CEP/Getting-Started-guides
- After Effects scripting concepts, including markers and property groups: https://ae-scripting.docsforadobe.dev/
