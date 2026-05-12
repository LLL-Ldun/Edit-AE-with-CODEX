# AEcreate

AEcreate is a dockable After Effects CEP panel for Codex-driven effect control.

V1 uses a local bridge folder:

1. AE exports selected-layer context, markers, existing effects, and preset metadata.
2. Codex reads that context and writes `pending-action.json`.
3. The AE panel displays checkable modules.
4. The user applies checked modules inside AE.

## Install For Development

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-dev.ps1
```

Restart After Effects, then open:

`Window > Extensions > AEcreate Codex Bridge`

## Test

```powershell
npm test
```

If the current shell cannot find npm, run `node --test` directly.

## Design

- `docs/superpowers/specs/2026-05-12-ae-codex-effect-bridge-design.md`
- `docs/superpowers/plans/2026-05-12-ae-codex-effect-bridge-implementation.md`

## Safety

Keep project media, AE project files, renders, and bridge runtime data outside this repo. The `.gitignore` excludes common media, AE project, and bridge-output files.
