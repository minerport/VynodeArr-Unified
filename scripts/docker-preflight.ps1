param([switch]$Media)

$ErrorActionPreference = 'Stop'
$composeFiles = @('-f', 'compose.yaml')

if ($Media) {
  $composeFiles += @('-f', 'compose.media.yaml')
  if (-not $env:VYNODEARR_MEDIA_PATH -and (Test-Path -LiteralPath '.env')) {
    $line = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^VYNODEARR_MEDIA_PATH=' } | Select-Object -Last 1
    if ($line) { $env:VYNODEARR_MEDIA_PATH = $line.Substring('VYNODEARR_MEDIA_PATH='.Length) }
  }
  if (-not $env:VYNODEARR_MEDIA_PATH) { throw 'Set VYNODEARR_MEDIA_PATH in .env before using -Media.' }
  if (-not (Test-Path -LiteralPath $env:VYNODEARR_MEDIA_PATH -PathType Container)) {
    throw "Main media folder does not exist: $env:VYNODEARR_MEDIA_PATH"
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is not installed or not on PATH.' }
& docker compose version *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is unavailable.' }
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'The Docker service is not running or is not accessible.' }
& docker compose @composeFiles config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration validation failed.' }

Write-Host 'Docker preflight passed.'
if ($Media) { Write-Host "Main media folder: $env:VYNODEARR_MEDIA_PATH -> /media" }
$port = if ($env:VYNODEARR_PORT) { $env:VYNODEARR_PORT } else { '8686' }
Write-Host "Web interface: http://localhost:$port"
