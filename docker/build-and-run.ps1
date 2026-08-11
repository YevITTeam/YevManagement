# Build + chay ca BE va FE bang Docker Engine (Windows containers) tren Windows Server.
# Thay the AutoDeploy.ps1 (IIS) - xem docs/deploy-config/docker-deploy-guide.md truoc khi dung lan dau.
#
# Yeu cau da co san truoc khi chay:
#   - Docker Engine (Windows containers) da cai va dang chay (`docker version`).
#   - $APPSETTINGS_PATH tro toi file appsettings.json that cua production (ngoai repo).
#   - Neu giu Negotiate SSO: credential spec "yevmanagement-be.json" da tao trong
#     C:\ProgramData\Docker\CredentialSpecs (xem huong dan gMSA).
#   - pnpm da cai (frontend build chay tren HOST, khong build trong container).
#
# Chay tu goc repo:  .\docker\build-and-run.ps1

#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "==> [1/4] pnpm build (Next.js static export -> yev-frontend/out/)" -ForegroundColor Cyan
Push-Location (Join-Path $RepoRoot "yev-frontend")
try {
    pnpm install
    pnpm build
} finally {
    Pop-Location
}
if (-not (Test-Path (Join-Path $RepoRoot "yev-frontend/out/index.html"))) {
    throw "pnpm build khong sinh ra yev-frontend/out/index.html - dung lai, kiem tra loi build o tren."
}

Write-Host "==> [2/4] docker compose build (dong goi BE + FE thanh image)" -ForegroundColor Cyan
docker compose build
if ($LASTEXITCODE -ne 0) { throw "docker compose build that bai." }

Write-Host "==> [3/4] docker compose up -d (khoi dong lai container, giu volume/log)" -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up that bai." }

Write-Host "==> [4/4] Don image cu khong con container nao dung (giu image dang chay)" -ForegroundColor Cyan
docker image prune -f | Out-Null

Write-Host "`nXONG. Kiem tra:  docker compose ps   |   docker compose logs -f backend" -ForegroundColor Green
