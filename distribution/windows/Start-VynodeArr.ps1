$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
foreach ($folder in 'data','movies','television','downloads') {
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop is required. Install and start Docker Desktop, then run this file again.'
}
docker compose pull
docker compose up -d
Start-Process 'http://localhost:8686'
