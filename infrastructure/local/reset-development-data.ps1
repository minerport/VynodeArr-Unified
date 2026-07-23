$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$resolvedRoot = [System.IO.Path]::GetFullPath($projectRoot)
if (-not $resolvedRoot.EndsWith('VynodeArr')) { throw 'Refusing to reset data outside the VynodeArr project.' }
docker compose --project-directory $resolvedRoot down
docker volume rm vynodearr_vynodearr-data 2>$null
Write-Host 'Removed the local VynodeArr review-data volume. This cannot be recovered.'
