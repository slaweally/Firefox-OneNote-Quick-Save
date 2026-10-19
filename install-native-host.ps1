$ErrorActionPreference = 'Stop'

$outputDir = Join-Path $PSScriptRoot 'native-host\publish'
$source = Join-Path $PSScriptRoot 'native-host\Program.cs'
$hostName = 'com.onenote.quick_save'
$hostManifestDir = Join-Path $env:APPDATA 'Mozilla\NativeMessagingHosts'
$hostManifestPath = Join-Path $hostManifestDir "$hostName.json"
$hostExe = Join-Path $outputDir 'OneNoteQuickSave.NativeHost.exe'
$registryPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\$hostName"

$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path $compiler)) {
    throw 'Windows .NET Framework derleyicisi bulunamadı.'
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
& $compiler /nologo /target:exe "/out:$hostExe" `
    /reference:System.Xml.Linq.dll /reference:System.Web.Extensions.dll `
    /reference:Microsoft.CSharp.dll $source
if ($LASTEXITCODE -ne 0) {
    throw 'Yerel OneNote yardımcı uygulaması derlenemedi.'
}

New-Item -ItemType Directory -Path $hostManifestDir -Force | Out-Null
$manifest = @{
    name = $hostName
    description = 'Firefox için yerel OneNote masaüstü bağlantısı'
    path = $hostExe
    type = 'stdio'
    allowed_extensions = @('onenote-quick-save@example.com')
} | ConvertTo-Json -Depth 3
Set-Content -Path $hostManifestPath -Value $manifest -Encoding ASCII
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $hostManifestPath

Write-Host 'Yerel OneNote bağlantısı kuruldu. Firefox''u yeniden başlatıp eklentiyi yükleyin.'
