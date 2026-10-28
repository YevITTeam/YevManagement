# Produces dist\YevUsbAgent.exe: one self-contained file that is both the agent and its installer.
# With -ApiKey the server URL and key are embedded, so double-clicking the exe installs with no typing; that exe then
# contains the key, keep it inside the network.
param(
    [string]$ApiKey,
    [string]$ServerUrl = 'http://10.45.1.49:8080'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$out = "$root\dist"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
# Stale intermediates could keep an old embedded config.
Remove-Item "$root\obj\Release" -Recurse -Force -ErrorAction SilentlyContinue

$extra = @()
$embedded = "$root\obj\agent.embedded.json"
if ($ApiKey) {
    New-Item -ItemType Directory -Force "$root\obj" | Out-Null
    @{ ServerUrl = $ServerUrl; ApiKey = $ApiKey } | ConvertTo-Json | Set-Content $embedded -Encoding UTF8
    $extra += "-p:AgentConfig=$embedded"
}

try {
    dotnet publish "$root\YevUsbAgent.csproj" -c Release -r win-x64 --self-contained `
        -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true @extra -o $out
    if ($LASTEXITCODE -ne 0) { throw 'publish failed' }
}
finally {
    Remove-Item $embedded -ErrorAction SilentlyContinue
}

# Only the exe is handed out; the config the installer writes replaces appsettings.json.
Get-ChildItem $out -Exclude YevUsbAgent.exe | Remove-Item -Recurse -Force
