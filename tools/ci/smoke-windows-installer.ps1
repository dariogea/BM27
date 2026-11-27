param(
    [Parameter(Mandatory = $true)]
    [string]$BundleDirectory
)

$ErrorActionPreference = 'Stop'
$bundle = @(Get-ChildItem -LiteralPath $BundleDirectory -Filter '*-setup.exe' -File)
if ($bundle.Count -ne 1) {
    throw "Expected a single Windows installer, found $($bundle.Count)."
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('bm27-smoke-' + [Guid]::NewGuid())
$installDirectory = Join-Path $testRoot 'installed'
$payloadDirectory = Join-Path $testRoot 'payload'
$extractor = Get-Command 7z.exe -ErrorAction SilentlyContinue
$extractorPath = if ($extractor) { $extractor.Source } else {
    Join-Path $env:ProgramFiles '7-Zip/7z.exe'
}
& $extractorPath x $bundle[0].FullName "-o$payloadDirectory" '-y' | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not extract the Windows installer (7-Zip exit code $LASTEXITCODE)."
}
$payloadHashes = @(Get-ChildItem -LiteralPath $payloadDirectory -Filter '*.exe' -File -Recurse |
    Get-FileHash -Algorithm SHA256 | ForEach-Object { $_.Hash })
if ($payloadHashes.Count -eq 0) {
    throw 'The Windows installer does not contain an executable.'
}
New-Item -Path $installDirectory -ItemType Directory | Out-Null
# NSIS reads /D= as the last argument. It takes the entire remaining path, including spaces.
$setup = Start-Process -FilePath $bundle[0].FullName -ArgumentList "/S /D=$installDirectory" -PassThru
if (-not $setup.WaitForExit(120000)) {
    $setup.Kill()
    throw 'The installer timed out.'
}
if ($setup.ExitCode -ne 0) {
    throw "The installer exited with code $($setup.ExitCode)."
}

$installed = @(Get-ChildItem -LiteralPath $installDirectory -Filter '*.exe' -File -Recurse |
    Where-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -in $payloadHashes })
if ($installed.Count -ne 1) {
    $installedNames = @(Get-ChildItem -LiteralPath $installDirectory -Filter '*.exe' -File -Recurse).Name
    throw "Expected one installed executable matching the installer payload. Found $($installed.Count). Installed executables: $($installedNames -join ', ')"
}

$installedHash = (Get-FileHash -LiteralPath $installed[0].FullName -Algorithm SHA256).Hash
Write-Output "Installed and verified: $($installed[0].Name)"
$app = Start-Process -FilePath $installed[0].FullName -WorkingDirectory $installDirectory -PassThru
try {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        Start-Sleep -Milliseconds 250
        $app.Refresh()
        if ($app.HasExited) {
            throw "The installed application exited before opening a window (code $($app.ExitCode))."
        }
        if ($app.MainWindowHandle -ne 0 -and $app.MainWindowTitle -like '*Basketball Manager 2027*') {
            Write-Output "Installed and opened: $($app.MainWindowTitle) (SHA-256 $installedHash)"
            return
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'The installed application did not open its main window within 45 seconds.'
} finally {
    if (-not $app.HasExited) {
        $app.Kill()
        $app.WaitForExit()
    }
}
