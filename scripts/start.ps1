$ErrorActionPreference = 'Continue'
$ScriptDir = $null
if ($PSScriptRoot) { $ScriptDir = $PSScriptRoot }
elseif ($MyInvocation.MyCommand.Path) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
else { $ScriptDir = (Get-Location).Path }

$candidates = @(
  (Split-Path -Parent $ScriptDir),
  $ScriptDir,
  (Join-Path $ScriptDir '..'),
  'D:\ProgramData\others\cucumber-inventory-project'
)
$Root = $null
foreach ($c in $candidates) {
  try {
    $full = [System.IO.Path]::GetFullPath($c)
    if (Test-Path (Join-Path $full 'apps\api\package.json')) { $Root = $full; break }
  } catch {}
}

$LogDir = Join-Path $ScriptDir 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Boot = Join-Path $LogDir 'bootstrap.log'
function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -Path $Boot -Value $line -Encoding UTF8
  Write-Host $line
}
Log "ScriptDir=$ScriptDir"
Log "Root=$Root"
if (-not $Root) {
  Log "ERROR cannot locate apps/api. Tried: $($candidates -join ' | ')"
  exit 1
}

# Delegate to batch for actual process start (same as double-click start-bg.cmd)
$bat = Join-Path $ScriptDir 'start-bg.cmd'
if (Test-Path $bat) {
  Log "Delegating to start-bg.cmd"
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList "/c `"$bat`"" -Wait -PassThru -WindowStyle Normal
  exit $p.ExitCode
}
Log "ERROR start-bg.cmd missing"
exit 1
