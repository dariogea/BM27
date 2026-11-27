param(
    [Parameter(Mandatory = $true)]
    [string]$BuiltExecutable,

    [Parameter(Mandatory = $true)]
    [string]$BundleDirectory
)

$ErrorActionPreference = 'Stop'
$bundle = @(Get-ChildItem -LiteralPath $BundleDirectory -Filter '*-setup.exe' -File)
if ($bundle.Count -ne 1) {
    throw "Expected a single Windows installer, found $($bundle.Count)."
}

$expectedHash = (Get-FileHash -LiteralPath $BuiltExecutable -Algorithm SHA256).Hash
$installDirectory = Join-Path ([IO.Path]::GetTempPath()) ('bm27-smoke-' + [Guid]::NewGuid())
# NSIS reads /D= as the last argument. It takes the entire remaining path, including spaces.
$setup = Start-Process -FilePath $bundle[0].FullName -ArgumentList "/S /D=$installDirectory" -PassThru
if (-not $setup.WaitForExit(120000)) {
    $setup.Kill()
    throw 'The installer timed out.'
}
if ($setup.ExitCode -ne 0) {
    throw "The installer exited with code $($setup.ExitCode)."
}

$installed = @(Get-ChildItem -LiteralPath $installDirectory -Filter '*.exe' -File |
    Where-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -eq $expectedHash })
if ($installed.Count -ne 1) {
    throw 'The installed application does not match the compiled executable.'
}

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
            Write-Output "Installed and opened: $($app.MainWindowTitle) (SHA-256 $expectedHash)"
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
