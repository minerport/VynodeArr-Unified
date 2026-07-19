[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $MovieEnginePath,

    [Parameter(Mandatory = $true)]
    [string] $TelevisionEnginePath,

    [string] $RuntimeIdentifier = 'win-x64',

    [switch] $SkipArchive
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'artifacts\windows'))
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
Assert-EntryPoint $movieSource 'Radarr.Console.exe' 'Movie engine'
Assert-EntryPoint $televisionSource 'Sonarr.Console.exe' 'Television engine'

if (-not $stageRoot.StartsWith($artifactRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe staging path: $stageRoot"
}

if ([System.IO.Directory]::Exists($stageRoot)) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
}

$gatewayRoot = Join-Path $stageRoot 'gateway'
$movieTarget = Join-Path $stageRoot 'engines\movie'
$televisionTarget = Join-Path $stageRoot 'engines\television'
$dataTarget = Join-Path $stageRoot 'data'

New-Item -ItemType Directory -Force -Path $gatewayRoot, $movieTarget, $televisionTarget, $dataTarget | Out-Null

$dotnet = Get-Command dotnet -ErrorAction Stop
& $dotnet.Source publish (Join-Path $repositoryRoot 'src\VynodeArr.Gateway\VynodeArr.Gateway.csproj') `
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
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'distribution\source-lock.json') -Destination $stageRoot

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
    files = @($checksums)
}

$manifestPath = Join-Path $stageRoot 'package-manifest.json'
$manifestJson = $packageManifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

if (-not $SkipArchive) {
    $archivePath = Join-Path $artifactRoot "VynodeArr-$RuntimeIdentifier.zip"
    if ([System.IO.File]::Exists($archivePath)) {
        Remove-Item -LiteralPath $archivePath -Force
    }

    Compress-Archive -LiteralPath $stageRoot -DestinationPath $archivePath -CompressionLevel Optimal
    Write-Output "Created package: $archivePath"
}

Write-Output "Staged package: $stageRoot"
