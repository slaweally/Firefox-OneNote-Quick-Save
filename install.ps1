$ErrorActionPreference = 'Stop'

$repositoryArchive = 'https://github.com/slaweally/one-note-firefox-sync/archive/refs/heads/main.zip'
$installDir = Join-Path $env:LOCALAPPDATA 'Firefox-OneNote-Quick-Save'
$tempDir = Join-Path $env:TEMP ('Firefox-OneNote-Quick-Save-' + [Guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $tempDir 'source.zip'

Set-ExecutionPolicy -Scope Process Bypass -Force
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

try {
    Write-Host 'Downloading Firefox OneNote Quick Save from GitHub...'
    Invoke-WebRequest -Uri $repositoryArchive -OutFile $archivePath -UseBasicParsing
    Expand-Archive -LiteralPath $archivePath -DestinationPath $tempDir -Force

    $sourceDir = Get-ChildItem -LiteralPath $tempDir -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'install-native-host.ps1') } |
        Select-Object -First 1
    if (-not $sourceDir) {
        throw 'The GitHub archive did not contain the extension source files.'
    }

    Copy-Item -Path (Join-Path $sourceDir.FullName '*') -Destination $installDir -Recurse -Force
    & (Join-Path $installDir 'install-native-host.ps1')
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw 'The local OneNote bridge could not be installed.'
    }

    Write-Host ''
    Write-Host 'Local OneNote connection installed.'
    Write-Host 'One manual Firefox step is still required because temporary add-ons must be loaded by the user:'
    Write-Host '  1. Open about:debugging#/runtime/this-firefox'
    Write-Host '  2. Choose Load Temporary Add-on...'
    Write-Host "  3. Select: $(Join-Path $installDir 'manifest.json')"

    try {
        Start-Process -FilePath 'firefox.exe' -ArgumentList 'about:debugging#/runtime/this-firefox'
    } catch {
        Write-Host 'Open the Firefox address above to finish loading the extension.'
    }
} finally {
    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
}
