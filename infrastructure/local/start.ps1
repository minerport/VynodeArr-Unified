$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env'))) {
  Copy-Item -LiteralPath (Join-Path $projectRoot '.env.example') -Destination (Join-Path $projectRoot '.env')
  Write-Host 'Created .env from the safe fixture-mode example. Review it before connecting engines.'
}
docker compose --project-directory $projectRoot up --build -d
Write-Host 'VynodeNew is available at http://127.0.0.1:4310'
