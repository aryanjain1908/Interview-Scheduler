<#
.SYNOPSIS
  Starts GRIT Interviews (database, API, web app) with Docker, waits until it is ready, and opens it.

.EXAMPLE
  .\start.ps1             # build if needed, start, open http://localhost:5173
  .\start.ps1 -Rebuild    # rebuild the images first (after dependency changes)
  .\start.ps1 -Reset      # start, then wipe and reload the demo data
  .\start.ps1 -Test       # start, then run the backend test suite
  .\start.ps1 -Logs       # follow the logs of all services
  .\start.ps1 -Stop       # stop everything (data is kept)
  .\start.ps1 -Stop -Wipe # stop and delete the database volume
#>
param(
  [switch]$Rebuild,
  [switch]$Reset,
  [switch]$Test,
  [switch]$Logs,
  [switch]$Stop,
  [switch]$Wipe,
  [switch]$NoBrowser
)

# Docker writes progress and warnings to stderr; Windows PowerShell 5.1 would treat that as
# an error under "Stop". Failures are detected through $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

$Project = "grit-interviews"
$WebUrl = "http://localhost:5173"
$ApiUrl = "http://localhost:8000/api/health"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

function Test-DockerRunning {
  docker info 2>&1 | Out-Null
  return $LASTEXITCODE -eq 0
}

function Wait-Url($url, $name, $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { Ok "$name is ready"; return }
    } catch { }
    Start-Sleep -Seconds 2
  }
  Fail "$name did not respond at $url within $seconds seconds. Run '.\start.ps1 -Logs' to see why."
}

Step "Checking Docker"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and run this again."
}
if (-not (Test-DockerRunning)) {
  # Docker Desktop installs either machine-wide or per user; also look next to docker.exe.
  $dockerDir = Split-Path -Parent (Get-Command docker).Source
  $desktop = @(
    (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe"),
    (Join-Path $dockerDir "..\..\Docker Desktop.exe")
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($desktop) {
    Write-Host "    Docker Desktop is not running. Starting it..."
    Start-Process -FilePath $desktop | Out-Null
    $deadline = (Get-Date).AddMinutes(3)
    while (-not (Test-DockerRunning)) {
      if ((Get-Date) -gt $deadline) { Fail "Docker Desktop did not start within 3 minutes. Start it manually and run this again." }
      Start-Sleep -Seconds 3
    }
  } else {
    Fail "Docker is installed but not running. Start Docker Desktop and run this again."
  }
}
Ok "Docker is running"

if ($Stop) {
  Step "Stopping GRIT Interviews"
  if ($Wipe) { docker compose down -v } else { docker compose down }
  Ok "Stopped$(if ($Wipe) { ' and deleted the database' })"
  exit 0
}
if ($Logs) {
  docker compose logs -f --tail 100
  exit 0
}

# Built with plain 'docker build' because 'docker compose build' fails on some Windows setups.
foreach ($svc in @("backend", "frontend")) {
  $image = "$Project-$svc"
  $exists = (docker images -q $image 2>$null)
  if ($Rebuild -or -not $exists) {
    Step "Building the $svc image (first run takes a few minutes)"
    docker build -t $image "./$svc"
    if ($LASTEXITCODE -ne 0) { Fail "Building the $svc image failed." }
    Ok "$image built"
  }
}

Step "Starting database, API and web app"
# -V gives the web app fresh node_modules, so new frontend dependencies are picked up.
docker compose up -d --no-build -V
if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed. Is something else using port 5432, 8000 or 5173?" }

Step "Waiting for the services"
Wait-Url $ApiUrl "API" 180
Wait-Url $WebUrl "Web app" 180

if ($Reset) {
  Step "Reloading the demo data"
  docker compose exec -T backend python -m app.seed --reset
  if ($LASTEXITCODE -ne 0) { Fail "Reloading the demo data failed." }
}
if ($Test) {
  Step "Running the backend tests"
  docker compose exec -T backend pytest -q -p no:warnings
  if ($LASTEXITCODE -ne 0) { Fail "Some tests failed (see above)." }
  Ok "All tests passed"
}

Write-Host ""
Write-Host "GRIT Interviews is running" -ForegroundColor Green
Write-Host "  Web app   $WebUrl"
Write-Host "  API docs  http://localhost:8000/docs"
Write-Host ""
Write-Host "  Demo accounts (password demo1234):"
Write-Host "    sneha@grit.demo   student, ready to book"
Write-Host "    priya@grit.demo   interviewer"
Write-Host "    admin@grit.demo   interview team"
Write-Host ""
Write-Host "  Stop with: .\start.ps1 -Stop"

if (-not $NoBrowser) { Start-Process $WebUrl }
