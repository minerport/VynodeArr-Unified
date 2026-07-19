[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $MovieEnginePath,

    [Parameter(Mandatory = $true)]
    [string] $TelevisionEnginePath,

    [ValidateSet('linux-x64', 'linux-arm64')]
    [string] $RuntimeIdentifier = 'linux-x64',

    [string] $DotnetPath = 'dotnet',

    [string] $MovieEntryPoint = 'Radarr',

    [string] $TelevisionEntryPoint = 'Sonarr',

    [switch] $SkipArchive
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'artifacts/linux'))
$stageRoot = [System.IO.Path]::GetFullPath((Join-Path $artifactRoot "VynodeArr-$RuntimeIdentifier"))
$movieSource = [System.IO.Path]::GetFullPath($MovieEnginePath)
$televisionSource = [System.IO.Path]::GetFullPath($TelevisionEnginePath)

function Assert-Directory([string] $Path, [string] $Label) {
    if (-not [System.IO.Directory]::Exists($Path)) {
        throw "$Label directory does not exist: $Path"
    }
}

function Assert-EntryPoint([string] $Root, [string] $EntryPoint, [string] $Label) {
    $path = Join-Path $Root $EntryPoint
    if (-not [System.IO.File]::Exists($path)) {
        throw "$Label entry point does not exist: $path"
    }
}

Assert-Directory $movieSource 'Movie engine'
Assert-Directory $televisionSource 'Television engine'
Assert-EntryPoint $movieSource $MovieEntryPoint 'Movie engine'
Assert-EntryPoint $televisionSource $TelevisionEntryPoint 'Television engine'

if (-not $stageRoot.StartsWith($artifactRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe staging path: $stageRoot"
}

if ([System.IO.Directory]::Exists($stageRoot)) {
    $removed = $false
    for ($attempt = 1; $attempt -le 3 -and -not $removed; $attempt++) {
        try {
            Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction Stop
            $removed = $true
        }
        catch {
            if ($attempt -ge 3) {
                throw
            }
            Start-Sleep -Milliseconds (250 * $attempt)
        }
    }

    if (-not $removed) {
        throw "Unable to clear the Linux staging directory after three attempts: $stageRoot"
    }
}

$gatewayRoot = Join-Path $stageRoot 'gateway'
$movieTarget = Join-Path $stageRoot 'engines/movie'
$televisionTarget = Join-Path $stageRoot 'engines/television'

New-Item -ItemType Directory -Force -Path $gatewayRoot, $movieTarget, $televisionTarget | Out-Null

$dotnet = Get-Command $DotnetPath -ErrorAction Stop
& $dotnet.Source publish (Join-Path $repositoryRoot 'src/VynodeArr.Gateway/VynodeArr.Gateway.csproj') `
    --configuration Release `
    --runtime $RuntimeIdentifier `
    --self-contained true `
    --output $gatewayRoot `
    -p:PublishSingleFile=true `
    -p:DebugType=None `
    -p:DebugSymbols=false

if ($LASTEXITCODE -ne 0) {
    throw "Gateway publish failed with exit code $LASTEXITCODE."
}

Copy-Item -Path (Join-Path $movieSource '*') -Destination $movieTarget -Recurse -Force
Copy-Item -Path (Join-Path $televisionSource '*') -Destination $televisionTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'distribution/source-lock.json') -Destination $stageRoot

$installedConfigPath = Join-Path $gatewayRoot 'appsettings.json'
$installedConfig = Get-Content -LiteralPath $installedConfigPath -Raw | ConvertFrom-Json
$installedConfig.Urls = 'http://0.0.0.0:8686'
$installedConfig.VynodeArr.DataRoot = '/config'
$installedConfig.VynodeArr.Engines.Movie.Enabled = $true
$installedConfig.VynodeArr.Engines.Movie.ExecutablePath = "/opt/vynodearr/engines/movie/$MovieEntryPoint"
$installedConfig.VynodeArr.Engines.Movie.Arguments = '-nobrowser -data={data}'
$installedConfig.VynodeArr.Engines.Television.Enabled = $true
$installedConfig.VynodeArr.Engines.Television.ExecutablePath = "/opt/vynodearr/engines/television/$TelevisionEntryPoint"
$installedConfig.VynodeArr.Engines.Television.Arguments = '-nobrowser -data={data}'
[System.IO.File]::WriteAllText(
    $installedConfigPath,
    ($installedConfig | ConvertTo-Json -Depth 10),
    [System.Text.UTF8Encoding]::new($false))

$checksums = Get-ChildItem -LiteralPath $stageRoot -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
        $relativePath = $_.FullName.Substring($stageRoot.Length).TrimStart([char[]] @('\', '/'))
        [pscustomobject]@{
            path = $relativePath.Replace('\', '/')
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            size = $_.Length
        }
    }

$packageManifest = [ordered]@{
    schemaVersion = 1
    createdUtc = [DateTimeOffset]::UtcNow.ToString('O')
    runtimeIdentifier = $RuntimeIdentifier
    engineEntryPoints = [ordered]@{
        movie = $MovieEntryPoint
        television = $TelevisionEntryPoint
    }
    files = @($checksums)
}

[System.IO.File]::WriteAllText(
    (Join-Path $stageRoot 'package-manifest.json'),
    ($packageManifest | ConvertTo-Json -Depth 6),
    [System.Text.UTF8Encoding]::new($false))

if (-not $SkipArchive) {
    $archivePath = Join-Path $artifactRoot "VynodeArr-$RuntimeIdentifier.tar.gz"
    if ([System.IO.File]::Exists($archivePath)) {
        Remove-Item -LiteralPath $archivePath -Force
    }

    $tar = Get-Command tar -ErrorAction Stop
    & $tar.Source -czf $archivePath -C $artifactRoot (Split-Path $stageRoot -Leaf)
    if ($LASTEXITCODE -ne 0) {
        throw "Archive creation failed with exit code $LASTEXITCODE."
    }

    Write-Output "Created package: $archivePath"
}

Write-Output "Staged package: $stageRoot"
