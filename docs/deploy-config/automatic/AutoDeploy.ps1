#Requires -Modules WebAdministration
Import-Module WebAdministration

# ================= CAU HINH =================
$BaseDir = "D:\Deploy"

# 2 App Pool rieng cho 2 site (ca 2 deu set .NET CLR version = "No Managed Code").
$BackendAppPool  = "YevManagement-BE-Pool"
$FrontendAppPool = "YevManagement-FE-Pool"   # script khong dung/start pool nay - FE la web tinh, khong can recycle

$BackendLive     = "$BaseDir\publish_backend"
$BackendPending  = "$BaseDir\_Pending_Backend"

$FrontendLive    = "$BaseDir\publish_frontend"
$FrontendPending = "$BaseDir\_Pending_Frontend"

$LogFile = "$BaseDir\deploy.log"

# appsettings.json chua connection string / JWT secret / SMTP that cua production.
# File nay KHONG duoc source-control (gitignored) va co the khac nhau giua cac may build,
# nen KHONG BAO GIO ghi de no tu goi Pending - phai sua truc tiep tren server neu can doi.
$BackendProtectedPatterns = @("logs", "appsettings.json", "appsettings.*.json")
# =====================================================

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Test-NameExcluded {
    param([string]$Name, [string[]]$Patterns)
    foreach ($pattern in $Patterns) {
        if ($Name -like $pattern) { return $true }
    }
    return $false
}

function Wait-AppPoolStopped {
    param([string]$Name, [int]$TimeoutSeconds = 30)
    $elapsedMs = 0
    while ($elapsedMs -lt ($TimeoutSeconds * 1000)) {
        if ((Get-WebAppPoolState -Name $Name).Value -eq "Stopped") { return }
        Start-Sleep -Milliseconds 500
        $elapsedMs += 500
    }
    throw "App Pool '$Name' khong chuyen sang trang thai Stopped sau $TimeoutSeconds giay."
}

# Xoa toan bo file/thu muc con trong $Path, tru nhung ten khop $ExcludePatterns (ho tro wildcard '*').
function Remove-LiveContent {
    param([string]$Path, [string[]]$ExcludePatterns = @())

    Get-ChildItem -Path $Path -Force | ForEach-Object {
        if (Test-NameExcluded -Name $_.Name -Patterns $ExcludePatterns) { return }
        try {
            Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction Stop
        } catch {
            Write-Log "  [CANH BAO] Khong xoa duoc '$($_.FullName)': $_"
        }
    }
}

# Copy toan bo file/thu muc con tu $Source sang $Destination, tru nhung ten khop $ExcludePatterns.
function Copy-PendingContent {
    param([string]$Source, [string]$Destination, [string[]]$ExcludePatterns = @())

    Get-ChildItem -Path $Source -Force | ForEach-Object {
        if (Test-NameExcluded -Name $_.Name -Patterns $ExcludePatterns) { return }
        Copy-Item -Path $_.FullName -Destination $Destination -Recurse -Force
    }
}

# Chi cho 1 phien chay tai 1 thoi diem (script duoc goi lap lai qua Task Scheduler).
$Mutex = New-Object System.Threading.Mutex($false, "Global\YevManagementDeployWatcher")
if (-not $Mutex.WaitOne(0)) {
    Write-Log "Mot phien deploy khac dang chay - bo qua lan nay."
    exit 0
}

try {
    foreach ($dir in @($BackendLive, $BackendPending, $FrontendLive, $FrontendPending)) {
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    }

    # ----------------- 1. DEPLOY BACKEND -----------------
    $BackendTrigger = Join-Path $BackendPending "deploy.ready"
    if (Test-Path $BackendTrigger) {
        Write-Log "=> Phat hien phien ban BACKEND moi..."
        try {
            Write-Log "  Dang dung App Pool '$BackendAppPool' de nha file DLL..."
            Stop-WebAppPool -Name $BackendAppPool
            Wait-AppPoolStopped -Name $BackendAppPool -TimeoutSeconds 30

            Write-Log "  Dang xoa code cu (giu lai logs/ va appsettings*.json)..."
            Remove-LiveContent -Path $BackendLive -ExcludePatterns $BackendProtectedPatterns

            Write-Log "  Dang copy code moi tu Pending..."
            $BackendCopyExclude = $BackendProtectedPatterns + @("deploy.ready")
            Copy-PendingContent -Source $BackendPending -Destination $BackendLive -ExcludePatterns $BackendCopyExclude

            Write-Log "  Dang khoi dong lai App Pool '$BackendAppPool'..."
            Start-WebAppPool -Name $BackendAppPool

            Remove-Item -Path "$BackendPending\*" -Recurse -Force
            Write-Log "=> DEPLOY BACKEND THANH CONG!"
        } catch {
            Write-Log "=> LOI DEPLOY BACKEND: $_"
            # Co gang bat lai App Pool neu xay ra loi de he thong khong bi chet
            Start-WebAppPool -Name $BackendAppPool -ErrorAction SilentlyContinue
        }
    }

    # ----------------- 2. DEPLOY FRONTEND -----------------
    $FrontendTrigger = Join-Path $FrontendPending "deploy.ready"
    if (Test-Path $FrontendTrigger) {
        Write-Log "=> Phat hien phien ban FRONTEND moi..."
        try {
            # Frontend la web tinh, pool rieng khong dung chung voi BE nen khong can Stop/Start App Pool.
            Write-Log "  Dang xoa code cu (bao gom ca web.config, se lay ban moi tu Pending)..."
            Remove-LiveContent -Path $FrontendLive -ExcludePatterns @()

            Write-Log "  Dang copy code moi tu Pending..."
            Copy-PendingContent -Source $FrontendPending -Destination $FrontendLive -ExcludePatterns @("deploy.ready")

            Remove-Item -Path "$FrontendPending\*" -Recurse -Force
            Write-Log "=> DEPLOY FRONTEND THANH CONG!"
        } catch {
            Write-Log "=> LOI DEPLOY FRONTEND: $_"
        }
    }
} finally {
    $Mutex.ReleaseMutex()
}
