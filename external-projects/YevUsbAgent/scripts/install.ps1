# Run as Administrator (Install.bat elevates; Tanium runs it as SYSTEM). Idempotent: re-running upgrades the binary and settings.
# ServerUrl/ApiKey come from the parameters, else agent.json next to this script (build.ps1 -ApiKey), else the config of the
# copy being upgraded (how the updater runs it), else a prompt.
param(
    [string]$ServerUrl,
    [string]$ApiKey,
    [string]$InstallDir = "$env:ProgramFiles\YevUsbAgent",
    [string]$ExePath = "$PSScriptRoot\YevUsbAgent.exe",
    # 'self-update' when the running agent installs a newer build of itself; reported on the web.
    [string]$Reason = 'install'
)
$ErrorActionPreference = 'Stop'
$name = 'YevUsbAgent'
# System tools are called by full path: a trimmed PATH (seen on some PCs and Tanium contexts) hides sc.exe/icacls.exe.
$sys = "$env:SystemRoot\System32"

$dataDir = "$env:ProgramData\YevUsbAgent"
New-Item -ItemType Directory -Force $dataDir | Out-Null
# policy.json and locked-disks.txt drive write-blocking offline: ordinary users must not be able to plant or edit them.
& "$env:SystemRoot\System32\icacls.exe" $dataDir /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
Start-Transcript -Path "$dataDir\install.log" -Append | Out-Null
try {
    $preset = $null
    if (Test-Path "$PSScriptRoot\agent.json") { $preset = Get-Content "$PSScriptRoot\agent.json" -Raw | ConvertFrom-Json }
    $existing = $null
    if (Test-Path "$InstallDir\appsettings.json") { $existing = (Get-Content "$InstallDir\appsettings.json" -Raw | ConvertFrom-Json).Agent }
    if (-not $ServerUrl) { $ServerUrl = if ($preset.ServerUrl) { $preset.ServerUrl } elseif ($existing.ServerUrl) { $existing.ServerUrl } else { 'http://10.45.1.49:8080' } }
    if (-not $ApiKey) { $ApiKey = if ($preset.ApiKey) { $preset.ApiKey } else { $existing.ApiKey } }
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
    # Same format and entropy as AgentSecret.cs; an upgrade passes the already protected key through unchanged.
    if (-not $ApiKey.StartsWith('dpapi:')) {
        Add-Type -AssemblyName System.Security
        $entropy = [Text.Encoding]::UTF8.GetBytes('YevUsbAgent.v1')
        $bytes = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($ApiKey), $entropy, 'LocalMachine')
        $ApiKey = 'dpapi:' + [Convert]::ToBase64String($bytes)
    }
    # The Windows event log provider ignores Information unless asked, and the USB connect/disconnect lines are Information.
    @{
        Agent   = @{ ServerUrl = $ServerUrl; ApiKey = $ApiKey }
        Logging = @{ EventLog = @{ LogLevel = @{ Default = 'Information' } } }
    } | ConvertTo-Json -Depth 5 |
        Set-Content "$InstallDir\appsettings.json" -Encoding UTF8
    # Defence in depth on top of DPAPI: only SYSTEM (the service) and Administrators may read it.
    & "$sys\icacls.exe" "$InstallDir\appsettings.json" /inheritance:r /grant:r '*S-1-5-18:(R)' '*S-1-5-32-544:(F)' | Out-Null

    # The service reports this as its "installed" event on start.
    @{ By = [Security.Principal.WindowsIdentity]::GetCurrent().Name; Reason = $Reason } | ConvertTo-Json |
        Set-Content "$dataDir\installed.json" -Encoding UTF8

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
