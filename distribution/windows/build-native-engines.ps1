[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $MovieSource,

    [Parameter(Mandatory = $true)]
    [string] $TelevisionSource,

    [Parameter(Mandatory = $true)]
    [string] $YarnJs,

    [string] $NodePath = 'node',

    [string] $OutputPath
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$movieRoot = [System.IO.Path]::GetFullPath($MovieSource)
$televisionRoot = [System.IO.Path]::GetFullPath($TelevisionSource)
$yarnScript = [System.IO.Path]::GetFullPath($YarnJs)
$sourceLock = Get-Content (Join-Path $repositoryRoot 'distribution\source-lock.json') -Raw | ConvertFrom-Json

if (-not [System.IO.File]::Exists($yarnScript)) {
    throw "Yarn script does not exist: $yarnScript"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $repositoryRoot 'artifacts\native-inputs'
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputPath)
$movieTarget = Join-Path $outputRoot 'movie'
$televisionTarget = Join-Path $outputRoot 'television'

function Invoke-Checked([scriptblock] $Command, [string] $Label) {
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

function Assert-Revision([string] $Source, [string] $Expected, [string] $Label) {
    $actual = (& git -C $Source rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $actual -ne $Expected) {
        throw "$Label must be at $Expected but is at $actual."
    }

    & git -C $Source diff --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "$Label has tracked source modifications. Native payload builds require a clean source tree."
    }
}

function Build-Frontend([string] $Source) {
    Push-Location $Source
    try {
        Invoke-Checked { & $NodePath $yarnScript install --frozen-lockfile --network-timeout 120000 } 'Yarn install'
        Invoke-Checked { & $NodePath $yarnScript run build --env production } 'Frontend build'
    }
    finally {
        Pop-Location
    }
}

function Build-Backend(
    [string] $Source,
    [string] $Solution,
    [string] $AdditionalProperty) {
    Push-Location $Source
    try {
        $arguments = @(
            'msbuild',
            '-restore',
            $Solution,
            '-p:SelfContained=true',
            '-p:Configuration=Release',
            '-p:Platform=Windows',
            '-p:RuntimeIdentifiers=win-x64',
            '-p:EnableWindowsTargeting=true',
            '-t:PublishAllRids'
        )
        if (-not [string]::IsNullOrWhiteSpace($AdditionalProperty)) {
            $arguments += $AdditionalProperty
        }

        Invoke-Checked { & dotnet @arguments } 'Backend build'
    }
    finally {
        Pop-Location
    }
}

function Reset-Directory([string] $Path) {
    if ([System.IO.Directory]::Exists($Path)) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path | Out-Null
}

function Copy-NativePayload(
    [string] $Source,
    [string] $Target,
    [string] $Framework,
    [string] $Product,
    [string] $License) {
    Reset-Directory $Target
    Copy-Item -Path (Join-Path $Source "_output\$Framework\win-x64\publish\*") -Destination $Target -Recurse -Force
    Copy-Item -Path (Join-Path $Source "_output\$Framework-windows\win-x64\publish\*") -Destination $Target -Recurse -Force
    Copy-Item -Path (Join-Path $Source "_output\$Product.Update\$Framework\win-x64\publish") -Destination (Join-Path $Target "$Product.Update") -Recurse -Force
    Copy-Item -Path (Join-Path $Source '_output\UI') -Destination (Join-Path $Target 'UI') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $Source $License) -Destination $Target
    Remove-Item -Path (Join-Path $Target "$Product.Mono.*"), (Join-Path $Target 'Mono.Posix.NETStandard.*'), (Join-Path $Target 'libMonoPosixHelper.*') -Force -ErrorAction SilentlyContinue
    Copy-Item -Path (Join-Path $Target "$Product.Windows.*") -Destination (Join-Path $Target "$Product.Update") -Force

    foreach ($required in @("$Product.Console.exe", 'UI\index.html', "$Product.Update\$Product.Update.exe")) {
        if (-not (Test-Path (Join-Path $Target $required))) {
            throw "$Product payload is missing $required."
        }
    }
}

Assert-Revision $movieRoot $sourceLock.engines.movie.commit 'Movie source'
Assert-Revision $televisionRoot $sourceLock.engines.television.commit 'Television source'

Build-Backend $movieRoot 'src\Radarr.sln' ''
Build-Frontend $movieRoot
Build-Backend $televisionRoot 'src\Sonarr.sln' '-p:WarningsNotAsErrors=NU1510'
Build-Frontend $televisionRoot

Copy-NativePayload $movieRoot $movieTarget 'net8.0' 'Radarr' 'LICENSE'
Copy-NativePayload $televisionRoot $televisionTarget 'net10.0' 'Sonarr' 'LICENSE.md'

Write-Output "Movie payload: $movieTarget"
Write-Output "Television payload: $televisionTarget"
