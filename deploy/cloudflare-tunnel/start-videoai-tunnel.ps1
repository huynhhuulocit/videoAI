[CmdletBinding()]
param(
  [switch]$Help,
  [switch]$SkipLocalApp,
  [switch]$SkipDnsRoute
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $ScriptDir "..\..")
$EnvFile = Join-Path $ScriptDir ".env"
$EnvExampleFile = Join-Path $ScriptDir ".env.example"
$GeneratedDir = Join-Path $ScriptDir "generated"
$TunnelConfigFile = Join-Path $GeneratedDir "config.yml"
$RootEnvFile = Join-Path $RepoRoot ".env"
$StartProjectScript = Join-Path $RepoRoot "start-project.ps1"

function Show-Help {
  Write-Host @"
VideoAI Cloudflare Tunnel helper

Usage:
  powershell -ExecutionPolicy Bypass -File deploy\cloudflare-tunnel\start-videoai-tunnel.ps1

Options:
  -Help          Show this help and exit.
  -SkipLocalApp  Do not start localhost:3000/4000; assume VideoAI is already running.
  -SkipDnsRoute  Do not run cloudflared tunnel route dns.

First run:
  1. Copy deploy\cloudflare-tunnel\.env.example to deploy\cloudflare-tunnel\.env.
  2. Set HOSTNAME and WEB_ORIGIN to your Cloudflare hostname.
  3. Configure Cloudflare Access for that hostname with explicit allowed emails.
  4. Run this script.
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

function Assert-Command {
  param([string]$CommandName)
  if ($CommandName -eq "cloudflared" -and -not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    $knownCloudflaredPaths = @(
      "C:\Program Files\cloudflared",
      "C:\Program Files (x86)\cloudflared"
    )
    foreach ($knownPath in $knownCloudflaredPaths) {
      $exePath = Join-Path $knownPath "cloudflared.exe"
      if (Test-Path -LiteralPath $exePath) {
        $env:Path = "$knownPath;$env:Path"
        break
      }
    }
  }
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing command '$CommandName'. Install it first, then run this script again."
  }
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory = $RepoRoot
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed: $FilePath $($ArgumentList -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Read-DotEnv {
  param([string]$Path)

  $values = @{}
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

function New-HexSecret {
  param([int]$ByteCount = 32)

  $bytes = [byte[]]::new($ByteCount)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Test-Port {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  return $null -ne $connection
}

function Wait-Http {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Ok "$Name is responding at $Url"
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "$Name did not respond at $Url within $TimeoutSeconds seconds."
}

function Get-PortFromUrl {
  param(
    [string]$Url,
    [int]$DefaultPort
  )
  try {
    $uri = [System.Uri]$Url
    if ($uri.Port -gt 0) {
      return $uri.Port
    }
  } catch {}
  return $DefaultPort
}

function Get-TunnelInfo {
  param([string]$TunnelName)

  $output = & cloudflared tunnel list --output json 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $output) {
    return $null
  }

  try {
    $items = $output | ConvertFrom-Json
    return @($items) | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1
  } catch {
    return $null
  }
}

function Get-CloudflaredHome {
  if ($env:USERPROFILE) {
    return Join-Path $env:USERPROFILE ".cloudflared"
  }
  return Join-Path $HOME ".cloudflared"
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  if (-not (Test-Path -LiteralPath $EnvExampleFile)) {
    throw "Missing $EnvExampleFile."
  }
  Copy-Item -LiteralPath $EnvExampleFile -Destination $EnvFile
  Write-Host "Created $EnvFile. Edit HOSTNAME and WEB_ORIGIN, then run again." -ForegroundColor Yellow
  exit 1
}

$TunnelEnv = Read-DotEnv -Path $EnvFile
$TunnelName = $TunnelEnv["TUNNEL_NAME"]
$Hostname = $TunnelEnv["HOSTNAME"]
$WebOrigin = $TunnelEnv["WEB_ORIGIN"]
$WebLocalUrl = $TunnelEnv["WEB_LOCAL_URL"]
$ApiLocalUrl = $TunnelEnv["API_LOCAL_URL"]
$StartLocalApp = $TunnelEnv["START_LOCAL_APP"]
$SiteGateEnabled = $TunnelEnv["SITE_GATE_ENABLED"]
$SiteGateUsername = $TunnelEnv["SITE_GATE_USERNAME"]
$SiteGatePassword = $TunnelEnv["SITE_GATE_PASSWORD"]
$SiteGateSecret = $TunnelEnv["SITE_GATE_SECRET"]

if (-not $TunnelName) { throw "TUNNEL_NAME is required in $EnvFile." }
if (-not $Hostname -or $Hostname -eq "videoai.example.com") {
  throw "Set HOSTNAME in $EnvFile to your real Cloudflare hostname before running."
}
if (-not $WebOrigin) { $WebOrigin = "https://$Hostname" }
if (-not $WebLocalUrl) { $WebLocalUrl = "http://localhost:3000" }
if (-not $ApiLocalUrl) { $ApiLocalUrl = "http://localhost:4000" }
if (-not $SiteGateEnabled) { $SiteGateEnabled = "true" }
if (-not $SiteGateUsername) { $SiteGateUsername = "videoai" }

if ($SiteGateEnabled -eq "true") {
  if (-not $SiteGatePassword -or $SiteGatePassword -eq "change-me-site-gate-password") {
    throw "Set SITE_GATE_PASSWORD in $EnvFile before sharing the site."
  }
  if (-not $SiteGateSecret -or $SiteGateSecret -eq "change-me-site-gate-secret") {
    $SiteGateSecret = New-HexSecret -ByteCount 32
    Set-DotEnvValue -Path $EnvFile -Key "SITE_GATE_SECRET" -Value $SiteGateSecret
    Write-Ok "Generated SITE_GATE_SECRET in the local tunnel .env file"
  }
}

Write-Step "Checking required tools"
Assert-Command "cloudflared"
Assert-Command "node"
Assert-Command "npm.cmd"
Assert-Command "docker"
Write-Ok "Required commands are available"

Write-Step "Applying tunnel-safe local environment"
Set-DotEnvValue -Path $RootEnvFile -Key "NEXT_PUBLIC_API_GATEWAY_URL" -Value ""
Set-DotEnvValue -Path $RootEnvFile -Key "WEB_ORIGIN" -Value $WebOrigin
Set-DotEnvValue -Path $RootEnvFile -Key "SITE_GATE_ENABLED" -Value $SiteGateEnabled
Set-DotEnvValue -Path $RootEnvFile -Key "SITE_GATE_USERNAME" -Value $SiteGateUsername
Set-DotEnvValue -Path $RootEnvFile -Key "SITE_GATE_PASSWORD" -Value $SiteGatePassword
Set-DotEnvValue -Path $RootEnvFile -Key "SITE_GATE_SECRET" -Value $SiteGateSecret
Write-Ok "Updated root .env for same-origin public API calls"

if (-not $SkipLocalApp -and $StartLocalApp -ne "0") {
  Write-Step "Starting local VideoAI"
  Invoke-Checked "powershell.exe" @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $StartProjectScript,
    "-Restart",
    "-SkipSeed"
  )
} else {
  Write-Step "Skipping local app startup"
}

Write-Step "Checking local origins"
$WebPort = Get-PortFromUrl -Url $WebLocalUrl -DefaultPort 3000
$ApiPort = Get-PortFromUrl -Url $ApiLocalUrl -DefaultPort 4000
if (-not (Test-Port -Port $WebPort)) {
  throw "Web app is not listening on port $WebPort. Start VideoAI or rerun without -SkipLocalApp."
}
if (-not (Test-Port -Port $ApiPort)) {
  throw "API Gateway is not listening on port $ApiPort. Start VideoAI or rerun without -SkipLocalApp."
}
Wait-Http -Url $WebLocalUrl -Name "Web app"
Wait-Http -Url "$ApiLocalUrl/api/v1/health" -Name "API Gateway"

Write-Step "Preparing Cloudflare Tunnel"
$CloudflaredHome = Get-CloudflaredHome
$CertFile = Join-Path $CloudflaredHome "cert.pem"
if (-not (Test-Path -LiteralPath $CertFile)) {
  Write-Host "cloudflared is not logged in. A browser window will open for Cloudflare login." -ForegroundColor Yellow
  Invoke-Checked "cloudflared" @("tunnel", "login")
}

$TunnelInfo = Get-TunnelInfo -TunnelName $TunnelName
if (-not $TunnelInfo) {
  Invoke-Checked "cloudflared" @("tunnel", "create", $TunnelName)
  $TunnelInfo = Get-TunnelInfo -TunnelName $TunnelName
}
if (-not $TunnelInfo) {
  throw "Cannot find tunnel '$TunnelName' after create/list."
}

$TunnelId = [string]$TunnelInfo.id
$CredentialsFile = Join-Path $CloudflaredHome "$TunnelId.json"
if (-not (Test-Path -LiteralPath $CredentialsFile)) {
  throw "Missing tunnel credentials file: $CredentialsFile"
}
Write-Ok "Using tunnel $TunnelName ($TunnelId)"

New-Item -ItemType Directory -Force -Path $GeneratedDir | Out-Null
$NormalizedCredentialsFile = $CredentialsFile.Replace("\", "/")
$ConfigContent = @"
tunnel: $TunnelId
credentials-file: "$NormalizedCredentialsFile"

ingress:
  - hostname: $Hostname
    path: /api/*
    service: $ApiLocalUrl
  - hostname: $Hostname
    service: $WebLocalUrl
  - service: http_status:404
"@
Set-Content -LiteralPath $TunnelConfigFile -Value $ConfigContent -Encoding UTF8
Write-Ok "Generated $TunnelConfigFile"

if (-not $SkipDnsRoute) {
  Write-Step "Routing DNS through Cloudflare Tunnel"
  Invoke-Checked "cloudflared" @("tunnel", "route", "dns", $TunnelName, $Hostname)
}

Write-Step "Validating tunnel ingress"
Invoke-Checked "cloudflared" @("tunnel", "ingress", "validate", "--config", $TunnelConfigFile)

Write-Host ""
Write-Host "Cloudflare Access reminder:" -ForegroundColor Yellow
Write-Host "  Protect https://$Hostname with an Access application."
Write-Host "  Use One-Time PIN and allow only explicit customer/admin email addresses."
Write-Host "  Do not use Everyone or unrestricted One-Time PIN policies."

Write-Step "Starting Cloudflare Tunnel"
Write-Host "Public URL: https://$Hostname" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the tunnel."
Invoke-Checked "cloudflared" @("tunnel", "--config", $TunnelConfigFile, "run", $TunnelName) -WorkingDirectory $ScriptDir
