# CMG WMS — 停止后台 API / Web
$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$RunDir  = Join-Path $ScriptDir '.run'
$PidFile = Join-Path $RunDir 'pids.json'
$ApiPort = 3001
$WebPort = 8080

function Stop-Tree([int]$ProcessId) {
  if ($ProcessId -le 0) { return }
  try {
    # 先杀子进程再杀自身（cmd 包装的 npm）
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Tree $_.ProcessId }
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
      Write-Host "  已结束 PID $ProcessId ($($proc.ProcessName))"
    }
  } catch {}
}

function Get-PortPids([int]$Port) {
  $ids = @()
  try {
    $ids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {}
  if (-not $ids -or $ids.Count -eq 0) {
    netstat -ano 2>$null | Select-String (":$Port\s+.*LISTENING") | ForEach-Object {
      if ($_ -match '\s+(\d+)\s*$') { $ids += [int]$Matches[1] }
    }
  }
  return @($ids | Where-Object { $_ -gt 0 } | Select-Object -Unique)
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  CMG WMS 停止服务' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan

if (Test-Path $PidFile) {
  try {
    $info = Get-Content $PidFile -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host "[PID 文件] api=$($info.api) web=$($info.web)"
    if ($info.api) { Stop-Tree ([int]$info.api) }
    if ($info.web) { Stop-Tree ([int]$info.web) }
  } catch {
    Write-Host "[提示] 读取 pids.json 失败: $_" -ForegroundColor Yellow
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

foreach ($port in @($ApiPort, $WebPort)) {
  $pids = Get-PortPids $port
  foreach ($id in $pids) {
    Write-Host "[端口 $port] 结束 PID $id"
    Stop-Tree $id
  }
}

# 兜底：node 里跑 nest/vite 的残留
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmd -and ($cmd -match 'cucumber-inventory-project' -or $cmd -match 'apps\\api' -or $cmd -match 'apps\\web')) {
      if ($cmd -match 'nest|vite|start:dev') {
        Write-Host "  清理 node PID $($_.Id)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

Start-Sleep -Milliseconds 400
$left = @()
if (Get-PortPids $ApiPort) { $left += $ApiPort }
if (Get-PortPids $WebPort) { $left += $WebPort }
if ($left.Count -eq 0) {
  Write-Host '已全部停止' -ForegroundColor Green
} else {
  Write-Host "仍有端口占用: $($left -join ', ') — 可手动结束对应进程" -ForegroundColor Yellow
}
