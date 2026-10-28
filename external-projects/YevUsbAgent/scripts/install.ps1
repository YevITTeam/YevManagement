# Run as Administrator (Install.bat elevates; Tanium runs it as SYSTEM). Idempotent: re-running upgrades the binary and settings.
# ServerUrl/ApiKey come from the parameters, else from agent.json next to this script (written by build.ps1 -ApiKey), else a prompt.
param(
    [string]$ServerUrl,
    [string]$ApiKey,
    [string]$InstallDir = "$env:ProgramFiles\YevUsbAgent",
    [string]$ExePath = "$PSScriptRoot\YevUsbAgent.exe"
)
$ErrorActionPreference = 'Stop'
$name = 'YevUsbAgent'
# System tools are called by full path: a trimmed PATH (seen on some PCs and Tanium contexts) hides sc.exe/icacls.exe.
$sys = "$env:SystemRoot\System32"

$dataDir = "$env:ProgramData\YevUsbAgent"
New-Item -ItemType Directory -Force $dataDir | Out-Null
Start-Transcript -Path "$dataDir\install.log" -Append | Out-Null
try {
    $preset = $null
    if (Test-Path "$PSScriptRoot\agent.json") { $preset = Get-Content "$PSScriptRoot\agent.json" -Raw | ConvertFrom-Json }
    if (-not $ServerUrl) { $ServerUrl = if ($preset.ServerUrl) { $preset.ServerUrl } else { 'http://10.45.1.49:8080' } }
    if (-not $ApiKey) { $ApiKey = $preset.ApiKey }
    # Tanium/SYSTEM sessions are not interactive, so only prompt when a person is at the console.
    if (-not $ApiKey -and [Environment]::UserInteractive) { $ApiKey = Read-Host 'Nhap ApiKey (trung UsbAgent:ApiKey cua BE)' }
    if (-not $ApiKey) { throw 'ApiKey is required.' }

    if (Get-Service $name -ErrorAction SilentlyContinue) {
        Stop-Service $name -Force
        Start-Sleep -Seconds 2
    }

    New-Item -ItemType Directory -Force $InstallDir | Out-Null
    # Running the installed copy itself (double-click in Program Files) needs no copy.
    if ($ExePath -ne "$InstallDir\YevUsbAgent.exe") { Copy-Item $ExePath $InstallDir -Force }
    # The Windows event log provider ignores Information unless asked, and the USB connect/disconnect lines are Information.
    @{
        Agent   = @{ ServerUrl = $ServerUrl; ApiKey = $ApiKey }
        Logging = @{ EventLog = @{ LogLevel = @{ Default = 'Information' } } }
    } | ConvertTo-Json -Depth 5 |
        Set-Content "$InstallDir\appsettings.json" -Encoding UTF8
    # The file holds the API key: only SYSTEM (the service) and Administrators may read it, not ordinary users.
    & "$sys\icacls.exe" "$InstallDir\appsettings.json" /inheritance:r /grant:r '*S-1-5-18:(R)' '*S-1-5-32-544:(F)' | Out-Null

    if (-not (Get-Service $name -ErrorAction SilentlyContinue)) {
        New-Service -Name $name -BinaryPathName "`"$InstallDir\YevUsbAgent.exe`"" `
            -DisplayName 'YEV USB Agent' -StartupType Automatic | Out-Null
        & "$sys\sc.exe" failure $name reset= 86400 actions= restart/60000 | Out-Null
    }
    Start-Service $name
    Write-Host "Da cai va khoi dong dich vu $name (server: $ServerUrl)."
}
finally {
    Stop-Transcript | Out-Null
}
