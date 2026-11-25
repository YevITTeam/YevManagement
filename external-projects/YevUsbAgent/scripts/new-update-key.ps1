# Creates the RSA key the BE signs agent updates with (once; rotating it means reinstalling every agent through Tanium).
# Copy the private key file to App_Data\usb-agent-update-key.xml of every BE that takes uploads and keep a backup;
# paste the printed public key into Update/UpdateKey.cs and Asset.Application UsbAgentReleaseKey.cs.
param([string]$KeyPath = "$env:USERPROFILE\.yev\usb-agent-update-key.xml")
$ErrorActionPreference = 'Stop'
if (Test-Path $KeyPath) { throw "$KeyPath already exists; delete it only if you really mean to rotate the key." }

New-Item -ItemType Directory -Force (Split-Path $KeyPath) | Out-Null
$rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider 3072
try {
    Set-Content $KeyPath $rsa.ToXmlString($true) -Encoding ASCII
    # Only the current user may read the private key.
    & "$env:SystemRoot\System32\icacls.exe" $KeyPath /inheritance:r /grant:r "${env:USERDOMAIN}\${env:USERNAME}:(F)" | Out-Null
    Write-Host "Private key: $KeyPath"
    Write-Host "Public key:"
    $rsa.ToXmlString($false)
}
finally { $rsa.Dispose() }
