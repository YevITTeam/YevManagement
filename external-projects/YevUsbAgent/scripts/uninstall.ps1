# Removes the service and binaries. -Purge also deletes the data folder (unsent queue, logs) and the event log source.
param(
    [string]$InstallDir = "$env:ProgramFiles\YevUsbAgent",
    [string]$DataDir = "$env:ProgramData\YevUsbAgent",
    [string]$ServiceName = 'YevUsbAgent',
    [switch]$Purge
)
$ErrorActionPreference = 'Stop'
$sys = "$env:SystemRoot\System32"

if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service $ServiceName -Force
    & "$sys\sc.exe" delete $ServiceName | Out-Null
    Write-Host "Da xoa dich vu $ServiceName."
}

# The exe can take a moment to release after the stop, so retry before giving up.
foreach ($try in 1..5) {
    if (-not (Test-Path $InstallDir)) { break }
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $InstallDir) { Start-Sleep -Seconds 1 }
}
if (Test-Path $InstallDir) {
    # Still locked, typically because the installed exe is the one running this uninstall: remove it after it exits.
    Start-Process "$sys\cmd.exe" -ArgumentList "/c ping -n 4 127.0.0.1 >nul & rmdir /s /q `"$InstallDir`"" -WindowStyle Hidden
    Write-Host "Se xoa $InstallDir sau khi tien trinh nay thoat."
}
else {
    Write-Host "Da xoa $InstallDir."
}

if ($Purge) {
    Remove-Item $DataDir -Recurse -Force -ErrorAction SilentlyContinue
    # Best effort: a leftover event source is harmless and must not fail the uninstall.
    try { if ([System.Diagnostics.EventLog]::SourceExists($ServiceName)) { Remove-EventLog -Source $ServiceName } }
    catch { Write-Host "Khong xoa duoc nguon Event Log (bo qua)." }
    Write-Host "Da xoa du lieu $DataDir."
}
else {
    Write-Host "Giu lai $DataDir (hang doi chua gui). Them --purge de xoa."
}
