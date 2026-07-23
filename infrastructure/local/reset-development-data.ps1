$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$resolvedRoot = [System.IO.Path]::GetFullPath($projectRoot)
if (-not $resolvedRoot.EndsWith('VynodeNew')) { throw 'Refusing to reset data outside the VynodeNew project.' }
docker compose --project-directory $resolvedRoot down
docker volume rm vynodenew_vynodenew-data 2>$null
Write-Host 'Removed the local VynodeNew review-data volume. This cannot be recovered.'
