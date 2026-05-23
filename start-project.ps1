[CmdletBinding()]
param(
  [switch]$Restart,
  [switch]$SkipDocker,
  [switch]$SkipDbSetup,
  [switch]$SkipSeed,
  [switch]$VisibleLogs
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root "tmp\dev"
$DockerComposeFile = Join-Path $Root "infra\docker-compose.yml"
$EnvFile = Join-Path $Root ".env"
$EnvExampleFile = Join-Path $Root ".env.example"
$WebBuildCacheDir = Join-Path $Root "apps\web\.next"

Set-Location -LiteralPath $Root
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

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
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing command '$CommandName'. Install it first, then run this script again."
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

function Import-DotEnvIntoProcess {
  param([string]$Path)

  $values = Read-DotEnv -Path $Path
  foreach ($key in $values.Keys) {
    [Environment]::SetEnvironmentVariable($key, [string]$values[$key], "Process")
  }
}

function Assert-RequiredEnv {
  param([string[]]$Keys)

  $missing = @()
  foreach ($key in $Keys) {
    $value = [Environment]::GetEnvironmentVariable($key, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
      $missing += $key
    }
  }

  if ($missing.Count -gt 0) {
    throw "Missing required .env value(s): $($missing -join ', '). Update .env from .env.example before starting the project."
  }
}

function Get-PortFromUrl {
  param(
    [string]$Url,
    [int]$DefaultPort,
    [string]$Name
  )

  try {
    $uri = [Uri]$Url
  } catch {
    throw "$Name must be a valid URL with a host and optional port."
  }

  if ($uri.Port -gt 0) {
    return $uri.Port
  }

  return $DefaultPort
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList
  )
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($ArgumentList -join ' ')"
  }
}

function Test-Port {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  return $null -ne $connection
}

function Get-WorkspaceProcess {
  param([int]$ProcessId)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
  if (-not $process) {
    return $null
  }

  $commandLine = [string]$process.CommandLine
  if ($commandLine.IndexOf($Root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    return $process
  }

  return $null
}

function Stop-ProcessTree {
  param([int]$ProcessId)

  $processIds = New-Object System.Collections.Generic.HashSet[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  [void]$queue.Enqueue($ProcessId)

  while ($queue.Count -gt 0) {
    $currentId = $queue.Dequeue()
    if (-not $processIds.Add($currentId)) {
      continue
    }

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$currentId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
      [void]$queue.Enqueue([int]$child.ProcessId)
    }
  }

  foreach ($id in ($processIds | Sort-Object -Descending)) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
}

function Stop-WorkspaceProcessTree {
  param([int]$ProcessId)

  $workspaceProcess = Get-WorkspaceProcess -ProcessId $ProcessId
  if (-not $workspaceProcess) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    return
  }

  $processIds = New-Object System.Collections.Generic.HashSet[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  [void]$queue.Enqueue($ProcessId)

  $parentId = [int]$workspaceProcess.ParentProcessId
  while ($parentId -gt 0) {
    $parent = Get-WorkspaceProcess -ProcessId $parentId
    if (-not $parent) {
      break
    }
    [void]$queue.Enqueue($parentId)
    $parentId = [int]$parent.ParentProcessId
  }

  while ($queue.Count -gt 0) {
    $currentId = $queue.Dequeue()
    if (-not $processIds.Add($currentId)) {
      continue
    }

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$currentId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
      if (Get-WorkspaceProcess -ProcessId ([int]$child.ProcessId)) {
        [void]$queue.Enqueue([int]$child.ProcessId)
      }
    }
  }

  foreach ($id in ($processIds | Sort-Object -Descending)) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
}

function Stop-Port {
  param([int]$Port)
  $processIds = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    if ($processId -and $processId -ne 0) {
      Stop-WorkspaceProcessTree -ProcessId $processId
    }
  }
}

function Stop-WorkspaceDevProcesses {
  $allProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
  $devProcesses = $allProcesses | Where-Object {
    $commandLine = [string]$_.CommandLine
    $isWorkspaceProcess = $commandLine.IndexOf($Root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    $commandLine -like "*npm*--workspace @videoai/api-gateway run dev*" -or
      $commandLine -like "*npm*--workspace @videoai/web run dev*" -or
      $commandLine -like "*tsx*watch*src*main.ts*" -or
      ($isWorkspaceProcess -and
      $commandLine -like "*next*dev --port 3000*"
    )
  }

  foreach ($process in $devProcesses) {
    Stop-ProcessTree -ProcessId ([int]$process.ProcessId)
  }
}

function Wait-Port {
  param(
    [int]$Port,
    [string]$Name,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port -Port $Port) {
      Write-Ok "$Name is listening on port $Port"
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "$Name did not start on port $Port within $TimeoutSeconds seconds."
}

function Ensure-DockerServicePort {
  param(
    [string]$ServiceName,
    [int]$Port,
    [string]$Name
  )

  if (Test-Port -Port $Port) {
    return
  }

  Write-Step "$Name is not publishing port $Port; recreating Docker service '$ServiceName'"
  Invoke-Checked "docker" @("compose", "-f", $DockerComposeFile, "up", "-d", "--force-recreate", $ServiceName)
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

function Clear-WebBuildCache {
  if (-not (Test-Path -LiteralPath $WebBuildCacheDir)) {
    return
  }

  $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
  $resolvedCache = (Resolve-Path -LiteralPath $WebBuildCacheDir).Path
  if (-not $resolvedCache.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove unexpected Web build cache path: $resolvedCache"
  }

  Remove-Item -LiteralPath $resolvedCache -Recurse -Force
  Write-Ok "Cleared stale Next.js build cache at apps\web\.next"
}

function Test-DatabaseSeeded {
  $checkScript = @'
import { prisma } from "./packages/database/src/index.ts";

try {
  const userCount = await prisma.userProfile.count();
  await prisma.$disconnect();
  process.exit(userCount > 0 ? 0 : 2);
} catch (error) {
  console.error(error);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(3);
}
'@

  & npm.cmd exec -- tsx -e $checkScript | Out-Host
  return $LASTEXITCODE -eq 0
}

function Start-DevProcess {
  param(
    [string]$Name,
    [int]$Port,
    [string[]]$NpmArgs,
    [string]$LogPrefix
  )

  if (Test-Port -Port $Port) {
    Write-Ok "$Name already has a listener on port $Port"
    return
  }

  $outLog = Join-Path $LogDir "$LogPrefix.out.log"
  $errLog = Join-Path $LogDir "$LogPrefix.err.log"
  Remove-Item -LiteralPath $outLog, $errLog -Force -ErrorAction SilentlyContinue

  if ($VisibleLogs) {
    $command = "Set-Location -LiteralPath '$Root'; npm.cmd $($NpmArgs -join ' ')"
    Start-Process -FilePath "powershell.exe" `
      -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command) `
      -WorkingDirectory $Root
  } else {
    Start-Process -FilePath "npm.cmd" `
      -ArgumentList $NpmArgs `
      -WorkingDirectory $Root `
      -RedirectStandardOutput $outLog `
      -RedirectStandardError $errLog `
      -WindowStyle Hidden
  }

  Wait-Port -Port $Port -Name $Name -TimeoutSeconds 90
}

Write-Step "Checking local tools"
Assert-Command "node"
Assert-Command "npm.cmd"
if (-not $SkipDocker) {
  Assert-Command "docker"
}
Write-Ok "Required commands are available"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  if (-not (Test-Path -LiteralPath $EnvExampleFile)) {
    throw "Missing .env and .env.example. Create .env before starting the project."
  }
  Copy-Item -LiteralPath $EnvExampleFile -Destination $EnvFile
  Write-Ok "Created .env from .env.example"
}

Import-DotEnvIntoProcess -Path $EnvFile
Assert-RequiredEnv @(
  "DATABASE_URL",
  "REDIS_URL",
  "API_GATEWAY_URL",
  "PORT",
  "NEXTAUTH_SECRET",
  "AI_CONFIG_ENCRYPTION_KEY",
  "WEB_ORIGIN"
)
if ($env:SITE_GATE_ENABLED -eq "true") {
  Assert-RequiredEnv @("SITE_GATE_USERNAME", "SITE_GATE_PASSWORD", "SITE_GATE_SECRET")
}

$RedisPort = Get-PortFromUrl -Url $env:REDIS_URL -DefaultPort 6379 -Name "REDIS_URL"

if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
  Write-Step "Installing npm dependencies"
  Invoke-Checked "npm.cmd" @("install")
}

if ($Restart) {
  Write-Step "Stopping existing Web/API listeners"
  Stop-WorkspaceDevProcesses
  Stop-Port -Port 3000
  Stop-Port -Port 4000
  Start-Sleep -Seconds 2
}

if (-not $SkipDocker) {
  Write-Step "Starting PostgreSQL and Redis"
  Invoke-Checked "docker" @("info")
  Invoke-Checked "docker" @("compose", "-f", $DockerComposeFile, "up", "-d")
  Ensure-DockerServicePort -ServiceName "postgres" -Port 55432 -Name "PostgreSQL"
  Ensure-DockerServicePort -ServiceName "redis" -Port $RedisPort -Name "Redis"
  Wait-Port -Port 55432 -Name "PostgreSQL" -TimeoutSeconds 90
  Wait-Port -Port $RedisPort -Name "Redis" -TimeoutSeconds 60
}

if (-not $SkipDbSetup) {
  Write-Step "Syncing Prisma schema"
  Invoke-Checked "npm.cmd" @("run", "db:generate")
  Invoke-Checked "npm.cmd" @("run", "db:push")

  if (-not $SkipSeed) {
    Write-Step "Checking seed data"
    if (Test-DatabaseSeeded) {
      Write-Ok "Seed data already exists"
    } else {
      Invoke-Checked "npm.cmd" @("run", "db:seed")
      Write-Ok "Seed data created"
    }
  }
}

Write-Step "Starting API Gateway and Web"
Start-DevProcess -Name "API Gateway" -Port 4000 -NpmArgs @("--workspace", "@videoai/api-gateway", "run", "dev") -LogPrefix "api"
if (-not (Test-Port -Port 3000)) {
  Write-Step "Cleaning Web build cache"
  Clear-WebBuildCache
}
Start-DevProcess -Name "Web app" -Port 3000 -NpmArgs @("--workspace", "@videoai/web", "run", "dev") -LogPrefix "web"

Write-Step "Verifying HTTP endpoints"
Wait-Http -Url "http://localhost:4000/api/v1/health" -Name "API Gateway"
Wait-Http -Url "http://localhost:3000" -Name "Web app"

Write-Host ""
Write-Host "VideoAI is ready." -ForegroundColor Green
Write-Host "Web: http://localhost:3000"
Write-Host "API: http://localhost:4000/api/v1/health"
Write-Host "Logs:"
Write-Host "  $LogDir\api.out.log"
Write-Host "  $LogDir\api.err.log"
Write-Host "  $LogDir\web.out.log"
Write-Host "  $LogDir\web.err.log"
Write-Host ""
Write-Host "Useful options:"
Write-Host "  .\start-project.ps1 -Restart       Stop old Web/API listeners before starting"
Write-Host "  .\start-project.ps1 -VisibleLogs   Open visible terminals for Web/API logs"
Write-Host "  .\start-project.ps1 -SkipDbSetup   Skip Prisma generate/db push/seed check"
