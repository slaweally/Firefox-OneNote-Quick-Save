param(
    [switch]$SourceOnly
)

$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$packageName = "Firefox-OneNote-Quick-Save-v$($manifest.version)"
$distDir = Join-Path $PSScriptRoot 'dist'
$stageDir = Join-Path $distDir "$packageName-source"
$archivePath = Join-Path $distDir "$packageName.zip"
$files = @(
    'manifest.json',
    'popup.html',
    'popup.js',
    'i18n.js',
    'background.js',
    'README.md',
    'PRIVACY.md',
    'docs\cover.png',
    'install.ps1',
    'install-native-host.ps1',
    'package-xpi.ps1',
    'native-host\Program.cs',
    'icons\onenote.svg',
    '.github\ISSUE_TEMPLATE\bug_report.yml',
    '.github\ISSUE_TEMPLATE\feature_request.yml',
    '.github\ISSUE_TEMPLATE\config.yml'
)

foreach ($relativePath in $files) {
    $sourcePath = Join-Path $PSScriptRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Paket dosyası bulunamadı: $relativePath"
    }
}

if (-not $SourceOnly) {
    & (Join-Path $PSScriptRoot 'package-xpi.ps1')
}

if (Test-Path -LiteralPath $stageDir) {
    Remove-Item -LiteralPath $stageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
foreach ($relativePath in $files) {
    $sourcePath = Join-Path $PSScriptRoot $relativePath
    $destinationPath = Join-Path $stageDir $relativePath
    $destinationDir = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
}

if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $archivePath
Remove-Item -LiteralPath $stageDir -Recurse -Force

Write-Host "GitHub kaynak paketi oluşturuldu: $archivePath"
