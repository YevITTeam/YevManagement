@echo off
setlocal

rem Build web tinh (static export, output: 'export' trong next.config.ts chi bat
rem khi phase la production build) roi thay cac file trong ./out bang ban deploy
rem dung o docs/deploy-config/config-fe (web.config cho IIS, index.html redirect /vi/).

cd /d "%~dp0"

set "OUT_DIR=out"
set "CONFIG_SRC_DIR=..\docs\deploy-config\config-fe"

echo ============================================
echo   BUILD FRONTEND - Next.js static export
echo ============================================

echo.
echo [1/3] Dang cai dependencies (pnpm install)...
call pnpm install
if errorlevel 1 (
    echo.
    echo [LOI] pnpm install that bai.
    exit /b 1
)

echo.
echo [2/3] Dang build (next build -^> %OUT_DIR%)...
call pnpm build
if errorlevel 1 (
    echo.
    echo [LOI] Build that bai.
    exit /b 1
)

if not exist "%OUT_DIR%" (
    echo [LOI] Khong tim thay thu muc %OUT_DIR% sau khi build.
    exit /b 1
)

echo.
echo [3/3] Dang thay the web.config / index.html bang ban deploy...
if not exist "%CONFIG_SRC_DIR%" (
    echo [LOI] Khong tim thay thu muc "%CONFIG_SRC_DIR%"
    exit /b 1
)
for %%F in ("%CONFIG_SRC_DIR%\*") do (
    copy /y "%%F" "%OUT_DIR%\" >nul
    if errorlevel 1 (
        echo [LOI] Copy %%~nxF that bai.
        exit /b 1
    )
)

echo.
echo Hoan tat. Ket qua static export nam tai: %OUT_DIR%
endlocal
