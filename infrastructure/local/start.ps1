$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env'))) {
  Copy-Item -LiteralPath (Join-Path $projectRoot '.env.example') -Destination (Join-Path $projectRoot '.env')
  Write-Host 'Created .env with local bundled-engine defaults. Replace example keys before non-local use.'
}
docker compose --project-directory $projectRoot up --build -d
Write-Host 'VynodeNew and both private engines are starting. Open http://127.0.0.1:4310 when docker compose ps reports healthy.'
