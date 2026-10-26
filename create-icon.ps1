$RepoRoot = $PSScriptRoot
$IconPath = Join-Path $RepoRoot "app_icon.ico"
$BatPath = Join-Path $RepoRoot "start-local.bat"
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')

$wsh = New-Object -ComObject WScript.Shell

$shortcutLocations = @(
    (Join-Path $RepoRoot "Book Manager.lnk"),
    (Join-Path $DesktopPath "Book Manager.lnk")
)

foreach ($scPath in $shortcutLocations) {
    try {
        $shortcut = $wsh.CreateShortcut($scPath)
        $shortcut.TargetPath = $BatPath
        $shortcut.WorkingDirectory = $RepoRoot
        $shortcut.Description = "Book Manager - Run Local Application"
        $shortcut.IconLocation = "$IconPath,0"
        $shortcut.Save()
        Write-Host "Created shortcut icon at: $scPath"
    } catch {
        Write-Warning "Failed to create shortcut: $_"
    }
}

# Clean up any obsolete shortcuts
$obsoleteShortcuts = @(
    (Join-Path $RepoRoot "English Grammar Quiz.lnk"),
    (Join-Path $DesktopPath "English Grammar Quiz.lnk")
)

foreach ($obs in $obsoleteShortcuts) {
    if (Test-Path $obs) {
        Remove-Item $obs -Force -ErrorAction SilentlyContinue
        Write-Host "Removed obsolete shortcut: $obs"
    }
}
