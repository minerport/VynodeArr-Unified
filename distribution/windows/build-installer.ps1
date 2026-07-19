[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $IsccPath,

    [string] $SourcePath,

    [string] $Version = '0.1.0'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$compiler = [System.IO.Path]::GetFullPath($IsccPath)
if (-not [System.IO.File]::Exists($compiler)) {
    throw "Inno Setup compiler does not exist: $compiler"
}

if ([string]::IsNullOrWhiteSpace($SourcePath)) {
    $SourcePath = Join-Path $repositoryRoot 'artifacts\windows\VynodeArr-win-x64'
}

$sourceRoot = [System.IO.Path]::GetFullPath($SourcePath)
$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'artifacts\installer'))
$required = @(
    'gateway\VynodeArr.Gateway.exe',
    'tray\VynodeArr.Tray.exe',
    'branding\VynodeArr.ico',
    'engines\movie\Radarr.Console.exe',
    'engines\television\Sonarr.Console.exe',
    'source-lock.json',
    'package-manifest.json'
)
foreach ($relativePath in $required) {
    if (-not [System.IO.File]::Exists((Join-Path $sourceRoot $relativePath))) {
        throw "Installer source is missing $relativePath."
    }
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$scriptPath = Join-Path $PSScriptRoot 'installer\VynodeArr.iss'
& $compiler "/DSourceRoot=$sourceRoot" "/DOutputRoot=$outputRoot" "/DAppVersion=$Version" $scriptPath
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup failed with exit code $LASTEXITCODE."
}

$installer = Join-Path $outputRoot "VynodeArr-$Version-win-x64-setup.exe"
if (-not [System.IO.File]::Exists($installer)) {
    throw "Installer compiler completed without creating $installer."
}

Write-Output "Created installer: $installer"
