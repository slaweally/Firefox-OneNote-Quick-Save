$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$packageName = "Firefox-OneNote-Quick-Save-v$($manifest.version)"
$distDir = Join-Path $PSScriptRoot 'dist'
$stageDir = Join-Path $distDir "$packageName-xpi"
$zipPath = Join-Path $distDir "$packageName.zip"
$xpiPath = Join-Path $distDir "$packageName.xpi"
$files = @(
    'manifest.json',
    'popup.html',
    'popup.js',
    'i18n.js',
    'background.js',
    'icons\onenote.svg'
)

foreach ($relativePath in $files) {
    $sourcePath = Join-Path $PSScriptRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "XPI dosyası bulunamadı: $relativePath"
    }
}

New-Item -ItemType Directory -Path $distDir -Force | Out-Null
if (Test-Path -LiteralPath $stageDir) {
    Remove-Item -LiteralPath $stageDir -Recurse -Force
}

try {
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
    foreach ($relativePath in $files) {
        $sourcePath = Join-Path $PSScriptRoot $relativePath
        $destinationPath = Join-Path $stageDir $relativePath
        $destinationDir = Split-Path -Parent $destinationPath
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }

    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    if (Test-Path -LiteralPath $xpiPath) {
        Remove-Item -LiteralPath $xpiPath -Force
    }
    Add-Type -AssemblyName System.IO.Compression
    $archiveStream = [System.IO.File]::Open(
        $zipPath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite
    )
    try {
        $zipArchive = [System.IO.Compression.ZipArchive]::new(
            $archiveStream,
            [System.IO.Compression.ZipArchiveMode]::Create
        )
        try {
            foreach ($relativePath in $files) {
                $entryName = $relativePath -replace '\\', '/'
                $entry = $zipArchive.CreateEntry(
                    $entryName,
                    [System.IO.Compression.CompressionLevel]::Optimal
                )
                $inputStream = [System.IO.File]::OpenRead((Join-Path $stageDir $relativePath))
                $entryStream = $entry.Open()
                try {
                    $inputStream.CopyTo($entryStream)
                } finally {
                    $entryStream.Dispose()
                    $inputStream.Dispose()
                }
            }
        } finally {
            $zipArchive.Dispose()
        }
    } finally {
        $archiveStream.Dispose()
    }
    Move-Item -LiteralPath $zipPath -Destination $xpiPath

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($xpiPath)
    try {
        $expectedEntries = @($files | ForEach-Object { $_ -replace '\\', '/' } | Sort-Object)
        $actualEntries = @($archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' } | Sort-Object)
        if (Compare-Object -ReferenceObject $expectedEntries -DifferenceObject $actualEntries) {
            throw 'XPI içeriği beklenen eklenti dosyalarıyla eşleşmiyor.'
        }
    } finally {
        $archive.Dispose()
    }

    Write-Host "Firefox eklenti XPI paketi oluşturuldu: $xpiPath"
} finally {
    if (Test-Path -LiteralPath $stageDir) {
        Remove-Item -LiteralPath $stageDir -Recurse -Force
    }
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
}
