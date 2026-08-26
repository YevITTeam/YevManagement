# Smoke driver for the YevManagement backend (CompanySystem.HostApi).
#
# Starts the API if nothing is listening on the target port, runs READ-ONLY
# checks against the real endpoints (OpenAPI doc, Scalar UI, Windows
# Negotiate login -> JWT -> Admin endpoint, Asset grid endpoints), then
# stops the API again if this script was the one that started it.
#
# The databases (DASVRFAST) hold live data — do not add POST/PUT/DELETE
# checks here. Note that windows-login itself already writes
# LoginUserIPs.LastLoginAt; everything else stays read-only.
#
# Usage (from the solution root, works in Windows PowerShell 5.1 and pwsh):
#   powershell -ExecutionPolicy Bypass -File .claude\skills\run-yevmanagement\smoke.ps1
#   ... -KeepRunning   # leave the API listening afterwards for manual curl
#
# $BaseUrl must match the `http` profile's applicationUrl in
# CompanySystem.HostApi/Properties/launchSettings.json — the script starts the
# API with that profile, so a mismatched URL just times out waiting for a port
# that never opens. Override with -BaseUrl if the profile changes.
param(
    [string]$BaseUrl = "http://10.45.1.155:8081",
    [switch]$KeepRunning
)

$ErrorActionPreference = 'Stop'
$unitRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$hostProj = Join-Path $unitRoot 'CompanySystem.HostApi'
$port = ([Uri]$BaseUrl).Port

function Test-Listening {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

$startedByUs = $false
$runProc = $null
$outLog = Join-Path $env:TEMP 'yev-hostapi.out.log'
$errLog = Join-Path $env:TEMP 'yev-hostapi.err.log'

if (Test-Listening) {
    Write-Host "API already listening on port $port - reusing it (will not stop it afterwards)."
} else {
    Write-Host "Starting CompanySystem.HostApi (dotnet run, http profile)..."
    $runProc = Start-Process -FilePath 'dotnet' `
        -ArgumentList 'run', '--project', "`"$hostProj`"", '--launch-profile', 'http' `
        -WorkingDirectory $unitRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $startedByUs = $true
    $deadline = (Get-Date).AddSeconds(120)
    while (-not (Test-Listening)) {
        if ($runProc.HasExited -or (Get-Date) -gt $deadline) {
            Write-Host "API failed to start (exited=$($runProc.HasExited)). Log tails:" -ForegroundColor Red
            if (Test-Path $outLog) { Get-Content $outLog -Tail 30 }
            if (Test-Path $errLog) { Get-Content $errLog -Tail 30 }
            exit 1
        }
        Start-Sleep -Milliseconds 700
    }
    Write-Host "API is listening on port $port. Server log: $outLog"
}

$script:failures = 0
$script:token = $null

function Check([string]$name, [scriptblock]$body) {
    try {
        & $body
        Write-Host "[PASS] $name" -ForegroundColor Green
    } catch {
        $script:failures++
        Write-Host "[FAIL] $name -> $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Returns the HTTP status code without throwing on non-2xx.
# PS 5.1 throws WebException, pwsh 7 throws HttpResponseException; both
# expose .Response with a status code.
function Get-StatusCode([string]$uri) {
    try {
        $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 10
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        throw
    }
}

Check 'GET /openapi/v1.json returns the OpenAPI document (anonymous, Development only)' {
    $r = Invoke-WebRequest -Uri "$BaseUrl/openapi/v1.json" -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -ne 200 -or $r.Content -notmatch '"openapi"') { throw "unexpected response (status $($r.StatusCode))" }
}

Check 'GET /scalar/v1 serves the Scalar API reference UI' {
    $r = Invoke-WebRequest -Uri "$BaseUrl/scalar/v1" -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
}

Check 'POST /api/Auth/windows-login (Negotiate, current Windows user) returns a JWT' {
    $login = Invoke-RestMethod -Uri "$BaseUrl/api/Auth/windows-login" -Method Post -UseDefaultCredentials -TimeoutSec 30
    if (-not $login.isSuccess -or -not $login.data.token) { throw "login failed: $($login.message)" }
    $script:token = $login.data.token
    Write-Host "       user=$($login.data.user.userName) roles=$($login.data.user.roles -join ',')"
}

Check 'GET /api/Auth/get-all-roles without a token is rejected with 401' {
    $status = Get-StatusCode "$BaseUrl/api/Auth/get-all-roles"
    if ($status -ne 401) { throw "expected 401, got $status" }
}

Check 'GET /api/Auth/get-all-roles with Bearer token returns roles (requires Admin role)' {
    if (-not $script:token) { throw 'no token from windows-login (previous check failed)' }
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/Auth/get-all-roles" -Headers @{ Authorization = "Bearer $($script:token)" } -TimeoutSec 15
    if (-not $r.isSuccess) { throw $r.message }
    Write-Host "       roles in DB: $(($r.data | ForEach-Object { $_.roleName }) -join ', ')"
}

Check 'GET /api/Branch/grid-list returns branches (requires Bearer token + permission)' {
    if (-not $script:token) { throw 'no token from windows-login (previous check failed)' }
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/Branch/grid-list?pageIndex=1&pageSize=5" -Headers @{ Authorization = "Bearer $($script:token)" } -TimeoutSec 15
    if (-not $r.isSuccess) { throw $r.message }
}

Check 'GET /api/Device/grid-list returns paged devices from SQL Server' {
    if (-not $script:token) { throw 'no token from windows-login (previous check failed)' }
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/Device/grid-list?pageIndex=1&pageSize=2" -Headers @{ Authorization = "Bearer $($script:token)" } -TimeoutSec 20
    if (-not $r.isSuccess) { throw $r.message }
    Write-Host "       total devices: $($r.data.totalCount)"
}

if ($startedByUs -and -not $KeepRunning) {
    try {
        $owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($owner) { Stop-Process -Id $owner.OwningProcess -Force -Confirm:$false }
        if ($runProc -and -not $runProc.HasExited) { Stop-Process -Id $runProc.Id -Force -Confirm:$false -ErrorAction SilentlyContinue }
        Write-Host "API stopped."
    } catch {
        Write-Host "Warning: could not stop the API cleanly: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} elseif ($startedByUs) {
    Write-Host "API left running on $BaseUrl (-KeepRunning). Stop it with:"
    Write-Host "  Get-NetTCPConnection -LocalPort $port -State Listen | Select -First 1 | % { Stop-Process -Id `$_.OwningProcess -Force }"
}

if ($script:failures -gt 0) {
    Write-Host "$($script:failures) check(s) FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "All checks passed." -ForegroundColor Green
exit 0
