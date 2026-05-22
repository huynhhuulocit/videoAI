[CmdletBinding()]
param(
  [switch]$Help
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GeneratedDir = Join-Path $ScriptDir "generated"
$PidFile = Join-Path $GeneratedDir "quick-tunnel.pid"

function Show-Help {
  Write-Host @"
Stop VideoAI quick trycloudflare tunnel

Usage:
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\stop-trycloudflare.ps1

This stops the PID recorded by start-trycloudflare.ps1 and then stops any remaining cloudflared processes.
"@
}

if ($Help) {
  Show-Help
  exit 0
}

$stoppedIds = New-Object System.Collections.Generic.List[int]

if (Test-Path -LiteralPath $PidFile) {
  $pidValue = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($pidValue) {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $process.Id -Force
      $stoppedIds.Add($process.Id)
      Start-Sleep -Seconds 1
    }
  }
}

foreach ($process in @(Get-Process "cloudflared" -ErrorAction SilentlyContinue)) {
  Stop-Process -Id $process.Id -Force
  $stoppedIds.Add($process.Id)
}

Start-Sleep -Seconds 1
$remaining = @(Get-Process "cloudflared" -ErrorAction SilentlyContinue)

if ($remaining.Count -eq 0) {
  if (Test-Path -LiteralPath $PidFile) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  }
  Write-Host "OK  trycloudflare stopped. No cloudflared processes remain." -ForegroundColor Green
  if ($stoppedIds.Count -gt 0) {
    Write-Host "Stopped PID(s): $($stoppedIds -join ', ')"
  }
  exit 0
}

Write-Host "WARN  Some cloudflared processes are still running:" -ForegroundColor Yellow
$remaining | Select-Object Id, ProcessName, StartTime | Format-Table -AutoSize
exit 1
