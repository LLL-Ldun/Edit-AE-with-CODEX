$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "extension"
$targetRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$target = Join-Path $targetRoot "com.aecreate.codexbridge"

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
if (-not (Test-Path -LiteralPath $source -PathType Container)) {
  throw "Missing extension source folder: $source"
}
if (Test-Path $target) {
  Remove-Item -LiteralPath $target -Recurse -Force
}
Copy-Item -LiteralPath $source -Destination $target -Recurse

Write-Host "Installed AEcreate CEP panel to $target"
Write-Host "Restart After Effects, then open Window > Extensions > AEcreate Codex Bridge."
