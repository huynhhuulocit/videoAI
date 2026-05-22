[CmdletBinding()]
param(
  [switch]$Help,
  [switch]$SkipLocalApp,
  [switch]$RestartLocalApp
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $ScriptDir "..\..")
$RootEnvFile = Join-Path $RepoRoot ".env"
$RootEnvExampleFile = Join-Path $RepoRoot ".env.example"
$GeneratedDir = Join-Path $ScriptDir "generated"
$LogFile = Join-Path $GeneratedDir "quick-tunnel.log"
$ErrFile = Join-Path $GeneratedDir "quick-tunnel.err.log"
$PidFile = Join-Path $GeneratedDir "quick-tunnel.pid"
$StartProjectScript = Join-Path $RepoRoot "start-project.ps1"

function Show-Help {
  Write-Host @"
VideoAI quick trycloudflare tunnel

Usage:
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-trycloudflare.ps1

Options:
  -Help             Show this help and exit.
  -SkipLocalApp     Do not start/restart VideoAI; assume localhost:3000/4000 already work.
  -RestartLocalApp  Force restart local Web/API before starting the tunnel.

Output:
  Prints a temporary https://*.trycloudflare.com URL.

Stop:
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\stop-trycloudflare.ps1
"@
}

if ($Help) {
  Show-Help
  exit 0
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "OK  $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "WARN  $Message" -ForegroundColor Yellow
}

function Add-CloudflaredPathFallback {
  if (Get-Command "cloudflared" -ErrorAction SilentlyContinue) {
    return
  }

  $knownCloudflaredPaths = @(
    "C:\Program Files\cloudflared",
    "C:\Program Files (x86)\cloudflared"
  )
  foreach ($knownPath in $knownCloudflaredPaths) {
    $exePath = Join-Path $knownPath "cloudflared.exe"
    if (Test-Path -LiteralPath $exePath) {
      $env:Path = "$knownPath;$env:Path"
      return
    }
  }
}

function Assert-Command {
  param([string]$CommandName)
  if ($CommandName -eq "cloudflared") {
    Add-CloudflaredPathFallback
  }
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing command '$CommandName'. Install it first, then run this script again."
  }
}

function Read-DotEnv {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
  }
  return $values
}

function Set-DotEnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }

  $lines = @(Get-Content -LiteralPath $Path)
  $escapedValue = $Value.Replace('"', '\"')
  $nextLine = "$Key=`"$escapedValue`""
  $found = $false
  $nextLines = foreach ($line in $lines) {
    if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
      $found = $true
      $nextLine
    } else {
      $line
    }
  }
  if (-not $found) {
    $nextLines += $nextLine
  }
  Set-Content -LiteralPath $Path -Value $nextLines -Encoding UTF8
}

function Test-Port {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  return $null -ne $connection
}

function Test-SiteGateRedirect {
  try {
    $response = Invoke-WebRequest `
      -Uri "http://localhost:3000/projects" `
      -UseBasicParsing `
      -MaximumRedirection 0 `
      -TimeoutSec 5 `
      -ErrorAction SilentlyContinue

    return $response.StatusCode -eq 307 -and [string]$response.Headers.Location -like "/site-login*"
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $location = [string]$_.Exception.Response.Headers["Location"]
      return $status -eq 307 -and $location -like "/site-login*"
    }
  }
  return $false
}

function Stop-CloudflaredProcesses {
  $pidValue = $null
  if (Test-Path -LiteralPath $PidFile) {
    $pidValue = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  }

  if ($pidValue) {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $process.Id -Force
      Start-Sleep -Seconds 1
    }
  }

  Get-Process "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
}

function Start-LocalVideoAiIfNeeded {
  if ($SkipLocalApp) {
    Write-Warn "Skipping local app startup by request."
    return
  }

  $webListening = Test-Port -Port 3000
  $apiListening = Test-Port -Port 4000
  $gateLooksActive = Test-SiteGateRedirect

  if ($RestartLocalApp -or -not $webListening -or -not $apiListening -or -not $gateLooksActive) {
    Write-Step "Starting/restarting local VideoAI"
    if (-not $gateLooksActive -and $webListening) {
      Write-Warn "Site gate did not look active. Restarting Web/API so .env is loaded."
    }
    Push-Location -LiteralPath $RepoRoot
    try {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $StartProjectScript -Restart -SkipSeed
      if ($LASTEXITCODE -ne 0) {
        throw "start-project.ps1 failed."
      }
    } finally {
      Pop-Location
    }
  } else {
    Write-Ok "Local Web/API are already running and site gate redirects are active"
  }
}

function Wait-QuickTunnelUrl {
  param([int]$TimeoutSeconds = 45)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $raw = ""
    if (Test-Path -LiteralPath $ErrFile) {
      $raw += Get-Content -LiteralPath $ErrFile -Raw -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $LogFile) {
      $raw += "`n" + (Get-Content -LiteralPath $LogFile -Raw -ErrorAction SilentlyContinue)
    }
    $match = [regex]::Match($raw, "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($match.Success) {
      return $match.Value
    }
    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for trycloudflare URL. Check logs in $GeneratedDir."
}

Write-Step "Checking tools"
Assert-Command "cloudflared"
Assert-Command "node"
Assert-Command "npm.cmd"
Write-Ok "Required commands are available"

if (-not (Test-Path -LiteralPath $RootEnvFile)) {
  if (-not (Test-Path -LiteralPath $RootEnvExampleFile)) {
    throw "Missing .env and .env.example."
  }
  Copy-Item -LiteralPath $RootEnvExampleFile -Destination $RootEnvFile
  Write-Ok "Created root .env from .env.example"
}

Write-Step "Applying quick tunnel-safe environment"
Set-DotEnvValue -Path $RootEnvFile -Key "API_GATEWAY_URL" -Value "http://localhost:4000"
Set-DotEnvValue -Path $RootEnvFile -Key "NEXT_PUBLIC_API_GATEWAY_URL" -Value ""
$rootEnv = Read-DotEnv -Path $RootEnvFile
if ($rootEnv["SITE_GATE_ENABLED"] -ne "true") {
  Write-Warn "SITE_GATE_ENABLED is not true. Public quick tunnel will not have the app-level site gate."
}
if ($rootEnv["SITE_GATE_ENABLED"] -eq "true" -and -not $rootEnv["SITE_GATE_PASSWORD"]) {
  throw "SITE_GATE_PASSWORD is empty in root .env. Set it before public sharing."
}
Write-Ok "Frontend will call API through same-origin /api/v1"

Start-LocalVideoAiIfNeeded

Write-Step "Stopping existing quick tunnel processes"
New-Item -ItemType Directory -Force -Path $GeneratedDir | Out-Null
Stop-CloudflaredProcesses
Remove-Item -LiteralPath $LogFile, $ErrFile -Force -ErrorAction SilentlyContinue

Write-Step "Starting trycloudflare tunnel"
$cloudflared = (Get-Command "cloudflared").Source
$process = Start-Process `
  -FilePath $cloudflared `
  -ArgumentList @("tunnel", "--url", "http://localhost:3000", "--no-autoupdate") `
  -RedirectStandardOutput $LogFile `
  -RedirectStandardError $ErrFile `
  -PassThru `
  -WindowStyle Hidden
Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ASCII

$publicUrl = Wait-QuickTunnelUrl
Write-Ok "Quick tunnel started with PID $($process.Id)"
Write-Host ""
Write-Host "Public URL:" -ForegroundColor Green
Write-Host "  $publicUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Stop command:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\stop-trycloudflare.ps1"
Write-Host ""
Write-Host "Logs:"
Write-Host "  $LogFile"
Write-Host "  $ErrFile"
